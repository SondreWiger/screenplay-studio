'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
  BroadcastStory, BroadcastStoryStatus, BroadcastStoryType, BroadcastStoryVersion,
} from '@/lib/types';
import {
  BROADCAST_STORY_STATUS_OPTIONS, BROADCAST_STORY_TYPES,
  formatBroadcastDuration,
} from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Stories Page — NRCS editorial story management
// ────────────────────────────────────────────────────────────

export default function StoriesPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const projectId = params.id;

  // ─── State ─────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<BroadcastStory[]>([]);
  const [selectedStory, setSelectedStory] = useState<BroadcastStory | null>(null);
  const [versions, setVersions] = useState<BroadcastStoryVersion[]>([]);
  const [filter, setFilter] = useState<{ status: BroadcastStoryStatus | 'all'; search: string }>({ status: 'all', search: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editScriptText, setEditScriptText] = useState('');
  const [editStoryType, setEditStoryType] = useState<BroadcastStoryType>('reader');
  const [editPriority, setEditPriority] = useState(0);
  const [editDuration, setEditDuration] = useState(0);
  const [editStatus, setEditStatus] = useState<BroadcastStoryStatus>('draft');

  // ─── Data Fetching ─────────────────────────────────────

  const fetchStories = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('broadcast_stories')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });

    if (error) console.error('Error fetching stories:', error);
    setStories(data || []);
    setLoading(false);
  }, [projectId]);

  const fetchVersions = useCallback(async (storyId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_story_versions')
      .select('*')
      .eq('story_id', storyId)
      .order('version', { ascending: false })
      .limit(20);
    setVersions(data || []);
  }, []);

  useEffect(() => { fetchStories(); }, [fetchStories]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`stories-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'broadcast_stories', filter: `project_id=eq.${projectId}` },
        () => fetchStories()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, fetchStories]);

  // ─── Story Selection ───────────────────────────────────

  const selectStory = async (story: BroadcastStory) => {
    setSelectedStory(story);
    setEditMode(false);
    await fetchVersions(story.id);
  };

  const startEdit = () => {
    if (!selectedStory) return;
    setEditTitle(selectedStory.title);
    setEditSlug(selectedStory.slug);
    setEditScriptText(selectedStory.script_text || '');
    setEditStoryType(selectedStory.story_type);
    setEditPriority(selectedStory.priority);
    setEditDuration(selectedStory.estimated_duration || 0);
    setEditStatus(selectedStory.status);
    setEditMode(true);

    // Lock the story
    lockStory(selectedStory.id);
  };

  // ─── Locking ───────────────────────────────────────────

  const lockStory = async (storyId: string) => {
    const supabase = createClient();
    await supabase
      .from('broadcast_stories')
      .update({ locked_by: user?.id, locked_at: new Date().toISOString() })
      .eq('id', storyId);
  };

  const unlockStory = async (storyId: string) => {
    const supabase = createClient();
    await supabase
      .from('broadcast_stories')
      .update({ locked_by: null, locked_at: null })
      .eq('id', storyId);
  };

  // ─── CRUD ──────────────────────────────────────────────

  const [newStory, setNewStory] = useState({ title: '', slug: '', story_type: 'reader' as BroadcastStoryType, priority: 0 });

  const handleCreateStory = async () => {
    if (!newStory.title || !newStory.slug) { toast.error('Title and slug are required'); return; }
    const supabase = createClient();
    const { data, error } = await supabase
      .from('broadcast_stories')
      .insert({
        project_id: projectId,
        title: newStory.title,
        slug: newStory.slug.toUpperCase().replace(/\s+/g, '-'),
        story_type: newStory.story_type,
        priority: newStory.priority,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) { toast.error(error.message); return; }
    toast.success('Story created');
    setShowCreateModal(false);
    setNewStory({ title: '', slug: '', story_type: 'reader', priority: 0 });
    await fetchStories();
    if (data) selectStory(data);
  };

  const handleSaveStory = async () => {
    if (!selectedStory) return;
    const supabase = createClient();

    // Save a version first
    const { error: vError } = await supabase
      .from('broadcast_story_versions')
      .insert({
        story_id: selectedStory.id,
        version: selectedStory.version + 1,
        body: selectedStory.body,
        script_text: editScriptText,
        changed_by: user?.id,
        change_note: 'Updated via Stories editor',
      });

    if (vError) console.warn('Version save error:', vError);

    // Update the story
    const { error } = await supabase
      .from('broadcast_stories')
      .update({
        title: editTitle,
        slug: editSlug.toUpperCase().replace(/\s+/g, '-'),
        script_text: editScriptText,
        story_type: editStoryType,
        priority: editPriority,
        estimated_duration: editDuration || null,
        status: editStatus,
        version: selectedStory.version + 1,
        locked_by: null,
        locked_at: null,
      })
      .eq('id', selectedStory.id);

    if (error) { toast.error(error.message); return; }

    toast.success('Story saved (v' + (selectedStory.version + 1) + ')');
    setEditMode(false);
    await fetchStories();
    // Re-select to refresh
    const updated = stories.find(s => s.id === selectedStory.id);
    if (updated) setSelectedStory({ ...updated, version: selectedStory.version + 1 });
    fetchVersions(selectedStory.id);
  };

  const handleCancelEdit = () => {
    if (selectedStory) unlockStory(selectedStory.id);
    setEditMode(false);
  };

  const handleDeleteStory = async (storyId: string) => {
    const supabase = createClient();
    await supabase.from('broadcast_stories').delete().eq('id', storyId);
    setSelectedStory(null);
    toast.success('Story deleted');
    fetchStories();
  };

  const handleStatusChange = async (storyId: string, status: BroadcastStoryStatus) => {
    const supabase = createClient();
    await supabase.from('broadcast_stories').update({ status }).eq('id', storyId);
    toast.success(`Status → ${status}`);
    fetchStories();
    if (selectedStory?.id === storyId) {
      setSelectedStory(prev => prev ? { ...prev, status } : prev);
    }
  };

  // ─── Filtered Stories ──────────────────────────────────

  const filteredStories = stories.filter(s => {
    if (filter.status !== 'all' && s.status !== filter.status) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
    }
    return true;
  });

  // ─── Member lookup for display ─────────────────────────

  const getMemberName = (userId: string | null) => {
    if (!userId) return null;
    const member = members.find((m) => m.user_id === userId);
    return member?.profile?.full_name || member?.profile?.email || 'User';
  };

  // ─── Render ────────────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-screen bg-surface-950">
      {/* ── Left Panel: Story List ───────────────────── */}
      <div className="w-80 border-r border-surface-800 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-3 border-b border-surface-800 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Stories</h2>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>+ New</Button>
          </div>
          {/* Search */}
          <input
            type="text"
            placeholder="Search stories..."
            value={filter.search}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            className="w-full bg-surface-800 text-white border border-surface-700 rounded px-2 py-1.5 text-xs placeholder-surface-500"
          />
          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-1">
            <button
              className={cn('text-[10px] px-2 py-0.5 rounded font-medium transition-colors',
                filter.status === 'all' ? 'bg-surface-700 text-white' : 'text-surface-500 hover:text-white')}
              onClick={() => setFilter(prev => ({ ...prev, status: 'all' }))}
            >
              All ({stories.length})
            </button>
            {(['draft', 'working', 'ready', 'approved'] as BroadcastStoryStatus[]).map(status => {
              const count = stories.filter(s => s.status === status).length;
              if (count === 0 && status !== 'draft') return null;
              const opt = BROADCAST_STORY_STATUS_OPTIONS.find(o => o.value === status);
              return (
                <button
                  key={status}
                  className={cn('text-[10px] px-2 py-0.5 rounded font-medium transition-colors',
                    filter.status === status ? `${opt?.color} text-white` : 'text-surface-500 hover:text-white')}
                  onClick={() => setFilter(prev => ({ ...prev, status }))}
                >
                  {opt?.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Story list */}
        <div className="flex-1 overflow-y-auto">
          {filteredStories.length === 0 ? (
            <div className="p-4 text-center text-sm text-surface-500">No stories found</div>
          ) : (
            filteredStories.map(story => {
              const statusOpt = BROADCAST_STORY_STATUS_OPTIONS.find(o => o.value === story.status);
              const typeOpt = BROADCAST_STORY_TYPES.find(t => t.value === story.story_type);
              const isSelected = selectedStory?.id === story.id;
              const isLocked = story.locked_by && story.locked_by !== user?.id;

              return (
                <button
                  key={story.id}
                  onClick={() => selectStory(story)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-b border-surface-800/50 transition-colors',
                    isSelected ? 'bg-surface-800' : 'hover:bg-surface-800/50',
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusOpt?.color)} />
                    <span className="text-[10px] font-bold text-surface-500 font-mono">{story.slug}</span>
                    <span className="text-[10px] px-1 py-0 rounded bg-surface-800 text-surface-400 font-mono">
                      {typeOpt?.abbr}
                    </span>
                    {story.priority >= 4 && (
                      <span className="text-[9px] px-1 py-0 rounded bg-red-900 text-red-300 font-bold">
                        {story.priority === 5 ? 'FLASH' : 'URG'}
                      </span>
                    )}
                    {isLocked && (
                      <span className="text-[9px] text-amber-500" title={`Locked by ${getMemberName(story.locked_by)}`}>🔒</span>
                    )}
                  </div>
                  <div className="text-sm text-surface-200 font-medium truncate">{story.title}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-surface-500">
                    {story.estimated_duration && (
                      <span>{formatBroadcastDuration(story.estimated_duration)}</span>
                    )}
                    <span>v{story.version}</span>
                    <span>{new Date(story.updated_at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</span>
                    {story.assigned_to && <span>→ {getMemberName(story.assigned_to)}</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Panel: Story Detail / Editor ──────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedStory ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              title="Select a Story"
              description="Choose a story from the list to view or edit it."
              action={<Button onClick={() => setShowCreateModal(true)}>Create New Story</Button>}
            />
          </div>
        ) : editMode ? (
          /* ── Edit Mode ─────────────────────────────── */
          <>
            <div className="flex items-center justify-between p-3 border-b border-surface-800 bg-surface-900/50">
              <div className="flex items-center gap-3">
                <span className="text-xs text-amber-400 font-bold">EDITING</span>
                <span className="text-xs text-surface-500">v{selectedStory.version} → v{selectedStory.version + 1}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                <Button size="sm" onClick={handleSaveStory}>Save</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                <Input label="Slug" value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-surface-400 block mb-1">Type</label>
                  <select
                    value={editStoryType}
                    onChange={(e) => setEditStoryType(e.target.value as BroadcastStoryType)}
                    className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
                  >
                    {BROADCAST_STORY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.abbr} — {t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-surface-400 block mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as BroadcastStoryStatus)}
                    className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
                  >
                    {BROADCAST_STORY_STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-surface-400 block mb-1">Priority</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(Number(e.target.value))}
                      className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value={0}>0 — Routine</option>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3 — Urgent</option>
                      <option value={4}>4 — Bulletin</option>
                      <option value={5}>5 — FLASH</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-surface-400 block mb-1">Duration (s)</label>
                    <input
                      type="number"
                      min="0"
                      value={editDuration}
                      onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                      className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
              {/* Script / Prompter Text */}
              <div>
                <label className="text-xs font-medium text-surface-400 block mb-1">Script / Prompter Text</label>
                <textarea
                  value={editScriptText}
                  onChange={(e) => setEditScriptText(e.target.value)}
                  rows={20}
                  className="w-full bg-surface-900 text-white border border-surface-700 rounded-lg px-4 py-3 text-base font-serif leading-relaxed placeholder-surface-600 focus:ring-1 focus:ring-[#FF5F1F] focus:border-[#FF5F1F]"
                  placeholder="Enter the script/prompter text for this story...

Example:
(ANCHOR ON CAM 1)
Good evening. Tonight's top story: a massive fire has broken out in central Oslo.

(VO — ROLL VT1)
Firefighters from six stations were called to the scene at approximately 3:45 this afternoon..."
                />
              </div>
            </div>
          </>
        ) : (
          /* ── View Mode ──────────────────────────────── */
          <>
            <div className="flex items-center justify-between p-3 border-b border-surface-800 bg-surface-900/50">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-surface-500">{selectedStory.slug}</span>
                <span className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded text-white',
                  BROADCAST_STORY_STATUS_OPTIONS.find(s => s.value === selectedStory.status)?.color
                )}>
                  {selectedStory.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-xs text-surface-500">v{selectedStory.version}</span>
                {selectedStory.locked_by && selectedStory.locked_by !== user?.id && (
                  <span className="text-xs text-amber-400">🔒 Locked by {getMemberName(selectedStory.locked_by)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Quick status change */}
                {selectedStory.status === 'draft' && (
                  <Button size="sm" variant="ghost" onClick={() => handleStatusChange(selectedStory.id, 'working')}>
                    Mark Working
                  </Button>
                )}
                {selectedStory.status === 'working' && (
                  <Button size="sm" variant="ghost" onClick={() => handleStatusChange(selectedStory.id, 'ready')}>
                    Mark Ready
                  </Button>
                )}
                {selectedStory.status === 'ready' && (
                  <Button size="sm" variant="ghost" onClick={() => handleStatusChange(selectedStory.id, 'approved')}>
                    Approve
                  </Button>
                )}
                <Button size="sm" onClick={startEdit}>Edit</Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Meta info */}
              <div className="p-4 border-b border-surface-800 bg-surface-900/30">
                <h1 className="text-xl font-black text-white mb-2">{selectedStory.title}</h1>
                <div className="flex flex-wrap gap-3 text-xs text-surface-400">
                  <span>Type: <strong className="text-surface-300">{BROADCAST_STORY_TYPES.find(t => t.value === selectedStory.story_type)?.label}</strong></span>
                  {selectedStory.estimated_duration && (
                    <span>Duration: <strong className="text-surface-300">{formatBroadcastDuration(selectedStory.estimated_duration)}</strong></span>
                  )}
                  <span>Priority: <strong className="text-surface-300">{selectedStory.priority}</strong></span>
                  {selectedStory.source && <span>Source: <strong className="text-surface-300">{selectedStory.source}</strong></span>}
                  {selectedStory.assigned_to && <span>Assigned: <strong className="text-surface-300">{getMemberName(selectedStory.assigned_to)}</strong></span>}
                  <span>Updated: <strong className="text-surface-300">{new Date(selectedStory.updated_at).toLocaleString('nb-NO')}</strong></span>
                </div>
              </div>

              {/* Script text */}
              <div className="p-4">
                {selectedStory.script_text ? (
                  <div className="bg-surface-900 border border-surface-800 rounded-lg p-6">
                    <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-3">Script / Prompter Text</div>
                    <pre className="text-base text-surface-200 font-serif leading-relaxed whitespace-pre-wrap">
                      {selectedStory.script_text}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-12 text-surface-500">
                    <p>No script text yet.</p>
                    <Button size="sm" variant="ghost" className="mt-2" onClick={startEdit}>Add Script</Button>
                  </div>
                )}
              </div>

              {/* Version history */}
              {versions.length > 0 && (
                <div className="p-4 border-t border-surface-800">
                  <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-2">Version History</div>
                  <div className="space-y-1">
                    {versions.map(v => (
                      <div key={v.id} className="flex items-center gap-3 text-xs text-surface-400 py-1">
                        <span className="font-mono text-surface-500">v{v.version}</span>
                        <span>{new Date(v.created_at).toLocaleString('nb-NO')}</span>
                        {v.changed_by && <span>by {getMemberName(v.changed_by)}</span>}
                        {v.change_note && <span className="text-surface-500 truncate">— {v.change_note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Create Story Modal ──────────────────────── */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Story">
        <div className="space-y-4">
          <Input
            label="Title"
            value={newStory.title}
            onChange={(e) => setNewStory(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. PM announces new climate policy"
          />
          <Input
            label="Slug"
            value={newStory.slug}
            onChange={(e) => setNewStory(prev => ({ ...prev, slug: e.target.value }))}
            placeholder="e.g. PM-CLIMATE"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Type</label>
              <select
                value={newStory.story_type}
                onChange={(e) => setNewStory(prev => ({ ...prev, story_type: e.target.value as BroadcastStoryType }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                {BROADCAST_STORY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.abbr} — {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Priority</label>
              <select
                value={newStory.priority}
                onChange={(e) => setNewStory(prev => ({ ...prev, priority: Number(e.target.value) }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value={0}>0 — Routine</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3 — Urgent</option>
                <option value={4}>4 — Bulletin</option>
                <option value={5}>5 — FLASH</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateStory}>Create Story</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
