'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Modal, toast } from '@/components/ui';
import type { OrgPipelineStage, Project, Profile } from '@/lib/types';

interface Props {
  companyId: string;
  canManage: boolean;
}

export function OrgPipeline({ companyId, canManage }: Props) {
  const [stages, setStages] = useState<OrgPipelineStage[]>([]);
  const [projects, setProjects] = useState<(Project & { assignee?: Profile; pipeline_stage_id?: string; pipeline_priority?: string; pipeline_deadline?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#6366f1');
  const [dragItem, setDragItem] = useState<string | null>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    const [stagesRes, projectsRes] = await Promise.all([
      supabase.from('org_pipeline_stages').select('*').eq('company_id', companyId).order('sort_order'),
      supabase.from('projects').select('*, pipeline_assignee:profiles!projects_pipeline_assignee_id_fkey(id, full_name, avatar_url)').eq('company_id', companyId),
    ]);
    setStages(stagesRes.data || []);
    setProjects(projectsRes.data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const addStage = async () => {
    if (!newStageName.trim()) return;
    const maxOrder = stages.reduce((m, s) => Math.max(m, s.sort_order), -1);
    const { error } = await supabase.from('org_pipeline_stages').insert({
      company_id: companyId, name: newStageName.trim(), color: newStageColor, sort_order: maxOrder + 1,
    });
    if (error) { toast.error(`Couldn't add the stage: ${error.message}`); return; }
    setNewStageName(''); setShowAddStage(false);
    load();
  };

  const deleteStage = async (id: string) => {
    if (!confirm('Delete this stage? Its projects move to "Not staged".')) return;
    const { error } = await supabase.from('org_pipeline_stages').delete().eq('id', id);
    if (error) toast.error(`Couldn't delete the stage: ${error.message}`);
    else load();
  };

  const moveProject = async (projectId: string, stageId: string | null) => {
    // Optimistic: the card moves now, and moves back if the write is refused.
    const before = projects;
    setProjects((ps) => ps.map((p) => (p.id === projectId ? { ...p, pipeline_stage_id: stageId ?? undefined } : p)));
    const { error } = await supabase.from('projects').update({ pipeline_stage_id: stageId }).eq('id', projectId);
    if (error) {
      setProjects(before);
      toast.error(`Couldn't move the project: ${error.message}`);
    }
  };

  const setPriority = async (projectId: string, priority: string) => {
    const { error } = await supabase.from('projects').update({ pipeline_priority: priority }).eq('id', projectId);
    if (error) toast.error(`Couldn't set the priority: ${error.message}`);
    load();
  };

  if (loading) return <div className="text-center py-12 text-surface-500">Loading pipeline...</div>;

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-surface-700 px-6 py-12 text-center">
        <p className="text-sm font-semibold text-white">No company projects yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-surface-400">
          A project shows up here once it belongs to the company. Open the project, go to Settings,
          and choose this company as its owner.
        </p>
      </div>
    );
  }

  const moveMenu = (projectId: string, currentStage?: string | null) => canManage && (
    <select
      aria-label="Move to stage"
      value={currentStage ?? ''}
      onChange={(e) => moveProject(projectId, e.target.value || null)}
      onClick={(e) => e.stopPropagation()}
      className="mt-2 w-full rounded-md border border-surface-700 bg-surface-900 px-2 py-1 text-[11px] text-surface-300"
    >
      <option value="">Not staged</option>
      {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
    </select>
  );

  const unstagedProjects = projects.filter(p => !p.pipeline_stage_id);

  const priorityColors: Record<string, string> = {
    low: 'bg-surface-600', normal: 'bg-blue-500/20 text-blue-400', high: 'bg-amber-500/20 text-amber-400', urgent: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span />
        {canManage && (
          <Button size="sm" onClick={() => setShowAddStage(true)}>+ Add Stage</Button>
        )}
      </div>

      {/* Kanban Board */}
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0" style={{ minHeight: 400 }}>
        {stages.map((stage) => {
          const stageProjects = projects.filter(p => p.pipeline_stage_id === stage.id);
          return (
            <div
              key={stage.id}
              className="flex-shrink-0 w-72 bg-surface-900 rounded-xl border border-surface-800"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragItem) moveProject(dragItem, stage.id);
                setDragItem(null);
              }}
            >
              <div className="px-4 py-3 border-b border-surface-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="font-semibold text-sm text-white">{stage.name}</span>
                  <span className="text-xs text-surface-500">({stageProjects.length})</span>
                </div>
                {canManage && !stage.is_default && (
                  <button onClick={() => deleteStage(stage.id)} className="text-surface-500 hover:text-red-400 text-xs">✕</button>
                )}
              </div>
              <div className="p-2 space-y-2 min-h-[200px]">
                {stageProjects.map((project) => (
                  <div
                    key={project.id}
                    draggable
                    onDragStart={() => setDragItem(project.id)}
                    className="bg-surface-800 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:bg-surface-700 transition-colors"
                  >
                    <Link href={`/projects/${project.id}`} className="block truncate text-sm font-medium text-white hover:text-brand-300">{project.title}</Link>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${priorityColors[project.pipeline_priority || 'normal']}`}>
                        {(project.pipeline_priority || 'normal').toUpperCase()}
                      </span>
                      {project.pipeline_deadline && (
                        <span className="text-[11px] text-surface-500">
                          {new Date(project.pipeline_deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {(project as any).pipeline_assignee && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-4 h-4 rounded-full bg-surface-700 flex items-center justify-center text-[11px] text-white">
                          {(project as any).pipeline_assignee.full_name?.[0] || '?'}
                        </div>
                        <span className="text-[11px] text-surface-400">{(project as any).pipeline_assignee.full_name}</span>
                      </div>
                    )}
                    {canManage && (
                      <div className="mt-2 flex gap-1">
                        {['low', 'normal', 'high', 'urgent'].map(p => (
                          <button key={p} onClick={() => setPriority(project.id, p)}
                            className={`text-[11px] px-1 py-0.5 rounded ${project.pipeline_priority === p ? 'ring-1 ring-white/30' : ''} ${priorityColors[p]}`}>
                            {p[0].toUpperCase()}
                          </button>
                        ))}
                      </div>
                    )}
                    {moveMenu(project.id, project.pipeline_stage_id)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Unstaged column */}
        {unstagedProjects.length > 0 && (
          <div className="flex-shrink-0 w-72 bg-surface-900/50 rounded-xl border border-dashed border-surface-700">
            <div className="px-4 py-3 border-b border-surface-800">
              <span className="font-semibold text-sm text-surface-400">Unassigned ({unstagedProjects.length})</span>
            </div>
            <div className="p-2 space-y-2">
              {unstagedProjects.map((project) => (
                <div key={project.id} draggable onDragStart={() => setDragItem(project.id)}
                  className="bg-surface-800/50 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:bg-surface-800 transition-colors">
                  <Link href={`/projects/${project.id}`} className="block truncate text-sm font-medium text-surface-300 hover:text-white">{project.title}</Link>
                  {canManage ? moveMenu(project.id, null) : <p className="text-[11px] text-surface-500 mt-1">Not staged yet</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Stage Modal */}
      <Modal isOpen={showAddStage} onClose={() => setShowAddStage(false)} title="Add Pipeline Stage">
        <div className="space-y-4">
          <Input label="Stage Name" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="e.g. Post-Production" />
          <div>
            <label className="text-sm text-surface-400 mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#FF5F1F', '#6b7280'].map(c => (
                <button key={c} onClick={() => setNewStageColor(c)}
                  className={`w-8 h-8 rounded-full ${newStageColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <Button onClick={addStage} disabled={!newStageName.trim()}>Add Stage</Button>
        </div>
      </Modal>
    </div>
  );
}
