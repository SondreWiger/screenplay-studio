import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature } from '@/lib/paypal';

// ============================================================
// POST /api/paypal/webhook
// Handles PayPal webhook events (payment disputes, refunds, etc.)
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    // Verify signature if webhook ID is configured
    if (webhookId) {
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => { headers[k] = v; });

      const isValid = await verifyWebhookSignature({
        webhookId,
        headers,
        body,
      });

      if (!isValid) {
        console.error('Invalid PayPal webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(body);
    const eventType = event.event_type;
    const resource = event.resource;

    console.log(`PayPal webhook: ${eventType}`, resource?.id);

    const admin = createAdminSupabaseClient();

    switch (eventType) {
      // ── Payment captured (redundant with capture-order, but good for reliability)
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const orderId = resource?.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          // Ensure subscription is marked active
          await admin.from('subscriptions')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('paypal_subscription_id', orderId);
        }
        break;
      }

      // ── Payment refunded
      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.CAPTURE.REVERSED': {
        const orderId = resource?.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          // Cancel the subscription
          const { data: sub } = await admin.from('subscriptions')
            .update({
              status: 'cancelled',
              cancel_at_period_end: true,
              updated_at: new Date().toISOString(),
              metadata: { refunded: true, refund_event: eventType },
            })
            .eq('paypal_subscription_id', orderId)
            .select('user_id')
            .single();

          if (sub) {
            // Downgrade user
            await admin.from('profiles').update({
              is_pro: false,
            }).eq('id', sub.user_id);
          }
        }
        break;
      }

      // ── Dispute opened
      case 'CUSTOMER.DISPUTE.CREATED': {
        console.warn('PayPal dispute created:', resource?.dispute_id);
        // Log for manual review
        break;
      }

      default:
        console.log(`Unhandled PayPal event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('PayPal webhook error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
