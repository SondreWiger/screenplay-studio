import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/dashboard';

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `cookies()` API can only set cookies in a Server Action or Route Handler
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[auth/callback] Code exchange failed:', error.message);
      return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`);
    }

    // Log successful login via OAuth/magic-link
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const ua = request.headers.get('user-agent') || 'unknown';
        await supabase.from('login_history').insert({
          user_id: user.id,
          ip_address: ip,
          user_agent: ua,
          method: 'oauth',
          success: true,
          login_at: new Date().toISOString(),
        });
        await supabase.from('audit_log').insert({
          user_id: user.id,
          action: 'login_success',
          entity_type: 'auth',
          entity_id: user.id,
          metadata: { ip_address: ip, user_agent: ua, method: 'oauth' },
        });
      }
    } catch (e) {
      console.error('[auth/callback] Login tracking failed:', e);
    }
  }

  return NextResponse.redirect(`${origin}${redirect}`);
}
