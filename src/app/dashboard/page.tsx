'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/stores';
import { Button, Card, Badge, Avatar, LoadingPage, EmptyState, Modal, Input, Textarea, Select, KeyboardShortcuts } from '@/components/ui';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDate, timeAgo, cn } from '@/lib/utils';
import type { Project, ScriptType, Company, CompanyMember, CompanyRole } from '@/lib/types';
import { FORMAT_OPTIONS, GENRE_OPTIONS, SCRIPT_TYPE_OPTIONS } from '@/lib/types';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Company state
  const [companyMemberships, setCompanyMemberships] = useState<(CompanyMember & { company: Company })[]>([]);
  const [companyProjects, setCompanyProjects] = useState<Record<string, Project[]>>({});

  // Initialise realtime notifications
  useNotifications(user?.id);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') { e.preventDefault(); setShowShortcuts(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); setShowNewProject(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Filter projects
  const filteredProjects = projects.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.title?.toLowerCase().includes(q) && !p.logline?.toLowerCase().includes(q)) return false;
    }
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    return true;
  });

  // Most recently updated project for "Continue Writing"
  const allProjects = [...projects, ...Object.values(companyProjects).flat()];
  const lastProject = allProjects.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    // Redirect to onboarding if not completed
    if (user.onboarding_completed === false) {
      router.replace('/onboarding');
      return;
    }
    fetchProjects();
    fetchCompanyData();
  }, [user, authLoading]);

  const fetchProjects = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .is('company_id', null)
        .order('updated_at', { ascending: false });
      if (error) console.error('Error fetching projects:', error.message);
      setProjects(data || []);
    } catch (err) {
      console.error('Unexpected error fetching projects:', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyData = async () => {
    if (!user?.id) return;
    try {
      const supabase = createClient();
      // Get all company memberships for this user, with company details
      const { data: memberships, error: memErr } = await supabase
        .from('company_members')
        .select('*, company:companies(*)')
        .eq('user_id', user.id);

      if (memErr) {
        console.error('Error fetching company memberships:', memErr.message);
        return;
      }

      const validMemberships = (memberships || []).filter((m: any) => m.company) as (CompanyMember & { company: Company })[];
      setCompanyMemberships(validMemberships);

      // Fetch projects for each company
      if (validMemberships.length > 0) {
        const companyIds = validMemberships.map((m) => m.company_id);
        const { data: cProjects, error: cpErr } = await supabase
          .from('projects')
          .select('*')
          .in('company_id', companyIds)
          .order('updated_at', { ascending: false });

        if (cpErr) {
          console.error('Error fetching company projects:', cpErr.message);
          return;
        }

        // Group by company_id
        const grouped: Record<string, Project[]> = {};
        for (const p of cProjects || []) {
          if (p.company_id) {
            if (!grouped[p.company_id]) grouped[p.company_id] = [];
            grouped[p.company_id].push(p);
          }
        }
        setCompanyProjects(grouped);
      }
    } catch (err) {
      console.error('Unexpected error fetching company data:', err);
    }
  };

  if (authLoading || (!user && loading)) return <LoadingPage />;

  const statusColors: Record<string, string> = {
    development: 'info',
    pre_production: 'warning',
    production: 'success',
    post_production: 'warning',
    completed: 'success',
    archived: 'default',
  };

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-surface-800 bg-surface-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-orange-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-white">Screenplay Studio</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/blog" className="text-xs text-surface-500 hover:text-surface-300 transition-colors">
              Blog
            </Link>
            {user?.show_community !== false && (
              <Link href="/community" className="text-xs text-surface-500 hover:text-surface-300 transition-colors">
                Community
              </Link>
            )}
            {companyMemberships.length > 0 && (
              <Link href="/company" className="text-xs text-surface-500 hover:text-surface-300 transition-colors">
                Company
              </Link>
            )}
            {user?.id === ADMIN_UID && (
              <Link href="/admin" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors border border-red-500/20">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Admin
              </Link>
            )}
            <Button onClick={() => setShowNewProject(true)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </Button>
            <NotificationBell />
            {/* User avatar with dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Avatar src={user?.avatar_url} name={user?.full_name} size="md" />
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-surface-700 bg-surface-900 shadow-2xl py-1.5">
                    <div className="px-4 py-2.5 border-b border-surface-800">
                      <p className="text-sm font-medium text-white truncate">{user?.display_name || user?.full_name || 'User'}</p>
                      <p className="text-[11px] text-surface-500 truncate">{user?.email}</p>
                    </div>
                    <Link href="/settings" className="flex items-center gap-2.5 px-4 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                      onClick={() => setShowUserMenu(false)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Settings
                    </Link>
                    <Link href="/notifications" className="flex items-center gap-2.5 px-4 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                      onClick={() => setShowUserMenu(false)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                      Notifications
                    </Link>
                    {user?.show_community === false && (
                      <Link href="/community" className="flex items-center gap-2.5 px-4 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                        onClick={() => setShowUserMenu(false)}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Community
                      </Link>
                    )}
                    {user?.company_id && (
                      <Link href="/company" className="flex items-center gap-2.5 px-4 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                        onClick={() => setShowUserMenu(false)}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        Company
                      </Link>
                    )}
                    <div className="border-t border-surface-800 mt-1.5 pt-1.5">
                      <button
                        onClick={() => useAuthStore.getState().signOut().then(() => router.replace('/auth/login'))}
                        className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-white">
            Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
          </h2>
          <p className="mt-1 text-surface-400">Your film projects and recent work</p>
        </div>

        {/* Continue Writing CTA */}
        {lastProject && (
          <button
            onClick={() => router.push(`/projects/${lastProject.id}/script`)}
            className="w-full mb-8 group rounded-xl border border-surface-800 bg-gradient-to-r from-surface-900 to-surface-900/50 hover:border-brand-500/40 p-5 text-left transition-all hover:shadow-lg hover:shadow-brand-500/5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400 group-hover:bg-brand-500/20 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </div>
                <div>
                  <p className="text-xs text-surface-400">Continue Writing</p>
                  <p className="text-sm font-semibold text-white">{lastProject.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-surface-500">
                <span>Last edited {timeAgo(lastProject.updated_at)}</span>
                <svg className="w-4 h-4 text-surface-600 group-hover:text-brand-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
          </button>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-surface-700 bg-surface-900 text-sm text-white placeholder:text-surface-500 focus:border-brand-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'development', 'pre_production', 'production', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                  filterStatus === status
                    ? 'bg-brand-600 text-white'
                    : 'text-surface-400 hover:text-white hover:bg-surface-800'
                )}
              >
                {status === 'all' ? 'All' : status === 'pre_production' ? 'Pre-Prod' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10 stagger-children">
          {(() => {
            const allProjects = [...projects, ...Object.values(companyProjects).flat()];
            return [
              { label: 'Total Projects', value: allProjects.length, color: '#6366f1' },
              { label: 'In Development', value: allProjects.filter(p => p.status === 'development').length, color: '#3b82f6' },
              { label: 'In Production', value: allProjects.filter(p => p.status === 'production').length, color: '#22c55e' },
              { label: 'Completed', value: allProjects.filter(p => p.status === 'completed').length, color: '#f59e0b' },
            ].map((stat) => (
              <Card key={stat.label} className="p-5">
                <p className="text-sm text-surface-400">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold text-white">{stat.value}</p>
                <div className="mt-3 h-1 rounded-full bg-surface-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${allProjects.length > 0 ? (stat.value / allProjects.length) * 100 : 0}%`,
                      backgroundColor: stat.color,
                    }}
                  />
                </div>
              </Card>
            ));
          })()}
        </div>

        {/* Personal Projects */}
        <div className="mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
          <h3 className="text-lg font-semibold text-white">My Projects</h3>
          <span className="text-xs text-surface-500">({filteredProjects.length}{searchQuery || filterStatus !== 'all' ? ` of ${projects.length}` : ''})</span>
        </div>
        {filteredProjects.length === 0 && (searchQuery || filterStatus !== 'all') ? (
          <div className="text-center py-12 text-surface-500 text-sm mb-8">
            No projects match your filters.{' '}
            <button onClick={() => { setSearchQuery(''); setFilterStatus('all'); }} className="text-brand-400 hover:text-brand-300 transition-colors">Clear filters</button>
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
              </svg>
            }
            title="No projects yet"
            description="Create your first screenplay project to get started"
            action={
              <Button onClick={() => setShowNewProject(true)}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create First Project
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card hover className="overflow-hidden group">
                  {/* Cover */}
                  <div className="h-32 bg-gradient-to-br from-surface-800 to-surface-900 relative overflow-hidden">
                    {project.cover_url ? (
                      <img src={project.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-5xl font-bold text-surface-700 group-hover:text-surface-600 transition-colors">
                          {project.title[0]}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <Badge variant={statusColors[project.status] as any}>
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-white group-hover:text-brand-400 transition-colors">
                      {project.title}
                    </h3>
                    {project.logline && (
                      <p className="mt-1 text-sm text-surface-400 line-clamp-2">{project.logline}</p>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex gap-1.5">
                        {project.genre?.slice(0, 3).map((g) => (
                          <Badge key={g} size="sm">{g}</Badge>
                        ))}
                      </div>
                      <span className="text-xs text-surface-500">{timeAgo(project.updated_at)}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Company Project Sections */}
        {companyMemberships.map((membership) => {
          const company = membership.company;
          const cProjects = companyProjects[company.id] || [];
          return (
            <div key={company.id} className="mt-10">
              <div className="mb-4 flex items-center gap-3">
                <Link href="/company" className="flex items-center gap-3 group">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt="" className="w-7 h-7 rounded-lg object-cover" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: company.brand_color || '#6366f1' }}
                    >
                      {company.name[0]}
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-white group-hover:text-brand-400 transition-colors">{company.name}</h3>
                </Link>
                <Badge size="sm" variant="default">{membership.role}</Badge>
                <span className="text-xs text-surface-500">({cProjects.length} project{cProjects.length !== 1 ? 's' : ''})</span>
                <div className="ml-auto flex items-center gap-2">
                  {company.public_page_enabled && (
                    <Link href={`/company/${company.slug}/blog`} className="text-xs text-surface-500 hover:text-surface-300 transition-colors">Blog</Link>
                  )}
                  <Link href="/company" className="text-xs text-surface-500 hover:text-surface-300 transition-colors">Manage →</Link>
                </div>
              </div>

              {cProjects.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-sm text-surface-500">No projects yet for this company</p>
                  {(['owner', 'admin', 'manager'] as CompanyRole[]).includes(membership.role) && (
                    <Button
                      variant="ghost"
                      className="mt-3"
                      onClick={() => setShowNewProject(true)}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Project
                    </Button>
                  )}
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cProjects.map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <Card hover className="overflow-hidden group">
                        <div className="h-32 bg-gradient-to-br from-surface-800 to-surface-900 relative overflow-hidden">
                          {project.cover_url ? (
                            <img src={project.cover_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-5xl font-bold text-surface-700 group-hover:text-surface-600 transition-colors">
                                {project.title[0]}
                              </span>
                            </div>
                          )}
                          <div className="absolute top-3 left-3">
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white"
                              style={{ backgroundColor: company.brand_color || '#6366f1' }}
                              title={company.name}
                            >
                              {company.name[0]}
                            </div>
                          </div>
                          <div className="absolute top-3 right-3">
                            <Badge variant={statusColors[project.status] as any}>
                              {project.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-5">
                          <h3 className="text-lg font-semibold text-white group-hover:text-brand-400 transition-colors">
                            {project.title}
                          </h3>
                          {project.logline && (
                            <p className="mt-1 text-sm text-surface-400 line-clamp-2">{project.logline}</p>
                          )}
                          <div className="mt-4 flex items-center justify-between">
                            <div className="flex gap-1.5">
                              {project.genre?.slice(0, 3).map((g) => (
                                <Badge key={g} size="sm">{g}</Badge>
                              ))}
                            </div>
                            <span className="text-xs text-surface-500">{timeAgo(project.updated_at)}</span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProject}
        onClose={() => setShowNewProject(false)}
        onCreated={() => {
          setShowNewProject(false);
          fetchProjects();
          fetchCompanyData();
        }}
        userId={user?.id || ''}
        companyMemberships={companyMemberships}
      />

      {/* Keyboard Shortcuts */}
      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Keyboard hint */}
      <div className="fixed bottom-4 left-4 z-20">
        <button
          onClick={() => setShowShortcuts(true)}
          className="text-[10px] text-surface-600 hover:text-surface-400 transition-colors flex items-center gap-1.5"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface-800 border border-surface-700 rounded shadow-sm">⌘/</kbd>
          <span>shortcuts</span>
        </button>
      </div>
    </div>
  );
}

function NewProjectModal({
  isOpen,
  onClose,
  onCreated,
  userId,
  companyMemberships,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  userId: string;
  companyMemberships: (CompanyMember & { company: Company })[];
}) {
  const { user: currentUser } = useAuthStore();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [format, setFormat] = useState('feature');
  const [scriptType, setScriptType] = useState<ScriptType>(currentUser?.preferred_script_type || 'screenplay');
  const [genre, setGenre] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0); // 0 = script type, 1 = details
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Only companies where user has create permissions
  const creatableCompanies = companyMemberships.filter((m) =>
    (['owner', 'admin', 'manager'] as CompanyRole[]).includes(m.role)
  );

  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !userId) return;
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert({
          title: title.trim(),
          logline: logline.trim() || null,
          format,
          genre,
          script_type: scriptType,
          created_by: userId,
          company_id: selectedCompanyId || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating project:', insertError);
        setError(insertError.message);
        setLoading(false);
        return;
      }

      if (data) {
        router.push(`/projects/${data.id}`);
        onCreated();
      }
    } catch (err) {
      console.error('Unexpected error creating project:', err);
      setError('Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleGenre = (g: string) => {
    setGenre((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={step === 0 ? 'What are you writing?' : 'Project Details'} size="lg">
      {step === 0 ? (
        <div className="space-y-6">
          <p className="text-sm text-surface-400">Choose the type of script. This sets the default formatting for your editor.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SCRIPT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setScriptType(opt.value);
                  // Auto-set format for episodic
                  if (opt.value === 'episodic') setFormat('series');
                }}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  scriptType === opt.value
                    ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30'
                    : 'border-surface-700 bg-surface-800/50 hover:border-surface-600'
                }`}
              >
                <span className="text-xl">{opt.icon}</span>
                <h3 className={`mt-1.5 text-sm font-semibold ${scriptType === opt.value ? 'text-brand-400' : 'text-white'}`}>{opt.label}</h3>
                <p className="mt-0.5 text-[10px] text-surface-500">{opt.description}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(1)}>Continue</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <button type="button" onClick={() => setStep(0)} className="text-xs text-surface-400 hover:text-white transition-colors flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              {SCRIPT_TYPE_OPTIONS.find(o => o.value === scriptType)?.icon} {SCRIPT_TYPE_OPTIONS.find(o => o.value === scriptType)?.label}
            </button>
          </div>

          {/* Company / Personal selector */}
          {creatableCompanies.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-surface-300">Create for</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCompanyId(null)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all text-sm ${
                    selectedCompanyId === null
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/30'
                      : 'border-surface-700 bg-surface-800/50 text-surface-300 hover:border-surface-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                  Personal
                </button>
                {creatableCompanies.map((m) => (
                  <button
                    key={m.company_id}
                    type="button"
                    onClick={() => setSelectedCompanyId(m.company_id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all text-sm ${
                      selectedCompanyId === m.company_id
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/30'
                        : 'border-surface-700 bg-surface-800/50 text-surface-300 hover:border-surface-600'
                    }`}
                  >
                    {m.company.logo_url ? (
                      <img src={m.company.logo_url} alt="" className="w-4 h-4 rounded object-cover" />
                    ) : (
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white"
                        style={{ backgroundColor: m.company.brand_color || '#6366f1' }}
                      >
                        {m.company.name[0]}
                      </div>
                    )}
                    {m.company.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input
            label="Project Title"
            placeholder="The Midnight Hour"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          <Textarea
            label="Logline"
            placeholder="A hard-boiled detective uncovers a conspiracy that reaches the highest levels of power..."
            value={logline}
            onChange={(e) => setLogline(e.target.value)}
            rows={3}
          />

          <Select
            label="Format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            options={FORMAT_OPTIONS}
          />

          {scriptType === 'episodic' && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Season Number" type="number" min={1} value="" onChange={() => {}} placeholder="1" />
              <Input label="Episodes Planned" type="number" min={1} value="" onChange={() => {}} placeholder="8" />
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-surface-300">Genre</label>
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    genre.includes(g)
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create Project
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
