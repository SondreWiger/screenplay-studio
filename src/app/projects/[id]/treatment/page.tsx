'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Input, Textarea, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  Globe, BookOpen, GitBranch, Clock, Users, Tv, BarChart2,
  Plus, Layers, FileText, Trash2, Download, Save,
  ChevronDown, ChevronUp, Sparkles, Map, Shield, Eye, Film,
  CheckCircle2,
} from 'lucide-react';

interface Episode { id: string; title: string; logline: string; synopsis: string; }
interface CharacterArc { id: string; name: string; role: string; arc: string; want?: string; need?: string; fear?: string; flaw?: string; }
interface TimelineEvent { id: string; date: string; event: string; type: 'world' | 'story' | 'character' | 'other'; }
interface PlotThread { id: string; label: string; color: string; summary: string; beats: string; }
interface CustomSection { id: string; title: string; content: string; }
interface Treatment {
  id: string;
  logline: string | null; tagline: string | null; genre: string | null;
  premise: string | null; theme: string | null; tone: string | null;
  format: string | null; budget_level: string | null;
  world: string | null; rules_of_world: string | null;
  atmosphere: string | null; visual_style: string | null;
  synopsis: string | null;
  episode_breakdown: Episode[];
  character_arcs: CharacterArc[];
  comparable_titles: string | null; market_context: string | null; writer_bio: string | null;
  timeline: TimelineEvent[];
  plot_threads: PlotThread[];
  custom_sections: CustomSection[];
}

const BLANK: Omit<Treatment, 'id'> = {
  logline: null, tagline: null, genre: null, premise: null, theme: null, tone: null,
  format: null, budget_level: null, world: null, rules_of_world: null,
  atmosphere: null, visual_style: null, synopsis: null,
  episode_breakdown: [], character_arcs: [], comparable_titles: null,
  market_context: null, writer_bio: null,
  timeline: [], plot_threads: [], custom_sections: [],
};

const BUDGET_OPTIONS = ['Micro', 'Low', 'Mid', 'High', 'Studio'];
const FORMAT_OPTIONS = ['Feature Film', 'Short Film', 'TV Series (30 min)', 'TV Series (60 min)', 'Limited Series', 'Pilot', 'Web Series', 'Mini-Series', 'Anthology', 'Other'];
const GENRE_OPTIONS = ['Drama', 'Comedy', 'Thriller', 'Horror', 'Sci-Fi', 'Fantasy', 'Crime', 'Romance', 'Action', 'Adventure', 'Mystery', 'Documentary', 'Animation', 'Historical', 'Biographical', 'Musical', 'Satire', 'Dark Comedy', 'Other'];
const TIMELINE_TYPES: { value: TimelineEvent['type']; label: string; color: string }[] = [
  { value: 'world', label: 'World', color: '#3b82f6' },
  { value: 'story', label: 'Story', color: '#8b5cf6' },
  { value: 'character', label: 'Character', color: '#10b981' },
  { value: 'other', label: 'Other', color: '#6b7280' },
];
const THREAD_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

function uid() { return Math.random().toString(36).slice(2, 10); }
function wordCount(s: string | null) { return s?.trim().split(/\s+/).filter(Boolean).length ?? 0; }
function filled(v: string | null | undefined) { return !!(v && v.trim()); }

const SECTIONS = [
  { id: 'overview',   label: 'Overview',       icon: FileText,  accent: '#f59e0b' },
  { id: 'world',      label: 'World Building',  icon: Globe,     accent: '#38bdf8' },
  { id: 'story',      label: 'Story',           icon: BookOpen,  accent: '#a78bfa' },
  { id: 'plots',      label: 'Plot Threads',    icon: GitBranch, accent: '#f87171' },
  { id: 'timeline',   label: 'Timeline',        icon: Clock,     accent: '#2dd4bf' },
  { id: 'characters', label: 'Characters',      icon: Users,     accent: '#34d399' },
  { id: 'episodes',   label: 'Episodes',        icon: Tv,        accent: '#818cf8' },
  { id: 'market',     label: 'Market',          icon: BarChart2, accent: '#94a3b8' },
  { id: 'custom',     label: 'Custom',          icon: Layers,    accent: '#f472b6' },
];

function sectionCompletion(id: string, f: Omit<Treatment, 'id'>): 'full' | 'partial' | 'empty' {
  switch (id) {
    case 'overview':   { const c = [f.logline, f.genre, f.format, f.tone, f.tagline].filter(filled).length; return c >= 4 ? 'full' : c > 0 ? 'partial' : 'empty'; }
    case 'world':      { const c = [f.world, f.rules_of_world, f.atmosphere, f.visual_style].filter(filled).length; return c >= 3 ? 'full' : c > 0 ? 'partial' : 'empty'; }
    case 'story':      { const c = [f.premise, f.theme, f.synopsis].filter(filled).length; return c === 3 ? 'full' : c > 0 ? 'partial' : 'empty'; }
    case 'plots':      return f.plot_threads.length >= 2 ? 'full' : f.plot_threads.length > 0 ? 'partial' : 'empty';
    case 'timeline':   return f.timeline.length >= 3 ? 'full' : f.timeline.length > 0 ? 'partial' : 'empty';
    case 'characters': return f.character_arcs.length >= 2 ? 'full' : f.character_arcs.length > 0 ? 'partial' : 'empty';
    case 'episodes':   return f.episode_breakdown.length >= 2 ? 'full' : f.episode_breakdown.length > 0 ? 'partial' : 'empty';
    case 'market':     { const c = [f.comparable_titles, f.market_context, f.writer_bio].filter(filled).length; return c === 3 ? 'full' : c > 0 ? 'partial' : 'empty'; }
    case 'custom':     return f.custom_sections.length > 0 ? 'full' : 'empty';
    default: return 'empty';
  }
}

function SectionHeader({ icon: Icon, label, accent, subtitle }: { icon: React.ElementType; label: string; accent: string; subtitle?: string; }) {
  return (
    <div className="flex items-start gap-4 mb-8">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${accent}22`, color: accent }}>
        <Icon size={20} />
      </div>
      <div>
        <h2 className="text-xl font-black text-white tracking-tight">{label}</h2>
        {subtitle && <p className="text-sm text-surface-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <label className="text-xs font-bold text-surface-300 uppercase tracking-wider">{label}</label>
        {hint && <span className="text-xs text-surface-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function FieldCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('bg-surface-800/50 border border-surface-700/60 rounded-2xl p-5 space-y-4', className)}>{children}</div>;
}

function buildSeriesBibleHTML(f: Omit<Treatment, 'id'>, projectTitle: string): string {
  const esc = (s: string | null | undefined) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  const sec = (title: string, body: string) => body.trim() ? `<div class="section"><h2>${esc(title)}</h2>${body}</div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(projectTitle)} — Series Bible</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,'Times New Roman',Times,serif;font-size:9.5pt;line-height:1.6;color:#1a1a1a;background:#fff}
@page{size:letter;margin:1in}
.cover{min-height:9in;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:.75in}
.cover-eyebrow{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:6.5pt;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#888;margin-bottom:14pt}
.cover-title{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:30pt;font-weight:900;line-height:1.05;letter-spacing:-.02em;color:#1a1a1a;margin-bottom:9pt}
.cover-meta{font-size:9pt;color:#555;margin-bottom:20pt}
.cover-rule{width:32pt;height:1.5pt;background:#1a1a1a;margin:0 auto 20pt}
.cover-logline{font-size:10.5pt;font-style:italic;color:#333;max-width:5in;line-height:1.65}
.cover-date{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:6.5pt;color:#aaa;margin-top:28pt}
.section{margin-bottom:20pt;page-break-inside:avoid}
.section h2{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:7pt;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#666;border-bottom:1pt solid #1a1a1a;padding-bottom:4pt;margin-bottom:10pt}
.section h3{font-size:10pt;font-weight:600;margin:9pt 0 3pt}
.section p{margin-bottom:7pt}
.logline-box{background:#f8f8f8;border-left:2.5pt solid #1a1a1a;padding:8pt 11pt;font-style:italic;font-size:10.5pt;margin-bottom:11pt}
.meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8pt;margin-bottom:11pt}
.ml{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:6.5pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#888;margin-bottom:2pt}
.mv{font-size:9pt;font-weight:600}
.thread{border:1pt solid #e5e5e5;border-radius:3pt;padding:8pt;margin-bottom:7pt;page-break-inside:avoid}
.badge{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:6.5pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;display:inline-block;padding:2pt 6pt;border-radius:2pt;color:#fff;margin-bottom:5pt}
.tl-row{display:grid;grid-template-columns:8pt 60pt 1fr;gap:7pt;align-items:baseline;margin-bottom:6pt}
.tl-dot{width:6pt;height:6pt;border-radius:50%;margin-top:2pt}
.tl-date{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:7.5pt;font-weight:600;color:#555}
.char{border:1pt solid #e5e5e5;border-radius:3pt;padding:8pt;margin-bottom:7pt;page-break-inside:avoid}
.char-name{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:10pt;font-weight:700}
.char-role{font-size:8.5pt;color:#666;font-style:italic;margin-bottom:5pt}
.ep{border-bottom:1pt solid #eee;padding-bottom:8pt;margin-bottom:8pt;page-break-inside:avoid}
.ep-n{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:6.5pt;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#888}
.ep-title{font-size:10pt;font-weight:700;margin-bottom:2pt}
</style></head><body>
<div class="cover">
  <div class="cover-eyebrow">Series Bible</div>
  <div class="cover-title">${esc(projectTitle)}</div>
  <div class="cover-meta">${[f.format, f.genre, f.tone].filter(Boolean).map(esc).join(' &ensp;&middot;&ensp; ')}</div>
  <div class="cover-rule"></div>
  ${f.logline ? `<div class="cover-logline">${esc(f.logline)}</div>` : ''}
  <div class="cover-date">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
</div>
<div class="html2pdf__page-break"></div>
${sec('Overview', `${f.logline ? `<div class="logline-box">${esc(f.logline)}</div>` : ''}${f.tagline ? `<p><em>&ldquo;${esc(f.tagline)}&rdquo;</em></p>` : ''}<div class="meta-grid">${[['Format', f.format], ['Genre', f.genre], ['Tone', f.tone], ['Budget', f.budget_level]].filter(([, v]) => v).map(([l, v]) => `<div><div class="ml">${l}</div><div class="mv">${esc(v as string)}</div></div>`).join('')}</div>`)}
${sec('World Building', `${f.world ? `<h3>The World</h3><p>${esc(f.world)}</p>` : ''}${f.rules_of_world ? `<h3>Rules of the World</h3><p>${esc(f.rules_of_world)}</p>` : ''}${f.atmosphere ? `<h3>Atmosphere</h3><p>${esc(f.atmosphere)}</p>` : ''}${f.visual_style ? `<h3>Visual Style</h3><p>${esc(f.visual_style)}</p>` : ''}`)}
${sec('Premise & Theme', `${f.premise ? `<h3>Premise</h3><p>${esc(f.premise)}</p>` : ''}${f.theme ? `<h3>Theme</h3><p>${esc(f.theme)}</p>` : ''}`)}
${f.synopsis ? sec('Full Synopsis', `<p>${esc(f.synopsis)}</p>`) : ''}
${f.plot_threads.length ? sec('Plot Threads', f.plot_threads.map(t => `<div class="thread"><span class="badge" style="background:${t.color}">${esc(t.label)}</span>${t.summary ? `<p>${esc(t.summary)}</p>` : ''}${t.beats ? `<p><strong>Beats:</strong> ${esc(t.beats)}</p>` : ''}</div>`).join('')) : ''}
${f.timeline.length ? sec('Timeline', f.timeline.map(ev => { const tc = TIMELINE_TYPES.find(t => t.value === ev.type)?.color || '#6b7280'; return `<div class="tl-row"><div class="tl-dot" style="background:${tc}"></div><div class="tl-date">${esc(ev.date)}</div><div>${esc(ev.event)}</div></div>`; }).join('')) : ''}
${f.character_arcs.length ? sec('Characters', f.character_arcs.map(c => `<div class="char"><div class="char-name">${esc(c.name)}</div><div class="char-role">${esc(c.role)}</div>${c.arc ? `<p>${esc(c.arc)}</p>` : ''}${[c.want && `<strong>WANT</strong> ${esc(c.want)}`, c.need && `<strong>NEED</strong> ${esc(c.need)}`, c.fear && `<strong>FEAR</strong> ${esc(c.fear)}`, c.flaw && `<strong>FLAW</strong> ${esc(c.flaw)}`].filter(Boolean).length ? `<p style="font-size:10pt;color:#444">${[c.want && `<strong>WANT</strong> ${esc(c.want)}`, c.need && `<strong>NEED</strong> ${esc(c.need)}`, c.fear && `<strong>FEAR</strong> ${esc(c.fear)}`, c.flaw && `<strong>FLAW</strong> ${esc(c.flaw)}`].filter(Boolean).join(' &middot; ')}</p>` : ''}</div>`).join('')) : ''}
${f.episode_breakdown.length ? sec('Episode Breakdown', f.episode_breakdown.map((ep, i) => `<div class="ep"><div class="ep-n">Episode ${i + 1}</div><div class="ep-title">${esc(ep.title)}</div>${ep.logline ? `<p><em>${esc(ep.logline)}</em></p>` : ''}${ep.synopsis ? `<p>${esc(ep.synopsis)}</p>` : ''}</div>`).join('')) : ''}
${(f.comparable_titles || f.market_context || f.writer_bio) ? sec('Market', `${f.comparable_titles ? `<h3>Comparable Titles</h3><p>${esc(f.comparable_titles)}</p>` : ''}${f.market_context ? `<h3>Market Context</h3><p>${esc(f.market_context)}</p>` : ''}${f.writer_bio ? `<h3>Writer / Director</h3><p>${esc(f.writer_bio)}</p>` : ''}`) : ''}
${f.custom_sections.map(cs => cs.content || cs.title ? sec(cs.title || 'Additional Notes', `<p>${esc(cs.content)}</p>`) : '').join('')}
</body></html>`;
}

export default function TreatmentPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';

  const [treatment, setTreatment] = useState<Treatment | null>(null);
  const [form, setForm] = useState<Omit<Treatment, 'id'>>(BLANK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [isDirty, setIsDirty] = useState(false);
  const [expandedArcs, setExpandedArcs] = useState<Set<string>>(new Set());
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justLoadedRef = useRef(false);
  const saveRef = useRef<() => void>(() => {});

  useEffect(() => { load(); }, [params.id]);

  const load = async () => {
    const { data } = await createClient().from('treatment').select('*').eq('project_id', params.id).maybeSingle();
    if (data) {
      setTreatment(data as Treatment);
      justLoadedRef.current = true;
      setForm({
        logline: data.logline, tagline: data.tagline ?? null, genre: data.genre ?? null,
        premise: data.premise, theme: data.theme, tone: data.tone,
        format: data.format, budget_level: data.budget_level,
        world: data.world, rules_of_world: data.rules_of_world ?? null,
        atmosphere: data.atmosphere ?? null, visual_style: data.visual_style ?? null,
        synopsis: data.synopsis,
        episode_breakdown: (data.episode_breakdown ?? []) as Episode[],
        character_arcs: (data.character_arcs ?? []) as CharacterArc[],
        comparable_titles: data.comparable_titles, market_context: data.market_context,
        writer_bio: data.writer_bio,
        timeline: (data.timeline ?? []) as TimelineEvent[],
        plot_threads: (data.plot_threads ?? []) as PlotThread[],
        custom_sections: (data.custom_sections ?? []) as CustomSection[],
      });
    }
    setLoading(false);
  };

  const save = useCallback(async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = { ...form, project_id: params.id, updated_at: new Date().toISOString() };
    if (treatment) {
      const { data, error } = await supabase.from('treatment').update(payload).eq('id', treatment.id).select().single();
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return; }
      if (data) setTreatment(data as Treatment);
    } else {
      const { data, error } = await supabase.from('treatment').insert({ ...payload, created_by: user?.id }).select().single();
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return; }
      if (data) setTreatment(data as Treatment);
    }
    setSaving(false); setIsDirty(false); toast.success('Saved.');
  }, [form, treatment, user?.id, params.id]);

  useEffect(() => { saveRef.current = save; }, [save]);
  useEffect(() => {
    if (justLoadedRef.current) { justLoadedRef.current = false; return; }
    if (loading) return;
    setIsDirty(true);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => saveRef.current(), 3000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [form]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveRef.current(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => {
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [isDirty]);

  const handleExportPDF = async () => {
    const projectTitle = currentProject?.title || 'Untitled';
    const filename = `${projectTitle.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-') || 'series-bible'}-series-bible.pdf`;
    const htmlStr = buildSeriesBibleHTML(form, projectTitle);

    toast('Generating PDF…', 'info', 15000);
    try {
      // Parse the generated HTML and extract styles + body content
      const parsed = new DOMParser().parseFromString(htmlStr, 'text/html');
      const styleContent = Array.from(parsed.querySelectorAll('style')).map(s => s.textContent || '').join('\n');
      const bodyContent = parsed.body.innerHTML;

      // Build a fully isolated container — 'all:initial' prevents the dark
      // Next.js theme from bleeding in via html2canvas's parent-document context
      const host = document.createElement('div');
      host.setAttribute('data-pdf-host', '1');
      host.style.cssText = [
        'all: initial',
        'position: fixed',
        'left: -9999px',
        'top: 0',
        'width: 816px',
        'background: #ffffff',
        'color: #1a1a1a',
        'font-family: Georgia, "Times New Roman", Times, serif',
        'font-size: 12pt',
        'line-height: 1.65',
      ].join(';');

      // Inject the template's scoped styles (they use class selectors, so
      // they only affect children of this container)
      const styleEl = document.createElement('style');
      styleEl.textContent = styleContent;
      host.appendChild(styleEl);

      const content = document.createElement('div');
      content.innerHTML = bodyContent;
      host.appendChild(content);

      document.body.appendChild(host);

      // Give the browser a frame to paint it
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 300));

      // Calculate the largest scale that won't exceed browser canvas limits.
      // Most browsers cap at ~16.7 M pixels (4096×4096). Use 14 M to be safe.
      const MAX_CANVAS_PX = 14_000_000;
      const contentH = content.scrollHeight || 1200;
      const rawScale = Math.sqrt(MAX_CANVAS_PX / (816 * contentH));
      const safeScale = Math.min(1.5, Math.max(0.8, rawScale));

      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({
        margin: [0.75, 0.75],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: safeScale,
          useCORS: true,
          letterRendering: true,
          logging: false,
          windowWidth: 816,
          backgroundColor: '#ffffff',
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: 'css', before: '.html2pdf__page-break', avoid: '.section,.char,.ep,.thread' },
      }).from(content).save();

      document.body.removeChild(host);
      toast.success('PDF downloaded.');
    } catch (err) {
      document.querySelector('[data-pdf-host]')?.remove();
      toast.error('PDF export failed.');
      console.error(err);
    }
  };

  const addEpisode = () => setForm(f => ({ ...f, episode_breakdown: [...f.episode_breakdown, { id: uid(), title: '', logline: '', synopsis: '' }] }));
  const updateEpisode = (id: string, field: keyof Episode, val: string) => setForm(f => ({ ...f, episode_breakdown: f.episode_breakdown.map(e => e.id === id ? { ...e, [field]: val } : e) }));
  const removeEpisode = (id: string) => setForm(f => ({ ...f, episode_breakdown: f.episode_breakdown.filter(e => e.id !== id) }));

  const addArc = () => { const id = uid(); setForm(f => ({ ...f, character_arcs: [...f.character_arcs, { id, name: '', role: '', arc: '' }] })); setExpandedArcs(s => new Set(Array.from(s).concat(id))); };
  const updateArc = (id: string, field: keyof CharacterArc, val: string) => setForm(f => ({ ...f, character_arcs: f.character_arcs.map(c => c.id === id ? { ...c, [field]: val } : c) }));
  const removeArc = (id: string) => setForm(f => ({ ...f, character_arcs: f.character_arcs.filter(c => c.id !== id) }));
  const toggleArc = (id: string) => setExpandedArcs(s => { const n = new Set(Array.from(s)); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const addEvent = () => setForm(f => ({ ...f, timeline: [...f.timeline, { id: uid(), date: '', event: '', type: 'world' as const }] }));
  const updateEvent = (id: string, field: keyof TimelineEvent, val: string) => setForm(f => ({ ...f, timeline: f.timeline.map(e => e.id === id ? { ...e, [field]: val } : e) }));
  const removeEvent = (id: string) => setForm(f => ({ ...f, timeline: f.timeline.filter(e => e.id !== id) }));

  const addThread = () => {
    const idx = form.plot_threads.length;
    const label = ['A Plot', 'B Plot', 'C Plot'][idx] ?? `${String.fromCharCode(65 + idx)} Plot`;
    setForm(f => ({ ...f, plot_threads: [...f.plot_threads, { id: uid(), label, color: THREAD_COLORS[idx % THREAD_COLORS.length], summary: '', beats: '' }] }));
  };
  const updateThread = (id: string, field: keyof PlotThread, val: string) => setForm(f => ({ ...f, plot_threads: f.plot_threads.map(t => t.id === id ? { ...t, [field]: val } : t) }));
  const removeThread = (id: string) => setForm(f => ({ ...f, plot_threads: f.plot_threads.filter(t => t.id !== id) }));

  const addCustom = () => setForm(f => ({ ...f, custom_sections: [...f.custom_sections, { id: uid(), title: '', content: '' }] }));
  const updateCustom = (id: string, field: keyof CustomSection, val: string) => setForm(f => ({ ...f, custom_sections: f.custom_sections.map(c => c.id === id ? { ...c, [field]: val } : c) }));
  const removeCustom = (id: string) => setForm(f => ({ ...f, custom_sections: f.custom_sections.filter(c => c.id !== id) }));

  const f = form;
  const fullCount = SECTIONS.filter(s => sectionCompletion(s.id, f) === 'full').length;
  const progressPct = Math.round((fullCount / SECTIONS.length) * 100);

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="flex h-full min-h-0">

      {/* SIDEBAR */}
      <aside className="w-52 flex-shrink-0 border-r border-surface-800 flex flex-col overflow-y-auto">
        <div className="px-4 pt-5 pb-4 border-b border-surface-800">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={11} className="text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Series Bible</span>
          </div>
          <p className="text-xs text-surface-400 truncate leading-snug">{currentProject?.title || 'Untitled'}</p>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-surface-500">Completion</span>
              <span className="text-[10px] font-bold text-surface-400">{progressPct}%</span>
            </div>
            <div className="h-1 rounded-full bg-surface-700 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-px">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const status = sectionCompletion(s.id, f);
            const active = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all', active ? 'text-white' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60')}
                style={active ? { background: `${s.accent}18`, color: s.accent } : undefined}>
                <Icon size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left truncate">{s.label}</span>
                {status === 'full'    && <CheckCircle2 size={10} style={{ color: '#34d399' }} />}
                {status === 'partial' && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                {status === 'empty'   && <div className="w-1.5 h-1.5 rounded-full bg-surface-700" />}
              </button>
            );
          })}
        </nav>
        <div className="px-3 pb-4 pt-2 border-t border-surface-800 space-y-2">
          {canEdit && (
            <button onClick={save} disabled={saving}
              className={cn('w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all', isDirty ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700')}>
              <Save size={11} />
              {saving ? 'Saving…' : isDirty ? '● Save Changes' : 'Saved'}
            </button>
          )}
          <button onClick={handleExportPDF}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-surface-800 text-surface-300 hover:text-white hover:bg-surface-700 transition-all">
            <Download size={11} /> Export PDF
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 pb-24">

          {activeSection === 'overview' && (
            <div className="space-y-5">
              <SectionHeader icon={FileText} label="Overview" accent="#f59e0b" subtitle="Logline, tagline, format, and the core identity of your project." />
              <FieldCard>
                <Field label="Logline" hint="1–2 sentences">
                  <Textarea value={f.logline ?? ''} onChange={e => setForm({ ...f, logline: e.target.value })} rows={2} placeholder="When [protagonist] must [conflict], they discover [theme]…" readOnly={!canEdit} className="text-base font-medium leading-relaxed" />
                </Field>
                <Field label="Tagline" hint="Short, memorable — for posters and pitches">
                  <Input value={f.tagline ?? ''} onChange={e => setForm({ ...f, tagline: e.target.value })} placeholder='"The truth will set you free — but first it will destroy you."' readOnly={!canEdit} />
                </Field>
              </FieldCard>
              <FieldCard>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Format">
                    <select value={f.format ?? ''} onChange={e => setForm({ ...f, format: e.target.value })} disabled={!canEdit} className="w-full bg-surface-700/60 border border-surface-600/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40">
                      <option value="">Select…</option>
                      {FORMAT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Genre">
                    <select value={f.genre ?? ''} onChange={e => setForm({ ...f, genre: e.target.value })} disabled={!canEdit} className="w-full bg-surface-700/60 border border-surface-600/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40">
                      <option value="">Select…</option>
                      {GENRE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Tone">
                    <Input value={f.tone ?? ''} onChange={e => setForm({ ...f, tone: e.target.value })} placeholder="Dark comedy, Gritty drama…" readOnly={!canEdit} />
                  </Field>
                  <Field label="Budget Level">
                    <select value={f.budget_level ?? ''} onChange={e => setForm({ ...f, budget_level: e.target.value })} disabled={!canEdit} className="w-full bg-surface-700/60 border border-surface-600/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40">
                      <option value="">Select…</option>
                      {BUDGET_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                </div>
              </FieldCard>
            </div>
          )}

          {activeSection === 'world' && (
            <div className="space-y-5">
              <SectionHeader icon={Globe} label="World Building" accent="#38bdf8" subtitle="Setting, rules, atmosphere, and visual language of your world." />
              <FieldCard>
                <div className="flex items-center gap-2 pb-1 border-b border-surface-700/40"><Map size={12} className="text-sky-400" /><span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Setting &amp; World</span></div>
                <Textarea value={f.world ?? ''} onChange={e => setForm({ ...f, world: e.target.value })} rows={5} placeholder="Time period, geography, society, history — where does this world exist and what shaped it?" readOnly={!canEdit} />
              </FieldCard>
              <FieldCard>
                <div className="flex items-center gap-2 pb-1 border-b border-surface-700/40"><Shield size={12} className="text-sky-400" /><span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Rules of the World</span></div>
                <Textarea value={f.rules_of_world ?? ''} onChange={e => setForm({ ...f, rules_of_world: e.target.value })} rows={5} placeholder="Laws, constraints, unique mechanics — whatever governs this world." readOnly={!canEdit} />
              </FieldCard>
              <FieldCard>
                <div className="flex items-center gap-2 pb-1 border-b border-surface-700/40"><Eye size={12} className="text-sky-400" /><span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Atmosphere</span></div>
                <Textarea value={f.atmosphere ?? ''} onChange={e => setForm({ ...f, atmosphere: e.target.value })} rows={3} placeholder="Mood, texture, feel — what is the emotional register?" readOnly={!canEdit} />
              </FieldCard>
              <FieldCard>
                <div className="flex items-center gap-2 pb-1 border-b border-surface-700/40"><Film size={12} className="text-sky-400" /><span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Visual Style</span></div>
                <Textarea value={f.visual_style ?? ''} onChange={e => setForm({ ...f, visual_style: e.target.value })} rows={3} placeholder="Color palette, camera language, lighting, visual references." readOnly={!canEdit} />
              </FieldCard>
            </div>
          )}

          {activeSection === 'story' && (
            <div className="space-y-5">
              <SectionHeader icon={BookOpen} label="Story" accent="#a78bfa" subtitle="Premise, theme, and the full narrative from beginning to end." />
              <FieldCard>
                <Field label="Premise" hint="The dramatic engine">
                  <Textarea value={f.premise ?? ''} onChange={e => setForm({ ...f, premise: e.target.value })} rows={4} placeholder="The central dramatic question and conflict…" readOnly={!canEdit} />
                </Field>
              </FieldCard>
              <FieldCard>
                <Field label="Theme" hint="What does this story mean?">
                  <Textarea value={f.theme ?? ''} onChange={e => setForm({ ...f, theme: e.target.value })} rows={3} placeholder="What questions does this story ask? What truths does it wrestle with?" readOnly={!canEdit} />
                </Field>
              </FieldCard>
              <FieldCard>
                <div className="flex items-start justify-between mb-1">
                  <Field label="Full Synopsis" hint="Reveal the ending"><span /></Field>
                  <span className="text-xs text-surface-500 mt-1 ml-4 flex-shrink-0">{wordCount(f.synopsis).toLocaleString()} words</span>
                </div>
                <Textarea value={f.synopsis ?? ''} onChange={e => setForm({ ...f, synopsis: e.target.value })} rows={18} placeholder="Beat-by-beat story summary. Beginning, middle, end. No cliffhanger — reveal your ending." readOnly={!canEdit} />
              </FieldCard>
            </div>
          )}

          {activeSection === 'plots' && (
            <div className="space-y-5">
              <SectionHeader icon={GitBranch} label="Plot Threads" accent="#f87171" subtitle="A plot, B plot, C plot — each storyline tracked independently." />
              {f.plot_threads.map(t => (
                <div key={t.id} className="rounded-2xl border border-surface-700/60 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background: `${t.color}15`, borderBottom: `1px solid ${t.color}28` }}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    {canEdit
                      ? <input value={t.label} onChange={e => updateThread(t.id, 'label', e.target.value)} className="flex-1 bg-transparent text-sm font-bold focus:outline-none min-w-0" style={{ color: t.color }} placeholder="Plot label…" />
                      : <span className="flex-1 text-sm font-bold" style={{ color: t.color }}>{t.label}</span>}
                    {canEdit && (
                      <div className="flex gap-1 ml-auto items-center">
                        {THREAD_COLORS.map(c => (
                          <button key={c} onClick={() => updateThread(t.id, 'color', c)} className="w-3.5 h-3.5 rounded-full border-2 transition-all" style={{ background: c, borderColor: t.color === c ? 'white' : 'transparent' }} />
                        ))}
                        <button onClick={() => removeThread(t.id)} className="ml-2 text-surface-500 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-3 bg-surface-800/20">
                    <Field label="Summary">
                      <Textarea value={t.summary} onChange={e => updateThread(t.id, 'summary', e.target.value)} rows={2} placeholder="The core conflict for this storyline…" readOnly={!canEdit} />
                    </Field>
                    <Field label="Story Beats">
                      <Textarea value={t.beats} onChange={e => updateThread(t.id, 'beats', e.target.value)} rows={4} placeholder={"1. Opening image\n2. Inciting incident\n3. Escalation…"} readOnly={!canEdit} />
                    </Field>
                  </div>
                </div>
              ))}
              {canEdit && (
                <button onClick={addThread} className="w-full py-3.5 rounded-2xl border border-dashed border-surface-700 text-surface-500 hover:border-red-500/40 hover:text-red-400 text-sm font-semibold transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Plot Thread
                </button>
              )}
              {!f.plot_threads.length && (
                <div className="text-center py-12 text-surface-500">
                  <GitBranch size={30} className="mx-auto mb-3 opacity-25" />
                  <p className="text-sm">No plot threads yet.</p>
                  <p className="text-xs mt-1 text-surface-600">Add your A, B, C plots and subplots.</p>
                </div>
              )}
            </div>
          )}

          {activeSection === 'timeline' && (
            <div className="space-y-5">
              <SectionHeader icon={Clock} label="Timeline" accent="#2dd4bf" subtitle="Chronological events — world history, story beats, or character backstory." />
              <div className="space-y-2">
                {f.timeline.map((ev, idx) => {
                  const ti = TIMELINE_TYPES.find(t => t.value === ev.type) || TIMELINE_TYPES[0];
                  return (
                    <div key={ev.id} className="flex gap-3">
                      <div className="flex flex-col items-center pt-3 w-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0 z-10" style={{ background: ti.color }} />
                        {idx < f.timeline.length - 1 && <div className="w-px flex-1 mt-1.5 mb-1.5" style={{ background: `${ti.color}40` }} />}
                      </div>
                      <div className="flex-1 mb-2 bg-surface-800/40 border border-surface-700/50 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-700/40">
                          {canEdit
                            ? <input value={ev.date} onChange={e => updateEvent(ev.id, 'date', e.target.value)} className="bg-transparent text-xs font-bold focus:outline-none w-28 placeholder-surface-600" style={{ color: '#2dd4bf' }} placeholder="Year / Date…" />
                            : <span className="text-xs font-bold" style={{ color: '#2dd4bf' }}>{ev.date || '—'}</span>}
                          {canEdit
                            ? <select value={ev.type} onChange={e => updateEvent(ev.id, 'type', e.target.value)} className="ml-auto bg-surface-700/60 rounded-lg text-xs px-2 py-0.5 border-0 focus:outline-none" style={{ color: ti.color }}>
                                {TIMELINE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            : <span className="ml-auto text-xs px-2" style={{ color: ti.color }}>{ti.label}</span>}
                          {canEdit && <button onClick={() => removeEvent(ev.id)} className="text-surface-600 hover:text-red-400 transition-colors ml-1"><Trash2 size={11} /></button>}
                        </div>
                        <div className="px-3 py-2">
                          {canEdit
                            ? <textarea value={ev.event} onChange={e => updateEvent(ev.id, 'event', e.target.value)} rows={2} placeholder="Describe the event…" className="w-full bg-transparent text-sm text-surface-200 placeholder-surface-600 focus:outline-none resize-none leading-relaxed" />
                            : <p className="text-sm text-surface-200 leading-relaxed">{ev.event}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {canEdit && (
                <button onClick={addEvent} className="w-full py-3.5 rounded-2xl border border-dashed border-surface-700 text-surface-500 hover:border-teal-500/40 hover:text-teal-400 text-sm font-semibold transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Timeline Event
                </button>
              )}
              {!f.timeline.length && (
                <div className="text-center py-12 text-surface-500">
                  <Clock size={30} className="mx-auto mb-3 opacity-25" />
                  <p className="text-sm">No events yet.</p>
                </div>
              )}
            </div>
          )}

          {activeSection === 'characters' && (
            <div className="space-y-4">
              <SectionHeader icon={Users} label="Characters" accent="#34d399" subtitle="Arcs, motivations, fears, and flaws for every major player." />
              {f.character_arcs.map(c => (
                <div key={c.id} className="bg-surface-800/40 border border-surface-700/50 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" onClick={() => toggleArc(c.id)}>
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-black text-emerald-400">{(c.name || '?')[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{c.name || <span className="text-surface-500 italic font-normal">Unnamed</span>}</p>
                      <p className="text-xs text-surface-500 truncate">{c.role || 'No role set'}</p>
                    </div>
                    {canEdit && (
                      <button onClick={e => { e.stopPropagation(); removeArc(c.id); }} className="text-surface-600 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={12} />
                      </button>
                    )}
                    {expandedArcs.has(c.id) ? <ChevronUp size={14} className="text-surface-500" /> : <ChevronDown size={14} className="text-surface-500" />}
                  </div>
                  {expandedArcs.has(c.id) && (
                    <div className="px-4 pb-4 space-y-3 border-t border-surface-700/40 pt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Name"><Input value={c.name} onChange={e => updateArc(c.id, 'name', e.target.value)} placeholder="Full name" readOnly={!canEdit} /></Field>
                        <Field label="Role"><Input value={c.role} onChange={e => updateArc(c.id, 'role', e.target.value)} placeholder="Protagonist, Antagonist…" readOnly={!canEdit} /></Field>
                      </div>
                      <Field label="Arc">
                        <Textarea value={c.arc} onChange={e => updateArc(c.id, 'arc', e.target.value)} rows={3} placeholder="Where do they start? What do they become?" readOnly={!canEdit} />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Want" hint="External goal"><Input value={c.want ?? ''} onChange={e => updateArc(c.id, 'want', e.target.value)} placeholder="What they pursue" readOnly={!canEdit} /></Field>
                        <Field label="Need" hint="Internal truth"><Input value={c.need ?? ''} onChange={e => updateArc(c.id, 'need', e.target.value)} placeholder="What they truly need" readOnly={!canEdit} /></Field>
                        <Field label="Fear"><Input value={c.fear ?? ''} onChange={e => updateArc(c.id, 'fear', e.target.value)} placeholder="Their deepest fear" readOnly={!canEdit} /></Field>
                        <Field label="Flaw"><Input value={c.flaw ?? ''} onChange={e => updateArc(c.id, 'flaw', e.target.value)} placeholder="Their core weakness" readOnly={!canEdit} /></Field>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {canEdit && (
                <button onClick={addArc} className="w-full py-3.5 rounded-2xl border border-dashed border-surface-700 text-surface-500 hover:border-emerald-500/40 hover:text-emerald-400 text-sm font-semibold transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Character
                </button>
              )}
              {!f.character_arcs.length && (
                <div className="text-center py-12 text-surface-500">
                  <Users size={30} className="mx-auto mb-3 opacity-25" />
                  <p className="text-sm">No characters yet.</p>
                </div>
              )}
            </div>
          )}

          {activeSection === 'episodes' && (
            <div className="space-y-4">
              <SectionHeader icon={Tv} label="Episodes" accent="#818cf8" subtitle="Episode-by-episode breakdown for series and episodic projects." />
              {f.episode_breakdown.map((ep, idx) => (
                <div key={ep.id} className="bg-surface-800/40 border border-surface-700/50 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-700/40" style={{ background: '#818cf812' }}>
                    <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Episode {idx + 1}</span>
                    {canEdit && <button onClick={() => removeEpisode(ep.id)} className="text-surface-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>}
                  </div>
                  <div className="p-4 space-y-3">
                    <Field label="Title"><Input value={ep.title} onChange={e => updateEpisode(ep.id, 'title', e.target.value)} placeholder="Episode title" readOnly={!canEdit} /></Field>
                    <Field label="Logline"><Input value={ep.logline} onChange={e => updateEpisode(ep.id, 'logline', e.target.value)} placeholder="One-line summary" readOnly={!canEdit} /></Field>
                    <Field label="Synopsis"><Textarea value={ep.synopsis} onChange={e => updateEpisode(ep.id, 'synopsis', e.target.value)} rows={4} placeholder="Episode story beats…" readOnly={!canEdit} /></Field>
                  </div>
                </div>
              ))}
              {canEdit && (
                <button onClick={addEpisode} className="w-full py-3.5 rounded-2xl border border-dashed border-surface-700 text-surface-500 hover:border-indigo-500/40 hover:text-indigo-400 text-sm font-semibold transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Episode
                </button>
              )}
              {!f.episode_breakdown.length && (
                <div className="text-center py-12 text-surface-500">
                  <Tv size={30} className="mx-auto mb-3 opacity-25" />
                  <p className="text-sm">No episodes yet.</p>
                </div>
              )}
            </div>
          )}

          {activeSection === 'market' && (
            <div className="space-y-5">
              <SectionHeader icon={BarChart2} label="Market" accent="#94a3b8" subtitle="Comparable titles, audience, distribution, and creative context." />
              <FieldCard>
                <Field label="Comparable Titles" hint="Comps sell the vision">
                  <Textarea value={f.comparable_titles ?? ''} onChange={e => setForm({ ...f, comparable_titles: e.target.value })} rows={3} placeholder={'"The Bear meets Normal People" — or list titles with brief context…'} readOnly={!canEdit} />
                </Field>
              </FieldCard>
              <FieldCard>
                <Field label="Market Context" hint="Target audience, why now, distribution">
                  <Textarea value={f.market_context ?? ''} onChange={e => setForm({ ...f, market_context: e.target.value })} rows={4} placeholder="Who is this for? Why is now the right time? What platforms fit?" readOnly={!canEdit} />
                </Field>
              </FieldCard>
              <FieldCard>
                <Field label="Writer / Director Bio" hint="Why this creator for this project">
                  <Textarea value={f.writer_bio ?? ''} onChange={e => setForm({ ...f, writer_bio: e.target.value })} rows={5} placeholder="Brief bio, relevant credits, unique perspective…" readOnly={!canEdit} />
                </Field>
              </FieldCard>
            </div>
          )}

          {activeSection === 'custom' && (
            <div className="space-y-5">
              <SectionHeader icon={Layers} label="Custom Sections" accent="#f472b6" subtitle="Add any additional sections your series bible needs." />
              {f.custom_sections.map((cs, idx) => (
                <div key={cs.id} className="bg-surface-800/40 border border-surface-700/50 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-700/40" style={{ background: '#f472b612' }}>
                    <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest mr-1">#{idx + 1}</span>
                    {canEdit
                      ? <input value={cs.title} onChange={e => updateCustom(cs.id, 'title', e.target.value)} className="flex-1 bg-transparent text-sm font-bold text-white placeholder-surface-500 focus:outline-none" placeholder="Section title…" />
                      : <span className="flex-1 text-sm font-bold text-white">{cs.title || 'Custom Section'}</span>}
                    {canEdit && (
                      <button onClick={() => removeCustom(cs.id)} className="text-surface-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                    )}
                  </div>
                  <div className="p-4">
                    <Textarea value={cs.content} onChange={e => updateCustom(cs.id, 'content', e.target.value)} rows={6} placeholder="Add any content relevant to your project…" readOnly={!canEdit} />
                  </div>
                </div>
              ))}
              {canEdit && (
                <button onClick={addCustom} className="w-full py-3.5 rounded-2xl border border-dashed border-surface-700 text-surface-500 hover:border-pink-500/40 hover:text-pink-400 text-sm font-semibold transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Custom Section
                </button>
              )}
              {!f.custom_sections.length && (
                <div className="text-center py-12 text-surface-500">
                  <Layers size={30} className="mx-auto mb-3 opacity-25" />
                  <p className="text-sm">No custom sections yet.</p>
                  <p className="text-xs mt-1 text-surface-600">Research, influences, production notes, or anything else.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
