import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitKey, getClientIp, addRateLimitHeaders } from '@/lib/rate-limit';
import { normalizeDraftCode } from '@/lib/scripts/drafts';
import { summarizeDraftChanges } from '@/lib/scripts/draft-changes';
import { fetchAllResult } from '@/lib/supabase/fetch-all';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT = 20;

/**
 * GET /api/drafts/lookup?code=ABCDE[&k=<qr key>]
 *
 * Project members get the full record; anyone else only when the project has
 * public lookup turned on, or they scanned the QR code off the paper (k).
 * Unknown and private codes both answer 404, so the endpoint can't be used to
 * find out which codes exist.
 *
 * When the script has changed since printing, `changes` lists which of the
 * printed copy's scenes changed or were cut. New scenes are only counted for
 * non-members, so no unprinted text leaks.
 */
export async function GET(req: NextRequest) {
  const code = normalizeDraftCode(req.nextUrl.searchParams.get('code') || '');
  if (!code) {
    return NextResponse.json({ error: 'A draft code is 5 letters and digits.' }, { status: 400 });
  }

  // Rate limit by IP so codes can't be enumerated
  const ip = getClientIp(req);
  const rate = checkRateLimit(rateLimitKey(ip, '/api/drafts/lookup'), LIMIT, 60_000);
  if (!rate.allowed) {
    return addRateLimitHeaders(
      NextResponse.json({ error: 'Too many lookups — try again in a minute.' }, { status: 429 }),
      rate,
      LIMIT,
    );
  }

  let userId: string | null = null;
  try {
    const { data } = await createServerSupabaseClient().auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // Signed out — public lookup only
  }

  const token = (req.nextUrl.searchParams.get('k') || '').trim().slice(0, 64) || null;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc('lookup_printed_draft', { p_code: code, p_user_id: userId, p_token: token });
  if (error) {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!data) {
    return addRateLimitHeaders(
      NextResponse.json({ error: 'No draft with that code, or its project keeps codes private.' }, { status: 404 }),
      rate,
      LIMIT,
    );
  }

  const { script_id: scriptId, ...draft } = data as Record<string, unknown> & { script_id: string | null };
  if (scriptId && draft.is_current === false) {
    try {
      const [snap, now] = await Promise.all([
        admin.from('printed_drafts').select('snapshot').eq('code', code).single(),
        fetchAllResult(() => admin.from('script_elements')
          .select('id, element_type, content, sort_order, scene_number, is_omitted')
          .eq('script_id', scriptId)
          .order('sort_order')),
      ]);
      if (snap.data && now.data) {
        draft.changes = summarizeDraftChanges(snap.data.snapshot || [], now.data, { includeNewHeadings: !!draft.member });
      }
    } catch {
      // The summary is a bonus; the lookup itself still answers
    }
  }

  return addRateLimitHeaders(
    NextResponse.json({ draft }, { headers: { 'Cache-Control': 'no-store' } }),
    rate,
    LIMIT,
  );
}
