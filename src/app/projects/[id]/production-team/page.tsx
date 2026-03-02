'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/lib/stores';
import { Button, Card, LoadingPage, Input, Modal, toast, ToastContainer } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { StageProductionTeamMember, StageProductionDepartment } from '@/lib/types';
import { STAGE_DEPARTMENTS } from '@/lib/types';

const DEPT_COLORS: Record<StageProductionDepartment, string> = {
  'Direction':          'text-[#FF5F1F]  bg-[#FF5F1F]/10  border-[#FF5F1F]/20',
  'Stage Management':   'text-[#f59e0b]  bg-[#f59e0b]/10  border-[#f59e0b]/20',
  'Lighting':           'text-[#fbbf24]  bg-[#fbbf24]/10  border-[#fbbf24]/20',
  'Sound':              'text-[#3b82f6]  bg-[#3b82f6]/10  border-[#3b82f6]/20',
  'Musical Direction':  'text-[#8b5cf6]  bg-[#8b5cf6]/10  border-[#8b5cf6]/20',
  'Choreography':       'text-[#ec4899]  bg-[#ec4899]/10  border-[#ec4899]/20',
  'Design':             'text-[#10b981]  bg-[#10b981]/10  border-[#10b981]/20',
  'Technical':          'text-[#14b8a6]  bg-[#14b8a6]/10  border-[#14b8a6]/20',
  'Marketing':          'text-[#6366f1]  bg-[#6366f1]/10  border-[#6366f1]/20',
  'Other':              'text-surface-400 bg-surface-800 border-surface-700',
};

const emptyForm = (): Partial<StageProductionTeamMember> => ({
  name: '', role: '', department: 'Direction', contact_email: '', phone: '', notes: '',
});

export default function ProductionTeamPage() {
  const params  = useParams<{ id: string }>();
  const { currentProject } = useProjectStore();
  const [members, setMembers] = useState<StageProductionTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<StageProductionTeamMember | null>(null);
  const [form, setForm] = useState<Partial<StageProductionTeamMember>>(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchMembers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('stage_production_team')
      .select('*')
      .eq('project_id', params.id)
      .order('sort_order')
      .order('name');
    setMembers(data || []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // Group by department in display order
  const grouped = STAGE_DEPARTMENTS.reduce((acc, dept) => {
    const deptMembers = members.filter(m => m.department === dept);
    if (deptMembers.length > 0) acc[dept] = deptMembers;
    return acc;
  }, {} as Record<string, StageProductionTeamMember[]>);

  const openAdd = (dept?: StageProductionDepartment) => {
    setEditingMember(null);
    setForm({ ...emptyForm(), department: dept ?? 'Direction' });
    setShowModal(true);
  };

  const openEdit = (m: StageProductionTeamMember) => {
    setEditingMember(m);
    setForm({ ...m });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error('Name is required'); return; }
    if (!form.role?.trim()) { toast.error('Role is required'); return; }
    setSaving(true);
    const supabase = createClient();
    try {
      const payload = {
        name:          form.name?.trim(),
        role:          form.role?.trim(),
        department:    form.department ?? 'Other',
        contact_email: form.contact_email?.trim() || null,
        phone:         form.phone?.trim() || null,
        notes:         form.notes?.trim() || null,
      };
      if (editingMember) {
        await supabase.from('stage_production_team').update(payload).eq('id', editingMember.id);
        toast.success('Updated');
      } else {
        await supabase.from('stage_production_team').insert({ ...payload, project_id: params.id, sort_order: members.length });
        toast.success('Added');
      }
      setShowModal(false);
      fetchMembers();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this team member?')) return;
    const supabase = createClient();
    await supabase.from('stage_production_team').delete().eq('id', id);
    fetchMembers();
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Production Team</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {members.length} member{members.length !== 1 ? 's' : ''} · {currentProject?.title}
          </p>
        </div>
        <Button onClick={() => openAdd()} className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Member
        </Button>
      </div>

      {/* Empty state */}
      {members.length === 0 && (
        <Card className="p-12 text-center border-surface-800/80">
          <p className="text-3xl mb-3">🎬</p>
          <p className="text-surface-300 font-medium">No production team yet</p>
          <p className="text-surface-500 text-sm mt-1">Add your director, stage manager, designers and crew.</p>
          <button onClick={() => openAdd()} className="mt-4 px-4 py-2 rounded-lg bg-[#FF5F1F]/10 text-[#FF8F5F] hover:bg-[#FF5F1F]/20 text-sm transition-colors">
            + Add first member
          </button>
        </Card>
      )}

      {/* Grouped cards */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([dept, deptMembers]) => (
          <div key={dept}>
            <div className="flex items-center gap-2 mb-3">
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold border', DEPT_COLORS[dept as StageProductionDepartment])}>
                {dept}
              </span>
              <span className="text-[10px] text-surface-600">({deptMembers.length})</span>
              <button
                onClick={() => openAdd(dept as StageProductionDepartment)}
                className="ml-auto text-xs text-surface-600 hover:text-surface-400 transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add to {dept}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {deptMembers.map(m => (
                <div
                  key={m.id}
                  className="relative bg-surface-900 border border-surface-800 rounded-xl p-4 hover:border-surface-700 cursor-pointer transition-colors group/card"
                  onClick={() => openEdit(m)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-surface-800 flex items-center justify-center text-sm font-bold text-surface-300 flex-shrink-0">
                        {m.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{m.name}</p>
                        <p className="text-xs text-surface-400 truncate">{m.role}</p>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(m.id); }}
                      className="opacity-0 group-hover/card:opacity-100 text-surface-600 hover:text-red-400 transition-all p-0.5 flex-shrink-0"
                      title="Remove"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {(m.contact_email || m.phone) && (
                    <div className="mt-2.5 pt-2.5 border-t border-surface-800 space-y-0.5">
                      {m.contact_email && (
                        <a
                          href={`mailto:${m.contact_email}`}
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] text-surface-500 hover:text-surface-300 flex items-center gap-1.5 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {m.contact_email}
                        </a>
                      )}
                      {m.phone && (
                        <p className="text-[11px] text-surface-600 flex items-center gap-1.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {m.phone}
                        </p>
                      )}
                    </div>
                  )}
                  {m.notes && (
                    <p className="mt-2 text-[11px] text-surface-600 line-clamp-2">{m.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingMember ? 'Edit Team Member' : 'Add Team Member'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Name *</label>
              <Input
                value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Role / Title *</label>
              <Input
                value={form.role ?? ''}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                placeholder="e.g. Lighting Designer"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Department</label>
            <select
              value={form.department ?? 'Direction'}
              onChange={e => setForm(f => ({ ...f, department: e.target.value as StageProductionDepartment }))}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FF5F1F]"
            >
              {STAGE_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Email</label>
              <Input
                value={form.contact_email ?? ''}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="email@example.com"
                type="email"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Phone</label>
              <Input
                value={form.phone ?? ''}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 000 0000"
                type="tel"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-[#FF5F1F] resize-none"
              placeholder="Any notes about this person…"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingMember ? 'Save Changes' : 'Add Member'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
