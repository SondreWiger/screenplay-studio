/**
 * PostgREST caps every response at the project's max-rows (1000 by default)
 * and truncates silently — no error, just fewer rows. Anything that reads
 * script elements (or any other table that can grow past that) must page.
 */

const PAGE_SIZE = 1000;

// Minimal shape of a Supabase filter builder; avoids importing the generics.
interface PageableQuery<T> extends PromiseLike<{ data: T[] | null; error: { message: string } | null }> {
  order(column: string, opts?: { ascending?: boolean }): PageableQuery<T>;
  range(from: number, to: number): PageableQuery<T>;
}

/**
 * Fetch every row of a query, one page at a time.
 *
 * `makeQuery` must build a fresh query each call (select + filters + your
 * ordering). An `id` tie-breaker is appended so rows sharing a sort value
 * (e.g. `sort_order` across several scripts) can't be skipped or repeated
 * between pages.
 *
 * Throws on the first page error rather than returning a partial result.
 */
export async function fetchAll<T = any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  makeQuery: () => any,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = makeQuery() as PageableQuery<T>;
    const { data, error } = await query.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * `fetchAll` with the `{ data, error }` shape of a normal Supabase call, so it
 * can drop into existing code (including `Promise.all` lists) unchanged.
 */
export async function fetchAllResult<T = any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  makeQuery: () => any,
): Promise<{ data: T[] | null; error: Error | null }> {
  try {
    return { data: await fetchAll<T>(makeQuery), error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Attach author profiles to rows whose author column references auth.users
 * rather than profiles. PostgREST can't embed across that foreign key
 * (`profiles!author_id(...)` fails with PGRST200), so look them up separately.
 */
export async function attachProfiles<T extends Record<string, any>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: T[],
  idKey: keyof T,
  as: string,
  columns = 'id, display_name, full_name, avatar_url, email',
): Promise<T[]> {
  const ids = Array.from(new Set(rows.map((r) => r[idKey]).filter(Boolean)));
  if (ids.length === 0) return rows;
  const { data } = await supabase.from('profiles').select(columns).in('id', ids);
  const byId = new Map<string, unknown>((data || []).map((p: { id: string }) => [p.id, p]));
  return rows.map((r) => ({ ...r, [as]: byId.get(r[idKey]) ?? null }));
}
