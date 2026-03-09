'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Card, Button, LoadingSpinner, SkeletonList, toast } from '@/components/ui';
import { cn } from '@/lib/utils';

// ============================================================
// Day-Out-of-Days (DOOD)
// The classic industry grid: characters across top,
// shoot days down side, cells coded SW / W / WF / SWF / H / T / F
// ============================================================

const STATUS_OPTIONS = ['', 'SW', 'W', 'WF', 'SWF', 'H', 'T', 'F'] as const;
type Status = typeof STATUS_OPTIONS[number];

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  '':    { label: '', color: 'text-surface-700', bg: 'bg-transparent' },
  SW:    { label: 'SW',  color: 'text-green-300',  bg: 'bg-green-500/20' },
  W:     { label: 'W',   color: 'text-white',       bg: 'bg-surface-700/60' },
  WF:    { label: 'WF',  color: 'text-amber-300',   bg: 'bg-amber-500/20' },
  SWF:   { label: 'SWF', color: 'text-green-400',   bg: 'bg-green-500/30' },
  H:     { label: 'H',   color: 'text-blue-300',    bg: 'bg-blue-500/20' },
  T:     { label: 'T',   color: 'text-purple-300',  bg: 'bg-purple-500/20' },
  F:     { label: 'F',   color: 'text-red-300',     bg: 'bg-red-500/20' },
};

interface DOODEntry { id: string; character_id: string | null; character_name: string; shoot_date: string; status: Status }
interface Character { id: string; name: string }

export default function DOODPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';

  const [characters, setCharacters] = useState<Character[]>([]);
  const [entries, setEntries] = useState<DOODEntry[]>([]);
  const [shootDays, setShootDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDay, setNewDay] = useState('');
  const [addingDay, setAddingDay] = useState(false);

  useEffect(() => { load(); }, [params.id]);

  const load = async () => {
    const supabase = createClient();
    const [chRes, doRes, projRes] = await Promise.all([
      supabase.from('characters').select('id,name').eq('project_id', params.id).order('name'),
      supabase.from('dood_entries').select('*').eq('project_id', params.id),
      supabase.from('projects').select('content_metadata').eq('id', params.id).single(),
    ]);
    setCharacters((chRes.data ?? []) as Character[]);
    const entr = (doRes.data ?? []) as DOODEntry[];
    setEntries(entr);
    // Merge persisted shoot days with any that come from entries
    const savedDays: string[] = (projRes.data?.content_metadata as any)?.dood_shoot_days ?? [];
    const entryDays = entr.map((e) => e.shoot_date);
    const merged = Array.from(new Set([...savedDays, ...entryDays])).sort();
    setShootDays(merged);
    setLoading(false);
  };

  const persistShootDays = async (days: string[]) => {
    const supabase = createClient();
    const { data: proj } = await supabase.from('projects').select('content_metadata').eq('id', params.id).single();
    const existing = (proj?.content_metadata as Record<string, unknown>) ?? {};
    await supabase.from('projects').update({ content_metadata: { ...existing, dood_shoot_days: days } }).eq('id', params.id);
  };

  const entryMap = useMemo(() => {
    const m = new Map<string, DOODEntry>();
    entries.forEach((e) => m.set(`${e.character_name}__${e.shoot_date}`, e));
    return m;
  }, [entries]);

  const getStatus = (charName: string, date: string): Status =>
    (entryMap.get(`${charName}__${date}`)?.status as Status) ?? '';

  const cycleStatus = async (char: Character, date: string) => {
    if (!canEdit) return;
    const key = `${char.name}__${date}`;
    const existing = entryMap.get(key);
    const current = (existing?.status as Status) ?? '';
    const nextIndex = (STATUS_OPTIONS.indexOf(current) + 1) % STATUS_OPTIONS.length;
    const next = STATUS_OPTIONS[nextIndex];
    const supabase = createClient();
    setSaving(true);
    if (existing) {
      const { error } = await supabase.from('dood_entries').update({ status: next }).eq('id', existing.id);
      if (error) { toast.error('Failed to save: ' + error.message); }
      else { setEntries((prev) => prev.map((e) => e.id === existing.id ? { ...e, status: next } : e)); }
    } else {
      const { data, error } = await supabase.from('dood_entries').insert({
        project_id: params.id, character_id: char.id, character_name: char.name, shoot_date: date, status: next,
      }).select().single();
      if (error) { toast.error('Failed to save: ' + error.message); }
      else if (data) { setEntries((prev) => [...prev, data as DOODEntry]); }
    }
    setSaving(false);
  };

  const addShootDay = async () => {
    if (!newDay || shootDays.includes(newDay)) return;
    const next = [...shootDays, newDay].sort();
    setShootDays(next);
    setNewDay('');
    setAddingDay(false);
    await persistShootDays(next);
  };

  const removeShootDay = async (day: string) => {
    const next = shootDays.filter((d) => d !== day);
    setShootDays(next);
    setEntries((prev) => prev.filter((e) => e.shoot_date !== day));
    const supabase = createClient();
    await supabase.from('dood_entries').delete().eq('project_id', params.id).eq('shoot_date', day);
    await persistShootDays(next);
  };

  // Days worked per character
  const daysCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const char of characters) {
      counts[char.name] = entries.filter((e) => e.character_name === char.name && e.status !== '' && e.status !== 'H' && e.status !== 'T').length;
    }
    return counts;
  }, [characters, entries]);

  // A day is fully scheduled if all characters have a non-empty status
  const dayComplete = useMemo(() => {
    const c: Record<string, boolean> = {};
    for (const day of shootDays) {
      c[day] = characters.length > 0 && characters.every((ch) => getStatus(ch.name, day) !== '');
    }
    return c;
  }, [characters, shootDays, entries]);

  const exportCSV = () => {
    const headers = ['Character', ...shootDays.map((d, i) => `Day ${i + 1} (${d})`), 'Total Days'];
    const rows = characters.map((ch) => [
      ch.name,
      ...shootDays.map((day) => getStatus(ch.name, day) || ''),
      String(daysCounts[ch.name] ?? 0),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'day-out-of-days.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="p-4 md:p-8 max-w-full">
      <div className="h-8 skeleton w-48 mb-2 rounded-lg" />
      <div className="h-4 skeleton w-64 mb-6 rounded" />
      <SkeletonList count={5} />
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-full">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Day Out of Days</h1>
          <p className="text-sm text-surface-400 mt-0.5 hidden md:block">Click a cell to cycle through SW / W / WF / SWF / H / T / F</p>
          <p className="text-sm text-surface-400 mt-0.5 md:hidden">Tap a cell to cycle status</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={exportCSV}>&#8595; CSV</Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()} className="print:hidden hidden md:inline-flex">🖨 Print</Button>
          {canEdit && (
            <div className="flex items-center gap-2">
              {addingDay ? (
                <div className="flex gap-2 flex-wrap">
                  <input type="date" value={newDay} onChange={(e) => setNewDay(e.target.value)}
                    className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white" />
                  <button onClick={addShootDay} className="px-3 py-1.5 text-sm bg-[#FF5F1F] text-white rounded-lg">Add</button>
                  <button onClick={() => setAddingDay(false)} className="px-3 py-1.5 text-sm bg-surface-700 text-white rounded-lg">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setAddingDay(true)} className="px-3 py-1.5 text-sm bg-surface-700/60 hover:bg-surface-700 border border-surface-600 rounded-lg text-white">
                  + Add Shoot Day
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-5">
        {STATUS_OPTIONS.filter(s => s !== '').map((s) => (
          <span key={s} className={cn('px-2 py-0.5 rounded text-[11px] font-bold', STATUS_META[s].bg, STATUS_META[s].color)}>
            {s} — {{SW:'Start Work', W:'Work', WF:'Work Finish', SWF:'Start/Work/Finish', H:'Hold', T:'Travel', F:'Finish'}[s]}
          </span>
        ))}
      </div>

      {characters.length === 0 ? (
        <Card className="p-8 text-center text-surface-500">Add characters in the Characters tool first.</Card>
      ) : shootDays.length === 0 ? (
        <Card className="p-8 text-center text-surface-500">Add shoot days using the button above.</Card>
      ) : (
        <>
          {/* ─────────────────────────────────────────────────────
              MOBILE: Character cards with horizontal day strip
          ───────────────────────────────────────────────────── */}
          <div className="block md:hidden space-y-3">
            {characters.map((char, ci) => (
              <div
                key={char.id}
                className={cn(
                  'rounded-xl border overflow-hidden',
                  ci % 2 === 0 ? 'border-surface-700/50 bg-surface-800/20' : 'border-surface-800/50 bg-surface-900/20',
                )}
              >
                {/* Character header */}
                <div className="flex items-center justify-between px-4 py-3 bg-surface-800/40 border-b border-surface-700/40">
                  <p className="font-bold text-white text-sm">{char.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-surface-500">{daysCounts[char.name] ?? 0} days</span>
                  </div>
                </div>

                {/* Horizontal scrollable day cells */}
                <div className="overflow-x-auto px-3 py-3">
                  <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
                    {shootDays.map((day, i) => {
                      const status = getStatus(char.name, day);
                      const meta = STATUS_META[status];
                      const isComplete = dayComplete[day];
                      return (
                        <div key={day} className="flex flex-col items-center gap-1">
                          <div className={cn('text-[9px] font-mono text-surface-500 text-center', isComplete && 'text-green-400')}>
                            D{i + 1}
                          </div>
                          <div className="text-[9px] text-surface-600 text-center font-mono">{day.slice(5)}</div>
                          <button
                            onClick={() => cycleStatus(char, day)}
                            disabled={!canEdit || saving}
                            className={cn(
                              'w-14 h-10 rounded-lg font-black text-xs transition-all border',
                              status
                                ? cn(meta.bg, meta.color, 'border-transparent')
                                : 'bg-surface-800/40 border-surface-700/60 text-surface-600',
                              canEdit && !saving ? 'active:scale-95' : 'opacity-60',
                            )}
                          >
                            {status || '—'}
                          </button>
                          {canEdit && ci === 0 && (
                            <button
                              onClick={() => removeShootDay(day)}
                              className="text-surface-700 hover:text-red-400 text-[11px] transition-colors"
                            >×</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ─────────────────────────────────────────────────────
              DESKTOP: Full grid table (hidden below md)
          ───────────────────────────────────────────────────── */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-surface-700/40">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="bg-surface-800/80 border-b border-surface-700/40">
                  <th className="sticky left-0 bg-surface-800/90 z-10 px-4 py-3 text-left text-surface-400 font-bold uppercase tracking-wider min-w-[160px]">
                    Character
                  </th>
                  {shootDays.map((day, i) => (
                    <th key={day} className={cn('px-2 py-3 text-center text-surface-400 font-mono font-bold whitespace-nowrap min-w-[80px]', dayComplete[day] && 'bg-green-500/5')}>
                      <div className="text-[10px] text-surface-500 flex items-center justify-center gap-1">
                        Day {i + 1}
                        {dayComplete[day] && <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" title="All scheduled" />}
                      </div>
                      <div>{day.slice(5)}</div>
                      {canEdit && (
                        <button onClick={() => removeShootDay(day)} className="text-surface-700 hover:text-red-400 text-[10px] mt-0.5 block mx-auto">×</button>
                      )}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-surface-400 font-bold text-[10px] uppercase tracking-wider">Days</th>
                </tr>
              </thead>
              <tbody>
                {characters.map((char, ci) => (
                  <tr
                    key={char.id}
                    className={cn('border-b border-surface-700/20 last:border-0', ci % 2 === 0 ? 'bg-surface-900/20' : '')}
                  >
                    <td className="sticky left-0 bg-surface-900 z-10 px-4 py-2 font-medium text-white border-r border-surface-700/40">
                      {char.name}
                    </td>
                    {shootDays.map((day) => {
                      const status = getStatus(char.name, day);
                      const meta = STATUS_META[status];
                      return (
                        <td key={day} className="px-2 py-2 text-center">
                          <button
                            onClick={() => cycleStatus(char, day)}
                            disabled={!canEdit || saving}
                            className={cn(
                              'w-12 h-8 rounded font-bold text-[11px] transition-all',
                              meta.bg,
                              meta.color,
                              canEdit ? 'hover:ring-2 hover:ring-white/20 cursor-pointer' : 'cursor-default',
                              !status && canEdit ? 'hover:bg-surface-700/20' : '',
                            )}
                          >
                            {status || '·'}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-bold text-white">
                      {daysCounts[char.name] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
