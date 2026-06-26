import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || process.env.ADMIN_UID || '';
const DAY = 24 * 60 * 60 * 1000;

interface TrendBucket {
  date: string;
  count: number;
}

export async function GET() {
  const userClient = createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.id !== ADMIN_UID) {
    const { data: profile } = await userClient.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date();

  const bucketByDay = (rows: { created_at: string }[], days: number): TrendBucket[] => {
    const map: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map[d.toISOString().slice(0, 10)] = 0;
    }
    for (const r of rows) {
      const day = r.created_at.slice(0, 10);
      if (day in map) map[day] = (map[day] || 0) + 1;
    }
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  };

  const bucketByWeek = (rows: { created_at: string }[], weeks: number): TrendBucket[] => {
    const map: Record<string, number> = {};
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const start = new Date(d);
      start.setDate(start.getDate() - start.getDay());
      map[start.toISOString().slice(0, 10)] = 0;
    }
    for (const r of rows) {
      const d = new Date(r.created_at);
      const start = new Date(d);
      start.setDate(start.getDate() - start.getDay());
      const key = start.toISOString().slice(0, 10);
      if (key in map) map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  };

  const bucketByHour = (rows: { created_at: string }[]): { hour: number; count: number }[] => {
    const map: Record<number, number> = {};
    for (let h = 0; h < 24; h++) map[h] = 0;
    for (const r of rows) {
      const h = new Date(r.created_at).getHours();
      map[h] = (map[h] || 0) + 1;
    }
    return Object.entries(map).map(([hour, count]) => ({ hour: Number(hour), count }));
  };

  const computeGrowth = (current: number, previous: number): number | null => {
    if (previous === 0) return current > 0 ? 100 : null;
    return Math.round(((current - previous) / previous) * 100);
  };

  try {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY).toISOString();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY).toISOString();
    const prevPeriodStart = new Date(now.getTime() - 60 * DAY).toISOString();
    const prevPeriodEnd = new Date(now.getTime() - 30 * DAY).toISOString();

    const [
      totalRes, activeRes, proRes, signups30, signups90, projects30, projects90,
      elementsRes, scenesRes, charsRes, scriptsRes,
      activityRes, activity7d,
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).or(`last_seen.gte.${new Date(now.getTime() - 5 * 60 * 1000).toISOString()},updated_at.gte.${new Date(now.getTime() - 5 * 60 * 1000).toISOString()}`),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_pro', true),
      supabase.from('profiles').select('created_at').gte('created_at', thirtyDaysAgo),
      supabase.from('profiles').select('created_at').gte('created_at', ninetyDaysAgo),
      supabase.from('projects').select('created_at').gte('created_at', thirtyDaysAgo),
      supabase.from('projects').select('created_at').gte('created_at', ninetyDaysAgo),
      supabase.from('script_elements').select('id', { count: 'exact', head: true }),
      supabase.from('scenes').select('id', { count: 'exact', head: true }),
      supabase.from('characters').select('id', { count: 'exact', head: true }),
      supabase.from('scripts').select('script_type'),
      supabase.from('profiles').select('created_at').gte('created_at', thirtyDaysAgo),
      supabase.from('profiles').select('created_at').gte('created_at', sevenDaysAgo),
    ]);

    const totalUsers = totalRes.count || 0;
    const totalWeeks = 12;

    const [
      weeklySignupsRaw,
      weeklyProjectsRaw,
      projectsAllRes,
    ] = await Promise.all([
      supabase.from('profiles').select('created_at').gte('created_at', new Date(now.getTime() - totalWeeks * 7 * DAY).toISOString()),
      supabase.from('projects').select('created_at').gte('created_at', new Date(now.getTime() - totalWeeks * 7 * DAY).toISOString()),
      supabase.from('projects').select('project_type'),
    ]);

    const weeklySignups = bucketByWeek(weeklySignupsRaw.data || [], totalWeeks);
    const weeklyProjects = bucketByWeek(weeklyProjectsRaw.data || [], totalWeeks);

    const prevSignups = (signups90.data || []).filter(r => r.created_at >= prevPeriodStart && r.created_at < prevPeriodEnd);
    const prevProjects = (projects90.data || []).filter(r => r.created_at >= prevPeriodStart && r.created_at < prevPeriodEnd);

    const signupGrowth = computeGrowth(
      (signups30.data || []).length,
      prevSignups.length,
    );
    const projectGrowth = computeGrowth(
      (projects30.data || []).length,
      prevProjects.length,
    );

    const hourlySignups = bucketByHour(signups30.data || []);

    const groupBy = (rows: any[], key: string) => {
      const map: Record<string, number> = {};
      for (const r of rows) {
        const v = r[key] || 'unknown';
        map[v] = (map[v] || 0) + 1;
      }
      return Object.entries(map).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
    };

    return NextResponse.json({
      totals: {
        users: totalUsers,
        activeUsers: activeRes.count || 0,
        proUsers: proRes.count || 0,
        elements: elementsRes.count || 0,
        scenes: scenesRes.count || 0,
        characters: charsRes.count || 0,
        scripts: scriptsRes.count || 0,
      },
      trends: {
        signups30Day: bucketByDay(signups30.data || [], 30),
        projects30Day: bucketByDay(projects30.data || [], 30),
        signups90Day: bucketByDay(signups90.data || [], 90),
        projects90Day: bucketByDay(projects90.data || [], 90),
        weeklySignups,
        weeklyProjects,
        hourlySignupPattern: hourlySignups,
      },
      growth: {
        signups30Day: signups30.data?.length || 0,
        signupsPrev30Day: prevSignups.length,
        signupGrowth,
        projects30Day: projects30.data?.length || 0,
        projectsPrev30Day: prevProjects.length,
        projectGrowth,
        proRate: totalUsers > 0 ? ((proRes.count || 0) / totalUsers * 100).toFixed(1) : '0',
      },
      breakdowns: {
        scriptTypes: groupBy(scriptsRes.data || [], 'script_type'),
        projectTypes: groupBy(projectsAllRes.data || [], 'project_type'),
      },
      activity: {
        last7Days: bucketByDay(activity7d.data || [], 7),
        last30Days: bucketByDay(activityRes.data || [], 30),
      },
    });
  } catch (error) {
    logger.error('[api]', 'Error fetching comprehensive stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
