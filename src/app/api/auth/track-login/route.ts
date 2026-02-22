import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// POST /api/auth/track-login
// Tracks login events, detects suspicious activity, and logs audit entries.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // Authenticate the request — only logged-in users can track their own logins
    const { data: { user: authUser } } = await supabase.auth.getUser();

    const body = await req.json();

    const ip_address =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const user_agent = req.headers.get('user-agent') || 'unknown';
    const { method = 'email', success = true } = body as {
      method?: 'email' | 'magic_link' | 'oauth';
      success?: boolean;
    };

    // Use authenticated user ID — never trust client-supplied user_id
    const user_id = authUser?.id || body.user_id;
    if (!user_id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // If authenticated, ensure they can only track their own logins
    if (authUser && body.user_id && body.user_id !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ---- Insert login_history record ----
    const { error: loginErr } = await supabase.from('login_history').insert({
      user_id,
      ip_address,
      user_agent,
      method,
      success,
      login_at: new Date().toISOString(),
    });

    if (loginErr) {
      console.error('[track-login] login_history insert failed:', loginErr);
    }

    // ---- Insert audit_log entry ----
    const { error: auditErr } = await supabase.from('audit_log').insert({
      user_id,
      action: success ? 'login_success' : 'login_failed',
      entity_type: 'auth',
      entity_id: user_id,
      metadata: { ip_address, user_agent, method },
    });

    if (auditErr) {
      console.error('[track-login] audit_log insert failed:', auditErr);
    }

    // ---- Suspicious login detection ----
    // Flag if the same user has 5+ failed logins in the last 15 minutes from different IPs
    if (!success) {
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      const { data: recentFailed } = await supabase
        .from('login_history')
        .select('ip_address')
        .eq('user_id', user_id)
        .eq('success', false)
        .gte('login_at', fifteenMinAgo);

      if (recentFailed && recentFailed.length >= 5) {
        const uniqueIPs = new Set(recentFailed.map((r) => r.ip_address));

        if (uniqueIPs.size >= 2) {
          // Insert security_event
          const { error: secErr } = await supabase.from('security_events').insert({
            user_id,
            event_type: 'suspicious_login',
            severity: 'high',
            description: `${recentFailed.length} failed login attempts from ${uniqueIPs.size} different IPs in the last 15 minutes.`,
            metadata: {
              failed_count: recentFailed.length,
              unique_ips: Array.from(uniqueIPs),
              latest_ip: ip_address,
              latest_user_agent: user_agent,
            },
          });

          if (secErr) {
            console.error('[track-login] security_events insert failed:', secErr);
          }

          // Create notification for the user
          const { error: notifErr } = await supabase.from('notifications').insert({
            user_id,
            type: 'security_alert',
            title: 'Suspicious Login Activity Detected',
            body: `We detected ${recentFailed.length} failed login attempts on your account from multiple locations. If this wasn't you, please change your password immediately.`,
            url: '/settings/security',
          });

          if (notifErr) {
            console.error('[track-login] notification insert failed:', notifErr);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[track-login] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
