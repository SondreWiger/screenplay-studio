'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Input, Textarea, Modal, toast, Badge } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import type { OrgScriptAssignment, ScriptAssignmentStatus, Profile, Project } from '@/lib/types';

interface Props {
  companyId: string;
  userId: string;
  canManage: boolean;
}

const STATUS_CONFIG: Record<ScriptAssignmentStatus, { label: string; color: string }> = {
  assigned: { label: 'Assigned', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-400' },
  submitted: { label: 'Submitted', color: 'bg-purple-500/20 text-purple-400' },
  in_review: { label: 'In Review', color: 'bg-indigo-500/20 text-indigo-400' },
  revision_requested: { label: 'Revision Requested', color: 'bg-orange-500/20 text-orange-400' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400' },
};

export function OrgAssignments({ companyId, userId, canManage }: Props) {
  const [assignments, setAssignments] = useState<(OrgScriptAssignment & { assignee_profile?: Profile; project_ref?: { title: string } })[]>([]);
  const [members, setMembers] = useState<{ user_id: string; profile?: { id: string; full_name: string; avatar_url: string } | { id: string; full_name: string; avatar_url: string }[] }[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine' | 'active' | 'completed'>('all');

  // Form
  const [form, setForm] = useState({
    title: '', description: '', project_id: '', assigned_to: '', assignment_type: 'write' as const,
    deadline: '', max_revisions: 3,
  });

  const supabase = createClient();

  const load = useCallback(async () => {
    const [aRes, mRes, pRes] = await Promise.all([
      supabase.from('org_script_assignments')
        .select('*, assignee_profile:profiles!org_script_assignments_assigned_to_fkey(id, full_name, avatar_url), project_ref:projects!org_script_assignments_project_id_fkey(title)')
        .eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('company_members')
        .select('user_id, profile:profiles!company_members_user_id_fkey(id, full_name, avatar_url)')
        .eq('company_id', companyId),
      supabase.from('projects').select('id, title').eq('company_id', companyId).order('title'),
    ]);
    setAssignments(aRes.data || []);
    setMembers(mRes.data || []);
    setProjects(pRes.data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const createAssignment = async () => {
    if (!form.title.trim() || !form.project_id || !form.assigned_to) { toast.error('Fill in required fields'); return; }
    const { error } = await supabase.from('org_script_assignments').insert({
      company_id: companyId, title: form.title.trim(), description: form.description.trim() || null,
      project_id: form.project_id, assigned_to: form.assigned_to, assigned_by: userId,
      assignment_type: form.assignment_type, deadline: form.deadline || null, max_revisions: form.max_revisions,
    });
    if (error) { toast.error('Failed to create assignment'); return; }
    setShowCreate(false);
    setForm({ title: '', description: '', project_id: '', assigned_to: '', assignment_type: 'write', deadline: '', max_revisions: 3 });
    load();
    toast.success('Assignment created!');
  };

  const updateStatus = async (id: string, status: ScriptAssignmentStatus) => {
    const updates: Record<string, unknown> = { status };
    if (status === 'submitted') updates.submitted_at = new Date().toISOString();
    if (status === 'approved') { updates.approved_at = new Date().toISOString(); updates.approved_by = userId; }
    if (status === 'revision_requested') updates.revision_count = (assignments.find(a => a.id === id)?.revision_count || 0) + 1;
    await supabase.from('org_script_assignments').update(updates).eq('id', id);
    load();
  };

  if (loading) return <div className="text-center py-12 text-surface-500">Loading assignments...</div>;

  const filtered = assignments.filter(a => {
    if (filter === 'mine') return a.assigned_to === userId;
    if (filter === 'active') return !['approved', 'rejected'].includes(a.status);
    if (filter === 'completed') return ['approved', 'rejected'].includes(a.status);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Script Assignments</h2>
        {canManage && <Button size="sm" onClick={() => setShowCreate(true)}>+ New Assignment</Button>}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'mine', 'active', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filter === f ? 'bg-[#FF5F1F] text-white' : 'bg-surface-800 text-surface-400 hover:text-white')}>
            {f === 'all' ? `All (${assignments.length})` :
             f === 'mine' ? `My (${assignments.filter(a => a.assigned_to === userId).length})` :
             f === 'active' ? `Active (${assignments.filter(a => !['approved', 'rejected'].includes(a.status)).length})` :
             `Done (${assignments.filter(a => ['approved', 'rejected'].includes(a.status)).length})`}
          </button>
        ))}
      </div>

      {/* Assignment List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-surface-500">No assignments found</Card>
        )}
        {filtered.map(a => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-white">{a.title}</h3>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_CONFIG[a.status].color)}>
                    {STATUS_CONFIG[a.status].label}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-800 text-surface-400">{a.assignment_type}</span>
                </div>
                {a.description && <p className="text-sm text-surface-400 mt-1">{a.description}</p>}
                <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
                  <span>📁 {(a as any).project_ref?.title || 'Unknown project'}</span>
                  <span>👤 {(a as any).assignee_profile?.full_name || 'Unknown'}</span>
                  {a.deadline && (
                    <span className={new Date(a.deadline) < new Date() && a.status !== 'approved' ? 'text-red-400' : ''}>
                      📅 Due {new Date(a.deadline).toLocaleDateString()}
                    </span>
                  )}
                  <span>🔄 Rev {a.revision_count}/{a.max_revisions}</span>
                  <span className="text-surface-600">{timeAgo(a.created_at)}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {/* Writer actions */}
                {a.assigned_to === userId && a.status === 'assigned' && (
                  <Button size="sm" variant="ghost" onClick={() => updateStatus(a.id, 'in_progress')}>Start</Button>
                )}
                {a.assigned_to === userId && a.status === 'in_progress' && (
                  <Button size="sm" onClick={() => updateStatus(a.id, 'submitted')}>Submit</Button>
                )}
                {a.assigned_to === userId && a.status === 'revision_requested' && (
                  <Button size="sm" onClick={() => updateStatus(a.id, 'submitted')}>Resubmit</Button>
                )}
                {/* Manager actions */}
                {canManage && a.status === 'submitted' && (
                  <>
                    <Button size="sm" onClick={() => updateStatus(a.id, 'approved')}>Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(a.id, 'revision_requested')}>Revise</Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Script Assignment">
        <div className="space-y-4">
          <Input label="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Write Episode 3 First Draft" />
          <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Details about what's expected..." />
          <div>
            <label className="text-sm text-surface-400 mb-1 block">Project *</label>
            <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-surface-400 mb-1 block">Assign to *</label>
            <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">Select member...</option>
              {members.map(m => <option key={m.user_id} value={m.user_id}>{(m as any).profile?.full_name || m.user_id}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-surface-400 mb-1 block">Type</label>
              <select value={form.assignment_type} onChange={e => setForm({ ...form, assignment_type: e.target.value as any })}
                className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white">
                {['write', 'rewrite', 'polish', 'review', 'notes'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Input label="Deadline" type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <Button onClick={createAssignment} disabled={!form.title.trim() || !form.project_id || !form.assigned_to}>Create Assignment</Button>
        </div>
      </Modal>
    </div>
  );
}
