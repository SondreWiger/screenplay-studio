import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// POST /api/user/delete-account   — Schedule account deletion (30-day grace)
// DELETE /api/user/delete-account — Cancel a pending deletion request
// ---------------------------------------------------------------------------

const GRACE_PERIOD_DAYS = 30;

export async function POST() {
  try {
    const supabase = createServerSupabaseClient();

    // ---- Authenticate ----
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = user.id;
    const scheduledFor = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // ---- Check for existing pending request ----
    const { data: existing } = await supabase
      .from('deletion_requests')
      .select('id, scheduled_for')
      .eq('user_id', uid)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: 'A deletion request is already pending.',
          scheduled_for: existing.scheduled_for,
          deletion_request_id: existing.id,
        },
        { status: 409 },
      );
    }

    // ---- Create deletion request ----
    const { data: request, error: insertErr } = await supabase
      .from('deletion_requests')
      .insert({
        user_id: uid,
        status: 'pending',
        scheduled_for: scheduledFor,
        reason: 'user_requested',
      })
      .select('id, scheduled_for')
      .single();

    if (insertErr) {
      console.error('[delete-account] insert failed:', insertErr);
      return NextResponse.json({ error: 'Failed to create deletion request' }, { status: 500 });
    }

    // ---- Security event ----
    await supabase.from('security_events').insert({
      user_id: uid,
      event_type: 'account_deletion_requested',
      severity: 'medium',
      description: `Account deletion scheduled for ${scheduledFor}. ${GRACE_PERIOD_DAYS}-day grace period.`,
      metadata: { deletion_request_id: request.id, scheduled_for: scheduledFor },
    });

    // ---- Audit log ----
    await supabase.from('audit_log').insert({
      user_id: uid,
      action: 'account_deletion_requested',
      entity_type: 'user',
      entity_id: uid,
      metadata: { deletion_request_id: request.id, scheduled_for: scheduledFor },
    });

    // ---- Notification ----
    await supabase.from('notifications').insert({
      user_id: uid,
      type: 'account',
      title: 'Account Deletion Scheduled',
      body: `Your account is scheduled for deletion on ${new Date(scheduledFor).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. You can cancel this anytime before then from your Security settings.`,
      url: '/settings/security',
    });

    return NextResponse.json({
      ok: true,
      deletion_request_id: request.id,
      scheduled_for: scheduledFor,
      message: `Your account will be permanently deleted on ${new Date(scheduledFor).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. You can cancel this at any time before that date.`,
    });
  } catch (err) {
    console.error('[delete-account] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = createServerSupabaseClient();

    // ---- Authenticate ----
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uid = user.id;

    // ---- Find pending deletion request ----
    const { data: pending } = await supabase
      .from('deletion_requests')
      .select('id')
      .eq('user_id', uid)
      .eq('status', 'pending')
      .maybeSingle();

    if (!pending) {
      return NextResponse.json({ error: 'No pending deletion request found' }, { status: 404 });
    }

    // ---- Cancel the request ----
    const { error: updateErr } = await supabase
      .from('deletion_requests')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', pending.id);

    if (updateErr) {
      console.error('[delete-account] cancel failed:', updateErr);
      return NextResponse.json({ error: 'Failed to cancel deletion request' }, { status: 500 });
    }

    // ---- Audit log ----
    await supabase.from('audit_log').insert({
      user_id: uid,
      action: 'account_deletion_cancelled',
      entity_type: 'user',
      entity_id: uid,
      metadata: { deletion_request_id: pending.id },
    });

    // ---- Notification ----
    await supabase.from('notifications').insert({
      user_id: uid,
      type: 'account',
      title: 'Account Deletion Cancelled',
      body: 'Your account deletion request has been cancelled. Your account will remain active.',
      url: '/settings/security',
    });

    return NextResponse.json({ ok: true, message: 'Deletion request cancelled successfully.' });
  } catch (err) {
    console.error('[delete-account] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
