import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: members, error } = await supabase
    .from('quote_group_members')
    .select('*')
    .eq('group_id', params.id)
    .order('joined_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch profiles for each member
  let data: any[] = members || [];
  if (members && members.length > 0) {
    const userIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    data = members.map(m => ({
      ...m,
      profile: profileMap.get(m.user_id) || null,
    }));
  }

  return NextResponse.json({ data });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
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
  if (group.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  if (!body.user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from('quote_group_members')
    .insert({ group_id: params.id, user_id: body.user_id, role: 'member' })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch profile separately
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .eq('id', body.user_id)
    .single();

  return NextResponse.json({ data: { ...inserted, profile: profile || null } }, { status: 201 });
}
