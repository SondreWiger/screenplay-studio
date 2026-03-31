import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 });

  // Auth: must be logged in and a member of this company
  const userClient = createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await userClient
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createAdminSupabaseClient();

  // Get all member user IDs for this company
  const { data: members } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId);
  const memberIds = (members || []).map((m: any) => m.user_id);

  // Get company projects
  const { data: companyProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('company_id', companyId);
  const projectIds = (companyProjects || []).map((p: any) => p.id);

  // Count words across all company project scripts
  let totalWords = 0;
  if (projectIds.length > 0) {
    const { data: scripts } = await supabase
      .from('scripts')
      .select('id')
      .in('project_id', projectIds);
    const scriptIds = (scripts || []).map((s: any) => s.id);

    if (scriptIds.length > 0) {
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data } = await supabase
          .from('script_elements')
          .select('content')
          .in('script_id', scriptIds)
          .range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        for (const el of data) {
          const text = (el.content || '').trim();
          if (text) totalWords += text.split(/\s+/).length;
        }
        if (data.length < PAGE) break;
        from += PAGE;
      }
    }
  }

  // Parallel counts
  const [
    { count: totalScripts },
    { count: totalScenes },
    { count: totalCharacters },
    { count: totalAssignments },
    { count: openAssignments },
    { count: totalReviewNotes },
    { count: openReviewNotes },
    { count: totalResources },
    { count: totalAnnouncements },
    { count: totalChannelMessages },
    { count: totalPitches },
  ] = await Promise.all([
    supabase.from('scripts').select('*', { count: 'exact', head: true }).in('project_id', projectIds.length ? projectIds : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('scenes').select('*', { count: 'exact', head: true }).in('project_id', projectIds.length ? projectIds : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('characters').select('*', { count: 'exact', head: true }).in('project_id', projectIds.length ? projectIds : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('org_script_assignments').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('org_script_assignments').select('*', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['assigned', 'in_progress', 'in_review']),
    supabase.from('org_review_notes').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('org_review_notes').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'open'),
    supabase.from('org_resources').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('org_announcements').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('org_channel_messages').select('*', { count: 'exact', head: true }).in('channel_id',
      (await supabase.from('org_channels').select('id').eq('company_id', companyId)).data?.map((c: any) => c.id) || ['00000000-0000-0000-0000-000000000000']
    ),
    supabase.from('org_pitches').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
  ]);

  return NextResponse.json({
    totalMembers: memberIds.length,
    totalProjects: projectIds.length,
    totalWords,
    totalScripts: totalScripts || 0,
    totalScenes: totalScenes || 0,
    totalCharacters: totalCharacters || 0,
    totalAssignments: totalAssignments || 0,
    openAssignments: openAssignments || 0,
    totalReviewNotes: totalReviewNotes || 0,
    openReviewNotes: openReviewNotes || 0,
    totalResources: totalResources || 0,
    totalAnnouncements: totalAnnouncements || 0,
    totalChannelMessages: totalChannelMessages || 0,
    totalPitches: totalPitches || 0,
  });
}
