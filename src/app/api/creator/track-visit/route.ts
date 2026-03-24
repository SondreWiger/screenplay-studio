import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { ref_code } = await req.json();
    if (!ref_code) return NextResponse.json({ error: 'missing ref_code' }, { status: 400 });

    const supabase = createServerSupabaseClient();

    // Find the approved creator by ref_code
    const { data: creator } = await supabase
      .from('creator_profiles')
      .select('id')
      .eq('ref_code', ref_code)
      .eq('status', 'approved')
      .single();

    if (!creator) return NextResponse.json({ error: 'creator not found' }, { status: 404 });

    // Get rough country from CF header (Vercel passes this)
    const country = req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry') ?? null;
    const referrer = req.headers.get('referer') ?? null;

    await supabase.from('creator_referral_events').insert({
      creator_id: creator.id,
      event_type: 'visit',
      referrer,
      country,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
