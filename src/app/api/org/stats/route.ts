import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

  // Auth: must be a member of this company
  const userClient = createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminSupabaseClient();

  // Verify membership
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Gather org-wide stats in parallel
  const [
    membersRes,
    projectsRes,
    scriptsRes,
    assignmentsRes,
    reviewNotesRes,
    pitchesRes,
    resourcesRes,
    calendarRes,
    channelsRes,
    announcementsRes,
  ] = await Promise.all([
    supabase.from('company_members').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('scripts').select('id').in('project_id',
      (await supabase.from('projects').select('id').eq('company_id', companyId)).data?.map((p: any) => p.id) || []
    ),
    supabase.from('org_script_assignments').select('status').eq('company_id', companyId),
    supabase.from('org_review_notes').select('status').eq('company_id', companyId),
    supabase.from('org_pitches').select('status').eq('company_id', companyId),
    supabase.from('org_resources').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('org_calendar_events').select('id, start_at').eq('company_id', companyId)
      .gte('start_at', new Date().toISOString()).order('start_at').limit(5),
    supabase.from('org_channels').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('org_announcements').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
  ]);

  // Word count for org projects
  const projectIds = (await supabase.from('projects').select('id').eq('company_id', companyId)).data?.map((p: any) => p.id) || [];
  let totalWords = 0;
  if (projectIds.length > 0) {
    const scriptIds = (scriptsRes.data || []).map((s: any) => s.id);
    if (scriptIds.length > 0) {
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from('script_elements')
          .select('content')
          .in('script_id', scriptIds)
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        for (const el of data) {
          const t = (el.content || '').trim();
          if (t) totalWords += t.split(/\s+/).length;
        }
        if (data.length < 1000) break;
        from += 1000;
      }
    }
  }

  // Assignment breakdowns
  const assignments = assignmentsRes.data || [];
  const assignmentsByStatus: Record<string, number> = {};
  for (const a of assignments) {
    assignmentsByStatus[a.status] = (assignmentsByStatus[a.status] || 0) + 1;
  }

  // Review notes breakdown
  const notes = reviewNotesRes.data || [];
  const openNotes = notes.filter((n: any) => n.status === 'open').length;
  const resolvedNotes = notes.filter((n: any) => n.status === 'resolved').length;

  // Pitch status breakdown
  const pitches = pitchesRes.data || [];
  const pitchesByStatus: Record<string, number> = {};
  for (const p of pitches) {
    pitchesByStatus[p.status] = (pitchesByStatus[p.status] || 0) + 1;
  }

  return NextResponse.json({
    members: membersRes.count || 0,
    projects: projectsRes.count || 0,
    scripts: (scriptsRes.data || []).length,
    totalWords,
    channels: channelsRes.count || 0,
    announcements: announcementsRes.count || 0,
    resources: resourcesRes.count || 0,
    assignments: {
      total: assignments.length,
      byStatus: assignmentsByStatus,
    },
    reviewNotes: {
      total: notes.length,
      open: openNotes,
      resolved: resolvedNotes,
    },
    pitches: {
      total: pitches.length,
      byStatus: pitchesByStatus,
    },
    upcomingEvents: calendarRes.data || [],
  });
}
