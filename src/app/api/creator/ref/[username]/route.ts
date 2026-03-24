import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS so the public ref page can always
// read an approved creator's profile even for unauthenticated visitors.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = getServiceClient();

  const { data: creator, error } = await supabase
    .from('creator_profiles')
    .select(`
      ref_code,
      social_instagram,
      social_twitter,
      social_tiktok,
      social_youtube,
      user_id
    `)
    .eq('ref_code', params.username)
    .eq('status', 'approved')
    .single();

  if (error || !creator) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Fetch public profile fields separately (avoids join RLS issues)
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, full_name, avatar_url, username')
    .eq('id', creator.user_id)
    .single();

  return NextResponse.json({
    ref_code: creator.ref_code,
    social_instagram: creator.social_instagram,
    social_twitter: creator.social_twitter,
    social_tiktok: creator.social_tiktok,
    social_youtube: creator.social_youtube,
    profile: profile ?? null,
  });
}
