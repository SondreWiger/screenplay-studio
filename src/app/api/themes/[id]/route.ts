import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// GET /api/themes/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('themes')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

// DELETE /api/themes/[id]
//
// This route deletes with the service role key, which bypasses row-level
// security — so authorisation has to happen here. It previously did none at
// all, which meant an unauthenticated request could delete any published
// theme. Only the theme's author or an admin may remove one.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: theme } = await supabase
    .from('themes')
    .select('author_id')
    .eq('id', id)
    .single();

  if (!theme) {
    return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
  }

  if (theme.author_id !== user.id && !(await isAdmin(user.id, supabase))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase
    .from('themes')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Matches the admin check used by the middleware and the moderation routes. */
async function isAdmin(
  userId: string,
  supabase: ReturnType<typeof createAdminSupabaseClient>
): Promise<boolean> {
  if (process.env.ADMIN_UID && userId === process.env.ADMIN_UID) return true;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  return profile?.role === 'admin' || profile?.role === 'moderator';
}
