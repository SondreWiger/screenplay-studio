'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProjectStore, usePresenceStore } from '@/lib/stores';
import { useRealtime } from '@/hooks/useRealtime';
import { Avatar, Badge, LoadingPage } from '@/components/ui';
import { cn, getInitials } from '@/lib/utils';
import type { Project, ProjectMember, Profile } from '@/lib/types';

const PAGE_LABELS: Record<string, string> = {
  overview: 'Overview', script: 'Script Editor', characters: 'Characters',
  locations: 'Locations', scenes: 'Scenes', shots: 'Shot List',
  schedule: 'Schedule', ideas: 'Ideas', budget: 'Budget',
  team: 'Team', settings: 'Settings',
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

  const navItems = [
    { label: 'Overview', href: `/projects/${params.id}`, icon: 'overview' },
    { label: 'Script', href: `/projects/${params.id}/script`, icon: 'script' },
    { label: 'Characters', href: `/projects/${params.id}/characters`, icon: 'characters' },
    { label: 'Locations', href: `/projects/${params.id}/locations`, icon: 'locations' },
    { label: 'Scenes', href: `/projects/${params.id}/scenes`, icon: 'scenes' },
    { label: 'Shot List', href: `/projects/${params.id}/shots`, icon: 'shots' },
    { label: 'Schedule', href: `/projects/${params.id}/schedule`, icon: 'schedule' },
    { label: 'Ideas', href: `/projects/${params.id}/ideas`, icon: 'ideas' },
    { label: 'Budget', href: `/projects/${params.id}/budget`, icon: 'budget' },
    { label: 'Team', href: `/projects/${params.id}/team`, icon: 'team' },
    { label: 'Settings', href: `/projects/${params.id}/settings`, icon: 'settings' },
  ];

  const icons: Record<string, React.ReactNode> = {
    overview: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    script: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    characters: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    locations: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    scenes: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
    shots: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    schedule: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    ideas: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    budget: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    team: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    settings: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r border-surface-800 bg-surface-950 transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Project Header */}
        <div className="border-b border-surface-800 p-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-orange-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                {currentProject.title[0]}
              </div>
            </Link>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-white truncate">{currentProject.title}</h2>
                <p className="text-[11px] text-surface-500 capitalize">{currentProject.status.replace('_', ' ')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== `/projects/${params.id}` && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'sidebar-link',
                  isActive && 'active',
                  sidebarCollapsed && 'justify-center px-2'
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {icons[item.icon]}
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Online Users */}
        {!sidebarCollapsed && onlineUsers.length > 0 && (
          <div className="border-t border-surface-800 p-4">
            <p className="text-[11px] font-medium text-surface-500 uppercase tracking-wider mb-3">Online Now</p>
            <div className="space-y-2">
              {onlineUsers.slice(0, 5).map((presence: any) => {
                const pageLabel = PAGE_LABELS[presence.current_page] || presence.current_page;
                return (
                  <div key={presence.user_id} className="flex items-center gap-2">
                    <Avatar
                      src={presence.avatar_url}
                      name={presence.full_name || presence.email}
                      size="sm"
                      online
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-surface-300 truncate">{presence.full_name || presence.email || 'User'}</p>
                      <p className="text-[10px] text-green-400">{pageLabel}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <div className="border-t border-surface-800 p-2">
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-surface-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg
              className={cn('w-4 h-4 transition-transform', sidebarCollapsed && 'rotate-180')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
