import { describe, it, expect, beforeEach } from 'vitest';
import { LocalQueryBuilder, type LocalRowStore } from '@/lib/supabase/local-query';

type Row = Record<string, unknown>;

function memoryStore(): LocalRowStore & { tables: Map<string, Map<string, Row>> } {
  const tables = new Map<string, Map<string, Row>>();
  const table = (name: string) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  };
  return {
    tables,
    getAll: async (name) => [...table(name).values()],
    put: async (name, rows) => { for (const r of rows) table(name).set(String(r.id), r); },
    remove: async (name, ids) => { for (const id of ids) table(name).delete(id); },
  };
}

describe('LocalQueryBuilder', () => {
  let store: ReturnType<typeof memoryStore>;
  const from = (t: string) => new LocalQueryBuilder(store, t);

  beforeEach(() => { store = memoryStore(); });

  it('persists inserts so a later select returns them', async () => {
    const { error } = await from('characters').insert({ project_id: 'p1', name: 'ALICE', is_main: true });
    expect(error).toBeNull();
    await from('characters').insert({ project_id: 'p2', name: 'BOB' });

    const { data } = await from('characters').select('*').eq('project_id', 'p1')
      .order('is_main', { ascending: false }).order('sort_order', { ascending: true });
    expect(data).toHaveLength(1);
    expect((data as Row[])[0]).toMatchObject({ name: 'ALICE', project_id: 'p1' });
    expect((data as Row[])[0].id).toEqual(expect.any(String));
  });

  it('returns the inserted row with select().single()', async () => {
    const { data } = await from('ideas').insert({ project_id: 'p1', title: 'Twist' }).select().single();
    expect(data).toMatchObject({ title: 'Twist', project_id: 'p1' });
    expect((data as Row).created_at).toEqual(expect.any(String));
  });

  it('updates and deletes only matching rows', async () => {
    await from('shots').insert([
      { id: 'a', project_id: 'p1', shot_number: '1' },
      { id: 'b', project_id: 'p1', shot_number: '2' },
    ]);
    await from('shots').update({ is_completed: true }).eq('id', 'a');
    await from('shots').delete().eq('id', 'b');

    const { data } = await from('shots').select('*');
    expect(data).toEqual([expect.objectContaining({ id: 'a', is_completed: true, shot_number: '1' })]);
  });

  it('supports in, is, not, or, ilike, range and count', async () => {
    await from('scenes').insert([
      { id: '1', project_id: 'p', title: 'Opening', sort_order: 1, location_id: null },
      { id: '2', project_id: 'p', title: 'Chase', sort_order: 2, location_id: 'loc' },
      { id: '3', project_id: 'p', title: 'Finale', sort_order: 3, location_id: 'loc' },
    ]);
    const ids = async (q: PromiseLike<{ data: unknown }>) => ((await q).data as Row[]).map((r) => r.id);

    expect(await ids(from('scenes').select().in('id', ['1', '3']))).toEqual(['1', '3']);
    expect(await ids(from('scenes').select().is('location_id', null))).toEqual(['1']);
    expect(await ids(from('scenes').select().not('location_id', 'is', null))).toEqual(['2', '3']);
    expect(await ids(from('scenes').select().or('title.eq.Chase,sort_order.gt.2'))).toEqual(['2', '3']);
    expect(await ids(from('scenes').select().ilike('title', '%fin%'))).toEqual(['3']);
    expect(await ids(from('scenes').select().order('sort_order', { ascending: false }).range(0, 1))).toEqual(['3', '2']);

    const { count, data } = await from('scenes').select('*', { count: 'exact', head: true }).eq('location_id', 'loc');
    expect(count).toBe(2);
    expect(data).toBeNull();
  });

  it('upsert merges with the existing row', async () => {
    await from('locations').insert({ id: 'x', name: 'Cafe', notes: 'old' });
    await from('locations').upsert({ id: 'x', notes: 'new' });
    const { data } = await from('locations').select().eq('id', 'x').single();
    expect(data).toMatchObject({ name: 'Cafe', notes: 'new' });
  });

  it('reports storage failures as an error result instead of throwing', async () => {
    store.put = async () => { throw new Error('quota exceeded'); };
    const { error } = await from('characters').insert({ name: 'X' });
    expect(error?.message).toBe('quota exceeded');
  });
});
