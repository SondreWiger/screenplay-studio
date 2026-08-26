'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import type { ProToolRecord, ProTool } from '@/lib/pro-tools';

// Every Pro tool stores its rows in the shared `pro_tool_records` table,
// discriminated by `tool`. Tool-specific fields live in the `data` JSONB column
// as described by the tool's `fields` definition.

interface UseProToolRecords {
  records: ProToolRecord[];
  loading: boolean;
  error: string | null;
  create: (title: string, status: string, data: Record<string, unknown>) => Promise<ProToolRecord | null>;
  update: (id: string, patch: Partial<Pick<ProToolRecord, 'title' | 'status' | 'data'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProToolRecords(projectId: string, tool: ProTool): UseProToolRecords {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<ProToolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('pro_tool_records')
      .select('*')
      .eq('project_id', projectId)
      .eq('tool', tool.slug)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (err) setError(err.message);
    else {
      setError(null);
      setRecords((data as ProToolRecord[]) ?? []);
    }
    setLoading(false);
  }, [projectId, tool.slug]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const create = useCallback<UseProToolRecords['create']>(async (title, status, data) => {
    const supabase = createClient();
    const sort_order = records.length ? Math.max(...records.map((r) => r.sort_order)) + 1 : 0;
    const { data: row, error: err } = await supabase
      .from('pro_tool_records')
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
    const created = row as ProToolRecord;
    setRecords((prev) => [...prev, created]);
    return created;
  }, [projectId, tool.slug, records, user?.id]);

  const update = useCallback<UseProToolRecords['update']>(async (id, patch) => {
    const previous = records;
    // Optimistic — status pills and inline edits should feel instant.
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    const supabase = createClient();
    const { error: err } = await supabase
      .from('pro_tool_records')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (err) {
      setError(err.message);
      setRecords(previous);
    }
  }, [records]);

  const remove = useCallback<UseProToolRecords['remove']>(async (id) => {
    const previous = records;
    setRecords((prev) => prev.filter((r) => r.id !== id));

    const supabase = createClient();
    const { error: err } = await supabase.from('pro_tool_records').delete().eq('id', id);
    if (err) {
      setError(err.message);
      setRecords(previous);
    }
  }, [records]);

  return { records, loading, error, create, update, remove, refresh };
}
