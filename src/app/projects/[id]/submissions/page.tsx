'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, toast } from '@/components/ui';
import { cn } from '@/lib/utils';

// ============================================================
// Submission Tracker — track where your script has been sent
// Table: script_submissions (see SQL migration)
// ============================================================

type RecipientType = 'agent' | 'manager' | 'producer' | 'festival' | 'network' | 'studio' | 'other';
type SubmissionStatus = 'pending' | 'passed' | 'request' | 'offer' | 'withdrawn';

interface Submission {
  id: string;
  project_id: string;
  script_id: string | null;
  recipient_name: string;
  recipient_type: RecipientType;
  date_sent: string | null;
  status: SubmissionStatus;
  notes: string | null;
  response_date: string | null;
  next_follow_up: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Pending',    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',  dot: 'bg-yellow-400' },
  passed:    { label: 'Passed',     color: 'bg-red-500/10 text-red-400 border-red-500/20',           dot: 'bg-red-400' },
  request:   { label: 'Request',    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',        dot: 'bg-blue-400' },
  offer:     { label: 'Offer',      color: 'bg-green-500/10 text-green-400 border-green-500/20',     dot: 'bg-green-400' },
  withdrawn: { label: 'Withdrawn',  color: 'bg-surface-500/10 text-surface-400 border-surface-500/20', dot: 'bg-surface-400' },
};

const TYPE_LABELS: Record<RecipientType, string> = {
  agent: 'Agent', manager: 'Manager', producer: 'Producer',
  festival: 'Festival', network: 'Network', studio: 'Studio', other: 'Other',
};

const EMPTY_FORM = (): Omit<Submission, 'id' | 'project_id' | 'created_at'> => ({
  script_id: null,
  recipient_name: '',
  recipient_type: 'producer',
  date_sent: new Date().toISOString().split('T')[0],
  status: 'pending',
  notes: '',
  response_date: null,
  next_follow_up: null,
});

export default function SubmissionsPage({ params }: { params: { id: string } }) {
  const { user }                    = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const currentUserRole             = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit                     = currentUserRole !== 'viewer';

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterStatus, setFilterStatus] = useState<SubmissionStatus | 'all'>('all');
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState<Submission | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM());
  const [saving, setSaving]           = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('script_submissions')
      .select('*')
      .eq('project_id', params.id)
      .order('date_sent', { ascending: false });
    setSubmissions((data as Submission[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM());
    setModalOpen(true);
  };

  const openEdit = (s: Submission) => {
    setEditing(s);
    setForm({
      script_id: s.script_id,
      recipient_name: s.recipient_name,
      recipient_type: s.recipient_type,
      date_sent: s.date_sent ?? '',
      status: s.status,
      notes: s.notes ?? '',
      response_date: s.response_date ?? '',
      next_follow_up: s.next_follow_up ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.recipient_name.trim()) { toast.error('Recipient name required'); return; }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      project_id: params.id,
      recipient_name: form.recipient_name.trim(),
      recipient_type: form.recipient_type,
      date_sent: form.date_sent || null,
      status: form.status,
      notes: form.notes || null,
      response_date: form.response_date || null,
      next_follow_up: form.next_follow_up || null,
      created_by: user?.id,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('script_submissions').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('script_submissions').insert(payload));
    }
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    toast.success(editing ? 'Updated' : 'Submission added');
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this submission?')) return;
    const supabase = createClient();
    await supabase.from('script_submissions').delete().eq('id', id);
    toast.success('Deleted');
    load();
  };

  const filtered     = filterStatus === 'all' ? submissions : submissions.filter((s) => s.status === filterStatus);
  const counts       = Object.keys(STATUS_CONFIG).reduce<Record<string, number>>((acc, k) => {
    acc[k] = submissions.filter((s) => s.status === k).length;
    return acc;
  }, {});

  const isOverdue = (s: Submission) =>
    s.next_follow_up && new Date(s.next_follow_up) < new Date() && s.status === 'pending';

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Submission Tracker</h1>
          <p className="text-sm text-surface-400 mt-0.5">{submissions.length} total submissions</p>
        </div>
        {canEdit && (
          <Button onClick={openAdd} size="sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Submission
          </Button>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {(Object.entries(STATUS_CONFIG) as [SubmissionStatus, typeof STATUS_CONFIG[SubmissionStatus]][]).map(([status, cfg]) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
            className={cn(
              'rounded-lg border p-3 text-center transition-all',
              filterStatus === status ? cfg.color + ' ring-1 ring-inset ring-current/30' : 'bg-surface-800/40 border-surface-700/40 hover:bg-surface-800/70',
            )}
          >
            <div className="text-xl font-black text-white">{counts[status] ?? 0}</div>
            <div className="text-xs text-surface-400 mt-0.5">{cfg.label}</div>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? null : filtered.length === 0 ? (
        <div className="text-center py-16 text-surface-500">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="font-medium">No submissions yet</p>
          <p className="text-sm mt-1">{canEdit ? 'Add your first one with the button above.' : 'Nothing has been submitted.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const cfg = STATUS_CONFIG[s.status];
            const overdue = isOverdue(s);
            return (
              <div
                key={s.id}
                className={cn(
                  'group rounded-xl border px-4 py-3 flex items-center gap-3 transition-all',
                  'border-surface-700/40 bg-surface-800/30 hover:bg-surface-800/50',
                  overdue && 'border-orange-500/30',
                )}
              >
                {/* Status dot */}
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', cfg.dot)} />

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm">{s.recipient_name}</span>
                    <span className="text-[10px] text-surface-500 bg-surface-800 rounded px-1.5 py-0.5">
                      {TYPE_LABELS[s.recipient_type]}
                    </span>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', cfg.color)}>
                      {cfg.label}
                    </span>
                    {overdue && (
                      <span className="text-[10px] text-orange-400 font-medium">⚠ Follow-up overdue</span>
                    )}
                  </div>
                  {s.notes && <p className="text-xs text-surface-500 mt-0.5 truncate">{s.notes}</p>}
                </div>

                {/* Dates */}
                <div className="text-right shrink-0 text-xs text-surface-500 hidden sm:block">
                  {s.date_sent && <div>Sent {s.date_sent}</div>}
                  {s.response_date && <div className="mt-0.5">Response {s.response_date}</div>}
                  {s.next_follow_up && s.status === 'pending' && (
                    <div className={cn('mt-0.5', overdue && 'text-orange-400')}>
                      Follow-up {s.next_follow_up}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {canEdit && (
                  <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1.5 rounded-lg hover:bg-surface-700/60 text-surface-400 hover:text-white"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-surface-400 hover:text-red-400"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Submission' : 'Add Submission'}>
        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1">Recipient Name *</label>
            <input
              value={form.recipient_name}
              onChange={(e) => setForm((f) => ({ ...f, recipient_name: e.target.value }))}
              placeholder="Lionsgate Films, William Morris, Sundance…"
              className="w-full px-3 py-2 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-600 focus:outline-none focus:border-[#FF5F1F]/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Type</label>
              <select
                value={form.recipient_type}
                onChange={(e) => setForm((f) => ({ ...f, recipient_type: e.target.value as RecipientType }))}
                className="w-full px-3 py-2 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white focus:outline-none"
              >
                {(Object.entries(TYPE_LABELS) as [RecipientType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SubmissionStatus }))}
                className="w-full px-3 py-2 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white focus:outline-none"
              >
                {(Object.entries(STATUS_CONFIG) as [SubmissionStatus, { label: string }][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Date Sent</label>
              <input type="date" value={form.date_sent ?? ''} onChange={(e) => setForm((f) => ({ ...f, date_sent: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Response Date</label>
              <input type="date" value={form.response_date ?? ''} onChange={(e) => setForm((f) => ({ ...f, response_date: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Follow-Up</label>
              <input type="date" value={form.next_follow_up ?? ''} onChange={(e) => setForm((f) => ({ ...f, next_follow_up: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Contact details, submission requirements, feedback…"
              className="w-full px-3 py-2 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-600 focus:outline-none focus:border-[#FF5F1F]/60 resize-none"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Add'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
