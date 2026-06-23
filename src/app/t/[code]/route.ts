import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /t/[code] — redirect short URL to theme page
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const { data, error } = await supabase
    .from('theme_short_urls')
    .select('theme_id')
    .eq('code', code)
    .single();

  if (error || !data) {
    return NextResponse.redirect(new URL('/colors', _req.url));
  }

  return NextResponse.redirect(new URL(`/colors/${data.theme_id}`, _req.url));
}
