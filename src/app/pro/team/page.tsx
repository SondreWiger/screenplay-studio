'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { Button, Card, Badge, Input, LoadingPage, toast, ToastContainer } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { PRO_PRICING, type TeamLicense, type Company } from '@/lib/types';

// ============================================================
// Team Licensing — Corporate bulk seat purchase
// ============================================================

export default function TeamLicensingPage() {
  const { user, loading: authLoading } = useAuth();
  const { isPro } = useProFeatures();
  const router = useRouter();
  const [licenses, setLicenses] = useState<TeamLicense[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Purchase form
  const [seats, setSeats] = useState(2);
  const [emails, setEmails] = useState<string[]>(['', '']);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [purchasing, setPurchasing] = useState(false);
  const [devBypass, setDevBypass] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalError, setPaypalError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    const supabase = createClient();
    const [licRes, compRes] = await Promise.all([
      supabase.from('team_licenses').select('*, recipient:profiles!recipient_id(*)').eq('purchaser_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('companies').select('*').order('name'),
    ]);
    setLicenses(licRes.data || []);
    setCompanies(compRes.data || []);
    setLoading(false);
  };

  const handleSeatsChange = (n: number) => {
    const count = Math.max(1, n);
    setSeats(count);
    setEmails(prev => {
      const next = [...prev];
      while (next.length < count) next.push('');
      return next.slice(0, count);
    });
  };

  const handlePayPalTeamCheckout = async () => {
    if (!user) { router.push('/auth/login'); return; }
    const validEmails = emails.filter(e => e.trim() && e.includes('@'));
    if (validEmails.length === 0) {
      toast('Enter at least one email address', 'error');
      return;
    }
    setPaypalLoading(true);
    setPaypalError(null);
    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'team', seats: validEmails.length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');

      // Store order details for post-payment license creation
      sessionStorage.setItem('paypal_order_id', data.id);
      sessionStorage.setItem('paypal_plan', 'team');
      sessionStorage.setItem('paypal_team_emails', JSON.stringify(validEmails));
      sessionStorage.setItem('paypal_team_company', selectedCompany);

      const approveLink = data.links?.find((l: { rel: string; href: string }) => l.rel === 'payer-action' || l.rel === 'approve');
      if (approveLink?.href) {
        window.location.href = approveLink.href;
      } else {
        throw new Error('No approval URL returned from PayPal');
      }
    } catch (err: unknown) {
      console.error('PayPal team checkout error:', err);
      setPaypalError(err instanceof Error ? err.message : 'An error occurred');
      setPaypalLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!user) return;
    const validEmails = emails.filter(e => e.trim() && e.includes('@'));
    if (validEmails.length === 0) {
      toast('Enter at least one email address', 'error');
      return;
    }
    setPurchasing(true);
    const supabase = createClient();

    for (const email of validEmails) {
      // Check if recipient already has an account
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      await supabase.from('team_licenses').insert({
        purchaser_id: user.id,
        company_id: selectedCompany || null,
        recipient_id: existingProfile?.id || null,
        recipient_email: email.trim().toLowerCase(),
        status: existingProfile ? 'active' : 'pending',
        plan: 'pro',
        price_cents: PRO_PRICING.team_yearly.amount * 100,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        redeemed_at: existingProfile ? new Date().toISOString() : null,
      });

      // If recipient exists, upgrade them to Pro
      if (existingProfile) {
        await supabase.from('profiles').update({
          is_pro: true,
          pro_since: new Date().toISOString(),
          storage_limit_bytes: 50 * 1024 * 1024 * 1024,
        }).eq('id', existingProfile.id);
      }
    }

    toast(`${validEmails.length} team license(s) created!`, 'success');
    setEmails(new Array(seats).fill(''));
    await fetchData();
    setPurchasing(false);
  };

  const handleRevoke = async (licenseId: string) => {
    if (!confirm('Revoke this license? The user will lose Pro access at the end of their current period.')) return;
    const supabase = createClient();
    await supabase.from('team_licenses').update({ status: 'revoked' }).eq('id', licenseId);
    await fetchData();
    toast('License revoked');
  };

  if (authLoading || loading) return <LoadingPage />;
  if (!user) return null;

  const total = seats * PRO_PRICING.team_yearly.amount;
  const savingsVsIndividual = seats * (PRO_PRICING.yearly.amount - PRO_PRICING.team_yearly.amount);
  const activeLicenses = licenses.filter(l => l.status === 'active' || l.status === 'pending');

  return (
    <div className="min-h-screen bg-surface-950">
      <AppHeader />
      <ToastContainer />
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-16">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-2xl font-bold text-white">Team Licenses</h1>
          <Badge variant="warning">20% Discount</Badge>
        </div>

        {!isPro && (
          <Card className="p-6 mb-6 border border-amber-500/20">
            <div className="flex items-start gap-4">
              <span className="text-2xl">💡</span>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">You need Pro first</h3>
                <p className="text-sm text-surface-400 mb-3">Get Pro for yourself before purchasing team licenses.</p>
                <Link href="/pro"><Button size="sm">Upgrade to Pro</Button></Link>
              </div>
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Purchase Form */}
          <div className="lg:col-span-3">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Buy Team Seats</h2>
              <p className="text-sm text-surface-400 mb-6">
                Each seat gives a user full Pro access for 1 year. ${PRO_PRICING.team_yearly.amount}/seat — {PRO_PRICING.team_yearly.discount}% off individual pricing.
              </p>

              {companies.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Company (optional)</label>
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white"
                  >
                    <option value="">No company</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Number of Seats</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleSeatsChange(seats - 1)} className="w-10 h-10 rounded-lg bg-surface-800 text-white hover:bg-surface-700 flex items-center justify-center text-lg">−</button>
                  <input
                    type="number"
                    min={1}
                    value={seats}
                    onChange={(e) => handleSeatsChange(parseInt(e.target.value) || 1)}
                    className="w-20 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white text-center"
                  />
                  <button onClick={() => handleSeatsChange(seats + 1)} className="w-10 h-10 rounded-lg bg-surface-800 text-white hover:bg-surface-700 flex items-center justify-center text-lg">+</button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Team Member Emails</label>
                <div className="space-y-2">
                  {emails.map((email, i) => (
                    <Input
                      key={i}
                      type="email"
                      placeholder={`team-member-${i + 1}@company.com`}
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const next = [...emails];
                        next[i] = e.target.value;
                        setEmails(next);
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs text-surface-500 mt-2">
                  Users with existing accounts will be upgraded immediately. New users will receive a pending license to claim when they sign up.
                </p>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-lg bg-surface-800/50 border border-surface-700 mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-surface-400">{seats} × Pro Team License</span>
                  <span className="text-white font-medium">${total}.00</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-surface-400">You save vs individual</span>
                  <span className="text-green-400">-${savingsVsIndividual}.00</span>
                </div>
                {seats >= 10 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-400">Volume bonus (10+ seats)</span>
                    <span className="text-amber-400">Contact us for extra discount</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {paypalError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-400">{paypalError}</p>
                  </div>
                )}
                <Button
                  className="w-full bg-[#0070BA] hover:bg-[#005ea6] text-white"
                  onClick={handlePayPalTeamCheckout}
                  loading={paypalLoading}
                  disabled={!isPro}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .757-.644h6.568c2.175 0 3.806.567 4.85 1.684 1.004 1.073 1.38 2.533 1.115 4.34-.012.083-.025.166-.04.25-.358 2.078-1.312 3.678-2.834 4.762-1.478 1.055-3.382 1.59-5.66 1.59H8.293a.77.77 0 0 0-.757.645l-.46 2.99z"/>
                      <path d="M19.441 7.516c-.03.175-.063.355-.1.54-.878 4.522-3.883 6.083-7.723 6.083H9.663a.951.951 0 0 0-.938.803l-.997 6.327a.497.497 0 0 0 .49.576h3.443a.67.67 0 0 0 .66-.562l.027-.142.523-3.316.034-.183a.67.67 0 0 1 .66-.562h.416c2.69 0 4.797-1.093 5.414-4.254.258-1.322.124-2.424-.558-3.2a2.647 2.647 0 0 0-.396-.31z" opacity=".7"/>
                    </svg>
                    Pay ${total}.00 with PayPal
                  </span>
                </Button>
                <Button
                  variant="secondary"
                  className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={handlePurchase}
                  loading={purchasing}
                  disabled={!isPro}
                >
                  🔧 Dev Bypass — Create Licenses Free
                </Button>
              </div>
            </Card>
          </div>

          {/* Active Licenses Sidebar */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Active Licenses
                {activeLicenses.length > 0 && (
                  <span className="text-sm font-normal text-surface-400 ml-2">({activeLicenses.length})</span>
                )}
              </h2>
              {licenses.length > 0 ? (
                <div className="space-y-3">
                  {licenses.map((lic) => (
                    <div key={lic.id} className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm text-white font-medium truncate">
                          {lic.recipient?.full_name || lic.recipient?.email || lic.recipient_email || 'Unclaimed'}
                        </p>
                        <Badge
                          variant={lic.status === 'active' ? 'success' : lic.status === 'pending' ? 'warning' : 'error'}
                        >
                          {lic.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-surface-500 mb-2">
                        Expires {new Date(lic.expires_at).toLocaleDateString()}
                      </p>
                      {(lic.status === 'active' || lic.status === 'pending') && (
                        <button
                          onClick={() => handleRevoke(lic.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-surface-500">
                  No licenses yet. Purchase seats to give your team Pro access.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
