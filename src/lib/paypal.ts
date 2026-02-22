// ============================================================
// PayPal REST API — Server-side helpers
// ============================================================
// Uses PayPal Subscriptions API for recurring Pro billing.
// Env vars:
//   PAYPAL_CLIENT_ID        — from PayPal Developer dashboard
//   PAYPAL_CLIENT_SECRET    — from PayPal Developer dashboard
//   NEXT_PUBLIC_PAYPAL_CLIENT_ID — same ID, exposed to client for JS SDK
//   PAYPAL_MODE             — 'sandbox' | 'live' (default: sandbox)
// ============================================================

const PAYPAL_BASE =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

// ── Access Token ────────────────────────────────────────────
let cachedToken: { token: string; expires: number } | null = null;

export async function getPayPalAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires - 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;

  if (!clientId || !secret) {
    throw new Error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET');
  }

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// ── Create Order (one-time payment for 1-year Pro) ──────────
export async function createPayPalOrder(params: {
  amount: number;
  currency?: string;
  description?: string;
  userId: string;
  plan: string;
  seats?: number;
  projectId?: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const token = await getPayPalAccessToken();
  const total = params.amount.toFixed(2);

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `pro_${params.userId}_${Date.now()}`,
          description: params.description || `Screenplay Studio Pro — 1 Year`,
          custom_id: JSON.stringify({
            user_id: params.userId,
            plan: params.plan,
            seats: params.seats || 1,
            project_id: params.projectId || null,
          }),
          amount: {
            currency_code: params.currency || 'USD',
            value: total,
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'Screenplay Studio',
            locale: 'en-US',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: params.returnUrl,
            cancel_url: params.cancelUrl,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal create order failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ── Capture Order ───────────────────────────────────────────
export async function capturePayPalOrder(orderId: string) {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal capture failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ── Get Order Details ───────────────────────────────────────
export async function getPayPalOrder(orderId: string) {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal get order failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ── Verify Webhook Signature ────────────────────────────────
export async function verifyWebhookSignature(params: {
  webhookId: string;
  headers: Record<string, string>;
  body: string;
}): Promise<boolean> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: params.headers['paypal-auth-algo'],
      cert_url: params.headers['paypal-cert-url'],
      transmission_id: params.headers['paypal-transmission-id'],
      transmission_sig: params.headers['paypal-transmission-sig'],
      transmission_time: params.headers['paypal-transmission-time'],
      webhook_id: params.webhookId,
      webhook_event: JSON.parse(params.body),
    }),
  });

  if (!res.ok) return false;
  const data = await res.json();
  return data.verification_status === 'SUCCESS';
}
