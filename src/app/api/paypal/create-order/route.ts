import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createPayPalOrder } from '@/lib/paypal';
import { PRO_PRICING } from '@/lib/types';

// ============================================================
// POST /api/paypal/create-order
// Creates a PayPal checkout order for any Pro plan type
// Plans: pro (yearly), team, project_lifetime ($100/project)
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const plan = body.plan || 'pro'; // 'pro' | 'team' | 'project_lifetime'
    const seats = body.seats || 1;
    const projectId = body.projectId || null;

    // Calculate amount and description based on plan
    let amount: number;
    let description: string;

    switch (plan) {
      case 'team':
        amount = PRO_PRICING.team_yearly.amount * seats;
        description = `Screenplay Studio Pro — Team (${seats} seat${seats > 1 ? 's' : ''}) — 1 Year`;
        break;
      case 'project_lifetime':
        amount = PRO_PRICING.project_lifetime.amount;
        description = `Screenplay Studio Pro — Single Project — Lifetime Access`;
        if (!projectId) {
          return NextResponse.json({ error: 'Missing projectId for project_lifetime plan' }, { status: 400 });
        }
        break;
      default: // 'pro'
        amount = PRO_PRICING.yearly.amount;
        description = `Screenplay Studio Pro — Individual — 1 Year`;
        break;
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const order = await createPayPalOrder({
      amount,
      description,
      userId: user.id,
      plan,
      seats,
      returnUrl: `${origin}/pro/checkout?status=success`,
      cancelUrl: `${origin}/pro/checkout?status=cancelled`,
    });

    return NextResponse.json({
      id: order.id,
      status: order.status,
      links: order.links,
    });
  } catch (err: any) {
    console.error('PayPal create order error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create PayPal order' },
      { status: 500 }
    );
  }
}
