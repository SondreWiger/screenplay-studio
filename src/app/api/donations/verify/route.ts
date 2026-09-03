import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { grantProFromDonation } from '@/lib/donations';
import { NextRequest, NextResponse } from 'next/server';

// Attaches an already-verified Ko-Fi donation (recorded by the webhook in
// /api/webhooks/kofi) to the signed-in user. This never grants Pro from
// client-supplied claims alone - the donation row must already exist,
// which only our own webhook (gated by Ko-Fi's verification token) can
// create. This is the fallback path for when the webhook couldn't
// auto-match the donor's email to an account.
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const kofiTransactionId = (body.kofiTransactionId || '').trim();

    if (!kofiTransactionId) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    const { data: donation, error: lookupError } = await admin
      .from('donations')
      .select('*')
      .eq('kofi_transaction_id', kofiTransactionId)
      .maybeSingle();

    if (lookupError || !donation) {
      return NextResponse.json(
        { error: 'We couldn\'t find that transaction yet. It can take a minute after donating - try again shortly, or contact support.' },
        { status: 404 }
      );
    }

    if (donation.user_id && donation.user_id !== user.id) {
      return NextResponse.json({ error: 'This donation has already been claimed by another account.' }, { status: 409 });
    }

    if (donation.status === 'verified' && donation.user_id === user.id) {
      return NextResponse.json({ success: true, message: 'Pro access is already active on this account.' });
    }

    await admin
      .from('donations')
      .update({ user_id: user.id, status: 'verified' })
      .eq('id', donation.id);

    await grantProFromDonation(admin, user.id, kofiTransactionId, donation.amount_cents / 100);

    return NextResponse.json({
      success: true,
      message: 'Thank you for your donation! Pro access has been activated for 2 months.',
    });
  } catch (error) {
    console.error('[claim-pro] verification error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
