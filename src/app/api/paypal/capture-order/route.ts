import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { capturePayPalOrder } from '@/lib/paypal';
import { PRO_LIMITS, PRO_PRICING } from '@/lib/types';

// ============================================================
// POST /api/paypal/capture-order
// Captures payment after PayPal approval, activates Pro
// Supports: pro (yearly), team, project_lifetime ($100/project)
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { orderId } = body;
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    // Capture the payment
    const capture = await capturePayPalOrder(orderId);

    if (capture.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: `Payment not completed. Status: ${capture.status}` },
        { status: 400 }
      );
    }

    // Extract custom data from the order
    const unit = capture.purchase_units?.[0];
    const customId = unit?.payments?.captures?.[0]?.custom_id;
    let plan = 'pro';
    let seats = 1;
    let projectId: string | null = null;

    try {
      const parsed = JSON.parse(customId || '{}');
      plan = parsed.plan || 'pro';
      seats = parsed.seats || 1;
      projectId = parsed.project_id || null;
    } catch {}

    // Also check body-forwarded projectId
    if (!projectId && body.projectId) projectId = body.projectId;

    const captureData = unit?.payments?.captures?.[0];
    const paypalCaptureId = captureData?.id;
    const priceCents = Math.round(parseFloat(captureData?.amount?.value || '0') * 100);

    // Use admin client to bypass RLS for subscription creation
    const admin = createAdminSupabaseClient();
    const now = new Date();
    const oneYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const forever = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);

    switch (plan) {
      // ── Team licenses ────────────────────────────────────
      case 'team': {
        const { data: sub } = await admin.from('subscriptions').insert({
          user_id: user.id,
          plan: 'pro',
          status: 'active',
          billing_cycle: 'yearly',
          price_cents: priceCents,
          payment_method: 'paypal',
          paypal_subscription_id: orderId,
          paypal_customer_id: capture.payer?.payer_id || null,
          current_period_start: now.toISOString(),
          current_period_end: oneYear.toISOString(),
          metadata: {
            paypal_order_id: orderId,
            paypal_capture_id: paypalCaptureId,
            plan: 'team',
            seats,
          },
        }).select().single();

        // Upgrade the purchaser to Pro
        await admin.from('profiles').update({
          is_pro: true,
          pro_since: now.toISOString(),
          storage_limit_bytes: PRO_LIMITS.pro.storage_bytes,
        }).eq('id', user.id);

        return NextResponse.json({
          success: true, plan: 'team', seats,
          subscription_id: sub?.id, redirect: '/pro/team',
        });
      }

      // ── Per-project lifetime ($100) ──────────────────────
      case 'project_lifetime':
      case 'single_project': {
        const { data: sub } = await admin.from('subscriptions').insert({
          user_id: user.id,
          plan: 'project_pro',
          status: 'active',
          billing_cycle: 'one_time',
          price_cents: priceCents,
          payment_method: 'paypal',
          paypal_subscription_id: orderId,
          paypal_customer_id: capture.payer?.payer_id || null,
          current_period_start: now.toISOString(),
          current_period_end: forever.toISOString(),
          metadata: {
            paypal_order_id: orderId,
            paypal_capture_id: paypalCaptureId,
            plan: 'project_lifetime',
            project_id: projectId,
          },
        }).select().single();

        // Mark the project as Pro-enabled (all members get access)
        if (projectId) {
          await admin.from('projects').update({
            pro_enabled: true,
          }).eq('id', projectId);
        }

        return NextResponse.json({
          success: true, plan: 'project_lifetime',
          project_id: projectId,
          subscription_id: sub?.id,
          redirect: projectId ? `/projects/${projectId}` : '/dashboard',
        });
      }

      // ── Individual yearly Pro (default) ──────────────────
      default: {
        const { data: sub } = await admin.from('subscriptions').insert({
          user_id: user.id,
          plan: 'pro',
          status: 'active',
          billing_cycle: 'yearly',
          price_cents: priceCents,
          payment_method: 'paypal',
          paypal_subscription_id: orderId,
          paypal_customer_id: capture.payer?.payer_id || null,
          current_period_start: now.toISOString(),
          current_period_end: oneYear.toISOString(),
          metadata: {
            paypal_order_id: orderId,
            paypal_capture_id: paypalCaptureId,
            plan: 'pro',
          },
        }).select().single();

        // Upgrade profile to Pro
        await admin.from('profiles').update({
          is_pro: true,
          pro_since: now.toISOString(),
          storage_limit_bytes: PRO_LIMITS.pro.storage_bytes,
        }).eq('id', user.id);

        return NextResponse.json({
          success: true, plan: 'pro',
          subscription_id: sub?.id, redirect: '/settings/billing',
        });
      }
    }
  } catch (err: any) {
    console.error('PayPal capture error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to capture payment' },
      { status: 500 }
    );
  }
}
