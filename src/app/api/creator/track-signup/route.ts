import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const serviceSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function POST(req: NextRequest) {
  try {
    const { ref_code, new_user_id } = await req.json();
    if (!ref_code || !new_user_id) {
      return NextResponse.json({ error: 'missing params' }, { status: 400 });
    }

    const supabase = serviceSupabase();

    // Don't track if creator_program_enabled is false
    const { data: setting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'creator_program_enabled')
      .single();

    if (setting?.value !== 'true') {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Find creator
    const { data: creator } = await supabase
      .from('creator_profiles')
      .select('id, user_id')
      .eq('ref_code', ref_code)
      .eq('status', 'approved')
      .single();

    if (!creator) return NextResponse.json({ error: 'creator not found' }, { status: 404 });

    // Don't let creators refer themselves
    if (creator.user_id === new_user_id) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Upsert signup event (unique index prevents double count)
    await supabase.from('creator_referral_events').upsert({
      creator_id: creator.id,
      event_type: 'signup',
      converted_user_id: new_user_id,
    }, { onConflict: 'converted_user_id' });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
