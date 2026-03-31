import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

export async function GET() {
  // Auth check: must be admin
  const userClient = createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.id !== ADMIN_UID) {
    const { data: profile } = await userClient.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();

  // script_elements.content holds the actual text — fetch all and count words
  // Paginate in batches of 1000 to avoid payload limits
  let totalWords = 0;
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from('script_elements')
      .select('content')
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const el of data) {
      const text = (el.content || '').trim();
      if (text) totalWords += text.split(/\s+/).length;
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return NextResponse.json({ totalWords });
}
