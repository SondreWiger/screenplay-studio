'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Card, Button, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';

// ============================================================
// Continuity Sheet
// Per-scene × per-character grid tracking costume, hair,
// makeup, props, wounds, and free notes for script supervisors.
// ============================================================

interface ContinuityEntry {
  id: string;
  scene_id: string | null;
  character_id: string | null;
  character_name: string | null;
  scene_label: string | null;
  costume: string;
  hair: string;
  makeup: string;
  props: string;
  wounds: string;
  notes: string;
  image_url: string | null;
}

interface Scene { id: string; scene_number: string | null; scene_heading: string | null; sort_order: number }
interface Character { id: string; name: string }

const FIELDS: { key: keyof ContinuityEntry; label: string; color: string }[] = [
  { key: 'costume', label: 'Costume',  color: 'text-pink-300' },
  { key: 'hair',    label: 'Hair',     color: 'text-amber-300' },
  { key: 'makeup',  label: 'Makeup',   color: 'text-rose-300' },
  { key: 'props',   label: 'Props',    color: 'text-cyan-300' },
  { key: 'wounds',  label: 'Wounds',   color: 'text-red-300' },
  { key: 'notes',   label: 'Notes',    color: 'text-surface-300' },
];

export default function ContinuityPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [entries, setEntries] = useState<ContinuityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeChar, setActiveChar] = useState<string>('');
  const [editCell, setEditCell] = useState<{ key: string; field: keyof ContinuityEntry } | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => { load(); }, [params.id]);

  const load = async () => {
    const supabase = createClient();
    const [scRes, chRes, enRes] = await Promise.all([
      supabase.from('scenes').select('id,scene_number,scene_heading,sort_order').eq('project_id', params.id).order('sort_order'),
      supabase.from('characters').select('id,name').eq('project_id', params.id).order('name'),
      supabase.from('continuity_entries').select('*').eq('project_id', params.id),
    ]);
    const scList = (scRes.data ?? []) as Scene[];
    const chList = (chRes.data ?? []) as Character[];
    setScenes(scList);
    setCharacters(chList);
    setEntries((enRes.data ?? []) as ContinuityEntry[]);
    if (chList.length > 0) setActiveChar(chList[0].id);
    setLoading(false);
  };

  const entryMap = useMemo(() => {
    const m = new Map<string, ContinuityEntry>();
    entries.forEach((e) => { if (e.scene_id && e.character_id) m.set(`${e.scene_id}__${e.character_id}`, e); });
    return m;
  }, [entries]);

  const getEntry = (sceneId: string, charId: string) =>
    entryMap.get(`${sceneId}__${charId}`) ?? null;

  const openEdit = (sceneId: string, charId: string, field: keyof ContinuityEntry) => {
    if (!canEdit) return;
    const cellKey = `${sceneId}__${charId}`;
    const existing = entryMap.get(cellKey);
    setDraft((existing?.[field] as string) ?? '');
    setEditCell({ key: cellKey, field });
  };

  const commitEdit = async () => {
    if (!editCell) return;
    const [sceneId, charId] = editCell.key.split('__');
    const supabase = createClient();
    const existing = entryMap.get(editCell.key);
    setSaving(editCell.key);

    if (existing) {
      const { error } = await supabase
        .from('continuity_entries')
        .update({ [editCell.field]: draft, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (!error) setEntries((prev) => prev.map((e) => e.id === existing.id ? { ...e, [editCell.field]: draft } : e));
    } else {
      const char = characters.find((c) => c.id === charId);
      const scene = scenes.find((s) => s.id === sceneId);
      const { data, error } = await supabase
        .from('continuity_entries')
        .insert({
          project_id: params.id,
          scene_id: sceneId,
          character_id: charId,
          character_name: char?.name ?? null,
          scene_label: scene?.scene_heading ?? scene?.scene_number ?? null,
          costume: '', hair: '', makeup: '', props: '', wounds: '', notes: '',
          [editCell.field]: draft,
        })
        .select()
        .single();
      if (!error && data) setEntries((prev) => [...prev, data as ContinuityEntry]);
    }
    setSaving(null);
    setEditCell(null);
  };

  const activeCharName = characters.find((c) => c.id === activeChar)?.name ?? '';

  if (loading) return <LoadingSpinner className="py-32" />;

  // ── Shared: character selector tabs ─────────────────────────
  const CharacterTabs = () => (
    <div className="flex flex-wrap gap-2 mb-5">
      {characters.map((c) => {
        const hasData = entries.some((e) => e.character_id === c.id);
        return (
          <button
            key={c.id}
            onClick={() => { setActiveChar(c.id); setEditCell(null); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              activeChar === c.id
                ? 'bg-[#FF5F1F] border-[#FF5F1F] text-white'
                : 'bg-surface-800/50 border-surface-700 text-surface-300 hover:border-surface-500',
            )}
          >
            {c.name}
            {hasData && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-400 inline-block align-middle" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-xl font-black text-white">Continuity Sheet</h1>
        <p className="text-sm text-surface-400 mt-0.5">Track costume, hair, makeup, props and wounds per scene per character.</p>
      </div>

      {characters.length === 0 && (
        <Card className="p-8 text-center text-surface-500">
          Add characters in the Characters tool first, then return here to log continuity.
        </Card>
      )}

      {characters.length > 0 && scenes.length === 0 && (
        <Card className="p-8 text-center text-surface-500">
          Add scenes in the Scenes tool first.
        </Card>
      )}

      {characters.length > 0 && scenes.length > 0 && (
        <>
          <CharacterTabs />

          {/* ─────────────────────────────────────────────────────
              MOBILE: Card layout (hidden on md+)
          ───────────────────────────────────────────────────── */}
          <div className="block md:hidden space-y-3">
            {/* Character bar */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-800/60 border border-surface-700/40 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#FF5F1F] shrink-0" />
              <p className="text-sm font-bold text-white truncate">{activeCharName}</p>
              <p className="text-[11px] text-surface-500 ml-auto shrink-0">Tap field to edit</p>
            </div>

            {scenes.map((scene, idx) => {
              const entry = getEntry(scene.id, activeChar);
              const hasAnyData = entry && FIELDS.some((f) => (entry[f.key] as string));
              const cellKey = `${scene.id}__${activeChar}`;
              const isSavingThis = saving === cellKey;

              return (
                <div
                  key={scene.id}
                  className={cn(
                    'rounded-xl border overflow-hidden transition-colors',
                    hasAnyData
                      ? 'border-surface-600/60 bg-surface-800/30'
                      : 'border-surface-800/60 bg-surface-900/20',
                  )}
                >
                  {/* Scene header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-800/50 bg-surface-800/40">
                    <span className="font-mono text-[11px] font-bold text-surface-500 shrink-0">
                      {scene.scene_number ? `#${scene.scene_number}` : `S${idx + 1}`}
                    </span>
                    <p className="text-xs font-semibold text-surface-200 flex-1 leading-tight">
                      {scene.scene_heading ?? '—'}
                    </p>
                    {hasAnyData && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
                  </div>

                  {/* Fields */}
                  <div className="divide-y divide-surface-800/40">
                    {FIELDS.map((f) => {
                      const isEditing = editCell?.key === cellKey && editCell.field === f.key;
                      const value = (entry?.[f.key] as string) ?? '';

                      return (
                        <div key={f.key} className="px-4 py-3">
                          <p className={cn('text-[10px] font-black uppercase tracking-widest mb-1.5', f.color)}>
                            {f.label}
                          </p>

                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setEditCell(null);
                                  if (e.key === 'Enter' && e.metaKey) commitEdit();
                                }}
                                rows={3}
                                className="w-full bg-surface-800 border border-[#FF5F1F] rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none"
                                placeholder={`Add ${f.label.toLowerCase()}…`}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={commitEdit}
                                  disabled={isSavingThis}
                                  className="flex-1 py-2 rounded-lg bg-[#FF5F1F] text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                                >
                                  {isSavingThis ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditCell(null)}
                                  className="flex-1 py-2 rounded-lg bg-surface-700/60 border border-surface-600 text-surface-300 text-sm font-medium"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => openEdit(scene.id, activeChar, f.key)}
                              className={cn(
                                'min-h-[32px] rounded-lg px-3 py-2 text-sm transition-colors leading-snug',
                                canEdit
                                  ? 'cursor-pointer active:bg-surface-700/60 hover:bg-surface-700/30'
                                  : '',
                                value ? 'text-surface-200' : 'text-surface-600 italic',
                              )}
                            >
                              {isSavingThis ? (
                                <span className="text-surface-500 text-xs">Saving…</span>
                              ) : value || (canEdit ? `Tap to add ${f.label.toLowerCase()}…` : '—')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─────────────────────────────────────────────────────
              DESKTOP: Table layout (hidden below md)
          ───────────────────────────────────────────────────── */}
          <div className="hidden md:block">
            <div className="rounded-xl border border-surface-700/40 overflow-hidden">
              {/* Header */}
              <div className="bg-surface-800/80 border-b border-surface-700/40 px-4 py-3">
                <p className="text-sm font-bold text-white">{activeCharName}</p>
                <p className="text-[11px] text-surface-500">Click any cell to edit · changes save immediately</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-800/40 border-b border-surface-700/40">
                      <th className="text-left px-3 py-2 text-surface-500 font-bold uppercase tracking-wider w-40">Scene</th>
                      {FIELDS.map((f) => (
                        <th key={f.key} className={cn('text-left px-3 py-2 font-bold uppercase tracking-wider', f.color)}>{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scenes.map((scene, idx) => {
                      const entry = getEntry(scene.id, activeChar);
                      const hasAnyData = entry && FIELDS.some((f) => (entry[f.key] as string));
                      return (
                        <tr
                          key={scene.id}
                          className={cn(
                            'border-b border-surface-700/20 last:border-0 transition-colors',
                            idx % 2 === 0 ? 'bg-surface-900/30' : 'bg-surface-900/10',
                            hasAnyData && 'bg-surface-800/20',
                          )}
                        >
                          <td className="px-3 py-2 align-top">
                            <p className="font-mono text-[11px] text-surface-500">
                              {scene.scene_number ? `#${scene.scene_number}` : `S${idx + 1}`}
                            </p>
                            <p className="text-surface-300 text-[11px] truncate max-w-[140px]">
                              {scene.scene_heading ?? '—'}
                            </p>
                          </td>
                          {FIELDS.map((f) => {
                            const cellKey = `${scene.id}__${activeChar}`;
                            const isEditing = editCell?.key === cellKey && editCell.field === f.key;
                            const value = (entry?.[f.key] as string) ?? '';
                            return (
                              <td key={f.key} className="px-2 py-1.5 align-top min-w-[130px]">
                                {isEditing ? (
                                  <div className="flex flex-col gap-1">
                                    <textarea
                                      autoFocus
                                      value={draft}
                                      onChange={(e) => setDraft(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Escape') setEditCell(null); if (e.key === 'Enter' && e.metaKey) commitEdit(); }}
                                      rows={3}
                                      className="w-full bg-surface-800 border border-[#FF5F1F] rounded px-2 py-1 text-xs text-white resize-none focus:outline-none"
                                    />
                                    <div className="flex gap-1">
                                      <button onClick={commitEdit} className="px-2 py-0.5 rounded bg-[#FF5F1F] text-white text-[10px] font-medium">Save</button>
                                      <button onClick={() => setEditCell(null)} className="px-2 py-0.5 rounded bg-surface-700 text-surface-300 text-[10px]">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => openEdit(scene.id, activeChar, f.key)}
                                    className={cn(
                                      'min-h-[36px] rounded px-2 py-1 transition-colors',
                                      canEdit ? 'cursor-pointer hover:bg-surface-700/40' : '',
                                      value ? 'text-surface-200' : 'text-surface-600 italic',
                                    )}
                                  >
                                    {saving === `${scene.id}__${activeChar}` ? (
                                      <span className="text-surface-500">Saving…</span>
                                    ) : value || (canEdit ? 'Click to add…' : '—')}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[11px] text-surface-600 mt-3">⌘↵ to save · Esc to cancel</p>
          </div>
        </>
      )}
    </div>
  );
}
