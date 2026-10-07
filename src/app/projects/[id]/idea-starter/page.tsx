'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Textarea, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { PageTitle } from '@/components/projects/PageTitle';
import {
  ALL_KITS, buildPitch, ideaChecks, ideaTitle, kitFor, pitchIsComplete, starterToText,
  type StarterDraft,
} from '@/lib/idea-starter';

const EMPTY: StarterDraft = { idea: '', pitch: {}, answers: {}, beats: {} };

// The draft lives in this browser until it's saved somewhere real.
const draftKey = (projectId: string) => `idea-starter:${projectId}`;

function loadDraft(projectId: string): { draft: StarterDraft; kitId: string | null } {
  try {
    const raw = localStorage.getItem(draftKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return { draft: { ...EMPTY, ...parsed.draft }, kitId: parsed.kitId ?? null };
    }
  } catch { /* storage unavailable */ }
  return { draft: EMPTY, kitId: null };
}

export default function IdeaStarterPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members, setCurrentProject } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';

  const projectKit = kitFor(currentProject?.project_type, currentProject?.script_type);
  const [kitId, setKitId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StarterDraft>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [sparkIndex, setSparkIndex] = useState(0);
  const [saving, setSaving] = useState<'idea' | 'logline' | null>(null);

  const kit = ALL_KITS.find((k) => k.id === kitId) ?? projectKit;

  useEffect(() => {
    const saved = loadDraft(params.id);
    setDraft(saved.draft);
    setKitId(saved.kitId);
    setLoaded(true);
  }, [params.id]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(draftKey(params.id), JSON.stringify({ draft, kitId })); } catch { /* ignore */ }
  }, [draft, kitId, loaded, params.id]);

  const checks = useMemo(() => ideaChecks(draft.idea), [draft.idea]);
  const pitch = buildPitch(kit, draft.pitch);
  const pitchDone = pitchIsComplete(kit, draft.pitch);
  const answeredCount = kit.questions.filter((q) => draft.answers[q.key]?.trim()).length;
  const beatCount = kit.structure.beats.filter((b) => draft.beats[b.title]?.trim()).length;
  const hasAnything = !!starterToText(kit, draft);

  const set = <K extends 'pitch' | 'answers' | 'beats'>(part: K, key: string, value: string) =>
    setDraft((d) => ({ ...d, [part]: { ...d[part], [key]: value } }));

  const nextSpark = () => setSparkIndex((i) => (i + 1) % kit.sparks.length);

  const saveToIdeas = async () => {
    if (!user) return;
    const title = ideaTitle(draft.idea) || (pitchDone ? ideaTitle(pitch) : '');
    if (!title) { toast.error('Write your idea first'); return; }
    setSaving('idea');
    const { error } = await createClient().from('ideas').insert({
      project_id: params.id,
      created_by: user.id,
      title,
      description: starterToText(kit, draft),
      category: 'plot',
      status: answeredCount + beatCount > 2 ? 'developing' : 'spark',
      priority: 3,
      tags: ['idea-starter', kit.id],
    });
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success('Saved to your Ideas board');
  };

  const useAsLogline = async () => {
    if (!currentProject || !pitchDone) return;
    setSaving('logline');
    const { error } = await createClient().from('projects').update({ logline: pitch }).eq('id', params.id);
    setSaving(null);
    if (error) { toast.error('Could not save the logline'); return; }
    setCurrentProject({ ...currentProject, logline: pitch });
    toast.success(`${kit.pitch.label} saved to the project`);
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(starterToText(kit, draft));
      toast.success('Copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const startOver = () => {
    setDraft(EMPTY);
    setSparkIndex(0);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <PageTitle>Idea Starter</PageTitle>
          <p className="mt-1 text-sm text-surface-400">
            Drop in a rough idea and work it into a first plan for a <span className="text-surface-200">{kit.name.toLowerCase()}</span>.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-surface-400">
          Format
          <select
            value={kit.id}
            onChange={(e) => { setKitId(e.target.value === projectKit.id ? null : e.target.value); setSparkIndex(0); }}
            className="rounded-lg border border-surface-700 bg-surface-900 px-2.5 py-1.5 text-sm text-white"
          >
            {ALL_KITS.map((k) => (
              <option key={k.id} value={k.id}>{k.name}{k.id === projectKit.id ? ' (this project)' : ''}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-6">
          {/* 1. The idea */}
          <Section step={1} title="Your idea" subtitle="A sentence or a messy paragraph. Don't polish it yet.">
            <Textarea
              value={draft.idea}
              onChange={(e) => setDraft({ ...draft, idea: e.target.value })}
              rows={4}
              placeholder="A lighthouse keeper realises the ships she guides home every night have been missing for a hundred years…"
              aria-label="Your idea"
            />
            {draft.idea.trim() && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {checks.map((c) => (
                  <li
                    key={c.label}
                    title={c.ok ? undefined : c.tip}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs',
                      c.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-surface-700 text-surface-400',
                    )}
                  >
                    {c.ok ? '✓ ' : '○ '}{c.label}{!c.ok && <span className="text-surface-500"> · {c.tip}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* 2. Pitch */}
          <Section step={2} title={kit.pitch.label} subtitle="Fill in the blanks to shape it into one line.">
            <div className="grid gap-3 sm:grid-cols-2">
              {kit.pitch.fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs font-medium text-surface-300">{f.label}</span>
                  <input
                    value={draft.pitch[f.key] ?? ''}
                    onChange={(e) => set('pitch', f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-600"
                  />
                </label>
              ))}
            </div>
            <p className={cn('mt-4 rounded-xl border-l-2 bg-surface-800/50 px-4 py-3 text-sm italic leading-relaxed', pitchDone ? 'border-brand-400 text-white' : 'border-surface-600 text-surface-400')}>
              {pitch}
            </p>
          </Section>

          {/* 3. Questions */}
          <Section step={3} title="Questions to answer" subtitle={`${answeredCount} of ${kit.questions.length} answered. Skip any that don't fit.`}>
            <div className="space-y-4">
              {kit.questions.map((q) => (
                <div key={q.key}>
                  <p className="text-sm font-medium text-surface-200">{q.q}</p>
                  <p className="mb-1.5 text-xs text-surface-500">{q.hint}</p>
                  <Textarea
                    value={draft.answers[q.key] ?? ''}
                    onChange={(e) => set('answers', q.key, e.target.value)}
                    rows={2}
                    aria-label={q.q}
                  />
                </div>
              ))}
            </div>
          </Section>

          {/* 4. Structure */}
          <Section step={4} title={kit.structure.label} subtitle="A starter shape. Jot a line for each beat you can already see.">
            <ol className="space-y-3">
              {kit.structure.beats.map((b, i) => (
                <li key={b.title} className="flex gap-3">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-800 text-xs font-semibold text-surface-300">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-surface-200">{b.title}</p>
                    <p className="mb-1.5 text-xs text-surface-500">{b.prompt}</p>
                    <input
                      value={draft.beats[b.title] ?? ''}
                      onChange={(e) => set('beats', b.title, e.target.value)}
                      aria-label={b.title}
                      className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <aside className="min-w-0 space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-surface-800 bg-surface-900/60 p-5">
            <h2 className="text-sm font-semibold text-white">{kit.name}</h2>
            <p className="mb-3 text-xs text-surface-400">{kit.tagline}</p>
            <ul className="space-y-2">
              {kit.formatNotes.map((n) => (
                <li key={n} className="flex gap-2 text-sm text-surface-300">
                  <span className="text-brand-400" aria-hidden>•</span><span>{n}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-amber-200">Stuck? Try a twist</h2>
              <button onClick={nextSpark} className="rounded-lg px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10">
                Another ↻
              </button>
            </div>
            <p className="text-sm leading-relaxed text-surface-200">{kit.sparks[sparkIndex % kit.sparks.length]}</p>
          </div>

          <div className="space-y-2 rounded-2xl border border-surface-800 bg-surface-900/60 p-5">
            <h2 className="mb-1 text-sm font-semibold text-white">Keep it</h2>
            {canEdit ? (
              <>
                <Button className="w-full" onClick={saveToIdeas} disabled={!draft.idea.trim() && !pitchDone} loading={saving === 'idea'}>
                  Save to Ideas board
                </Button>
                <Button className="w-full" variant="secondary" onClick={useAsLogline} disabled={!pitchDone} loading={saving === 'logline'}>
                  Use {kit.pitch.label.toLowerCase()} for this project
                </Button>
              </>
            ) : (
              <p className="text-xs text-surface-500">You have view access, so you can plan here but not save to the project.</p>
            )}
            <Button className="w-full" variant="ghost" onClick={copyAll} disabled={!hasAnything}>Copy as text</Button>
            <div className="flex items-center justify-between pt-2 text-xs">
              <Link href={`/projects/${params.id}/ideas`} className="text-surface-400 hover:text-white">Open Ideas board →</Link>
              {hasAnything && (
                <button onClick={startOver} className="text-surface-500 hover:text-red-300">Start over</button>
              )}
            </div>
            <p className="pt-1 text-[11px] text-surface-500">Your draft is kept in this browser until you save it.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ step, title, subtitle, children }: { step: number; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-surface-800 bg-surface-900/60 p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-sm font-bold text-brand-300">{step}</span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-xs text-surface-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
