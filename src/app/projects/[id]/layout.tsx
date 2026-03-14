'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useFeatureAccess } from '@/components/FeatureGate';
import { useProjectStore, usePresenceStore } from '@/lib/stores';
import { useRealtime } from '@/hooks/useRealtime';
import { Avatar, Badge, LoadingPage, KeyboardShortcuts, Modal, Input, Textarea, Button, toast } from '@/components/ui';
import { useCommandPalette } from '@/components/ui/CommandPalette';
import { useRecentProjects } from '@/hooks/useRecentProjects';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useNotifications } from '@/hooks/useNotifications';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { cn, getInitials } from '@/lib/utils';
import type { Project, ProjectMember, Profile, UserRole, UserPresence, SidebarSection } from '@/lib/types';
import { useSidebarLayout } from '@/hooks/useSidebarLayout';
import { usePreMiD } from '@/hooks/usePreMiD';
import { getDefaultOtherIcons, loadOtherIcons, saveOtherIcons } from '@/lib/sidebarDefaults';
import dynamic from 'next/dynamic';
const SidebarCustomiser = dynamic(() => import('@/components/SidebarCustomiser'), { ssr: false });
const PopoutButton = dynamic(() => import('@/components/PopoutButton').then(m => ({ default: m.PopoutButton })), { ssr: false });
const PopoutBar = dynamic(() => import('@/components/PopoutButton').then(m => ({ default: m.PopoutBar })), { ssr: false });

const PAGE_LABELS: Record<string, string> = {
  overview: 'Overview', script: 'Script Editor', documents: 'Documents',
  characters: 'Characters', locations: 'Locations', scenes: 'Scenes',
  episodes: 'Episodes',
  'arc-planner': 'Arc Planner',
  shots: 'Shot List', schedule: 'Schedule', ideas: 'Ideas',
  budget: 'Budget', team: 'Team', settings: 'Settings',
  mindmap: 'Mind Map', moodboard: 'Mood Board', messages: 'Messages', chat: 'Chat',
  storyboard: 'Storyboard', onset: 'On Set', comments: 'Comments',
  showcase: 'Showcase', share: 'Share Portal', analytics: 'Analytics',
  export: 'Advanced Export', casting: 'Casting', actors: 'Actors', 'ai-analysis': 'Script Analysis',
  // New pages
  corkboard: 'Corkboard', 'beat-sheet': 'Beat Sheet', invoice: 'Invoice Generator',
  submissions: 'Submission Tracker', breakdown: 'Production Breakdown',
  // Production tools
  continuity: 'Continuity Sheet', 'call-sheet': 'Call Sheet',
  dood: 'Day Out of Days', coverage: 'Script Coverage',
  'table-read': 'Table Read', 'camera-reports': 'Camera Reports',
  'safety-plan': 'Safety Plan', treatment: 'Treatment',
  'production-overview': 'Production Overview',
  // Broadcast Pre-Production
  editorial: 'Editorial Board', contacts: 'Contacts', checklist: 'Pre-Show Checklist',
  // Gear & scheduling
  gear: 'Gear', 'schedule-pack': 'Day Pack', 'one-liner': 'One-liner',
  // Broadcast Production
  rundown: 'Rundown', stories: 'Stories', 'wire-desk': 'Wire Desk',
  sources: 'Sources', graphics: 'Graphics / CG', prompter: 'Prompter',
  'as-run': 'As-Run Log', 'broadcast-settings': 'Broadcast Settings',
  // Audio Drama
  'sound-design': 'Sound Design', 'voice-cast': 'Voice Cast',
  'vision-mixer': 'Vision Mixer', 'master-control': 'Master Control',
  'stream-ingest': 'Stream Ingest', output: 'Output / Restream',
  multiviewer: 'Multiviewer', comms: 'Comms / Intercom',
  'mos-devices': 'MOS Devices',
  // Stage Play / Theatre
  ensemble: 'Ensemble',
  cues: 'Cue Sheet',
  'production-team': 'Production Team',
  rehearsal: 'Rehearsal',
};

/**
 * Returns the top-level section slug for a project pathname.
 * e.g. /projects/abc/characters/uuid → 'characters'
 * Prevents UUIDs from sub-routes leaking into labels and presence.
 */
function getPageSection(pathname: string, projectId: string): string {
  const prefix = `/projects/${projectId}/`;
  if (!pathname.startsWith(prefix)) return 'overview';
  const first = pathname.slice(prefix.length).split('/')[0];
  return first || 'overview';
}

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { user, loading: authLoading } = useAuth();
  const { isPro } = useProFeatures();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPopout = searchParams?.get('popout') === '1';
  const { currentProject, setCurrentProject, members, setMembers } = useProjectStore();
  const { onlineUsers } = usePresenceStore();
  const { updatePresence } = useRealtime(params.id);
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
  // Pre-collapse heavy categories so the sidebar doesn't feel overwhelming
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['Pro', 'Collaboration']));
  const [showCustomiser, setShowCustomiser] = useState(false);
  // "Other Tools" folder — persona-aware demotion of less-relevant sidebar items
  const [otherIcons, setOtherIcons] = useState<Set<string>>(new Set());
  const [otherExpanded, setOtherExpanded] = useState(false);
  const { canUse: canUseFeature } = useFeatureAccess();

  const toggleSection = (cat: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const palette = useCommandPalette();
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
      router.replace('/auth/login');
      return;
    }
    fetchProjectData();
  }, [params.id, user, authLoading]);

  useEffect(() => {
    if (user && params.id) {
      updatePresence(getPageSection(pathname, params.id));
    }
  }, [pathname]);

  // ── Initialise Other Tools from localStorage (or smart defaults) ──
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

  // ── Browser tab title ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentProject) return;
    const pageKey = getPageSection(pathname, params.id);
    const pageLabel = PAGE_LABELS[pageKey] || pageKey;
    document.title = `${pageLabel} — ${currentProject.title} — Screenplay Studio`;
    return () => { document.title = 'Screenplay Studio'; };
  }, [pathname, currentProject?.title, params.id]);
  // ─────────────────────────────────────────────────────────────────

  // ── Discord Rich Presence via PreMiD ──────────────────────────────
  const currentPageSlug = getPageSection(pathname, params.id);
  const currentToolLabel = PAGE_LABELS[currentPageSlug] ?? 'Overview';
  usePreMiD({
    projectName: currentProject?.title ?? null,
    currentTool: currentToolLabel,
    active: !!currentProject,
  });
  // ─────────────────────────────────────────────────────────────────

  const fetchProjectData = async () => {
    try {
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

  // ── Popout Mode ─────────────────────────────────────────────────────
  // When ?popout=1 is present, render a chrome-free shell for second screens
  if (isPopout) {
    const currentPageKey = pathname.split('/').pop() || 'overview';
    const currentPageLabel = PAGE_LABELS[currentPageKey] || currentProject.title;
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: '#070710' }}>
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

  type NavItem = { label: string; href: string; icon: string; always?: boolean; production?: boolean; collab?: boolean; contentCreator?: boolean; filmOnly?: boolean; pro?: boolean };
  type NavCategory = { id?: string; category: string; items: NavItem[] };

  const navCategories: NavCategory[] = isTvProduction ? [
    // Broadcast TV Navigation — Pre-production first
    {
      category: '',
      items: [
        { label: 'Overview', href: `/projects/${params.id}`, icon: 'overview', always: true },
      ],
    },
    {
      category: 'Pre-Production',
      items: [
        { label: 'Wire Desk', href: `/projects/${params.id}/wire-desk`, icon: 'wiredesk', always: true },
        { label: 'Editorial Board', href: `/projects/${params.id}/editorial`, icon: 'editorial', always: true },
        { label: 'Stories', href: `/projects/${params.id}/stories`, icon: 'stories', always: true },
        { label: 'Contacts', href: `/projects/${params.id}/contacts`, icon: 'contacts', always: true },
        { label: 'Schedule', href: `/projects/${params.id}/schedule`, icon: 'schedule', always: true },
        { label: 'Checklist', href: `/projects/${params.id}/checklist`, icon: 'checklist', always: true },
        { label: 'Documents', href: `/projects/${params.id}/documents`, icon: 'documents', always: true },
      ],
    },
    {
      category: 'Scripting',
      items: [
        { label: 'Script Editor', href: `/projects/${params.id}/script`, icon: 'script', always: true },
        { label: 'Prompter', href: `/projects/${params.id}/prompter`, icon: 'prompter', always: true },
        { label: 'Graphics / CG', href: `/projects/${params.id}/graphics`, icon: 'graphics', always: true },
      ],
    },
    {
      category: 'On Air',
      items: [
        { label: 'Rundown', href: `/projects/${params.id}/rundown`, icon: 'rundown', always: true },
        { label: 'Vision Mixer', href: `/projects/${params.id}/vision-mixer`, icon: 'visionmixer', always: true },
        { label: 'Master Control', href: `/projects/${params.id}/master-control`, icon: 'mastercontrol', always: true },
        { label: 'Sources', href: `/projects/${params.id}/sources`, icon: 'sources', always: true },
      ],
    },
    {
      category: 'Distribution',
      items: [
        { label: 'Stream Ingest', href: `/projects/${params.id}/stream-ingest`, icon: 'streamingest', always: true },
        { label: 'Output', href: `/projects/${params.id}/output`, icon: 'output', always: true },
      ],
    },
    {
      category: 'Monitoring',
      items: [
        { label: 'Multiviewer', href: `/projects/${params.id}/multiviewer`, icon: 'multiviewer', always: true },
        { label: 'As-Run Log', href: `/projects/${params.id}/as-run`, icon: 'asrun', always: true },
      ],
    },
    {
      category: 'Infrastructure',
      items: [
        { label: 'Comms', href: `/projects/${params.id}/comms`, icon: 'comms', always: true },
        { label: 'MOS Devices', href: `/projects/${params.id}/mos-devices`, icon: 'mosdevices', always: true },
      ],
    },
    {
      category: 'Collaboration',
      items: [
        { label: 'Chat', href: `/projects/${params.id}/chat`, icon: 'chat', collab: true },
        { label: 'Team', href: `/projects/${params.id}/team`, icon: 'team', collab: true },
      ],
    },
    ...(!isViewer ? [{
      category: '',
      items: [
        { label: 'Settings', href: `/projects/${params.id}/settings`, icon: 'settings', always: true },
      ],
    }] : []),
  ] : isAudioDrama ? [
    // Audio Drama Navigation
    {
      category: '',
      items: [
        { label: 'Overview', href: `/projects/${params.id}`, icon: 'overview', always: true },
      ],
    },
    {
      category: 'Writing',
      items: [
        { label: 'Episodes', href: `/projects/${params.id}/episodes`, icon: 'episodes', always: true },
        { label: 'Script', href: `/projects/${params.id}/script`, icon: 'script', always: true },
        { label: 'Arc Planner', href: `/projects/${params.id}/arc-planner`, icon: 'arc-planner', always: true },
        { label: 'Documents', href: `/projects/${params.id}/documents`, icon: 'documents', always: true },
        { label: 'Ideas', href: `/projects/${params.id}/ideas`, icon: 'ideas', always: true },
      ],
    },
    {
      category: 'Cast & World',
      items: [
        { label: 'Voice Cast', href: `/projects/${params.id}/voice-cast`, icon: 'voice-cast', always: true },
        { label: 'Characters', href: `/projects/${params.id}/characters`, icon: 'characters', always: true },
        { label: 'Locations', href: `/projects/${params.id}/locations`, icon: 'locations', always: true },
        { label: 'Mind Map', href: `/projects/${params.id}/mindmap`, icon: 'mindmap', always: true },
        { label: 'Mood Board', href: `/projects/${params.id}/moodboard`, icon: 'moodboard', always: true },
      ],
    },
    {
      category: 'Sound',
      items: [
        { label: 'Sound Design', href: `/projects/${params.id}/sound-design`, icon: 'sound-design', always: true },
        { label: 'Scenes', href: `/projects/${params.id}/scenes`, icon: 'scenes', production: true },
        { label: 'Schedule', href: `/projects/${params.id}/schedule`, icon: 'schedule', production: true },
      ],
    },
    {
      category: 'Collaboration',
      items: [
        { label: 'Chat', href: `/projects/${params.id}/chat`, icon: 'chat', collab: true },
        { label: 'Comments', href: `/projects/${params.id}/comments`, icon: 'comments', collab: true },
        { label: 'Team', href: `/projects/${params.id}/team`, icon: 'team', collab: true },
        { label: 'Crew View', href: `/projects/${params.id}/crew`, icon: 'crew', always: true },
      ],
    },
    {
      category: 'Pro',
      items: [
        { label: 'Share Portal', href: `/projects/${params.id}/share`, icon: 'share', pro: true },
        { label: 'Export', href: `/projects/${params.id}/export`, icon: 'export', pro: true },
        { label: 'Script Analysis', href: `/projects/${params.id}/ai-analysis`, icon: 'ai', pro: true },
        { label: 'Revisions', href: `/projects/${params.id}/revisions`, icon: 'revisions', pro: true },
        { label: 'Casting', href: `/projects/${params.id}/casting`, icon: 'casting', pro: true },
        { label: 'Actors', href: `/projects/${params.id}/actors`, icon: 'actors', pro: true },
        { label: 'Press Kit', href: `/projects/${params.id}/press-kit`, icon: 'presskit', pro: true },
      ],
    },
    ...(!isViewer ? [{
      category: '',
      items: [
        { label: 'Settings', href: `/projects/${params.id}/settings`, icon: 'settings', always: true },
      ],
    }] : []),
  ] : isStagePlay ? [
    // Stage Play / Theatre Navigation
    {
      category: '',
      items: [
        { label: 'Overview', href: `/projects/${params.id}`, icon: 'overview', always: true },
      ],
    },
    {
      category: 'Writing',
      items: [
        { label: 'Arc Planner', href: `/projects/${params.id}/arc-planner`, icon: 'arc-planner', always: true },
        { label: 'Script', href: `/projects/${params.id}/script`, icon: 'script', always: true },
        { label: 'Notes Rounds', href: `/projects/${params.id}/notes-rounds`, icon: 'notes-rounds', always: true },
        { label: 'Documents', href: `/projects/${params.id}/documents`, icon: 'documents', always: true },
        { label: 'Ideas', href: `/projects/${params.id}/ideas`, icon: 'ideas', always: true },
      ],
    },
    {
      category: 'Company',
      items: [
        { label: 'Ensemble', href: `/projects/${params.id}/ensemble`, icon: 'cast', always: true },
        { label: 'Characters', href: `/projects/${params.id}/characters`, icon: 'characters', always: true },
        { label: 'Production Team', href: `/projects/${params.id}/production-team`, icon: 'team', always: true },
        { label: 'Mood Board', href: `/projects/${params.id}/moodboard`, icon: 'moodboard', always: true },
      ],
    },
    {
      category: 'Production',
      items: [
        { label: 'One-liner', href: `/projects/${params.id}/one-liner`, icon: 'one-liner', always: true },
        { label: 'Cue Sheet', href: `/projects/${params.id}/cues`, icon: 'checklist', always: true },
        { label: 'Scenes', href: `/projects/${params.id}/scenes`, icon: 'scenes', production: true },
        { label: 'Schedule', href: `/projects/${params.id}/schedule`, icon: 'schedule', production: true },
        { label: 'Budget', href: `/projects/${params.id}/budget`, icon: 'budget', production: true },
      ],
    },
    {
      category: 'Collaboration',
      items: [
        { label: 'Chat', href: `/projects/${params.id}/chat`, icon: 'chat', collab: true },
        { label: 'Comments', href: `/projects/${params.id}/comments`, icon: 'comments', collab: true },
        { label: 'Team', href: `/projects/${params.id}/team`, icon: 'team', collab: true },
        { label: 'Crew View', href: `/projects/${params.id}/crew`, icon: 'crew', always: true },
      ],
    },
    {
      category: 'Pro',
      items: [
        { label: 'Share Portal', href: `/projects/${params.id}/share`, icon: 'share', pro: true },
        { label: 'Export', href: `/projects/${params.id}/export`, icon: 'export', pro: true },
        { label: 'Script Analysis', href: `/projects/${params.id}/ai-analysis`, icon: 'ai', pro: true },
        { label: 'Revisions', href: `/projects/${params.id}/revisions`, icon: 'revisions', pro: true },
        { label: 'Casting', href: `/projects/${params.id}/casting`, icon: 'casting', pro: true },
        { label: 'Actors', href: `/projects/${params.id}/actors`, icon: 'actors', pro: true },
        { label: 'Press Kit', href: `/projects/${params.id}/press-kit`, icon: 'presskit', pro: true },
      ],
    },
    ...(!isViewer ? [{
      category: '',
      items: [
        { label: 'Settings', href: `/projects/${params.id}/settings`, icon: 'settings', always: true },
      ],
    }] : []),
  ] : isContentCreator ? [
    // Content Creator Navigation
    {
      category: '',
      items: [
        { label: 'Overview', href: `/projects/${params.id}`, icon: 'overview', always: true },
      ],
    },
    {
      category: 'Script',
      items: [
        { label: 'Script', href: `/projects/${params.id}/script`, icon: 'script', always: true },
        { label: 'Ideas', href: `/projects/${params.id}/ideas`, icon: 'ideas', always: true },
        { label: 'Documents', href: `/projects/${params.id}/documents`, icon: 'documents', always: true },
      ],
    },
    {
      category: 'Video',
      items: [
        { label: 'Thumbnails', href: `/projects/${params.id}/thumbnails`, icon: 'thumbnails', always: true },
        { label: 'B-Roll', href: `/projects/${params.id}/broll`, icon: 'shots', always: true },
        { label: 'Storyboard', href: `/projects/${params.id}/storyboard`, icon: 'storyboard', always: true },
        { label: 'Mood Board', href: `/projects/${params.id}/moodboard`, icon: 'moodboard', always: true },
        { label: 'Mind Map', href: `/projects/${params.id}/mindmap`, icon: 'mindmap', always: true },
        { label: 'Shot List', href: `/projects/${params.id}/shots`, icon: 'shots', always: true },
      ],
    },
    {
      category: 'Publish',
      items: [
        { label: 'SEO & Metadata', href: `/projects/${params.id}/seo`, icon: 'seo', always: true },
        { label: 'Sponsors', href: `/projects/${params.id}/sponsors`, icon: 'sponsors', always: true },
        { label: 'Checklist', href: `/projects/${params.id}/checklist`, icon: 'checklist', always: true },
        { label: 'Schedule', href: `/projects/${params.id}/schedule`, icon: 'schedule', production: true },
      ],
    },
    {
      category: 'Collaboration',
      items: [
        { label: 'Chat', href: `/projects/${params.id}/chat`, icon: 'chat', collab: true },
        { label: 'Comments', href: `/projects/${params.id}/comments`, icon: 'comments', collab: true },
        { label: 'Team', href: `/projects/${params.id}/team`, icon: 'team', collab: true },
      ],
    },
    {
      category: 'Pro',
      items: [
        { label: 'Share Portal', href: `/projects/${params.id}/share`, icon: 'share', pro: true },
        { label: 'Analytics', href: `/projects/${params.id}/analytics`, icon: 'analytics', pro: true },
        { label: 'Revisions', href: `/projects/${params.id}/revisions`, icon: 'revisions', pro: true },
        { label: 'Export', href: `/projects/${params.id}/export`, icon: 'export', pro: true },
        { label: 'Script Analysis', href: `/projects/${params.id}/ai-analysis`, icon: 'ai', pro: true },
        { label: 'Client Review', href: `/projects/${params.id}/review`, icon: 'review', pro: true },
        { label: 'Brand Kit', href: `/projects/${params.id}/branding`, icon: 'branding', pro: true },
        { label: 'Casting', href: `/projects/${params.id}/casting`, icon: 'casting', pro: true },
        { label: 'Actors', href: `/projects/${params.id}/actors`, icon: 'actors', pro: true },
      ],
    },
    ...(!isViewer ? [{
      category: '',
      items: [
        { label: 'Settings', href: `/projects/${params.id}/settings`, icon: 'settings', always: true },
      ],
    }] : []),
  ] : [
    // Film/TV Navigation
    {
      category: '',
      items: [
        { label: 'Overview', href: `/projects/${params.id}`, icon: 'overview', always: true },
      ],
    },
    {
      category: 'Write',
      items: [
        ...(isEpisodic ? [{ label: 'Episodes', href: `/projects/${params.id}/episodes`, icon: 'episodes', always: true }] : []),
        { label: 'Script', href: `/projects/${params.id}/script`, icon: 'script', always: true },
        { label: 'Arc Planner', href: `/projects/${params.id}/arc-planner`, icon: 'arc-planner', always: true },
        { label: 'Beat Sheet', href: `/projects/${params.id}/beat-sheet`, icon: 'beat-sheet', always: true },
        { label: 'Notes Rounds', href: `/projects/${params.id}/notes-rounds`, icon: 'notes-rounds', always: true },
        { label: 'Ideas', href: `/projects/${params.id}/ideas`, icon: 'ideas', always: true },
        { label: 'Documents', href: `/projects/${params.id}/documents`, icon: 'documents', always: true },
      ],
    },
    {
      category: 'World',
      items: [
        { label: 'Characters', href: `/projects/${params.id}/characters`, icon: 'characters', always: true },
        { label: 'Locations', href: `/projects/${params.id}/locations`, icon: 'locations', production: true },
        { label: 'Mood Board', href: `/projects/${params.id}/moodboard`, icon: 'moodboard', always: true },
        { label: 'Storyboard', href: `/projects/${params.id}/storyboard`, icon: 'storyboard', always: true },
        { label: 'Mind Map', href: `/projects/${params.id}/mindmap`, icon: 'mindmap', always: true },
      ],
    },
    {
      id: 'plan',
      category: 'Plan',
      items: [
        { label: 'One-liner', href: `/projects/${params.id}/one-liner`, icon: 'one-liner', always: true },
        { label: 'Scenes', href: `/projects/${params.id}/scenes`, icon: 'scenes', production: true },
        { label: 'Corkboard', href: `/projects/${params.id}/corkboard`, icon: 'corkboard', production: true },
        { label: 'Shot List', href: `/projects/${params.id}/shots`, icon: 'shots', always: true },
        { label: 'Schedule', href: `/projects/${params.id}/schedule`, icon: 'schedule', production: true },
        { label: 'Budget', href: `/projects/${params.id}/budget`, icon: 'budget', production: true },
        { label: 'Breakdown', href: `/projects/${params.id}/breakdown`, icon: 'breakdown', production: true },
        { label: 'Call Sheet', href: `/projects/${params.id}/call-sheet`, icon: 'call-sheet', production: true },
      ],
    },
    {
      id: 'on-set',
      category: 'On Set',
      items: [
        { label: 'War Room', href: `/projects/${params.id}/production-overview`, icon: 'production-overview', production: true },
        { label: 'On Set', href: `/projects/${params.id}/onset`, icon: 'onset', production: true },
        { label: 'Gear', href: `/projects/${params.id}/gear`, icon: 'gear', production: true },
        { label: 'Day Pack', href: `/projects/${params.id}/schedule-pack`, icon: 'schedule-pack', production: true },
        { label: 'Continuity', href: `/projects/${params.id}/continuity`, icon: 'continuity', production: true },
        { label: 'Day Out of Days', href: `/projects/${params.id}/dood`, icon: 'dood', production: true },
        { label: 'Table Read', href: `/projects/${params.id}/table-read`, icon: 'table-read', production: true },
        { label: 'Camera Reports', href: `/projects/${params.id}/camera-reports`, icon: 'camera-reports', production: true },
        { label: 'Safety Plan', href: `/projects/${params.id}/safety-plan`, icon: 'safety-plan', production: true },
      ],
    },
    {
      category: 'Team',
      items: [
        { label: 'Crew View', href: `/projects/${params.id}/crew`, icon: 'crew', always: true },
        { label: 'Chat', href: `/projects/${params.id}/chat`, icon: 'chat', collab: true },
        { label: 'Comments', href: `/projects/${params.id}/comments`, icon: 'comments', collab: true },
        { label: 'Team', href: `/projects/${params.id}/team`, icon: 'team', collab: true },
        { label: 'Casting', href: `/projects/${params.id}/casting`, icon: 'casting', pro: true },
        { label: 'Actors', href: `/projects/${params.id}/actors`, icon: 'actors', pro: true },
      ],
    },
    {
      category: 'Deliver',
      items: [
        { label: 'Export', href: `/projects/${params.id}/export`, icon: 'export', pro: true },
        { label: 'Share Portal', href: `/projects/${params.id}/share`, icon: 'share', pro: true },
        { label: 'Client Review', href: `/projects/${params.id}/review`, icon: 'review', pro: true },
        { label: 'Submissions', href: `/projects/${params.id}/submissions`, icon: 'submissions', pro: true },
        { label: 'Press Kit', href: `/projects/${params.id}/press-kit`, icon: 'presskit', pro: true },
        { label: 'Custom Branding', href: `/projects/${params.id}/branding`, icon: 'branding', pro: true },
        { label: 'Invoice', href: `/projects/${params.id}/invoice`, icon: 'invoice', pro: true },
        { label: 'Analytics', href: `/projects/${params.id}/analytics`, icon: 'analytics', pro: true },
        { label: 'Reports', href: `/projects/${params.id}/reports`, icon: 'reports', pro: true },
      ],
    },
    {
      category: 'Review',
      items: [
        { label: 'Treatment', href: `/projects/${params.id}/treatment`, icon: 'treatment', pro: true },
        { label: 'Script Coverage', href: `/projects/${params.id}/coverage`, icon: 'coverage', pro: true },
        { label: 'Script Analysis', href: `/projects/${params.id}/ai-analysis`, icon: 'ai', pro: true },
        { label: 'Revisions', href: `/projects/${params.id}/revisions`, icon: 'revisions', pro: true },
      ],
    },
    ...(!isViewer ? [{
      category: '',
      items: [
        { label: 'Showcase', href: `/projects/${params.id}/showcase`, icon: 'showcase', always: true },
        { label: 'Settings', href: `/projects/${params.id}/settings`, icon: 'settings', always: true },
      ],
    }] : []),
  ];

  // ── Sidebar Layout Customisation helpers ────────────────────────
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
  const allNavSections = applyLayout(navToSections(navCategories));

  const isItemVisible = (item: NavItem) => {
    // Check sidebar tab preferences (overview and settings always visible)
    if (effectiveSidebarTabs && item.icon !== 'overview' && item.icon !== 'settings') {
      if (effectiveSidebarTabs[item.icon] === false) return false;
    }
    // Feature flag gating — hide if flag is disabled or user lacks insider tier
    if (item.icon !== 'overview' && item.icon !== 'settings') {
      if (!canUseFeature(item.icon)) return false;
    }
    // Pro items: visible only to Pro subscribers or per-project Pro
    if (item.pro) return isPro || currentProject?.pro_enabled === true;
    if (item.always) return true;
    if (item.production && showProduction) return true;
    if (item.collab && showCollab) return true;
    return false;
  };

  // Flat lists for backward compat
  const allItems = effectiveNavCategories.flatMap(c => c.items);
  const visibleItems = allItems.filter(isItemVisible);
  // Never show Pro items in "More Tools" for free users — DaVinci model: Pro is invisible, not locked
  const hiddenItems = allItems.filter(i => !i.always && !i.pro && !isItemVisible(i));

  // Only pass to the customiser items that CAN currently appear (pass feature/permission gates).
  // This prevents users from configuring items they'd never actually see.
  // Items they've explicitly hidden still show up (with hidden:true) so they can re-enable them.
  const customisableSections = applyLayout(
    navToSections(
      navCategories.map(cat => ({ ...cat, items: cat.items.filter(isItemVisible) }))
    )
  );

  const icons: Record<string, React.ReactNode> = {
    episodes: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /><circle cx="12" cy="12" r="2" strokeWidth={1.5} /></svg>,
    'arc-planner': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    overview: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    script: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    documents: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>,
    characters: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    mindmap: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="5" r="2.5" strokeWidth={1.5}/><circle cx="5" cy="18" r="2.5" strokeWidth={1.5}/><circle cx="19" cy="18" r="2.5" strokeWidth={1.5}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7.5v3m0 0l-5.5 5m5.5-5l5.5 5"/></svg>,
    moodboard: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zm10-2a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" /></svg>,
    locations: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    scenes: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
    shots: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    schedule: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    ideas: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    chat: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>,
    budget: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    team: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    settings: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    storyboard: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 15h6v4H4v-4zm10-2h6v6h-6v-6z" /></svg>,
    onset: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    comments: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>,
    showcase: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
    // Content Creator Icons
    thumbnails: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    seo: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    sponsors: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    checklist: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    // Pro feature icons
    share: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
    analytics: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    versions: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    export: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    // New Pro feature icons
    ai: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5m-4.75-11.396c.251.023.501.05.75.082M12 3v5.386m0 0a2.25 2.25 0 001.5 2.122M12 8.386a2.25 2.25 0 00-1.5 2.122M5 14.5l3.5 3.5L12 14.5l3.5 3.5L19 14.5m-7 3.5V21" /></svg>,
    review: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    branding: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>,
    revisions: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>,
    reports: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" /></svg>,
    casting: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
    actors: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
    // TV / Broadcast Production Icons
    rundown: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>,
    visionmixer: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="2" y="3" width="9" height="8" rx="1" strokeWidth={1.5}/><rect x="13" y="3" width="9" height="8" rx="1" strokeWidth={1.5}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.5 14v3m0 0l-3 3m3-3l3 3M17.5 14v3m0 0l-3 3m3-3l3 3"/></svg>,
    mastercontrol: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/></svg>,
    streamingest: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>,
    output: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>,
    multiviewer: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="2" y="3" width="9" height="7" rx="1" strokeWidth={1.5}/><rect x="13" y="3" width="9" height="7" rx="1" strokeWidth={1.5}/><rect x="2" y="13" width="9" height="7" rx="1" strokeWidth={1.5}/><rect x="13" y="13" width="9" height="7" rx="1" strokeWidth={1.5}/></svg>,
    comms: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>,
    mosdevices: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/></svg>,
    stories: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" /></svg>,
    wiredesk: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>,
    sources: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" /></svg>,
    prompter: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12H12m-8.25 5.25h16.5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75l4.5 3.75-4.5 3.75V10.5z" /></svg>,
    graphics: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>,
    asrun: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>,
    // New feature icons
    corkboard: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6h5v5H3V6zm7 0h5v5h-5V6zm7 0h4v5h-4V6zM3 14h5v4H3v-4zm7 0h5v4h-5v-4zm7 0h4v4h-4v-4z" /></svg>,
    'beat-sheet': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h18M3 12h18M3 19h18" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 5v14M12 5v7M17 5v14" /></svg>,
    submissions: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    invoice: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l2 2 4-4M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6M9 10h3" /></svg>,
    breakdown: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M10 4v16M6 4v4M18 4v4" /><rect x="3" y="4" width="18" height="16" rx="1" strokeWidth={1.5} /></svg>,
    continuity: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h10M4 18h7" /><circle cx="19" cy="16" r="3" strokeWidth={1.5} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 15v1l.75.75" /></svg>,
    'call-sheet': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6M9 16h4" /></svg>,
    dood: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="4" width="18" height="16" rx="1" strokeWidth={1.5} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M3 8h18M3 12h4M3 16h4" /></svg>,
    coverage: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>,
    'table-read': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth={1.5} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7v5l3.5 3.5" /></svg>,
    'camera-reports': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>,
    'safety-plan': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
    treatment: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>,
    'production-overview': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>,
    // Audio Drama icons
    'sound-design': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg>,
    'voice-cast': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
    crew: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    presskit: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>,
    gear: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
    'schedule-pack': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l2 2 4-4" /></svg>,
    // Development tools
    'notes-rounds': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    'one-liner': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 6h18M3 14h11M3 18h7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 14l2 2 4-4" /></svg>,
  };

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
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white transition-all duration-200 group-hover:scale-105"
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
                    hasActivePage ? 'text-[#FF5F1F]' : 'text-surface-600 group-hover:text-surface-400'
                  )}>
                    {cat.category}
                  </span>
                  <svg
                    className={cn(
                      'w-2.5 h-2.5 transition-transform duration-200',
                      isSectionCollapsed ? '' : 'rotate-90',
                      hasActivePage ? 'text-[#FF5F1F]' : 'text-surface-700 group-hover:text-surface-500'
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
                        {(mobile || !sidebarCollapsed) && <span>{item.label}</span>}
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
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-surface-600 hover:text-surface-300 transition-all text-[10px] font-semibold uppercase tracking-wider group"
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
                          <span>{item.label}</span>
                        </Link>
                        <button
                          onClick={() => {
                            const next = new Set(otherIcons);
                            next.delete(item.icon);
                            setOtherIcons(next);
                            if (user) saveOtherIcons(user.id, params.id, next);
                          }}
                          title="Move to main sidebar"
                          className="mr-1 p-1 rounded opacity-0 group-hover/other:opacity-100 transition-opacity text-surface-600 hover:text-[#FF5F1F]"
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
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-surface-600 hover:text-surface-300 transition-all text-[10px] font-semibold uppercase tracking-wider"
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
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Online Users */}
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
              <Link href="/messages" className="p-2 rounded-lg text-surface-600 hover:text-white hover:bg-surface-900/5 transition-all" title="Messages">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </Link>
              <button
                onClick={() => { setTemplateName(currentProject?.title || ''); setShowSaveTemplate(true); }}
                className="p-2 rounded-lg text-surface-600 hover:text-white hover:bg-surface-900/5 transition-all"
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
                className="p-2 rounded-lg text-surface-600 hover:text-white hover:bg-surface-900/5 transition-all"
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
              'flex items-center justify-center p-2 rounded-lg text-surface-600 hover:text-white hover:bg-surface-900/5 transition-all',
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
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#070710' }}>

      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden"
        style={{ backgroundColor: 'rgba(7, 7, 16, 0.95)', borderBottom: '1px solid rgb(var(--brand-900) / 0.5)', backdropFilter: 'blur(16px)' }}
      >
        {/* Gradient top line on mobile too */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--brand-500) / 0.4), transparent)' }} />
        <div className="flex items-center justify-between px-3 py-2.5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-900/8 transition-all"
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

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 w-72 z-50 flex flex-col md:hidden animate-slide-right"
            style={{ background: '#0a0a16', borderRight: '1px solid rgb(var(--brand-900) / 0.4)' }}
          >
            {sidebarContent(true)}
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'w-14' : 'w-60'
        )}
        style={{ background: '#0a0a16', borderRight: '1px solid rgb(var(--brand-900) / 0.35)' }}
      >
        {sidebarContent(false)}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-12 md:pt-0" style={{ background: '#070710' }}>
        {children}
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
              className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-[#FF5F1F] focus:ring-[#FF5F1F]"
            />
            <span className="text-sm text-surface-300">Make public (visible to all users)</span>
          </label>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="ghost" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} loading={savingTemplate}>Save Template</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
