'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, Modal, Input, toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import type { ScriptNotesRound, ScriptNote, NoteCategory, NoteStatus, NotesRoundStatus } from '@/lib/types';

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  story: 'Story',
  character: 'Character',
  dialogue: 'Dialogue',
  structure: 'Structure',
  format: 'Format',
  general: 'General',
};

const CATEGORY_COLORS: Record<NoteCategory, string> = {
  story: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  character: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  dialogue: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  structure: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  format: 'bg-surface-600/50 text-surface-300 border-surface-500/30',
  general: 'bg-surface-600/50 text-surface-300 border-surface-500/30',
};

const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  open: 'Open',
  addressed: 'Addressed',
  deferred: 'Deferred',
  rejected: 'N/A',
};

const NOTE_STATUS_COLORS: Record<NoteStatus, string> = {
  open: 'bg-red-500/15 text-red-300 border-red-500/30',
  addressed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  deferred: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  rejected: 'bg-surface-600/50 text-surface-400 border-surface-500/30',
};

const ROUND_STATUS_LABELS: Record<NotesRoundStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
};

const ROUND_STATUS_COLORS: Record<NotesRoundStatus, string> = {
  open: 'bg-blue-500/15 text-blue-300',
  in_progress: 'bg-amber-500/15 text-amber-300',
  closed: 'bg-surface-600/50 text-surface-400',
};

const CATEGORIES: NoteCategory[] = ['story', 'character', 'dialogue', 'structure', 'format', 'general'];
const NOTE_STATUSES: NoteStatus[] = ['open', 'addressed', 'deferred', 'rejected'];

export default function NotesRoundsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  const [rounds, setRounds] = useState<ScriptNotesRound[]>([]);
  const [selectedRound, setSelectedRound] = useState<ScriptNotesRound | null>(null);
  const [notes, setNotes] = useState<ScriptNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Filter
  const [filterCategory, setFilterCategory] = useState<NoteCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<NoteStatus | 'all'>('all');

  // Modals
  const [showNewRound, setShowNewRound] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [editingNote, setEditingNote] = useState<ScriptNote | null>(null);

  // Round form
  const [roundTitle, setRoundTitle] = useState('');
  const [roundFrom, setRoundFrom] = useState('');
  const [roundDue, setRoundDue] = useState('');

  // Note form
  const [noteCategory, setNoteCategory] = useState<NoteCategory>('general');
  const [noteContent, setNoteContent] = useState('');
  const [noteSceneRef, setNoteSceneRef] = useState('');
  const [notePageRef, setNotePageRef] = useState('');
  const [noteStatus, setNoteStatus] = useState<NoteStatus>('open');

  const [saving, setSaving] = useState(false);

  const loadRounds = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('script_notes_rounds')
      .select('*')
      .eq('project_id', params.id)
      .order('round_number', { ascending: false });
    setRounds(data || []);
    setLoading(false);
  }, [params.id]);

  const loadNotes = useCallback(async (roundId: string) => {
    setLoadingNotes(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('script_notes')
      .select('*')
      .eq('round_id', roundId)
      .order('created_at', { ascending: true });
    setNotes(data || []);
    setLoadingNotes(false);
  }, []);

  useEffect(() => { loadRounds(); }, [loadRounds]);

  useEffect(() => {
    if (selectedRound) loadNotes(selectedRound.id);
    else setNotes([]);
  }, [selectedRound, loadNotes]);

  const handleCreateRound = async () => {
    if (!roundTitle.trim() || !user) return;
    setSaving(true);
    const supabase = createClient();
    const nextNumber = rounds.length ? Math.max(...rounds.map(r => r.round_number)) + 1 : 1;
    const { data, error } = await supabase
      .from('script_notes_rounds')
      .insert({
        project_id: params.id,
        title: roundTitle.trim(),
        notes_from: roundFrom.trim() || null,
        due_date: roundDue || null,
        round_number: nextNumber,
        created_by: user.id,
      })
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setRounds(prev => [data, ...prev]);
    setSelectedRound(data);
    setShowNewRound(false);
    setRoundTitle(''); setRoundFrom(''); setRoundDue('');
  };

  const handleDeleteRound = async (round: ScriptNotesRound) => {
    if (!confirm(`Delete "${round.title}" and all its notes? This cannot be undone.`)) return;
    const supabase = createClient();
    await supabase.from('script_notes_rounds').delete().eq('id', round.id);
    setRounds(prev => prev.filter(r => r.id !== round.id));
    if (selectedRound?.id === round.id) setSelectedRound(null);
  };

  const handleCycleRoundStatus = async (round: ScriptNotesRound) => {
    const cycle: NotesRoundStatus[] = ['open', 'in_progress', 'closed'];
    const next = cycle[(cycle.indexOf(round.status) + 1) % cycle.length];
    const supabase = createClient();
    await supabase.from('script_notes_rounds').update({ status: next }).eq('id', round.id);
    setRounds(prev => prev.map(r => r.id === round.id ? { ...r, status: next } : r));
    if (selectedRound?.id === round.id) setSelectedRound(prev => prev ? { ...prev, status: next } : prev);
  };

  const openNewNote = () => {
    setEditingNote(null);
    setNoteCategory('general'); setNoteContent(''); setNoteSceneRef(''); setNotePageRef(''); setNoteStatus('open');
    setShowNewNote(true);
  };

  const openEditNote = (note: ScriptNote) => {
    setEditingNote(note);
    setNoteCategory(note.category); setNoteContent(note.content);
    setNoteSceneRef(note.scene_ref || ''); setNotePageRef(note.page_ref || '');
    setNoteStatus(note.status);
    setShowNewNote(true);
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim() || !selectedRound || !user) return;
    setSaving(true);
    const supabase = createClient();
    if (editingNote) {
      const { error } = await supabase.from('script_notes').update({
        category: noteCategory, content: noteContent.trim(),
        scene_ref: noteSceneRef.trim() || null,
        page_ref: notePageRef.trim() || null,
        status: noteStatus,
      }).eq('id', editingNote.id);
      if (!error) setNotes(prev => prev.map(n => n.id === editingNote.id
        ? { ...n, category: noteCategory, content: noteContent.trim(), scene_ref: noteSceneRef.trim() || null, page_ref: notePageRef.trim() || null, status: noteStatus }
        : n));
    } else {
      const { data, error } = await supabase.from('script_notes').insert({
        round_id: selectedRound.id, project_id: params.id,
        category: noteCategory, content: noteContent.trim(),
        scene_ref: noteSceneRef.trim() || null,
        page_ref: notePageRef.trim() || null,
        status: noteStatus, created_by: user.id,
      }).select().single();
      if (!error && data) setNotes(prev => [...prev, data]);
    }
    setSaving(false);
    setShowNewNote(false);
    setEditingNote(null);
  };

  const handleDeleteNote = async (note: ScriptNote) => {
    const supabase = createClient();
    await supabase.from('script_notes').delete().eq('id', note.id);
    setNotes(prev => prev.filter(n => n.id !== note.id));
  };

  const handleCycleNoteStatus = async (note: ScriptNote) => {
    const cycle: NoteStatus[] = ['open', 'addressed', 'deferred', 'rejected'];
    const next = cycle[(cycle.indexOf(note.status) + 1) % cycle.length];
    const supabase = createClient();
    await supabase.from('script_notes').update({ status: next }).eq('id', note.id);
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, status: next } : n));
  };

  const filteredNotes = notes.filter(n => {
    if (filterCategory !== 'all' && n.category !== filterCategory) return false;
    if (filterStatus !== 'all' && n.status !== filterStatus) return false;
    return true;
  });

  const openCount = notes.filter(n => n.status === 'open').length;
  const addressedCount = notes.filter(n => n.status === 'addressed').length;

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
          <h1 className="text-lg font-bold text-white">Notes Rounds</h1>
          <p className="text-sm text-surface-400 mt-0.5">Track development notes from producers, directors, and executives</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowNewRound(true)} size="sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Round
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Rounds sidebar */}
        <div className={`${selectedRound ? 'hidden md:flex' : 'flex'} md:flex flex-col w-full md:w-64 border-b md:border-b-0 md:border-r border-surface-800 md:overflow-hidden shrink-0`}>
          <div className="px-4 py-3 border-b border-surface-800">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">All Rounds</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {rounds.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-surface-800 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <p className="text-xs text-surface-500">No notes rounds yet</p>
              </div>
            ) : (
              rounds.map(round => (
                <button
                  key={round.id}
                  onClick={() => setSelectedRound(round)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-surface-800/50 transition-colors hover:bg-surface-800/50 group',
                    selectedRound?.id === round.id && 'bg-surface-800/70 border-l-2 border-l-[#FF5F1F]'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs text-surface-500 font-mono">R{round.round_number}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', ROUND_STATUS_COLORS[round.status])}>
                      {ROUND_STATUS_LABELS[round.status]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white truncate">{round.title}</p>
                  {round.notes_from && <p className="text-xs text-surface-400 truncate mt-0.5">from {round.notes_from}</p>}
                  {round.due_date && (
                    <p className="text-xs text-surface-500 mt-0.5">
                      Due: {new Date(round.due_date).toLocaleDateString()}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Notes panel */}
        <div className={`${selectedRound ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}>
          {!selectedRound ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                </div>
                <p className="text-surface-400 font-medium">Select a notes round</p>
                <p className="text-surface-600 text-sm mt-1">{canEdit ? 'Or create a new one to get started.' : 'No round selected.'}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Round header */}
              <div className="border-b border-surface-800 px-4 md:px-6 py-4 flex items-start justify-between gap-4 shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Mobile back button */}
                    <button onClick={() => setSelectedRound(null)}
                      className="md:hidden mr-1 p-1 -ml-1 rounded text-surface-400 hover:text-white">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h2 className="text-base font-bold text-white">{selectedRound.title}</h2>
                    <button
                      onClick={() => handleCycleRoundStatus(selectedRound)}
                      className={cn('text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity', ROUND_STATUS_COLORS[selectedRound.status])}
                      title="Click to cycle status"
                    >
                      {ROUND_STATUS_LABELS[selectedRound.status]}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-surface-400">
                    {selectedRound.notes_from && <span>From: {selectedRound.notes_from}</span>}
                    {selectedRound.due_date && <span>Due: {new Date(selectedRound.due_date).toLocaleDateString()}</span>}
                    <span>{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
                    {openCount > 0 && <span className="text-red-400">{openCount} open</span>}
                    {addressedCount > 0 && <span className="text-emerald-400">{addressedCount} addressed</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canEdit && (
                    <Button onClick={openNewNote} size="sm">
                      <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add Note
                    </Button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteRound(selectedRound)}
                      className="p-2 rounded text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete round"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Filters */}
              <div className="border-b border-surface-800 px-6 py-2 flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-surface-500">Category:</span>
                  {(['all', ...CATEGORIES] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat as NoteCategory | 'all')}
                      className={cn('text-[11px] px-2 py-0.5 rounded-full border transition-colors capitalize',
                        filterCategory === cat
                          ? 'bg-[#FF5F1F]/20 text-[#FF5F1F] border-[#FF5F1F]/40'
                          : 'text-surface-400 border-surface-700 hover:border-surface-500'
                      )}
                    >
                      {cat === 'all' ? 'All' : CATEGORY_LABELS[cat as NoteCategory]}
                    </button>
                  ))}
                </div>
                <div className="w-px h-4 bg-surface-700 hidden md:block" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-surface-500">Status:</span>
                  {(['all', ...NOTE_STATUSES] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s as NoteStatus | 'all')}
                      className={cn('text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                        filterStatus === s
                          ? 'bg-[#FF5F1F]/20 text-[#FF5F1F] border-[#FF5F1F]/40'
                          : 'text-surface-400 border-surface-700 hover:border-surface-500'
                      )}
                    >
                      {s === 'all' ? 'All' : NOTE_STATUS_LABELS[s as NoteStatus]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes list */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {loadingNotes ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredNotes.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-surface-400 font-medium">
                      {notes.length === 0 ? 'No notes yet' : 'No notes match your filters'}
                    </p>
                    {notes.length === 0 && canEdit && (
                      <p className="text-surface-600 text-sm mt-1">Click "Add Note" to start entering notes for this round.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredNotes.map((note) => (
                      <div
                        key={note.id}
                        className={cn('rounded-xl border p-4 transition-colors group',
                          note.status === 'addressed' ? 'bg-emerald-500/5 border-emerald-500/20' :
                          note.status === 'rejected' ? 'bg-surface-800/30 border-surface-700/50 opacity-60' :
                          'bg-surface-800/50 border-surface-700/50 hover:border-surface-600'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium', CATEGORY_COLORS[note.category])}>
                                {CATEGORY_LABELS[note.category]}
                              </span>
                              {note.scene_ref && (
                                <span className="text-[11px] text-surface-400 font-mono bg-surface-800 px-1.5 py-0.5 rounded">
                                  {note.scene_ref}
                                </span>
                              )}
                              {note.page_ref && (
                                <span className="text-[11px] text-surface-500">p. {note.page_ref}</span>
                              )}
                            </div>
                            <p className={cn('text-sm leading-relaxed', note.status === 'addressed' ? 'text-surface-400 line-through-subtle' : 'text-white')}>
                              {note.content}
                            </p>
                            <p className="text-xs text-surface-600 mt-2">{timeAgo(note.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleCycleNoteStatus(note)}
                              className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap', NOTE_STATUS_COLORS[note.status])}
                              title="Click to cycle status"
                            >
                              {NOTE_STATUS_LABELS[note.status]}
                            </button>
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => openEditNote(note)}
                                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded text-surface-500 hover:text-white hover:bg-surface-700 transition-all"
                                  title="Edit"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteNote(note)}
                                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                  title="Delete"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Round Modal */}
      <Modal isOpen={showNewRound} onClose={() => setShowNewRound(false)} title="New Notes Round" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1.5">Round Title *</label>
            <Input
              value={roundTitle}
              onChange={(e) => setRoundTitle(e.target.value)}
              placeholder="e.g. Producer Notes — Pass 1"
              className="w-full"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRound()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1.5">Notes From</label>
            <Input
              value={roundFrom}
              onChange={(e) => setRoundFrom(e.target.value)}
              placeholder="e.g. Studio, Producer, Director"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1.5">Due Date</label>
            <input
              type="date"
              value={roundDue}
              onChange={(e) => setRoundDue(e.target.value)}
              className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF5F1F]/60"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={() => setShowNewRound(false)}>Cancel</Button>
          <Button onClick={handleCreateRound} loading={saving} disabled={!roundTitle.trim()}>Create Round</Button>
        </div>
      </Modal>

      {/* Add / Edit Note Modal */}
      <Modal
        isOpen={showNewNote}
        onClose={() => { setShowNewNote(false); setEditingNote(null); }}
        title={editingNote ? 'Edit Note' : 'Add Note'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setNoteCategory(cat)}
                  className={cn('text-xs px-3 py-1 rounded-full border transition-colors capitalize',
                    noteCategory === cat
                      ? CATEGORY_COLORS[cat]
                      : 'text-surface-400 border-surface-700 hover:border-surface-500'
                  )}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1.5">Note *</label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="The protagonist's motivation in Act 2 needs to be clearer..."
              rows={4}
              className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-[#FF5F1F]/60 resize-none"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1.5">Scene Ref</label>
              <Input
                value={noteSceneRef}
                onChange={(e) => setNoteSceneRef(e.target.value)}
                placeholder="e.g. Sc 14, INT. KITCHEN"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1.5">Page Ref</label>
              <Input
                value={notePageRef}
                onChange={(e) => setNotePageRef(e.target.value)}
                placeholder="e.g. 23"
                className="w-full"
              />
            </div>
          </div>
          {editingNote && (
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1.5">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {NOTE_STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => setNoteStatus(s)}
                    className={cn('text-xs px-3 py-1 rounded-full border transition-colors',
                      noteStatus === s ? NOTE_STATUS_COLORS[s] : 'text-surface-400 border-surface-700 hover:border-surface-500'
                    )}
                  >
                    {NOTE_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={() => { setShowNewNote(false); setEditingNote(null); }}>Cancel</Button>
          <Button onClick={handleSaveNote} loading={saving} disabled={!noteContent.trim()}>{editingNote ? 'Save' : 'Add Note'}</Button>
        </div>
      </Modal>
    </div>
  );
}
