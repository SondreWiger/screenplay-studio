'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NovelChapter, NovelSettings } from '@/lib/types';

/**
 * Book-level settings live in projects.content_metadata.novel. Saves re-read
 * the current metadata first so they don't clobber beat sheets or anything
 * else another tool keeps there.
 */
export function useNovelSettings(projectId: string) {
  const [settings, setSettings] = useState<NovelSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from('projects')
      .select('content_metadata')
      .eq('id', projectId)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        const meta = (data?.content_metadata ?? {}) as Record<string, unknown>;
        setSettings((meta.novel as NovelSettings) ?? {});
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const save = useCallback(async (patch: Partial<NovelSettings>) => {
    const supabase = createClient();
    const { data: cur } = await supabase.from('projects').select('content_metadata').eq('id', projectId).single();
    const meta = (cur?.content_metadata ?? {}) as Record<string, unknown>;
    const next = { ...((meta.novel as NovelSettings) ?? {}), ...patch };
    const { error } = await supabase.from('projects').update({ content_metadata: { ...meta, novel: next } }).eq('id', projectId);
    if (!error) setSettings(next);
    return { error };
  }, [projectId]);

  return { settings, save, loading };
}

/** Binder rows, without prose unless asked — a long book's content is megabytes. */
export async function fetchChapters(projectId: string, withContent = false): Promise<NovelChapter[]> {
  const cols = withContent
    ? '*'
    : 'id, project_id, kind, title, synopsis, status, pov_character_id, pov, tense, label_color, target_words, word_count, notes, include_in_export, sort_order, created_by, created_at, updated_at';
  const { data } = await createClient()
    .from('novel_chapters')
    .select(cols)
    .eq('project_id', projectId)
    .order('sort_order');
  return ((data ?? []) as unknown as NovelChapter[]).map((c) => ({ ...c, content: c.content ?? '' }));
}

/** Local calendar day as YYYY-MM-DD — streaks follow the writer's day, not UTC. */
export function localDay(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Add words (and optionally a finished sprint) to today's writing log. */
export async function logWords(projectId: string, words: number, sprints = 0) {
  if (words <= 0 && sprints <= 0) return;
  await createClient().rpc('log_novel_words', {
    p_project_id: projectId,
    p_words: Math.max(0, Math.round(words)),
    p_day: localDay(),
    p_sprints: sprints,
  });
}
