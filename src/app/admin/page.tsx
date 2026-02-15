'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Badge, Card, Modal, Input, LoadingPage, Avatar } from '@/components/ui';
import { cn, formatDate, timeAgo } from '@/lib/utils';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

interface PlatformStats {
  totalUsers: number;
  totalProjects: number;
  totalScripts: number;
  totalElements: number;
  totalWords: number;
  totalCharacters: number;
  totalLocations: number;
  totalScenes: number;
  totalShots: number;
  totalIdeas: number;
  totalBudgetItems: number;
  totalScheduleEvents: number;
  totalComments: number;
  recentUsers: any[];
  recentProjects: any[];
  projectDetails: any[];
}

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  projectCount?: number;
}

type Tab = 'overview' | 'users' | 'projects' | 'system';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebootStatus, setRebootStatus] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.id !== ADMIN_UID) {
      router.replace('/dashboard');
      return;
    }
    loadStats();
    loadUsers();
    loadProjects();
  }, [user, authLoading]);

  const loadStats = async () => {
    const supabase = createClient();

    const [
      profilesRes, projectsRes, scriptsRes, elementsRes,
      charsRes, locsRes, scenesRes, shotsRes, ideasRes,
      budgetRes, schedRes, commentsRes,
      recentUsersRes, recentProjectsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('scripts').select('id', { count: 'exact', head: true }),
      supabase.from('script_elements').select('id, content', { count: 'exact' }),
      supabase.from('characters').select('id', { count: 'exact', head: true }),
      supabase.from('locations').select('id', { count: 'exact', head: true }),
      supabase.from('scenes').select('id', { count: 'exact', head: true }),
      supabase.from('shots').select('id', { count: 'exact', head: true }),
      supabase.from('ideas').select('id', { count: 'exact', head: true }),
      supabase.from('budget_items').select('id', { count: 'exact', head: true }),
      supabase.from('production_schedule').select('id', { count: 'exact', head: true }),
      supabase.from('comments').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(5),
    ]);

    // Count total words from elements
    const allElements = elementsRes.data || [];
    const totalWords = allElements.reduce((sum, el) => {
      const words = (el.content || '').trim().split(/\s+/).filter(Boolean).length;
      return sum + words;
    }, 0);

    setStats({
      totalUsers: profilesRes.count || 0,
      totalProjects: projectsRes.count || 0,
      totalScripts: scriptsRes.count || 0,
      totalElements: elementsRes.count || 0,
      totalWords,
      totalCharacters: charsRes.count || 0,
      totalLocations: locsRes.count || 0,
      totalScenes: scenesRes.count || 0,
      totalShots: shotsRes.count || 0,
      totalIdeas: ideasRes.count || 0,
      totalBudgetItems: budgetRes.count || 0,
      totalScheduleEvents: schedRes.count || 0,
      totalComments: commentsRes.count || 0,
      recentUsers: recentUsersRes.data || [],
      recentProjects: recentProjectsRes.data || [],
      projectDetails: [],
    });

    setLoading(false);
  };

  const loadUsers = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(data || []);
  };

  const loadProjects = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('projects')
      .select('*, project_members(count), scripts(count)')
      .order('updated_at', { ascending: false });
    setProjects(data || []);
  };

  const handleSoftReboot = async () => {
    setRebootStatus('Clearing realtime channels...');

    const supabase = createClient();

    // 1) Remove all realtime subscriptions
    supabase.removeAllChannels();
    setRebootStatus('Clearing presence records...');

    // 2) Delete all presence records to force re-sync
    await supabase.from('user_presence').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
    setRebootStatus('Refreshing auth session...');

    // 3) Refresh auth token
    await supabase.auth.refreshSession();
    setRebootStatus('Reboot complete. Reloading page...');

    // 4) Hard reload after brief delay
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleClearAllPresence = async () => {
    const supabase = createClient();
    await supabase.from('user_presence').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
    setRebootStatus('All presence records cleared.');
    setTimeout(() => setRebootStatus(null), 3000);
  };

  const handleUpdateUser = async (userId: string, updates: Partial<UserRow>) => {
    const supabase = createClient();
    await supabase.from('profiles').update(updates).eq('id', userId);
    await loadUsers();
    setEditingUser(null);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure? This will delete the user profile. Their auth account will remain in Supabase Auth.')) return;
    const supabase = createClient();
    // Delete their project memberships and profile
    await supabase.from('project_members').delete().eq('user_id', userId);
    await supabase.from('user_presence').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);
    await loadUsers();
  };

  if (authLoading || loading) return <LoadingPage />;
  if (!user || user.id !== ADMIN_UID) return null;

  const filteredUsers = users.filter((u) =>
    !userSearch || (u.email + ' ' + (u.full_name || '')).toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredProjects = projects.filter((p) =>
    !projectSearch || p.title.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'overview', label: 'Overview',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    },
    {
      key: 'users', label: 'Users',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      key: 'projects', label: 'Projects',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    },
    {
      key: 'system', label: 'System',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-surface-800 bg-surface-950">
        <div className="border-b border-surface-800 p-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                A
              </div>
            </Link>
            <div>
              <h2 className="text-sm font-semibold text-white">Admin Panel</h2>
              <p className="text-[11px] text-surface-500">Platform Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                activeTab === tab.key
                  ? 'bg-brand-600/10 text-brand-400'
                  : 'text-surface-400 hover:bg-white/5 hover:text-white'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-surface-800 p-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs text-surface-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {activeTab === 'overview' && stats && <OverviewTab stats={stats} />}
          {activeTab === 'users' && (
            <UsersTab
              users={filteredUsers}
              search={userSearch}
              onSearchChange={setUserSearch}
              onEdit={setEditingUser}
              onDelete={handleDeleteUser}
            />
          )}
          {activeTab === 'projects' && (
            <ProjectsTab
              projects={filteredProjects}
              search={projectSearch}
              onSearchChange={setProjectSearch}
            />
          )}
          {activeTab === 'system' && (
            <SystemTab
              rebootStatus={rebootStatus}
              onSoftReboot={handleSoftReboot}
              onClearPresence={handleClearAllPresence}
              onRefreshStats={() => { setLoading(true); loadStats(); loadUsers(); loadProjects(); }}
            />
          )}
        </div>
      </main>

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
        />
      )}
    </div>
  );
}

// ============================================================
// Overview Tab
// ============================================================

function OverviewTab({ stats }: { stats: PlatformStats }) {
  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👤', color: 'from-blue-500/20 to-blue-600/5' },
    { label: 'Projects', value: stats.totalProjects, icon: '🎬', color: 'from-purple-500/20 to-purple-600/5' },
    { label: 'Scripts', value: stats.totalScripts, icon: '📝', color: 'from-green-500/20 to-green-600/5' },
    { label: 'Total Words', value: stats.totalWords.toLocaleString(), icon: '✍️', color: 'from-amber-500/20 to-amber-600/5' },
    { label: 'Elements', value: stats.totalElements.toLocaleString(), icon: '📄', color: 'from-cyan-500/20 to-cyan-600/5' },
    { label: 'Characters', value: stats.totalCharacters, icon: '🎭', color: 'from-rose-500/20 to-rose-600/5' },
    { label: 'Locations', value: stats.totalLocations, icon: '📍', color: 'from-emerald-500/20 to-emerald-600/5' },
    { label: 'Scenes', value: stats.totalScenes, icon: '🎬', color: 'from-indigo-500/20 to-indigo-600/5' },
    { label: 'Shots', value: stats.totalShots, icon: '📷', color: 'from-orange-500/20 to-orange-600/5' },
    { label: 'Ideas', value: stats.totalIdeas, icon: '💡', color: 'from-yellow-500/20 to-yellow-600/5' },
    { label: 'Budget Items', value: stats.totalBudgetItems, icon: '💰', color: 'from-teal-500/20 to-teal-600/5' },
    { label: 'Schedule Events', value: stats.totalScheduleEvents, icon: '📅', color: 'from-pink-500/20 to-pink-600/5' },
    { label: 'Comments', value: stats.totalComments, icon: '💬', color: 'from-violet-500/20 to-violet-600/5' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Platform Overview</h1>
      <p className="text-sm text-surface-400 mb-8">Stats across the entire Screenplay Studio platform</p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map((stat) => (
          <div key={stat.label} className={cn('rounded-xl border border-surface-800 bg-gradient-to-br p-4', stat.color)}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-surface-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Users</h3>
          <div className="space-y-3">
            {stats.recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3">
                <Avatar src={u.avatar_url} name={u.full_name || u.email} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{u.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-surface-500 truncate">{u.email}</p>
                </div>
                <span className="text-[10px] text-surface-500">{timeAgo(u.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Projects</h3>
          <div className="space-y-3">
            {stats.recentProjects.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-orange-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {p.title?.[0] || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{p.title}</p>
                  <p className="text-xs text-surface-500 capitalize">{(p.status || '').replace('_', ' ')}</p>
                </div>
                <span className="text-[10px] text-surface-500">{timeAgo(p.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Users Tab
// ============================================================

function UsersTab({ users, search, onSearchChange, onEdit, onDelete }: {
  users: UserRow[];
  search: string;
  onSearchChange: (s: string) => void;
  onEdit: (u: UserRow) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">User Management</h1>
          <p className="text-sm text-surface-400">{users.length} users total</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder:text-surface-500 outline-none focus:border-brand-500 w-64"
          />
        </div>
      </div>

      <div className="rounded-xl border border-surface-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-800 bg-surface-900/50">
              <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">User</th>
              <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Email</th>
              <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Role</th>
              <th className="text-left text-xs font-medium text-surface-500 px-4 py-3">Joined</th>
              <th className="text-right text-xs font-medium text-surface-500 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={u.avatar_url} name={u.full_name || u.email} size="sm" />
                    <div>
                      <p className="text-sm text-white">{u.full_name || 'Unnamed'}</p>
                      <p className="text-[10px] text-surface-500 font-mono">{u.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-surface-300">{u.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={u.id === ADMIN_UID ? 'warning' : 'default'} size="sm">
                    {u.id === ADMIN_UID ? 'Admin' : u.role || 'user'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-surface-400">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => onEdit(u)} className="p-1.5 rounded text-surface-400 hover:text-white hover:bg-white/10 transition-colors" title="Edit">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    {u.id !== ADMIN_UID && (
                      <button onClick={() => onDelete(u.id)} className="p-1.5 rounded text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Projects Tab
// ============================================================

function ProjectsTab({ projects, search, onSearchChange }: {
  projects: any[];
  search: string;
  onSearchChange: (s: string) => void;
}) {
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [projectStats, setProjectStats] = useState<Record<string, any>>({});

  const loadProjectStats = async (projectId: string) => {
    if (projectStats[projectId]) {
      setExpandedProject(expandedProject === projectId ? null : projectId);
      return;
    }

    const supabase = createClient();
    const [scripts, elements, chars, locs, scenes, shots, ideas, budget, schedule] = await Promise.all([
      supabase.from('scripts').select('id, title, version', { count: 'exact' }).eq('project_id', projectId),
      supabase.from('script_elements').select('content').eq('script_id', projectId), // This needs script IDs
      supabase.from('characters').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('locations').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('scenes').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('shots').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('ideas').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('budget_items').select('id, amount', { count: 'exact' }).eq('project_id', projectId),
      supabase.from('production_schedule').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    ]);

    // Get word count from elements via scripts
    const scriptIds = (scripts.data || []).map((s: any) => s.id);
    let wordCount = 0;
    let elementCount = 0;
    if (scriptIds.length > 0) {
      const { data: elData, count } = await supabase
        .from('script_elements')
        .select('content', { count: 'exact' })
        .in('script_id', scriptIds);
      elementCount = count || 0;
      wordCount = (elData || []).reduce((sum: number, el: any) => {
        return sum + (el.content || '').trim().split(/\s+/).filter(Boolean).length;
      }, 0);
    }

    const totalBudget = (budget.data || []).reduce((sum: number, b: any) => sum + (b.amount || 0), 0);

    setProjectStats({
      ...projectStats,
      [projectId]: {
        scripts: scripts.count || 0,
        elements: elementCount,
        words: wordCount,
        characters: chars.count || 0,
        locations: locs.count || 0,
        scenes: scenes.count || 0,
        shots: shots.count || 0,
        ideas: ideas.count || 0,
        budgetItems: budget.count || 0,
        totalBudget,
        scheduleEvents: schedule.count || 0,
        scriptList: scripts.data || [],
      },
    });

    setExpandedProject(projectId);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">All Projects</h1>
          <p className="text-sm text-surface-400">{projects.length} projects total</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder:text-surface-500 outline-none focus:border-brand-500 w-64"
          />
        </div>
      </div>

      <div className="space-y-3">
        {projects.map((p) => (
          <div key={p.id} className="rounded-xl border border-surface-800 bg-surface-900/50 overflow-hidden">
            <button
              onClick={() => loadProjectStats(p.id)}
              className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-surface-800/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-orange-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {p.title?.[0] || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{p.title}</p>
                <p className="text-xs text-surface-500">{p.logline || 'No logline'}</p>
              </div>
              <Badge variant="default" size="sm">{(p.status || '').replace('_', ' ')}</Badge>
              <div className="text-right">
                <p className="text-xs text-surface-400">{p.format || '—'}</p>
                <p className="text-[10px] text-surface-500">{timeAgo(p.updated_at)}</p>
              </div>
              <svg className={cn('w-4 h-4 text-surface-500 transition-transform', expandedProject === p.id && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {expandedProject === p.id && projectStats[p.id] && (
              <div className="border-t border-surface-800 px-6 py-4 bg-surface-900/80">
                <div className="grid grid-cols-3 md:grid-cols-5 gap-4 mb-4">
                  {[
                    { label: 'Scripts', val: projectStats[p.id].scripts },
                    { label: 'Words', val: projectStats[p.id].words.toLocaleString() },
                    { label: 'Elements', val: projectStats[p.id].elements.toLocaleString() },
                    { label: 'Characters', val: projectStats[p.id].characters },
                    { label: 'Locations', val: projectStats[p.id].locations },
                    { label: 'Scenes', val: projectStats[p.id].scenes },
                    { label: 'Shots', val: projectStats[p.id].shots },
                    { label: 'Ideas', val: projectStats[p.id].ideas },
                    { label: 'Budget Items', val: projectStats[p.id].budgetItems },
                    { label: 'Schedule', val: projectStats[p.id].scheduleEvents },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-lg font-bold text-white">{s.val}</p>
                      <p className="text-[10px] text-surface-500">{s.label}</p>
                    </div>
                  ))}
                </div>
                {projectStats[p.id].totalBudget > 0 && (
                  <p className="text-xs text-surface-400">Total Budget: <span className="text-white font-medium">${projectStats[p.id].totalBudget.toLocaleString()}</span></p>
                )}
                <div className="mt-3 flex gap-2">
                  <Link href={`/projects/${p.id}`}>
                    <Button variant="ghost" className="text-xs">Open Project</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// System Tab
// ============================================================

function SystemTab({ rebootStatus, onSoftReboot, onClearPresence, onRefreshStats }: {
  rebootStatus: string | null;
  onSoftReboot: () => void;
  onClearPresence: () => void;
  onRefreshStats: () => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">System Management</h1>
      <p className="text-sm text-surface-400 mb-8">Maintenance tools for the platform</p>

      {rebootStatus && (
        <div className="mb-6 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          {rebootStatus}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Soft Reboot */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Soft Reboot</h3>
              <p className="text-xs text-surface-500">Clear channels, presence, refresh session</p>
            </div>
          </div>
          <p className="text-xs text-surface-400 mb-4">
            Use when things feel slow or weird. This clears all realtime channels, deletes stale presence records,
            refreshes your auth session, and reloads the page.
          </p>
          <Button onClick={onSoftReboot} variant="ghost" className="w-full border border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
            Perform Soft Reboot
          </Button>
        </div>

        {/* Clear Presence */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Clear All Presence</h3>
              <p className="text-xs text-surface-500">Reset online user indicators</p>
            </div>
          </div>
          <p className="text-xs text-surface-400 mb-4">
            If you see ghost users showing as online, this clears all presence records.
            Users will re-appear as they navigate the app.
          </p>
          <Button onClick={onClearPresence} variant="ghost" className="w-full border border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
            Clear Presence Records
          </Button>
        </div>

        {/* Refresh Data */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Refresh Stats</h3>
              <p className="text-xs text-surface-500">Re-fetch all platform data</p>
            </div>
          </div>
          <p className="text-xs text-surface-400 mb-4">
            Reload all stats, users, and project data from the database.
          </p>
          <Button onClick={onRefreshStats} variant="ghost" className="w-full border border-green-500/30 text-green-400 hover:bg-green-500/10">
            Refresh All Data
          </Button>
        </div>

        {/* Info */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-surface-700/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Platform Info</h3>
              <p className="text-xs text-surface-500">Runtime details</p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-surface-500">Framework</span>
              <span className="text-white">Next.js 14</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Backend</span>
              <span className="text-white">Supabase</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Realtime</span>
              <span className="text-white">Supabase Channels</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">State</span>
              <span className="text-white">Zustand</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Admin UUID</span>
              <span className="text-white font-mono text-[10px]">{ADMIN_UID.slice(0, 12)}...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Edit User Modal
// ============================================================

function EditUserModal({ user, onClose, onSave }: {
  user: UserRow;
  onClose: () => void;
  onSave: (id: string, updates: Partial<UserRow>) => void;
}) {
  const [fullName, setFullName] = useState(user.full_name || '');
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [role, setRole] = useState(user.role || 'user');

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit User" size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-surface-800">
          <Avatar src={user.avatar_url} name={user.full_name || user.email} size="lg" />
          <div>
            <p className="text-sm text-white font-medium">{user.email}</p>
            <p className="text-xs text-surface-500 font-mono">{user.id}</p>
          </div>
        </div>

        <Input
          label="Full Name"
          value={fullName}
          onChange={(e: any) => setFullName(e.target.value)}
        />
        <Input
          label="Display Name"
          value={displayName}
          onChange={(e: any) => setDisplayName(e.target.value)}
        />
        <Input
          label="Role"
          value={role}
          onChange={(e: any) => setRole(e.target.value)}
          placeholder="user / admin / writer / producer"
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(user.id, { full_name: fullName, display_name: displayName, role })}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
