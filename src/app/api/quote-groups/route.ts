import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get groups the user created
  const { data: ownedGroups } = await supabase
    .from('quote_groups')
    .select('*')
    .eq('created_by', user.id)
    .order('updated_at', { ascending: false });

  // Get group IDs the user is a member of
  const { data: memberRows } = await supabase
    .from('quote_group_members')
    .select('group_id')
    .eq('user_id', user.id);

  const memberGroupIds = memberRows?.map(r => r.group_id) || [];

  // Get groups the user is a member of but didn't create
  let memberGroups: any[] = [];
  if (memberGroupIds.length > 0) {
    const { data } = await supabase
      .from('quote_groups')
      .select('*')
      .in('id', memberGroupIds)
      .neq('created_by', user.id)
      .order('updated_at', { ascending: false });
    memberGroups = data || [];
  }

  const allGroups = [...(ownedGroups || []), ...memberGroups];

  // Enrich with counts
  const groupsWithCounts = await Promise.all(
    allGroups.map(async (g) => {
      const { count: qCount } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', g.id);

      const { count: mCount } = await supabase
        .from('quote_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', g.id);

      return { ...g, quote_count: qCount ?? 0, member_count: mCount ?? 0 };
    })
  );

  return NextResponse.json({ data: groupsWithCounts });
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('quote_groups')
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      emoji: body.emoji || '💬',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
