import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// POST /api/user/data-export
// GDPR-compliant full data export — returns all user data as downloadable JSON.
// ---------------------------------------------------------------------------

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

    // ---- Gather all user data in parallel ----
    const [
      profileRes,
      projectsRes,
      scriptsRes,
      scriptElementsRes,
      charactersRes,
      scenesRes,
      shotsRes,
      commentsRes,
      notificationsRes,
      loginHistoryRes,
      consentRecordsRes,
      subscriptionRes,
      auditLogRes,
      securityEventsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('projects').select('*').eq('created_by', uid).order('created_at', { ascending: false }),
      supabase.from('scripts').select('*').eq('created_by', uid).order('created_at', { ascending: false }),
      supabase.from('script_elements').select('*').eq('created_by', uid).order('created_at', { ascending: false }),
      supabase.from('characters').select('*').eq('created_by', uid).order('created_at', { ascending: false }),
      supabase.from('scenes').select('*').eq('created_by', uid).order('created_at', { ascending: false }),
      supabase.from('shots').select('*').eq('created_by', uid).order('created_at', { ascending: false }),
      supabase.from('comments').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('login_history').select('*').eq('user_id', uid).order('login_at', { ascending: false }),
      supabase.from('consent_records').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('audit_log').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('security_events').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: uid,
      email: user.email,
      profile: profileRes.data || null,
      projects: projectsRes.data || [],
      scripts: scriptsRes.data || [],
      script_elements: scriptElementsRes.data || [],
      characters: charactersRes.data || [],
      scenes: scenesRes.data || [],
      shots: shotsRes.data || [],
      comments: commentsRes.data || [],
      notifications: notificationsRes.data || [],
      login_history: loginHistoryRes.data || [],
      consent_records: consentRecordsRes.data || [],
      subscriptions: subscriptionRes.data || [],
      audit_log: auditLogRes.data || [],
      security_events: securityEventsRes.data || [],
    };

    // ---- Record the export request ----
    await supabase.from('data_export_requests').insert({
      user_id: uid,
      status: 'completed',
      completed_at: new Date().toISOString(),
      format: 'json',
    });

    // ---- Audit log entry ----
    await supabase.from('audit_log').insert({
      user_id: uid,
      action: 'data_export',
      entity_type: 'user',
      entity_id: uid,
      metadata: { format: 'json' },
    });

    // ---- Return as downloadable JSON ----
    const jsonString = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="screenplaystudio-data-export-${uid}-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    console.error('[data-export] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
