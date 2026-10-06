'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Activity, Award, CheckCircle2, Crown, Gift, Heart, Mail, RefreshCw, Send, Sparkles, TriangleAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Avatar, toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import { TIER_META, TIER_RULES, type EngagementTier } from '@/lib/engagement';
import type { EngagementUser } from '@/app/api/admin/engagement/route';
import { invalidateAdminCache, useAdminData } from '../data';
import {
  ActionButton, AdminPage, Dialog, EmptyState, Field, Meter, PageHeader, Panel, Pill, Reveal, SearchInput, Segmented,
  StatGrid, TabSkeleton, Toolbar, TrendPanel, fieldClass, type Tone,
} from '../kit';

interface Report {
  windowDays: number;
  generatedAt: string;
  truncated: boolean;
  tiers: Record<EngagementTier, number>;
  dailyActive: Record<string, number>;
  users: EngagementUser[];
}

const TIER_TONE: Record<EngagementTier, Tone> = {
  committed: 'green',
  active: 'blue',
  trying: 'amber',
  dormant: 'neutral',
  never: 'neutral',
};
const TIER_ORDER: EngagementTier[] = ['committed', 'active', 'trying', 'dormant', 'never'];
const PAGE = 100;

type Sort = 'score' | 'hours' | 'days' | 'recent';
type PerkType = 'pro' | 'badge' | 'thanks';

const TEMPLATES: Record<PerkType, { subject: string; heading: string; body: string; ctaLabel: string; ctaUrl: string }> = {
  pro: {
    subject: 'A thank-you from Screenplay Studio: {months} months of Pro',
    heading: 'Thanks for writing with us, {name}',
    body: "You've been one of the people really using Screenplay Studio lately, and that means a lot.\n\nAs a thank-you, your account now has {months} months of Pro, on us. No card, nothing to cancel.\n\nKeep writing!",
    ctaLabel: 'Open your dashboard',
    ctaUrl: '/dashboard',
  },
  badge: {
    subject: "You've earned a badge on Screenplay Studio",
    heading: 'Nice work, {name}',
    body: "You've been putting real work into your projects, so we've given you the {badge} badge. It's on your profile now.",
    ctaLabel: 'See your profile',
    ctaUrl: '/settings',
  },
  thanks: {
    subject: 'Thank you from Screenplay Studio',
    heading: 'Thanks, {name}',
    body: "Just a note to say thank you for using Screenplay Studio for real work. If there's anything that would make it better for you, reply to this email — I read every one.",
    ctaLabel: 'Share feedback',
    ctaUrl: '/feedback',
  },
};

async function loadReport(days: number): Promise<Report> {
  const res = await fetch(`/api/admin/engagement?days=${days}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to load engagement');
  return json;
}

export default function EngagementPanel() {
  const [days, setDays] = useState<'30' | '60' | '90'>('30');
  const { data, loading, error, reload } = useAdminData<Report | null>(`engagement:${days}`, () => loadReport(Number(days)), null);
  const [tier, setTier] = useState<EngagementTier | 'all' | 'engaged'>('engaged');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('score');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [rewardOpen, setRewardOpen] = useState(false);

  const users = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const rows = data.users.filter((u) =>
      (tier === 'all' || (tier === 'engaged' ? u.tier === 'committed' || u.tier === 'active' : u.tier === tier))
      && (!q || u.name.toLowerCase().includes(q) || (u.username ?? '').toLowerCase().includes(q)));
    const key: Record<Sort, (u: EngagementUser) => number> = {
      score: (u) => u.score,
      hours: (u) => u.workHours,
      days: (u) => u.activeDays,
      recent: (u) => (u.last_active_at ? Date.parse(u.last_active_at) : 0),
    };
    return [...rows].sort((a, b) => key[sort](b) - key[sort](a));
  }, [data, tier, search, sort]);

  const trendRows = useMemo(() => {
    if (!data) return [];
    // One row per person-day, so the shared trend panel can count them
    return Object.entries(data.dailyActive).flatMap(([date, n]) => Array.from({ length: n }, () => ({ at: `${date}T12:00:00Z` })));
  }, [data]);

  if (loading && !data) return <TabSkeleton />;
  if (error && !data) {
    return (
      <EmptyState
        icon={<TriangleAlert className="h-8 w-8" />}
        title="Couldn't build the engagement report"
        description={error}
        action={<ActionButton icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reload}>Try again</ActionButton>}
      />
    );
  }
  if (!data) return null;

  const visible = users.slice(0, shown);
  const allVisibleSelected = visible.length > 0 && visible.every((u) => selected.has(u.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleVisible = () => setSelected((s) => {
    const n = new Set(s);
    if (allVisibleSelected) visible.forEach((u) => n.delete(u.id)); else visible.forEach((u) => n.add(u.id));
    return n;
  });
  const selectedUsers = data.users.filter((u) => selected.has(u.id));
  const engaged = data.tiers.committed + data.tiers.active;
  const signedUp = data.users.length;

  return (
    <AdminPage>
      <PageHeader
        icon={<Activity className="h-5 w-5" />}
        title="Engagement"
        description="Who is really using Screenplay Studio — from verified working time and the work they produce, not page views."
        meta={<>Updated {timeAgo(data.generatedAt)} · last {data.windowDays} days</>}
        actions={
          <>
            <Segmented id="engagement-window" value={days} onChange={(v) => { setDays(v); setSelected(new Set()); }} options={[{ key: '30', label: '30 days' }, { key: '60', label: '60 days' }, { key: '90', label: '90 days' }]} />
            <ActionButton icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => { invalidateAdminCache('engagement:'); reload(); }}>Refresh</ActionButton>
          </>
        }
      />

      {data.truncated && (
        <Reveal className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
          <TriangleAlert className="h-4 w-4 shrink-0" /> Very large dataset: some activity beyond the row cap wasn&apos;t counted, so a few scores may read low.
        </Reveal>
      )}

      <StatGrid
        cols={5}
        items={TIER_ORDER.map((t) => ({
          label: TIER_META[t].label,
          value: data.tiers[t],
          tone: TIER_TONE[t],
          hint: TIER_META[t].description,
          active: tier === t,
          onClick: () => { setTier(tier === t ? 'all' : t); setShown(PAGE); },
        }))}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <TrendPanel
          id="engagement-active"
          className="lg:col-span-3"
          title="People doing real work"
          subtitle="Each day, how many people put in at least five minutes of verified work"
          sources={[{ key: 'active', label: 'Writer-days', rows: trendRows, time: (r: { at: string }) => r.at }]}
          defaultRange={days === '30' ? '30d' : '90d'}
        />
        <Panel title="How it's measured" subtitle={`Per 30 days, scaled to the ${data.windowDays}-day window`} className="lg:col-span-2" bodyClassName="space-y-3 text-xs">
          <p className="text-surface-400">
            Work time comes from the editor&apos;s heartbeats, which only count while someone is working in a project and stop when they go idle. An <span className="text-white">active day</span> needs 5+ minutes of it. <span className="text-white">Edits</span> are script lines, scenes, characters, shots, ideas and documents they wrote or changed.
          </p>
          {([
            ['committed', TIER_RULES.committed],
            ['active', TIER_RULES.active],
          ] as const).map(([t, r]) => (
            <div key={t} className="flex items-start gap-2">
              <Pill tone={TIER_TONE[t]} dot>{TIER_META[t].label}</Pill>
              <span className="text-surface-400">{r.days}+ active days over {r.weeks}+ weeks, {r.hours}+ hours, {r.edits}+ edits</span>
            </div>
          ))}
          <div className="flex items-start gap-2"><Pill tone="amber" dot>Trying out</Pill><span className="text-surface-400">Some activity, but one-off, short, or with little output</span></div>
          <div className="flex items-start gap-2"><Pill dot>Dormant</Pill><span className="text-surface-400">{TIER_RULES.dormant.hours}+ hour or {TIER_RULES.dormant.edits}+ edits in the 6 months before, nothing in this window</span></div>
          <div className="border-t border-surface-800 pt-3 text-surface-500">
            {signedUp ? Math.round((engaged / signedUp) * 100) : 0}% of {signedUp.toLocaleString()} accounts are actively writing in this window.
          </div>
        </Panel>
      </div>

      <Panel bodyClassName="space-y-3">
        <Toolbar>
          <Segmented
            id="engagement-tier"
            value={tier}
            onChange={(v) => { setTier(v); setShown(PAGE); }}
            options={[
              { key: 'engaged', label: `Engaged · ${engaged}` },
              { key: 'all', label: 'Everyone' },
              ...TIER_ORDER.map((t) => ({ key: t, label: TIER_META[t].label })),
            ]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Search people…" className="min-w-[180px] flex-1" />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cn(fieldClass, 'w-auto py-1.5 text-xs')} aria-label="Sort">
            <option value="score">Highest score</option>
            <option value="hours">Most hours</option>
            <option value="days">Most active days</option>
            <option value="recent">Most recent</option>
          </select>
        </Toolbar>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-800 bg-surface-950/40 px-3 py-2">
          <span className="text-xs text-surface-400">
            {selected.size > 0 ? <><span className="font-semibold text-white">{selected.size}</span> selected</> : `${users.length} ${users.length === 1 ? 'person' : 'people'}`}
          </span>
          <div className="flex items-center gap-2">
            {selected.size > 0 && <ActionButton variant="ghost" onClick={() => setSelected(new Set())}>Clear</ActionButton>}
            <ActionButton onClick={() => setSelected(new Set(users.map((u) => u.id)))} disabled={users.length === 0}>Select all {users.length}</ActionButton>
            <ActionButton variant="primary" icon={<Gift className="h-3.5 w-3.5" />} disabled={selected.size === 0} onClick={() => setRewardOpen(true)}>
              Reward {selected.size || ''}
            </ActionButton>
          </div>
        </div>

        {users.length === 0 ? (
          <EmptyState icon={<Activity className="h-8 w-8" />} title="Nobody here" description="Try another tier or a longer window." />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.06em] text-surface-500">
                <tr className="border-b border-surface-800">
                  <th className="w-10 px-5 py-2"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label="Select shown" className="accent-brand-500" /></th>
                  <th className="py-2 pr-3">Person</th>
                  <th className="py-2 pr-3">Tier</th>
                  <th className="w-36 py-2 pr-3">Score</th>
                  <th className="py-2 pr-3 text-right">Active days</th>
                  <th className="py-2 pr-3 text-right">Hours</th>
                  <th className="py-2 pr-3 text-right">Edits</th>
                  <th className="py-2 pr-3 text-right">Projects</th>
                  <th className="py-2 pr-3">Last active</th>
                  <th className="py-2 pr-5">Perks</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i, 20) * 0.015 }}
                    onClick={() => toggle(u.id)}
                    className={cn('cursor-pointer border-b border-surface-800/60 transition-colors', selected.has(u.id) ? 'bg-brand-500/[0.07]' : 'hover:bg-surface-800/30')}
                  >
                    <td className="px-5 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} aria-label={`Select ${u.name}`} className="accent-brand-500" />
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={u.avatar_url} name={u.name} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {u.username
                              ? <Link href={`/u/${u.username}`} target="_blank" onClick={(e) => e.stopPropagation()} className="truncate font-medium text-white hover:text-brand-300">{u.name}</Link>
                              : <span className="truncate font-medium text-white">{u.name}</span>}
                            {u.is_pro && <Pill tone="amber">Pro</Pill>}
                            {(u.role === 'admin' || u.role === 'moderator') && <Pill tone="violet">{u.role}</Pill>}
                          </div>
                          <span className="text-[11px] text-surface-500">{u.username ? `@${u.username} · ` : ''}joined {timeAgo(u.joined_at)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3"><Pill tone={TIER_TONE[u.tier]} dot>{TIER_META[u.tier].label}</Pill></td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 font-mono tabular-nums text-white">{u.score}</span>
                        <div className="flex-1"><Meter value={u.score} max={100} color={u.score >= 60 ? '#22c55e' : u.score >= 30 ? '#38bdf8' : '#f59e0b'} /></div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-surface-200">{u.activeDays}<span className="text-surface-500"> /{u.activeWeeks}w</span></td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-surface-200">{u.workHours}</td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-surface-200">{u.contentEdits.toLocaleString()}</td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-surface-200">{u.projects}</td>
                    <td className="py-2.5 pr-3 text-surface-400">{u.last_active_at ? timeAgo(u.last_active_at) : '—'}</td>
                    <td className="py-2.5 pr-5 text-surface-400">
                      {u.perks.count > 0
                        ? <span title={`${u.perks.count} perk(s), last: ${u.perks.last_perk}`} className="inline-flex items-center gap-1"><Gift className="h-3 w-3 text-brand-400" />{u.perks.count} · {timeAgo(u.perks.last_at!)}</span>
                        : <span className="text-surface-500">—</span>}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {users.length > shown && (
          <div className="flex justify-center pt-1">
            <ActionButton onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, users.length - shown)} more</ActionButton>
          </div>
        )}
      </Panel>

      <RewardDialog
        open={rewardOpen}
        onClose={() => setRewardOpen(false)}
        recipients={selectedUsers}
        onDone={() => { setSelected(new Set()); invalidateAdminCache('engagement:'); reload(); }}
      />
    </AdminPage>
  );
}

interface RewardResult {
  rewarded: number;
  notified: number;
  emailed: number;
  skipped: { id: string; name: string; reason: string }[];
  failed: { id: string; name: string; error: string }[];
}

function RewardDialog({ open, onClose, recipients, onDone }: {
  open: boolean;
  onClose: () => void;
  recipients: EngagementUser[];
  onDone: () => void;
}) {
  const [perk, setPerk] = useState<PerkType>('pro');
  const [months, setMonths] = useState<'1' | '3' | '6' | '12'>('3');
  const [badgeId, setBadgeId] = useState('');
  const [msg, setMsg] = useState(TEMPLATES.pro);
  const [notify, setNotify] = useState(true);
  const [email, setEmail] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<RewardResult | null>(null);

  const { data: badges } = useAdminData<{ id: string; name: string; emoji: string }[]>('engagement:badges', async () => {
    const { data } = await createClient().from('badges').select('id, name, emoji, is_system').eq('is_system', false).order('name');
    return data ?? [];
  }, []);

  const choosePerk = (p: PerkType) => { setPerk(p); setMsg(TEMPLATES[p]); };
  const alreadyPro = perk === 'pro' ? recipients.filter((r) => r.is_pro).length : 0;
  const recentlyRewarded = recipients.filter((r) => r.perks.last_at && Date.now() - Date.parse(r.perks.last_at) < 30 * 86_400_000).length;
  const badge = badges.find((b) => b.id === badgeId);
  const preview = (t: string) => t
    .replace(/\{name\}/g, recipients[0]?.name ?? 'Sam')
    .replace(/\{months\}/g, months)
    .replace(/\{badge\}/g, badge ? `${badge.emoji} ${badge.name}` : 'chosen');
  const canSend = recipients.length > 0 && (perk !== 'badge' || !!badgeId) && (!(notify || email) || (msg.subject.trim() && msg.heading.trim() && msg.body.trim()));

  const close = () => { onClose(); if (result) { setResult(null); onDone(); } };

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/admin/engagement/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: recipients.map((r) => r.id),
          perk: perk === 'pro' ? { type: 'pro', months: Number(months) } : perk === 'badge' ? { type: 'badge', badgeId } : { type: 'thanks' },
          message: msg,
          channels: { notification: notify, email },
          context: Object.fromEntries(recipients.map((r) => [r.id, { tier: r.tier, score: r.score }])),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sending failed');
      setResult(json);
      toast.success(`Rewarded ${json.rewarded} ${json.rewarded === 1 ? 'person' : 'people'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sending failed');
    } finally {
      setSending(false);
    }
  };

  const PERKS: { key: PerkType; icon: typeof Crown; title: string; body: string }[] = [
    { key: 'pro', icon: Crown, title: 'Gift Pro', body: 'Time-limited Pro, ends on its own' },
    { key: 'badge', icon: Award, title: 'Award a badge', body: 'Shows on their profile' },
    { key: 'thanks', icon: Heart, title: 'Just say thanks', body: 'A personal note, no perk' },
  ];

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      title={result ? 'Sent' : `Reward ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}`}
      description={result ? undefined : 'Pick a perk, check the message, and send. Everything is logged on each person.'}
      footer={result
        ? <ActionButton variant="primary" onClick={close}>Done</ActionButton>
        : <>
            <ActionButton variant="ghost" onClick={close}>Cancel</ActionButton>
            <ActionButton variant="primary" icon={<Send className="h-3.5 w-3.5" />} disabled={!canSend || sending} onClick={send}>
              {sending ? 'Sending…' : `Send to ${recipients.length - alreadyPro}`}
            </ActionButton>
          </>}
    >
      {result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Rewarded', value: result.rewarded, icon: CheckCircle2 },
              { label: 'In-app notes', value: result.notified, icon: Sparkles },
              { label: 'Emails', value: result.emailed, icon: Mail },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-surface-800 bg-surface-950/40 p-3">
                <s.icon className="h-4 w-4 text-emerald-400" />
                <p className="mt-2 text-xl font-bold text-white">{s.value}</p>
                <p className="text-[11px] text-surface-500">{s.label}</p>
              </div>
            ))}
          </div>
          {result.skipped.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-surface-500">Skipped</p>
              <ul className="space-y-1 text-xs text-surface-400">{result.skipped.map((s) => <li key={s.id}>{s.name} — {s.reason}</li>)}</ul>
            </div>
          )}
          {result.failed.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-red-400">Failed</p>
              <ul className="space-y-1 text-xs text-red-300">{result.failed.map((s) => <li key={s.id}>{s.name} — {s.error}</li>)}</ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {PERKS.map((p) => (
              <button
                key={p.key}
                onClick={() => choosePerk(p.key)}
                className={cn('rounded-xl border p-3 text-left transition-colors', perk === p.key ? 'border-brand-500/50 bg-brand-500/10' : 'border-surface-800 hover:border-surface-700')}
              >
                <p.icon className={cn('h-4 w-4', perk === p.key ? 'text-brand-400' : 'text-surface-500')} />
                <p className="mt-2 text-sm font-semibold text-white">{p.title}</p>
                <p className="text-[11px] text-surface-500">{p.body}</p>
              </button>
            ))}
          </div>

          {perk === 'pro' && (
            <Field label="Length">
              <Segmented id="reward-months" value={months} onChange={setMonths} options={[{ key: '1', label: '1 month' }, { key: '3', label: '3 months' }, { key: '6', label: '6 months' }, { key: '12', label: '12 months' }]} />
            </Field>
          )}
          {perk === 'badge' && (
            <Field label="Badge" hint={<>· make new ones in <Link href="/admin?tab=badges" className="text-brand-400">Badges</Link></>}>
              <select value={badgeId} onChange={(e) => setBadgeId(e.target.value)} className={fieldClass}>
                <option value="">Choose a badge…</option>
                {badges.map((b) => <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>)}
              </select>
            </Field>
          )}

          {(alreadyPro > 0 || recentlyRewarded > 0) && (
            <div className="space-y-1 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200">
              {alreadyPro > 0 && <p>{alreadyPro} already {alreadyPro === 1 ? 'has' : 'have'} Pro and will be skipped.</p>}
              {recentlyRewarded > 0 && <p>{recentlyRewarded} got a perk in the last 30 days.</p>}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-xs text-surface-300">
              <label className="flex items-center gap-2"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-brand-500" /> In-app notification</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="accent-brand-500" /> Email</label>
              <span className="text-surface-500">Use {'{name}'}, {'{months}'}, {'{badge}'}</span>
            </div>
            {(notify || email) && (
              <>
                <Field label="Subject"><input value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} className={fieldClass} /></Field>
                <Field label="Heading"><input value={msg.heading} onChange={(e) => setMsg({ ...msg, heading: e.target.value })} className={fieldClass} /></Field>
                <Field label="Message"><textarea rows={5} value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} className={cn(fieldClass, 'resize-y')} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Button label"><input value={msg.ctaLabel} onChange={(e) => setMsg({ ...msg, ctaLabel: e.target.value })} className={fieldClass} /></Field>
                  <Field label="Button link"><input value={msg.ctaUrl} onChange={(e) => setMsg({ ...msg, ctaUrl: e.target.value })} className={fieldClass} /></Field>
                </div>
                <div className="rounded-xl border border-surface-800 bg-surface-950/60 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">Preview · {recipients[0]?.name ?? '—'}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{preview(msg.heading)}</p>
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-surface-400">{preview(msg.body)}</p>
                  {msg.ctaLabel && <span className="mt-3 inline-block rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white">{preview(msg.ctaLabel)}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
