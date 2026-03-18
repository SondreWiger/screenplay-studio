import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// ── In-memory rate limiter for anonymous feedback submissions ─────────────────
// 5 submissions per IP per 15 minutes. Resets on server restart (acceptable —
// this is a soft-spam guard, not a hard security boundary).
const FEEDBACK_LIMIT = 5;
const FEEDBACK_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface FeedbackRateBucket {
  count: number;
  resetAt: number;
}
const feedbackBuckets = new Map<string, FeedbackRateBucket>();

function checkFeedbackRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = feedbackBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    feedbackBuckets.set(ip, { count: 1, resetAt: now + FEEDBACK_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  bucket.count++;
  if (bucket.count > FEEDBACK_LIMIT) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export async function POST(req: NextRequest) {
  // ── Rate limit (extra guard for anonymous submissions) ─────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
  const rateCheck = checkFeedbackRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many submissions. Please wait before submitting again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfterSec) },
      },
    );
  }
  try {
    const body = await req.json();

    // Basic server-side validation
    const { type, title, body: itemBody } = body;
    if (!type || !['bug_report', 'feature_request', 'testimonial', 'other'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    if (!title || title.trim().length < 5) {
      return NextResponse.json({ error: 'Title too short' }, { status: 400 });
    }
    if (!itemBody || itemBody.trim().length < 10) {
      return NextResponse.json({ error: 'Body too short' }, { status: 400 });
    }

    // Optionally resolve the calling user from their session cookie
    let userId: string | null = null;
    try {
      const serverSupabase = createServerSupabaseClient();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user?.id) userId = user.id;
    } catch {
      // Not authenticated — that's fine, anonymous submissions are allowed
    }

    // Build the insert payload — only include user_id when confirmed server-side
    const payload: Record<string, unknown> = {
      type,
      title: title.trim(),
      body: itemBody.trim(),
      is_public: body.is_public ?? true,
      author_name: body.author_name ?? null,
      author_email: body.author_email ?? null,
      browser_info: body.browser_info ?? null,
    };

    if (userId) payload.user_id = userId;

    if (type === 'bug_report') {
      payload.steps_to_reproduce = body.steps_to_reproduce ?? null;
      payload.expected_behavior  = body.expected_behavior  ?? null;
      payload.actual_behavior    = body.actual_behavior    ?? null;
      payload.url_where_occurred = body.url_where_occurred ?? null;
    }
    if (type === 'feature_request') {
      payload.use_case = body.use_case ?? null;
    }
    if (type === 'testimonial') {
      payload.rating           = body.rating           ?? 5;
      payload.show_author_name = body.show_author_name ?? true;
      payload.is_approved      = false;
      payload.is_public        = false;
    }

    // Use service role client — bypasses RLS completely
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from('feedback_items')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.error('[/api/feedback/submit] insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('[/api/feedback/submit] unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
