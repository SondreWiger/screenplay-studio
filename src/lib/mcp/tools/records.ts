import { PRO_TOOLS } from '@/lib/pro-tools';
import { ToolError, type McpContext } from '../context';
import { KINDS, cleanRecord, describeFields, isUuid, parseFilter, type RecordKind } from '../kinds';
import { s } from '../schema';
import { compact, must, tool } from '../tool';

/**
 * Generic list / get / create / update / delete over every kind in
 * `kinds.ts`. Access is decided per kind scope:
 *
 *   project   project membership (write kinds need an editing role;
 *             `manage` kinds need owner/admin)
 *   user      the row's owner column, or the owner of its parent row
 *   platform  platform admins with an admin token
 */

const MAX_LIST = 200;
const MAX_BATCH = 200;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any;

export function kindsFor(ctx: Pick<McpContext, 'isPlatformAdmin' | 'scope'>): string[] {
  return Object.entries(KINDS)
    .filter(([, k]) => k.scope !== 'platform' || (ctx.isPlatformAdmin && ctx.scope === 'admin'))
    .map(([name]) => name);
}

function getKind(name: string, ctx: McpContext): RecordKind {
  const kind = KINDS[name];
  if (!kind) throw new ToolError(`Unknown kind "${name}". Call describe_kinds to see them all.`);
  if (kind.scope === 'platform') ctx.requirePlatformAdmin();
  return kind;
}

function pk(kind: RecordKind) {
  return kind.primaryKey ?? 'id';
}

function applyFilters(query: Query, kind: RecordKind, filter: Record<string, unknown> | undefined): Query {
  if (!filter) return query;
  const { filters, errors } = parseFilter(kind, filter);
  if (errors.length) throw new ToolError(errors.join('; '));
  for (const f of filters) {
    switch (f.op) {
      case 'in': query = query.in(f.column, Array.isArray(f.value) ? f.value : [f.value]); break;
      case 'contains': query = query.contains(f.column, Array.isArray(f.value) ? f.value : [f.value]); break;
      case 'is': query = query.is(f.column, f.value); break;
      default: query = query[f.op](f.column, f.value);
    }
  }
  return query;
}

function applyOrder(query: Query, order: string | undefined): Query {
  if (!order) return query.order('created_at', { ascending: false });
  const desc = order.startsWith('-');
  return query.order(desc ? order.slice(1) : order, { ascending: !desc, nullsFirst: false });
}

/** Parent rows the user owns, for kinds like idea_nodes that belong to an idea board. */
async function ownedParentIds(ctx: McpContext, kind: RecordKind, ids: string[]): Promise<Set<string>> {
  const parent = KINDS[kind.parent!.kind];
  const rows = must(await ctx.db.from(parent.table).select('id').in('id', ids).eq(parent.owner!, ctx.user.id), 'Checking ownership') as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

/** Loads rows by key and checks the caller may act on every one of them. */
async function loadForWrite(ctx: McpContext, kind: RecordKind, ids: string[]): Promise<Record<string, unknown>[]> {
  const key = pk(kind);
  const rows = must(await ctx.db.from(kind.table).select('*').in(key, ids), `Loading ${kind.table}`) as Record<string, unknown>[];
  const found = new Set(rows.map((r) => String(r[key])));
  const missing = ids.filter((id) => !found.has(id));

  if (kind.scope === 'project') {
    const projectIds = Array.from(new Set(rows.map((r) => r.project_id as string)));
    for (const projectId of projectIds) await ctx.requireProject(projectId, kind.manage ? 'manage' : 'write');
  } else if (kind.scope === 'user') {
    ctx.requireScope('write');
    if (kind.owner) {
      if (rows.some((r) => r[kind.owner!] !== ctx.user.id)) missing.push(...rows.filter((r) => r[kind.owner!] !== ctx.user.id).map((r) => String(r[key])));
    } else if (kind.parent) {
      const owned = await ownedParentIds(ctx, kind, Array.from(new Set(rows.map((r) => r[kind.parent!.column] as string))));
      missing.push(...rows.filter((r) => !owned.has(r[kind.parent!.column] as string)).map((r) => String(r[key])));
    }
  }

  if (missing.length) throw new ToolError(`Not found in ${kind.table}: ${missing.join(', ')}`);
  return rows;
}

function kindSummary(name: string, kind: RecordKind) {
  return compact({ kind: name, group: kind.group, scope: kind.scope, about: kind.about, read_only: kind.readOnly || undefined });
}

export const recordTools = [
  tool<{ kind?: string }>({
    name: 'describe_kinds',
    title: 'Describe record kinds',
    access: 'read',
    description:
      'The catalogue of everything you can read and write with list_records / create_records / update_records / delete_records: characters, locations, scenes, shots, schedule, budget, ideas, mind map, mood board, documents, notes, cast, gear, and many more. Pass a kind to see its fields, types and allowed values.',
    input: s.object({ kind: s.string('A kind name for its full field list') }),
    async run(args, ctx) {
      const available = kindsFor(ctx);
      if (!args.kind) {
        return { kinds: available.map((name) => kindSummary(name, KINDS[name])) };
      }
      if (!available.includes(args.kind)) throw new ToolError(`Unknown kind "${args.kind}". Available: ${available.join(', ')}`);
      const kind = KINDS[args.kind];
      const detail: Record<string, unknown> = {
        ...kindSummary(args.kind, kind),
        needs: kind.scope === 'project' ? 'project_id' : kind.parent ? `filter.${kind.parent.column} when listing` : undefined,
        fields: describeFields(kind),
        default_order: kind.order,
        searchable: kind.search,
        writes_need: kind.manage ? 'project owner or admin' : undefined,
      };
      if (args.kind === 'pro_tool_records') {
        detail.tools = PRO_TOOLS.map((t) => ({
          tool: t.slug,
          label: t.label,
          statuses: t.statuses.map((st) => st.value),
          data_fields: Object.fromEntries(t.fields.map((f) => [f.key, f.options ? `${f.type}: ${f.options.join(' | ')}` : f.type])),
        }));
      }
      return compact(detail);
    },
  }),

  tool<{ kind: string; project_id?: string; filter?: Record<string, unknown>; query?: string; order?: string; limit?: number; offset?: number; fields?: string[] }>({
    name: 'list_records',
    title: 'List records',
    access: 'read',
    description:
      'List records of a kind. Project kinds need project_id. `filter` matches fields exactly ({ "status": "open" }), by list ({ "category": ["props", "vfx"] }) or with operators ({ "estimated_amount": { "gte": 1000 } }; ops: eq neq gt gte lt lte like ilike in contains is). `query` does a case-insensitive text search.',
    input: s.object({
      kind: s.string('Kind name, e.g. characters, scenes, budget (see describe_kinds)'),
      project_id: s.id('Project id (required for project kinds)'),
      filter: s.record('Field conditions'),
      query: s.string('Text search across the kind\'s main text fields'),
      order: s.string('Field to sort by; prefix with - for descending'),
      limit: s.integer(`Max rows (default 50, max ${MAX_LIST})`, { minimum: 1, maximum: MAX_LIST }),
      offset: s.integer('Skip this many rows', { minimum: 0 }),
      fields: s.array(s.string(), 'Only return these columns'),
    }, ['kind']),
    async run(args, ctx) {
      const kind = getKind(args.kind, ctx);
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;
      const columns = args.fields?.length ? Array.from(new Set([pk(kind), ...args.fields])).join(',') : '*';
      if (args.fields?.some((f) => !/^[a-z_][a-z0-9_]*$/.test(f))) throw new ToolError('fields must be plain column names');

      let query: Query = ctx.db.from(kind.table).select(columns, { count: 'exact' });

      if (kind.scope === 'project') {
        if (!args.project_id) throw new ToolError(`${args.kind} belongs to a project: pass project_id.`);
        await ctx.requireProject(args.project_id, 'read');
        query = query.eq('project_id', args.project_id);
      } else if (kind.scope === 'user') {
        if (kind.owner) query = query.eq(kind.owner, ctx.user.id);
        else if (kind.parent) {
          const parentId = args.filter?.[kind.parent.column];
          if (!isUuid(parentId)) throw new ToolError(`Pass filter.${kind.parent.column} to list ${args.kind}.`);
          if (!(await ownedParentIds(ctx, kind, [parentId])).size) throw new ToolError(`${kind.parent.kind} ${parentId} not found`);
        }
      }

      query = applyFilters(query, kind, args.filter);
      if (args.query && kind.search?.length) {
        const term = args.query.replace(/[,()*%\\]/g, ' ').trim();
        if (term) query = query.or(kind.search.map((col) => `${col}.ilike.%${term}%`).join(','));
      }
      query = applyOrder(query, args.order ?? kind.order).range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw new ToolError(`Listing ${args.kind} failed: ${error.message}`);
      const rows = (data as Record<string, unknown>[]).map((r) => compact(r));
      return compact({ kind: args.kind, total: count ?? rows.length, offset, returned: rows.length, next_offset: count && offset + rows.length < count ? offset + rows.length : undefined, records: rows });
    },
  }),

  tool<{ kind: string; id: string }>({
    name: 'get_record',
    title: 'Get record',
    access: 'read',
    description: 'Fetch one record of any kind by id.',
    input: s.object({ kind: s.string('Kind name'), id: s.string('Record id (or key, for site_settings)') }, ['kind', 'id']),
    async run(args, ctx) {
      const kind = getKind(args.kind, ctx);
      const row = must(await ctx.db.from(kind.table).select('*').eq(pk(kind), args.id).maybeSingle(), `Loading ${args.kind}`) as Record<string, unknown> | null;
      const notFound = new ToolError(`${args.kind} ${args.id} not found`);
      if (!row) throw notFound;
      if (kind.scope === 'project') await ctx.requireProject(row.project_id as string, 'read');
      if (kind.scope === 'user') {
        if (kind.owner && row[kind.owner] !== ctx.user.id) throw notFound;
        if (kind.parent && !(await ownedParentIds(ctx, kind, [row[kind.parent.column] as string])).size) throw notFound;
      }
      return compact(row);
    },
  }),

  tool<{ kind: string; project_id?: string; records: Record<string, unknown>[] }>({
    name: 'create_records',
    title: 'Create records',
    access: 'write',
    description:
      `Create one or many records of a kind in a single call (up to ${MAX_BATCH}). Project kinds need project_id. Call describe_kinds { kind } first if you are unsure of the fields. Returns the created rows with their ids, so you can link them (e.g. shots → scene_id).`,
    input: s.object({
      kind: s.string('Kind name'),
      project_id: s.id('Project id (required for project kinds)'),
      records: s.array(s.record('Field values'), 'Records to create', { minItems: 1, maxItems: MAX_BATCH }),
    }, ['kind', 'records']),
    async run(args, ctx) {
      const kind = getKind(args.kind, ctx);
      if (kind.readOnly) throw new ToolError(`${args.kind} is read-only here.`);
      ctx.requireScope('write');

      const base: Record<string, unknown> = {};
      if (kind.scope === 'project') {
        if (!args.project_id) throw new ToolError(`${args.kind} belongs to a project: pass project_id.`);
        await ctx.requireProject(args.project_id, kind.manage ? 'manage' : 'write');
        base.project_id = args.project_id;
      }
      if (kind.scope === 'user' && kind.owner) base[kind.owner] = ctx.user.id;
      if (kind.stamp) base[kind.stamp] = ctx.user.id;

      const problems: string[] = [];
      const rows = args.records.map((record, i) => {
        const { values, errors } = cleanRecord(kind, record, 'create');
        problems.push(...errors.map((e) => `records[${i}]: ${e}`));
        return { ...kind.defaults?.(), ...values, ...base };
      });
      if (problems.length) throw new ToolError(problems.slice(0, 20).join('; '));

      if (kind.parent) {
        const parentIds = Array.from(new Set(rows.map((r) => r[kind.parent!.column] as string)));
        const owned = await ownedParentIds(ctx, kind, parentIds);
        const foreign = parentIds.filter((id) => !owned.has(id));
        if (foreign.length) throw new ToolError(`${kind.parent.kind} not found: ${foreign.join(', ')}`);
      }

      const created = must(await ctx.db.from(kind.table).insert(rows).select('*'), `Creating ${args.kind}`) as Record<string, unknown>[];
      await ctx.audit('create_records', kind.table, created.length === 1 ? String(created[0][pk(kind)]) : null, { kind: args.kind, count: created.length, project_id: args.project_id });
      return { kind: args.kind, created: created.length, records: created.map((r) => compact(r)) };
    },
  }),

  tool<{ kind: string; updates: { id: string; changes: Record<string, unknown> }[] }>({
    name: 'update_records',
    title: 'Update records',
    access: 'write',
    description: `Change fields on one or many records (up to ${MAX_BATCH}). Only the fields you pass change.`,
    input: s.object({
      kind: s.string('Kind name'),
      updates: s.array(s.object({ id: s.string('Record id'), changes: s.record('Fields to change') }, ['id', 'changes']), 'Updates', { minItems: 1, maxItems: MAX_BATCH }),
    }, ['kind', 'updates']),
    async run(args, ctx) {
      const kind = getKind(args.kind, ctx);
      if (kind.readOnly) throw new ToolError(`${args.kind} is read-only here.`);
      ctx.requireScope('write');

      const problems: string[] = [];
      const cleaned = args.updates.map((u, i) => {
        const { values, errors } = cleanRecord(kind, u.changes, 'update');
        problems.push(...errors.map((e) => `updates[${i}]: ${e}`));
        return { id: u.id, values };
      });
      if (problems.length) throw new ToolError(problems.slice(0, 20).join('; '));

      await loadForWrite(ctx, kind, Array.from(new Set(cleaned.map((u) => u.id))));
      const results = await Promise.all(cleaned.map(async (u) => {
        const values = { ...u.values, updated_at: new Date().toISOString() };
        let res = await ctx.db.from(kind.table).update(values).eq(pk(kind), u.id).select('*').single();
        // Not every table has updated_at; retry without it rather than listing them all.
        if (res.error && /updated_at/.test(res.error.message)) res = await ctx.db.from(kind.table).update(u.values).eq(pk(kind), u.id).select('*').single();
        return compact(must(res, `Updating ${args.kind} ${u.id}`) as Record<string, unknown>);
      }));

      await ctx.audit('update_records', kind.table, results.length === 1 ? cleaned[0].id : null, { kind: args.kind, count: results.length });
      return { kind: args.kind, updated: results.length, records: results };
    },
  }),

  tool<{ kind: string; ids: string[] }>({
    name: 'delete_records',
    title: 'Delete records',
    access: 'write',
    destructive: true,
    description: 'Permanently delete records by id. Only delete what the user asked to remove.',
    input: s.object({
      kind: s.string('Kind name'),
      ids: s.array(s.string(), 'Record ids', { minItems: 1, maxItems: MAX_BATCH }),
    }, ['kind', 'ids']),
    async run(args, ctx) {
      const kind = getKind(args.kind, ctx);
      if (kind.readOnly) throw new ToolError(`${args.kind} is read-only here.`);
      ctx.requireScope('write');
      const ids = Array.from(new Set(args.ids));
      const rows = await loadForWrite(ctx, kind, ids);
      must(await ctx.db.from(kind.table).delete().in(pk(kind), ids), `Deleting ${args.kind}`);
      await ctx.audit('delete_records', kind.table, ids.length === 1 ? ids[0] : null, {
        kind: args.kind,
        ids,
        titles: rows.map((r) => r[kind.title]).filter(Boolean).slice(0, 50),
      });
      return { kind: args.kind, deleted: ids.length };
    },
  }),
];
