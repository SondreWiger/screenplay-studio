import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  const groupName = searchParams.get('group_name');
  const groupId = searchParams.get('group_id');
  const search = searchParams.get('q');
  const sortBy = searchParams.get('sort') || 'created_at';
  const sortOrder = searchParams.get('order') || 'desc';

  const validSortFields = ['created_at', 'said_by', 'said_at', 'group_name'];
  const field = validSortFields.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'asc' ? 'asc' : 'desc';

  let query = supabase
    .from('quotes')
    .select('*, group:quote_groups(*)')
    .order(field, { ascending: order === 'asc' });

  if (projectId) {
    query = query.eq('project_id', projectId);
  } else if (!groupId) {
    query = query.is('project_id', null);
  }

  if (groupName) {
    query = query.eq('group_name', groupName);
  }

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  if (search) {
    query = query.or(`content.ilike.%${search}%,said_by.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Quote content is required' }, { status: 400 });
  }
  if (!body.said_by?.trim()) {
    return NextResponse.json({ error: 'Who said it is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      content: body.content.trim(),
      said_by: body.said_by.trim(),
      said_at: body.said_at || null,
      context: body.context?.trim() || null,
      location: body.location?.trim() || null,
      group_name: body.group_name?.trim() || null,
      group_id: body.group_id || null,
      project_id: body.project_id || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
