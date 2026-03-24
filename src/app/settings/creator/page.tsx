'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Input, LoadingPage, toast } from '@/components/ui';

// ── Types ─────────────────────────────────────────────────────
interface CreatorProfile {
  id: string;
  ref_code: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  social_instagram: string | null;
  social_twitter: string | null;
  social_tiktok: string | null;
  social_youtube: string | null;
  application_note: string | null;
  applied_at: string;
  approved_at: string | null;
  rejected_reason: string | null;
}

interface CreatorStats {
  total_visits: number;
  total_signups: number;
  this_month_visits: number;
  this_month_signups: number;
  payouts: { amount: number; period_start: string; period_end: string; status: string }[];
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-surface-500 mb-1">{label}</p>
      <p className="text-3xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>{value}</p>
      {sub && <p className="text-xs text-surface-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function CreatorSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [programEnabled, setProgramEnabled] = useState(false);
  const [payoutEnabled, setPayoutEnabled] = useState(false);
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Application form state
  const [appNote, setAppNote] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [youtube, setYoutube] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit socials
  const [editingLinks, setEditingLinks] = useState(false);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function load() {
    setLoading(true);
    const supabase = createClient();

    const [settingRes, creatorRes] = await Promise.all([
      supabase.from('site_settings').select('key, value').in('key', ['creator_program_enabled', 'creator_payout_enabled']),
      supabase.from('creator_profiles').select('*').eq('user_id', user!.id).single(),
    ]);

    const settings = settingRes.data ?? [];
    setProgramEnabled(settings.find((s: any) => s.key === 'creator_program_enabled')?.value === 'true');
    setPayoutEnabled(settings.find((s: any) => s.key === 'creator_payout_enabled')?.value === 'true');

    const cp = creatorRes.data as CreatorProfile | null;
    setCreator(cp);

    if (cp?.id) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [totalVisit, totalSignup, monthVisit, monthSignup, payoutItems] = await Promise.all([
        supabase.from('creator_referral_events').select('id', { count: 'exact', head: true }).eq('creator_id', cp.id).eq('event_type', 'visit'),
        supabase.from('creator_referral_events').select('id', { count: 'exact', head: true }).eq('creator_id', cp.id).eq('event_type', 'signup'),
        supabase.from('creator_referral_events').select('id', { count: 'exact', head: true }).eq('creator_id', cp.id).eq('event_type', 'visit').gte('created_at', monthStart),
        supabase.from('creator_referral_events').select('id', { count: 'exact', head: true }).eq('creator_id', cp.id).eq('event_type', 'signup').gte('created_at', monthStart),
        supabase.from('creator_payout_items').select('amount, creator_payout_batches(period_start, period_end, status)').eq('creator_id', cp.id).order('created_at', { ascending: false }).limit(12),
      ]);

      setStats({
        total_visits: totalVisit.count ?? 0,
        total_signups: totalSignup.count ?? 0,
        this_month_visits: monthVisit.count ?? 0,
        this_month_signups: monthSignup.count ?? 0,
        payouts: (payoutItems.data ?? []).map((p: any) => ({
          amount: p.amount,
          period_start: p.creator_payout_batches?.period_start,
          period_end: p.creator_payout_batches?.period_end,
          status: p.creator_payout_batches?.status,
        })),
      });
    }

    setLoading(false);
  }

  async function handleApply() {
    if (!user) return;
    setSubmitting(true);
    const supabase = createClient();

    // Get user's username to use as ref_code
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
    const ref_code = profile?.username;

    if (!ref_code) {
      toast.error('Set a username in Profile settings before applying.');
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('creator_profiles').insert({
      user_id: user.id,
      ref_code,
      application_note: appNote.trim() || null,
      social_instagram: instagram.trim() || null,
      social_twitter: twitter.trim() || null,
      social_tiktok: tiktok.trim() || null,
      social_youtube: youtube.trim() || null,
    });

    if (error) {
      toast.error(error.message.includes('unique') ? 'You have already applied.' : error.message);
    } else {
      toast.success('Application submitted! We\'ll review it shortly.');
      load();
    }
    setSubmitting(false);
  }

  async function handleSaveSocials() {
    if (!creator) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from('creator_profiles').update({
      social_instagram: instagram.trim() || null,
      social_twitter: twitter.trim() || null,
      social_tiktok: tiktok.trim() || null,
      social_youtube: youtube.trim() || null,
    }).eq('id', creator.id);

    if (error) { toast.error(error.message); }
    else { toast.success('Links updated.'); setEditingLinks(false); load(); }
    setSubmitting(false);
  }

  // Pre-fill edit form from creator data
  function startEditLinks() {
    if (!creator) return;
    setInstagram(creator.social_instagram ?? '');
    setTwitter(creator.social_twitter ?? '');
    setTiktok(creator.social_tiktok ?? '');
    setYoutube(creator.social_youtube ?? '');
    setEditingLinks(true);
  }

  if (authLoading || loading) return <LoadingPage />;
  if (!user) { router.replace('/auth/login'); return null; }

  const refUrl = creator ? `${typeof window !== 'undefined' ? window.location.origin : 'https://screenplaystudio.fun'}/ref/${creator.ref_code}` : '';

  return (
    <div className="min-h-screen" style={{ background: '#070710' }}>
      <AppHeader />

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-surface-500 mb-6 font-mono uppercase tracking-wider">
          <Link href="/settings" className="hover:text-white transition-colors">Settings</Link>
          <span>/</span>
          <span className="text-white">Creator Program</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>CREATOR PROGRAM</h1>
          <p className="text-surface-400 text-sm mt-1">Share your referral link, grow the community, earn when payouts go live.</p>
        </div>

        {/* Program disabled banner */}
        {!programEnabled && !creator && (
          <Card className="p-6 border-surface-700">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Creator Program coming soon</h3>
                <p className="text-sm text-surface-400">Applications aren't open yet. Check back soon — we'll announce it when the program launches.</p>
              </div>
            </div>
          </Card>
        )}

        {/* === Not applied yet === */}
        {programEnabled && !creator && (
          <Card className="p-6">
            <h2 className="text-base font-semibold text-white mb-1">Apply to become a Creator</h2>
            <p className="text-sm text-surface-400 mb-5">
              Creators get a personal referral link at <code className="text-[#FF5F1F]">screenplaystudio.fun/ref/[username]</code>. Your social links will appear on your public profile and on the referral landing page.
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" />
                <Input label="X / Twitter" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" />
                <Input label="TikTok" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@handle" />
                <Input label="YouTube" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="@channel or URL" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Why do you want to be a creator? <span className="text-surface-500">(optional)</span></label>
                <textarea
                  value={appNote}
                  onChange={(e) => setAppNote(e.target.value)}
                  rows={3}
                  placeholder="Tell us a bit about your audience or how you plan to share the link..."
                  className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white placeholder:text-surface-600 outline-none focus:border-[#FF5F1F] resize-none"
                />
              </div>
              <p className="text-[11px] text-surface-500">
                By applying you agree to the{' '}
                <Link href="/legal/creator-terms" className="text-[#FF5F1F] hover:underline" target="_blank">Creator Program Terms</Link>.
                No payout is automatic or retroactive.
              </p>
              <Button onClick={handleApply} disabled={submitting} style={{ background: '#FF5F1F', color: '#fff' }}>
                {submitting ? 'Submitting…' : 'Submit Application'}
              </Button>
            </div>
          </Card>
        )}

        {/* === Pending === */}
        {creator?.status === 'pending' && (
          <div className="p-6 rounded-xl border border-amber-500/20 bg-surface-900/60">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded border text-amber-400 border-amber-500/30 bg-amber-500/10">Under Review</span>
            </div>
            <p className="text-sm text-surface-300">Your application is in the queue. We'll notify you once it's reviewed — usually within a few days.</p>
            <p className="text-xs text-surface-500 mt-2">Applied {new Date(creator.applied_at).toLocaleDateString()}</p>
          </div>
        )}

        {/* === Rejected === */}
        {creator?.status === 'rejected' && (
          <div className="p-6 rounded-xl border border-red-500/20 bg-surface-900/60">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded border text-red-400 border-red-500/30 bg-red-500/10">Not Approved</span>
            </div>
            {creator.rejected_reason && (
              <p className="text-sm text-surface-300 mb-2">{creator.rejected_reason}</p>
            )}
            <p className="text-xs text-surface-500">You can reach out on the <Link href="/feedback" className="text-[#FF5F1F] hover:underline">feedback board</Link> if you have questions.</p>
          </div>
        )}

        {/* === Approved === */}
        {creator?.status === 'approved' && (
          <div className="space-y-6">
            {/* Ref link */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-white">Your referral link</h2>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border text-emerald-400 border-emerald-500/30 bg-emerald-500/10">Active</span>
              </div>
              <p className="text-xs text-surface-500 mb-3">Share this link. Anyone who signs up through it counts toward your stats.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-[#FF5F1F] font-mono truncate">
                  {refUrl}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(refUrl); toast.success('Copied!'); }}
                >
                  Copy
                </Button>
              </div>
            </Card>

            {/* Stats */}
            {stats && (
              <div>
                <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">Your Stats</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Link visits" value={stats.total_visits} sub="All time" />
                  <StatCard label="Sign-ups" value={stats.total_signups} sub="All time" />
                  <StatCard label="Visits" value={stats.this_month_visits} sub="This month" />
                  <StatCard label="Sign-ups" value={stats.this_month_signups} sub="This month" />
                </div>
              </div>
            )}

            {/* Payout section (only visible when payout is enabled) */}
            {payoutEnabled && stats && (
              <Card className="p-6">
                <h2 className="text-base font-semibold text-white mb-1">Payouts</h2>
                <p className="text-xs text-surface-500 mb-4">
                  Payouts are distributed proportionally on the 12th of each month based on signups that month.{' '}
                  <Link href="/legal/creator-terms" className="text-[#FF5F1F] hover:underline" target="_blank">Terms apply.</Link>
                </p>
                {stats.payouts.length === 0 ? (
                  <p className="text-sm text-surface-500 italic">No payouts yet.</p>
                ) : (
                  <div className="space-y-2">
                    {stats.payouts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                        <span className="text-xs text-surface-400">
                          {new Date(p.period_start).toLocaleDateString('en', { month: 'short', year: 'numeric' })}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-white">{p.amount} NOK</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                            p.status === 'paid'
                              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                              : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                          }`}>{p.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Social links */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">Social Links</h2>
                {!editingLinks && (
                  <Button variant="ghost" size="sm" onClick={startEditLinks}>Edit</Button>
                )}
              </div>
              {editingLinks ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input label="Instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" />
                    <Input label="X / Twitter" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" />
                    <Input label="TikTok" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@handle" />
                    <Input label="YouTube" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="@channel or URL" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleSaveSocials} disabled={submitting} size="sm" style={{ background: '#FF5F1F', color: '#fff' }}>
                      {submitting ? 'Saving…' : 'Save'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingLinks(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {[
                    creator.social_instagram && { label: 'Instagram', handle: creator.social_instagram },
                    creator.social_twitter && { label: 'X / Twitter', handle: creator.social_twitter },
                    creator.social_tiktok && { label: 'TikTok', handle: creator.social_tiktok },
                    creator.social_youtube && { label: 'YouTube', handle: creator.social_youtube },
                  ].filter(Boolean).map((s: any) => (
                    <div key={s.label} className="text-xs text-surface-300 border border-surface-700 rounded-lg px-3 py-2">
                      <span className="text-surface-500">{s.label}:</span> {s.handle}
                    </div>
                  ))}
                  {!creator.social_instagram && !creator.social_twitter && !creator.social_tiktok && !creator.social_youtube && (
                    <p className="text-sm text-surface-500 italic">No social links added yet.</p>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
