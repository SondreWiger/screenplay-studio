import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { grantProFromDonation } from '@/lib/donations';
import { NextRequest, NextResponse } from 'next/server';

// Ko-Fi verification token (from your Ko-Fi webhook settings) - set
// KOFI_VERIFICATION_TOKEN in the server environment, never hardcode it here:
// this repo is public and the token is the only thing authenticating
// incoming donation webhooks.
const KOFI_VERIFICATION_TOKEN = process.env.KOFI_VERIFICATION_TOKEN;

const DONATION_MONTHS = 2;
const MIN_AMOUNT_USD = 10;

// Ko-Fi POSTs application/x-www-form-urlencoded with a single `data` field
// containing the JSON payload as a string - not a raw JSON body.
// https://ko-fi.com/manage/webhooks
export async function POST(req: NextRequest) {
  try {
    if (!KOFI_VERIFICATION_TOKEN) {
      // Fail closed: without a configured secret, an attacker could omit
      // verification_token entirely and match `undefined !== undefined`.
      console.error('[kofi webhook] KOFI_VERIFICATION_TOKEN is not set');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    const form = await req.formData();
    const raw = form.get('data');
    if (typeof raw !== 'string') {
      return NextResponse.json({ error: 'Missing data field' }, { status: 400 });
    }

    const body = JSON.parse(raw);

    if (body.verification_token !== KOFI_VERIFICATION_TOKEN) {
      console.warn('[kofi webhook] invalid verification token');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const {
      type,
      amount,
      email,
      kofi_transaction_id,
    } = body;

    if (type !== 'Donation' && type !== 'Subscription') {
      return NextResponse.json({ success: true, ignored: true });
    }

    const amountUsd = parseFloat(amount || '0');
    if (!(amountUsd >= MIN_AMOUNT_USD)) {
      return NextResponse.json({ success: true, ignored: true });
    }

    if (!kofi_transaction_id) {
      return NextResponse.json({ error: 'Missing kofi_transaction_id' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    // Idempotency: Ko-Fi may retry the same event.
    const { data: existing } = await admin
      .from('donations')
      .select('id')
      .eq('kofi_transaction_id', kofi_transaction_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, already_processed: true });
    }

    // Try to match a registered user by donation email so we can grant
    // access immediately; unmatched donations are claimed via /claim-pro.
    let userId: string | null = null;
    if (email) {
      // Exact match on lowercased email - avoid `ilike`, whose `_`/`%`
      // wildcards are valid characters in real addresses and could
      // false-match a different account.
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('email', String(email).toLowerCase())
        .maybeSingle();
      if (profile) userId = profile.id;
    }

    const { error: donationError } = await admin.from('donations').insert({
      user_id: userId,
      email: email || null,
      kofi_transaction_id,
      amount_cents: Math.round(amountUsd * 100),
      status: userId ? 'verified' : 'completed',
      pro_months_granted: DONATION_MONTHS,
    });

    if (donationError) {
      console.error('[kofi webhook] failed to record donation:', donationError);
      // Still 200 so Ko-Fi doesn't hammer retries; this is logged for follow-up.
      return NextResponse.json({ success: true, error: 'Failed to record donation' });
    }

    if (userId) {
      await grantProFromDonation(admin, userId, kofi_transaction_id, amountUsd);
    }

    return NextResponse.json({ success: true, userId, transactionId: kofi_transaction_id });
  } catch (error) {
    console.error('[kofi webhook] error:', error);
    // 200 avoids Ko-Fi's retry storm; the error above is what we act on.
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 200 });
  }
}
