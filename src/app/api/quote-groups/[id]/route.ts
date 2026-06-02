import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: group, error: groupError } = await supabase
    .from('quote_groups')
    .select('*')
    .eq('id', params.id)
    .single();

  if (groupError || !group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  // Fetch members separately
  const { data: members } = await supabase
    .from('quote_group_members')
    .select('*')
    .eq('group_id', params.id)
    .order('joined_at', { ascending: true });

  // Fetch profiles for each member
  let membersWithProfiles: any[] = [];
  if (members && members.length > 0) {
    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    membersWithProfiles = members.map(m => ({
      ...m,
      profile: profileMap.get(m.user_id) || null,
    }));
  }

  const { count } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', params.id);

  return NextResponse.json({ data: { ...group, members: membersWithProfiles, quote_count: count ?? 0 } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from('quote_groups')
    .select('created_by')
    .eq('id', params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }
  if (existing.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.emoji !== undefined) updates.emoji = body.emoji;

  const { data, error } = await supabase
    .from('quote_groups')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from('quote_groups')
    .select('created_by')
    .eq('id', params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }
  if (existing.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase
    .from('quote_groups')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
