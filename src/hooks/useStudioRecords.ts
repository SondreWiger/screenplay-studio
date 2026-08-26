'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import type { StudioRecord, StudioTool } from '@/lib/studio';

// Every Studio tool stores its rows in the shared `studio_records` table,
// discriminated by `tool`. Tool-specific fields live in the `data` JSONB column
// as described by the tool's `fields` definition.

interface UseStudioRecords {
  records: StudioRecord[];
  loading: boolean;
  error: string | null;
  create: (title: string, status: string, data: Record<string, unknown>) => Promise<StudioRecord | null>;
  update: (id: string, patch: Partial<Pick<StudioRecord, 'title' | 'status' | 'data'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useStudioRecords(projectId: string, tool: StudioTool): UseStudioRecords {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<StudioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('studio_records')
      .select('*')
      .eq('project_id', projectId)
      .eq('tool', tool.slug)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (err) setError(err.message);
    else {
      setError(null);
      setRecords((data as StudioRecord[]) ?? []);
    }
    setLoading(false);
  }, [projectId, tool.slug]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const create = useCallback<UseStudioRecords['create']>(async (title, status, data) => {
    const supabase = createClient();
    const sort_order = records.length ? Math.max(...records.map((r) => r.sort_order)) + 1 : 0;
    const { data: row, error: err } = await supabase
      .from('studio_records')
      .insert({
        project_id: projectId,
        tool: tool.slug,
        title,
        status,
        data,
        sort_order,
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    if (err) {
      setError(err.message);
      return null;
    }
    const created = row as StudioRecord;
    setRecords((prev) => [...prev, created]);
    return created;
  }, [projectId, tool.slug, records, user?.id]);

  const update = useCallback<UseStudioRecords['update']>(async (id, patch) => {
    const previous = records;
    // Optimistic — status pills and inline edits should feel instant.
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    const supabase = createClient();
    const { error: err } = await supabase
      .from('studio_records')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (err) {
      setError(err.message);
      setRecords(previous);
    }
  }, [records]);

  const remove = useCallback<UseStudioRecords['remove']>(async (id) => {
    const previous = records;
    setRecords((prev) => prev.filter((r) => r.id !== id));

    const supabase = createClient();
    const { error: err } = await supabase.from('studio_records').delete().eq('id', id);
    if (err) {
      setError(err.message);
      setRecords(previous);
    }
  }, [records]);

  return { records, loading, error, create, update, remove, refresh };
}
