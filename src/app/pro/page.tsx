'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { Button, Card, Badge, LoadingPage } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { Icon } from '@/components/ui/icons';
import { useFeatureAccess } from '@/components/FeatureGate';
import { PRO_PRICING } from '@/lib/types';

// ============================================================
// Pro Upgrade — Pricing & Checkout
// ============================================================

const PRO_FEATURES = [
  {
    icon: 'cube',
    title: '50 GB Cloud Storage',
    desc: 'Store high-res storyboards, mood boards, reference images, and production assets. 50× the free tier.',
  },
  {
    icon: 'users',
    title: 'Unlimited Team Size',
    desc: 'Add your entire production crew — no seat limits. Free accounts support up to 5 members.',
  },
  {
    icon: 'share',
    title: 'External Share Portals',
    desc: 'Share scripts, storyboards, and lookbooks with clients and stakeholders via secure, branded links. Password protection and expiry dates included.',
  },
  {
    icon: 'edit',
    title: 'Client Review System',
    desc: 'Collect line-level feedback from clients and producers. They don\'t need an account — just a link. Track approvals, revision requests, and notes.',
  },
  {
    icon: 'chart',
    title: 'Team Analytics Dashboard',
    desc: 'Track writing velocity, team activity, deadline adherence, and production progress with real-time charts.',
  },
  {
    icon: 'refresh',
    title: 'Full Version History',
    desc: 'Every revision saved automatically. Compare any two versions side-by-side with a visual diff. Restore any previous version instantly.',
  },
  {
    icon: 'building',
    title: 'Custom Branding',
    desc: 'Your company logo on shared portals, watermarked script exports, and branded PDF covers for client-facing materials.',
  },
  {
    icon: 'document',
    title: 'Advanced Export Formats',
    desc: 'Export to DOCX, HTML, and Fountain in addition to PDF, FDX, and JSON. Batch-export entire projects. Custom watermarks on every page.',
  },
  {
    icon: 'calendar',
    title: 'Advanced Scheduling',
    desc: 'Gantt chart view, resource allocation, conflict detection, and automated day-out-of-days reports for multi-day shoots.',
  },
  {
    icon: 'folder',
    title: 'Unlimited Projects',
    desc: 'No cap on the number of active projects. Free accounts support up to 10.',
  },
  {
    icon: 'link',
    title: 'API Access & Webhooks',
    desc: 'Integrate with your existing pipeline — Notion, Slack, Frame.io, Google Drive. Automate exports and notifications.',
  },
  {
    icon: 'bolt',
    title: 'Priority Support',
    desc: 'Direct email support with 24-hour response time. Access to the Pro feedback channel for feature requests.',
  },
];

const TESTIMONIALS = [
  { name: 'Sarah K.', role: 'Showrunner', text: 'The client review portal alone saves us 10+ hours per episode in feedback rounds.' },
  { name: 'Marcus D.', role: 'YouTube Creator (2.4M)', text: 'External share links let me send branded lookbooks to sponsors instantly. Game changer.' },
  { name: 'Lena W.', role: 'Indie Producer', text: 'Version history saved our pilot rewrite. We could compare every draft side by side.' },
];

export default function ProUpgradePage() {
  const { user, loading: authLoading } = useAuth();
  const { isPro, activateDevBypass, subscription } = useProFeatures();
  const router = useRouter();
  const { canUse: canUseFeature, loading: flagsLoading } = useFeatureAccess();
  const [activating, setActivating] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<'pro' | 'team' | 'project_lifetime'>('pro');
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [teamSeats, setTeamSeats] = useState(1);
  const [upgradeProjectId, setUpgradeProjectId] = useState<string | null>(null);

  // Auto-open project lifetime checkout if linked from project settings
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('upgrade_project');
    if (projectId) {
      setUpgradeProjectId(projectId);
      setCheckoutPlan('project_lifetime');
      setShowCheckout(true);
    }
  }, []);

  if (authLoading) return <LoadingPage />;

  // Gate: if pro_subscription flag is not accessible, redirect
  if (!flagsLoading && !canUseFeature('pro_subscription')) {
    return (
      <div className="min-h-screen" style={{ background: '#070710' }}>
        <AppHeader />
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <p className="text-white/30 text-sm">Pro subscriptions are not available yet.</p>
        </div>
      </div>
    );
  }

  const handlePayPalCheckout = async (plan: 'pro' | 'team' | 'project_lifetime') => {
    if (!user) { router.push('/auth/login'); return; }
    setPaypalLoading(true);
    setPaypalError(null);
    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          seats: plan === 'team' ? teamSeats : 1,
          projectId: plan === 'project_lifetime' ? upgradeProjectId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');

      // Store order ID for capture after return
      sessionStorage.setItem('paypal_order_id', data.id);
      sessionStorage.setItem('paypal_plan', plan);

      // Find the approval link and redirect
      const approveLink = data.links?.find((l: { rel: string; href: string }) => l.rel === 'payer-action' || l.rel === 'approve');
      if (approveLink?.href) {
        window.location.href = approveLink.href;
      } else {
        throw new Error('No approval URL returned from PayPal');
      }
    } catch (err: unknown) {
      console.error('PayPal checkout error:', err);
      setPaypalError(err instanceof Error ? err.message : 'An error occurred');
      setPaypalLoading(false);
    }
  };

  const handleDevBypass = async () => {
    setActivating(true);
    await activateDevBypass();
    setActivating(false);
    router.push('/settings/billing');
  };

  const teamTotal = teamSeats * PRO_PRICING.team_yearly.amount;

  // Already Pro
  if (isPro) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#070710' }}>
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-8 flex items-center justify-center" style={{ background: '#FF5F1F' }}>
            <Icon name="star" size="xl" className="text-white" />
          </div>
          <div className="flex items-center gap-2.5 mb-4 justify-center">
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
            <span className="ss-label">Already Pro</span>
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
          </div>
          <h1 className="text-2xl font-black text-white mb-3" style={{ letterSpacing: '-0.03em' }}>YOU'RE ALREADY ON PRO!</h1>
          <p className="text-white/30 text-sm mb-8 leading-relaxed">
            You have access to all Pro features. Thank you for supporting Screenplay Studio.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/settings/billing">
              <Button variant="secondary">Manage Subscription</Button>
            </Link>
            <Link href="/pro/team">
              <Button>Buy Team Licenses</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#070710' }}>
      <AppHeader />
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(255,95,31,0.08) 0%, transparent 60%)' }} />
        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2.5 mb-8">
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
            <span className="ss-label">Screenplay Studio Pro</span>
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
          </div>
          <h1 className="font-black text-white mb-6" style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', letterSpacing: '-0.04em', lineHeight: 0.9 }}>
            Production-grade tools<br />
            <span style={{ color: '#FF5F1F' }}>for serious creators.</span>
          </h1>
          <p className="text-base text-white/30 max-w-2xl mx-auto mb-12 leading-relaxed">
            Everything in the free plan stays free — forever. Pro adds the collaboration,
            client-facing, and production management tools that professional teams need.
          </p>

          {/* Pricing Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {/* Per-Project Lifetime */}
            <Card className="p-6 text-left border-2 border-emerald-500/40 hover:border-emerald-400/60 transition-colors relative overflow-hidden">
              <div className="absolute top-2.5 right-2.5">
                <Badge variant="warning">BEST VALUE</Badge>
              </div>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Per Production</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-black text-white">${PRO_PRICING.project_lifetime.amount}</span>
              </div>
              <p className="text-xs text-surface-500 mb-5">One-time. Pro on one production forever.</p>
              <Button size="sm" className="w-full mb-3 bg-emerald-600 hover:bg-emerald-500" onClick={() => { setCheckoutPlan('project_lifetime'); setShowCheckout(true); }}>
                Upgrade a Production
              </Button>
              <ul className="space-y-1.5 text-xs text-surface-300">
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>All Pro tools on 1 project</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>All team members get access</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>Lifetime — one payment</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>No subscription needed</li>
              </ul>
            </Card>

            {/* Individual Yearly */}
            <Card className="p-6 text-left border-2 border-amber-500/40 hover:border-amber-400/60 transition-colors relative">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Pro — Yearly</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-black text-white">${PRO_PRICING.yearly.amount}</span>
                <span className="text-surface-400 text-sm">/yr</span>
              </div>
              <p className="text-xs text-surface-500 mb-5">${PRO_PRICING.yearly.per_month.toFixed(2)}/mo — all projects, all features.</p>
              <Button size="sm" className="w-full mb-3" onClick={() => { setCheckoutPlan('pro'); setShowCheckout(true); }}>
                Get Pro Now
              </Button>
              <ul className="space-y-1.5 text-xs text-surface-300">
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>Pro on all projects</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>50 GB storage</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>Priority support</li>
              </ul>
            </Card>

            {/* Team */}
            <Card className="p-6 text-left border-2 border-surface-700 hover:border-amber-500/40 transition-colors relative">
              <div className="absolute top-2.5 right-2.5">
                <Badge variant="warning">20% OFF</Badge>
              </div>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Team License</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-black text-white">${PRO_PRICING.team_yearly.amount}</span>
                <span className="text-surface-400 text-sm">/seat/yr</span>
              </div>
              <p className="text-xs text-surface-500 mb-5">${PRO_PRICING.team_yearly.per_month.toFixed(2)}/mo per seat.</p>
              <Button size="sm" className="w-full mb-3" onClick={() => { if (user) router.push('/pro/team'); else router.push('/auth/login'); }}>
                Buy Team Licenses
              </Button>
              <ul className="space-y-1.5 text-xs text-surface-300">
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>Pro for each team member</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>Centralized billing</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>Transfer seats anytime</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { if (!paypalLoading) { setShowCheckout(false); setPaypalError(null); } }}>
          <div onClick={(e) => e.stopPropagation()}>
          <Card className="p-8 max-w-md mx-4 border-2 border-amber-500/30">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Icon name={checkoutPlan === 'project_lifetime' ? 'film' : 'star'} size="xl" className="text-white" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">Checkout</h2>
              <p className="text-sm text-surface-400">
                {checkoutPlan === 'project_lifetime'
                  ? 'Unlock Pro tools on a single production — forever. All team members get access.'
                  : 'Complete your purchase to unlock all Pro features on every project.'}
              </p>
            </div>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-surface-800/50 border border-surface-700">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-surface-400">
                    {checkoutPlan === 'project_lifetime' ? 'Pro — Single Production (Lifetime)'
                      : 'Pro — Yearly'}
                  </span>
                  <span className="text-white font-medium">
                    ${checkoutPlan === 'project_lifetime' ? PRO_PRICING.project_lifetime.amount
                      : PRO_PRICING.yearly.amount}.00
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-surface-400">Billing</span>
                  <span className="text-surface-300">
                    {checkoutPlan === 'project_lifetime' ? 'One-time payment' : '1 year'}
                  </span>
                </div>
              </div>

              {checkoutPlan === 'project_lifetime' && !upgradeProjectId && (
                <p className="text-xs text-amber-400 text-center">
                  Tip: Upgrade from your project's Settings page to auto-select the project.
                </p>
              )}

              {paypalError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400">{paypalError}</p>
                </div>
              )}

              <Button
                className="w-full bg-[#0070BA] hover:bg-[#005ea6] text-white"
                onClick={() => handlePayPalCheckout(checkoutPlan)}
                loading={paypalLoading}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .757-.644h6.568c2.175 0 3.806.567 4.85 1.684 1.004 1.073 1.38 2.533 1.115 4.34-.012.083-.025.166-.04.25-.358 2.078-1.312 3.678-2.834 4.762-1.478 1.055-3.382 1.59-5.66 1.59H8.293a.77.77 0 0 0-.757.645l-.46 2.99z"/>
                    <path d="M19.441 7.516c-.03.175-.063.355-.1.54-.878 4.522-3.883 6.083-7.723 6.083H9.663a.951.951 0 0 0-.938.803l-.997 6.327a.497.497 0 0 0 .49.576h3.443a.67.67 0 0 0 .66-.562l.027-.142.523-3.316.034-.183a.67.67 0 0 1 .66-.562h.416c2.69 0 4.797-1.093 5.414-4.254.258-1.322.124-2.424-.558-3.2a2.647 2.647 0 0 0-.396-.31z" opacity=".7"/>
                  </svg>
                  Pay with PayPal
                </span>
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-surface-700" /></div>
                <div className="relative flex justify-center"><span className="bg-surface-900 px-3 text-xs text-surface-500">or</span></div>
              </div>
              <Button
                variant="secondary"
                className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                onClick={handleDevBypass}
                loading={activating}
              >
                Activate Dev Bypass (Free)
              </Button>
              <p className="text-[10px] text-surface-600 text-center">Dev bypass activates Pro for 1 year at no cost. For development and testing only.</p>
            </div>
          </Card>
          </div>
        </div>
      )}

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-4 py-16" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-center mb-12">
          <div className="flex items-center gap-2.5 mb-4 justify-center">
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
            <span className="ss-label">Pro Features</span>
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3" style={{ letterSpacing: '-0.03em' }}>EVERYTHING IN PRO</h2>
          <p className="text-white/30 text-sm">New capabilities that never existed in the free tier — nothing was taken away.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRO_FEATURES.map((f) => (
            <Card key={f.title} className="p-5">
              <div className="mb-3"><Icon name={f.icon} size="lg" className="text-amber-400" /></div>
              <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-xs text-surface-400 leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="p-5">
              <p className="text-sm text-surface-300 mb-4 italic">"{t.text}"</p>
              <div>
                <p className="text-sm font-medium text-white">{t.name}</p>
                <p className="text-xs text-surface-500">{t.role}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-black text-white text-center mb-8" style={{ letterSpacing: '-0.03em' }}>FREE vs PRO</h2>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800">
                <th className="text-left p-4 text-surface-400 font-medium">Feature</th>
                <th className="text-center p-4 text-surface-400 font-medium w-32">Free</th>
                <th className="text-center p-4 text-amber-400 font-medium w-32">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/50">
              {[
                ['Script Editor', '✓', '✓'],
                ['Characters, Scenes, Locations', '✓', '✓'],
                ['Shot List & Storyboard', '✓', '✓'],
                ['Real-time Collaboration', '✓', '✓'],
                ['Community & Showcase', '✓', '✓'],
                ['All Content Creator Tools', '✓', '✓'],
                ['PDF & FDX Export', '✓', '✓'],
                ['Cloud Storage', '5 GB', '50 GB'],
                ['Team Size', 'Unlimited', 'Unlimited'],
                ['Active Projects', 'Unlimited', 'Unlimited'],
                ['Version History', '—', '✓'],
                ['External Share Portals', '—', '✓'],
                ['Client Review System', '—', '✓'],
                ['Team Analytics', '—', '✓'],
                ['Custom Branding', '—', '✓'],
                ['Advanced Exports (DOCX, HTML)', '—', '✓'],
                ['Advanced Scheduling', '—', '✓'],
                ['API Access', '—', '✓'],
                ['Priority Support', '—', '✓'],
              ].map(([feature, free, pro]) => (
                <tr key={feature} className="hover:bg-surface-800/20">
                  <td className="p-3 text-surface-300">{feature}</td>
                  <td className="p-3 text-center text-surface-400">{free}</td>
                  <td className="p-3 text-center text-white font-medium">{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Final CTA */}
      <div className="py-16 text-center px-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,95,31,0.04)' }}>
        <div className="flex items-center gap-2.5 mb-5 justify-center">
          <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
          <span className="ss-label">Get Started</span>
          <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
        </div>
        <h2 className="text-2xl font-black text-white mb-3" style={{ letterSpacing: '-0.03em' }}>READY TO LEVEL UP?</h2>
        <p className="text-white/30 text-sm mb-8 max-w-xl mx-auto leading-relaxed">
          Everything you already have stays free. Pro just adds the tools your team deserves.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => { if (user) { setCheckoutPlan('project_lifetime'); setShowCheckout(true); } else router.push('/auth/login'); }}>
            Per Production — ${PRO_PRICING.project_lifetime.amount}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => { if (user) { setCheckoutPlan('pro'); setShowCheckout(true); } else router.push('/auth/login'); }}>
            Yearly — ${PRO_PRICING.yearly.amount}/yr
          </Button>
        </div>
      </div>
    </div>
  );
}
