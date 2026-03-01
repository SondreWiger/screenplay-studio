'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, LoadingPage, toast, ToastContainer } from '@/components/ui';

// ============================================================
// Production Reports — Pro Feature (Film/TV)
// Real data from Supabase: call sheets, DOOD, daily reports,
// progress summaries, wrap reports — all with working downloads.
// ============================================================

type ReportType = 'call_sheet' | 'dood' | 'daily_report' | 'progress' | 'wrap_report';

const REPORT_TYPES: { type: ReportType; label: string; icon: string; description: string }[] = [
  { type: 'call_sheet', label: 'Call Sheet', icon: '📋', description: 'Daily call sheet with crew times, locations, and scene breakdown' },
  { type: 'dood', label: 'Day Out of Days', icon: '📊', description: 'Cast member scheduling across the entire production' },
  { type: 'daily_report', label: 'Daily Report', icon: '📝', description: 'End-of-day production report with pages shot, hours, and notes' },
  { type: 'progress', label: 'Progress Report', icon: '📈', description: 'Overall production progress vs. schedule' },
  { type: 'wrap_report', label: 'Wrap Report', icon: '🎬', description: 'Final production summary with stats and deliverables' },
];

// ── DB row types ──────────────────────────────────────────────

interface Scene {
  id: string;
  project_id: string;
  scene_number: string | number;
  scene_heading: string;
  location_type: string;
  location_name: string;
  time_of_day: string;
  synopsis: string;
  page_count: number;
  estimated_duration_minutes: number;
  cast_ids: string[];
  extras_count: number;
  props: string;
  is_completed: boolean;
  sort_order: number;
}

interface Character {
  id: string;
  project_id: string;
  name: string;
  is_main: boolean;
  cast_actor: string;
}

interface Shot {
  id: string;
  project_id: string;
  scene_id: string;
  shot_number: string | number;
  shot_type: string;
  is_completed: boolean;
  takes_needed: number;
  takes_completed: number;
}

interface ScheduleEvent {
  id: string;
  project_id: string;
  title: string;
  event_type: string;
  start_time: string;
  end_time: string;
  scene_ids: string[];
  location_id: string;
  assigned_to: string[];
  call_time: string;
}

interface BudgetItem {
  id: string;
  project_id: string;
  category: string;
  description: string;
  estimated_cost: number;
  actual_cost: number;
  is_paid: boolean;
}

interface Location {
  id: string;
  project_id: string;
  name: string;
  address: string;
  cost_per_day: number;
  is_confirmed: boolean;
}

interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  department: string;
  job_title: string;
}

interface Profile {
  id: string;
  email: string;
  display_name: string;
  full_name: string;
}

// ── Helpers ───────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(',');
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function pct(a: number, b: number): string {
  if (b === 0) return '0%';
  return `${Math.round((a / b) * 100)}%`;
}

// ── Generated report data holders ─────────────────────────────

interface GeneratedReport {
  id: string;
  type: ReportType;
  label: string;
  date: string;
  content: string;          // rendered text for preview
  downloadContent: string;  // file content for download
  downloadName: string;
  downloadMime: string;
  meta?: Record<string, string | number>;
}

// ── Main Component ────────────────────────────────────────────

export default function ReportsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user } = useAuth();
  const { isPro } = useProFeatures();
  const { currentProject } = useProjectStore();
  const hasProAccess = isPro || currentProject?.pro_enabled === true;

  const supabase = useMemo(() => createClient(), []);

  // ── Central data cache ──────────────────────────────────────
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [viewingReport, setViewingReport] = useState<GeneratedReport | null>(null);

  // Call sheet specific
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  // ── Fetch all project data once ─────────────────────────────
  useEffect(() => {
    if (!hasProAccess || !projectId) { setLoading(false); return; }

    const fetchAll = async () => {
      const [scRes, chRes, shRes, evRes, buRes, loRes, meRes] = await Promise.all([
        supabase.from('scenes').select('*').eq('project_id', projectId).order('sort_order'),
        supabase.from('characters').select('*').eq('project_id', projectId).order('name'),
        supabase.from('shots').select('*').eq('project_id', projectId),
        supabase.from('production_schedule').select('*').eq('project_id', projectId).order('start_time'),
        supabase.from('budget_items').select('*').eq('project_id', projectId),
        supabase.from('locations').select('*').eq('project_id', projectId),
        supabase.from('project_members').select('*').eq('project_id', projectId),
      ]);

      setScenes((scRes.data as Scene[]) || []);
      setCharacters((chRes.data as Character[]) || []);
      setShots((shRes.data as Shot[]) || []);
      setScheduleEvents((evRes.data as ScheduleEvent[]) || []);
      setBudgetItems((buRes.data as BudgetItem[]) || []);
      setLocations((loRes.data as Location[]) || []);
      setMembers((meRes.data as ProjectMember[]) || []);

      // Fetch profiles for members
      const memberUserIds = (meRes.data || []).map((m: ProjectMember) => m.user_id).filter(Boolean);
      if (memberUserIds.length > 0) {
        const prRes = await supabase.from('profiles').select('*').in('id', memberUserIds);
        setProfiles((prRes.data as Profile[]) || []);
      }

      setLoading(false);
    };

    fetchAll().catch(() => setLoading(false));
  }, [hasProAccess, projectId, supabase]);

  // ── Character lookup helper ────────────────────────────────
  const charMap = useMemo(() => {
    const m = new Map<string, Character>();
    characters.forEach(c => m.set(c.id, c));
    return m;
  }, [characters]);

  const locationMap = useMemo(() => {
    const m = new Map<string, Location>();
    locations.forEach(l => m.set(l.id, l));
    return m;
  }, [locations]);

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach(p => m.set(p.id, p));
    return m;
  }, [profiles]);

  // ── Report generators ──────────────────────────────────────

  const generateCallSheet = useCallback((): GeneratedReport | null => {
    const event = scheduleEvents.find(e => e.id === selectedEventId);
    if (!event) {
      toast.error('Please select a schedule date first');
      return null;
    }

    const eventScenes = scenes.filter(s => (event.scene_ids || []).includes(s.id));
    const loc = event.location_id ? locationMap.get(event.location_id) : null;

    // Gather cast for these scenes
    const castIds = new Set<string>();
    eventScenes.forEach(s => (s.cast_ids || []).forEach(cid => castIds.add(cid)));
    const castList = Array.from(castIds).map(cid => charMap.get(cid)).filter(Boolean) as Character[];

    const projectName = currentProject?.title || 'Untitled';
    const lines: string[] = [];
    lines.push('═'.repeat(60));
    lines.push(`CALL SHEET — ${projectName}`);
    lines.push('═'.repeat(60));
    lines.push('');
    lines.push(`Date:       ${fmtDate(event.start_time)}`);
    lines.push(`Call Time:  ${event.call_time ? fmtTime(event.call_time) : fmtTime(event.start_time)}`);
    lines.push(`Wrap Est.:  ${event.end_time ? fmtTime(event.end_time) : 'TBD'}`);
    lines.push(`Location:   ${loc ? `${loc.name}${loc.address ? ' — ' + loc.address : ''}` : 'TBD'}`);
    lines.push('');
    lines.push('─'.repeat(60));
    lines.push('SCENES');
    lines.push('─'.repeat(60));
    eventScenes.forEach(s => {
      lines.push(`  Sc ${s.scene_number}  ${s.scene_heading || ''}`);
      lines.push(`    ${s.location_type || ''} — ${s.location_name || ''} — ${s.time_of_day || ''}`);
      lines.push(`    Pages: ${s.page_count ?? '—'}  |  Est. Duration: ${s.estimated_duration_minutes ?? '—'} min`);
      if (s.extras_count) lines.push(`    Extras needed: ${s.extras_count}`);
      if (s.props) lines.push(`    Props: ${s.props}`);
      lines.push('');
    });
    lines.push('─'.repeat(60));
    lines.push('CAST');
    lines.push('─'.repeat(60));
    castList.forEach(c => {
      lines.push(`  ${c.name}${c.cast_actor ? ' (' + c.cast_actor + ')' : ''}${c.is_main ? '  [LEAD]' : ''}`);
    });
    lines.push('');
    lines.push('─'.repeat(60));
    lines.push(`Generated: ${new Date().toLocaleString()}`);

    const text = lines.join('\n');

    // CSV version
    const csvLines: string[] = [];
    csvLines.push(csvRow(['CALL SHEET', projectName, fmtDate(event.start_time)]));
    csvLines.push(csvRow(['Call Time', event.call_time ? fmtTime(event.call_time) : fmtTime(event.start_time)]));
    csvLines.push(csvRow(['Location', loc?.name || 'TBD', loc?.address || '']));
    csvLines.push('');
    csvLines.push(csvRow(['Scene #', 'Heading', 'Int/Ext', 'Location', 'Time of Day', 'Pages', 'Duration (min)', 'Extras', 'Props']));
    eventScenes.forEach(s => {
      csvLines.push(csvRow([s.scene_number, s.scene_heading, s.location_type, s.location_name, s.time_of_day, s.page_count, s.estimated_duration_minutes, s.extras_count, s.props]));
    });
    csvLines.push('');
    csvLines.push(csvRow(['Cast', 'Actor', 'Lead?']));
    castList.forEach(c => {
      csvLines.push(csvRow([c.name, c.cast_actor || '', c.is_main ? 'Yes' : 'No']));
    });

    return {
      id: crypto.randomUUID(),
      type: 'call_sheet',
      label: `Call Sheet — ${fmtDate(event.start_time)}`,
      date: new Date().toISOString().split('T')[0],
      content: text,
      downloadContent: csvLines.join('\n'),
      downloadName: `call_sheet_${event.start_time.split('T')[0]}.csv`,
      downloadMime: 'text/csv',
      meta: { scenes: eventScenes.length, cast: castList.length },
    };
  }, [selectedEventId, scheduleEvents, scenes, charMap, locationMap, currentProject]);

  const generateDOOD = useCallback((): GeneratedReport => {
    // For each character, list which scenes they appear in and aggregate page count
    const rows: { char: Character; sceneNumbers: string[]; sceneCount: number; totalPages: number }[] = [];

    characters.forEach(char => {
      const charScenes = scenes.filter(s => (s.cast_ids || []).includes(char.id));
      rows.push({
        char,
        sceneNumbers: charScenes.map(s => String(s.scene_number)),
        sceneCount: charScenes.length,
        totalPages: charScenes.reduce((sum, s) => sum + (s.page_count || 0), 0),
      });
    });

    rows.sort((a, b) => b.sceneCount - a.sceneCount);

    // Preview text
    const lines: string[] = [];
    lines.push('═'.repeat(60));
    lines.push('DAY OUT OF DAYS');
    lines.push('═'.repeat(60));
    lines.push('');
    lines.push(`Total Characters: ${characters.length}`);
    lines.push(`Total Scenes:     ${scenes.length}`);
    lines.push('');

    const colW = [30, 8, 8, 40];
    lines.push(
      'Character'.padEnd(colW[0]) +
      'Scenes'.padEnd(colW[1]) +
      'Pages'.padEnd(colW[2]) +
      'Scene Numbers'
    );
    lines.push('─'.repeat(90));
    rows.forEach(r => {
      lines.push(
        r.char.name.padEnd(colW[0]) +
        String(r.sceneCount).padEnd(colW[1]) +
        String(r.totalPages.toFixed(1)).padEnd(colW[2]) +
        r.sceneNumbers.join(', ')
      );
    });

    lines.push('');
    lines.push(`Generated: ${new Date().toLocaleString()}`);

    // CSV
    const csvLines: string[] = [];
    csvLines.push(csvRow(['Character', 'Actor', 'Lead', 'Scene Count', 'Total Pages', 'Scene Numbers']));
    rows.forEach(r => {
      csvLines.push(csvRow([r.char.name, r.char.cast_actor || '', r.char.is_main ? 'Yes' : 'No', r.sceneCount, r.totalPages.toFixed(1), r.sceneNumbers.join('; ')]));
    });

    return {
      id: crypto.randomUUID(),
      type: 'dood',
      label: 'Day Out of Days',
      date: new Date().toISOString().split('T')[0],
      content: lines.join('\n'),
      downloadContent: csvLines.join('\n'),
      downloadName: `dood_${new Date().toISOString().split('T')[0]}.csv`,
      downloadMime: 'text/csv',
      meta: { characters: characters.length, scenes: scenes.length },
    };
  }, [characters, scenes]);

  const generateProgressReport = useCallback((): GeneratedReport => {
    const totalScenes = scenes.length;
    const completedScenes = scenes.filter(s => s.is_completed).length;
    const totalShots = shots.length;
    const completedShots = shots.filter(s => s.is_completed).length;
    const totalPages = scenes.reduce((sum, s) => sum + (s.page_count || 0), 0);
    const completedPages = scenes.filter(s => s.is_completed).reduce((sum, s) => sum + (s.page_count || 0), 0);
    const estBudget = budgetItems.reduce((sum, b) => sum + (b.estimated_cost || 0), 0);
    const actBudget = budgetItems.reduce((sum, b) => sum + (b.actual_cost || 0), 0);
    const paidBudget = budgetItems.filter(b => b.is_paid).reduce((sum, b) => sum + (b.actual_cost || 0), 0);
    const confirmedLocations = locations.filter(l => l.is_confirmed).length;
    const totalDuration = scenes.reduce((sum, s) => sum + (s.estimated_duration_minutes || 0), 0);
    const completedDuration = scenes.filter(s => s.is_completed).reduce((sum, s) => sum + (s.estimated_duration_minutes || 0), 0);

    const lines: string[] = [];
    lines.push('═'.repeat(60));
    lines.push('PRODUCTION PROGRESS REPORT');
    lines.push('═'.repeat(60));
    lines.push('');
    lines.push(`Project:  ${currentProject?.title || 'Untitled'}`);
    lines.push(`Date:     ${fmtDate(new Date().toISOString())}`);
    lines.push('');
    lines.push('─── Scenes ─────────────────────────────');
    lines.push(`  Total:      ${totalScenes}`);
    lines.push(`  Completed:  ${completedScenes}  (${pct(completedScenes, totalScenes)})`);
    lines.push(`  Remaining:  ${totalScenes - completedScenes}`);
    lines.push('');
    lines.push('─── Pages ──────────────────────────────');
    lines.push(`  Total:      ${totalPages.toFixed(1)}`);
    lines.push(`  Shot:       ${completedPages.toFixed(1)}  (${pct(completedPages, totalPages)})`);
    lines.push('');
    lines.push('─── Shots ──────────────────────────────');
    lines.push(`  Total:      ${totalShots}`);
    lines.push(`  Completed:  ${completedShots}  (${pct(completedShots, totalShots)})`);
    lines.push('');
    lines.push('─── Duration ───────────────────────────');
    lines.push(`  Estimated Total:  ${totalDuration} min`);
    lines.push(`  Completed:        ${completedDuration} min  (${pct(completedDuration, totalDuration)})`);
    lines.push('');
    lines.push('─── Budget ─────────────────────────────');
    lines.push(`  Estimated:  $${estBudget.toLocaleString()}`);
    lines.push(`  Actual:     $${actBudget.toLocaleString()}`);
    lines.push(`  Paid:       $${paidBudget.toLocaleString()}`);
    lines.push(`  Variance:   $${(actBudget - estBudget).toLocaleString()}  (${estBudget > 0 ? (((actBudget - estBudget) / estBudget) * 100).toFixed(1) + '%' : '—'})`);
    lines.push('');
    lines.push('─── Locations ──────────────────────────');
    lines.push(`  Total:      ${locations.length}`);
    lines.push(`  Confirmed:  ${confirmedLocations}`);
    lines.push('');
    lines.push(`Generated: ${new Date().toLocaleString()}`);

    // CSV
    const csvLines: string[] = [];
    csvLines.push(csvRow(['Metric', 'Value', 'Percentage']));
    csvLines.push(csvRow(['Total Scenes', totalScenes, '']));
    csvLines.push(csvRow(['Completed Scenes', completedScenes, pct(completedScenes, totalScenes)]));
    csvLines.push(csvRow(['Total Pages', totalPages.toFixed(1), '']));
    csvLines.push(csvRow(['Pages Shot', completedPages.toFixed(1), pct(completedPages, totalPages)]));
    csvLines.push(csvRow(['Total Shots', totalShots, '']));
    csvLines.push(csvRow(['Completed Shots', completedShots, pct(completedShots, totalShots)]));
    csvLines.push(csvRow(['Estimated Duration (min)', totalDuration, '']));
    csvLines.push(csvRow(['Completed Duration (min)', completedDuration, pct(completedDuration, totalDuration)]));
    csvLines.push(csvRow(['Estimated Budget', estBudget, '']));
    csvLines.push(csvRow(['Actual Budget', actBudget, '']));
    csvLines.push(csvRow(['Budget Paid', paidBudget, '']));
    csvLines.push(csvRow(['Budget Variance', actBudget - estBudget, estBudget > 0 ? ((actBudget - estBudget) / estBudget * 100).toFixed(1) + '%' : '—']));
    csvLines.push(csvRow(['Locations', locations.length, '']));
    csvLines.push(csvRow(['Confirmed Locations', confirmedLocations, '']));

    return {
      id: crypto.randomUUID(),
      type: 'progress',
      label: 'Progress Report',
      date: new Date().toISOString().split('T')[0],
      content: lines.join('\n'),
      downloadContent: csvLines.join('\n'),
      downloadName: `progress_report_${new Date().toISOString().split('T')[0]}.csv`,
      downloadMime: 'text/csv',
      meta: {
        scenesCompleted: `${completedScenes}/${totalScenes}`,
        shotsCompleted: `${completedShots}/${totalShots}`,
      },
    };
  }, [scenes, shots, budgetItems, locations, currentProject]);

  const generateDailyReport = useCallback((): GeneratedReport => {
    const today = new Date().toISOString().split('T')[0];

    // Find today's schedule events
    const todayEvents = scheduleEvents.filter(e => e.start_time && e.start_time.startsWith(today));
    const todaySceneIds = new Set<string>();
    todayEvents.forEach(e => (e.scene_ids || []).forEach(sid => todaySceneIds.add(sid)));
    const todayScenes = scenes.filter(s => todaySceneIds.has(s.id));
    const todayShots = shots.filter(s => todaySceneIds.has(s.scene_id));
    const shotsCompletedToday = todayShots.filter(s => s.is_completed).length;
    const pagesScheduled = todayScenes.reduce((sum, s) => sum + (s.page_count || 0), 0);
    const pagesCompleted = todayScenes.filter(s => s.is_completed).reduce((sum, s) => sum + (s.page_count || 0), 0);

    const lines: string[] = [];
    lines.push('═'.repeat(60));
    lines.push('DAILY PRODUCTION REPORT');
    lines.push('═'.repeat(60));
    lines.push('');
    lines.push(`Project:  ${currentProject?.title || 'Untitled'}`);
    lines.push(`Date:     ${fmtDate(new Date().toISOString())}`);
    lines.push('');

    if (todayEvents.length === 0) {
      lines.push('No scheduled events for today.');
    } else {
      lines.push(`Schedule Events Today:  ${todayEvents.length}`);
      todayEvents.forEach(e => {
        const loc = e.location_id ? locationMap.get(e.location_id) : null;
        lines.push(`  • ${e.title}  ${fmtTime(e.start_time)} – ${e.end_time ? fmtTime(e.end_time) : 'TBD'}${loc ? '  @ ' + loc.name : ''}`);
      });
    }

    lines.push('');
    lines.push('─── Today\'s Progress ───────────────────');
    lines.push(`  Scenes Scheduled:  ${todayScenes.length}`);
    lines.push(`  Scenes Completed:  ${todayScenes.filter(s => s.is_completed).length}`);
    lines.push(`  Pages Scheduled:   ${pagesScheduled.toFixed(1)}`);
    lines.push(`  Pages Completed:   ${pagesCompleted.toFixed(1)}`);
    lines.push(`  Shots Today:       ${todayShots.length}`);
    lines.push(`  Shots Completed:   ${shotsCompletedToday}`);
    lines.push('');

    if (todayScenes.length > 0) {
      lines.push('─── Scene Details ──────────────────────');
      todayScenes.forEach(s => {
        const status = s.is_completed ? '✓' : '○';
        lines.push(`  ${status} Sc ${s.scene_number}  ${s.scene_heading || ''}  (${s.page_count ?? 0} pg)`);
      });
    }

    lines.push('');
    lines.push(`Generated: ${new Date().toLocaleString()}`);

    return {
      id: crypto.randomUUID(),
      type: 'daily_report',
      label: `Daily Report — ${fmtDate(new Date().toISOString())}`,
      date: today,
      content: lines.join('\n'),
      downloadContent: lines.join('\n'),
      downloadName: `daily_report_${today}.txt`,
      downloadMime: 'text/plain',
      meta: { scenes: todayScenes.length, shots: shotsCompletedToday },
    };
  }, [scheduleEvents, scenes, shots, locationMap, currentProject]);

  const generateWrapReport = useCallback((): GeneratedReport => {
    const totalScenes = scenes.length;
    const completedScenes = scenes.filter(s => s.is_completed).length;
    const totalShots = shots.length;
    const completedShots = shots.filter(s => s.is_completed).length;
    const totalPages = scenes.reduce((sum, s) => sum + (s.page_count || 0), 0);
    const estBudget = budgetItems.reduce((sum, b) => sum + (b.estimated_cost || 0), 0);
    const actBudget = budgetItems.reduce((sum, b) => sum + (b.actual_cost || 0), 0);
    const totalDuration = scenes.reduce((sum, s) => sum + (s.estimated_duration_minutes || 0), 0);
    const scheduleDays = new Set(scheduleEvents.filter(e => e.event_type === 'shooting' || e.scene_ids?.length).map(e => e.start_time?.split('T')[0])).size;

    const lines: string[] = [];
    lines.push('═'.repeat(60));
    lines.push('WRAP REPORT — PRODUCTION SUMMARY');
    lines.push('═'.repeat(60));
    lines.push('');
    lines.push(`Project:  ${currentProject?.title || 'Untitled'}`);
    lines.push(`Date:     ${fmtDate(new Date().toISOString())}`);
    lines.push('');
    lines.push('─── Production Overview ────────────────');
    lines.push(`  Total Scenes:       ${totalScenes}`);
    lines.push(`  Scenes Completed:   ${completedScenes}  (${pct(completedScenes, totalScenes)})`);
    lines.push(`  Total Shots:        ${totalShots}`);
    lines.push(`  Shots Completed:    ${completedShots}  (${pct(completedShots, totalShots)})`);
    lines.push(`  Total Pages:        ${totalPages.toFixed(1)}`);
    lines.push(`  Est. Runtime:       ${totalDuration} min  (${(totalDuration / 60).toFixed(1)} hrs)`);
    lines.push(`  Shooting Days:      ${scheduleDays}`);
    lines.push('');
    lines.push('─── Budget Summary ─────────────────────');
    lines.push(`  Estimated:  $${estBudget.toLocaleString()}`);
    lines.push(`  Final:      $${actBudget.toLocaleString()}`);
    const variance = actBudget - estBudget;
    lines.push(`  Variance:   ${variance > 0 ? '+' : ''}$${variance.toLocaleString()}  (${estBudget ? ((variance / estBudget) * 100).toFixed(1) + '%' : '—'})`);
    lines.push('');

    // Budget by category
    const catTotals = new Map<string, { est: number; act: number }>();
    budgetItems.forEach(b => {
      const cat = b.category || 'Uncategorized';
      const cur = catTotals.get(cat) || { est: 0, act: 0 };
      cur.est += b.estimated_cost || 0;
      cur.act += b.actual_cost || 0;
      catTotals.set(cat, cur);
    });
    if (catTotals.size > 0) {
      lines.push('  Category Breakdown:');
      catTotals.forEach((v, cat) => {
        lines.push(`    ${cat.padEnd(24)} Est: $${v.est.toLocaleString().padEnd(10)} Act: $${v.act.toLocaleString()}`);
      });
      lines.push('');
    }

    lines.push('─── Locations ──────────────────────────');
    lines.push(`  Total:      ${locations.length}`);
    lines.push(`  Confirmed:  ${locations.filter(l => l.is_confirmed).length}`);
    locations.forEach(l => {
      lines.push(`    ${l.name}${l.address ? ' — ' + l.address : ''}  ${l.is_confirmed ? '✓' : '○'}  $${l.cost_per_day || 0}/day`);
    });
    lines.push('');

    lines.push('─── Cast ───────────────────────────────');
    lines.push(`  Total Characters:  ${characters.length}`);
    lines.push(`  Main Cast:         ${characters.filter(c => c.is_main).length}`);
    characters.filter(c => c.is_main).forEach(c => {
      lines.push(`    ${c.name}${c.cast_actor ? ' (' + c.cast_actor + ')' : ''}`);
    });
    lines.push('');

    lines.push('─── Crew ───────────────────────────────');
    lines.push(`  Team Size:  ${members.length}`);
    const depts = new Map<string, number>();
    members.forEach(m => {
      const dept = m.department || 'General';
      depts.set(dept, (depts.get(dept) || 0) + 1);
    });
    depts.forEach((count, dept) => {
      lines.push(`    ${dept}: ${count}`);
    });
    lines.push('');
    lines.push(`Generated: ${new Date().toLocaleString()}`);

    return {
      id: crypto.randomUUID(),
      type: 'wrap_report',
      label: 'Wrap Report',
      date: new Date().toISOString().split('T')[0],
      content: lines.join('\n'),
      downloadContent: lines.join('\n'),
      downloadName: `wrap_report_${new Date().toISOString().split('T')[0]}.txt`,
      downloadMime: 'text/plain',
      meta: { scenes: totalScenes, shots: totalShots, team: members.length },
    };
  }, [scenes, shots, budgetItems, locations, characters, members, scheduleEvents, currentProject]);

  // ── Master generate dispatcher ─────────────────────────────

  const generateReport = useCallback(async (type: ReportType) => {
    setGenerating(true);
    try {
      let report: GeneratedReport | null = null;
      switch (type) {
        case 'call_sheet':
          report = generateCallSheet();
          break;
        case 'dood':
          report = generateDOOD();
          break;
        case 'progress':
          report = generateProgressReport();
          break;
        case 'daily_report':
          report = generateDailyReport();
          break;
        case 'wrap_report':
          report = generateWrapReport();
          break;
      }
      if (report) {
        setReports(prev => [report!, ...prev]);
        setViewingReport(report);
        toast.success(`${REPORT_TYPES.find(r => r.type === type)?.label} generated`);
      }
    } catch (err: unknown) {
      toast.error('Failed to generate report');
      console.error(err);
    }
    setGenerating(false);
    setSelectedType(null);
    setSelectedEventId('');
  }, [generateCallSheet, generateDOOD, generateProgressReport, generateDailyReport, generateWrapReport]);

  const handleDownload = useCallback((report: GeneratedReport) => {
    downloadFile(report.downloadContent, report.downloadName, report.downloadMime);
    toast.success(`Downloaded ${report.downloadName}`);
  }, []);

  // ── PRO GATE ────────────────────────────────────────────────

  if (!hasProAccess) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md p-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-xl font-black text-white mb-2">Production Reports</h2>
          <p className="text-sm text-surface-400 mb-6">Generate call sheets, DOOD reports, daily production reports, and more.</p>
          <Button onClick={() => { window.location.href = '/pro'; }}>Upgrade to Pro</Button>
        </Card>
        <ToastContainer />
      </div>
    );
  }

  if (loading) return <LoadingPage />;

  // ── RENDER ──────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <ToastContainer />

      <div>
        <h1 className="text-2xl font-black text-white">Production Reports</h1>
        <p className="text-sm text-surface-400 mt-1">
          Generate industry-standard production documents from live project data
        </p>
      </div>

      {/* ── Quick Stats Banner ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Scenes', value: `${scenes.filter(s => s.is_completed).length}/${scenes.length}`, sub: 'completed' },
          { label: 'Shots', value: `${shots.filter(s => s.is_completed).length}/${shots.length}`, sub: 'completed' },
          { label: 'Pages', value: scenes.reduce((s, sc) => s + (sc.page_count || 0), 0).toFixed(1), sub: 'total' },
          { label: 'Cast', value: String(characters.length), sub: `${characters.filter(c => c.is_main).length} leads` },
        ].map(stat => (
          <div key={stat.label} className="bg-surface-900 border border-surface-800 rounded-xl p-4">
            <p className="text-xs text-surface-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-xl font-black text-white mt-1">{stat.value}</p>
            <p className="text-xs text-surface-500">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Report Type Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.type}
            onClick={() => { setSelectedType(rt.type); setViewingReport(null); }}
            className={`p-5 rounded-xl border text-left transition-all hover:shadow-lg ${
              selectedType === rt.type
                ? 'border-[#FF5F1F] bg-[#FF5F1F]/5 shadow-brand-500/10'
                : 'border-surface-800 bg-surface-900 hover:border-surface-700'
            }`}
          >
            <div className="text-2xl mb-3">{rt.icon}</div>
            <h3 className="text-sm font-semibold text-white mb-1">{rt.label}</h3>
            <p className="text-xs text-surface-400">{rt.description}</p>
          </button>
        ))}
      </div>

      {/* ── Generation Panel ───────────────────────────────────── */}
      {selectedType && (
        <Card className="p-5 border-[#FF5F1F]/30 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                Generate {REPORT_TYPES.find(r => r.type === selectedType)?.label}
              </h3>
              <p className="text-xs text-surface-400 mt-1">
                {REPORT_TYPES.find(r => r.type === selectedType)?.description}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setSelectedType(null); setSelectedEventId(''); }}>Cancel</Button>
              <Button
                onClick={() => generateReport(selectedType)}
                loading={generating}
                disabled={selectedType === 'call_sheet' && !selectedEventId}
              >
                Generate
              </Button>
            </div>
          </div>

          {/* Call Sheet: date picker */}
          {selectedType === 'call_sheet' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-surface-400 uppercase tracking-wider">
                Select a Schedule Date
              </label>
              {scheduleEvents.length === 0 ? (
                <p className="text-sm text-surface-500">
                  No schedule events found. Add shooting days in the Schedule tab first.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {scheduleEvents.map(ev => {
                    const loc = ev.location_id ? locationMap.get(ev.location_id) : null;
                    const sceneCt = (ev.scene_ids || []).length;
                    return (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEventId(ev.id)}
                        className={`p-3 rounded-lg border text-left text-xs transition-all ${
                          selectedEventId === ev.id
                            ? 'border-[#FF5F1F] bg-[#FF5F1F]/10'
                            : 'border-surface-800 bg-surface-950 hover:border-surface-700'
                        }`}
                      >
                        <p className="font-medium text-white">{fmtDate(ev.start_time)}</p>
                        <p className="text-surface-400 mt-0.5">
                          {ev.title}{loc ? ` — ${loc.name}` : ''} · {sceneCt} scene{sceneCt !== 1 ? 's' : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── Report Viewer ──────────────────────────────────────── */}
      {viewingReport && (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-surface-800">
            <div className="flex items-center gap-3">
              <span className="text-xl">{REPORT_TYPES.find(r => r.type === viewingReport.type)?.icon}</span>
              <div>
                <p className="text-sm font-semibold text-white">{viewingReport.label}</p>
                <p className="text-xs text-surface-500">{fmtDate(viewingReport.date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleDownload(viewingReport)}>
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download {viewingReport.downloadMime === 'text/csv' ? 'CSV' : 'TXT'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setViewingReport(null)}>Close</Button>
            </div>
          </div>
          <pre className="p-4 text-xs text-surface-300 overflow-x-auto whitespace-pre font-mono bg-surface-950 max-h-[60vh] overflow-y-auto leading-relaxed">
            {viewingReport.content}
          </pre>
        </Card>
      )}

      {/* ── Generated Reports History ──────────────────────────── */}
      {reports.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Generated Reports</h3>
          <div className="space-y-2">
            {reports.map((r) => {
              const rtInfo = REPORT_TYPES.find(rt => rt.type === r.type)!;
              return (
                <Card key={r.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl flex-shrink-0">{rtInfo.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{r.label}</p>
                      <p className="text-xs text-surface-500">{fmtDate(r.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => setViewingReport(r)}>
                      View
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(r)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────── */}
      {reports.length === 0 && !selectedType && !viewingReport && (
        <div className="text-center py-12 text-surface-500">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm">Select a report type above to generate real production reports from your project data.</p>
          <p className="text-xs mt-2 text-surface-600">
            {scenes.length} scenes · {shots.length} shots · {characters.length} characters loaded
          </p>
        </div>
      )}
    </div>
  );
}
