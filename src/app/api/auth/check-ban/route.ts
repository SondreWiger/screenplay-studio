import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// Check if an IP is banned before allowing signup
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateResult = checkRateLimit(`check-ban:${ip}`, 20, 60_000);
  if (!rateResult.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: ipBan } = await supabase
    .from('banned_ips')
    .select('id, reason')
    .eq('ip_address', ip)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (ipBan) {
    return NextResponse.json({
      banned: true,
      message: 'Nice try. This IP address has been banned from Screenplay Studio. Creating new accounts will not bypass this restriction. If you believe this is an error, email sondre@northem.no.',
    }, { status: 403 });
  }

  return NextResponse.json({ banned: false });
}
