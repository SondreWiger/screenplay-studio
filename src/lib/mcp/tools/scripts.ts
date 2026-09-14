import { generateFDX } from '@/lib/scripts/fdx';
import { generateFountain, parseFountain } from '@/lib/scripts/fountain';
import type { ScriptElement, ScriptElementType, TitlePageData } from '@/lib/types';
import { ToolError, type McpContext, type ScriptRow } from '../context';
import { s } from '../schema';
import {
  findReplace, neighbours, ordersBetween, outline, renumberScenes, scriptStats,
  type Anchor, type ElementLite,
} from '../script-ops';
import { compact, must, text, tool } from '../tool';

export const ELEMENT_TYPES: ScriptElementType[] = [
  'scene_heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot', 'note', 'page_break', 'title_page',
  'centered', 'lyrics', 'synopsis', 'section', 'act', 'sequence', 'sequence_end',
  'hook', 'talking_point', 'broll_note', 'cta', 'sponsor_read', 'chapter_marker',
  'sfx_cue', 'music_cue', 'ambience_cue', 'act_break', 'announcer', 'sound_cue',
  'song_title', 'lyric', 'dance_direction', 'musical_cue', 'lighting_cue', 'set_direction',
  'comic_page', 'comic_panel', 'comic_panel_description', 'comic_dialogue', 'comic_sfx', 'comic_caption',
];

const ELEMENT_COLUMNS = 'id, element_type, content, sort_order, scene_number, is_omitted, scene_status, metadata';
const PAGE = 1000;
const INSERT_CHUNK = 500;

// ── Shared helpers (also used by create_project) ───────────────────────────

export async function loadElements(ctx: McpContext, scriptId: string): Promise<ElementLite[]> {
  const rows: ElementLite[] = [];
  for (let from = 0; ; from += PAGE) {
    const batch = must(
      await ctx.db.from('script_elements').select(ELEMENT_COLUMNS).eq('script_id', scriptId).order('sort_order').order('created_at').range(from, from + PAGE - 1),
      'Loading script',
    ) as ElementLite[];
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
}

function assertUnlocked(script: ScriptRow) {
  if (script.locked) {
    throw new ToolError(`"${script.title}" is locked. Unlock it first with update_script { locked: false } if the user wants changes.`);
  }
}

interface NewElement {
  element_type: ScriptElementType;
  content: string;
  scene_number?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Inserts elements at an anchor, keeping everyone else's order intact.
 * Mutates `sorted` so a sequence of edits sees its own earlier changes.
 */
async function insertAt(ctx: McpContext, scriptId: string, sorted: ElementLite[], anchor: Anchor, items: NewElement[]): Promise<ElementLite[]> {
  if (items.length === 0) return [];
  let { prev, next } = neighbours(sorted, anchor);
  let orders = ordersBetween(prev, next, items.length);
  if (!orders) {
    await spreadOrders(ctx, sorted);
    ({ prev, next } = neighbours(sorted, anchor));
    orders = ordersBetween(prev, next, items.length)!;
  }

  const rows = items.map((item, i) => ({
    script_id: scriptId,
    element_type: item.element_type,
    content: item.content,
    sort_order: orders![i],
    scene_number: item.scene_number ?? null,
    metadata: item.metadata ?? {},
    created_by: ctx.user.id,
    last_edited_by: ctx.user.id,
  }));

  const inserted: ElementLite[] = [];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    inserted.push(...(must(
      await ctx.db.from('script_elements').insert(rows.slice(i, i + INSERT_CHUNK)).select(ELEMENT_COLUMNS),
      'Inserting script elements',
    ) as ElementLite[]));
  }

  sorted.push(...inserted);
  sorted.sort((a, b) => a.sort_order - b.sort_order);
  return inserted;
}

/** Re-spaces every element to whole-number orders when the gaps run out. */
async function spreadOrders(ctx: McpContext, sorted: ElementLite[]) {
  const changed = sorted.map((el, i) => ({ el, order: i * 10 })).filter(({ el, order }) => el.sort_order !== order);
  await Promise.all(changed.map(({ el, order }) => ctx.db.from('script_elements').update({ sort_order: order }).eq('id', el.id)));
  sorted.forEach((el, i) => { el.sort_order = i * 10; });
}

async function applySceneNumbers(ctx: McpContext, sorted: ElementLite[]): Promise<number> {
  const updates = renumberScenes(sorted);
  await Promise.all(updates.map((u) => ctx.db.from('script_elements').update({ scene_number: u.scene_number }).eq('id', u.id)));
  for (const u of updates) {
    const el = sorted.find((e) => e.id === u.id);
    if (el) el.scene_number = u.scene_number;
  }
  return updates.length;
}

async function touchScript(ctx: McpContext, scriptId: string) {
  await ctx.db.from('scripts').update({ updated_at: new Date().toISOString() }).eq('id', scriptId);
}

/** Same snapshot the "Save draft" button takes (see save_script_draft in migration_v2.sql). */
export async function saveDraft(ctx: McpContext, scriptId: string, name: string | null, notes: string | null) {
  const elements = (await loadElements(ctx, scriptId)).filter((e) => !e.is_omitted);
  const words = elements.reduce((n, e) => n + (e.content.trim() ? e.content.trim().split(/\s+/).length : 0), 0);
  const { data: last } = await ctx.db.from('script_drafts').select('draft_number').eq('script_id', scriptId).order('draft_number', { ascending: false }).limit(1).maybeSingle();
  const draftNumber = (last?.draft_number ?? 0) + 1;

  await ctx.db.from('script_drafts').update({ is_current: false }).eq('script_id', scriptId);
  return must(
    await ctx.db.from('script_drafts').insert({
      script_id: scriptId,
      draft_number: draftNumber,
      draft_name: name || `Draft ${draftNumber}`,
      notes,
      snapshot: elements.map((e) => ({ element_type: e.element_type, content: e.content, sort_order: e.sort_order, scene_number: e.scene_number, is_omitted: e.is_omitted })),
      element_count: elements.length,
      word_count: words,
      page_count: Math.max(1, Math.ceil(words / 250)),
      is_current: true,
      created_by: ctx.user.id,
    }).select('id, draft_number, draft_name').single(),
    'Saving draft',
  ) as { id: string; draft_number: number; draft_name: string };
}

function fountainToElements(fountain: string): { titlePage: TitlePageData; items: NewElement[] } {
  const { titlePage, elements } = parseFountain(fountain);
  const items = elements.map((el) => {
    // The parser numbers every heading 1, 2, 3 ... Only keep a number the writer typed as #12A#.
    const explicit = el.element_type === 'scene_heading' && el.scene_number && fountain.includes(`#${el.scene_number}#`);
    return { element_type: el.element_type!, content: el.content ?? '', scene_number: explicit ? el.scene_number : null };
  });
  return { titlePage, items };
}

export async function writeFountain(
  ctx: McpContext,
  scriptId: string,
  fountain: string,
  anchor: Anchor,
  opts: { titlePage?: boolean; sorted?: ElementLite[] } = {},
) {
  const { titlePage, items } = fountainToElements(fountain);
  if (items.length === 0 && Object.keys(titlePage).length === 0) throw new ToolError('The Fountain text contained no script elements.');

  const sorted = opts.sorted ?? (await loadElements(ctx, scriptId));
  const inserted = await insertAt(ctx, scriptId, sorted, anchor, items);
  const renumbered = await applySceneNumbers(ctx, sorted);

  if (opts.titlePage && Object.keys(titlePage).length) {
    const { data: script } = await ctx.db.from('scripts').select('title_page_data').eq('id', scriptId).single();
    await ctx.db.from('scripts').update({ title_page_data: { ...(script?.title_page_data ?? {}), ...titlePage } }).eq('id', scriptId);
  }
  await touchScript(ctx, scriptId);

  return compact({
    inserted: inserted.length,
    scenes_added: inserted.filter((e) => e.element_type === 'scene_heading').length,
    first_element_id: inserted[0]?.id,
    last_element_id: inserted[inserted.length - 1]?.id,
    scenes_renumbered: renumbered || undefined,
    title_page_updated: opts.titlePage && Object.keys(titlePage).length ? true : undefined,
  });
}

function anchorFrom(args: { after?: string; before?: string; at?: 'start' | 'end' }): Anchor {
  if (args.after) return { position: 'after', id: args.after };
  if (args.before) return { position: 'before', id: args.before };
  return { position: args.at === 'start' ? 'start' : 'end' };
}

function asElements(els: ElementLite[]) {
  return els.map((e) => compact({ id: e.id, type: e.element_type, content: e.content, scene: e.scene_number, omitted: e.is_omitted || undefined, status: e.scene_status }));
}

/** Elements from the n-th to the m-th scene (1-based, inclusive). Anything before the first heading counts as scene 0. */
function sliceScenes(sorted: ElementLite[], from?: number, to?: number): ElementLite[] {
  if (from === undefined && to === undefined) return sorted;
  let scene = 0;
  return sorted.filter((el) => {
    if (el.element_type === 'scene_heading' && !el.is_omitted) scene++;
    return scene >= (from ?? 0) && scene <= (to ?? Infinity);
  });
}

// ── Tools ──────────────────────────────────────────────────────────────────

const anchorProps = {
  after: s.id('Insert after this element'),
  before: s.id('Insert before this element'),
  at: s.enum(['start', 'end'], 'Insert at the start or end (default end) when no after/before is given'),
};

export const scriptTools = [
  tool<{ project_id: string }>({
    name: 'list_scripts',
    title: 'List scripts',
    access: 'read',
    description: 'Scripts in a project. For episodic projects each script is an episode (metadata.episode_season, metadata.sort_order).',
    input: s.object({ project_id: s.id('Project id') }, ['project_id']),
    async run(args, ctx) {
      await ctx.requireProject(args.project_id, 'read');
      const scripts = must(
        await ctx.db.from('scripts').select('id, title, version, revision_color, locked, is_active, title_page_data, metadata, created_at, updated_at').eq('project_id', args.project_id).order('created_at'),
        'Loading scripts',
      ) as Record<string, unknown>[];
      const counts = await Promise.all(scripts.map((sc) => ctx.db.from('script_elements').select('id', { count: 'exact', head: true }).eq('script_id', sc.id as string).eq('element_type', 'scene_heading')));
      return scripts.map((sc, i) => compact({ ...sc, scenes: counts[i].count ?? 0 }));
    },
  }),

  tool<{ project_id: string; title: string; fountain?: string; season?: number; episode_order?: number; color?: string }>({
    name: 'create_script',
    title: 'Create script',
    access: 'write',
    description: 'Add a script (or an episode, for episodic projects) to a project, optionally with Fountain content.',
    input: s.object({
      project_id: s.id('Project id'),
      title: s.string('Script or episode title', { minLength: 1 }),
      fountain: s.string('Optional content in Fountain format'),
      season: s.integer('Episodic only: season number'),
      episode_order: s.integer('Episodic only: position in the episode list'),
      color: s.string('Episodic only: accent colour, e.g. #7c3aed'),
    }, ['project_id', 'title']),
    async run(args, ctx) {
      await ctx.requireProject(args.project_id, 'write');
      const metadata = compact({ episode_season: args.season, sort_order: args.episode_order, episode_color: args.color });
      const script = must(
        await ctx.db.from('scripts').insert({ project_id: args.project_id, title: args.title, metadata, created_by: ctx.user.id }).select('id, title').single(),
        'Creating script',
      ) as { id: string; title: string };
      const written = args.fountain?.trim() ? await writeFountain(ctx, script.id, args.fountain, { position: 'end' }, { titlePage: true }) : undefined;
      await ctx.audit('create_script', 'script', script.id, { project_id: args.project_id });
      return compact({ script_id: script.id, title: script.title, url: `${ctx.siteUrl}/projects/${args.project_id}/script`, content: written });
    },
  }),

  tool<{ script_id: string; title?: string; title_page?: Record<string, string>; revision_color?: string; locked?: boolean; season?: number; episode_order?: number; color?: string }>({
    name: 'update_script',
    title: 'Update script',
    access: 'write',
    description: 'Rename a script, edit its title page, set the revision colour, lock/unlock it, or change episode season/order.',
    input: s.object({
      script_id: s.id('Script id'),
      title: s.string(),
      title_page: s.object({
        title: s.string(), credit: s.string(), author: s.string(), source: s.string(), draft_date: s.string(), contact: s.string(),
        copyright: s.string(), notes: s.string(), company_name: s.string(),
      }, [], 'Merged into the existing title page; pass "" to clear a field'),
      revision_color: s.enum(['white', 'blue', 'pink', 'yellow', 'green', 'goldenrod', 'buff', 'salmon', 'cherry', 'tan']),
      locked: s.boolean('Locked scripts cannot be edited'),
      season: s.integer(),
      episode_order: s.integer(),
      color: s.string(),
    }, ['script_id']),
    async run(args, ctx) {
      const { script } = await ctx.requireScript(args.script_id, 'write');
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (args.title !== undefined) update.title = args.title;
      if (args.revision_color !== undefined) update.revision_color = args.revision_color;
      if (args.locked !== undefined) {
        update.locked = args.locked;
        update.locked_by = args.locked ? ctx.user.id : null;
        update.locked_at = args.locked ? new Date().toISOString() : null;
      }
      if (args.title_page) {
        const merged: Record<string, unknown> = { ...(script.title_page_data ?? {}) };
        for (const [k, v] of Object.entries(args.title_page)) {
          if (v === '') delete merged[k];
          else merged[k] = v;
        }
        update.title_page_data = merged;
      }
      if (args.season !== undefined || args.episode_order !== undefined || args.color !== undefined) {
        update.metadata = { ...(script.metadata ?? {}), ...compact({ episode_season: args.season, sort_order: args.episode_order, episode_color: args.color }) };
      }
      const row = must(await ctx.db.from('scripts').update(update).eq('id', args.script_id).select('id, title, locked, revision_color, title_page_data, metadata').single(), 'Updating script');
      await ctx.audit('update_script', 'script', args.script_id, { fields: Object.keys(update) });
      return compact(row as Record<string, unknown>);
    },
  }),

  tool<{ script_id: string; confirm_title: string }>({
    name: 'delete_script',
    title: 'Delete script',
    access: 'write',
    destructive: true,
    description: 'Permanently delete a script and all its content. Only when the user explicitly asks; pass the exact script title as confirm_title.',
    input: s.object({ script_id: s.id('Script id'), confirm_title: s.string('The exact script title') }, ['script_id', 'confirm_title']),
    async run(args, ctx) {
      const { script } = await ctx.requireScript(args.script_id, 'manage');
      if (args.confirm_title !== script.title) throw new ToolError(`confirm_title does not match. The script is titled "${script.title}".`);
      must(await ctx.db.from('scripts').delete().eq('id', args.script_id), 'Deleting script');
      await ctx.audit('delete_script', 'script', args.script_id, { title: script.title, project_id: script.project_id });
      return { deleted: true, script_id: args.script_id };
    },
  }),

  tool<{ script_id: string; format?: 'fountain' | 'elements' | 'outline'; from_scene?: number; to_scene?: number; include_omitted?: boolean }>({
    name: 'read_script',
    title: 'Read script',
    access: 'read',
    description:
      'Read a script. format "fountain" (default) is best for reading and reviewing; "elements" returns each element with its id, which you need for edit_script; "outline" lists scenes with page, characters and a one-line summary. Use from_scene/to_scene (1-based scene positions) to read part of a long script.',
    input: s.object({
      script_id: s.id('Script id'),
      format: s.enum(['fountain', 'elements', 'outline']),
      from_scene: s.integer('First scene to include (1 = first scene)', { minimum: 0 }),
      to_scene: s.integer('Last scene to include', { minimum: 0 }),
      include_omitted: s.boolean('Include omitted elements (default false)'),
    }, ['script_id']),
    async run(args, ctx) {
      const { script } = await ctx.requireScript(args.script_id, 'read');
      const all = await loadElements(ctx, args.script_id);
      const visible = args.include_omitted ? all : all.filter((e) => !e.is_omitted);
      const part = sliceScenes(visible, args.from_scene, args.to_scene);
      const meta = compact({ script_id: script.id, title: script.title, locked: script.locked || undefined, elements: part.length, total_elements: all.length });

      switch (args.format ?? 'fountain') {
        case 'outline':
          return { ...meta, scenes: outline(all).slice((args.from_scene ?? 1) - 1, args.to_scene ?? undefined) };
        case 'elements':
          return { ...meta, elements: asElements(part) };
        default: {
          const whole = args.from_scene === undefined && args.to_scene === undefined;
          const body = generateFountain({ titlePage: whole ? (script.title_page_data as TitlePageData) ?? undefined : undefined, elements: part as ScriptElement[] });
          return text(body.trim() ? body : '(empty script)', meta);
        }
      }
    },
  }),

  tool<{ script_id: string; fountain: string; mode?: 'append' | 'replace' | 'insert'; after?: string; before?: string; at?: 'start' | 'end' }>({
    name: 'write_script',
    title: 'Write Fountain into a script',
    access: 'write',
    description:
      'Write screenplay text in Fountain format. mode "append" (default) adds to the end; "insert" places it after/before an element id (or at start/end); "replace" swaps the whole script for this text, saving a restorable draft of the old version first. Scene headings are renumbered automatically unless the script uses locked numbering like 12A.',
    input: s.object({
      script_id: s.id('Script id'),
      fountain: s.string('Fountain text: INT. KITCHEN - NIGHT, CHARACTER cues in caps, (parentheticals), > TRANSITIONS:, # sections, = synopses', { minLength: 1 }),
      mode: s.enum(['append', 'insert', 'replace']),
      ...anchorProps,
    }, ['script_id', 'fountain']),
    async run(args, ctx) {
      const { script } = await ctx.requireScript(args.script_id, 'write');
      assertUnlocked(script);
      const mode = args.mode ?? 'append';

      if (mode === 'replace') {
        const draft = await saveDraft(ctx, args.script_id, 'Before MCP rewrite', 'Automatic snapshot taken before write_script replaced the script.');
        must(await ctx.db.from('script_elements').delete().eq('script_id', args.script_id), 'Clearing script');
        const result = await writeFountain(ctx, args.script_id, args.fountain, { position: 'end' }, { titlePage: true, sorted: [] });
        await ctx.audit('write_script', 'script', args.script_id, { mode, draft_id: draft.id });
        return { ...result, previous_version_saved_as: `${draft.draft_name} (draft_id ${draft.id})` };
      }

      const anchor = mode === 'insert' ? anchorFrom(args) : ({ position: 'end' } as Anchor);
      const result = await writeFountain(ctx, args.script_id, args.fountain, anchor, {});
      await ctx.audit('write_script', 'script', args.script_id, { mode, inserted: result.inserted });
      return result;
    },
  }),

  tool<{ script_id: string; operations: EditOp[] }>({
    name: 'edit_script',
    title: 'Edit script elements',
    access: 'write',
    description:
      'Precise edits by element id (get ids from read_script format "elements"). Operations run in order:\n' +
      '- { op: "update", id, content?, type?, scene_number?, omitted?, scene_status? }\n' +
      '- { op: "insert", after? | before? | at?, elements: [{ type, content }] } or with fountain: "..."\n' +
      '- { op: "delete", id }\n' +
      '- { op: "move", id, after? | before? | at? }\n' +
      'Use this for non-screenplay formats too (YouTube hooks, audio cues, comic panels) via element types.',
    input: s.object({
      script_id: s.id('Script id'),
      operations: s.array(s.object({
        op: s.enum(['update', 'insert', 'delete', 'move']),
        id: s.id('Element to update, delete or move'),
        content: s.string(),
        type: s.enum(ELEMENT_TYPES, 'Element type'),
        scene_number: s.string(),
        omitted: s.boolean('Mark as omitted (kept, but hidden and not counted)'),
        scene_status: s.enum(['first_draft', 'revised', 'locked', 'cut']),
        elements: s.array(s.object({ type: s.enum(ELEMENT_TYPES), content: s.string() }, ['type', 'content'])),
        fountain: s.string('Fountain text to insert instead of elements'),
        ...anchorProps,
      }, ['op']), 'Edits to apply in order', { minItems: 1, maxItems: 500 }),
    }, ['script_id', 'operations']),
    async run(args, ctx) {
      const { script } = await ctx.requireScript(args.script_id, 'write');
      assertUnlocked(script);
      const sorted = await loadElements(ctx, args.script_id);
      const byId = () => new Map(sorted.map((e) => [e.id, e]));
      const results: unknown[] = [];

      for (let i = 0; i < args.operations.length; i++) {
        const op = args.operations[i];
        const where = `operations[${i}] (${op.op})`;
        const target = op.id ? byId().get(op.id) : undefined;
        if ((op.op === 'update' || op.op === 'delete' || op.op === 'move') && !target) {
          throw new ToolError(`${where}: element ${op.id ?? '(missing id)'} is not in this script. ${i} earlier operation(s) were applied.`);
        }

        if (op.op === 'update') {
          const change = compact({ content: op.content, element_type: op.type, scene_number: op.scene_number, is_omitted: op.omitted, scene_status: op.scene_status }) as Record<string, unknown>;
          if (op.content === '') change.content = '';
          if (op.omitted === false) change.is_omitted = false;
          if (Object.keys(change).length === 0) throw new ToolError(`${where}: nothing to update`);
          must(await ctx.db.from('script_elements').update({ ...change, last_edited_by: ctx.user.id }).eq('id', target!.id), `${where}`);
          Object.assign(target!, change);
          results.push({ op: 'update', id: target!.id });
        } else if (op.op === 'delete') {
          must(await ctx.db.from('script_elements').delete().eq('id', target!.id), `${where}`);
          sorted.splice(sorted.indexOf(target!), 1);
          results.push({ op: 'delete', id: target!.id });
        } else if (op.op === 'move') {
          const rest = sorted.filter((e) => e.id !== target!.id);
          const { prev, next } = neighbours(rest, anchorFrom(op));
          const order = ordersBetween(prev, next, 1);
          if (!order) throw new ToolError(`${where}: no room to move here; try moving to a neighbouring position.`);
          must(await ctx.db.from('script_elements').update({ sort_order: order[0] }).eq('id', target!.id), `${where}`);
          target!.sort_order = order[0];
          sorted.sort((a, b) => a.sort_order - b.sort_order);
          results.push({ op: 'move', id: target!.id });
        } else if (op.op === 'insert') {
          const items: NewElement[] = op.fountain
            ? fountainToElements(op.fountain).items
            : (op.elements ?? []).map((e) => ({ element_type: e.type, content: e.content }));
          if (items.length === 0) throw new ToolError(`${where}: give elements or fountain to insert`);
          const inserted = await insertAt(ctx, args.script_id, sorted, anchorFrom(op), items);
          results.push({ op: 'insert', ids: inserted.map((e) => e.id) });
        }
      }

      const renumbered = await applySceneNumbers(ctx, sorted);
      await touchScript(ctx, args.script_id);
      await ctx.audit('edit_script', 'script', args.script_id, { operations: args.operations.length });
      return compact({ applied: results.length, results, scenes_renumbered: renumbered || undefined });
    },
  }),

  tool<{ script_id: string; find: string; replace?: string; match_case?: boolean; whole_word?: boolean; element_types?: ScriptElementType[]; preview?: boolean }>({
    name: 'find_replace',
    title: 'Find & replace in script',
    access: 'read',
    description:
      'Search a script, or replace text across it. Without `replace` it only searches (read-only). With `replace` it changes every match — set preview: true to see the changes first. A draft of the old version is saved before replacing. Great for renaming a character everywhere (use whole_word).',
    input: s.object({
      script_id: s.id('Script id'),
      find: s.string('Text to find', { minLength: 1 }),
      replace: s.string('Replacement text; omit to just search'),
      match_case: s.boolean(),
      whole_word: s.boolean(),
      element_types: s.array(s.enum(ELEMENT_TYPES), 'Limit to these element types, e.g. ["character", "dialogue"]'),
      preview: s.boolean('Show what would change without saving'),
    }, ['script_id', 'find']),
    async run(args, ctx) {
      const replacing = args.replace !== undefined && !args.preview;
      const { script } = await ctx.requireScript(args.script_id, replacing ? 'write' : 'read');
      const sorted = (await loadElements(ctx, args.script_id)).filter((e) => !e.is_omitted);
      const changes = findReplace(sorted, args.find, args.replace ?? null, { matchCase: args.match_case, wholeWord: args.whole_word, elementTypes: args.element_types });
      const total = changes.reduce((n, c) => n + c.count, 0);

      if (!replacing) {
        return {
          matches: total,
          elements: changes.length,
          results: changes.slice(0, 200).map((c) => compact({ id: c.id, type: c.element_type, text: c.before, after: args.replace !== undefined ? c.after : undefined })),
        };
      }

      assertUnlocked(script);
      if (changes.length === 0) return { replaced: 0 };
      const draft = await saveDraft(ctx, args.script_id, 'Before MCP find & replace', `Replaced "${args.find}" with "${args.replace}".`);
      for (let i = 0; i < changes.length; i += 50) {
        await Promise.all(changes.slice(i, i + 50).map((c) =>
          ctx.db.from('script_elements').update({ content: c.after, last_edited_by: ctx.user.id }).eq('id', c.id)));
      }
      await touchScript(ctx, args.script_id);
      await ctx.audit('find_replace', 'script', args.script_id, { find: args.find, replace: args.replace, replaced: total });
      return { replaced: total, elements_changed: changes.length, previous_version_saved_as: `${draft.draft_name} (draft_id ${draft.id})` };
    },
  }),

  tool<{ script_id: string }>({
    name: 'script_stats',
    title: 'Script statistics',
    access: 'read',
    description: 'Page count, word count, scenes, INT/EXT and DAY/NIGHT split, locations, and who speaks how much.',
    input: s.object({ script_id: s.id('Script id') }, ['script_id']),
    async run(args, ctx) {
      const { script } = await ctx.requireScript(args.script_id, 'read');
      return { title: script.title, ...scriptStats(await loadElements(ctx, args.script_id)) };
    },
  }),

  tool<{ script_id: string; format?: 'fountain' | 'fdx' | 'plain' }>({
    name: 'export_script',
    title: 'Export script',
    access: 'read',
    description: 'Export a script as Fountain, Final Draft (FDX) XML, or plain text.',
    input: s.object({ script_id: s.id('Script id'), format: s.enum(['fountain', 'fdx', 'plain']) }, ['script_id']),
    async run(args, ctx) {
      const { script } = await ctx.requireScript(args.script_id, 'read');
      const elements = (await loadElements(ctx, args.script_id)).filter((e) => !e.is_omitted) as ScriptElement[];
      const titlePage = (script.title_page_data ?? {}) as TitlePageData;
      const format = args.format ?? 'fountain';
      if (format === 'fdx') return text(generateFDX({ titlePage, elements, scriptTitle: script.title }), { format, filename: `${script.title}.fdx` });
      if (format === 'plain') {
        const body = elements.map((e) => (['scene_heading', 'character', 'transition'].includes(e.element_type) ? e.content.toUpperCase() : e.content)).join('\n\n');
        return text(body, { format, filename: `${script.title}.txt` });
      }
      return text(generateFountain({ titlePage, elements }), { format, filename: `${script.title}.fountain` });
    },
  }),

  tool<{ script_id: string; name?: string; notes?: string }>({
    name: 'save_draft',
    title: 'Save draft',
    access: 'write',
    description: 'Snapshot the script as a named draft that can be restored later (shows under Revisions in the app).',
    input: s.object({ script_id: s.id('Script id'), name: s.string('e.g. "Producer pass"'), notes: s.string() }, ['script_id']),
    async run(args, ctx) {
      await ctx.requireScript(args.script_id, 'write');
      const draft = await saveDraft(ctx, args.script_id, args.name ?? null, args.notes ?? null);
      await ctx.audit('save_draft', 'script', args.script_id, { draft_id: draft.id });
      return draft;
    },
  }),

  tool<{ script_id: string }>({
    name: 'list_drafts',
    title: 'List drafts',
    access: 'read',
    description: 'Saved drafts of a script, newest first.',
    input: s.object({ script_id: s.id('Script id') }, ['script_id']),
    async run(args, ctx) {
      await ctx.requireScript(args.script_id, 'read');
      return must(
        await ctx.db.from('script_drafts').select('id, draft_number, draft_name, notes, element_count, page_count, word_count, is_current, created_at').eq('script_id', args.script_id).order('draft_number', { ascending: false }),
        'Loading drafts',
      );
    },
  }),

  tool<{ draft_id: string }>({
    name: 'restore_draft',
    title: 'Restore draft',
    access: 'write',
    destructive: true,
    description: 'Replace the script content with a saved draft. The current version is saved as a draft first, so this can be undone.',
    input: s.object({ draft_id: s.id('Draft id from list_drafts') }, ['draft_id']),
    async run(args, ctx) {
      const draft = must(await ctx.db.from('script_drafts').select('id, script_id, draft_name, snapshot').eq('id', args.draft_id).maybeSingle(), 'Loading draft') as
        { id: string; script_id: string; draft_name: string; snapshot: NewElement[] | null } | null;
      if (!draft) throw new ToolError(`Draft ${args.draft_id} not found`);
      const { script } = await ctx.requireScript(draft.script_id, 'write');
      assertUnlocked(script);

      const backup = await saveDraft(ctx, draft.script_id, 'Auto-save before restore', `Automatic snapshot before restoring ${draft.draft_name}`);
      must(await ctx.db.from('script_elements').delete().eq('script_id', draft.script_id), 'Clearing script');
      const items = (draft.snapshot ?? []).map((e) => ({ element_type: e.element_type, content: e.content ?? '', scene_number: e.scene_number ?? null }));
      await insertAt(ctx, draft.script_id, [], { position: 'end' }, items);
      await ctx.db.from('script_drafts').update({ is_current: false }).eq('script_id', draft.script_id);
      await ctx.db.from('script_drafts').update({ is_current: true }).eq('id', draft.id);
      await touchScript(ctx, draft.script_id);
      await ctx.audit('restore_draft', 'script', draft.script_id, { draft_id: draft.id, backup_draft_id: backup.id });
      return { restored: draft.draft_name, elements: items.length, previous_version_saved_as: `${backup.draft_name} (draft_id ${backup.id})` };
    },
  }),
];

interface EditOp {
  op: 'update' | 'insert' | 'delete' | 'move';
  id?: string;
  content?: string;
  type?: ScriptElementType;
  scene_number?: string;
  omitted?: boolean;
  scene_status?: string;
  elements?: { type: ScriptElementType; content: string }[];
  fountain?: string;
  after?: string;
  before?: string;
  at?: 'start' | 'end';
}
