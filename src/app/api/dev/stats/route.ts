import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

async function requireAdmin() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (user.id === ADMIN_UID) return user;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role === 'admin' || profile?.role === 'moderator') return user;
  return null;
}

// ── Count LOC recursively in a directory ─────────────────────
async function countCodeStats(dir: string, exts: string[]): Promise<{ files: number; lines: number; bytes: number }> {
  let files = 0, lines = 0, bytes = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    await Promise.all(entries.map(async (e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['node_modules', '.next', '.git', 'dist', 'build', 'out'].includes(e.name)) return;
        const sub = await countCodeStats(full, exts);
        files += sub.files;
        lines += sub.lines;
        bytes += sub.bytes;
      } else if (exts.some(ext => e.name.endsWith(ext))) {
        files++;
        const info = await stat(full);
        bytes += info.size;
        const content = await readFile(full, 'utf8');
        lines += content.split('\n').length;
      }
    }));
  } catch { /* ignore unreadable dirs */ }
  return { files, lines, bytes };
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createServerSupabaseClient();

  // ── DB queries in parallel ─────────────────────────────────
  const [
    { count: totalUsers },
    { count: proUsers },
    { count: totalProjects },
    { count: totalScripts },
    { count: totalWords },
    { count: totalCharacters },
    { count: totalLocations },
    { count: totalScenes },
    { count: totalShots },
    { count: totalIdeas },
    { count: totalDocuments },
    { count: totalComments },
    { count: totalBlogPosts },
    { count: totalCommunityPosts },
    { count: totalBudgetItems },
    { count: totalScheduleEvents },
    { count: totalTickets },
    { count: openTickets },
    { count: pushSubscriptions },
    { data: signupsByDay },
    { data: scriptTypeBreakdown },
    { data: projectTypeBreakdown },
    { data: siteVersionRow },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_pro', true),
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('scripts').select('*', { count: 'exact', head: true }),
    supabase.from('scripts').select('word_count').limit(50000).then((r) => ({ count: (r.data ?? []).reduce((s: number, row: any) => s + (row.word_count ?? 0), 0), error: null })),
    supabase.from('characters').select('*', { count: 'exact', head: true }),
    supabase.from('locations').select('*', { count: 'exact', head: true }),
    supabase.from('scenes').select('*', { count: 'exact', head: true }),
    supabase.from('shots').select('*', { count: 'exact', head: true }),
    supabase.from('ideas').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('comments').select('*', { count: 'exact', head: true }),
    supabase.from('blog_posts').select('*', { count: 'exact', head: true }),
    supabase.from('community_posts').select('*', { count: 'exact', head: true }),
    supabase.from('budget_items').select('*', { count: 'exact', head: true }),
    supabase.from('schedule_events').select('*', { count: 'exact', head: true }),
    supabase.from('support_tickets').select('*', { count: 'exact', head: true }),
    supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('push_subscriptions').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('created_at').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('created_at'),
    supabase.from('scripts').select('script_type, id').limit(2000),
    supabase.from('projects').select('project_type, id').limit(2000),
    supabase.from('site_settings').select('value').eq('key', 'site_version').single(),
  ]);

  // Group signups by day
  const signupMap: Record<string, number> = {};
  (signupsByDay ?? []).forEach((r: any) => {
    const d = r.created_at?.slice(0, 10) ?? '';
    signupMap[d] = (signupMap[d] ?? 0) + 1;
  });
  const signupTrend = Object.entries(signupMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

  // Script type breakdown
  const stMap: Record<string, number> = {};
  (scriptTypeBreakdown ?? []).forEach((r: any) => { const t = r.script_type || 'unknown'; stMap[t] = (stMap[t] ?? 0) + 1; });
  const stBreakdown = Object.entries(stMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

  // Project type breakdown
  const ptMap: Record<string, number> = {};
  (projectTypeBreakdown ?? []).forEach((r: any) => { const t = r.project_type || 'unknown'; ptMap[t] = (ptMap[t] ?? 0) + 1; });
  const ptBreakdown = Object.entries(ptMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

  // ── Codebase stats ─────────────────────────────────────────
  const srcDir = path.join(process.cwd(), 'src');
  const codeStats = await countCodeStats(srcDir, ['.ts', '.tsx', '.js', '.jsx', '.css', '.sql']);
  const jsStats = await countCodeStats(srcDir, ['.ts', '.tsx', '.js', '.jsx']);
  const sqlFiles = await countCodeStats(path.join(process.cwd(), 'supabase'), ['.sql']);

  return NextResponse.json({
    db: {
      totalUsers: totalUsers ?? 0,
      proUsers: proUsers ?? 0,
      totalProjects: totalProjects ?? 0,
      totalScripts: totalScripts ?? 0,
      totalWords: totalWords ?? 0,
      totalCharacters: totalCharacters ?? 0,
      totalLocations: totalLocations ?? 0,
      totalScenes: totalScenes ?? 0,
      totalShots: totalShots ?? 0,
      totalIdeas: totalIdeas ?? 0,
      totalDocuments: totalDocuments ?? 0,
      totalComments: totalComments ?? 0,
      totalBlogPosts: totalBlogPosts ?? 0,
      totalCommunityPosts: totalCommunityPosts ?? 0,
      totalBudgetItems: totalBudgetItems ?? 0,
      totalScheduleEvents: totalScheduleEvents ?? 0,
      totalTickets: totalTickets ?? 0,
      openTickets: openTickets ?? 0,
      pushSubscriptions: pushSubscriptions ?? 0,
      signupTrend,
      scriptTypeBreakdown: stBreakdown,
      projectTypeBreakdown: ptBreakdown,
    },
    codebase: {
      totalFiles: codeStats.files,
      totalLines: codeStats.lines,
      totalBytes: codeStats.bytes,
      codeFiles: jsStats.files,
      codeLines: jsStats.lines,
      sqlFiles: sqlFiles.files,
      sqlLines: sqlFiles.lines,
    },
    meta: {
      siteVersion: siteVersionRow?.value ?? 'unknown',
      generatedAt: new Date().toISOString(),
    },
  });
}
