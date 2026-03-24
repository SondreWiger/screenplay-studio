import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

/**
 * POST /api/admin/moderation/flag
 * Auto-flag content detected by client-side automod.
 * Any authenticated user can report — this just creates a flag entry.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const adminClient = supabaseAdmin();

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { content_type, content_id, project_id, flagged_user_id, matched_terms, content_snippet } = body;

    if (!content_type || !content_id || !flagged_user_id || !matched_terms?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check for duplicate — don't flag the same content twice
    const { data: existing } = await adminClient
      .from('content_flags')
      .select('id')
      .eq('content_id', content_id)
      .eq('content_type', content_type)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Determine severity based on matched terms
    const csamDirect = ['child porn', 'child pornography', 'csam', 'cp link', 'cp video', 'cp image',
      'underage sex', 'underage porn', 'child sex', 'child exploitation', 'child abuse material',
      'molest child', 'molest kid', 'molest minor', 'pedoph', 'paedoph'];
    const isCritical = matched_terms.some((t: string) =>
      csamDirect.some(cd => t.includes(cd) || cd.includes(t))
    );

    // Determine flag_reason
    const csamTerms = ['csam', 'cp ', 'child porn', 'child sex', 'child nude', 'child naked',
      'underage', 'minor sex', 'minor nude', 'minor porn', 'kid sex', 'kid porn', 'kid nude',
      'preteen', 'pedoph', 'paedoph', 'lolicon', 'shotacon'];
    const exploitationTerms = ['child exploitation', 'child abuse', 'molest', 'groom', 'trafficking', 'sell child', 'buy child'];

    let flag_reason = 'manual_review';
    if (matched_terms.some((t: string) => csamTerms.some(ct => t.includes(ct)))) {
      flag_reason = 'csam';
    } else if (matched_terms.some((t: string) => exploitationTerms.some(et => t.includes(et)))) {
      flag_reason = 'child_exploitation';
    }

    // Insert the flag
    const { error: flagError } = await adminClient
      .from('content_flags')
      .insert({
        content_type,
        content_id,
        project_id: project_id || null,
        flagged_user_id,
        flag_reason,
        matched_terms,
        content_snippet: (content_snippet || '').substring(0, 500),
        severity: isCritical ? 'critical' : 'high',
        status: 'pending',
      });

    if (flagError) {
      console.error('Error creating content flag:', flagError);
      return NextResponse.json({ error: 'Failed to create flag' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, flagged: true });
  } catch (err) {
    console.error('Flag API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
