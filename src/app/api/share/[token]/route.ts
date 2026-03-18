import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // 1. Fetch the share link
  const { data: link, error: linkError } = await admin
    .from('project_share_links')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .single();

  if (linkError || !link) {
    return NextResponse.json({ error: 'Link not found or inactive' }, { status: 404 });
  }

  // 2. Check expiry
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link has expired' }, { status: 410 });
  }

  // 3. Increment view count (fire-and-forget, non-blocking)
  admin.rpc('increment_share_link_views', { link_token: token }).then(() => {});

  // 4. Fetch project info
  const { data: project } = await admin
    .from('projects')
    .select('id, title, logline, format, cover_url, accent_color')
    .eq('id', link.project_id)
    .single();

  // 5. Fetch permitted content in parallel
  const contentFetches: Promise<void>[] = [];

  let script: { id: string; title: string; version: number; elements: unknown[] } | null = null;
  let characters: unknown[] | null = null;
  let scenes: unknown[] | null = null;
  let schedule: unknown[] | null = null;
  let documents: unknown[] | null = null;

  if (link.can_view_script) {
    contentFetches.push(
      (async () => {
        const { data: scripts } = await admin
          .from('scripts')
          .select('id, title, version')
          .eq('project_id', link.project_id)
          .eq('is_active', true)
          .limit(1)
          .single();

        if (scripts) {
          const { data: elements } = await admin
            .from('script_elements')
            .select('id, element_type, content, sort_order')
            .eq('script_id', scripts.id)
            .order('sort_order', { ascending: true });

          script = { ...scripts, elements: elements ?? [] };
        }
      })()
    );
  }

  if (link.can_view_characters) {
    contentFetches.push(
      (async () => {
        const { data } = await admin
          .from('characters')
          .select('id, name, full_name, age, gender, description, backstory, motivation, arc, appearance, personality_traits, quirks, avatar_url, color, is_main, role, cast_actor, sort_order')
          .eq('project_id', link.project_id)
          .order('sort_order', { ascending: true });
        characters = data ?? [];
      })()
    );
  }

  if (link.can_view_scenes) {
    contentFetches.push(
      (async () => {
        const { data } = await admin
          .from('scenes')
          .select('id, scene_number, scene_heading, location_type, location_name, time_of_day, synopsis, page_count, estimated_duration_minutes, notes, sort_order')
          .eq('project_id', link.project_id)
          .order('sort_order', { ascending: true });
        scenes = data ?? [];
      })()
    );
  }

  if (link.can_view_schedule) {
    contentFetches.push(
      (async () => {
        const { data } = await admin
          .from('shooting_days')
          .select('id, day_number, shoot_date, call_time, wrap_time, notes, is_completed')
          .eq('project_id', link.project_id)
          .order('day_number', { ascending: true });
        schedule = data ?? [];
      })()
    );
  }

  if (link.can_view_documents) {
    contentFetches.push(
      (async () => {
        const { data } = await admin
          .from('project_documents')
          .select('id, title, doc_type, content, word_count, tags, created_at, updated_at')
          .eq('project_id', link.project_id)
          .order('created_at', { ascending: false });
        documents = data ?? [];
      })()
    );
  }

  await Promise.all(contentFetches);

  return NextResponse.json({
    link: {
      id: link.id,
      name: link.name,
      is_invite: link.is_invite,
      invite_role: link.invite_role,
      can_view_script: link.can_view_script,
      can_view_characters: link.can_view_characters,
      can_view_scenes: link.can_view_scenes,
      can_view_schedule: link.can_view_schedule,
      can_view_documents: link.can_view_documents,
      expires_at: link.expires_at,
    },
    project: project ?? null,
    ...(link.can_view_script && { script }),
    ...(link.can_view_characters && { characters }),
    ...(link.can_view_scenes && { scenes }),
    ...(link.can_view_schedule && { schedule }),
    ...(link.can_view_documents && { documents }),
  });
}
