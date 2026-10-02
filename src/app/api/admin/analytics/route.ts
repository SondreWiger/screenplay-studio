import logger from '@/lib/logger';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { rejectUnlessAdmin } from '@/lib/require-admin';
import {
  bucketIndex, bucketize, bucketizePrevious, countBy, isRangeKey, resolveRange, weekdayHourGrid,
  type RangeKey, type ResolvedRange,
} from '@/lib/admin/analytics';
import type { AnalyticsResponse, SeriesKey } from '@/lib/admin/analytics-types';

export const dynamic = 'force-dynamic';

const PAGE = 1000;
/** Per-table row cap for range scans; beyond this the series is marked truncated. */
const MAX_ROWS = 60_000;
const CACHE_TTL_MS = 60_000;

const cache = new Map<RangeKey, { at: number; data: AnalyticsResponse }>();

type Row = Record<string, unknown>;

/**
 * Page through every row where `timeCol >= since`. A missing table or column
 * yields [] instead of failing the whole dashboard.
 */
async function scan(
  db: SupabaseClient, table: string, columns: string, timeCol: string, since: string,
  truncated: string[], extra?: (q: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    let q = db.from(table).select(columns).gte(timeCol, since);
    if (extra) q = extra(q);
    const { data, error } = await q.order(timeCol, { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) {
      logger.warn('[admin-analytics]', `scan ${table} failed: ${error.message}`);
      return rows;
    }
    rows.push(...((data || []) as unknown as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
  truncated.push(table);
  return rows;
}

/** Page through a whole table (small columns only). */
async function scanAll(db: SupabaseClient, table: string, columns: string, truncated: string[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS * 2; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) {
      logger.warn('[admin-analytics]', `scanAll ${table} failed: ${error.message}`);
      return rows;
    }
    rows.push(...((data || []) as unknown as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
  truncated.push(table);
  return rows;
}

async function headCount(db: SupabaseClient, table: string, filter?: (q: any) => any): Promise<number> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = db.from(table).select('id', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) return 0;
  return count || 0;
}

const iso = (ms: number) => new Date(ms).toISOString();
const str = (v: unknown) => (typeof v === 'string' ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

async function compute(rangeKey: RangeKey): Promise<AnalyticsResponse> {
  const db = createAdminSupabaseClient();
  const now = Date.now();
  const truncated: string[] = [];

  // The all-time range is anchored on the first signup
  let earliest: number | null = null;
  if (rangeKey === 'all') {
    const { data } = await db.from('profiles').select('created_at').order('created_at', { ascending: true }).limit(1);
    earliest = data?.[0]?.created_at ? Date.parse(data[0].created_at) : null;
  }
  const range: ResolvedRange = resolveRange(rangeKey, now, earliest);
  const scanFrom = iso(range.prevStart ?? range.buckets[0]);
  const startIso = iso(range.start);
  const prevIso = range.prevStart != null ? iso(range.prevStart) : null;

  const ago = (ms: number) => iso(now - ms);
  const lastSeen = (ms: number) => (q: any) => q.gte('last_seen', ago(ms)); // eslint-disable-line @typescript-eslint/no-explicit-any

  const [
    // Range scans
    signups, projects, scripts, logins, work, cPosts, cComments, sComments, tickets, feedback, xp, proUpgrades,
    // Whole-table breakdown columns
    allProfiles, allProjects,
    // Live / engagement
    live5, live15, live60, dau, wau, mau, activeInRange,
    // Totals
    tUsers, tProjects, tScripts, tElements, tCharacters, tLocations, tScenes, tShots, tIdeas, tBudget, tSchedule,
    tScriptComments, tCommunityPosts, tPro, tPush, tMembers, tMindmap, tIdeaBoards, tOpenTickets, tTickets, tBlog,
    tContributors, tEnrollments, tBadgesAwarded,
    // Period counts for big tables (no series)
    elementsCur, elementsPrev, scenesCur, scenesPrev, charsCur, charsPrev,
    earlierUsers,
  ] = await Promise.all([
    scan(db, 'profiles', 'id, created_at, is_pro', 'created_at', scanFrom, truncated),
    scan(db, 'projects', 'id, created_at, created_by', 'created_at', scanFrom, truncated),
    scan(db, 'scripts', 'id, created_at', 'created_at', scanFrom, truncated),
    scan(db, 'login_history', 'id, user_id, login_at, method, country', 'login_at', scanFrom, truncated, (q) => q.eq('success', true)),
    scan(db, 'work_sessions', 'id, user_id, project_id, context, duration_seconds, created_at', 'created_at', scanFrom, truncated),
    scan(db, 'community_posts', 'id, created_at', 'created_at', scanFrom, truncated),
    scan(db, 'community_comments', 'id, created_at', 'created_at', scanFrom, truncated),
    scan(db, 'comments', 'id, created_at', 'created_at', scanFrom, truncated),
    scan(db, 'support_tickets', 'id, created_at, category, status', 'created_at', scanFrom, truncated),
    scan(db, 'feedback_items', 'id, created_at, type', 'created_at', scanFrom, truncated),
    scan(db, 'xp_events', 'id, created_at, xp_awarded, event_type', 'created_at', scanFrom, truncated),
    scan(db, 'profiles', 'id, pro_since', 'pro_since', scanFrom, truncated),
    scanAll(db, 'profiles', 'id, country', truncated),
    scanAll(db, 'projects', 'id, project_type, script_type, format', truncated),
    headCount(db, 'profiles', lastSeen(5 * 60_000)),
    headCount(db, 'profiles', lastSeen(15 * 60_000)),
    headCount(db, 'profiles', lastSeen(60 * 60_000)),
    headCount(db, 'profiles', lastSeen(24 * 3600_000)),
    headCount(db, 'profiles', lastSeen(7 * 24 * 3600_000)),
    headCount(db, 'profiles', lastSeen(30 * 24 * 3600_000)),
    headCount(db, 'profiles', (q) => q.gte('last_seen', startIso)),
    headCount(db, 'profiles'),
    headCount(db, 'projects'),
    headCount(db, 'scripts'),
    headCount(db, 'script_elements'),
    headCount(db, 'characters'),
    headCount(db, 'locations'),
    headCount(db, 'scenes'),
    headCount(db, 'shots'),
    headCount(db, 'ideas'),
    headCount(db, 'budget_items'),
    headCount(db, 'production_schedule'),
    headCount(db, 'comments'),
    headCount(db, 'community_posts'),
    headCount(db, 'profiles', (q) => q.eq('is_pro', true)),
    headCount(db, 'push_subscriptions'),
    headCount(db, 'project_members'),
    headCount(db, 'mindmap_nodes'),
    headCount(db, 'idea_boards'),
    headCount(db, 'support_tickets', (q) => q.in('status', ['open', 'in_progress'])),
    headCount(db, 'support_tickets'),
    headCount(db, 'blog_posts'),
    headCount(db, 'contributors'),
    headCount(db, 'course_enrollments'),
    headCount(db, 'user_badges'),
    headCount(db, 'script_elements', (q) => q.gte('created_at', startIso)),
    prevIso ? headCount(db, 'script_elements', (q) => q.gte('created_at', prevIso).lt('created_at', startIso)) : Promise.resolve(null),
    headCount(db, 'scenes', (q) => q.gte('created_at', startIso)),
    prevIso ? headCount(db, 'scenes', (q) => q.gte('created_at', prevIso).lt('created_at', startIso)) : Promise.resolve(null),
    headCount(db, 'characters', (q) => q.gte('created_at', startIso)),
    prevIso ? headCount(db, 'characters', (q) => q.gte('created_at', prevIso).lt('created_at', startIso)) : Promise.resolve(null),
    headCount(db, 'profiles', (q) => q.lt('created_at', iso(range.buckets[0]))),
  ]);

  const inRange = (t: unknown) => typeof t === 'string' && Date.parse(t) >= range.start;
  const inPrev = (t: unknown) => range.prevStart != null && typeof t === 'string' && Date.parse(t) >= range.prevStart && Date.parse(t) < range.start;

  // Series: [rows, time column, optional value]
  const defs: Record<Exclude<SeriesKey, 'activeWriters'>, [Row[], string, ((r: Row) => number)?]> = {
    signups: [signups, 'created_at'],
    projects: [projects, 'created_at'],
    scripts: [scripts, 'created_at'],
    logins: [logins, 'login_at'],
    writingSeconds: [work, 'created_at', (r) => num(r.duration_seconds)],
    communityPosts: [cPosts, 'created_at'],
    communityComments: [cComments, 'created_at'],
    scriptComments: [sComments, 'created_at'],
    tickets: [tickets, 'created_at'],
    feedback: [feedback, 'created_at'],
    xp: [xp, 'created_at', (r) => num(r.xp_awarded)],
    proUpgrades: [proUpgrades, 'pro_since'],
  };

  const series = {} as AnalyticsResponse['series'];
  const kpis = {} as AnalyticsResponse['kpis'];
  for (const [key, [rows, col, val]] of Object.entries(defs) as [Exclude<SeriesKey, 'activeWriters'>, [Row[], string, ((r: Row) => number)?]][]) {
    const time = (r: Row) => str(r[col]);
    series[key] = {
      current: bucketize(rows, range.buckets, time, val),
      previous: bucketizePrevious(rows, range, time, val),
    };
    const sum = (pred: (t: unknown) => boolean) => rows.reduce((s, r) => s + (pred(r[col]) ? (val ? val(r) : 1) : 0), 0);
    kpis[key] = { current: sum(inRange), previous: range.prevStart != null ? sum(inPrev) : null };
  }

  // Distinct writers per bucket
  const distinctPerBucket = (rows: Row[], shiftPrev: boolean) => {
    const sets = range.buckets.map(() => new Set<string>());
    const shift = range.prevStart != null ? range.start - range.prevStart : 0;
    for (const r of rows) {
      const t = Date.parse(String(r.created_at));
      if (shiftPrev && !(range.prevStart != null && t >= range.prevStart && t < range.start)) continue;
      const tt = shiftPrev ? t + shift : t;
      const i = bucketIndex(range.buckets, tt);
      if (i >= 0) sets[i].add(String(r.user_id));
    }
    return sets.map((s) => s.size);
  };
  series.activeWriters = {
    current: distinctPerBucket(work, false),
    previous: range.prevStart != null ? distinctPerBucket(work, true) : null,
  };
  const distinct = (rows: Row[], pred: (t: unknown) => boolean) => new Set(rows.filter((r) => pred(r.created_at)).map((r) => String(r.user_id))).size;
  kpis.activeWriters = { current: distinct(work, inRange), previous: range.prevStart != null ? distinct(work, inPrev) : null };

  kpis.elements = { current: elementsCur, previous: elementsPrev };
  kpis.scenes = { current: scenesCur, previous: scenesPrev };
  kpis.characters = { current: charsCur, previous: charsPrev };

  // Cumulative users across the bucket span
  let running = earlierUsers;
  const cumulativeUsers = series.signups.current.map((n) => (running += n));

  // Activation funnel for users who signed up in the window
  const newUsers = signups.filter((r) => inRange(r.created_at));
  const newIds = new Set(newUsers.map((r) => String(r.id)));
  const creators = new Set(projects.filter((r) => inRange(r.created_at)).map((r) => String(r.created_by)));
  const writers = new Set(work.filter((r) => inRange(r.created_at)).map((r) => String(r.user_id)));
  const funnel = {
    signedUp: newIds.size,
    createdProject: Array.from(newIds).filter((id) => creators.has(id)).length,
    wrote: Array.from(newIds).filter((id) => writers.has(id)).length,
    pro: newUsers.filter((r) => r.is_pro === true).length,
  };

  // Leaderboards by writing time in the window
  const workInRange = work.filter((r) => inRange(r.created_at));
  const byUser = new Map<string, number>();
  const byProject = new Map<string, { seconds: number; writers: Set<string> }>();
  for (const r of workInRange) {
    const s = num(r.duration_seconds);
    byUser.set(String(r.user_id), (byUser.get(String(r.user_id)) || 0) + s);
    const p = byProject.get(String(r.project_id)) || { seconds: 0, writers: new Set<string>() };
    p.seconds += s;
    p.writers.add(String(r.user_id));
    byProject.set(String(r.project_id), p);
  }
  const topUsers = Array.from(byUser.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topProjects = Array.from(byProject.entries()).sort((a, b) => b[1].seconds - a[1].seconds).slice(0, 8);
  const [profRes, projRes] = await Promise.all([
    topUsers.length ? db.from('profiles').select('id, username, full_name, display_name, avatar_url').in('id', topUsers.map(([id]) => id)) : Promise.resolve({ data: [] }),
    topProjects.length ? db.from('projects').select('id, title').in('id', topProjects.map(([id]) => id)) : Promise.resolve({ data: [] }),
  ]);
  const profMap = new Map(((profRes.data || []) as Row[]).map((p) => [String(p.id), p]));
  const projMap = new Map(((projRes.data || []) as Row[]).map((p) => [String(p.id), p]));

  const loginsInRange = logins.filter((r) => inRange(r.login_at));
  const ticketsInRange = tickets.filter((r) => inRange(r.created_at));

  return {
    range: { key: range.key, unit: range.unit, start: range.start, end: range.end, prevStart: range.prevStart, buckets: range.buckets },
    generatedAt: new Date(now).toISOString(),
    live: { m5: live5, m15: live15, h1: live60, dau, wau, mau },
    activeInRange,
    totals: {
      users: tUsers, projects: tProjects, scripts: tScripts, elements: tElements, characters: tCharacters,
      locations: tLocations, scenes: tScenes, shots: tShots, ideas: tIdeas, budgetItems: tBudget,
      scheduleEvents: tSchedule, scriptComments: tScriptComments, communityPosts: tCommunityPosts,
      pro: tPro, pushSubscriptions: tPush, members: tMembers, mindmapNodes: tMindmap, ideaBoards: tIdeaBoards,
      openTickets: tOpenTickets, tickets: tTickets, blogPosts: tBlog, contributors: tContributors,
      enrollments: tEnrollments, badgesAwarded: tBadgesAwarded,
    },
    kpis,
    series,
    cumulativeUsers,
    funnel,
    heatmap: weekdayHourGrid([
      ...workInRange.map((r) => String(r.created_at)),
      ...loginsInRange.map((r) => String(r.login_at)),
    ]),
    breakdowns: {
      countries: countBy(allProfiles, (r) => str(r.country), 10),
      projectTypes: countBy(allProjects, (r) => str(r.project_type)),
      scriptTypes: countBy(allProjects, (r) => str(r.script_type)),
      formats: countBy(allProjects, (r) => str(r.format)),
      loginMethods: countBy(loginsInRange, (r) => str(r.method)),
      loginCountries: countBy(loginsInRange, (r) => str(r.country), 8),
      workContexts: countBy(workInRange, (r) => str(r.context), 8, (r) => num(r.duration_seconds)),
      ticketCategories: countBy(ticketsInRange, (r) => str(r.category)),
      ticketStatus: countBy(ticketsInRange, (r) => str(r.status)),
      feedbackTypes: countBy(feedback.filter((r) => inRange(r.created_at)), (r) => str(r.type)),
      xpEvents: countBy(xp.filter((r) => inRange(r.created_at)), (r) => str(r.event_type), 8, (r) => num(r.xp_awarded)),
    },
    leaders: {
      writers: topUsers.map(([id, seconds]) => {
        const p = profMap.get(id);
        return { id, seconds, username: str(p?.username), name: str(p?.display_name) || str(p?.full_name) || 'Unknown', avatar: str(p?.avatar_url) };
      }),
      projects: topProjects.map(([id, v]) => ({ id, seconds: v.seconds, writers: v.writers.size, title: str(projMap.get(id)?.title) || 'Untitled' })),
    },
    truncated,
  };
}

// GET /api/admin/analytics?range=30d[&fresh=1]
export async function GET(req: NextRequest) {
  const userClient = createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  const denied = await rejectUnlessAdmin(user?.id);
  if (denied) return denied;

  const param = req.nextUrl.searchParams.get('range');
  const rangeKey: RangeKey = isRangeKey(param) ? param : '30d';
  const fresh = req.nextUrl.searchParams.get('fresh') === '1';

  const hit = cache.get(rangeKey);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.data, { headers: { 'Cache-Control': 'private, no-store', 'X-Cache': 'HIT' } });
  }

  try {
    const data = await compute(rangeKey);
    cache.set(rangeKey, { at: Date.now(), data });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store', 'X-Cache': 'MISS' } });
  } catch (error) {
    logger.error('[api]', 'Error computing admin analytics:', error);
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
  }
}
