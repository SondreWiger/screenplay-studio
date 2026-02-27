'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useFeatureAccess } from '@/components/FeatureGate';
import { useProjectStore, usePresenceStore } from '@/lib/stores';
import { useRealtime } from '@/hooks/useRealtime';
import { Avatar, Badge, LoadingPage } from '@/components/ui';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useNotifications } from '@/hooks/useNotifications';
import { cn, getInitials } from '@/lib/utils';
import type { Project, ProjectMember, Profile, UserRole, UserPresence } from '@/lib/types';

const PAGE_LABELS: Record<string, string> = {
  overview: 'Overview', script: 'Script Editor', documents: 'Documents',
  characters: 'Characters', locations: 'Locations', scenes: 'Scenes',
  shots: 'Shot List', schedule: 'Schedule', ideas: 'Ideas',
  budget: 'Budget', team: 'Team', settings: 'Settings',
  mindmap: 'Mind Map', moodboard: 'Mood Board', messages: 'Messages', chat: 'Chat',
  storyboard: 'Storyboard', onset: 'On Set', comments: 'Comments',
  showcase: 'Showcase', share: 'Share Portal', analytics: 'Analytics',
  export: 'Advanced Export', casting: 'Casting', 'ai-analysis': 'Script Analysis',
  // Broadcast Production
  rundown: 'Rundown', stories: 'Stories', 'wire-desk': 'Wire Desk',
  sources: 'Sources', graphics: 'Graphics / CG', prompter: 'Prompter',
  'as-run': 'As-Run Log', 'broadcast-settings': 'Broadcast Settings',
  'vision-mixer': 'Vision Mixer', 'master-control': 'Master Control',
  'stream-ingest': 'Stream Ingest', output: 'Output / Restream',
  multiviewer: 'Multiviewer', comms: 'Comms / Intercom',
  'mos-devices': 'MOS Devices',
};

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
  const { currentProject, setCurrentProject, members, setMembers } = useProjectStore();
  const { onlineUsers } = usePresenceStore();
  const { updatePresence } = useRealtime(params.id);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const { canUse: canUseFeature } = useFeatureAccess();

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
      const page = pathname.split('/').pop() || 'overview';
      updatePresence(page);
    }
  }, [pathname]);

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
    } catch (err) {
      console.error('Unexpected error fetching project data:', err);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || (!user && loading)) return <LoadingPage />;
  if (!currentProject) return null;

  // Current user's role in this project
  const currentUserRole: UserRole | undefined =
    members.find((m) => m.user_id === user?.id)?.role
    || (currentProject.created_by === user?.id ? 'owner' : undefined);
  const isViewer = currentUserRole === 'viewer';

  const showProduction = user?.show_production_tools !== false;
  const showCollab = user?.show_collaboration !== false;
  
  // Check if this is a content creator project
  const isContentCreator = ['youtube', 'tiktok', 'podcast', 'educational', 'livestream'].includes(currentProject.project_type || '') 
    || ['youtube', 'tiktok'].includes(currentProject.script_type || '');
  
  // Check if this is a TV production project
  const isTvProduction = currentProject.project_type === 'tv_production';

  type NavItem = { label: string; href: string; icon: string; always?: boolean; production?: boolean; collab?: boolean; contentCreator?: boolean; filmOnly?: boolean; pro?: boolean };
  type NavCategory = { category: string; items: NavItem[] };

  // Build navigation based on project type
  const navCategories: NavCategory[] = isTvProduction ? [
    // Broadcast Production Navigation — real NRCS + broadcast tools
    {
      category: '',
      items: [
        { label: 'Overview', href: `/projects/${params.id}`, icon: 'overview', always: true },
      ],
    },
    {
      category: 'Content',
      items: [
        { label: 'Stories', href: `/projects/${params.id}/stories`, icon: 'stories', always: true },
        { label: 'Rundown', href: `/projects/${params.id}/rundown`, icon: 'rundown', always: true },
        { label: 'Wire Desk', href: `/projects/${params.id}/wire-desk`, icon: 'wiredesk', always: true },
        { label: 'Scripts', href: `/projects/${params.id}/script`, icon: 'script', always: true },
      ],
    },
    {
      category: 'Production',
      items: [
        { label: 'Vision Mixer', href: `/projects/${params.id}/vision-mixer`, icon: 'visionmixer', always: true },
        { label: 'Master Control', href: `/projects/${params.id}/master-control`, icon: 'mastercontrol', always: true },
        { label: 'Sources', href: `/projects/${params.id}/sources`, icon: 'sources', always: true },
        { label: 'Graphics', href: `/projects/${params.id}/graphics`, icon: 'graphics', always: true },
        { label: 'Prompter', href: `/projects/${params.id}/prompter`, icon: 'prompter', always: true },
      ],
    },
    {
      category: 'Streaming',
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
        { label: 'Documents', href: `/projects/${params.id}/documents`, icon: 'documents', always: true },
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
      ],
    },
    ...(!isViewer ? [{
      category: '',
      items: [
        { label: 'Settings', href: `/projects/${params.id}/settings`, icon: 'settings', always: true },
      ],
    }] : []),
  ] : [
    // Film/TV Navigation (original)
    {
      category: '',
      items: [
        { label: 'Overview', href: `/projects/${params.id}`, icon: 'overview', always: true },
      ],
    },
    {
      category: 'Writing',
      items: [
        { label: 'Script', href: `/projects/${params.id}/script`, icon: 'script', always: true },
        { label: 'Documents', href: `/projects/${params.id}/documents`, icon: 'documents', always: true },
        { label: 'Ideas', href: `/projects/${params.id}/ideas`, icon: 'ideas', always: true },
      ],
    },
    {
      category: 'Creative',
      items: [
        { label: 'Characters', href: `/projects/${params.id}/characters`, icon: 'characters', always: true },
        { label: 'Mind Map', href: `/projects/${params.id}/mindmap`, icon: 'mindmap', always: true },
        { label: 'Mood Board', href: `/projects/${params.id}/moodboard`, icon: 'moodboard', always: true },
        { label: 'Storyboard', href: `/projects/${params.id}/storyboard`, icon: 'storyboard', always: true },
      ],
    },
    {
      category: 'Production',
      items: [
        { label: 'Scenes', href: `/projects/${params.id}/scenes`, icon: 'scenes', production: true },
        { label: 'Shot List', href: `/projects/${params.id}/shots`, icon: 'shots', always: true },
        { label: 'Locations', href: `/projects/${params.id}/locations`, icon: 'locations', production: true },
        { label: 'Schedule', href: `/projects/${params.id}/schedule`, icon: 'schedule', production: true },
        { label: 'Budget', href: `/projects/${params.id}/budget`, icon: 'budget', production: true },
        { label: 'On Set', href: `/projects/${params.id}/onset`, icon: 'onset', production: true },
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
        { label: 'Export', href: `/projects/${params.id}/export`, icon: 'export', pro: true },
        { label: 'Script Analysis', href: `/projects/${params.id}/ai-analysis`, icon: 'ai', pro: true },
        { label: 'Client Review', href: `/projects/${params.id}/review`, icon: 'review', pro: true },
        { label: 'Revisions', href: `/projects/${params.id}/revisions`, icon: 'revisions', pro: true },
        { label: 'Custom Branding', href: `/projects/${params.id}/branding`, icon: 'branding', pro: true },
        { label: 'Reports', href: `/projects/${params.id}/reports`, icon: 'reports', pro: true },
        { label: 'Casting', href: `/projects/${params.id}/casting`, icon: 'casting', pro: true },
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
  const allItems = navCategories.flatMap(c => c.items);
  const visibleItems = allItems.filter(isItemVisible);
  // Never show Pro items in "More Tools" for free users — DaVinci model: Pro is invisible, not locked
  const hiddenItems = allItems.filter(i => !i.always && !i.pro && !isItemVisible(i));

  const icons: Record<string, React.ReactNode> = {
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
  };

  // Active page label for mobile header
  const currentPage = pathname.split('/').pop() || 'overview';
  const pageLabel = PAGE_LABELS[currentPage] || currentProject.title;

  // Sidebar content — shared between desktop and mobile
  const sidebarContent = (mobile?: boolean) => (
    <>
      {/* Project Header */}
      <div className="border-b border-surface-800 p-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="shrink-0" onClick={() => setMobileMenuOpen(false)}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${isTvProduction ? 'bg-amber-600' : 'bg-brand-600'}`}>
              {currentProject.title[0]}
            </div>
          </Link>
          {(mobile || !sidebarCollapsed) && (
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white truncate">{currentProject.title}</h2>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-surface-500 capitalize">{currentProject.status.replace('_', ' ')}</p>
                {isViewer && <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-400 font-medium">View Only</span>}
              </div>
            </div>
          )}
          {mobile && (
            <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-surface-500 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navCategories.map((cat, catIdx) => {
          const catVisibleItems = cat.items.filter(isItemVisible);
          if (catVisibleItems.length === 0) return null;
          return (
            <div key={cat.category || catIdx}>
              {cat.category && (mobile || !sidebarCollapsed) && (
                <div className="pt-3 pb-1 first:pt-0">
                  <p className="text-[10px] font-semibold text-surface-600 uppercase tracking-wider px-3">{cat.category}</p>
                </div>
              )}
              {cat.category && (!mobile && sidebarCollapsed) && catIdx > 0 && (
                <div className="my-2 border-t border-surface-800/50" />
              )}
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
            </div>
          );
        })}

        {/* More Tools (hidden items) */}
        {hiddenItems.length > 0 && (mobile || !sidebarCollapsed) && (
          <>
            <button
              onClick={() => setShowMoreTools(!showMoreTools)}
              className="sidebar-link w-full text-surface-500 hover:text-surface-300 mt-2"
            >
              <svg className={cn('w-4 h-4 transition-transform', showMoreTools && 'rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-[11px]">More Tools</span>
            </button>
            {showMoreTools && hiddenItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== `/projects/${params.id}` && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn('sidebar-link opacity-60 hover:opacity-100', isActive && 'active')}
                  title={item.label}
                >
                  {icons[item.icon]}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Online Users */}
      {(mobile || !sidebarCollapsed) && onlineUsers.length > 0 && (
        <div className="border-t border-surface-800 p-4">
          <p className="text-[11px] font-medium text-surface-500 uppercase tracking-wider mb-3">Online Now</p>
          <div className="space-y-2">
            {onlineUsers.slice(0, 5).map((presence) => {
              const p = presence as UserPresence & { full_name?: string; email?: string; avatar_url?: string };
              const pl = PAGE_LABELS[p.current_page || ''] || p.current_page;
              return (
                <div key={p.user_id} className="flex items-center gap-2">
                  <Avatar src={p.avatar_url} name={p.full_name || p.email} size="sm" online />
                  <div className="min-w-0">
                    <p className="text-xs text-surface-300 truncate">{p.full_name || p.email || 'User'}</p>
                    <p className="text-[10px] text-green-400">{pl}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapse Toggle (desktop only) */}
      {!mobile && (
        <div className="border-t border-surface-800 p-2 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-1">
              <Link href="/messages" className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-white/5 transition-colors" title="Messages">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </Link>
              <NotificationBell />
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
            title={sidebarCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
            className={cn("flex items-center justify-center p-2 rounded-lg text-surface-500 hover:text-white hover:bg-white/5 transition-colors", sidebarCollapsed && "w-full")}
          >
            <svg className={cn('w-4 h-4 transition-transform', sidebarCollapsed && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden bg-surface-950 border-b border-surface-800">
        <div className="flex items-center justify-between px-3 py-2">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-surface-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 bg-brand-600 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {currentProject.title[0]}
            </div>
            <span className="text-sm font-medium text-white truncate">{pageLabel}</span>
            {isViewer && <span className="text-[8px] px-1 py-0.5 rounded bg-surface-800 text-surface-400 font-medium shrink-0">View Only</span>}
          </div>
          <NotificationBell />
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-72 z-50 flex flex-col bg-surface-950 border-r border-surface-800 md:hidden animate-slide-right">
            {sidebarContent(true)}
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden md:flex flex-col border-r border-surface-800 bg-surface-950 transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}>
        {sidebarContent(false)}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-12 md:pt-0">
        <div className="animate-fade-in-up">
          {children}
        </div>
      </main>
    </div>
  );
}
