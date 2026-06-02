import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function DELETE(_req: Request, { params }: { params: { id: string; userId: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: group } = await supabase
    .from('quote_groups')
    .select('created_by')
    .eq('id', params.id)
    .single();

  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  // Allow owner to remove anyone, or user to remove themselves
  if (group.created_by !== user.id && params.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Prevent removing the owner
  if (params.userId === group.created_by) {
    return NextResponse.json({ error: 'Cannot remove the group owner' }, { status: 403 });
  }

  const { error } = await supabase
    .from('quote_group_members')
    .delete()
    .eq('group_id', params.id)
    .eq('user_id', params.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
