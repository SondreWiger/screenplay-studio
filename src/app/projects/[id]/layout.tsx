'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProjectStore, usePresenceStore } from '@/lib/stores';
import { useRealtime } from '@/hooks/useRealtime';
import { Avatar, Badge, LoadingPage } from '@/components/ui';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useNotifications } from '@/hooks/useNotifications';
import { cn, getInitials } from '@/lib/utils';
import type { Project, ProjectMember, Profile, UserRole } from '@/lib/types';

const PAGE_LABELS: Record<string, string> = {
  overview: 'Overview', script: 'Script Editor', documents: 'Documents',
  characters: 'Characters', locations: 'Locations', scenes: 'Scenes',
  shots: 'Shot List', schedule: 'Schedule', ideas: 'Ideas',
  budget: 'Budget', team: 'Team', settings: 'Settings',
  mindmap: 'Mind Map', moodboard: 'Mood Board', messages: 'Messages', chat: 'Chat',
  storyboard: 'Storyboard', onset: 'On Set', comments: 'Comments',
  showcase: 'Showcase',
};

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { currentProject, setCurrentProject, members, setMembers } = useProjectStore();
  const { onlineUsers } = usePresenceStore();
  const { updatePresence } = useRealtime(params.id);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);

  useNotifications(user?.id);

  // Close mobile menu on navigation
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

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
      const isMember = (membersRes.data || []).some((m: any) => m.user_id === user?.id);
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

  type NavItem = { label: string; href: string; icon: string; always?: boolean; production?: boolean; collab?: boolean };
  type NavCategory = { category: string; items: NavItem[] };

  const navCategories: NavCategory[] = [
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
        { label: 'Shot List', href: `/projects/${params.id}/shots`, icon: 'shots', production: true },
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
    ...(!isViewer ? [{
      category: '',
      items: [
        { label: 'Showcase', href: `/projects/${params.id}/showcase`, icon: 'showcase', always: true },
        { label: 'Settings', href: `/projects/${params.id}/settings`, icon: 'settings', always: true },
      ],
    }] : []),
  ];

  const isItemVisible = (item: NavItem) => {
    if (item.always) return true;
    if (item.production && showProduction) return true;
    if (item.collab && showCollab) return true;
    return false;
  };

  // Flat lists for backward compat
  const allItems = navCategories.flatMap(c => c.items);
  const visibleItems = allItems.filter(isItemVisible);
  const hiddenItems = allItems.filter(i => !i.always && !isItemVisible(i));

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
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-orange-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">
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
            {onlineUsers.slice(0, 5).map((presence: any) => {
              const pl = PAGE_LABELS[presence.current_page] || presence.current_page;
              return (
                <div key={presence.user_id} className="flex items-center gap-2">
                  <Avatar src={presence.avatar_url} name={presence.full_name || presence.email} size="sm" online />
                  <div className="min-w-0">
                    <p className="text-xs text-surface-300 truncate">{presence.full_name || presence.email || 'User'}</p>
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
            <div className="w-6 h-6 bg-gradient-to-br from-brand-500 to-orange-500 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0">
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
