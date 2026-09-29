import { createClient } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { flushSyncQueue } from '@/lib/offline/queue';

const BATCH = 500;

/**
 * Replace every element of a script (imports, revision restores).
 *
 * New rows are inserted before the old ones are removed, so a failure part-way
 * leaves the original script intact instead of empty; the partial insert is
 * rolled back. Pending offline writes are flushed first so a queued edit to an
 * old line can't resurrect it afterwards.
 *
 * Throws on failure.
 */
export async function replaceScriptElements(
  scriptId: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const supabase = createClient();
  await flushSyncQueue();

  const oldIds = (await fetchAll<{ id: string }>(() =>
    supabase.from('script_elements').select('id').eq('script_id', scriptId),
  )).map((e) => e.id);

  const inserts = rows.map((r) => ({ ...r, id: (r.id as string) || crypto.randomUUID(), script_id: scriptId }));

  for (let b = 0; b < inserts.length; b += BATCH) {
    const { error } = await supabase.from('script_elements').insert(inserts.slice(b, b + BATCH));
    if (error) {
      const added = inserts.slice(0, b).map((e) => e.id);
      for (let d = 0; d < added.length; d += BATCH) {
        await supabase.from('script_elements').delete().in('id', added.slice(d, d + BATCH));
      }
      throw new Error(error.message);
    }
  }

  for (let d = 0; d < oldIds.length; d += BATCH) {
    const { error } = await supabase.from('script_elements').delete().in('id', oldIds.slice(d, d + BATCH));
    if (error) throw new Error(error.message);
  }
}
