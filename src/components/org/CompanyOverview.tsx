'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, CalendarDays, CheckCircle2, Circle, ClipboardList, FolderKanban, LayoutGrid, Lightbulb, Megaphone, Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, timeAgo } from '@/lib/utils';
import type { Company, CompanyActivityLog, OrgAnnouncement, OrgCalendarEvent, OrgPipelineStage } from '@/lib/types';

export type CompanySection =
  | 'overview' | 'boards' | 'pipeline' | 'calendar' | 'channels' | 'announcements'
  | 'pitches' | 'assignments' | 'resources' | 'education'
  | 'members' | 'teams' | 'projects' | 'blog' | 'settings' | 'activity';

interface Props {
  company: Company;
  userId: string;
  canManage: boolean;
  memberCount: number;
  teamCount: number;
  projects: { id: string; title: string; pipeline_stage_id?: string | null }[];
  activity: CompanyActivityLog[];
  go: (section: CompanySection) => void;
  onInvite: () => void;
}

/**
 * The company home: what is coming up, what needs attention, and the way into
 * each tool. Everything on it is a link to where the thing actually lives, so
 * it never becomes a second place to keep up to date.
 */
export function CompanyOverview({ company, userId, canManage, memberCount, teamCount, projects, activity, go, onInvite }: Props) {
  const [events, setEvents] = useState<OrgCalendarEvent[]>([]);
  const [announcements, setAnnouncements] = useState<OrgAnnouncement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [stages, setStages] = useState<OrgPipelineStage[]>([]);
  const [openPitches, setOpenPitches] = useState(0);
  const [myAssignments, setMyAssignments] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    const now = new Date();
    const horizon = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
    (async () => {
      const [ev, an, reads, st, pitches, assigns] = await Promise.all([
        supabase.from('org_calendar_events').select('*').eq('company_id', company.id).eq('is_cancelled', false)
          .gte('start_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
          .lte('start_at', horizon.toISOString()).order('start_at').limit(6),
        supabase.from('org_announcements').select('*').eq('company_id', company.id)
          .order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3),
        supabase.from('org_announcement_reads').select('announcement_id').eq('user_id', userId),
        supabase.from('org_pipeline_stages').select('*').eq('company_id', company.id).order('sort_order'),
        supabase.from('org_pitches').select('id', { count: 'exact', head: true }).eq('company_id', company.id).in('status', ['submitted', 'under_review']),
        supabase.from('org_script_assignments').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('assigned_to', userId).not('status', 'in', '(approved,rejected)'),
      ]);
      if (cancelled) return;
      setEvents(ev.data || []);
      setAnnouncements(an.data || []);
      setReadIds(new Set((reads.data || []).map((r: { announcement_id: string }) => r.announcement_id)));
      setStages(st.data || []);
      setOpenPitches(pitches.count || 0);
      setMyAssignments(assigns.count || 0);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [company.id, userId]);

  const stats = [
    { label: 'Members', value: memberCount, icon: Users, go: 'members' as const },
    { label: 'Projects', value: projects.length, icon: FolderKanban, go: 'projects' as const },
    { label: 'Pitches to review', value: openPitches, icon: Lightbulb, go: 'pitches' as const },
    { label: 'Assigned to you', value: myAssignments, icon: ClipboardList, go: 'assignments' as const },
  ];

  const staged = stages.map((s) => ({ ...s, count: projects.filter((p) => p.pipeline_stage_id === s.id).length }));
  const unstaged = projects.filter((p) => !p.pipeline_stage_id).length;
  const maxCount = Math.max(1, ...staged.map((s) => s.count), unstaged);

  const checklist = [
    { done: Boolean(company.description), label: 'Describe the company', action: () => go('settings') },
    { done: memberCount > 1, label: 'Invite your first colleague', action: onInvite },
    { done: teamCount > 0, label: 'Create a team', action: () => go('teams') },
    { done: projects.length > 0, label: 'Move a project into the company', action: () => go('projects') },
    { done: events.length > 0, label: 'Put something on the calendar', action: () => go('calendar') },
  ];
  const showChecklist = canManage && checklist.some((c) => !c.done);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => go(s.go)}
            className="group rounded-xl border border-surface-800 bg-surface-900 p-4 text-left transition-colors hover:border-surface-700"
          >
            <div className="flex items-center justify-between">
              <s.icon className="h-4 w-4 text-surface-500 group-hover:text-brand-400" />
              <ArrowRight className="h-3.5 w-3.5 text-surface-700 transition-transform group-hover:translate-x-0.5 group-hover:text-surface-400" />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-white">{ready || s.go === 'members' || s.go === 'projects' ? s.value : '–'}</p>
            <p className="text-xs text-surface-500">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Up next */}
          <section className="rounded-xl border border-surface-800 bg-surface-900">
            <header className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><CalendarDays className="h-4 w-4 text-brand-400" /> Up next</h2>
              <button type="button" onClick={() => go('calendar')} className="text-xs text-surface-400 hover:text-white">Calendar</button>
            </header>
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-surface-400">Nothing scheduled in the next three weeks.</p>
                <button type="button" onClick={() => go('calendar')} className="mt-2 text-xs font-medium text-brand-400 hover:text-brand-300">Add a deadline, table read or shoot day</button>
              </div>
            ) : (
              <ul className="divide-y divide-surface-800">
                {events.map((ev) => {
                  const d = new Date(ev.start_at);
                  return (
                    <li key={ev.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="w-11 shrink-0 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-surface-500">{d.toLocaleDateString(undefined, { month: 'short' })}</p>
                        <p className="text-lg font-semibold leading-none text-white">{d.getDate()}</p>
                      </div>
                      <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: ev.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{ev.title}</p>
                        <p className="truncate text-xs text-surface-500">
                          {ev.all_day ? 'All day' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · '}{ev.event_type.replace('_', ' ')}{ev.location ? ` · ${ev.location}` : ''}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Pipeline */}
          <section className="rounded-xl border border-surface-800 bg-surface-900">
            <header className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><FolderKanban className="h-4 w-4 text-brand-400" /> Slate</h2>
              <button type="button" onClick={() => go('pipeline')} className="text-xs text-surface-400 hover:text-white">Pipeline</button>
            </header>
            {projects.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-surface-400">No projects belong to the company yet.</p>
                <button type="button" onClick={() => go('projects')} className="mt-2 text-xs font-medium text-brand-400 hover:text-brand-300">How to move a project in</button>
              </div>
            ) : (
              <ul className="space-y-2.5 px-4 py-4">
                {[...staged, ...(unstaged ? [{ id: 'none', name: 'Not staged', color: '#52525b', count: unstaged }] : [])].map((s) => (
                  <li key={s.id} className="flex items-center gap-3 text-xs">
                    <span className="w-28 shrink-0 truncate text-surface-300">{s.name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-800">
                      <span className="block h-full rounded-full" style={{ width: `${(s.count / maxCount) * 100}%`, backgroundColor: s.color }} />
                    </span>
                    <span className="w-6 shrink-0 text-right tabular-nums text-surface-400">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Tools */}
          <section className="grid gap-3 sm:grid-cols-3">
            {[
              { k: 'boards' as const, icon: LayoutGrid, t: 'Boards', d: 'Mind maps, mood boards and planning walls for the whole company.' },
              { k: 'channels' as const, icon: Users, t: 'Channels', d: 'Talk it through without leaving the studio.' },
              { k: 'pitches' as const, icon: Lightbulb, t: 'Pitches', d: 'Submit ideas, vote and greenlight.' },
            ].map((x) => (
              <button key={x.k} type="button" onClick={() => go(x.k)} className="flex flex-col items-start rounded-xl border border-surface-800 bg-surface-900 p-4 text-left transition-colors hover:border-brand-500/40">
                <x.icon className="h-4 w-4 text-brand-400" />
                <p className="mt-2 text-sm font-semibold text-white">{x.t}</p>
                <p className="mt-0.5 text-xs text-surface-500">{x.d}</p>
              </button>
            ))}
          </section>
        </div>

        <div className="space-y-6">
          {showChecklist && (
            <section className="rounded-xl border border-brand-500/20 bg-brand-500/[0.04] p-4">
              <h2 className="text-sm font-semibold text-white">Get the company going</h2>
              <p className="mt-0.5 text-xs text-surface-500">{checklist.filter((c) => c.done).length} of {checklist.length} done</p>
              <ul className="mt-3 space-y-1">
                {checklist.map((c) => (
                  <li key={c.label}>
                    <button type="button" onClick={c.action} disabled={c.done} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-800/60 disabled:hover:bg-transparent">
                      {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" /> : <Circle className="h-4 w-4 shrink-0 text-surface-600" />}
                      <span className={cn(c.done ? 'text-surface-500 line-through' : 'text-surface-200')}>{c.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-surface-800 bg-surface-900">
            <header className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Megaphone className="h-4 w-4 text-brand-400" /> Announcements</h2>
              <button type="button" onClick={() => go('announcements')} className="text-xs text-surface-400 hover:text-white">All</button>
            </header>
            {announcements.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-surface-500">No announcements yet.</p>
            ) : (
              <ul className="divide-y divide-surface-800">
                {announcements.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => go('announcements')} className="flex w-full gap-2.5 px-4 py-3 text-left hover:bg-surface-800/40">
                      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', readIds.has(a.id) ? 'bg-transparent' : 'bg-brand-500')} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">{a.title}</span>
                        <span className="block text-xs text-surface-500">{timeAgo(a.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {activity.length > 0 && (
            <section className="rounded-xl border border-surface-800 bg-surface-900">
              <header className="border-b border-surface-800 px-4 py-3">
                <h2 className="text-sm font-semibold text-white">Recent activity</h2>
              </header>
              <ul className="space-y-3 px-4 py-4">
                {activity.slice(0, 6).map((act) => {
                  const who = (act as CompanyActivityLog & { profile?: { display_name?: string; full_name?: string } }).profile;
                  const name = who?.display_name || who?.full_name || 'Someone';
                  return (
                    <li key={act.id} className="flex items-start gap-2.5 text-xs">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-800 text-[11px] font-semibold text-white">{name[0]}</span>
                      <span className="min-w-0 flex-1 text-surface-400">
                        <span className="font-medium text-surface-200">{name}</span> {act.action.replace(/_/g, ' ')}
                        <span className="block text-surface-600">{timeAgo(act.created_at)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {company.public_page_enabled && (
            <Link href={`/p/${company.slug}`} className="flex items-center justify-between rounded-xl border border-surface-800 bg-surface-900 px-4 py-3 text-sm text-surface-300 hover:border-surface-700 hover:text-white">
              View public company page <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
