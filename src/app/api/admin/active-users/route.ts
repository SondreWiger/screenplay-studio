import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || process.env.ADMIN_UID || '';

async function requireAdmin() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (user.id !== ADMIN_UID && profile?.role !== 'admin') return null;
  return { supabase, user };
}

// GET /api/admin/active-users
export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { supabase } = ctx;

  try {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const [active5MinRes, active15MinRes, active1HourRes, recentProfilesRes, allProfilesRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).or(`last_seen.gte.${fiveMinAgo},updated_at.gte.${fiveMinAgo}`),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).or(`last_seen.gte.${fifteenMinAgo},updated_at.gte.${fifteenMinAgo}`),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).or(`last_seen.gte.${oneHourAgo},updated_at.gte.${oneHourAgo}`),
      supabase.from('profiles').select('id, last_seen, updated_at').order('last_seen', { ascending: false, nullsFirst: false }).limit(10),
      supabase.from('profiles').select('id, last_seen, updated_at').not('last_seen', 'is', null).limit(5),
    ]);

    return NextResponse.json({
      activeUsers5Min: active5MinRes.count || 0,
      activeUsers15Min: active15MinRes.count || 0,
      activeUsers1Hour: active1HourRes.count || 0,
      recentProfiles: recentProfilesRes.data || [],
      profilesWithLastSeen: allProfilesRes.data || [],
      timestamps: {
        now: now.toISOString(),
        fiveMinAgo,
        fifteenMinAgo,
        oneHourAgo,
      },
    });
  } catch (error) {
    logger.error('[api]', 'Error fetching active users:', error);
    return NextResponse.json({ error: 'Failed to fetch active users' }, { status: 500 });
  }
}