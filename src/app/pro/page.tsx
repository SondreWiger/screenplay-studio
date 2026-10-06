'use client';

import { Clapperboard, Crown, HardDrive, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

import { PRO_TOOLS } from '@/lib/pro-tools/tools';

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
import { useTranslation } from '@/components/TranslationProvider';

// Pro Upgrade — Pricing & Checkout

// What Pro adds on top of Free. Free is the whole writing and production
// product (see PRO_LIMITS.free); Pro is about capacity and the sister apps.
const PRO_FEATURES = [
  {
    icon: 'cube',
    title: '200 GB Cloud Storage',
    desc: 'Room for storyboard art, reference images, moodboards and production assets. Free accounts get a generous 50 GB; Pro raises it to 200.',
  },
  {
    icon: 'star',
    title: 'Cinderra Pro included',
    desc: 'The visual planning canvas for boards, references and timelines — its Pro tier comes with your subscription.',
  },
  {
    icon: 'users',
    title: 'CastingCall Pro included',
    desc: 'Run open casting calls, collect applications and manage auditions — included, no separate plan.',
  },
  {
    icon: 'link',
    title: 'API Access & Webhooks',
    desc: 'Integrate with your pipeline and automate exports and notifications.',
  },
  {
    icon: 'bolt',
    title: 'Priority Support',
    desc: 'Email that actually gets answered — 24-hour response time plus a direct channel for feature requests.',
  },
];


export default function ProUpgradePage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const { isPro } = useProFeatures();
  const router = useRouter();
  const { canUse: canUseFeature, loading: flagsLoading } = useFeatureAccess();
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<'pro' | 'team' | 'project_lifetime'>('pro');
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [teamSeats] = useState(1);
  const [upgradeProjectId, setUpgradeProjectId] = useState<string | null>(null);
  const [ownProjects, setOwnProjects] = useState<{ id: string; title: string }[]>([]);

  // Productions the user owns, for the per-production Studio purchase
  useEffect(() => {
    if (!showCheckout || checkoutPlan !== 'project_lifetime' || !user) return;
    createClient()
      .from('projects')
      .select('id, title')
      .eq('created_by', user.id)
      .eq('pro_enabled', false)
      .order('updated_at', { ascending: false })
      .then(({ data }: { data: { id: string; title: string }[] | null }) => setOwnProjects(data || []));
  }, [showCheckout, checkoutPlan, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="min-h-screen" style={{ background: 'rgb(var(--surface-950))' }}>
        <AppHeader />
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <p className="text-white/45 text-sm">Pro subscriptions are not available yet.</p>
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

  // Already Pro
  if (isPro) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-surface-900 via-surface-900/80 to-amber-950/30 p-8 md:p-10">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-brand-500 text-white shadow-lg shadow-amber-500/20">
              <Crown className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-400">Your plan</p>
              <h1 className="text-2xl font-bold tracking-tight text-white">You&apos;re on Pro</h1>
            </div>
          </div>
          <p className="relative mt-4 max-w-lg text-sm text-surface-400">
            You have access to all Pro features. Thank you for supporting Screenplay Studio — it keeps the free product free.
          </p>
          <div className="relative mt-6 grid gap-2 sm:grid-cols-3">
            {[
              { icon: HardDrive, t: '200 GB storage', d: 'Room for scripts, boards and media.' },
              { icon: Clapperboard, t: 'Cinderra Pro', d: 'Included with your plan.' },
              { icon: Users, t: 'CastingCall Pro', d: 'Included with your plan.' },
            ].map((f) => (
              <div key={f.t} className="rounded-xl border border-surface-800 bg-surface-950/40 p-3">
                <f.icon className="h-4 w-4 text-amber-400" />
                <p className="mt-2 text-xs font-semibold text-white">{f.t}</p>
                <p className="mt-0.5 text-[11px] text-surface-500">{f.d}</p>
              </div>
            ))}
          </div>
          <div className="relative mt-6 flex flex-wrap gap-2">
            <Link href="/settings/billing" className="inline-flex items-center rounded-xl border border-surface-700 px-4 py-2 text-xs font-semibold text-surface-200 hover:text-white">
              {t('pro.manage')}
            </Link>
            <Link href="/pro/team" className="inline-flex items-center rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500">
              Buy team licenses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--surface-950))' }}>
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
          <h1 className="font-semibold text-white mb-6" style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', letterSpacing: '-0.04em', lineHeight: 0.9 }}>
            Tools for productions<br />
            <span style={{ color: '#FF5F1F' }}>that need more.</span>
          </h1>
          <p className="text-base text-white/45 max-w-2xl mx-auto mb-12 leading-relaxed">
            Free is the whole product — writing, planning, sharing, version history, analytics and every export format.
            Pro adds capacity and the sister apps. Studio adds a full production-office tool suite for shoots that need it.
          </p>

          {/* Pricing Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {/* Per-Project Lifetime */}
            <Card className="p-6 text-left border-2 border-emerald-500/40 hover:border-emerald-400/60 transition-colors relative overflow-hidden">
              <div className="absolute top-2.5 right-2.5">
                <Badge variant="warning">BEST VALUE</Badge>
              </div>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-[0.04em] mb-2">Studio — Per Production</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold text-white">${PRO_PRICING.project_lifetime.amount}</span>
              </div>
              <p className="text-xs text-surface-500 mb-5">One-time. The Studio tool suite on one production, for good.</p>
              <Button size="sm" className="w-full mb-3 bg-emerald-600 hover:bg-emerald-500" onClick={() => { setCheckoutPlan('project_lifetime'); setShowCheckout(true); }}>
                Add Studio to a Production
              </Button>
              <ul className="space-y-1.5 text-xs text-surface-300">
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>{PRO_TOOLS.length} Studio tools on 1 production</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>All team members get access</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>Lifetime — one payment</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>No subscription needed</li>
              </ul>
            </Card>

            {/* Individual Yearly */}
            <Card className="p-6 text-left border-2 border-amber-500/40 hover:border-amber-400/60 transition-colors relative">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-[0.04em] mb-2">Pro — Yearly</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold text-white">${PRO_PRICING.yearly.amount}</span>
                <span className="text-surface-400 text-sm">/yr</span>
              </div>
              <p className="text-xs text-surface-500 mb-5">${PRO_PRICING.yearly.per_month.toFixed(2)}/mo, or ${PRO_PRICING.monthly.amount} billed monthly.</p>
              <Button size="sm" className="w-full mb-3" onClick={() => { setCheckoutPlan('pro'); setShowCheckout(true); }}>
                Get Pro Now
              </Button>
              <ul className="space-y-1.5 text-xs text-surface-300">
                                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>200 GB storage</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>Priority support</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>Cinderra Pro included</li>
                <li className="flex items-start gap-1.5"><span className="text-green-400 mt-0.5">✓</span>CastingCall Pro included</li>
              </ul>
            </Card>

            {/* Team */}
            <Card className="p-6 text-left border-2 border-surface-700 hover:border-amber-500/40 transition-colors relative">
              <div className="absolute top-2.5 right-2.5">
                <Badge variant="warning">20% OFF</Badge>
              </div>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-[0.04em] mb-2">Team License</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold text-white">${PRO_PRICING.team_yearly.amount}</span>
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
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Icon name={checkoutPlan === 'project_lifetime' ? 'film' : 'star'} size="xl" className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Checkout</h2>
              <p className="text-sm text-surface-400">
                {checkoutPlan === 'project_lifetime'
                  ? 'Add the Studio tool suite to one production — forever. Everyone on the production gets access.'
                  : 'Complete your purchase to unlock all Pro features on every project.'}
              </p>
            </div>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-surface-800/50 border border-surface-700">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-surface-400">
                    {checkoutPlan === 'project_lifetime' ? 'Studio — Single Production (Lifetime)'
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

              {/* The order needs a production; let people pick one here rather than
                  failing with "Missing projectId" */}
              {checkoutPlan === 'project_lifetime' && (
                <div>
                  <label htmlFor="studio-project" className="block text-xs text-surface-400 mb-1">Production</label>
                  <select
                    id="studio-project"
                    value={upgradeProjectId ?? ''}
                    onChange={(e) => setUpgradeProjectId(e.target.value || null)}
                    className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Choose a production…</option>
                    {ownProjects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
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
                disabled={checkoutPlan === 'project_lifetime' && !upgradeProjectId}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .757-.644h6.568c2.175 0 3.806.567 4.85 1.684 1.004 1.073 1.38 2.533 1.115 4.34-.012.083-.025.166-.04.25-.358 2.078-1.312 3.678-2.834 4.762-1.478 1.055-3.382 1.59-5.66 1.59H8.293a.77.77 0 0 0-.757.645l-.46 2.99z"/>
                    <path d="M19.441 7.516c-.03.175-.063.355-.1.54-.878 4.522-3.883 6.083-7.723 6.083H9.663a.951.951 0 0 0-.938.803l-.997 6.327a.497.497 0 0 0 .49.576h3.443a.67.67 0 0 0 .66-.562l.027-.142.523-3.316.034-.183a.67.67 0 0 1 .66-.562h.416c2.69 0 4.797-1.093 5.414-4.254.258-1.322.124-2.424-.558-3.2a2.647 2.647 0 0 0-.396-.31z" opacity=".7"/>
                  </svg>
                  Pay with PayPal
                </span>
              </Button>

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
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3" style={{ letterSpacing: '-0.03em' }}>WHAT PRO ADDS</h2>
          <p className="text-white/45 text-sm">On top of everything in Free — nothing in Free is held back.</p>
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


      {/* Studio */}
      <div id="studio" className="max-w-6xl mx-auto px-4 py-16 scroll-mt-20" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-center mb-10">
          <div className="flex items-center gap-2.5 mb-4 justify-center">
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
            <span className="ss-label">Studio</span>
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3" style={{ letterSpacing: '-0.03em' }}>THE PRODUCTION OFFICE</h2>
          <p className="text-white/50 text-sm max-w-2xl mx-auto">
            {PRO_TOOLS.length} tools for productions with departments, budgets and deliverables — accounting, rights and clearances,
            distribution, VFX tracking and more. Add it to a single production for ${PRO_PRICING.project_lifetime.amount} once,
            or talk to us about Studio for your whole company.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {PRO_TOOLS.slice(0, 18).map((tool) => (
            <span key={tool.slug} className="rounded-full border border-surface-700 px-3 py-1 text-xs text-surface-300">{tool.label}</span>
          ))}
          {PRO_TOOLS.length > 18 && <span className="rounded-full px-3 py-1 text-xs text-surface-500">+{PRO_TOOLS.length - 18} more</span>}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => { setCheckoutPlan('project_lifetime'); setShowCheckout(true); }}>Add Studio to a production</Button>
          <a href="/support?topic=studio" className="inline-flex items-center rounded-lg border border-surface-700 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800">Contact us about Studio</a>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-white text-center mb-8" style={{ letterSpacing: '-0.03em' }}>FREE, PRO & STUDIO</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800">
                <th className="text-left p-4 text-surface-400 font-medium">Feature</th>
                <th className="text-center p-4 text-surface-400 font-medium w-24">Free</th>
                <th className="text-center p-4 text-amber-400 font-medium w-24">Pro</th>
                <th className="text-center p-4 text-emerald-400 font-medium w-24">Studio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/50">
              {[
                ['Script editor, all formats', '✓', '✓', '✓'],
                ['Characters, scenes, locations, shots, storyboard', '✓', '✓', '✓'],
                ['Scheduling, budget, call sheets, breakdowns', '✓', '✓', '✓'],
                ['Real-time collaboration, unlimited team', '✓', '✓', '✓'],
                ['Unlimited projects', '✓', '✓', '✓'],
                ['Version history & revisions', '✓', '✓', '✓'],
                ['Share links & client review', '✓', '✓', '✓'],
                ['Analytics, reports, script analysis', '✓', '✓', '✓'],
                ['Custom branding & watermarks', '✓', '✓', '✓'],
                ['Export: PDF, FDX, Fountain, DOCX, HTML', '✓', '✓', '✓'],
                ['Cloud storage', '50 GB', '200 GB', '200 GB'],
                ['Cinderra Pro & CastingCall Pro', '—', '✓', '✓'],
                ['API access & priority support', '—', '✓', '✓'],
                [`Studio tool suite (${PRO_TOOLS.length} tools)`, '—', '—', '✓'],
              ].map(([feature, free, pro, studio]) => (
                <tr key={feature} className="hover:bg-surface-800/20">
                  <td className="p-3 text-surface-300">{feature}</td>
                  <td className="p-3 text-center text-surface-400">{free}</td>
                  <td className="p-3 text-center text-white font-medium">{pro}</td>
                  <td className="p-3 text-center text-white font-medium">{studio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-3 text-center text-xs text-surface-500">
          Studio column shows company-wide Studio. Studio for a single production (${PRO_PRICING.project_lifetime.amount} once) adds the Studio tool suite to that production only.
        </p>
      </div>

      {/* Final CTA */}
      <div className="py-16 text-center px-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,95,31,0.04)' }}>
        <div className="flex items-center gap-2.5 mb-5 justify-center">
          <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
          <span className="ss-label">Get Started</span>
          <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3" style={{ letterSpacing: '-0.03em' }}>UPGRADE YOUR PRODUCTION.</h2>
        <p className="text-white/45 text-sm mb-8 max-w-xl mx-auto leading-relaxed">
          The free tools stay free. Pro is for when you need the things a paying production actually needs.
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
