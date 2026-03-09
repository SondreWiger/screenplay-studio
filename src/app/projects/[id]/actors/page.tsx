'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Modal, Input, Textarea, EmptyState, LoadingSpinner, Badge, toast } from '@/components/ui';
import { cn, formatCurrency } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

// ============================================================
// Types
// ============================================================

type PayUnit = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'per_episode' | 'flat';
type ContractStatus = 'negotiating' | 'pending' | 'signed' | 'on_set' | 'completed' | 'released';
type PaymentStatus = 'unpaid' | 'paid' | 'overdue' | 'cancelled';
type DocType = 'nda' | 'contract' | 'work_agreement' | 'id_proof' | 'insurance' | 'work_permit' | 'citizenship' | 'negotiation' | 'other';

interface CastMember {
  id: string;
  name: string;
  character_roles: string[];
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  bio: string | null;
  notes: string | null;
  availability: string | null;
  pay_amount: number | null;
  pay_unit: PayUnit;
  pay_currency: string;
  contract_status: ContractStatus;
  created_at: string;
}

interface CastPayment {
  id: string;
  cast_member_id: string;
  amount: number;
  currency: string;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  paid_at: string | null;
  status: PaymentStatus;
  notes: string | null;
  created_at: string;
}

interface CastDocument {
  id: string;
  cast_member_id: string;
  doc_type: DocType;
  title: string;
  file_url: string | null;
  file_name: string | null;
  notes: string | null;
  expires_at: string | null;
  created_at: string;
}

// ============================================================
// Constants
// ============================================================

const PAY_UNITS: { value: PayUnit; label: string }[] = [
  { value: 'flat',        label: 'Flat Fee' },
  { value: 'daily',       label: 'Per Day' },
  { value: 'weekly',      label: 'Per Week' },
  { value: 'monthly',     label: 'Per Month' },
  { value: 'per_episode', label: 'Per Episode' },
  { value: 'hourly',      label: 'Per Hour' },
];

const CONTRACT_STATUSES: { value: ContractStatus; label: string; color: string }[] = [
  { value: 'negotiating', label: 'Negotiating', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { value: 'pending',     label: 'Sent / Pending', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'signed',      label: 'Signed', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { value: 'on_set',      label: 'On Set', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { value: 'completed',   label: 'Completed', color: 'bg-surface-600/40 text-surface-300 border-surface-600' },
  { value: 'released',    label: 'Released', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
];

const PAYMENT_STATUSES: { value: PaymentStatus; label: string; color: string }[] = [
  { value: 'unpaid',    label: 'Unpaid',    color: 'bg-yellow-500/20 text-yellow-300' },
  { value: 'paid',      label: 'Paid',      color: 'bg-green-500/20 text-green-300' },
  { value: 'overdue',   label: 'Overdue',   color: 'bg-red-500/20 text-red-300' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-surface-700 text-surface-400' },
];

const DOC_TYPES: { value: DocType; label: string; icon: string }[] = [
  { value: 'contract',       label: 'Contract',            icon: '📄' },
  { value: 'nda',            label: 'NDA',                 icon: '🔒' },
  { value: 'work_agreement', label: 'Work Agreement',      icon: '🤝' },
  { value: 'negotiation',    label: 'Negotiation Record',  icon: '💬' },
  { value: 'id_proof',       label: 'ID / Passport',       icon: '🪪' },
  { value: 'citizenship',    label: 'Citizenship Docs',    icon: '🌐' },
  { value: 'work_permit',    label: 'Work Permit',         icon: '📋' },
  { value: 'insurance',      label: 'Insurance',           icon: '🛡️' },
  { value: 'other',          label: 'Other',               icon: '📎' },
];

function contractStatusMeta(s: ContractStatus) {
  return CONTRACT_STATUSES.find(x => x.value === s) ?? CONTRACT_STATUSES[0];
}
function paymentStatusMeta(s: PaymentStatus) {
  return PAYMENT_STATUSES.find(x => x.value === s) ?? PAYMENT_STATUSES[0];
}
function docTypeMeta(t: DocType) {
  return DOC_TYPES.find(x => x.value === t) ?? DOC_TYPES[DOC_TYPES.length - 1];
}
function payUnitLabel(u: PayUnit) {
  return PAY_UNITS.find(x => x.value === u)?.label ?? 'Flat Fee';
}

// Format pay rate for display
function formatPay(member: CastMember) {
  if (!member.pay_amount) return '—';
  const formatted = formatCurrency(member.pay_amount);
  const unit = payUnitLabel(member.pay_unit);
  if (member.pay_unit === 'flat') return `${formatted} flat`;
  return `${formatted} / ${unit.toLowerCase().replace('per ', '')}`;
}

// ============================================================
// Main Page
// ============================================================

type MainTab = 'roster' | 'payments' | 'overview';
type DetailTab = 'profile' | 'documents' | 'pay';

export default function ActorsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const canEdit = (() => {
    const role = members.find(m => m.user_id === user?.id)?.role
      ?? (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
    return role !== 'viewer';
  })();

  const [tab, setTab] = useState<MainTab>('roster');
  const [actors, setActors]     = useState<CastMember[]>([]);
  const [payments, setPayments] = useState<CastPayment[]>([]);
  const [documents, setDocuments] = useState<CastDocument[]>([]);
  const [loading, setLoading]   = useState(true);

  // Detail panel
  const [selected, setSelected]   = useState<CastMember | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('profile');

  // New / edit actor modal
  const [showActorModal, setShowActorModal] = useState(false);
  const [editingActor, setEditingActor]     = useState<Partial<CastMember> & { _roleInput?: string }>({});
  const [savingActor, setSavingActor]       = useState(false);

  // New payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [editingPay, setEditingPay]     = useState<Partial<CastPayment>>({});
  const [savingPay, setSavingPay]       = useState(false);

  // New document modal
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDoc, setEditingDoc]     = useState<Partial<CastDocument>>({});
  const [savingDoc, setSavingDoc]       = useState(false);

  // Payment filter
  const [payFilter, setPayFilter] = useState<PaymentStatus | 'all'>('all');

  const { confirm, ConfirmDialog } = useConfirmDialog();

  // ── Load data ──────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const sb = createClient();
    const [{ data: a }, { data: p }, { data: d }] = await Promise.all([
      sb.from('cast_members').select('*').eq('project_id', params.id).order('created_at', { ascending: true }),
      sb.from('cast_payments').select('*').eq('project_id', params.id).order('due_date', { ascending: true }),
      sb.from('cast_documents').select('*').eq('project_id', params.id).order('created_at', { ascending: false }),
    ]);
    if (a) setActors(a as CastMember[]);
    if (p) setPayments(p as CastPayment[]);
    if (d) setDocuments(d as CastDocument[]);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Keep selected in sync after reloads
  useEffect(() => {
    if (selected) setSelected(actors.find(a => a.id === selected.id) ?? null);
  }, [actors]);

  // ── Save actor ─────────────────────────────────────────────
  const saveActor = async () => {
    if (!editingActor.name?.trim() || !user) return;
    setSavingActor(true);
    const sb = createClient();
    const roles = editingActor.character_roles ?? [];
    const payload = {
      project_id:      params.id,
      created_by:      user.id,
      name:            editingActor.name.trim(),
      character_roles: roles,
      email:           editingActor.email?.trim() || null,
      phone:           editingActor.phone?.trim() || null,
      photo_url:       editingActor.photo_url?.trim() || null,
      bio:             editingActor.bio?.trim() || null,
      notes:           editingActor.notes?.trim() || null,
      availability:    editingActor.availability?.trim() || null,
      pay_amount:      editingActor.pay_amount ?? null,
      pay_unit:        editingActor.pay_unit ?? 'flat',
      pay_currency:    editingActor.pay_currency ?? 'USD',
      contract_status: editingActor.contract_status ?? 'negotiating',
    };
    if (editingActor.id) {
      const { error } = await sb.from('cast_members').update(payload).eq('id', editingActor.id);
      if (error) { toast.error('Failed to save'); setSavingActor(false); return; }
      setActors(prev => prev.map(a => a.id === editingActor.id ? { ...a, ...payload } as CastMember : a));
      toast.success('Actor updated');
    } else {
      const { data, error } = await sb.from('cast_members').insert(payload).select().single();
      if (error) { toast.error('Failed to create'); setSavingActor(false); return; }
      setActors(prev => [...prev, data as CastMember]);
      toast.success('Actor added');
    }
    setShowActorModal(false);
    setEditingActor({});
    setSavingActor(false);
  };

  // ── Save payment ───────────────────────────────────────────
  const savePayment = async () => {
    if (!editingPay.amount || !editingPay.cast_member_id) return;
    setSavingPay(true);
    const sb = createClient();
    const payload = {
      project_id:    params.id,
      cast_member_id: editingPay.cast_member_id,
      amount:        editingPay.amount,
      currency:      editingPay.currency ?? 'USD',
      description:   editingPay.description?.trim() || null,
      period_start:  editingPay.period_start || null,
      period_end:    editingPay.period_end || null,
      due_date:      editingPay.due_date || null,
      paid_at:       editingPay.paid_at || null,
      status:        editingPay.status ?? 'unpaid',
      notes:         editingPay.notes?.trim() || null,
    };
    if (editingPay.id) {
      await sb.from('cast_payments').update(payload).eq('id', editingPay.id);
      setPayments(prev => prev.map(p => p.id === editingPay.id ? { ...p, ...payload } as CastPayment : p));
      toast.success('Payment updated');
    } else {
      const { data, error } = await sb.from('cast_payments').insert(payload).select().single();
      if (error) { toast.error('Failed to save payment'); setSavingPay(false); return; }
      setPayments(prev => [...prev, data as CastPayment]);
      toast.success('Payment added');
    }
    setShowPayModal(false);
    setEditingPay({});
    setSavingPay(false);
  };

  // ── Mark payment paid ──────────────────────────────────────
  const markPaid = async (payId: string) => {
    const sb = createClient();
    const paidAt = new Date().toISOString();
    await sb.from('cast_payments').update({ status: 'paid', paid_at: paidAt }).eq('id', payId);
    setPayments(prev => prev.map(p => p.id === payId ? { ...p, status: 'paid', paid_at: paidAt } : p));
    toast.success('Marked as paid');
  };

  // ── Save document ──────────────────────────────────────────
  const saveDocument = async () => {
    if (!editingDoc.title?.trim() || !editingDoc.cast_member_id) return;
    setSavingDoc(true);
    const sb = createClient();
    const payload = {
      project_id:    params.id,
      cast_member_id: editingDoc.cast_member_id,
      created_by:    user?.id,
      doc_type:      editingDoc.doc_type ?? 'other',
      title:         editingDoc.title.trim(),
      file_url:      editingDoc.file_url?.trim() || null,
      file_name:     editingDoc.file_name?.trim() || null,
      notes:         editingDoc.notes?.trim() || null,
      expires_at:    editingDoc.expires_at || null,
    };
    if (editingDoc.id) {
      await sb.from('cast_documents').update(payload).eq('id', editingDoc.id);
      setDocuments(prev => prev.map(d => d.id === editingDoc.id ? { ...d, ...payload } as CastDocument : d));
      toast.success('Document updated');
    } else {
      const { data, error } = await sb.from('cast_documents').insert(payload).select().single();
      if (error) { toast.error('Failed to save document'); setSavingDoc(false); return; }
      setDocuments(prev => [data as CastDocument, ...prev]);
      toast.success('Document added');
    }
    setShowDocModal(false);
    setEditingDoc({});
    setSavingDoc(false);
  };

  // ── Delete ─────────────────────────────────────────────────
  const deleteActor = async (actor: CastMember) => {
    const ok = await confirm({ title: `Delete "${actor.name}"?`, message: 'This deletes all their payments and documents too.', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    const sb = createClient();
    await sb.from('cast_members').delete().eq('id', actor.id);
    setActors(prev => prev.filter(a => a.id !== actor.id));
    setPayments(prev => prev.filter(p => p.cast_member_id !== actor.id));
    setDocuments(prev => prev.filter(d => d.cast_member_id !== actor.id));
    if (selected?.id === actor.id) setSelected(null);
    toast.success('Actor removed');
  };

  const deletePayment = async (pay: CastPayment) => {
    const ok = await confirm({ title: 'Delete payment?', message: 'This action cannot be undone.', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    await createClient().from('cast_payments').delete().eq('id', pay.id);
    setPayments(prev => prev.filter(p => p.id !== pay.id));
    toast.success('Payment deleted');
  };

  const deleteDocument = async (doc: CastDocument) => {
    const ok = await confirm({ title: `Delete "${doc.title}"?`, message: 'This action cannot be undone.', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    await createClient().from('cast_documents').delete().eq('id', doc.id);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    toast.success('Document deleted');
  };

  // ── Computed overview stats ────────────────────────────────
  const stats = useMemo(() => {
    const totalActors = actors.length;
    const signed = actors.filter(a => a.contract_status === 'signed' || a.contract_status === 'on_set' || a.contract_status === 'completed').length;

    const totalOwed = payments.filter(p => p.status === 'unpaid' || p.status === 'overdue')
      .reduce((s, p) => s + Number(p.amount), 0);
    const totalPaid = payments.filter(p => p.status === 'paid')
      .reduce((s, p) => s + Number(p.amount), 0);
    const overdue   = payments.filter(p => p.status === 'overdue').length;

    return { totalActors, signed, totalOwed, totalPaid, overdue };
  }, [actors, payments]);

  const actorPayments = (actorId: string) => payments.filter(p => p.cast_member_id === actorId);
  const actorDocs     = (actorId: string) => documents.filter(d => d.cast_member_id === actorId);
  const actorOwed     = (actorId: string) => actorPayments(actorId)
    .filter(p => p.status === 'unpaid' || p.status === 'overdue')
    .reduce((s, p) => s + Number(p.amount), 0);
  const actorPaid     = (actorId: string) => actorPayments(actorId)
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount), 0);

  const filteredPayments = payFilter === 'all' ? payments : payments.filter(p => p.status === payFilter);

  // ── Print overview ─────────────────────────────────────────
  const printOverview = () => window.print();

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 print:px-0 print:py-0">
      <ConfirmDialog />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Actors & Actresses</h1>
          <p className="text-sm text-surface-400 mt-1">
            {stats.totalActors} cast member{stats.totalActors !== 1 ? 's' : ''} · {stats.signed} contracted · {formatCurrency(stats.totalOwed)} outstanding
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditingActor({}); setShowActorModal(true); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Actor
          </Button>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Cast Members',  val: stats.totalActors },
          { label: 'Contracted',    val: stats.signed },
          { label: 'Outstanding',   val: formatCurrency(stats.totalOwed), warn: stats.totalOwed > 0 },
          { label: 'Total Paid',    val: formatCurrency(stats.totalPaid), good: true },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-surface-800 bg-surface-900/50 p-4">
            <p className={cn('text-xl font-bold', s.warn ? 'text-yellow-400' : s.good ? 'text-green-400' : 'text-white')}>{s.val}</p>
            <p className="text-xs text-surface-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-surface-900/60 rounded-xl border border-surface-800 p-1 w-fit">
        {(['roster', 'payments', 'overview'] as MainTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize',
              tab === t ? 'bg-[#FF5F1F] text-white' : 'text-surface-400 hover:text-white hover:bg-surface-800')}>
            {t}
          </button>
        ))}
      </div>

      {/* ── ROSTER ── */}
      {tab === 'roster' && (
        actors.length === 0 ? (
          <EmptyState
            icon={<svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
            title="No cast members yet"
            description="Add your actors and actresses to start tracking contracts, pay, and documents."
            action={canEdit ? <Button onClick={() => { setEditingActor({}); setShowActorModal(true); }}>Add First Actor</Button> : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Actor list */}
            <div className="lg:col-span-1 space-y-2">
              {actors.map(actor => {
                const meta = contractStatusMeta(actor.contract_status);
                const owed  = actorOwed(actor.id);
                const docs  = actorDocs(actor.id).length;
                const isSelected = selected?.id === actor.id;
                return (
                  <button key={actor.id} onClick={() => { setSelected(actor); setDetailTab('profile'); }}
                    className={cn('w-full text-left p-3 rounded-xl border transition-all',
                      isSelected ? 'border-[#FF5F1F]/50 bg-[#FF5F1F]/5' : 'border-surface-800 bg-surface-900/40 hover:border-surface-700')}>
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-700 flex items-center justify-center shrink-0 text-lg font-bold text-surface-400">
                        {actor.photo_url ? <img src={actor.photo_url} alt={actor.name} className="w-full h-full object-cover" /> : actor.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{actor.name}</p>
                        {actor.character_roles.length > 0 && (
                          <p className="text-[11px] text-surface-500 truncate">{actor.character_roles.join(', ')}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn('text-[9px] px-2 py-0.5 rounded-full border font-medium', meta.color)}>{meta.label}</span>
                      {actor.pay_amount && <span className="text-[9px] text-surface-400">{formatPay(actor)}</span>}
                      {owed > 0 && <span className="text-[9px] text-yellow-400">{formatCurrency(owed)} owed</span>}
                      {docs > 0 && <span className="text-[9px] text-surface-500">{docs} doc{docs !== 1 ? 's' : ''}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-2">
              {!selected ? (
                <div className="h-full flex items-center justify-center rounded-xl border border-surface-800 bg-surface-900/20 min-h-[300px]">
                  <p className="text-sm text-surface-600">Select a cast member to view details</p>
                </div>
              ) : (
                <div className="rounded-xl border border-surface-800 bg-surface-900/40">
                  {/* Detail header */}
                  <div className="flex items-start gap-4 p-5 border-b border-surface-800">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-700 flex items-center justify-center shrink-0 text-2xl font-bold text-surface-400">
                      {selected.photo_url ? <img src={selected.photo_url} alt={selected.name} className="w-full h-full object-cover" /> : selected.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-white">{selected.name}</h2>
                      {selected.character_roles.length > 0 && (
                        <p className="text-sm text-surface-400">{selected.character_roles.join(' · ')}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={cn('text-[9px] px-2 py-0.5 rounded-full border font-medium', contractStatusMeta(selected.contract_status).color)}>
                          {contractStatusMeta(selected.contract_status).label}
                        </span>
                        {selected.pay_amount && (
                          <span className="text-[10px] text-surface-400 font-medium">{formatPay(selected)}</span>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingActor({ ...selected }); setShowActorModal(true); }}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => deleteActor(selected)}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Detail tabs */}
                  <div className="flex gap-0.5 p-2 border-b border-surface-800">
                    {(['profile', 'documents', 'pay'] as DetailTab[]).map(dt => (
                      <button key={dt} onClick={() => setDetailTab(dt)}
                        className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize',
                          detailTab === dt ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white')}>
                        {dt === 'pay' ? `Pay & Payments (${actorPayments(selected.id).length})` : dt === 'documents' ? `Documents (${actorDocs(selected.id).length})` : 'Profile'}
                      </button>
                    ))}
                  </div>

                  {/* Profile tab */}
                  {detailTab === 'profile' && (
                    <div className="p-5 space-y-4">
                      {selected.bio && <p className="text-sm text-surface-300 leading-relaxed">{selected.bio}</p>}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {selected.email && (
                          <div><p className="text-[10px] text-surface-600 uppercase tracking-wider mb-0.5">Email</p>
                          <a href={`mailto:${selected.email}`} className="text-[#FF5F1F] hover:underline">{selected.email}</a></div>
                        )}
                        {selected.phone && (
                          <div><p className="text-[10px] text-surface-600 uppercase tracking-wider mb-0.5">Phone</p>
                          <a href={`tel:${selected.phone}`} className="text-surface-200">{selected.phone}</a></div>
                        )}
                        {selected.pay_amount && (
                          <div><p className="text-[10px] text-surface-600 uppercase tracking-wider mb-0.5">Pay Rate</p>
                          <p className="text-surface-200 font-semibold">{formatPay(selected)}</p></div>
                        )}
                        {selected.availability && (
                          <div><p className="text-[10px] text-surface-600 uppercase tracking-wider mb-0.5">Availability</p>
                          <p className="text-surface-200">{selected.availability}</p></div>
                        )}
                      </div>
                      {/* per-actor pay summary */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-800">
                        <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/20 p-3 text-center">
                          <p className="text-lg font-bold text-yellow-300">{formatCurrency(actorOwed(selected.id))}</p>
                          <p className="text-[10px] text-surface-500 mt-0.5">Outstanding</p>
                        </div>
                        <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3 text-center">
                          <p className="text-lg font-bold text-green-300">{formatCurrency(actorPaid(selected.id))}</p>
                          <p className="text-[10px] text-surface-500 mt-0.5">Paid to date</p>
                        </div>
                      </div>
                      {selected.notes && (
                        <div className="rounded-lg bg-surface-800/50 p-3 text-sm text-surface-400 italic">
                          {selected.notes}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Documents tab */}
                  {detailTab === 'documents' && (
                    <div className="p-5 space-y-3">
                      {canEdit && (
                        <Button variant="secondary" size="sm" onClick={() => { setEditingDoc({ cast_member_id: selected.id }); setShowDocModal(true); }}>
                          + Add Document
                        </Button>
                      )}
                      {actorDocs(selected.id).length === 0 ? (
                        <p className="text-sm text-surface-600 text-center py-8">No documents yet.</p>
                      ) : (
                        actorDocs(selected.id).map(doc => {
                          const dt = docTypeMeta(doc.doc_type);
                          const isExpired = doc.expires_at && new Date(doc.expires_at) < new Date();
                          return (
                            <div key={doc.id} className="flex items-start gap-3 p-3 rounded-xl border border-surface-800 bg-surface-900/30">
                              <span className="text-xl shrink-0 mt-0.5">{dt.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-white">{doc.title}</p>
                                  <span className="text-[9px] text-surface-500 border border-surface-700 px-1.5 py-0.5 rounded">{dt.label}</span>
                                  {isExpired && <span className="text-[9px] text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">Expired</span>}
                                  {doc.expires_at && !isExpired && <span className="text-[9px] text-surface-500">Expires {new Date(doc.expires_at).toLocaleDateString()}</span>}
                                </div>
                                {doc.notes && <p className="text-xs text-surface-500 mt-0.5">{doc.notes}</p>}
                                <div className="flex items-center gap-3 mt-1.5">
                                  {doc.file_url && (
                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                                      className="text-[10px] text-[#FF5F1F] hover:underline flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                      {doc.file_name ?? 'Open file'}
                                    </a>
                                  )}
                                  {canEdit && (
                                    <>
                                      <button onClick={() => { setEditingDoc({ ...doc }); setShowDocModal(true); }} className="text-[10px] text-surface-500 hover:text-white transition-colors">Edit</button>
                                      <button onClick={() => deleteDocument(doc)} className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors">Delete</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      {/* Print documents button */}
                      {actorDocs(selected.id).length > 0 && (
                        <Button variant="ghost" size="sm" onClick={printOverview} className="w-full mt-2">
                          🖨 Print Document List
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Pay & Payments tab */}
                  {detailTab === 'pay' && (
                    <div className="p-5 space-y-3">
                      {canEdit && (
                        <Button variant="secondary" size="sm" onClick={() => { setEditingPay({ cast_member_id: selected.id, currency: 'USD' }); setShowPayModal(true); }}>
                          + Add Payment
                        </Button>
                      )}
                      {actorPayments(selected.id).length === 0 ? (
                        <p className="text-sm text-surface-600 text-center py-8">No payments yet.</p>
                      ) : (
                        actorPayments(selected.id).map(pay => {
                          const pm = paymentStatusMeta(pay.status);
                          return (
                            <div key={pay.id} className="flex items-start gap-3 p-3 rounded-xl border border-surface-800 bg-surface-900/30">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-white">{formatCurrency(pay.amount)}</p>
                                  <span className={cn('text-[9px] px-2 py-0.5 rounded-full font-medium', pm.color)}>{pm.label}</span>
                                </div>
                                {pay.description && <p className="text-xs text-surface-400 mt-0.5">{pay.description}</p>}
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-surface-600 flex-wrap">
                                  {pay.due_date && <span>Due {new Date(pay.due_date).toLocaleDateString()}</span>}
                                  {pay.period_start && pay.period_end && <span>{new Date(pay.period_start).toLocaleDateString()} – {new Date(pay.period_end).toLocaleDateString()}</span>}
                                  {pay.paid_at && <span className="text-green-400">Paid {new Date(pay.paid_at).toLocaleDateString()}</span>}
                                </div>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                {pay.status === 'unpaid' && canEdit && (
                                  <button onClick={() => markPaid(pay.id)} title="Mark paid"
                                    className="text-[10px] text-green-400 border border-green-500/30 hover:bg-green-500/10 px-2 py-1 rounded transition-colors">
                                    ✓ Paid
                                  </button>
                                )}
                                {canEdit && (
                                  <>
                                    <button onClick={() => { setEditingPay({ ...pay }); setShowPayModal(true); }} className="text-[10px] text-surface-500 hover:text-white transition-colors px-1">Edit</button>
                                    <button onClick={() => deletePayment(pay)} className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors">✕</button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* ── PAYMENTS ── */}
      {tab === 'payments' && (
        <div className="space-y-4">
          {/* Filter + Add */}
          <div className="flex items-center gap-3 flex-wrap justify-between">
            <div className="flex gap-1 bg-surface-900/60 rounded-xl border border-surface-800 p-1">
              {(['all', 'unpaid', 'overdue', 'paid'] as const).map(f => (
                <button key={f} onClick={() => setPayFilter(f)}
                  className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize',
                    payFilter === f ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white')}>
                  {f}{f !== 'all' && ` (${payments.filter(p => p.status === f).length})`}
                </button>
              ))}
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => {
                const firstActor = actors[0];
                setEditingPay({ cast_member_id: firstActor?.id, currency: 'USD' });
                setShowPayModal(true);
              }} disabled={actors.length === 0}>
                + Add Payment
              </Button>
            )}
          </div>

          {filteredPayments.length === 0 ? (
            <p className="text-sm text-surface-600 text-center py-12">No payments {payFilter !== 'all' ? `with status "${payFilter}"` : 'yet'}.</p>
          ) : (
            <div className="space-y-2">
              {filteredPayments.map(pay => {
                const pm      = paymentStatusMeta(pay.status);
                const actor   = actors.find(a => a.id === pay.cast_member_id);
                return (
                  <div key={pay.id} className="flex items-center gap-4 p-3.5 rounded-xl border border-surface-800 bg-surface-900/40 hover:border-surface-700 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white">{formatCurrency(pay.amount)}</p>
                        <span className={cn('text-[9px] px-2 py-0.5 rounded-full font-medium', pm.color)}>{pm.label}</span>
                        {actor && (
                          <span className="text-[10px] text-surface-400">{actor.name}</span>
                        )}
                      </div>
                      {pay.description && <p className="text-xs text-surface-500 mt-0.5">{pay.description}</p>}
                      <div className="flex gap-3 mt-1 text-[10px] text-surface-600">
                        {pay.due_date && <span>Due {new Date(pay.due_date).toLocaleDateString()}</span>}
                        {pay.paid_at && <span className="text-green-400">Paid {new Date(pay.paid_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {pay.status === 'unpaid' && canEdit && (
                        <button onClick={() => markPaid(pay.id)} className="text-[10px] text-green-400 border border-green-500/30 hover:bg-green-500/10 px-2 py-1 rounded transition-colors">✓ Mark Paid</button>
                      )}
                      {canEdit && (
                        <>
                          <button onClick={() => { setEditingPay({ ...pay }); setShowPayModal(true); }} className="text-[10px] text-surface-500 hover:text-white transition-colors px-1">Edit</button>
                          <button onClick={() => deletePayment(pay)} className="text-[10px] text-red-400/60 hover:text-red-400">✕</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-6 print:space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white print:text-black">Cast Payroll Overview — {currentProject?.title}</h2>
            <Button variant="ghost" size="sm" onClick={printOverview} className="print:hidden">
              🖨 Print / PDF
            </Button>
          </div>

          {/* Per-actor breakdown */}
          <div className="rounded-xl border border-surface-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-800/60">
                <tr>
                  <th className="text-left p-3 text-[10px] font-bold text-surface-400 uppercase tracking-wider">Actor</th>
                  <th className="text-left p-3 text-[10px] font-bold text-surface-400 uppercase tracking-wider">Role(s)</th>
                  <th className="text-left p-3 text-[10px] font-bold text-surface-400 uppercase tracking-wider">Rate</th>
                  <th className="text-left p-3 text-[10px] font-bold text-surface-400 uppercase tracking-wider">Contract</th>
                  <th className="text-right p-3 text-[10px] font-bold text-surface-400 uppercase tracking-wider">Paid</th>
                  <th className="text-right p-3 text-[10px] font-bold text-surface-400 uppercase tracking-wider">Owed</th>
                  <th className="text-center p-3 text-[10px] font-bold text-surface-400 uppercase tracking-wider">Docs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {actors.map(actor => {
                  const meta = contractStatusMeta(actor.contract_status);
                  const owed  = actorOwed(actor.id);
                  const paid  = actorPaid(actor.id);
                  const docs  = actorDocs(actor.id).length;
                  return (
                    <tr key={actor.id} className="hover:bg-surface-800/30 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-400 overflow-hidden shrink-0">
                            {actor.photo_url ? <img src={actor.photo_url} alt={actor.name} className="w-full h-full object-cover" /> : actor.name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white text-xs">{actor.name}</p>
                            {actor.email && <p className="text-[9px] text-surface-500">{actor.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-surface-400">{actor.character_roles.join(', ') || '—'}</td>
                      <td className="p-3 text-xs text-surface-300">{formatPay(actor)}</td>
                      <td className="p-3"><span className={cn('text-[9px] px-2 py-0.5 rounded-full border', meta.color)}>{meta.label}</span></td>
                      <td className="p-3 text-right text-xs text-green-400 font-medium">{paid > 0 ? formatCurrency(paid) : '—'}</td>
                      <td className="p-3 text-right text-xs font-medium">
                        <span className={owed > 0 ? 'text-yellow-400' : 'text-surface-600'}>{owed > 0 ? formatCurrency(owed) : '—'}</span>
                      </td>
                      <td className="p-3 text-center text-xs text-surface-500">{docs}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-surface-800/40">
                <tr>
                  <td colSpan={4} className="p-3 text-xs font-bold text-surface-300">TOTALS</td>
                  <td className="p-3 text-right text-xs font-bold text-green-400">{formatCurrency(stats.totalPaid)}</td>
                  <td className="p-3 text-right text-xs font-bold text-yellow-400">{formatCurrency(stats.totalOwed)}</td>
                  <td className="p-3 text-center text-xs text-surface-400">{documents.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Unpaid payments reminder */}
          {stats.overdue > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <p className="text-sm font-semibold text-red-300">⚠ {stats.overdue} overdue payment{stats.overdue !== 1 ? 's' : ''} — please review the Payments tab.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Actor Modal ── */}
      <Modal isOpen={showActorModal} onClose={() => { setShowActorModal(false); setEditingActor({}); }}
        title={editingActor.id ? 'Edit Actor' : 'Add Actor / Actress'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Full Name *" value={editingActor.name ?? ''} onChange={e => setEditingActor(p => ({ ...p, name: e.target.value }))} autoFocus placeholder="e.g. Jane Doe" />
            <Input label="Photo URL" value={editingActor.photo_url ?? ''} onChange={e => setEditingActor(p => ({ ...p, photo_url: e.target.value }))} placeholder="https://…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Character Role(s)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(editingActor.character_roles ?? []).map((r, i) => (
                <span key={i} className="flex items-center gap-1 text-xs bg-surface-700 text-surface-200 px-2 py-0.5 rounded-full">
                  {r}
                  <button onClick={() => setEditingActor(p => ({ ...p, character_roles: (p.character_roles ?? []).filter((_, j) => j !== i) }))} className="opacity-60 hover:opacity-100">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-surface-600 outline-none focus:border-[#FF5F1F]/40"
                placeholder="Type role and press Enter…"
                value={editingActor._roleInput ?? ''}
                onChange={e => setEditingActor(p => ({ ...p, _roleInput: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && editingActor._roleInput?.trim()) {
                    e.preventDefault();
                    setEditingActor(p => ({ ...p, character_roles: [...(p.character_roles ?? []), p._roleInput!.trim()], _roleInput: '' }));
                  }
                }} />
              <Button variant="secondary" type="button" onClick={() => {
                if (editingActor._roleInput?.trim())
                  setEditingActor(p => ({ ...p, character_roles: [...(p.character_roles ?? []), p._roleInput!.trim()], _roleInput: '' }));
              }}>Add</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" value={editingActor.email ?? ''} onChange={e => setEditingActor(p => ({ ...p, email: e.target.value }))} placeholder="actor@email.com" />
            <Input label="Phone" value={editingActor.phone ?? ''} onChange={e => setEditingActor(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
          </div>
          <Textarea label="Bio" value={editingActor.bio ?? ''} onChange={e => setEditingActor(p => ({ ...p, bio: e.target.value }))} rows={2} placeholder="Short background / credits" />
          <div className="grid grid-cols-3 gap-4">
            <Input label="Pay Amount" type="number" value={editingActor.pay_amount ?? ''} onChange={e => setEditingActor(p => ({ ...p, pay_amount: e.target.value ? Number(e.target.value) : undefined }))} placeholder="5000" />
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Pay Unit</label>
              <select value={editingActor.pay_unit ?? 'flat'}
                onChange={e => setEditingActor(p => ({ ...p, pay_unit: e.target.value as PayUnit }))}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF5F1F]/40">
                {PAY_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <Input label="Currency" value={editingActor.pay_currency ?? 'USD'} onChange={e => setEditingActor(p => ({ ...p, pay_currency: e.target.value }))} placeholder="USD" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Contract Status</label>
              <select value={editingActor.contract_status ?? 'negotiating'}
                onChange={e => setEditingActor(p => ({ ...p, contract_status: e.target.value as ContractStatus }))}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF5F1F]/40">
                {CONTRACT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <Input label="Availability" value={editingActor.availability ?? ''} onChange={e => setEditingActor(p => ({ ...p, availability: e.target.value }))} placeholder="e.g. Mon–Fri, from June 1" />
          </div>
          <Textarea label="Notes" value={editingActor.notes ?? ''} onChange={e => setEditingActor(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Private notes about this cast member" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setShowActorModal(false); setEditingActor({}); }}>Cancel</Button>
            <Button onClick={saveActor} loading={savingActor} disabled={!editingActor.name?.trim()}>
              {editingActor.id ? 'Save Changes' : 'Add Actor'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Payment Modal ── */}
      <Modal isOpen={showPayModal} onClose={() => { setShowPayModal(false); setEditingPay({}); }}
        title={editingPay.id ? 'Edit Payment' : 'Add Payment'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Actor *</label>
            <select value={editingPay.cast_member_id ?? ''}
              onChange={e => setEditingPay(p => ({ ...p, cast_member_id: e.target.value }))}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF5F1F]/40">
              <option value="">Select actor…</option>
              {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount *" type="number" value={editingPay.amount ?? ''} onChange={e => setEditingPay(p => ({ ...p, amount: Number(e.target.value) }))} placeholder="1700" />
            <Input label="Currency" value={editingPay.currency ?? 'USD'} onChange={e => setEditingPay(p => ({ ...p, currency: e.target.value }))} placeholder="USD" />
          </div>
          <Input label="Description" value={editingPay.description ?? ''} onChange={e => setEditingPay(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Week 1 — Shooting days 1–5" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Period Start" type="date" value={editingPay.period_start ?? ''} onChange={e => setEditingPay(p => ({ ...p, period_start: e.target.value }))} />
            <Input label="Period End" type="date" value={editingPay.period_end ?? ''} onChange={e => setEditingPay(p => ({ ...p, period_end: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Due Date" type="date" value={editingPay.due_date ?? ''} onChange={e => setEditingPay(p => ({ ...p, due_date: e.target.value }))} />
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Status</label>
              <select value={editingPay.status ?? 'unpaid'}
                onChange={e => setEditingPay(p => ({ ...p, status: e.target.value as PaymentStatus }))}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF5F1F]/40">
                {PAYMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          {editingPay.status === 'paid' && (
            <Input label="Paid At" type="datetime-local" value={editingPay.paid_at ? editingPay.paid_at.slice(0, 16) : ''} onChange={e => setEditingPay(p => ({ ...p, paid_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
          )}
          <Textarea label="Notes" value={editingPay.notes ?? ''} onChange={e => setEditingPay(p => ({ ...p, notes: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setShowPayModal(false); setEditingPay({}); }}>Cancel</Button>
            <Button onClick={savePayment} loading={savingPay} disabled={!editingPay.amount || !editingPay.cast_member_id}>Save Payment</Button>
          </div>
        </div>
      </Modal>

      {/* ── Document Modal ── */}
      <Modal isOpen={showDocModal} onClose={() => { setShowDocModal(false); setEditingDoc({}); }}
        title={editingDoc.id ? 'Edit Document' : 'Add Document'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Actor *</label>
            <select value={editingDoc.cast_member_id ?? ''}
              onChange={e => setEditingDoc(p => ({ ...p, cast_member_id: e.target.value }))}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF5F1F]/40">
              <option value="">Select actor…</option>
              {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <Input label="Document Title *" value={editingDoc.title ?? ''} onChange={e => setEditingDoc(p => ({ ...p, title: e.target.value }))} placeholder="e.g. NDA — Jane Doe — 2026" />
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Document Type</label>
            <select value={editingDoc.doc_type ?? 'other'}
              onChange={e => setEditingDoc(p => ({ ...p, doc_type: e.target.value as DocType }))}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF5F1F]/40">
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="File / Link URL" value={editingDoc.file_url ?? ''} onChange={e => setEditingDoc(p => ({ ...p, file_url: e.target.value }))} placeholder="https://… or storage URL" />
            <Input label="File Name" value={editingDoc.file_name ?? ''} onChange={e => setEditingDoc(p => ({ ...p, file_name: e.target.value }))} placeholder="nda_janedoe.pdf" />
          </div>
          <Input label="Expiry Date" type="date" value={editingDoc.expires_at ?? ''} onChange={e => setEditingDoc(p => ({ ...p, expires_at: e.target.value }))} />
          <Textarea label="Notes" value={editingDoc.notes ?? ''} onChange={e => setEditingDoc(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Additional context about this document…" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setShowDocModal(false); setEditingDoc({}); }}>Cancel</Button>
            <Button onClick={saveDocument} loading={savingDoc} disabled={!editingDoc.title?.trim() || !editingDoc.cast_member_id}>Save Document</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
