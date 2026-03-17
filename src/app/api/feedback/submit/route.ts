import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
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
