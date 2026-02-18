'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Badge, Card, Modal, Input, Textarea, LoadingPage, Avatar, Select } from '@/components/ui';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import type { BlogPost, BlogPostSection } from '@/lib/types';

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

type Tab = 'overview' | 'users' | 'projects' | 'blog' | 'system';

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
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [editingPost, setEditingPost] = useState<BlogPost | null | 'new'>(null);
  const [blogComments, setBlogComments] = useState<any[]>([]);
  const [siteVersion, setSiteVersion] = useState<string>('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.id !== ADMIN_UID) {
      router.replace('/dashboard');
      return;
    }
    loadStats();
    loadUsers();
    loadProjects();
    loadBlogPosts();
    loadSiteVersion();
  }, [user, authLoading]);

  const loadSiteVersion = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('site_settings').select('value').eq('key', 'site_version').single();
      if (data) setSiteVersion(data.value);
    } catch (err) {
      console.error('Error loading site version:', err);
    }
  };

  const handleUpdateVersion = async (newVersion: string) => {
    try {
      const supabase = createClient();
      await supabase.from('site_settings').upsert({ key: 'site_version', value: newVersion, updated_at: new Date().toISOString() });
      setSiteVersion(newVersion);
    } catch (err) {
      console.error('Error updating version:', err);
    }
  };

  const loadStats = async () => {
    try {
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
    } catch (err) {
      console.error('Error loading admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setUsers(data || []);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const loadProjects = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('projects')
        .select('*, project_members(count), scripts(count)')
        .order('updated_at', { ascending: false });
      setProjects(data || []);
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  };

  const loadBlogPosts = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });
      setBlogPosts(data || []);

      const { data: comments } = await supabase
        .from('blog_comments')
        .select('*, author:profiles(full_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(50);
      setBlogComments(comments || []);
    } catch (err) {
      console.error('Error loading blog posts:', err);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('Delete this blog post? This cannot be undone.')) return;
    const supabase = createClient();
    await supabase.from('blog_comments').delete().eq('post_id', id);
    await supabase.from('blog_posts').delete().eq('id', id);
    await loadBlogPosts();
  };

  const handleToggleCommentHidden = async (id: string, hidden: boolean) => {
    const supabase = createClient();
    await supabase.from('blog_comments').update({ is_hidden: hidden }).eq('id', id);
    await loadBlogPosts();
  };

  const handleDeleteComment = async (id: string) => {
    if (!confirm('Delete this comment?')) return;
    const supabase = createClient();
    await supabase.from('blog_comments').delete().eq('id', id);
    await loadBlogPosts();
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
    {
      key: 'blog', label: 'Blog',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>,
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
              siteVersion={siteVersion}
              onUpdateVersion={handleUpdateVersion}
            />
          )}
          {activeTab === 'blog' && (
            <BlogTab
              posts={blogPosts}
              comments={blogComments}
              onNewPost={() => setEditingPost('new')}
              onEditPost={(post) => setEditingPost(post)}
              onDeletePost={handleDeletePost}
              onToggleCommentHidden={handleToggleCommentHidden}
              onDeleteComment={handleDeleteComment}
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

      {/* Blog Post Editor Modal */}
      {editingPost && (
        <BlogPostEditorModal
          post={editingPost === 'new' ? null : editingPost}
          authorId={user!.id}
          onClose={() => setEditingPost(null)}
          onSaved={() => { setEditingPost(null); loadBlogPosts(); }}
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

function SystemTab({ rebootStatus, onSoftReboot, onClearPresence, onRefreshStats, siteVersion, onUpdateVersion }: {
  rebootStatus: string | null;
  onSoftReboot: () => void;
  onClearPresence: () => void;
  onRefreshStats: () => void;
  siteVersion: string;
  onUpdateVersion: (v: string) => void;
}) {
  const [editingVersion, setEditingVersion] = useState(false);
  const [versionDraft, setVersionDraft] = useState(siteVersion);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">System Management</h1>
      <p className="text-sm text-surface-400 mb-8">Maintenance tools for the platform</p>

      {/* Version control */}
      <div className="mb-6 rounded-xl border border-surface-800 bg-surface-900/50 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Site Version</h3>
            <p className="text-xs text-surface-500">Displayed in all footers across the site</p>
          </div>
        </div>
        {editingVersion ? (
          <div className="flex items-center gap-2">
            <input
              value={versionDraft}
              onChange={(e) => setVersionDraft(e.target.value)}
              className="w-32 rounded-lg border border-surface-700 bg-surface-900 px-3 py-1.5 text-sm text-white font-mono focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g. 1.2.0"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onUpdateVersion(versionDraft); setEditingVersion(false); }
                if (e.key === 'Escape') { setVersionDraft(siteVersion); setEditingVersion(false); }
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => { onUpdateVersion(versionDraft); setEditingVersion(false); }}>Save</Button>
            <Button variant="ghost" size="sm" onClick={() => { setVersionDraft(siteVersion); setEditingVersion(false); }}>Cancel</Button>
          </div>
        ) : (
          <button
            onClick={() => { setVersionDraft(siteVersion); setEditingVersion(true); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 transition-colors group"
          >
            <span className="text-sm font-mono text-brand-400">v{siteVersion || '—'}</span>
            <svg className="w-3.5 h-3.5 text-surface-500 group-hover:text-surface-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
        )}
      </div>

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
            <div className="flex justify-between">
              <span className="text-surface-500">Version</span>
              <span className="text-white font-mono">v{siteVersion || '—'}</span>
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

// ============================================================
// Blog Tab
// ============================================================

function BlogTab({ posts, comments, onNewPost, onEditPost, onDeletePost, onToggleCommentHidden, onDeleteComment }: {
  posts: BlogPost[];
  comments: any[];
  onNewPost: () => void;
  onEditPost: (post: BlogPost) => void;
  onDeletePost: (id: string) => void;
  onToggleCommentHidden: (id: string, hidden: boolean) => void;
  onDeleteComment: (id: string) => void;
}) {
  const [view, setView] = useState<'posts' | 'comments'>('posts');

  const statusColor = (s: string) => {
    if (s === 'published') return 'success';
    if (s === 'draft') return 'warning';
    return 'default';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Blog Management</h1>
          <p className="text-sm text-surface-400">Create and manage blog posts, moderate comments</p>
        </div>
        <Button onClick={onNewPost}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Post
        </Button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 bg-surface-900 rounded-lg p-1 w-fit">
        {(['posts', 'comments'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setView(t)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize',
              view === t ? 'bg-surface-700 text-white shadow-sm' : 'text-surface-400 hover:text-white'
            )}
          >
            {t} {t === 'posts' ? `(${posts.length})` : `(${comments.length})`}
          </button>
        ))}
      </div>

      {view === 'posts' && (
        <div className="space-y-3">
          {posts.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-surface-400 text-sm">No blog posts yet. Create your first one!</p>
            </div>
          )}
          {posts.map((post) => (
            <div key={post.id} className="rounded-xl border border-surface-800 bg-surface-900/50 p-5 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={statusColor(post.status)} size="sm">{post.status}</Badge>
                  {post.tags?.map((tag) => (
                    <span key={tag} className="text-[10px] text-surface-500 bg-surface-800 px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
                <h3 className="text-base font-semibold text-white truncate">{post.title}</h3>
                {post.excerpt && <p className="text-xs text-surface-400 mt-1 truncate">{post.excerpt}</p>}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-500">
                  <span>/{post.slug}</span>
                  <span>·</span>
                  <span>{post.sections?.length || 0} sections</span>
                  <span>·</span>
                  <span>{post.view_count || 0} views</span>
                  {post.published_at && (
                    <>
                      <span>·</span>
                      <span>Published {formatDate(post.published_at)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => onEditPost(post)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => onDeletePost(post.id)}>
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'comments' && (
        <div className="space-y-3">
          {comments.length === 0 && (
            <p className="text-center py-16 text-surface-400 text-sm">No blog comments yet.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className={cn('rounded-xl border border-surface-800 bg-surface-900/50 p-4 flex items-start gap-3', c.is_hidden && 'opacity-50')}>
              <Avatar src={c.author?.avatar_url} name={c.author?.full_name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">{c.author?.full_name || 'Anonymous'}</span>
                  <span className="text-[10px] text-surface-500">{timeAgo(c.created_at)}</span>
                  {c.is_hidden && <Badge variant="error" size="sm">Hidden</Badge>}
                </div>
                <p className="text-sm text-surface-300 line-clamp-2">{c.content}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => onToggleCommentHidden(c.id, !c.is_hidden)}
                  title={c.is_hidden ? 'Show' : 'Hide'}
                >
                  {c.is_hidden ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDeleteComment(c.id)}>
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Blog Post Editor Modal
// ============================================================

function BlogPostEditorModal({ post, authorId, onClose, onSaved }: {
  post: BlogPost | null;
  authorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(post?.title || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [coverUrl, setCoverUrl] = useState(post?.cover_image_url || '');
  const [tags, setTags] = useState(post?.tags?.join(', ') || '');
  const [status, setStatus] = useState(post?.status || 'draft');
  const [allowComments, setAllowComments] = useState(post?.allow_comments ?? true);
  const [sections, setSections] = useState<BlogPostSection[]>(
    post?.sections && post.sections.length > 0
      ? [...post.sections].sort((a, b) => a.order - b.order)
      : [{ heading: '', body: '', order: 0 }]
  );
  const [saving, setSaving] = useState(false);

  // Auto-generate slug from title
  useEffect(() => {
    if (!post && title) {
      setSlug(
        title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      );
    }
  }, [title, post]);

  const addSection = () => {
    setSections([...sections, { heading: '', body: '', order: sections.length }]);
  };

  const removeSection = (idx: number) => {
    if (sections.length <= 1) return;
    setSections(sections.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
  };

  const updateSection = (idx: number, field: 'heading' | 'body', value: string) => {
    setSections(sections.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const moveSection = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= sections.length) return;
    const newSections = [...sections];
    [newSections[idx], newSections[target]] = [newSections[target], newSections[idx]];
    setSections(newSections.map((s, i) => ({ ...s, order: i })));
  };

  const handleSave = async () => {
    if (!title.trim() || !slug.trim()) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        cover_image_url: coverUrl.trim() || null,
        tags: parsedTags,
        status,
        allow_comments: allowComments,
        sections: sections.map((s, i) => ({ heading: s.heading, body: s.body, order: i })),
        published_at: status === 'published' && !post?.published_at ? new Date().toISOString() : post?.published_at || null,
        author_id: authorId,
      };

      if (post) {
        await supabase.from('blog_posts').update(payload).eq('id', post.id);
      } else {
        await supabase.from('blog_posts').insert(payload);
      }

      onSaved();
    } catch (err) {
      console.error('Error saving blog post:', err);
      alert('Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={post ? 'Edit Blog Post' : 'New Blog Post'} size="xl">
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Meta fields */}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Title" value={title} onChange={(e: any) => setTitle(e.target.value)} placeholder="Post title" />
          <Input label="Slug" value={slug} onChange={(e: any) => setSlug(e.target.value)} placeholder="url-friendly-slug" />
        </div>
        <Textarea label="Excerpt" value={excerpt} onChange={(e: any) => setExcerpt(e.target.value)} placeholder="Brief description shown in listings..." rows={2} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Cover Image URL" value={coverUrl} onChange={(e: any) => setCoverUrl(e.target.value)} placeholder="https://..." />
          <Input label="Tags (comma-separated)" value={tags} onChange={(e: any) => setTags(e.target.value)} placeholder="update, feature, devlog" />
        </div>
        <div className="grid grid-cols-2 gap-4 items-end">
          <Select
            label="Status"
            value={status}
            onChange={(e: any) => setStatus(e.target.value)}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer pb-2.5">
            <input
              type="checkbox"
              checked={allowComments}
              onChange={(e) => setAllowComments(e.target.checked)}
              className="rounded border-surface-600 bg-surface-900 text-brand-500 focus:ring-brand-500"
            />
            Allow comments
          </label>
        </div>

        {/* Sections editor */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-surface-300">Sections</label>
            <Button variant="ghost" size="sm" onClick={addSection}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Section
            </Button>
          </div>
          <div className="space-y-4">
            {sections.map((section, idx) => (
              <div key={idx} className="rounded-lg border border-surface-800 bg-surface-900/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] text-surface-500 font-mono bg-surface-800 px-2 py-0.5 rounded">
                    Section {idx + 1}
                  </span>
                  <div className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => moveSection(idx, -1)} disabled={idx === 0}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => moveSection(idx, 1)} disabled={idx === sections.length - 1}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </Button>
                  {sections.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeSection(idx)}>
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                  )}
                </div>
                <Input
                  placeholder="Section heading (optional)"
                  value={section.heading}
                  onChange={(e: any) => updateSection(idx, 'heading', e.target.value)}
                />
                <div className="mt-2">
                  <textarea
                    value={section.body}
                    onChange={(e) => updateSection(idx, 'body', e.target.value)}
                    placeholder="Section content... (use blank lines for paragraph breaks)"
                    rows={6}
                    className="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder:text-surface-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none transition-colors font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cover preview */}
        {coverUrl && (
          <div>
            <label className="text-sm font-medium text-surface-300 block mb-2">Cover Preview</label>
            <div className="rounded-lg overflow-hidden border border-surface-800 max-h-48">
              <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          </div>
        )}

        {/* Save */}
        <div className="flex justify-end gap-3 pt-4 border-t border-surface-800">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>
            {post ? 'Update Post' : 'Create Post'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
