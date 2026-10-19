import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { CinderraError } from '@/lib/cinderra';

/** The signed-in user and their display name, or a 401 response. */
export async function currentUser() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first' }, { status: 401 }) } as const;

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  const name = profile?.display_name || profile?.full_name || user.email?.split('@')[0] || 'Screenplay Studio user';
  return { user, admin, name, avatarUrl: profile?.avatar_url ?? null } as const;
}

export function errorResponse(err: unknown, fallback = 'Something went wrong') {
  if (err instanceof CinderraError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: err instanceof Error ? err.message : fallback }, { status: 500 });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
