import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from('quotes')
    .select('created_by')
    .eq('id', params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }
  if (existing.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.content !== undefined) updates.content = body.content.trim();
  if (body.said_by !== undefined) updates.said_by = body.said_by.trim();
  if (body.said_at !== undefined) updates.said_at = body.said_at || null;
  if (body.context !== undefined) updates.context = body.context?.trim() || null;
  if (body.location !== undefined) updates.location = body.location?.trim() || null;
  if (body.group_name !== undefined) updates.group_name = body.group_name?.trim() || null;
  if (body.group_id !== undefined) updates.group_id = body.group_id || null;

  const { data, error } = await supabase
    .from('quotes')
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
    .from('quotes')
    .select('created_by')
    .eq('id', params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }
  if (existing.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
