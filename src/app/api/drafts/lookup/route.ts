import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitKey, getClientIp, addRateLimitHeaders } from '@/lib/rate-limit';
import { normalizeDraftCode } from '@/lib/scripts/drafts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT = 20;

/**
 * GET /api/drafts/lookup?code=ABCDE
 *
 * Project members get the full record; anyone else only when the project has
 * public lookup turned on. Unknown and private codes both answer 404, so the
 * endpoint can't be used to find out which codes exist.
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

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc('lookup_printed_draft', { p_code: code, p_user_id: userId });
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
  return addRateLimitHeaders(
    NextResponse.json({ draft: data }, { headers: { 'Cache-Control': 'no-store' } }),
    rate,
    LIMIT,
  );
}
