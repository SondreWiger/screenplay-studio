import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/themes/[id]/use
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Public, unauthenticated counter: limit how fast one client can bump it
  const limit = checkRateLimit(`theme-use:${getClientIp(_req)}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  // Use raw RPC for atomic increment
  const { error } = await supabase.rpc('increment_theme_use_count', { p_theme_id: id });

  if (error) {
    // Fallback: direct update
    const { data } = await supabase
      .from('themes')
      .select('use_count')
      .eq('id', id)
      .single();

    if (data) {
      await supabase
        .from('themes')
        .update({ use_count: (data.use_count || 0) + 1 })
        .eq('id', id);
    }
  }

  return NextResponse.json({ ok: true });
}
