'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn, getInitials, randomColor } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { Character } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────

interface VoiceCastEntry extends Character {
  voice_actor?: string | null;
  casting_notes?: string | null;
  audition_status?: 'uncast' | 'auditioning' | 'cast' | 'confirmed';
  voice_direction?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  uncast: 'Uncast',
  auditioning: 'Auditioning',
  cast: 'Cast',
  confirmed: 'Confirmed',
};

const STATUS_COLORS: Record<string, string> = {
  uncast: 'bg-surface-700/60 text-surface-400',
  auditioning: 'bg-amber-500/20 text-amber-300',
  cast: 'bg-sky-500/20 text-sky-300',
  confirmed: 'bg-emerald-500/20 text-emerald-300',
};

function statusBadge(status: string) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', STATUS_COLORS[status] || STATUS_COLORS.uncast)}>
      {STATUS_LABELS[status] || 'Uncast'}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────

export default function VoiceCastPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const isAudioDrama = currentProject?.project_type === 'audio_drama' ||
    (currentProject as any)?.script_type === 'audio_drama';

  const [cast, setCast] = useState<VoiceCastEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VoiceCastEntry | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [filter, setFilter] = useState<'all' | 'uncast' | 'auditioning' | 'cast' | 'confirmed'>('all');
  const [syncing, setSyncing] = useState(false);
  const [scriptCount, setScriptCount] = useState<number | null>(null);

  useEffect(() => {
    fetchCast();
  }, [params.id]);

  const fetchCast = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data }, scriptData] = await Promise.all([
        supabase
          .from('characters')
          .select('*')
          .eq('project_id', params.id)
          .order('is_main', { ascending: false })
          .order('sort_order'),
        // Count distinct character names in the script so we can show a sync hint
        supabase
          .from('scripts').select('id').eq('project_id', params.id)
          .then(async ({ data: scripts }) => {
            if (!scripts?.length) return 0;
            const ids = scripts.map((s: { id: string }) => s.id);
            const { data: els } = await supabase
              .from('script_elements')
              .select('content')
              .in('script_id', ids)
              .in('element_type', ['character', 'narrator', 'announcer']);
            return new Set((els || []).map((e: { content: string }) => e.content.trim().toUpperCase()).filter(Boolean)).size;
          }),
      ]);
      const castData = (data || []) as VoiceCastEntry[];
      setCast(castData);
      setScriptCount(scriptData as number);
      // Auto-sync on first load for audio drama projects with no characters yet
      if (castData.length === 0 && (scriptData as number) > 0) {
        // Delay slightly so fetchCast finishes rendering before auto-sync kicks in
        setTimeout(() => handleAutoSync(params.id), 400);
      }
    } finally {
      setLoading(false);
    }
  };

  // Internal sync impl — accepts explicit projectId so auto-sync on mount can
  // call it before params.id might be stale in a closure.
  const syncCharacters = async (projectId: string, existingCast: VoiceCastEntry[]) => {
    const supabase = createClient();
    const { data: scripts } = await supabase
      .from('scripts').select('id').eq('project_id', projectId);
    if (!scripts?.length) return 0;
    const scriptIds = scripts.map((s: { id: string }) => s.id);
    // Include narrator / announcer for audio dramas alongside the standard character type
    const { data: elements } = await supabase
      .from('script_elements')
      .select('content, element_type')
      .in('script_id', scriptIds)
      .in('element_type', ['character', 'narrator', 'announcer']);
    const names = Array.from(new Set((elements || []).map((e: { content: string }) => e.content.trim().toUpperCase()).filter(Boolean)));
    const existing = existingCast.map(c => c.name?.toUpperCase());
    const newNames = names.filter(n => !existing.includes(n));
    if (newNames.length) {
      const rows = newNames.map(name => ({
        project_id: projectId,
        name,
        color: randomColor(),
        is_main: false,
      }));
      await supabase.from('characters').insert(rows);
    }
    return newNames.length;
  };

  // Auto-sync variant — quiet, no toast, called on first load
  const handleAutoSync = async (projectId: string) => {
    setSyncing(true);
    try {
      await syncCharacters(projectId, []);
      await fetchCast();
    } catch { /* swallow */ } finally {
      setSyncing(false);
    }
  };

  // Manual sync — triggered by button, shows toasts
  const handleSync = async () => {
    setSyncing(true);
    try {
      const added = await syncCharacters(params.id, cast);
      await fetchCast();
      if (added > 0) toast.success(`Synced ${added} new character${added > 1 ? 's' : ''} from script`);
      else toast.success('All characters already synced');
    } catch (err) {
      console.error(err);
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async (updates: Partial<VoiceCastEntry>) => {
    if (!selected || !canEdit) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('characters')
      .update({
        name: updates.name,
        description: updates.description,
        // Store voice-specific fields in the `notes` column as JSON if needed,
        // or use existing character columns mapped to audio drama concepts
        notes: JSON.stringify({
          voice_actor: updates.voice_actor || '',
          casting_notes: updates.casting_notes || '',
          audition_status: updates.audition_status || 'uncast',
          voice_direction: updates.voice_direction || '',
        }),
      })
      .eq('id', selected.id);
    if (error) { toast.error('Failed to save'); return; }
    toast.success('Saved');
    setShowEditor(false);
    fetchCast();
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    const ok = await confirm({ title: 'Remove from cast?', message: 'This removes the character from the voice cast. It cannot be undone.' });
    if (!ok) return;
    const supabase = createClient();
    await supabase.from('characters').delete().eq('id', id);
    fetchCast();
  };

  // Parse stored notes JSON
  const parseNotes = (notesStr: string | null | undefined): Pick<VoiceCastEntry, 'voice_actor' | 'casting_notes' | 'audition_status' | 'voice_direction'> => {
    if (!notesStr) return { voice_actor: '', casting_notes: '', audition_status: 'uncast', voice_direction: '' };
    try { return { voice_actor: '', casting_notes: '', audition_status: 'uncast', voice_direction: '', ...JSON.parse(notesStr) }; }
    catch { return { voice_actor: '', casting_notes: '', audition_status: 'uncast', voice_direction: '' }; }
  };

  const visible = filter === 'all' ? cast : cast.filter(c => {
    const extra = parseNotes((c as any).notes);
    return (extra.audition_status || 'uncast') === filter;
  });

  const stats = cast.reduce((acc, c) => {
    const extra = parseNotes((c as any).notes);
    const status = extra.audition_status || 'uncast';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Populate selected with parsed extras when opening editor
  const openEditor = (c: VoiceCastEntry) => {
    const extra = parseNotes((c as any).notes);
    setSelected({ ...c, ...extra });
    setShowEditor(true);
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
      <ConfirmDialog />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Voice Cast</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {isAudioDrama ? 'Voice actors and casting for your audio drama' : 'Manage voice actors and casting'}
            {scriptCount !== null && scriptCount > cast.length && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-400">
                · {scriptCount - cast.length} script character{scriptCount - cast.length !== 1 ? 's' : ''} not yet synced
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115-6.7M20 15a9 9 0 01-15 6.7" />
              </svg>
              {syncing ? 'Syncing…' : 'Sync from Script'}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(['uncast', 'auditioning', 'cast', 'confirmed'] as const).map(s => (
          <Card key={s} className={cn('p-3 text-center border-surface-800/80 cursor-pointer transition-all', filter === s && 'ring-1 ring-white/20')} onClick={() => setFilter(filter === s ? 'all' : s)}>
            <p className="text-xl font-bold text-white">{stats[s] || 0}</p>
            <p className="text-[10px] text-surface-500 mt-0.5 capitalize">{s}</p>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-surface-800/60 rounded-xl w-fit text-xs">
        {(['all', 'uncast', 'auditioning', 'cast', 'confirmed'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              'px-3 py-1.5 rounded-lg font-medium transition-all capitalize',
              filter === tab ? 'bg-surface-700 text-white shadow' : 'text-surface-400 hover:text-white'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          }
          title="No cast members"
          description={cast.length === 0 ? 'Sync characters from your script or add them from the Characters page.' : 'No characters match this filter.'}
          action={cast.length === 0 && canEdit ? (
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync from Script'}
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(c => {
            const extra = parseNotes((c as any).notes);
            return (
              <Card
                key={c.id}
                hover
                className="p-4 border-surface-800/80 cursor-pointer"
                onClick={() => openEditor(c)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: c.color || '#6366f1' }}
                  >
                    {getInitials(c.name || '?')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                      {statusBadge(extra.audition_status || 'uncast')}
                    </div>
                    {extra.voice_actor && (
                      <p className="text-xs text-violet-300 mt-0.5 truncate">🎤 {extra.voice_actor}</p>
                    )}
                    {c.description && (
                      <p className="text-[11px] text-surface-500 mt-1 line-clamp-2">{c.description}</p>
                    )}
                    {extra.voice_direction && (
                      <p className="text-[11px] text-surface-500 mt-1 italic line-clamp-1">"{extra.voice_direction}"</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {selected && (
        <VoiceCastEditorModal
          entry={selected}
          isOpen={showEditor}
          onClose={() => { setShowEditor(false); setSelected(null); }}
          onSave={handleSave}
          onDelete={canEdit ? () => { setShowEditor(false); handleDelete(selected.id); } : undefined}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

// ─── Editor modal ─────────────────────────────────────────────

function VoiceCastEditorModal({
  entry, isOpen, onClose, onSave, onDelete, canEdit,
}: {
  entry: VoiceCastEntry;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<VoiceCastEntry>) => void;
  onDelete?: () => void;
  canEdit: boolean;
}) {
  const [name, setName] = useState(entry.name || '');
  const [description, setDescription] = useState(entry.description || '');
  const [voiceActor, setVoiceActor] = useState(entry.voice_actor || '');
  const [castingNotes, setCastingNotes] = useState(entry.casting_notes || '');
  const [voiceDirection, setVoiceDirection] = useState(entry.voice_direction || '');
  const [status, setStatus] = useState<VoiceCastEntry['audition_status']>(entry.audition_status || 'uncast');

  useEffect(() => {
    setName(entry.name || '');
    setDescription(entry.description || '');
    setVoiceActor(entry.voice_actor || '');
    setCastingNotes(entry.casting_notes || '');
    setVoiceDirection(entry.voice_direction || '');
    setStatus(entry.audition_status || 'uncast');
  }, [entry]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Voice Cast Entry" size="md">
      <div className="space-y-4">
        <Input label="Character Name" value={name} onChange={e => setName(e.target.value)} readOnly={!canEdit} />
        <Textarea label="Character Description / Role" value={description} onChange={e => setDescription(e.target.value)} rows={2} readOnly={!canEdit} />

        <div className="border-t border-surface-800 pt-4 space-y-4">
          <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Voice Casting</h3>
          <Input
            label="Voice Actor / Performer"
            placeholder="e.g. Emma Clarke"
            value={voiceActor}
            onChange={e => setVoiceActor(e.target.value)}
            readOnly={!canEdit}
          />
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Casting Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as VoiceCastEntry['audition_status'])}
              disabled={!canEdit}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50"
            >
              <option value="uncast">Uncast</option>
              <option value="auditioning">Auditioning</option>
              <option value="cast">Cast</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
          <Textarea
            label="Voice Direction"
            placeholder="e.g. Warm, measured tone. Mid-Atlantic accent. Think: 1940s radio announcer."
            value={voiceDirection}
            onChange={e => setVoiceDirection(e.target.value)}
            rows={2}
            readOnly={!canEdit}
          />
          <Textarea
            label="Casting Notes"
            placeholder="Notes on auditions, callbacks, availability window…"
            value={castingNotes}
            onChange={e => setCastingNotes(e.target.value)}
            rows={3}
            readOnly={!canEdit}
          />
        </div>

        <div className="flex justify-between pt-2">
          {onDelete ? (
            <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={onDelete}>Delete</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            {canEdit && (
              <Button onClick={() => onSave({ name, description, voice_actor: voiceActor, casting_notes: castingNotes, audition_status: status, voice_direction: voiceDirection })}>
                Save
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
