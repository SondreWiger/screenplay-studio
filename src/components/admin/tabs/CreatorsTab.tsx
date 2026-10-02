'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PayoutPreviewItem } from '../types';
import { useSiteSetting } from '../data';

export function CreatorsTab({ programEnabled, payoutEnabled }: { programEnabled: boolean; payoutEnabled: boolean }) {
  const supabase = createClient();

  type CreatorApplication = {
    id: string;
    user_id: string;
    ref_code: string;
    status: 'pending' | 'approved' | 'rejected';
    application_note: string | null;
    applied_at: string;
    approved_at: string | null;
    rejected_reason: string | null;
    social_instagram: string | null;
    social_twitter: string | null;
    social_tiktok: string | null;
    social_youtube: string | null;
    profile: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
  };

  type PayoutBatch = {
    id: string;
    period_start: string;
    period_end: string;
    total_amount: number;
    status: string;
    created_at: string;
  };

  const [creators, setCreators] = useState<CreatorApplication[]>([]);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<{ id: string; reason: string } | null>(null);

  // Payout calculator
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutPeriodStart, setPayoutPeriodStart] = useState('');
  const [payoutPeriodEnd, setPayoutPeriodEnd] = useState('');
  const [payoutPreview, setPayoutPreview] = useState<PayoutPreviewItem[]>([]);
  const [payoutBatchId, setPayoutBatchId] = useState<string | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [batches, setBatches] = useState<PayoutBatch[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('creator_profiles')
      .select('id,user_id,ref_code,status,application_note,applied_at,approved_at,rejected_reason,social_instagram,social_twitter,social_tiktok,social_youtube,profile:profiles!creator_profiles_user_id_fkey(full_name,username,avatar_url)')
      .eq('status', filterStatus)
      .order('applied_at', { ascending: false });
    setCreators((data as unknown as CreatorApplication[]) || []);
    setLoading(false);
  };

  const loadBatches = async () => {
    const { data } = await supabase.from('creator_payout_batches').select('*').order('created_at', { ascending: false }).limit(10);
    setBatches((data as PayoutBatch[]) || []);
  };

  useEffect(() => { load(); }, [filterStatus]);
  useEffect(() => { if (payoutEnabled) loadBatches(); }, [payoutEnabled]);

  const approve = async (id: string) => {
    setActionLoading(id);
    await supabase.from('creator_profiles').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'f0e0c4a4-0833-4c64-b012-15829c087c77' }).eq('id', id);
    setCreators(cs => cs.filter(c => c.id !== id));
    setActionLoading(null);
  };

  const reject = async (id: string, reason: string) => {
    setActionLoading(id);
    await supabase.from('creator_profiles').update({ status: 'rejected', rejected_reason: reason }).eq('id', id);
    setCreators(cs => cs.filter(c => c.id !== id));
    setActionLoading(null);
    setRejectReason(null);
  };

  const computePayout = async () => {
    if (!payoutAmount || !payoutPeriodStart || !payoutPeriodEnd) return;
    setPayoutLoading(true);
    // Create a draft batch
    const { data: batch } = await supabase.from('creator_payout_batches').insert({
      period_start: payoutPeriodStart,
      period_end: payoutPeriodEnd,
      total_amount: parseFloat(payoutAmount),
      status: 'draft',
    }).select().single();
    if (!batch) { setPayoutLoading(false); return; }
    setPayoutBatchId(batch.id);
    // Call the stored function
    await supabase.rpc('compute_creator_payout_items', {
      p_batch_id: batch.id,
      p_start: payoutPeriodStart,
      p_end: payoutPeriodEnd,
      p_total: parseFloat(payoutAmount),
    });
    const { data: items } = await supabase
      .from('creator_payout_items')
      .select('id,creator_id,signups_count,proportion,amount,creator:creator_profiles!creator_payout_items_creator_id_fkey(ref_code,profile:profiles!creator_profiles_user_id_fkey(full_name,username))')
      .eq('batch_id', batch.id)
      .order('amount', { ascending: false });
    setPayoutPreview((items as unknown as PayoutPreviewItem[]) || []);
    loadBatches();
    setPayoutLoading(false);
  };

  const markPaid = async () => {
    if (!payoutBatchId) return;
    await supabase.from('creator_payout_batches').update({ status: 'paid' }).eq('id', payoutBatchId);
    setPayoutBatchId(null);
    setPayoutPreview([]);
    setPayoutAmount('');
    setPayoutPeriodStart('');
    setPayoutPeriodEnd('');
    loadBatches();
  };

  const statusColors: Record<string, string> = {
    pending: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    approved: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    rejected: 'text-red-400 border-red-500/30 bg-red-500/10',
    draft: 'text-surface-400 border-surface-600 bg-surface-800',
    paid: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Creator Program</h1>
      <p className="text-sm text-surface-400 mb-8">Manage affiliate creator applications and payouts</p>

      {!programEnabled && (
        <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="text-sm text-yellow-400">Creator Program is currently <strong>disabled</strong>. Toggle it on in the System tab to let users apply.</p>
        </div>
      )}

      {/* Applications */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-white">Applications</h2>
          <div className="flex gap-1">
            {(['pending', 'approved', 'rejected'] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  filterStatus === s ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'
                }`}>{s}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-surface-500">Loading…</p>
        ) : creators.length === 0 ? (
          <p className="text-sm text-surface-500">No {filterStatus} applications.</p>
        ) : (
          <div className="space-y-3">
            {creators.map((c) => (
              <div key={c.id} className="rounded-xl border border-surface-800 bg-surface-900/50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.profile?.avatar_url && (
                      <img src={c.profile.avatar_url} className="w-9 h-9 rounded-full shrink-0 object-cover" alt="" loading="lazy" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white truncate">{c.profile?.full_name || c.profile?.username || c.user_id.slice(0, 8)}</span>
                        <span className="text-xs text-surface-500">@{c.profile?.username}</span>
                        <span className="font-mono text-xs text-brand-500">/ref/{c.ref_code}</span>
                      </div>
                      {c.application_note && (
                        <p className="text-xs text-surface-400 mt-1 italic">&quot;{c.application_note}&quot;</p>
                      )}
                      <div className="flex gap-3 mt-1 flex-wrap">
                        {c.social_instagram && <span className="text-xs text-surface-500">IG: @{c.social_instagram}</span>}
                        {c.social_twitter && <span className="text-xs text-surface-500">X: @{c.social_twitter}</span>}
                        {c.social_tiktok && <span className="text-xs text-surface-500">TT: @{c.social_tiktok}</span>}
                        {c.social_youtube && <span className="text-xs text-surface-500">YT: @{c.social_youtube}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-surface-500">{new Date(c.applied_at).toLocaleDateString()}</span>
                    {filterStatus === 'pending' && (
                      <>
                        <button onClick={() => approve(c.id)} disabled={actionLoading === c.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors disabled:opacity-50">
                          {actionLoading === c.id ? '…' : 'Approve'}
                        </button>
                        <button onClick={() => setRejectReason({ id: c.id, reason: '' })}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">
                          Reject
                        </button>
                      </>
                    )}
                    {filterStatus === 'rejected' && c.rejected_reason && (
                      <span className="text-xs text-surface-500 italic max-w-xs truncate">&quot;{c.rejected_reason}&quot;</span>
                    )}
                  </div>
                </div>
                {/* Reject inline form */}
                {rejectReason?.id === c.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={rejectReason.reason}
                      onChange={(e) => setRejectReason({ ...rejectReason, reason: e.target.value })}
                      placeholder="Rejection reason (optional)"
                      className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                    <button onClick={() => reject(c.id, rejectReason.reason)} disabled={actionLoading === c.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50">
                      {actionLoading === c.id ? '…' : 'Confirm'}
                    </button>
                    <button onClick={() => setRejectReason(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-800 text-surface-400 hover:text-white transition-colors">Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payout Calculator */}
      {payoutEnabled && (
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
          <h2 className="text-base font-semibold text-white mb-1">Monthly Payout Calculator</h2>
          <p className="text-xs text-surface-500 mb-5">Distribute a fixed amount proportionally among creators based on signups in the period.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Period start</label>
              <input type="date" value={payoutPeriodStart} onChange={(e) => setPayoutPeriodStart(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Period end</label>
              <input type="date" value={payoutPeriodEnd} onChange={(e) => setPayoutPeriodEnd(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Total amount (USD)</label>
              <input type="number" min="0" step="0.01" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="e.g. 500"
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none" />
            </div>
          </div>

          <button onClick={computePayout} disabled={payoutLoading || !payoutAmount || !payoutPeriodStart || !payoutPeriodEnd}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-500 text-white hover:bg-brand-500 transition-colors disabled:opacity-50 mb-5">
            {payoutLoading ? 'Computing…' : 'Compute Payout'}
          </button>

          {payoutPreview.length > 0 && (
            <div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800">
                    <th className="text-left text-xs text-surface-500 font-medium pb-2">Creator</th>
                    <th className="text-right text-xs text-surface-500 font-medium pb-2">Signups</th>
                    <th className="text-right text-xs text-surface-500 font-medium pb-2">Share</th>
                    <th className="text-right text-xs text-surface-500 font-medium pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/50">
                  {payoutPreview.map((item: PayoutPreviewItem) => (
                    <tr key={item.id}>
                      <td className="py-2 text-white">{item.creator?.profile?.full_name || item.creator?.profile?.username || '—'} <span className="text-surface-500 text-xs">/ref/{item.creator?.ref_code}</span></td>
                      <td className="py-2 text-right text-surface-300">{item.signups_count}</td>
                      <td className="py-2 text-right text-surface-300">{(item.proportion * 100).toFixed(1)}%</td>
                      <td className="py-2 text-right font-semibold text-emerald-400">${Number(item.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={markPaid}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">
                  Mark as Paid
                </button>
                <button onClick={() => { setPayoutPreview([]); setPayoutBatchId(null); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-surface-800 text-surface-400 hover:text-white transition-colors">
                  Discard
                </button>
              </div>
            </div>
          )}

          {batches.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-white mb-3">Recent Batches</h3>
              <div className="space-y-2">
                {batches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-900 px-4 py-2">
                    <span className="text-sm text-white">{b.period_start} → {b.period_end}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-white">${Number(b.total_amount).toFixed(2)}</span>
                      <span className={`text-[11px] font-bold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded border ${statusColors[b.status] || ''}`}>{b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CreatorsPanel() {
  const [programEnabled] = useSiteSetting('creator_program_enabled', false);
  const [payoutEnabled] = useSiteSetting('creator_payout_enabled', false);
  return <CreatorsTab programEnabled={programEnabled} payoutEnabled={payoutEnabled} />;
}
