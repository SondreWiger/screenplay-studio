import { randomUUID } from 'crypto';
import { BUILTIN_FRAMEWORKS, type BeatSheetData } from '@/lib/beat-frameworks';
import { parseSceneHeading } from '@/lib/scripts/scene-heading';
import { ToolError, type McpContext } from '../context';
import { KINDS } from '../kinds';
import { s } from '../schema';
import { compact, must, tool } from '../tool';
import { loadElements } from './scripts';

/**
 * Story planning that does not live in its own table: the beat sheet and the
 * arc map are JSON inside projects.content_metadata, in exactly the shape the
 * Beat Sheet and Arc Planner pages read. Plus scene syncing and search.
 */

async function loadMetadata(ctx: McpContext, projectId: string): Promise<Record<string, unknown>> {
  const row = must(await ctx.db.from('projects').select('content_metadata').eq('id', projectId).single(), 'Loading project') as { content_metadata: Record<string, unknown> | null };
  return row.content_metadata ?? {};
}

/** Re-reads before writing so a concurrent save of another key is not lost. */
async function saveMetadata(ctx: McpContext, projectId: string, patch: Record<string, unknown>) {
  const current = await loadMetadata(ctx, projectId);
  must(await ctx.db.from('projects').update({ content_metadata: { ...current, ...patch }, updated_at: new Date().toISOString() }).eq('id', projectId), 'Saving project');
}

function beatSheets(meta: Record<string, unknown>): Record<string, BeatSheetData> {
  if (meta.beat_sheets) return meta.beat_sheets as Record<string, BeatSheetData>;
  if (meta.beat_sheet) return { project: meta.beat_sheet as BeatSheetData };
  return {};
}

function renderBeatSheet(scope: string, sheet: BeatSheetData | undefined) {
  const framework = sheet?.framework ?? 'save_the_cat';
  const totalPages = sheet?.totalPages ?? 110;
  const def = BUILTIN_FRAMEWORKS[framework];
  const saved = sheet?.beats ?? {};

  const beats = def
    ? def.beats.map((b) => compact({
      id: b.id,
      label: b.label,
      description: b.description,
      target_page: Math.max(1, Math.round((b.pagePercent / 100) * totalPages)),
      notes: saved[b.id]?.notes,
      linked_scene_ids: saved[b.id]?.linkedSceneIds,
      completed: saved[b.id]?.completed || undefined,
    }))
    // Custom frameworks are defined in the browser that made them; only the saved notes are here.
    : Object.entries(saved).map(([id, b]) => compact({ id, notes: b.notes, linked_scene_ids: b.linkedSceneIds, completed: b.completed || undefined }));

  return { scope, framework, framework_label: def?.label ?? 'Custom framework', total_pages: totalPages, saved: Boolean(sheet), beats };
}

type ArcNodeType = 'episode' | 'arc' | 'character' | 'theme' | 'event' | 'note';
type ArcEdgeType = 'story-arc' | 'subplot' | 'character-link' | 'conflict' | 'cause-effect';
interface ArcNode { id: string; type: ArcNodeType; label: string; body?: string; x: number; y: number; color: string; episodeRef?: string; locked?: boolean; width?: number; height?: number }
interface ArcEdge { id: string; from: string; to: string; label?: string; type: ArcEdgeType; waypoints?: { x: number; y: number }[] }
interface ArcMap { nodes: ArcNode[]; edges: ArcEdge[]; version: 1 }

const NODE_TYPES: ArcNodeType[] = ['episode', 'arc', 'character', 'theme', 'event', 'note'];
const EDGE_TYPES: ArcEdgeType[] = ['story-arc', 'subplot', 'character-link', 'conflict', 'cause-effect'];
/** Same defaults as ArcMindmap's NODE_COLORS. */
const NODE_COLORS: Record<ArcNodeType, string> = {
  episode: '#7c3aed', arc: '#0369a1', character: '#047857', theme: '#b45309', event: '#be185d', note: '#374151',
};

function parseArcMap(raw: unknown): ArcMap {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as ArcMap;
      return { nodes: parsed.nodes ?? [], edges: parsed.edges ?? [], version: 1 };
    } catch { /* fall through to empty */ }
  }
  return { nodes: [], edges: [], version: 1 };
}

const nodeInput = {
  label: s.string(),
  type: s.enum(NODE_TYPES),
  body: s.string('Longer description'),
  color: s.string('Hex colour (defaults by type)'),
  x: s.number('Canvas x; omitted nodes are laid out automatically'),
  y: s.number(),
  episode_ref: s.id('Script id this node represents (episodes)'),
};

export const planningTools = [
  tool<{ project_id: string; scope?: string }>({
    name: 'get_beat_sheet',
    title: 'Get beat sheet',
    access: 'read',
    description:
      'The story structure beat sheet: framework (Save the Cat, Three-Act, Hero\'s Journey), each beat with its purpose, target page, notes and linked scenes. scope is "project" (default), "ep_{scriptId}" for an episode, or "season_{n}".',
    input: s.object({ project_id: s.id('Project id'), scope: s.string('project | ep_{scriptId} | season_{n}') }, ['project_id']),
    async run(args, ctx) {
      await ctx.requireProject(args.project_id, 'read');
      const sheets = beatSheets(await loadMetadata(ctx, args.project_id));
      const scope = args.scope ?? 'project';
      return {
        ...renderBeatSheet(scope, sheets[scope]),
        other_scopes: Object.keys(sheets).filter((k) => k !== scope),
        frameworks: Object.entries(BUILTIN_FRAMEWORKS).map(([key, f]) => ({ key, label: f.label, beats: f.beats.length })),
      };
    },
  }),

  tool<{ project_id: string; scope?: string; framework?: string; total_pages?: number; beats?: Record<string, { notes?: string; linked_scene_ids?: string[]; completed?: boolean }> }>({
    name: 'update_beat_sheet',
    title: 'Update beat sheet',
    access: 'write',
    description:
      'Fill in or change beats. Pass only what changes: `beats` is keyed by beat id (from get_beat_sheet), e.g. { "catalyst": { "notes": "Maya finds the letter", "linked_scene_ids": ["..."] } }. Also sets framework and total_pages.',
    input: s.object({
      project_id: s.id('Project id'),
      scope: s.string('project (default) | ep_{scriptId} | season_{n}'),
      framework: s.enum(Object.keys(BUILTIN_FRAMEWORKS)),
      total_pages: s.integer('Target script length in pages', { minimum: 1 }),
      beats: s.record('beat id → { notes?, linked_scene_ids?, completed? }'),
    }, ['project_id']),
    async run(args, ctx) {
      await ctx.requireProject(args.project_id, 'write');
      const scope = args.scope ?? 'project';
      if (!/^(project|ep_[0-9a-f-]{36}|season_\d+)$/.test(scope)) throw new ToolError('scope must be project, ep_{scriptId} or season_{n}');

      const sheets = beatSheets(await loadMetadata(ctx, args.project_id));
      const current: BeatSheetData = sheets[scope] ?? { framework: 'save_the_cat', totalPages: 110, beats: {} };
      const next: BeatSheetData = {
        framework: (args.framework as BeatSheetData['framework']) ?? current.framework,
        totalPages: args.total_pages ?? current.totalPages,
        beats: { ...current.beats },
      };

      const known = BUILTIN_FRAMEWORKS[next.framework]?.beats.map((b) => b.id);
      for (const [id, change] of Object.entries(args.beats ?? {})) {
        if (known && !known.includes(id)) throw new ToolError(`"${id}" is not a beat in ${next.framework}. Beats: ${known.join(', ')}`);
        const prev = next.beats[id] ?? { notes: '', scenes: [] };
        next.beats[id] = {
          ...prev,
          notes: change.notes ?? prev.notes ?? '',
          scenes: prev.scenes ?? [],
          linkedSceneIds: change.linked_scene_ids ?? prev.linkedSceneIds ?? [],
          completed: change.completed ?? prev.completed ?? false,
        };
      }

      const all = { ...sheets, [scope]: next };
      // The page also keeps the project scope under the legacy key.
      await saveMetadata(ctx, args.project_id, { beat_sheets: all, beat_sheet: all.project });
      await ctx.audit('update_beat_sheet', 'project', args.project_id, { scope, beats: Object.keys(args.beats ?? {}) });
      return renderBeatSheet(scope, next);
    },
  }),

  tool<{ project_id: string }>({
    name: 'get_arc_map',
    title: 'Get arc map',
    access: 'read',
    description: 'The Arc Planner canvas: nodes (episodes, story arcs, characters, themes, events, notes) and the connections between them.',
    input: s.object({ project_id: s.id('Project id') }, ['project_id']),
    async run(args, ctx) {
      await ctx.requireProject(args.project_id, 'read');
      const map = parseArcMap((await loadMetadata(ctx, args.project_id)).arc_map);
      return {
        nodes: map.nodes.map((n) => compact({ id: n.id, type: n.type, label: n.label, body: n.body, episode_ref: n.episodeRef, x: n.x, y: n.y })),
        edges: map.edges.map((e) => compact({ id: e.id, from: e.from, to: e.to, type: e.type, label: e.label })),
      };
    },
  }),

  tool<{
    project_id: string;
    clear?: boolean;
    add_nodes?: { label: string; type: ArcNodeType; body?: string; color?: string; x?: number; y?: number; episode_ref?: string; key?: string }[];
    update_nodes?: { id: string; label?: string; type?: ArcNodeType; body?: string; color?: string; x?: number; y?: number }[];
    remove_node_ids?: string[];
    add_edges?: { from: string; to: string; type?: ArcEdgeType; label?: string }[];
    remove_edge_ids?: string[];
  }>({
    name: 'update_arc_map',
    title: 'Update arc map',
    access: 'write',
    description:
      'Map out story arcs visually. Add, change or remove nodes and connections in one call. New nodes can be referenced by edges in the same call through their `key` (e.g. add_nodes [{ key: "a", ... }], add_edges [{ from: "a", to: "<existing id>" }]). Positions are laid out automatically when x/y are omitted.',
    input: s.object({
      project_id: s.id('Project id'),
      clear: s.boolean('Start from an empty canvas'),
      add_nodes: s.array(s.object({ ...nodeInput, key: s.string('Temporary name to reference this node from add_edges') }, ['label', 'type'])),
      update_nodes: s.array(s.object({ id: s.string('Node id'), ...nodeInput }, ['id'])),
      remove_node_ids: s.array(s.string(), 'Also removes their connections'),
      add_edges: s.array(s.object({ from: s.string('Node id or key'), to: s.string('Node id or key'), type: s.enum(EDGE_TYPES), label: s.string() }, ['from', 'to'])),
      remove_edge_ids: s.array(s.string()),
    }, ['project_id']),
    async run(args, ctx) {
      await ctx.requireProject(args.project_id, 'write');
      const map = args.clear ? parseArcMap(null) : parseArcMap((await loadMetadata(ctx, args.project_id)).arc_map);

      const removed = new Set(args.remove_node_ids ?? []);
      map.nodes = map.nodes.filter((n) => !removed.has(n.id));
      const removedEdges = new Set(args.remove_edge_ids ?? []);
      map.edges = map.edges.filter((e) => !removedEdges.has(e.id) && !removed.has(e.from) && !removed.has(e.to));

      for (const u of args.update_nodes ?? []) {
        const node = map.nodes.find((n) => n.id === u.id);
        if (!node) throw new ToolError(`Arc map node ${u.id} not found`);
        Object.assign(node, compact({ label: u.label, type: u.type, body: u.body, color: u.color, x: u.x, y: u.y }));
      }

      // Lay new nodes out on a grid below whatever is already there.
      const baseY = map.nodes.length ? Math.max(...map.nodes.map((n) => n.y)) + 220 : 80;
      const keys = new Map<string, string>();
      const added = (args.add_nodes ?? []).map((n, i) => {
        const node: ArcNode = {
          id: randomUUID(),
          type: n.type,
          label: n.label,
          ...(n.body ? { body: n.body } : {}),
          ...(n.episode_ref ? { episodeRef: n.episode_ref } : {}),
          color: n.color ?? NODE_COLORS[n.type],
          x: n.x ?? 80 + (i % 6) * 240,
          y: n.y ?? baseY + Math.floor(i / 6) * 180,
        };
        if (n.key) keys.set(n.key, node.id);
        map.nodes.push(node);
        return { key: n.key, id: node.id, label: node.label };
      });

      const ids = new Set(map.nodes.map((n) => n.id));
      const addedEdges = (args.add_edges ?? []).map((e) => {
        const from = keys.get(e.from) ?? e.from;
        const to = keys.get(e.to) ?? e.to;
        if (!ids.has(from) || !ids.has(to)) throw new ToolError(`Edge ${e.from} → ${e.to}: both ends must be existing node ids or keys added in this call`);
        const edge: ArcEdge = { id: randomUUID(), from, to, type: e.type ?? 'story-arc', ...(e.label ? { label: e.label } : {}) };
        map.edges.push(edge);
        return edge.id;
      });

      await saveMetadata(ctx, args.project_id, { arc_map: JSON.stringify(map) });
      await ctx.audit('update_arc_map', 'project', args.project_id, { added: added.length, removed: removed.size });
      return compact({ nodes: map.nodes.length, edges: map.edges.length, added_nodes: added, added_edge_ids: addedEdges });
    },
  }),

  tool<{ project_id: string; script_id?: string }>({
    name: 'sync_scenes',
    title: 'Sync scenes from script',
    access: 'write',
    description:
      'Create scene breakdown rows (kind "scenes") for every scene heading in a script that does not have one yet, with INT/EXT, location and time of day parsed from the heading. Run after writing a script, before breaking down props, cast, shots or scheduling.',
    input: s.object({ project_id: s.id('Project id'), script_id: s.id('Script id (default: the project\'s first script)') }, ['project_id']),
    async run(args, ctx) {
      await ctx.requireProject(args.project_id, 'write');
      let scriptId = args.script_id;
      if (scriptId) {
        const { script } = await ctx.requireScript(scriptId, 'write');
        if (script.project_id !== args.project_id) throw new ToolError('That script belongs to a different project');
      } else {
        const first = must(await ctx.db.from('scripts').select('id').eq('project_id', args.project_id).order('created_at').limit(1).maybeSingle(), 'Loading script') as { id: string } | null;
        if (!first) throw new ToolError('This project has no scripts');
        scriptId = first.id;
      }

      const headings = (await loadElements(ctx, scriptId)).filter((e) => e.element_type === 'scene_heading' && !e.is_omitted);
      const existing = must(await ctx.db.from('scenes').select('script_element_id').eq('project_id', args.project_id), 'Loading scenes') as { script_element_id: string | null }[];
      const linked = new Set(existing.map((r) => r.script_element_id).filter(Boolean));
      const fresh = headings.filter((h) => !linked.has(h.id));
      if (fresh.length === 0) return { created: 0, total_scenes: existing.length, message: 'Every scene heading already has a breakdown row.' };

      const rows = fresh.map((el, i) => {
        const parsed = parseSceneHeading(el.content);
        return {
          project_id: args.project_id,
          script_id: scriptId,
          script_element_id: el.id,
          scene_number: el.scene_number || String(existing.length + i + 1),
          scene_heading: el.content,
          location_type: parsed.locationType,
          location_name: parsed.locationName,
          time_of_day: parsed.timeOfDay,
          sort_order: existing.length + i,
          created_by: ctx.user.id,
        };
      });
      const created = must(await ctx.db.from('scenes').insert(rows).select('id, scene_number, scene_heading'), 'Creating scenes') as Record<string, unknown>[];
      await ctx.audit('sync_scenes', 'project', args.project_id, { script_id: scriptId, created: created.length });
      return { created: created.length, total_scenes: existing.length + created.length, scenes: created };
    },
  }),

  tool<{ project_id: string; query: string; kinds?: string[] }>({
    name: 'search_project',
    title: 'Search project',
    access: 'read',
    description: 'Find text anywhere in a project: script lines, characters, locations, scenes, ideas, documents, notes, budget, and more. Returns ids you can open with get_record or read_script.',
    input: s.object({
      project_id: s.id('Project id'),
      query: s.string('Text to look for', { minLength: 2 }),
      kinds: s.array(s.string(), 'Limit to these kinds (use "script" for script text)'),
    }, ['project_id', 'query']),
    async run(args, ctx) {
      await ctx.requireProject(args.project_id, 'read');
      const term = args.query.replace(/[,()*%\\]/g, ' ').trim();
      if (term.length < 2) throw new ToolError('query is too short');
      const wanted = (name: string) => !args.kinds?.length || args.kinds.includes(name);
      const results: Record<string, unknown[]> = {};

      const searches: Promise<void>[] = [];
      if (wanted('script')) {
        searches.push((async () => {
          const scripts = must(await ctx.db.from('scripts').select('id, title').eq('project_id', args.project_id), 'Loading scripts') as { id: string; title: string }[];
          if (!scripts.length) return;
          const titles = new Map(scripts.map((sc) => [sc.id, sc.title]));
          const hits = must(
            await ctx.db.from('script_elements').select('id, script_id, element_type, content, scene_number').in('script_id', scripts.map((sc) => sc.id)).ilike('content', `%${term}%`).order('sort_order').limit(25),
            'Searching script',
          ) as Record<string, unknown>[];
          if (hits.length) results.script = hits.map((h) => compact({ ...h, script: titles.get(h.script_id as string) }));
        })());
      }

      for (const [name, kind] of Object.entries(KINDS)) {
        if (kind.scope !== 'project' || !kind.search?.length || !wanted(name)) continue;
        searches.push((async () => {
          const { data } = await ctx.db.from(kind.table)
            .select(['id', ...Array.from(new Set([kind.title, ...kind.search!]))].join(', '))
            .eq('project_id', args.project_id)
            .or(kind.search!.map((col) => `${col}.ilike.%${term}%`).join(','))
            .limit(10);
          if (data?.length) results[name] = (data as unknown as Record<string, unknown>[]).map((r) => compact(r));
        })());
      }

      await Promise.all(searches);
      return { query: args.query, matches: Object.values(results).reduce((n, r) => n + r.length, 0), results };
    },
  }),
];
