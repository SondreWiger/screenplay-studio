'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isLocalMode } from '@/lib/supabase/electron-client';
import { getCachedById, putCached, getCachedByProject, cacheRows } from '@/lib/offline/db';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useFeatureAccess } from '@/components/FeatureGate';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { useProjectStore, usePresenceStore } from '@/lib/stores';
import { useRealtime } from '@/hooks/useRealtime';
import { useCrossToolSync } from '@/hooks/useCrossToolSync';
import { Avatar, LoadingPage, KeyboardShortcuts, Modal, Input, Textarea, Button, toast } from '@/components/ui';
import { useCommandPalette } from '@/components/ui/CommandPalette';
import { useRecentProjects } from '@/hooks/useRecentProjects';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useNotifications } from '@/hooks/useNotifications';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ShortcutPicker } from '@/components/sidebar/ShortcutPicker';
import { cn } from '@/lib/utils';
import { PAGE_LABELS, getPageSection } from '@/lib/pageLabels';
import { getNavCategories, type NavItem, type NavCategory } from '@/lib/navCategories';
import { sidebarIcons } from '@/components/sidebar/SidebarIcons';
import type { UserRole, UserPresence, SidebarSection } from '@/lib/types';
import { useSidebarLayout } from '@/hooks/useSidebarLayout';
import { usePreMiD } from '@/hooks/usePreMiD';
import { getDefaultOtherIcons, loadOtherIcons, saveOtherIcons } from '@/lib/sidebarDefaults';
import { useTranslation } from '@/components/TranslationProvider';
import dynamic from 'next/dynamic';
import { ZEN_MODE_EVENT } from '@/lib/zen-mode';
import { getTourState, endTour } from '@/lib/tourState';
import type { UsageIntent } from '@/lib/types';
const SidebarCustomiser = dynamic(() => import('@/components/SidebarCustomiser'), { ssr: false });
const PopoutButton = dynamic(() => import('@/components/PopoutButton').then(m => ({ default: m.PopoutButton })), { ssr: false });
const PopoutBar = dynamic(() => import('@/components/PopoutButton').then(m => ({ default: m.PopoutBar })), { ssr: false });
const GuidedTour = dynamic(() => import('@/components/GuidedTour').then(m => ({ default: m.GuidedTour })), { ssr: false });
const TourBanner = dynamic(() => import('@/components/TourBanner'), { ssr: false });



export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { user, loading: authLoading } = useAuth();
  const { isStudio } = useProFeatures();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPopout = searchParams?.get('popout') === '1';
  const { currentProject, setCurrentProject, members, setMembers } = useProjectStore();
  const { onlineUsers } = usePresenceStore();
  const { updatePresence } = useRealtime(params.id);
  useCrossToolSync(params.id);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templatePublic, setTemplatePublic] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
// Determine if the user has Studio access so we don't collapse Studio sections
const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
  const defaults = ['Collaboration'];
  if (!isStudio) defaults.push('Studio');
  return new Set(defaults);
});
  const [showCustomiser, setShowCustomiser] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  // Guided tour — show banner if paused, full tour if active
  const [showTour, setShowTour] = useState(false);
  const [showTourBanner, setShowTourBanner] = useState(false);
  const [tourIntent, setTourIntent] = useState<UsageIntent>('writer');
  const [tourProjectId, setTourProjectId] = useState<string | null>(null);

  useEffect(() => {
    const saved = getTourState();
    if (saved?.active) {
      // Tour is active — show full overlay
      setTourIntent(saved.intent);
      setTourProjectId(saved.projectId);
      setShowTour(true);
    } else if (saved && !saved.active && saved.step > 0) {
      // Tour is paused — show floating banner
      setTourIntent(saved.intent);
      setTourProjectId(saved.projectId);
      setShowTourBanner(true);
    }
  }, []);
  // "Other Tools" folder — persona-aware demotion of less-relevant sidebar items
  const [otherIcons, setOtherIcons] = useState<Set<string>>(new Set());
  const [otherExpanded, setOtherExpanded] = useState(false);
  const { canUse: canUseFeature } = useFeatureAccess();

  // Auto-collapse sidebar on tablet-sized screens (768-1024px)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setSidebarCollapsed(true);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Quick Access shortcuts (personal, localStorage)
  type Shortcut = { id: string; type: 'script' | 'document'; title: string };
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [showShortcutPicker, setShowShortcutPicker] = useState(false);
  const [pickerAnchorEl, setPickerAnchorEl] = useState<HTMLButtonElement | null>(null);
  const shortcutAddBtnRef = useRef<HTMLButtonElement>(null);
  const scKey = user?.id && params.id ? `qaccess:${user.id}:${params.id}` : null;

  useEffect(() => {
    if (!scKey) return;
    try {
      const raw = localStorage.getItem(scKey);
      if (raw) setShortcuts(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [scKey]);

  const saveShortcuts = (next: Shortcut[]) => {
    setShortcuts(next);
    if (scKey) {
      try { localStorage.setItem(scKey, JSON.stringify(next)); } catch { /* ignore */ }
    }
  };

  const toggleShortcut = (item: Shortcut) => {
    const already = shortcuts.some((s) => s.id === item.id);
    saveShortcuts(already ? shortcuts.filter((s) => s.id !== item.id) : [...shortcuts, item]);
    setShowShortcutPicker(false);
  };

  const shortcutHref = (sc: Shortcut) =>
    sc.type === 'script'
      ? `/projects/${params.id}/script?script_id=${sc.id}`
      : `/projects/${params.id}/documents?doc=${sc.id}`;

  const isShortcutActive = (sc: Shortcut) => {
    const base = sc.type === 'script' ? `/projects/${params.id}/script` : `/projects/${params.id}/documents`;
    return pathname === base;
  };

  const toggleSection = (cat: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  useCommandPalette();
  const { recordView } = useRecentProjects();

  const handleSaveTemplate = async () => {
    if (!currentProject || !user) return;
    setSavingTemplate(true);
    try {
      const supabase = createClient();
      await supabase.from('project_templates').insert({
        user_id: user.id,
        name: templateName.trim() || currentProject.title || 'Template',
        description: templateDesc.trim() || null,
        project_type: currentProject.project_type || 'film',
        script_type: currentProject.script_type || null,
        genre: currentProject.genre?.[0] || null,
        format: currentProject.format || null,
        structure_snapshot: { genre: currentProject.genre, format: currentProject.format },
        is_public: templatePublic,
      });
      toast.success('Template saved!');
      setShowSaveTemplate(false);
      setTemplateName('');
      setTemplateDesc('');
      setTemplatePublic(false);
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  useNotifications(user?.id);
  const { t } = useTranslation();

  // Sidebar label translation helper
  const sidebarLabelMap: Record<string, string> = {
    'Overview': 'sidebar.overview',
    'Script': 'sidebar.script',
    'Episodes': 'sidebar.episodes',
    'Arc Planner': 'sidebar.arc_planner',
    'Beat Sheet': 'sidebar.beat_sheet',
    'Notes Rounds': 'sidebar.notes_rounds',
    'Ideas': 'sidebar.ideas',
    'Documents': 'sidebar.documents',
    'Characters': 'sidebar.characters',
    'Locations': 'sidebar.locations',
    'Scenes': 'sidebar.scenes',
    'Schedule': 'sidebar.schedule',
    'Budget': 'sidebar.budget',
    'Breakdown': 'sidebar.breakdown',
    'Call Sheet': 'sidebar.call_sheet',
    'War Room': 'sidebar.war_room',
    'On Set': 'sidebar.on_set',
    'Day Pack': 'sidebar.day_pack',
    'Continuity': 'sidebar.continuity',
    'Table Read': 'sidebar.table_read',
    'Camera Reports': 'sidebar.camera_reports',
    'Corkboard': 'sidebar.corkboard',
    'Shot List': 'sidebar.shot_list',
    'Mood Board': 'sidebar.mood_board',
    'Storyboard': 'sidebar.storyboard',
    'Mind Map': 'sidebar.mind_map',
    'Crew View': 'sidebar.crew_view',
    'Gear': 'sidebar.gear',
    'Chat': 'sidebar.chat',
    'Comments': 'sidebar.comments',
    'Team': 'sidebar.team',
    'Casting': 'sidebar.casting',
    'Export': 'sidebar.export',
    'Share': 'sidebar.share',
    'Submissions': 'sidebar.submissions',
    'Press Kit': 'sidebar.press_kit',
    'Custom Branding': 'sidebar.branding',
    'Analytics': 'sidebar.analytics',
    'Reports': 'sidebar.reports',
    'Treatment': 'sidebar.treatment',
    'Script Coverage': 'sidebar.coverage',
    'Script Analysis': 'sidebar.analysis',
    'Revisions': 'sidebar.revisions',
    'Showcase': 'sidebar.showcase',
    'Settings': 'sidebar.settings',
    'Write': 'sidebar.write',
    'Plan': 'sidebar.plan',
    'Creative': 'sidebar.creative',
    'Finish': 'sidebar.finish',
    'Studio': 'sidebar.studio',
  };
  const sidebarT = (label: string) => {
    const key = sidebarLabelMap[label];
    return key ? t(key) : label;
  };
  const sidebarCatT = (label: string) => {
    if (label === 'On Set') return t('sidebar.on_set_cat');
    if (label === 'Team') return t('sidebar.team_cat');
    return sidebarT(label);
  };

  // Merge user + project accent color (project overrides user)
  const effectiveAccent = currentProject?.accent_color || user?.accent_color || 'brand';

  // Merge user + project sidebar tabs (project overrides user)
  const effectiveSidebarTabs: Record<string, boolean> | null =
    currentProject?.sidebar_tabs
      ? { ...(user?.sidebar_tabs || {}), ...currentProject.sidebar_tabs }
      : user?.sidebar_tabs || null;

  // Close mobile menu on navigation
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  // Apply accent color to document
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', effectiveAccent);
    return () => { document.documentElement.removeAttribute('data-accent'); };
  }, [effectiveAccent]);

  // Apply UI theme (soft pastels)
  useEffect(() => {
    const theme = user?.ui_theme || null;
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }
    return () => { document.documentElement.removeAttribute('data-theme'); };
  }, [user?.ui_theme]);

  // ⌘+B toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(v => !v);
      }
      // ⌘K handled globally by CommandPaletteProvider — no need to duplicate
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      if (navigator.onLine) {
        router.replace('/auth/login');
        return;
      }
      // If offline, continue to fetchProjectData() to load from local cache
    }
    fetchProjectData();
  }, [params.id, user, authLoading]);

  useEffect(() => {
    if (user && params.id) {
      updatePresence(getPageSection(pathname, params.id));
    }
  }, [pathname]);

  // Initialise Other Tools from localStorage (or smart defaults)
  useEffect(() => {
    if (!user || !currentProject) return;
    const saved = loadOtherIcons(user.id, params.id);
    if (saved) {
      setOtherIcons(saved);
    } else {
      const defaults = getDefaultOtherIcons(
        user.usage_intent,
        currentProject.project_type,
        currentProject.script_type,
      );
      setOtherIcons(defaults);
    }
  }, [user?.id, currentProject?.id, params.id]);

  // Browser tab title
  useEffect(() => {
    if (!currentProject) return;
    const pageKey = getPageSection(pathname, params.id);
    const pageLabel = PAGE_LABELS[pageKey] || pageKey;
    document.title = `${pageLabel} — ${currentProject.title} — Screenplay Studio`;
    return () => { document.title = 'Screenplay Studio'; };
  }, [pathname, currentProject?.title, params.id]);

  // Discord Rich Presence via PreMiD
  const currentPageSlug = getPageSection(pathname, params.id);
  const currentToolLabel = PAGE_LABELS[currentPageSlug] ?? 'Overview';
  usePreMiD({
    projectName: currentProject?.title ?? null,
    currentTool: currentToolLabel,
    active: !!currentProject,
  });

  useEffect(() => {
    const handler = (e: Event) => setZenMode((e as CustomEvent<boolean>).detail);
    window.addEventListener(ZEN_MODE_EVENT, handler);
    return () => window.removeEventListener(ZEN_MODE_EVENT, handler);
  }, []);

  const fetchProjectData = async () => {
    try {
      if (isLocalMode()) {
        const project = await getCachedById('projects', params.id);
        if (!project) {
          router.push('/dashboard');
          return;
        }
        setCurrentProject(project as any);
        const cachedMembers = await getCachedByProject('project_members', params.id);
        setMembers(cachedMembers as any[] || []);
        recordView({
          id: (project as any).id,
          title: (project as any).title || 'Untitled',
          cover_url: (project as any).cover_url ?? null,
          project_type: (project as any).project_type,
        });
        setLoading(false);
        return;
      }
      // When offline in cloud mode, fall back to IndexedDB cache
      if (!navigator.onLine) {
        const project = await getCachedById('projects', params.id);
        if (!project) {
          router.push('/dashboard');
          return;
        }
        setCurrentProject(project as any);
        const cachedMembers = await getCachedByProject('project_members', params.id);
        setMembers(cachedMembers as any[] || []);
        recordView({
          id: (project as any).id,
          title: (project as any).title || 'Untitled',
          cover_url: (project as any).cover_url ?? null,
          project_type: (project as any).project_type,
        });
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [projectRes, membersRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', params.id).single(),
        supabase.from('project_members').select('*, profile:profiles!user_id(*)').eq('project_id', params.id),
      ]);

      if (projectRes.error) {
        console.error('Error fetching project:', projectRes.error.message);
        router.push('/dashboard');
        return;
      }

      // Guard: only allow access if user owns or is a member of this project
      const isMember = (membersRes.data || []).some((m: { user_id: string }) => m.user_id === user?.id);
      const isOwner = projectRes.data?.created_by === user?.id;
      if (!isMember && !isOwner) {
        console.warn('Access denied: not a member or owner');
        router.push('/dashboard');
        return;
      }

      setCurrentProject(projectRes.data);
      setMembers(membersRes.data || []);
      // Cache project and members locally
      putCached('projects', projectRes.data).catch(() => {});
      if (membersRes.data && membersRes.data.length > 0) {
        cacheRows('project_members', membersRes.data).catch(() => {});
      }
      // Record this project as recently viewed
      recordView({
        id: projectRes.data.id,
        title: projectRes.data.title || 'Untitled',
        cover_url: projectRes.data.cover_url ?? null,
        project_type: projectRes.data.project_type,
      });
    } catch (err) {
      console.error('Unexpected error fetching project data:', err);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Derive role + admin flag from state (safe before conditional returns; defaults to false when data not yet loaded)
  const currentUserRole: UserRole | undefined =
    members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : undefined);
  const isViewer = currentUserRole === 'viewer';
  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';

  // Must be called unconditionally before any early returns
  const { applyLayout, saveLayout, resetLayout, activeScope } = useSidebarLayout(params.id, user?.id, isAdmin);

  if (authLoading || (!user && loading)) return <LoadingPage />;
  if (!currentProject) return null;

  // Popout Mode
  // When ?popout=1 is present, render a chrome-free shell for second screens
  if (isPopout) {
    const currentPageKey = pathname.split('/').pop() || 'overview';
    const currentPageLabel = PAGE_LABELS[currentPageKey] || currentProject.title;
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: 'rgb(var(--surface-950))' }}>
        <main className="flex-1 overflow-y-auto pb-10">
          {children}
        </main>
        <PopoutBar
          projectId={params.id}
          projectTitle={currentProject.title}
          pageLabel={currentPageLabel}
        />
      </div>
    );
  }

  const showProduction = user?.show_production_tools !== false;
  const showCollab = user?.show_collaboration !== false;
  
  // Check if this is a content creator project
  const isContentCreator = ['youtube', 'tiktok', 'podcast', 'educational', 'livestream'].includes(currentProject.project_type || '') 
    || ['youtube', 'tiktok'].includes(currentProject.script_type || '');
  
  // Check if this is a TV production project
  const isTvProduction = currentProject.project_type === 'tv_production';
  // Check if this is an audio drama project
  const isAudioDrama = currentProject.project_type === 'audio_drama' || currentProject.script_type === 'audio_drama';
  // Check if this is a stage play / theatre project
  const isStagePlay = currentProject.project_type === 'stage_play' || currentProject.script_type === 'stageplay';
  // Check if this is an episodic series project
  const isEpisodic = currentProject.script_type === 'episodic';

  const navCategories = getNavCategories(params.id, {
    isTvProduction, isAudioDrama, isStagePlay, isContentCreator, isEpisodic, isViewer,
  });

  // Sidebar Layout Customisation helpers
  const navToSections = (cats: NavCategory[]): SidebarSection[] =>
    cats.map(cat => ({
      id: cat.id || (cat.category ? cat.category.toLowerCase().replace(/[\s/]+/g, '-') : 'root'),
      label: cat.category,
      items: cat.items.map(i => ({ icon: i.icon, label: i.label })),
    }));

  const applyNavLayout = (cats: NavCategory[]): NavCategory[] => {
    const sections = applyLayout(navToSections(cats));
    const byIcon = new Map<string, NavItem>();
    for (const cat of cats) for (const item of cat.items) byIcon.set(item.icon, item);
    return sections.map(section => ({
      id: section.id,
      category: section.label,
      items: section.items
        .filter(si => !si.hidden)
        .map(si => {
          const orig = byIcon.get(si.icon);
          return orig ? { ...orig, label: si.label } : null;
        })
        .filter(Boolean) as NavItem[],
    })).filter(cat => cat.category === '' || cat.items.length > 0);
  };

  const effectiveNavCategories = applyNavLayout(navCategories);

  // All sections including hidden items — for the customiser panel so
  // users can re-show items they previously hid
  const isItemVisible = (item: NavItem) => {
    // Check sidebar tab preferences (overview and settings always visible)
    if (effectiveSidebarTabs && item.icon !== 'overview' && item.icon !== 'settings') {
      if (effectiveSidebarTabs[item.icon] === false) return false;
    }
    // Feature flag gating — hide if flag is disabled or user lacks insider tier
    if (item.icon !== 'overview' && item.icon !== 'settings') {
      if (!canUseFeature(item.icon)) return false;
    }
    // Studio items: visible only to Studio subscribers
    if (item.studio) return isStudio;
    if (item.always) return true;
    if (item.production && showProduction) return true;
    if (item.collab && showCollab) return true;
    return false;
  };

  // Flat lists for backward compat
  const allItems = effectiveNavCategories.flatMap(c => c.items);
  const visibleItems = allItems.filter(isItemVisible);
  const hiddenItems = allItems.filter(i => !i.always && !i.studio && !isItemVisible(i));

  // Only pass to the customiser items that CAN currently appear (pass feature/permission gates).
  // This prevents users from configuring items they'd never actually see.
  // Items they've explicitly hidden still show up (with hidden:true) so they can re-enable them.
  const customisableSections = applyLayout(
    navToSections(
      navCategories.map(cat => ({ ...cat, items: cat.items.filter(isItemVisible) }))
    )
  );

  const icons = sidebarIcons;

  // Active page label for mobile header
  const currentPage = getPageSection(pathname, params.id);
  const pageLabel = PAGE_LABELS[currentPage] || currentProject.title;

  // Sidebar content — shared between desktop and mobile
  const sidebarContent = (mobile?: boolean) => (
    <>
      {/* ── Project Header ───────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-surface-800/60 px-4 py-4">
        {/* Ambient glow behind the logo */}
        <div className="absolute -top-6 -left-4 w-24 h-24 rounded-full blur-2xl opacity-30 pointer-events-none"
          style={{ background: isTvProduction ? '#d97706' : isAudioDrama ? '#7c3aed' : 'rgb(var(--brand-600))' }} />

        <div className="relative flex items-center gap-3">
          <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="shrink-0 group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white transition-[box-shadow] duration-200"
              style={{
                background: isTvProduction
                  ? 'linear-gradient(135deg, #d97706, #92400e)'
                  : isAudioDrama
                  ? 'linear-gradient(135deg, #7c3aed, #4c1d95)'
                  : 'linear-gradient(135deg, rgb(var(--brand-500)), rgb(var(--brand-700)))',
                boxShadow: isTvProduction
                  ? '0 2px 12px rgba(217, 119, 6, 0.5)'
                  : isAudioDrama
                  ? '0 2px 12px rgba(124, 58, 237, 0.5)'
                  : '0 2px 12px rgb(var(--brand-600) / 0.5)',
              }}
            >
              {currentProject.title[0].toUpperCase()}
            </div>
          </Link>

          {(mobile || !sidebarCollapsed) && (
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-white truncate leading-tight">{currentProject.title}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                {/* Status dot */}
                <span className={cn(
                  'inline-block w-1.5 h-1.5 rounded-full',
                  currentProject.status === 'production' ? 'bg-green-400' :
                  (currentProject.status === 'development' || currentProject.status === 'pre_production') ? 'bg-amber-400' :
                  (currentProject.status === 'completed' || currentProject.status === 'post_production') ? 'bg-blue-400' : 'bg-surface-500'
                )} />
                <p className="text-[10px] font-medium text-surface-500 capitalize">{currentProject.status.replace('_', ' ')}</p>
                {isViewer && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide"
                    style={{ background: 'rgb(var(--brand-900) / 0.6)', color: 'rgb(var(--brand-400))' }}>
                    View Only
                  </span>
                )}
              </div>
            </div>
          )}

          {mobile && (
            <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-900/5 transition-colors ml-auto">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {effectiveNavCategories.map((cat, catIdx) => {
          const catVisibleItems = cat.items.filter(isItemVisible).filter(i => !otherIcons.has(i.icon));
          if (catVisibleItems.length === 0) return null;
          const isSectionCollapsed = cat.category ? collapsedSections.has(cat.category) : false;
          const hasActivePage = catVisibleItems.some(
            (item) => pathname === item.href || (item.href !== `/projects/${params.id}` && pathname.startsWith(item.href))
          );
          return (
            <div key={cat.category || catIdx} className={catIdx > 0 ? 'pt-1' : ''}>
              {cat.category && (mobile || !sidebarCollapsed) && (
                <button
                  onClick={() => toggleSection(cat.category)}
                  className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 rounded-lg group transition-colors hover:bg-surface-900/3"
                >
                  <span className={cn(
                    'text-[9px] font-black uppercase tracking-[0.2em] transition-colors',
                    hasActivePage ? 'text-brand-500' : 'text-surface-600 group-hover:text-surface-400'
                  )}>
                    {sidebarCatT(cat.category)}
                  </span>
                  <svg
                    className={cn(
                      'w-2.5 h-2.5 transition-transform duration-200',
                      isSectionCollapsed ? '' : 'rotate-90',
                      hasActivePage ? 'text-brand-500' : 'text-surface-700 group-hover:text-surface-500'
                    )}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              {cat.category && (!mobile && sidebarCollapsed) && catIdx > 0 && (
                <div className="my-2 mx-2 border-t border-surface-800/50" />
              )}
              {(!isSectionCollapsed || !cat.category || sidebarCollapsed) && (
                <div className="space-y-0.5">
                  {catVisibleItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== `/projects/${params.id}` && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'sidebar-link',
                          isActive && 'active',
                          !mobile && sidebarCollapsed && 'justify-center px-2'
                        )}
                        title={!mobile && sidebarCollapsed ? item.label : undefined}
                      >
                        {icons[item.icon]}
                        {(mobile || !sidebarCollapsed) && <span>{sidebarT(item.label)}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Other Tools — visible but demoted items for this user's intent */}
        {(() => {
          const otherItems = visibleItems.filter(i => otherIcons.has(i.icon));
          if (otherItems.length === 0 || !(mobile || !sidebarCollapsed)) return null;
          return (
            <div className="mt-1">
              <button
                onClick={() => setOtherExpanded(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-surface-600 hover:text-surface-300 transition-colors text-[10px] font-semibold uppercase tracking-wider group"
              >
                <svg className={cn('w-3 h-3 transition-transform duration-200 shrink-0', otherExpanded && 'rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Other Tools
                <span className="ml-auto text-[9px] tabular-nums opacity-60">{otherItems.length}</span>
              </button>
              {otherExpanded && (
                <div className="space-y-0.5 mt-0.5">
                  {otherItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== `/projects/${params.id}` && pathname.startsWith(item.href));
                    return (
                      <div key={item.href} className="flex items-center group/other">
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn('sidebar-link flex-1 min-w-0', isActive && 'active')}
                          title={item.label}
                        >
                          {icons[item.icon]}
                          <span>{sidebarT(item.label)}</span>
                        </Link>
                        <button
                          onClick={() => {
                            const next = new Set(otherIcons);
                            next.delete(item.icon);
                            setOtherIcons(next);
                            if (user) saveOtherIcons(user.id, params.id, next);
                          }}
                          title="Move to main sidebar"
                          className="mr-1 p-1 rounded opacity-0 group-hover/other:opacity-100 transition-opacity text-surface-600 hover:text-brand-500"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* More Tools (hidden items) */}
        {hiddenItems.length > 0 && (mobile || !sidebarCollapsed) && (
          <div className="mt-2">
            <button
              onClick={() => setShowMoreTools(!showMoreTools)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-surface-600 hover:text-surface-300 transition-colors text-[10px] font-semibold uppercase tracking-wider"
            >
              <svg className={cn('w-3 h-3 transition-transform duration-200', showMoreTools && 'rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
              More Tools
            </button>
            {showMoreTools && hiddenItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== `/projects/${params.id}` && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn('sidebar-link opacity-50 hover:opacity-100', isActive && 'active opacity-100')}
                  title={item.label}
                >
                  {icons[item.icon]}
                  <span>{sidebarT(item.label)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* ── Quick Access ───────────────────────────────────────── */}
      {(mobile || !sidebarCollapsed) && (
        <div className="border-t border-surface-800/50 px-2 py-2">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-surface-600">Quick Access</span>
            <button
              ref={shortcutAddBtnRef}
              onClick={(e) => { setPickerAnchorEl(e.currentTarget); setShowShortcutPicker(true); }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-surface-500 hover:text-brand-500 hover:bg-surface-800 transition-colors text-[10px]"
              title="Pin scripts or documents here"
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Pin
            </button>
          </div>

          {shortcuts.length === 0 ? (
            <button
              onClick={(e) => { setPickerAnchorEl(e.currentTarget); setShowShortcutPicker(true); }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg border border-dashed border-surface-800 text-surface-600 hover:border-surface-700 hover:text-surface-400 transition-colors text-xs"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Pin a script or document…
            </button>
          ) : (
            <div className="space-y-0.5">
              {shortcuts.map((sc) => {
                const active = isShortcutActive(sc);
                return (
                  <div key={sc.id} className="group/sc flex items-center">
                    <Link
                      href={shortcutHref(sc)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs transition-colors',
                        active ? 'bg-brand-500/10 text-brand-500' : 'text-surface-400 hover:text-white hover:bg-surface-900/5'
                      )}
                      title={`Open ${sc.type === 'script' ? 'script' : 'document'}: ${sc.title}`}
                    >
                      {sc.type === 'script' ? (
                        <svg className={cn('w-3.5 h-3.5 shrink-0', active ? 'text-brand-500' : 'text-surface-500')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      ) : (
                        <svg className={cn('w-3.5 h-3.5 shrink-0', active ? 'text-brand-500' : 'text-surface-500')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                      )}
                      <span className="truncate">{sc.title}</span>
                    </Link>
                    <button
                      onClick={() => saveShortcuts(shortcuts.filter((s) => s.id !== sc.id))}
                      className="mr-0.5 p-1 rounded opacity-0 group-hover/sc:opacity-100 text-surface-600 hover:text-red-400 transition-opacity shrink-0"
                      title="Unpin"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Quick Access picker portal ────────────────────────────── */}
      {(mobile || !sidebarCollapsed) && onlineUsers.length > 0 && (
        <div className="border-t border-surface-800/50 px-3 py-3">
          <p className="meta-label mb-2 px-2">Live now</p>
          <div className="space-y-1">
            {onlineUsers.slice(0, 4).map((presence) => {
              const p = presence as UserPresence & { full_name?: string; email?: string; avatar_url?: string };
              const cp = p.current_page || '';
              const pl = PAGE_LABELS[cp] || (cp === params.id ? 'Overview' : cp || 'Overview');
              return (
                <div key={p.user_id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface-900/4 transition-colors">
                  <Avatar src={p.avatar_url} name={p.full_name || p.email} size="sm" online />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-surface-300 truncate leading-tight">{p.full_name || p.email || 'User'}</p>
                    <p className="text-[9px] text-green-400 truncate">{pl}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapse Toggle (desktop only) */}
      {!mobile && (
        <div className="border-t border-surface-800/50 p-2 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-1">
              <OfflineIndicator />
              {isFeatureEnabled('directMessages') && (
                <Link href="/messages" className="p-2 rounded-lg text-surface-600 hover:text-white hover:bg-surface-900/5 transition-colors" title="Messages">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </Link>
              )}
              <button
                onClick={() => { setTemplateName(currentProject?.title || ''); setShowSaveTemplate(true); }}
                className="p-2 rounded-lg text-surface-600 hover:text-white hover:bg-surface-900/5 transition-colors"
                title="Save as template"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
              </button>
              <NotificationBell />
              <PopoutButton
                projectId={params.id}
                pageLabel={PAGE_LABELS[getPageSection(pathname, params.id)]}
              />
              <button
                onClick={() => setShowCustomiser(true)}
                className="p-2 rounded-lg text-surface-600 hover:text-white hover:bg-surface-900/5 transition-colors"
                title="Customise sidebar"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
            title={sidebarCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
            className={cn(
              'flex items-center justify-center p-2 rounded-lg text-surface-600 hover:text-white hover:bg-surface-900/5 transition-colors',
              sidebarCollapsed && 'w-full'
            )}
          >
            <svg className={cn('w-4 h-4 transition-transform duration-300', sidebarCollapsed && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'rgb(var(--surface-950))' }}>

      {/* Quick Access picker */}
      {showShortcutPicker && (
        <ShortcutPicker
          projectId={params.id}
          userId={user?.id}
          shortcuts={shortcuts}
          onToggle={toggleShortcut}
          onClose={() => setShowShortcutPicker(false)}
          anchorEl={pickerAnchorEl}
        />
      )}

      {/* Mobile header */}
      {!zenMode && (
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden"
        style={{ backgroundColor: 'rgb(var(--surface-950))', borderBottom: '1px solid rgb(var(--brand-900) / 0.5)' }}
      >
        {/* Gradient top line on mobile too */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--brand-500) / 0.4), transparent)' }} />
        <div className="flex items-center justify-between px-3 py-2.5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-900/8 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, rgb(var(--brand-500)), rgb(var(--brand-700)))' }}
            >
              {currentProject.title[0].toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-white truncate">{pageLabel}</span>
            {isViewer && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0"
                style={{ background: 'rgb(var(--brand-900) / 0.6)', color: 'rgb(var(--brand-400))' }}>
                View Only
              </span>
            )}
          </div>
          <NotificationBell />
        </div>
      </div>
      )}

      {/* Mobile sidebar overlay */}
      {!zenMode && mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 w-72 z-50 flex flex-col md:hidden animate-slide-right"
            style={{ background: 'rgb(var(--surface-950))', borderRight: '1px solid rgb(var(--brand-900) / 0.4)' }}
          >
            {sidebarContent(true)}
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      {!zenMode && (
      <aside
        className={cn(
          'hidden md:flex flex-col transition-[width] duration-300',
          sidebarCollapsed ? 'w-14' : 'w-60'
        )}
        style={{ background: 'rgb(var(--surface-950))', borderRight: '1px solid rgb(var(--brand-900) / 0.35)' }}
      >
        {sidebarContent(false)}
      </aside>
      )}

      {/* Main Content */}
      <main className={cn('flex-1 overflow-y-auto bg-surface-950', zenMode ? 'pt-0' : 'pt-12 md:pt-0')}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>

      {/* Keyboard shortcuts modal */}
      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Sidebar customiser */}
      {showCustomiser && (
        <SidebarCustomiser
          sections={customisableSections}
          onClose={() => setShowCustomiser(false)}
          onSave={async (sections, scope) => {
            try {
              await saveLayout(sections, scope);
            } catch (e) {
              toast.error('Failed to save layout — please try again.');
              throw e;
            }
          }}
          onReset={resetLayout}
          isAdmin={isAdmin}
          activeScope={activeScope}
        />
      )}

      {/* Save as Template modal */}
      <Modal isOpen={showSaveTemplate} onClose={() => setShowSaveTemplate(false)} title="Save as Template" size="sm">
        <div className="space-y-4">
          <Input
            label="Template Name"
            value={templateName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemplateName(e.target.value)}
            placeholder={currentProject?.title || 'My Template'}
            autoFocus
          />
          <Textarea
            label="Description (optional)"
            value={templateDesc}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTemplateDesc(e.target.value)}
            placeholder="What's this template for?"
            rows={2}
          />
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={templatePublic}
              onChange={e => setTemplatePublic(e.target.checked)}
              className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-surface-300">Make public (visible to all users)</span>
          </label>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="ghost" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} loading={savingTemplate}>Save Template</Button>
          </div>
        </div>
      </Modal>

      {/* Guided Tour — resumed from sessionStorage */}
      {showTour && (
        <GuidedTour
          onComplete={() => { endTour(); setShowTour(false); }}
          usageIntent={tourIntent}
          projectId={tourProjectId}
        />
      )}

      {/* Tour Banner — shown when tour is paused, lets user explore freely */}
      {showTourBanner && !showTour && (
        <TourBanner
          onResume={() => {
            setShowTourBanner(false);
            setShowTour(true);
          }}
        />
      )}
    </div>
  );
}
