import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rejectUnlessAdmin } from '@/lib/require-admin';

export const dynamic = 'force-dynamic';

/** Counting words reads every script line, so the result is kept for a while. */
const CACHE_TTL_MS = 10 * 60_000;
let cached: { at: number; totalWords: number } | null = null;
let inflight: Promise<number> | null = null;

async function countWords(): Promise<number> {
  const supabase = createAdminSupabaseClient();
  let totalWords = 0;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('script_elements')
      .select('content')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const el of data) {
      const text = (el.content || '').trim();
      if (text) totalWords += text.split(/\s+/).length;
    }
    if (data.length < PAGE) break;
  }
  return totalWords;
}

export async function GET() {
  const userClient = createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  const denied = await rejectUnlessAdmin(user?.id);
  if (denied) return denied;

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ totalWords: cached.totalWords, cachedAt: new Date(cached.at).toISOString() });
  }
  try {
    // Concurrent requests share one scan
    inflight ??= countWords().finally(() => { inflight = null; });
    const totalWords = await inflight;
    cached = { at: Date.now(), totalWords };
    return NextResponse.json({ totalWords, cachedAt: new Date(cached.at).toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to count words' }, { status: 500 });
  }
}
