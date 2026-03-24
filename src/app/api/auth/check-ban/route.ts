import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

// Check if an IP is banned before allowing signup
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') || 'unknown';

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
