/**
 * Supabase-style query builder for local mode, backed by IndexedDB.
 *
 * Pages call `createClient().from(table).insert(...)` etc. the same way in
 * cloud and local mode. In local mode those calls land here and read/write
 * rows on this device, so creating characters, ideas, shots and the rest
 * actually persists.
 *
 * Supports the subset of PostgREST the app uses: the common filters, order,
 * limit/range, single/maybeSingle, count, and insert/update/upsert/delete with
 * `.select()` to return the written rows. Embedded joins in select strings
 * are ignored (rows come back without them).
 */

type Row = Record<string, unknown>;

export interface LocalRowStore {
  getAll(table: string): Promise<Row[]>;
  put(table: string, rows: Row[]): Promise<void>;
  remove(table: string, ids: string[]): Promise<void>;
}

type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete';
type Predicate = (row: Row) => boolean;
interface OrderBy { column: string; ascending: boolean; nullsFirst: boolean }

export interface LocalResult {
  data: unknown;
  error: { message: string } | null;
  count: number | null;
  status: number;
  statusText: string;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

function likeToRegex(pattern: string, insensitive: boolean): RegExp {
  const escaped = String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, insensitive ? 'is' : 's');
}

/** Parse a PostgREST list literal like `(a,b,"c d")`. */
function parseList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const inner = String(value).trim().replace(/^\(/, '').replace(/\)$/, '');
  if (!inner) return [];
  return inner.split(',').map((v) => v.trim().replace(/^"(.*)"$/, '$1'));
}

function parseScalar(value: string): unknown {
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function predicateFor(column: string, operator: string, value: unknown): Predicate | null {
  switch (operator) {
    case 'eq': return (r) => same(r[column], value);
    case 'neq': return (r) => !same(r[column], value);
    case 'gt': return (r) => r[column] != null && compare(r[column], value) > 0;
    case 'gte': return (r) => r[column] != null && compare(r[column], value) >= 0;
    case 'lt': return (r) => r[column] != null && compare(r[column], value) < 0;
    case 'lte': return (r) => r[column] != null && compare(r[column], value) <= 0;
    case 'like': return (r) => r[column] != null && likeToRegex(String(value), false).test(String(r[column]));
    case 'ilike': return (r) => r[column] != null && likeToRegex(String(value), true).test(String(r[column]));
    case 'is': return (r) => (value === null || value === 'null' ? r[column] == null : same(r[column], value));
    case 'in': {
      const list = parseList(value);
      return (r) => list.some((v) => same(r[column], v));
    }
    case 'cs': case 'contains': {
      const list = Array.isArray(value) ? value : parseList(String(value).replace(/^\{/, '(').replace(/\}$/, ')'));
      return (r) => Array.isArray(r[column]) && list.every((v) => (r[column] as unknown[]).some((x) => same(x, v)));
    }
    case 'ov': case 'overlaps': {
      const list = Array.isArray(value) ? value : parseList(String(value).replace(/^\{/, '(').replace(/\}$/, ')'));
      return (r) => Array.isArray(r[column]) && list.some((v) => (r[column] as unknown[]).some((x) => same(x, v)));
    }
    default: return null;
  }
}

/** Split on commas that aren't inside parentheses. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { parts.push(input.slice(start, i)); start = i + 1; }
  }
  parts.push(input.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Parse an `.or()` expression such as `a.eq.1,b.is.null,and(c.gt.2,d.lt.5)`. */
function parseOr(expr: string): Predicate | null {
  const parsePart = (part: string): Predicate | null => {
    const group = part.match(/^(and|or)\((.*)\)$/);
    if (group) {
      const preds = splitTopLevel(group[2]).map(parsePart);
      if (preds.some((p) => !p)) return null;
      return group[1] === 'and'
        ? (r) => preds.every((p) => p!(r))
        : (r) => preds.some((p) => p!(r));
    }
    const m = part.match(/^([^.]+)\.(not\.)?([a-z]+)\.(.*)$/);
    if (!m) return null;
    const [, column, negate, operator, raw] = m;
    const pred = predicateFor(column, operator, operator === 'in' ? raw : parseScalar(raw));
    if (!pred) return null;
    return negate ? (r) => !pred(r) : pred;
  };
  const preds = splitTopLevel(expr).map(parsePart);
  if (preds.some((p) => !p)) return null;
  return (r) => preds.some((p) => p!(r));
}

export class LocalQueryBuilder implements PromiseLike<LocalResult> {
  private op: Op = 'select';
  private payload: Row[] = [];
  private patch: Row = {};
  private filters: Predicate[] = [];
  private orders: OrderBy[] = [];
  private limitN: number | null = null;
  private offset = 0;
  private singleMode: 'single' | 'maybe' | null = null;
  private returning = false;
  private countMode = false;
  private headOnly = false;

  constructor(private store: LocalRowStore, private table: string) {}

  // ── Operations ──────────────────────────────────────────────

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      if (options?.count) this.countMode = true;
      if (options?.head) this.headOnly = true;
    } else {
      this.returning = true;
    }
    return this;
  }

  insert(values: Row | Row[]) {
    this.op = 'insert';
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(values: Row | Row[]) {
    this.op = 'upsert';
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values: Row) {
    this.op = 'update';
    this.patch = values || {};
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  // ── Filters ─────────────────────────────────────────────────

  private add(column: string, operator: string, value: unknown) {
    const pred = predicateFor(column, operator, value);
    if (pred) this.filters.push(pred);
    return this;
  }

  eq(column: string, value: unknown) { return this.add(column, 'eq', value); }
  neq(column: string, value: unknown) { return this.add(column, 'neq', value); }
  gt(column: string, value: unknown) { return this.add(column, 'gt', value); }
  gte(column: string, value: unknown) { return this.add(column, 'gte', value); }
  lt(column: string, value: unknown) { return this.add(column, 'lt', value); }
  lte(column: string, value: unknown) { return this.add(column, 'lte', value); }
  like(column: string, value: string) { return this.add(column, 'like', value); }
  ilike(column: string, value: string) { return this.add(column, 'ilike', value); }
  is(column: string, value: unknown) { return this.add(column, 'is', value); }
  in(column: string, values: unknown[]) { return this.add(column, 'in', values); }
  contains(column: string, value: unknown) { return this.add(column, 'contains', value); }
  overlaps(column: string, value: unknown) { return this.add(column, 'overlaps', value); }
  filter(column: string, operator: string, value: unknown) { return this.add(column, operator, value); }

  match(query: Row) {
    for (const [k, v] of Object.entries(query)) this.eq(k, v);
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    const pred = predicateFor(column, operator, value);
    if (pred) this.filters.push((r) => !pred(r));
    return this;
  }

  or(expr: string) {
    const pred = parseOr(expr);
    if (pred) this.filters.push(pred);
    return this;
  }

  // Full-text search has no local index; treat it as a case-insensitive substring match.
  textSearch(column: string, query: string) {
    const needle = String(query).replace(/['&|!:*]/g, ' ').trim().toLowerCase();
    if (needle) this.filters.push((r) => String(r[column] ?? '').toLowerCase().includes(needle));
    return this;
  }

  // ── Modifiers ───────────────────────────────────────────────

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    const ascending = options?.ascending !== false;
    this.orders.push({ column, ascending, nullsFirst: options?.nullsFirst ?? !ascending });
    return this;
  }

  limit(n: number) { this.limitN = n; return this; }

  range(from: number, to: number) {
    this.offset = from;
    this.limitN = to - from + 1;
    return this;
  }

  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }

  // No-ops kept for API compatibility.
  returns() { return this; }
  abortSignal() { return this; }
  throwOnError() { return this; }
  csv() { return this; }

  // ── Execution ───────────────────────────────────────────────

  private matches(row: Row) {
    return this.filters.every((f) => f(row));
  }

  private sortRows(rows: Row[]) {
    if (!this.orders.length) return rows;
    return [...rows].sort((a, b) => {
      for (const { column, ascending, nullsFirst } of this.orders) {
        const av = a[column], bv = b[column];
        if (av == null && bv == null) continue;
        if (av == null) return nullsFirst ? -1 : 1;
        if (bv == null) return nullsFirst ? 1 : -1;
        const c = compare(av, bv);
        if (c !== 0) return ascending ? c : -c;
      }
      return 0;
    });
  }

  private result(rows: Row[] | null, count: number | null = null): LocalResult {
    if (this.singleMode) {
      const list = rows || [];
      if (list.length > 1 || (this.singleMode === 'single' && list.length === 0)) {
        return {
          data: null,
          error: { message: list.length === 0 ? 'No rows found' : 'Multiple rows returned' },
          count, status: 406, statusText: 'Not Acceptable',
        };
      }
      return { data: list[0] ?? null, error: null, count, status: 200, statusText: 'OK' };
    }
    return { data: rows, error: null, count, status: 200, statusText: 'OK' };
  }

  private async execute(): Promise<LocalResult> {
    const now = new Date().toISOString();

    if (this.op === 'insert' || this.op === 'upsert') {
      const existing = this.op === 'upsert'
        ? new Map((await this.store.getAll(this.table)).map((r) => [String(r.id), r]))
        : new Map<string, Row>();
      const rows = this.payload.map((values) => {
        const id = values.id != null ? String(values.id) : newId();
        const prev = existing.get(id);
        return { created_at: now, ...prev, ...values, id, updated_at: values.updated_at ?? now } as Row;
      });
      await this.store.put(this.table, rows);
      return this.result(this.returning || this.singleMode ? rows : null);
    }

    const all = await this.store.getAll(this.table);
    const hits = all.filter((r) => this.matches(r));

    if (this.op === 'update') {
      const rows = hits.map((r) => ({ ...r, ...this.patch, id: r.id, updated_at: this.patch.updated_at ?? now }));
      await this.store.put(this.table, rows);
      return this.result(this.returning ? rows : null);
    }

    if (this.op === 'delete') {
      await this.store.remove(this.table, hits.map((r) => String(r.id)));
      return this.result(this.returning ? hits : null);
    }

    const sorted = this.sortRows(hits);
    const end = this.limitN == null ? undefined : this.offset + this.limitN;
    const page = sorted.slice(this.offset, end);
    const count = this.countMode ? hits.length : null;
    if (this.headOnly) return { data: null, error: null, count, status: 200, statusText: 'OK' };
    return this.result(page, count);
  }

  then<T1 = LocalResult, T2 = never>(
    onfulfilled?: ((value: LocalResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return this.execute()
      .catch((err): LocalResult => ({
        data: null,
        error: { message: err instanceof Error ? err.message : String(err) },
        count: null, status: 500, statusText: 'Local storage error',
      }))
      .then(onfulfilled, onrejected);
  }

  catch<T = never>(onrejected?: ((reason: unknown) => T | PromiseLike<T>) | null) {
    return this.then(undefined, onrejected);
  }

  finally(onfinally?: (() => void) | null) {
    return this.then().finally(onfinally);
  }
}
