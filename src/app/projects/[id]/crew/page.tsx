'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore } from '@/lib/stores';
import { Badge, LoadingPage } from '@/components/ui';
import { formatDate, timeAgo, cn } from '@/lib/utils';
import type { StageEnsembleMember, StageProductionTeamMember, ScheduleEvent } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CrewMember {
  id: string;
  name: string;
  role: string;
  department?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
}

interface CastMember {
  id: string;
  displayName: string;
  characterName?: string;
  group?: string;
  vocalRange?: string;
  email?: string;
}

interface StageCue {
  id: string;
  cue_number: string;
  cue_type: string;
  description?: string;
  scene_ref?: string;
  timing_note?: string;
}

// ── Cue type colours ──────────────────────────────────────────────────────────
const CUE_COLORS: Record<string, string> = {
  lighting:         '#fbbf24',
  sound:            '#3b82f6',
  music:            '#8b5cf6',
  follow_spot:      '#f97316',
  special_effect:   '#ef4444',
  automation:       '#14b8a6',
  video:            '#22d3ee',
};

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({
  title,
  count,
  color = '#6366f1',
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  color?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between mb-3 group"
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-bold text-white uppercase tracking-wide">{title}</span>
          {count !== undefined && (
            <span
              className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: color + '20', color }}
            >
              {count}
            </span>
          )}
        </div>
        <svg
          className={cn('w-4 h-4 text-surface-500 transition-transform', open ? 'rotate-180' : '')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}

// ── Contact row ───────────────────────────────────────────────────────────────
function ContactRow({
  label,
  sub,
  email,
  phone,
  badge,
  badgeColor,
}: {
  label: string;
  sub?: string;
  email?: string;
  phone?: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-800/60 last:border-0">
      {/* Avatar placeholder */}
      <div
        className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-bold"
        style={{
          background: (badgeColor ?? '#6366f1') + '20',
          color: badgeColor ?? '#6366f1',
        }}
      >
        {label.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">{label}</p>
        {sub && <p className="text-[11px] text-surface-500 truncate">{sub}</p>}
        {badge && (
          <span
            className="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded mt-0.5"
            style={{ background: (badgeColor ?? '#6366f1') + '20', color: badgeColor ?? '#6366f1' }}
          >
            {badge}
          </span>
        )}
      </div>
      {/* Contact actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-green-500/10 text-green-400 active:bg-green-500/20 transition-colors"
            title={phone}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-500/10 text-blue-400 active:bg-blue-500/20 transition-colors"
            title={email}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CrewMobileView() {
  const params = useParams<{ id: string }>();
  const { currentProject } = useProjectStore();

  const [loading, setLoading] = useState(true);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [todaysEvents, setTodaysEvents] = useState<ScheduleEvent[]>([]);
  const [cues, setCues] = useState<StageCue[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const isStagePlay = currentProject?.project_type === 'stage_play';
  const isAudioDrama = currentProject?.project_type === 'audio_drama' || currentProject?.script_type === 'audio_drama';

  const fetchAll = useCallback(async () => {
    if (!params.id) return;
    const supabase = createClient();

    // Today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Today's schedule (always)
    const eventsResult = await supabase
      .from('production_schedule')
      .select('*')
      .eq('project_id', params.id)
      .gte('start_time', todayStart.toISOString())
      .lte('start_time', todayEnd.toISOString())
      .order('start_time', { ascending: true });
    setTodaysEvents(eventsResult.data || []);

    if (isStagePlay) {
      const [teamResult, ensResult, cuesResult] = await Promise.all([
        supabase
          .from('stage_production_team')
          .select('*')
          .eq('project_id', params.id)
          .order('sort_order')
          .order('name'),
        supabase
          .from('stage_ensemble_members')
          .select('*')
          .eq('project_id', params.id)
          .order('sort_order')
          .order('actor_name'),
        supabase
          .from('stage_cues')
          .select('id, cue_number, cue_type, description, scene_ref, timing_note')
          .eq('project_id', params.id)
          .order('sort_order'),
      ]);

      setCrew(
        ((teamResult.data || []) as StageProductionTeamMember[]).map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          department: m.department,
          email: m.contact_email ?? undefined,
          phone: m.phone ?? undefined,
        }))
      );
      setCast(
        ((ensResult.data || []) as StageEnsembleMember[]).map((m) => ({
          id: m.id,
          displayName: m.actor_name,
          characterName: m.character_name ?? undefined,
          group: m.ensemble_group,
          vocalRange: m.vocal_range ?? undefined,
          email: m.contact_email ?? undefined,
        }))
      );
      setCues((cuesResult.data || []) as StageCue[]);
    } else {
      const [membersResult, charsResult] = await Promise.all([
        supabase
          .from('project_members')
          .select('id, role, profiles(id, display_name, email, avatar_url)')
          .eq('project_id', params.id),
        supabase
          .from('characters')
          .select('id, name, notes')
          .eq('project_id', params.id)
          .order('name'),
      ]);

      setCrew(
        ((membersResult.data || []) as unknown as { id: string; role: string; profiles: { id: string; display_name: string | null; email: string | null; avatar_url: string | null } | null }[]).map((m) => ({
          id: m.id,
          name: m.profiles?.display_name ?? m.profiles?.email ?? 'Unknown',
          role: m.role,
          email: m.profiles?.email ?? undefined,
        }))
      );
      setCast(
        ((charsResult.data || []) as { id: string; name: string }[]).map((c) => ({
          id: c.id,
          displayName: c.name,
        }))
      );
    }

    setLastUpdated(new Date());
    setLoading(false);
  }, [params.id, isStagePlay]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (!currentProject || loading) return <LoadingPage />;

  const statusColor =
    currentProject.status === 'production' ? '#22c55e' :
    currentProject.status === 'completed' || currentProject.status === 'post_production' ? '#60a5fa' :
    currentProject.status === 'pre_production' ? '#f59e0b' : '#a78bfa';

  // Group crew by department (stage) or just flat (film)
  const crewByDept = isStagePlay
    ? crew.reduce((acc, m) => {
        const dept = m.department || 'Other';
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(m);
        return acc;
      }, {} as Record<string, CrewMember[]>)
    : { 'Team': crew };

  // Group cast for stage
  const castByGroup = isStagePlay
    ? cast.reduce((acc, m) => {
        const g = m.group || 'Ensemble';
        if (!acc[g]) acc[g] = [];
        acc[g].push(m);
        return acc;
      }, {} as Record<string, CastMember[]>)
    : { Cast: cast };

  const deptColor: Record<string, string> = {
    'Direction': '#FF5F1F',
    'Stage Management': '#f59e0b',
    'Lighting': '#fbbf24',
    'Sound': '#3b82f6',
    'Musical Direction': '#8b5cf6',
    'Choreography': '#ec4899',
    'Design': '#10b981',
    'Technical': '#14b8a6',
    'Marketing': '#6366f1',
    'Other': '#6b7280',
    'Team': '#34d399',
  };

  return (
    <div className="min-h-screen bg-surface-950 text-white px-4 py-6 max-w-lg mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h1 className="text-xl font-black text-white leading-tight truncate">{currentProject.title}</h1>
            {currentProject.logline && (
              <p className="text-sm text-surface-400 mt-1 leading-snug line-clamp-2">{currentProject.logline}</p>
            )}
          </div>
          <button
            onClick={() => { setLoading(true); fetchAll(); }}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-surface-800 text-surface-400 active:bg-surface-700 transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
            style={{ background: statusColor + '18', color: statusColor, border: `1px solid ${statusColor}35` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
            {currentProject.status.replace(/_/g, ' ')}
          </span>
          {currentProject.format && <Badge size="sm">{currentProject.format}</Badge>}
          {isStagePlay && <Badge size="sm" variant="info">Stage Play</Badge>}
          {isAudioDrama && <Badge size="sm" variant="info">Audio Drama</Badge>}
        </div>
        {lastUpdated && (
          <p className="text-[10px] text-surface-600 mt-2">Updated {timeAgo(lastUpdated.toISOString())}</p>
        )}
      </div>

      {/* ── Today's schedule ──────────────────────────────────── */}
      <Section title="Today's Schedule" count={todaysEvents.length} color="#22d3ee" defaultOpen={true}>
        {todaysEvents.length === 0 ? (
          <p className="text-sm text-surface-500 px-1 mb-3">Nothing scheduled for today.</p>
        ) : (
          <div className="space-y-2 mb-3">
            {todaysEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800/60">
                <div className="w-1 rounded-full self-stretch shrink-0" style={{ backgroundColor: event.color || '#6366f1' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{event.title}</p>
                  <p className="text-[11px] text-surface-500 mt-0.5">
                    {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {event.end_time && ` – ${new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    {' · '}{event.event_type?.replace(/_/g, ' ')}
                  </p>
                </div>
                {event.is_confirmed && (
                  <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded shrink-0">✓ confirmed</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Cast ─────────────────────────────────────────────── */}
      {Object.entries(castByGroup).map(([group, members]) => (
        <Section key={group} title={group} count={members.length} color="#f472b6" defaultOpen={true}>
          <div className="bg-surface-900 rounded-xl overflow-hidden border border-surface-800/60 mb-3">
            {members.map((m) => (
              <ContactRow
                key={m.id}
                label={m.displayName}
                sub={m.characterName ? `as ${m.characterName}` : m.vocalRange}
                email={m.email}
                badge={m.vocalRange}
                badgeColor="#ec4899"
              />
            ))}
          </div>
        </Section>
      ))}

      {/* ── Crew / Production Team ───────────────────────────── */}
      {Object.entries(crewByDept).map(([dept, members]) => (
        <Section key={dept} title={dept} count={members.length} color={deptColor[dept] ?? '#6366f1'} defaultOpen={members.length <= 4}>
          <div className="bg-surface-900 rounded-xl overflow-hidden border border-surface-800/60 mb-3">
            {members.map((m) => (
              <ContactRow
                key={m.id}
                label={m.name}
                sub={m.role}
                email={m.email}
                phone={m.phone}
                badgeColor={deptColor[dept]}
              />
            ))}
          </div>
        </Section>
      ))}

      {/* ── Cue Sheet (Stage only) ───────────────────────────── */}
      {isStagePlay && cues.length > 0 && (
        <Section title="Cue Sheet" count={cues.length} color="#fbbf24" defaultOpen={false}>
          <div className="space-y-1.5 mb-3">
            {cues.map((cue) => {
              const cueColor = CUE_COLORS[cue.cue_type] ?? '#6b7280';
              return (
                <div key={cue.id} className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-900 border border-surface-800/60">
                  <div
                    className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                    style={{ background: cueColor + '20', color: cueColor }}
                  >
                    {cue.cue_type?.replace('_', ' ')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">{cue.cue_number}</p>
                    {cue.description && (
                      <p className="text-[11px] text-surface-400 mt-0.5 leading-snug">{cue.description}</p>
                    )}
                    {(cue.scene_ref || cue.timing_note) && (
                      <p className="text-[10px] text-surface-600 mt-0.5">
                        {cue.scene_ref && `Scene: ${cue.scene_ref}`}
                        {cue.scene_ref && cue.timing_note && ' · '}
                        {cue.timing_note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Footer ───────────────────────────────────────────── */}
      <div className="mt-8 pb-6 text-center">
        <p className="text-[10px] text-surface-700">
          {currentProject.title} · Crew View
          {lastUpdated && ` · ${formatDate(lastUpdated.toISOString())}`}
        </p>
        <p className="text-[10px] text-surface-800 mt-1">Screenplay Studio</p>
      </div>
    </div>
  );
}
