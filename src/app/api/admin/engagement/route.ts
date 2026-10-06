import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { rejectUnlessAdmin } from '@/lib/require-admin';
import { scoreEngagement, type EngagementResult } from '@/lib/engagement';

const DAY = 86_400_000;
/** How far before the window we look to tell "dormant" from "never started". */
const LOOKBACK_DAYS = 180;
/** Safety cap per table so one request can't run away on a huge database. */
const MAX_ROWS = 100_000;
const PAGE = 1000;

/** Content people write, and which column names who touched each row last. */
const CONTENT_TABLES: { table: string; editor: string[] }[] = [
  { table: 'script_elements', editor: ['last_edited_by', 'created_by'] },
  { table: 'project_documents', editor: ['last_edited_by', 'created_by'] },
  { table: 'scenes', editor: ['created_by'] },
  { table: 'characters', editor: ['created_by'] },
  { table: 'shots', editor: ['created_by'] },
  { table: 'ideas', editor: ['created_by'] },
];

type Db = ReturnType<typeof createAdminSupabaseClient>;
type Row = Record<string, unknown>;

/** Page through a query; PostgREST returns at most 1000 rows per request. */
async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>) {
  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export interface EngagementUser extends EngagementResult {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  is_pro: boolean;
  joined_at: string;
  last_active_at: string | null;
  perks: { count: number; last_at: string | null; last_perk: string | null };
}

// GET /api/admin/engagement?days=30
export async function GET(req: NextRequest) {
  const { data: { user } } = await createServerSupabaseClient().auth.getUser();
  const denied = await rejectUnlessAdmin(user?.id);
  if (denied) return denied;

  const days = Math.min(180, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || 30));
  const now = Date.now();
  const windowStart = new Date(now - days * DAY);
  const lookbackStart = new Date(windowStart.getTime() - LOOKBACK_DAYS * DAY);
  const windowDate = windowStart.toISOString().slice(0, 10);

  let db: Db;
  try {
    db = createAdminSupabaseClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Service role not configured' }, { status: 500 });
  }

  try {
    let truncated = false;

    const [profiles, sessions, perks] = await Promise.all([
      fetchAll((a, b) => db.from('profiles')
        .select('id, display_name, full_name, username, avatar_url, created_at, last_seen, is_pro, role, moderation_status')
        .order('created_at', { ascending: true }).range(a, b)),
      fetchAll((a, b) => db.from('work_sessions')
        .select('user_id, project_id, date, duration_seconds')
        .gte('date', lookbackStart.toISOString().slice(0, 10))
        .order('date', { ascending: true }).range(a, b)),
      fetchAll((a, b) => db.from('user_perks')
        .select('user_id, perk, created_at')
        .order('created_at', { ascending: false }).range(a, b))
        // The perks table is new; a database without it still gets a report
        .then((r) => r, () => ({ rows: [] as Row[], truncated: false })),
    ]);
    truncated ||= profiles.truncated || sessions.truncated;

    // Work time per user: by day inside the window, total before it
    const workByDay = new Map<string, Record<string, number>>();
    const priorWork = new Map<string, number>();
    const projects = new Map<string, Set<string>>();
    const lastWork = new Map<string, string>();
    for (const s of sessions.rows) {
      const uid = s.user_id as string;
      const date = s.date as string;
      const secs = Number(s.duration_seconds) || 0;
      if (secs <= 0) continue;
      if (date >= windowDate) {
        const byDay = workByDay.get(uid) ?? {};
        byDay[date] = (byDay[date] ?? 0) + secs;
        workByDay.set(uid, byDay);
        (projects.get(uid) ?? projects.set(uid, new Set()).get(uid)!).add(s.project_id as string);
      } else {
        priorWork.set(uid, (priorWork.get(uid) ?? 0) + secs);
      }
      if (!lastWork.has(uid) || date > lastWork.get(uid)!) lastWork.set(uid, date);
    }

    // Content edits per user, inside the window and in the lookback before it
    const edits = new Map<string, number>();
    const priorEdits = new Map<string, number>();
    const lastEdit = new Map<string, string>();
    const contentResults = await Promise.all(CONTENT_TABLES.map(({ table, editor }) =>
      fetchAll((a, b) => db.from(table)
        .select([...editor, 'updated_at'].join(', '))
        .gte('updated_at', lookbackStart.toISOString())
        .order('updated_at', { ascending: true }).range(a, b) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>)
        // A table missing on this database just doesn't contribute
        .then((r) => ({ ...r, editor }), (err) => {
          logger.warn('[engagement]', `skipping ${table}: ${err instanceof Error ? err.message : err}`);
          return { rows: [] as Row[], truncated: false, editor };
        })));
    for (const { rows, truncated: t, editor } of contentResults) {
      truncated ||= t;
      for (const r of rows) {
        const uid = editor.map((c) => r[c] as string | null).find(Boolean);
        if (!uid) continue;
        const at = r.updated_at as string;
        if (at >= windowStart.toISOString()) {
          edits.set(uid, (edits.get(uid) ?? 0) + 1);
          if (!lastEdit.has(uid) || at > lastEdit.get(uid)!) lastEdit.set(uid, at);
        } else {
          priorEdits.set(uid, (priorEdits.get(uid) ?? 0) + 1);
        }
      }
    }

    const perksByUser = new Map<string, { count: number; last_at: string | null; last_perk: string | null }>();
    for (const p of perks.rows) {
      const uid = p.user_id as string;
      const cur = perksByUser.get(uid);
      // Rows arrive newest first
      if (cur) cur.count++;
      else perksByUser.set(uid, { count: 1, last_at: p.created_at as string, last_perk: p.perk as string });
    }

    const users: EngagementUser[] = [];
    for (const p of profiles.rows) {
      if (p.moderation_status === 'banned' || p.moderation_status === 'suspended') continue;
      const id = p.id as string;
      // Last real activity: work or edits. A visit (last_seen) only counts
      // when there's nothing else, and never earns points on its own.
      const candidates = [lastWork.get(id) && `${lastWork.get(id)}T12:00:00Z`, lastEdit.get(id), p.last_seen as string | null].filter(Boolean) as string[];
      const lastActiveAt = candidates.length ? candidates.sort().at(-1)! : null;
      const result = scoreEngagement({
        workByDay: workByDay.get(id) ?? {},
        projects: projects.get(id)?.size ?? 0,
        contentEdits: edits.get(id) ?? 0,
        priorWorkSeconds: priorWork.get(id) ?? 0,
        priorContentEdits: priorEdits.get(id) ?? 0,
        lastActiveAt,
      }, days, new Date(now));
      users.push({
        ...result,
        id,
        name: (p.display_name as string) || (p.full_name as string) || (p.username as string) || 'Unnamed',
        username: (p.username as string) ?? null,
        avatar_url: (p.avatar_url as string) ?? null,
        role: (p.role as string) ?? null,
        is_pro: p.is_pro === true,
        joined_at: p.created_at as string,
        last_active_at: lastActiveAt,
        perks: perksByUser.get(id) ?? { count: 0, last_at: null, last_perk: null },
      });
    }
    users.sort((a, b) => b.score - a.score);

    const tiers = { committed: 0, active: 0, trying: 0, dormant: 0, never: 0 };
    for (const u of users) tiers[u.tier]++;

    // Daily count of people with an active day, for the trend chart
    const dailyActive: Record<string, number> = {};
    workByDay.forEach((byDay) => {
      for (const [date, secs] of Object.entries(byDay)) if (secs >= 300) dailyActive[date] = (dailyActive[date] ?? 0) + 1;
    });

    return NextResponse.json({
      windowDays: days,
      generatedAt: new Date(now).toISOString(),
      truncated,
      tiers,
      dailyActive,
      users,
    });
  } catch (err) {
    logger.error('[api]', 'engagement report failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to build engagement report' }, { status: 500 });
  }
}
