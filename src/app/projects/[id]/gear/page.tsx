'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ShootGear, GearCategory, GearOwnership, GearStatus } from '@/lib/types';
import { GEAR_CATEGORIES } from '@/lib/types';

// ── Constants ────────────────────────────────────────────────
const OWNERSHIP_LABEL: Record<GearOwnership, string> = {
  owned: 'Owned', rented: 'Rented', provided: 'Provided', tbc: 'TBC',
};
const OWNERSHIP_COLOR: Record<GearOwnership, string> = {
  owned: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  rented: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  provided: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  tbc: 'text-surface-400 bg-surface-800 border-surface-700',
};
const STATUS_LABEL: Record<GearStatus, string> = {
  confirmed: 'Confirmed', pending: 'Pending', cancelled: 'Cancelled',
};
const STATUS_COLOR: Record<GearStatus, string> = {
  confirmed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  pending: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  cancelled: 'text-red-400 bg-red-500/10 border-red-500/30',
};
const STATUS_CYCLE: GearStatus[] = ['pending', 'confirmed', 'cancelled'];

// ── Empty form state ─────────────────────────────────────────
const emptyForm = (): Partial<ShootGear> => ({
  name: '', category: 'Camera', quantity: 1, unit: 'unit',
  ownership: 'tbc', vendor: '', daily_rate: undefined,
  total_cost: undefined, notes: '', status: 'pending',
  shoot_day_id: null,
});

// ── Cost helpers ─────────────────────────────────────────────
function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function GearPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  const [gear, setGear] = useState<ShootGear[]>([]);
  const [shootDays, setShootDays] = useState<{id: string; day_number: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<GearCategory | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<GearStatus | 'All'>('All');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<ShootGear>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchGear = useCallback(async () => {
    const supabase = createClient();
    const [{ data }, { data: daysData }] = await Promise.all([
      supabase.from('shoot_gear').select('*').eq('project_id', params.id).order('category').order('name'),
      supabase.from('shoot_days').select('id, day_number').eq('project_id', params.id).order('day_number'),
    ]);
    setGear((data as ShootGear[]) || []);
    setShootDays((daysData || []) as {id: string; day_number: number}[]);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchGear(); }, [fetchGear]);

  const openNew = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item: ShootGear) => {
    setForm({ ...item });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('Name is required.'); return; }
    setSaving(true);
    const supabase = createClient();
    const basePayload = {
      project_id: params.id,
      name: form.name!.trim(),
      category: form.category || 'Other',
      quantity: form.quantity || 1,
      unit: form.unit || 'unit',
      ownership: form.ownership || 'tbc',
      vendor: form.vendor?.trim() || null,
      daily_rate: form.daily_rate ?? null,
      total_cost: form.total_cost ?? null,
      notes: form.notes?.trim() || null,
      status: form.status || 'pending',
    };
    if (editingId) {
      // Don't overwrite shoot_day_id — day assignment is managed from the Day Pack page
      const { error } = await supabase.from('shoot_gear').update(basePayload).eq('id', editingId);
      if (error) toast.error('Failed to save.');
      else { toast.success('Gear item updated.'); setShowForm(false); fetchGear(); }
    } else {
      const { error } = await supabase.from('shoot_gear').insert({ ...basePayload, shoot_day_id: null, created_by: user?.id });
      if (error) toast.error('Failed to create gear item.');
      else { toast.success('Gear item added.'); setShowForm(false); fetchGear(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this gear item?')) return;
    setDeletingId(id);
    const supabase = createClient();
    const { error } = await supabase.from('shoot_gear').delete().eq('id', id);
    if (error) toast.error('Failed to delete.');
    else { setGear(prev => prev.filter(g => g.id !== id)); toast.success('Deleted.'); }
    setDeletingId(null);
  };

  const handleCycleStatus = async (item: ShootGear) => {
    if (!canEdit) return;
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(item.status) + 1) % STATUS_CYCLE.length];
    const supabase = createClient();
    await supabase.from('shoot_gear').update({ status: next }).eq('id', item.id);
    setGear(prev => prev.map(g => g.id === item.id ? { ...g, status: next } : g));
  };

  const handleExportCSV = () => {
    const visible = filteredGear;
    const header = ['Name', 'Category', 'Qty', 'Unit', 'Ownership', 'Vendor', 'Daily Rate', 'Total Cost', 'Status', 'Notes'];
    const rows = visible.map(g => [
      g.name, g.category, g.quantity, g.unit,
      OWNERSHIP_LABEL[g.ownership], g.vendor || '',
      g.daily_rate ?? '', g.total_cost ?? '', STATUS_LABEL[g.status], g.notes || '',
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${currentProject?.title || 'project'}-gear.csv`;
    a.click();
  };

  // ── Filter + group ───────────────────────────────────────
  const filteredGear = gear.filter(g =>
    (filterCat === 'All' || g.category === filterCat) &&
    (filterStatus === 'All' || g.status === filterStatus)
  );

  const grouped = GEAR_CATEGORIES.reduce<Record<string, ShootGear[]>>((acc, cat) => {
    const items = filteredGear.filter(g => g.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const totalCost = gear.reduce((sum, g) => {
    if (g.status === 'cancelled') return sum;
    return sum + (g.total_cost ?? 0);
  }, 0);
  const totalRented = gear.filter(g => g.ownership === 'rented' && g.status !== 'cancelled').length;
  const totalConfirmed = gear.filter(g => g.status === 'confirmed').length;
  const totalPending = gear.filter(g => g.status === 'pending').length;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-surface-800 px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white">Gear</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {gear.length} item{gear.length !== 1 ? 's' : ''} · {fmt(totalCost)} committed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-surface-700 text-surface-300 hover:text-white hover:border-surface-500 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            CSV
          </button>
          {canEdit && (
            <button
              onClick={openNew}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#FF5F1F] text-white font-semibold hover:bg-orange-500 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Gear
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-3 flex items-center gap-4 border-b border-surface-800/50 shrink-0">
        <span className="text-xs text-surface-500">{totalConfirmed} confirmed</span>
        <span className="text-xs text-surface-500">{totalPending} pending</span>
        <span className="text-xs text-surface-500">{totalRented} rented items</span>
        <div className="flex-1" />
        {/* Category filter */}
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value as GearCategory | 'All')}
          className="text-xs bg-surface-900 border border-surface-700 rounded-lg px-2.5 py-1 text-surface-300 outline-none focus:border-[#FF5F1F]/50"
        >
          <option value="All">All categories</option>
          {GEAR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as GearStatus | 'All')}
          className="text-xs bg-surface-900 border border-surface-700 rounded-lg px-2.5 py-1 text-surface-300 outline-none focus:border-[#FF5F1F]/50"
        >
          <option value="All">All statuses</option>
          {STATUS_CYCLE.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        {filteredGear.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <p className="text-surface-400 font-medium">No gear yet</p>
              {canEdit && <p className="text-surface-600 text-sm mt-1">Add your first item with the button above.</p>}
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">{cat}</h2>
                <span className="text-[10px] text-surface-700">{items.length}</span>
              </div>
              <div className="rounded-xl border border-surface-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-800 bg-surface-900/60">
                      <th className="text-left text-[10px] font-medium text-surface-500 uppercase tracking-wider px-4 py-2">Name</th>
                      <th className="text-left text-[10px] font-medium text-surface-500 uppercase tracking-wider px-3 py-2 w-16">Qty</th>
                      <th className="text-left text-[10px] font-medium text-surface-500 uppercase tracking-wider px-3 py-2 w-24">Ownership</th>
                      <th className="text-left text-[10px] font-medium text-surface-500 uppercase tracking-wider px-3 py-2 hidden md:table-cell">Vendor</th>
                      <th className="text-right text-[10px] font-medium text-surface-500 uppercase tracking-wider px-3 py-2 w-24 hidden lg:table-cell">Cost</th>
                      <th className="text-left text-[10px] font-medium text-surface-500 uppercase tracking-wider px-3 py-2 w-28">Status</th>
                      {canEdit && <th className="w-16 px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-surface-800/40 last:border-0 hover:bg-surface-800/20 transition-colors group">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={cn('font-medium text-white', item.status === 'cancelled' && 'line-through text-surface-500')}>{item.name}</span>
                            {item.shoot_day_id && (() => {
                              const d = shootDays.find(sd => sd.id === item.shoot_day_id);
                              return d ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF5F1F]/10 text-[#FF5F1F] border border-[#FF5F1F]/20 font-medium">Day {d.day_number}</span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-500 border border-surface-700">Scheduled</span>
                              );
                            })()}
                          </div>
                          {item.notes && <p className="text-[11px] text-surface-500 truncate max-w-[220px]">{item.notes}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-surface-300 text-xs tabular-nums">{item.quantity} {item.unit}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn('text-[11px] px-1.5 py-0.5 rounded border', OWNERSHIP_COLOR[item.ownership])}>
                            {OWNERSHIP_LABEL[item.ownership]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-surface-400 text-xs hidden md:table-cell">{item.vendor || '—'}</td>
                        <td className="px-3 py-2.5 text-surface-300 text-xs tabular-nums text-right hidden lg:table-cell">
                          {item.total_cost != null ? fmt(item.total_cost) : item.daily_rate != null ? <span className="text-surface-500">{fmt(item.daily_rate)}/day</span> : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => handleCycleStatus(item)}
                            disabled={!canEdit}
                            className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium transition-all hover:opacity-80', STATUS_COLOR[item.status])}
                          >
                            {STATUS_LABEL[item.status]}
                          </button>
                        </td>
                        {canEdit && (
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(item)} className="text-surface-500 hover:text-white p-1 rounded transition-colors" title="Edit">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} className="text-surface-500 hover:text-red-400 p-1 rounded transition-colors" title="Delete">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
          <div className="relative z-10 w-full max-w-lg bg-surface-950 border border-surface-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">{editingId ? 'Edit Gear Item' : 'Add Gear Item'}</h2>
              <button onClick={() => setShowForm(false)} className="text-surface-500 hover:text-white p-1 rounded transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Name *</label>
                <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-[#FF5F1F]/60"
                  placeholder="e.g. ARRI Alexa 35, 5-ton truck…" autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Category</label>
                  <select value={form.category || 'Other'} onChange={e => setForm(f => ({ ...f, category: e.target.value as GearCategory }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-[#FF5F1F]/60">
                    {GEAR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Ownership</label>
                  <select value={form.ownership || 'tbc'} onChange={e => setForm(f => ({ ...f, ownership: e.target.value as GearOwnership }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-[#FF5F1F]/60">
                    {(Object.keys(OWNERSHIP_LABEL) as GearOwnership[]).map(o => <option key={o} value={o}>{OWNERSHIP_LABEL[o]}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Quantity</label>
                  <input type="number" min={1} value={form.quantity || 1} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-[#FF5F1F]/60" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Unit</label>
                  <select value={form.unit || 'unit'} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-[#FF5F1F]/60">
                    {['unit', 'set', 'kit', 'day', 'week', 'roll', 'box'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Vendor / Supplier</label>
                <input value={form.vendor || ''} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-[#FF5F1F]/60"
                  placeholder="e.g. Panavision, AbelCine…" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Daily Rate ($)</label>
                  <input type="number" min={0} step="0.01" value={form.daily_rate ?? ''} onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-[#FF5F1F]/60"
                    placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Total / Flat Cost ($)</label>
                  <input type="number" min={0} step="0.01" value={form.total_cost ?? ''} onChange={e => setForm(f => ({ ...f, total_cost: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-[#FF5F1F]/60"
                    placeholder="0.00" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Status</label>
                <select value={form.status || 'pending'} onChange={e => setForm(f => ({ ...f, status: e.target.value as GearStatus }))}
                  className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-[#FF5F1F]/60">
                  {STATUS_CYCLE.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Notes</label>
                <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-[#FF5F1F]/60 resize-none"
                  placeholder="Any notes about this item…" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-surface-700 text-surface-300 hover:text-white text-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 rounded-lg bg-[#FF5F1F] text-white font-semibold text-sm hover:bg-orange-500 active:scale-95 transition-all disabled:opacity-50">
                {saving ? 'Saving…' : editingId ? 'Update' : 'Add Item'}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
