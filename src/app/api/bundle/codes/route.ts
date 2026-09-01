import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { BUNDLE_APPS, coverUntil, ensureBundleCodes } from '@/lib/bundle';

/**
 * The subscriber's own bundle codes, minted on first look.
 *
 * Issuing lazily is what makes this retroactive: everyone who was already
 * Pro before the bundle existed, including accounts an admin toggled by
 * hand, gets their codes the first time they open the billing page. There
 * is no backfill job to run and nothing to remember to trigger.
 *
 * Pro is checked here on the server against the profile, never against
 * anything the client sent, because this endpoint mints entitlement for
 * two other products.
 */
export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminSupabaseClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('is_pro')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_pro) {
    return NextResponse.json({ pro: false, codes: [] });
  }

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('current_period_end')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  const issued = await ensureBundleCodes(user.id, coverUntil(subscription));
  if (!issued.ok) return NextResponse.json({ error: issued.error }, { status: 500 });

  return NextResponse.json({
    pro: true,
    codes: issued.codes.map((entry) => ({ ...entry, app: BUNDLE_APPS[entry.product] })),
  });
}
