'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures, formatBytes } from '@/hooks/useProFeatures';
import { Button, Card, Badge, LoadingPage, Progress } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { useFeatureAccess } from '@/components/FeatureGate';
import type { Subscription, TeamLicense } from '@/lib/types';

// ============================================================
// Settings / Billing — Subscription management
// ============================================================

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const { isPro, subscription, storageUsed, storageLimit, loading: proLoading, refreshSubscription } = useProFeatures();
  const { canUse: canUseFeature, loading: flagsLoading } = useFeatureAccess();
  const [licenses, setLicenses] = useState<TeamLicense[]>([]);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchLicenses();
  }, [user?.id]);

  // Gate: if pro_subscription flag is not accessible, redirect
  if (!authLoading && !flagsLoading && !canUseFeature('pro_subscription')) {
    return (
      <div className="min-h-screen bg-surface-950">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <p className="text-surface-400">Billing is not available yet.</p>
        </div>
      </div>
    );
  }

  const fetchLicenses = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('team_licenses')
      .select('*, recipient:profiles!recipient_id(*)')
      .eq('purchaser_id', user!.id)
      .order('created_at', { ascending: false });
    setLicenses(data || []);
  };

  const handleCancel = async () => {
    if (!subscription) return;
    if (!confirm('Are you sure you want to cancel your Pro subscription? It will remain active until the end of your billing period.')) return;
    setCancelling(true);
    const supabase = createClient();
    await supabase.from('subscriptions').update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    }).eq('id', subscription.id);
    await refreshSubscription();
    setCancelling(false);
  };

  if (authLoading || proLoading) return <LoadingPage />;
  if (!user) return null;

  const storagePercent = storageLimit > 0 ? Math.round((storageUsed / storageLimit) * 100) : 0;
  const periodEnd = subscription ? new Date(subscription.current_period_end) : null;

  return (
    <div className="min-h-screen bg-surface-950">
      <AppHeader />
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-16">
        <h1 className="text-2xl font-black text-white mb-8" style={{ letterSpacing: '-0.03em' }}>BILLING &amp; SUBSCRIPTION</h1>

        {/* Current Plan */}
        <Card className="p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-semibold text-white">Current Plan</h2>
                {isPro ? (
                  <Badge variant="warning">⭐ Pro</Badge>
                ) : (
                  <Badge>Free</Badge>
                )}
              </div>
              {isPro && subscription ? (
                <div className="space-y-1">
                  <p className="text-sm text-surface-400">
                    {subscription.billing_cycle === 'yearly' ? 'Annual' : 'Monthly'} plan • ${(subscription.price_cents / 100).toFixed(2)}/{subscription.billing_cycle === 'yearly' ? 'year' : 'month'}
                  </p>
                  <p className="text-sm text-surface-400">
                    {subscription.cancel_at_period_end
                      ? <span className="text-amber-400">Cancels on {periodEnd?.toLocaleDateString()}</span>
                      : <>Renews {periodEnd?.toLocaleDateString()}</>
                    }
                  </p>
                  {subscription.payment_method === 'dev_bypass' && (
                    <p className="text-xs text-amber-500/60 mt-1">🔧 Dev bypass — no payment charged</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-surface-400">You're on the free plan. All core features are included.</p>
              )}
            </div>
            <div>
              {isPro ? (
                <div className="flex gap-2">
                  {!subscription?.cancel_at_period_end && (
                    <Button variant="ghost" size="sm" onClick={handleCancel} loading={cancelling}>
                      Cancel Plan
                    </Button>
                  )}
                </div>
              ) : (
                <Link href="/pro">
                  <Button size="sm">Upgrade to Pro</Button>
                </Link>
              )}
            </div>
          </div>
        </Card>

        {/* Storage Usage */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Storage</h2>
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-surface-400">{formatBytes(storageUsed)} used</span>
              <span className="text-surface-400">{formatBytes(storageLimit)} total</span>
            </div>
            <Progress value={storagePercent} />
          </div>
          <p className="text-xs text-surface-500">
            {isPro
              ? 'Pro storage: 50 GB for project assets, storyboards, mood boards, and uploads.'
              : 'Free storage: 1 GB. Upgrade to Pro for 50 GB.'}
          </p>
        </Card>

        {/* Team Licenses */}
        {isPro && (
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Team Licenses</h2>
              <Link href="/pro/team">
                <Button variant="secondary" size="sm">Buy More Seats</Button>
              </Link>
            </div>
            {licenses.length > 0 ? (
              <div className="space-y-2">
                {licenses.map((lic) => (
                  <div key={lic.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-800/50">
                    <div>
                      <p className="text-sm text-white">
                        {lic.recipient?.full_name || lic.recipient?.email || lic.recipient_email || 'Unclaimed'}
                      </p>
                      <p className="text-xs text-surface-500">
                        Expires {new Date(lic.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={lic.status === 'active' ? 'success' : lic.status === 'pending' ? 'warning' : 'error'}>
                      {lic.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-500">No team licenses purchased yet. Buy seats for your team at a 20% discount.</p>
            )}
          </Card>
        )}

        {/* Pro feature summary */}
        {isPro && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Your Pro Features</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Version History', icon: '🔄' },
                { label: 'External Shares', icon: '📤' },
                { label: 'Client Reviews', icon: '📝' },
                { label: 'Team Analytics', icon: '📊' },
                { label: 'Custom Branding', icon: '🏢' },
                { label: 'Advanced Exports', icon: '📑' },
                { label: 'Adv. Scheduling', icon: '📅' },
                { label: 'API Access', icon: '🔗' },
                { label: 'Priority Support', icon: '⚡' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 p-2 rounded-lg bg-surface-800/30">
                  <span>{f.icon}</span>
                  <span className="text-xs text-surface-300">{f.label}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
