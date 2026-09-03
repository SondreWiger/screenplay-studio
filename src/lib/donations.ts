import type { createAdminSupabaseClient } from '@/lib/supabase/admin';

const DONATION_PRO_MONTHS = 2;

export async function grantProFromDonation(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  kofiTransactionId: string,
  amountUsd: number
) {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + DONATION_PRO_MONTHS);

  await admin.from('subscriptions').insert({
    user_id: userId,
    plan: 'pro',
    status: 'active',
    billing_cycle: 'donation',
    price_cents: Math.round(amountUsd * 100),
    payment_method: 'kofi',
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    metadata: { kofi_transaction_id: kofiTransactionId },
  });

  await admin
    .from('profiles')
    .update({ is_pro: true, pro_since: now.toISOString() })
    .eq('id', userId);
}
