'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/stores';
import { Button, Card, Badge, Avatar, LoadingPage, EmptyState, Modal, Input, Textarea, Select, KeyboardShortcuts, toast } from '@/components/ui';
import { pickToast, NEW_PROJECT } from '@/lib/funToasts';
import { useCommandPalette } from '@/components/ui/CommandPalette';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { SupportButton } from '@/components/SupportButton';
import { GuidedTour } from '@/components/GuidedTour';
import { GamificationOptIn } from '@/components/GamificationOptIn';
import { LevelUpCelebration } from '@/components/LevelUpCelebration';
import { useGamification } from '@/hooks/useGamification';
import { Icon } from '@/components/ui/icons';
import { useFeatureAccess } from '@/components/FeatureGate';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDate, timeAgo, cn } from '@/lib/utils';
import { useRecentProjects } from '@/hooks/useRecentProjects';
import type { Project, ScriptType, ProjectType, Company, CompanyMember, CompanyRole, DashboardFolder } from '@/lib/types';
import { FORMAT_OPTIONS, GENRE_OPTIONS, SCRIPT_TYPE_OPTIONS, PROJECT_TYPE_OPTIONS, AUDIO_DRAMA_FORMAT_OPTIONS } from '@/lib/types';

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || '';

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { canUse: canUseFeature } = useFeatureAccess();
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
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);

  // Folder state
  const [folders, setFolders] = useState<DashboardFolder[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');
  const [moveMenuProjectId, setMoveMenuProjectId] = useState<string | null>(null);
  // Drag-and-drop state
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // folder id or 'unfiled'
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  // View mode (grid / list) — persisted to localStorage
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() =>
    typeof window !== 'undefined' ? ((localStorage.getItem('dashboard-view-mode') as 'grid' | 'list') || 'grid') : 'grid'
  );
  const [newSubFolderParentId, setNewSubFolderParentId] = useState<string | null>(null);
  const [newSubFolderName, setNewSubFolderName] = useState('');

  // Initialise realtime notifications
  useNotifications(user?.id);

  // Gamification — opt-in popup + level-up celebration
  const { levelUpEvent, dismissLevelUp } = useGamification();

  // Guided tour (triggered after onboarding via ?tour=1 query param)
  const searchParams = useSearchParams();
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (searchParams.get('tour') === '1') {
      setShowTour(true);
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams]);

  const palette = useCommandPalette();

  const { recentProjects, clearRecent } = useRecentProjects();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') { e.preventDefault(); setShowShortcuts(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); setShowNewProject(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); palette.open(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    fetchPendingInvitations();
    fetchFolders();
  }, [user, authLoading]);

  const fetchProjects = async () => {
    if (!user?.id) return;
    try {
      const supabase = createClient();

      // Get project IDs where user is a member (but not creator)
      const { data: memberships } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);
      const memberProjectIds = (memberships || []).map((m) => m.project_id);

      // Fetch projects the user created OR is a member of (personal, non-company)
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .is('company_id', null)
        .or(`created_by.eq.${user.id}${memberProjectIds.length ? `,id.in.(${memberProjectIds.join(',')})` : ''}`)
        .order('updated_at', { ascending: false });
      if (error) console.error('Error fetching projects:', error.message);

      const projectList = data || [];

      // Fetch this user's personal folder assignments (private per-user, not on the project row)
      const { data: assignments } = await supabase
        .from('user_project_folder_assignments')
        .select('project_id, folder_id')
        .eq('user_id', user.id);
      const folderMap = new Map(
        (assignments || []).map((a: { project_id: string; folder_id: string | null }) => [a.project_id, a.folder_id])
      );
      // Override folder_id on each project with the user's personal assignment
      setProjects(projectList.map((p) => ({ ...p, folder_id: folderMap.has(p.id) ? folderMap.get(p.id) ?? null : null })));
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

      const validMemberships = (memberships || []).filter((m: { company?: Company }) => m.company) as (CompanyMember & { company: Company })[];
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

  const fetchPendingInvitations = async () => {
    if (!user?.id) return;
    try {
      const supabase = createClient();
      const { data } = await supabase.rpc('get_pending_invitations');
      if (data && Array.isArray(data)) {
        setPendingInvitations(data);
      }
    } catch (err) {
      // Silently fail — not critical
    }
  };

  const fetchFolders = async () => {
    if (!user?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('dashboard_folders')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order')
      .order('name');
    const folderData = data || [];
    setFolders(folderData);
    // Init collapsed state from DB-persisted is_collapsed flag
    setCollapsedFolders(new Set(folderData.filter(f => f.is_collapsed).map(f => f.id)));
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name || !user?.id) return;
    const supabase = createClient();
    const COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#06b6d4'];
    const color = COLORS[folders.length % COLORS.length];
    await supabase.from('dashboard_folders').insert({ user_id: user.id, name, color, sort_order: folders.length });
    setNewFolderName('');
    setShowNewFolderInput(false);
    fetchFolders();
  };

  const renameFolder = async (id: string, name: string) => {
    if (!name.trim()) return;
    const supabase = createClient();
    await supabase.from('dashboard_folders').update({ name: name.trim() }).eq('id', id);
    setRenamingFolderId(null);
    fetchFolders();
  };

  const deleteFolder = async (id: string) => {
    if (!confirm('Delete this folder? Projects inside will be unfiled.')) return;
    const supabase = createClient();
    // Deleting the folder row triggers ON DELETE SET NULL in user_project_folder_assignments,
    // so assignments are automatically cleared — no need to touch projects directly.
    await supabase.from('dashboard_folders').delete().eq('id', id);
    fetchFolders();
    fetchProjects(); // re-syncs folder_id from junction table
  };

  const moveToFolder = async (projectId: string, folderId: string | null) => {
    if (!user?.id) return;
    const supabase = createClient();
    if (folderId === null) {
      // Unfile: remove junction row
      await supabase
        .from('user_project_folder_assignments')
        .delete()
        .eq('user_id', user.id)
        .eq('project_id', projectId);
    } else {
      // Assign to folder: upsert junction row
      await supabase
        .from('user_project_folder_assignments')
        .upsert(
          { user_id: user.id, project_id: projectId, folder_id: folderId },
          { onConflict: 'user_id,project_id' }
        );
    }
    setMoveMenuProjectId(null);
    // Optimistic local update
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, folder_id: folderId } : p));
  };

  const toggleFolder = async (id: string) => {
    const newIsCollapsed = !collapsedFolders.has(id);
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      newIsCollapsed ? next.add(id) : next.delete(id);
      return next;
    });
    const supabase = createClient();
    await supabase.from('dashboard_folders').update({ is_collapsed: newIsCollapsed }).eq('id', id);
  };

  const reorderFolders = async (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const rest = folders.filter(f => f.id !== draggedId);
    const dragged = folders.find(f => f.id === draggedId);
    if (!dragged) return;
    const targetIdx = rest.findIndex(f => f.id === targetId);
    const reordered = [...rest.slice(0, targetIdx), dragged, ...rest.slice(targetIdx)];
    setFolders(reordered.map((f, i) => ({ ...f, sort_order: i })));
    const supabase = createClient();
    await Promise.all(reordered.map((f, i) =>
      supabase.from('dashboard_folders').update({ sort_order: i }).eq('id', f.id)
    ));
  };

  const createSubFolder = async (parentId: string) => {
    const name = newSubFolderName.trim();
    if (!name || !user?.id) return;
    const supabase = createClient();
    const COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#06b6d4'];
    const color = COLORS[folders.length % COLORS.length];
    await supabase.from('dashboard_folders').insert({ user_id: user.id, name, color, sort_order: folders.length, parent_id: parentId });
    setNewSubFolderName('');
    setNewSubFolderParentId(null);
    fetchFolders();
  };

  const toggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('dashboard-view-mode', mode);
  };

  const acceptInvitation = async (invitationId: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc('accept_company_invitation', { p_invitation_id: invitationId });
    if (!error) {
      setPendingInvitations(prev => prev.filter(i => i.id !== invitationId));
      fetchCompanyData();
    }
  };

  const declineInvitation = async (invitationId: string) => {
    const supabase = createClient();
    await supabase.rpc('decline_company_invitation', { p_invitation_id: invitationId });
    setPendingInvitations(prev => prev.filter(i => i.id !== invitationId));
  };

  if (authLoading || (!user && loading)) return <LoadingPage />;

  const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    development: 'info',
    pre_production: 'warning',
    production: 'success',
    post_production: 'warning',
    completed: 'success',
    archived: 'default',
  };

  return (
    <div className="min-h-screen" style={{ background: '#070710' }} id="main-content">
      {/* Top Bar */}
      <header
        className="sticky top-0 z-40 backdrop-blur-xl"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(7,7,16,0.88)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0" style={{ background: '#FF5F1F' }}>
              <span className="font-black text-white text-sm" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <h1 className="text-sm sm:text-base font-black text-white uppercase" style={{ letterSpacing: '-0.02em' }}>Screenplay Studio</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/blog" className="text-xs text-surface-500 hover:text-surface-300 transition-colors hidden sm:inline">
              Blog
            </Link>
            <Link href="/about" className="text-xs text-surface-500 hover:text-surface-300 transition-colors hidden sm:inline">
              About
            </Link>
            {user?.show_community !== false && canUseFeature('community') && (
              <Link href="/community" className="text-xs text-surface-500 hover:text-surface-300 transition-colors hidden sm:inline">
                Community
              </Link>
            )}
            {companyMemberships.length > 0 && (
              <Link href="/company" className="text-xs text-surface-500 hover:text-surface-300 transition-colors hidden sm:inline">
                Company
              </Link>
            )}
            {(user?.id === ADMIN_UID || user?.role === 'moderator' || user?.role === 'admin') && (
              <Link href="/admin" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${user?.role === 'admin' || user?.id === ADMIN_UID ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20' : 'text-green-400 bg-green-500/10 hover:bg-green-500/20 border-green-500/20'}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {user?.role === 'admin' || user?.id === ADMIN_UID ? 'Admin' : 'Mod Panel'}
              </Link>
            )}
            <Button onClick={() => setShowNewProject(true)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </Button>
            <Link href="/messages" className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-white/5 transition-colors relative" title="Messages">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </Link>
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{user?.display_name || user?.full_name || 'User'}</p>
                        {user?.is_pro && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 font-semibold">PRO</span>}
                      </div>
                      <p className="text-[11px] text-surface-500 truncate">{user?.email}</p>
                    </div>
                    {!user?.is_pro && (
                      <Link href="/settings" className="flex items-center gap-2.5 px-4 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                        onClick={() => setShowUserMenu(false)}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Settings
                      </Link>
                    )}
                    {user?.is_pro && canUseFeature('pro_subscription') && (
                      <Link href="/settings/billing" className="flex items-center gap-2.5 px-4 py-2 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
                        onClick={() => setShowUserMenu(false)}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3l3.057 7.811L12 7.5l3.943 3.311L19 3M5 3l.783 4M19 3l-.783 4M5.783 7L3 21h18l-2.783-14M5.783 7h12.434" /></svg>
                        Pro &amp; Billing
                      </Link>
                    )}
                    {user?.is_pro && (
                      <Link href="/settings" className="flex items-center gap-2.5 px-4 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                        onClick={() => setShowUserMenu(false)}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Settings
                      </Link>
                    )}
                    <Link href="/notifications" className="flex items-center gap-2.5 px-4 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                      onClick={() => setShowUserMenu(false)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                      Notifications
                    </Link>
                    {user?.show_community === false && canUseFeature('community') && (
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

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Pending Company Invitations Banner */}
        {pendingInvitations.length > 0 && (
          <div className="mb-6 space-y-3">
            {pendingInvitations.map((inv: { id: string; company_name?: string; company_logo?: string; company_color?: string; role: string; invited_by_name?: string }) => (
              <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#FF5F1F]/30 bg-[#FF5F1F]/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ backgroundColor: inv.company_color || '#3B82F6' }}>
                    {inv.company_logo ? <img src={inv.company_logo} alt={inv.company_name || 'Company logo'} className="w-full h-full object-cover rounded-lg" /> : inv.company_name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      <span className="text-[#FF5F1F]">{inv.company_name}</span> invited you to join as <span className="capitalize text-[#FF8F5F]">{inv.role}</span>
                    </p>
                    {inv.invited_by_name && <p className="text-xs text-surface-500">Invited by {inv.invited_by_name}</p>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => acceptInvitation(inv.id)}>Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => declineInvitation(inv.id)}>Decline</Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Welcome + Stats row */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-3 h-px shrink-0" style={{ background: '#FF5F1F' }} />
              <span className="ss-label">Dashboard</span>
            </div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2" style={{ letterSpacing: '-0.03em' }}>
              WELCOME BACK{user?.full_name ? `, ${user.full_name.split(' ')[0].toUpperCase()}` : ''}
              {user?.is_pro && <span className="text-xs px-2 py-0.5 font-black uppercase tracking-wider" style={{ background: 'rgba(255,95,31,0.12)', color: '#FF5F1F', border: '1px solid rgba(255,95,31,0.2)' }}>Pro</span>}
            </h2>
            <p className="mt-1 text-sm text-white/30">Your film projects and recent work</p>
          </div>
          {/* Inline Stats */}
          {(() => {
            const allP = [...projects, ...Object.values(companyProjects).flat()];
            return (
              <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                {[
                  { label: 'Projects', value: allP.length },
                  { label: 'In Dev', value: allP.filter(p => p.status === 'development').length },
                  { label: 'In Prod', value: allP.filter(p => p.status === 'production').length },
                  { label: 'Done', value: allP.filter(p => p.status === 'completed').length },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-xl font-black text-white ss-stat-num">{s.value}</p>
                    <p className="text-[9px] font-mono text-white/25 uppercase tracking-wider">{s.label}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Continue Writing CTA */}
        {lastProject && (
          <button
            onClick={() => router.push(`/projects/${lastProject.id}/script`)}
            className="w-full mb-8 group rounded-xl border border-surface-800 bg-gradient-to-r from-surface-900 to-surface-900/50 hover:border-[#FF5F1F]/40 p-5 text-left transition-all hover:shadow-lg hover:shadow-brand-500/5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#FF5F1F]/10 flex items-center justify-center text-[#FF5F1F] group-hover:bg-[#FF5F1F]/20 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </div>
                <div>
                  <p className="text-xs text-surface-400">Continue Writing</p>
                  <p className="text-sm font-semibold text-white">{lastProject.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-surface-500">
                <span>Last edited {timeAgo(lastProject.updated_at)}</span>
                <svg className="w-4 h-4 text-surface-600 group-hover:text-[#FF5F1F] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-surface-700 bg-surface-900 text-sm text-white placeholder:text-surface-500 focus:border-[#FF5F1F] focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {['all', 'development', 'pre_production', 'production', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                  filterStatus === status
                    ? 'bg-[#E54E15] text-white'
                    : 'text-surface-400 hover:text-white hover:bg-surface-800'
                )}
              >
                {status === 'all' ? 'All' : status === 'pre_production' ? 'Pre-Prod' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Recently Viewed Strip */}
        {recentProjects.length >= 2 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Recently Viewed</h3>
              <button onClick={clearRecent} className="text-[10px] text-surface-600 hover:text-surface-400 transition-colors">Clear</button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {recentProjects.map(rp => (
                <Link
                  key={rp.id}
                  href={`/projects/${rp.id}`}
                  className="flex-shrink-0 group flex items-center gap-2.5 bg-surface-800/50 hover:bg-surface-800 border border-surface-700/50 hover:border-surface-600 rounded-xl px-3 py-2.5 transition-all"
                >
                  {rp.cover_url ? (
                    <img src={rp.cover_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-surface-400">{(rp.title || '?')[0].toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-surface-200 group-hover:text-white truncate max-w-[120px] transition-colors">{rp.title}</p>
                    <p className="text-[10px] text-surface-500">{timeAgo(rp.viewed_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* My Projects — Folder-organised */}
        <div className="mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
          <h3 className="text-lg font-semibold text-white">My Projects</h3>
          <span className="text-xs text-surface-500">({filteredProjects.length}{searchQuery || filterStatus !== 'all' ? ` of ${projects.length}` : ''})</span>
          <div className="ml-auto flex items-center gap-3">
            {/* Grid / List toggle */}
            <div className="flex items-center gap-0.5 bg-surface-800 rounded-lg p-0.5 border border-surface-700">
              <button
                onClick={() => toggleViewMode('grid')}
                title="Grid view"
                className={cn('p-1.5 rounded transition-colors', viewMode === 'grid' ? 'bg-[#FF5F1F] text-white' : 'text-surface-500 hover:text-surface-300')}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              </button>
              <button
                onClick={() => toggleViewMode('list')}
                title="List view"
                className={cn('p-1.5 rounded transition-colors', viewMode === 'list' ? 'bg-[#FF5F1F] text-white' : 'text-surface-500 hover:text-surface-300')}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              </button>
            </div>
            {showNewFolderInput ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); } }}
                  placeholder="Folder name…"
                  className="w-36 bg-surface-800 border border-surface-700 rounded px-2.5 py-1 text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-[#FF5F1F]"
                />
                <button onClick={createFolder} className="px-2 py-1 text-xs bg-[#FF5F1F] text-white rounded hover:bg-[#E54E15]">Add</button>
                <button onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }} className="px-2 py-1 text-xs text-surface-500 hover:text-white">✕</button>
              </div>
            ) : (
              <button onClick={() => setShowNewFolderInput(true)} className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Folder
              </button>
            )}
          </div>
        </div>

        {filteredProjects.length === 0 && (searchQuery || filterStatus !== 'all') ? (
          <div className="text-center py-12 text-surface-500 text-sm mb-8">
            No projects match your filters.{' '}
            <button onClick={() => { setSearchQuery(''); setFilterStatus('all'); }} className="text-[#FF5F1F] hover:text-[#FF8F5F] transition-colors">Clear filters</button>
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
          <>
            {/* ── Folders ── */}
            {folders.filter(f => !f.parent_id).map(folder => {
              const folderProjects = filteredProjects.filter(p => p.folder_id === folder.id);
              const isCollapsed = collapsedFolders.has(folder.id);
              const isRenaming = renamingFolderId === folder.id;
              const isDragOver = dragOverTarget === folder.id;
              const isFolderDragOver = dragOverFolderId === folder.id;
              const childFolders = folders.filter(f => f.parent_id === folder.id);
              return (
                <div
                  key={folder.id}
                  className={cn('mb-6 rounded-xl transition-all duration-150', isDragOver && 'ring-2 ring-offset-2 ring-offset-[#070710]')}
                  style={isDragOver && folder.color ? { '--tw-ring-color': folder.color } as React.CSSProperties : undefined}
                  onDragOver={e => {
                    e.preventDefault();
                    if (e.dataTransfer.types.includes('folderid')) setDragOverFolderId(folder.id);
                    else setDragOverTarget(folder.id);
                  }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOverTarget(null); setDragOverFolderId(null); } }}
                  onDrop={e => {
                    e.preventDefault();
                    const pid = e.dataTransfer.getData('projectId');
                    const fid = e.dataTransfer.getData('folderId');
                    if (pid) moveToFolder(pid, folder.id);
                    if (fid) reorderFolders(fid, folder.id);
                    setDragOverTarget(null);
                    setDragOverFolderId(null);
                    setDraggingProjectId(null);
                    setDraggingFolderId(null);
                  }}
                >
                  {/* Folder-reorder drop indicator */}
                  {isFolderDragOver && (
                    <div className="mb-2 h-0.5 rounded-full bg-[#FF5F1F]/70 transition-all" />
                  )}
                  {/* Drop zone highlight bar (for projects) */}
                  {isDragOver && !isFolderDragOver && (
                    <div className="mb-2 rounded-lg border-2 border-dashed py-2 px-4 text-xs font-semibold text-center transition-all" style={{ borderColor: folder.color, color: folder.color, backgroundColor: folder.color + '15' }}>
                      Drop into {folder.name}
                    </div>
                  )}
                  <div className={cn('flex items-center gap-2 mb-3 group/folder rounded-lg px-1 transition-colors', draggingFolderId === folder.id && 'opacity-40')}>
                    {/* Drag handle for folder reordering */}
                    <div
                      draggable
                      onDragStart={e => { e.dataTransfer.setData('folderId', folder.id); e.dataTransfer.effectAllowed = 'move'; setDraggingFolderId(folder.id); }}
                      onDragEnd={() => setDraggingFolderId(null)}
                      className="cursor-grab active:cursor-grabbing text-surface-700 hover:text-surface-400 opacity-0 group-hover/folder:opacity-100 transition-opacity"
                      title="Drag to reorder folder"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a1 1 0 000 2h6a1 1 0 100-2H7zM7 8a1 1 0 000 2h6a1 1 0 100-2H7zM7 14a1 1 0 000 2h6a1 1 0 100-2H7z"/></svg>
                    </div>
                    {/* Colour swatch */}
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: folder.color }} />
                    {/* Emoji */}
                    {folder.emoji && <span className="text-sm">{folder.emoji}</span>}
                    {/* Name / rename */}
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renamingName}
                        onChange={e => setRenamingName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') renameFolder(folder.id, renamingName); if (e.key === 'Escape') setRenamingFolderId(null); }}
                        onBlur={() => renameFolder(folder.id, renamingName)}
                        className="text-sm font-semibold bg-surface-800 border border-surface-600 rounded px-2 py-0.5 text-white focus:outline-none w-44"
                      />
                    ) : (
                      <button
                        onClick={() => toggleFolder(folder.id)}
                        className="text-sm font-semibold text-white/80 hover:text-white flex items-center gap-1.5"
                      >
                        <svg className={cn('w-3.5 h-3.5 text-surface-500 transition-transform', isCollapsed && '-rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        {folder.name}
                      </button>
                    )}
                    <span className="text-[10px] text-surface-600">({folderProjects.length + childFolders.reduce((acc, c) => acc + filteredProjects.filter(p => p.folder_id === c.id).length, 0)})</span>
                    {/* Folder actions */}
                    <div className="ml-1 flex items-center gap-1 opacity-0 group-hover/folder:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setRenamingFolderId(folder.id); setRenamingName(folder.name); }}
                        className="text-[10px] text-surface-500 hover:text-white px-1.5 py-0.5 rounded hover:bg-surface-800"
                      >Rename</button>
                      <button
                        onClick={() => { setNewSubFolderParentId(newSubFolderParentId === folder.id ? null : folder.id); setNewSubFolderName(''); }}
                        className="text-[10px] text-surface-500 hover:text-white px-1.5 py-0.5 rounded hover:bg-surface-800"
                        title="Add subfolder"
                      >+ Sub</button>
                      <button
                        onClick={() => deleteFolder(folder.id)}
                        className="text-[10px] text-surface-600 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-surface-800"
                      >Delete</button>
                    </div>
                  </div>
                  {/* Subfolder creation input */}
                  {newSubFolderParentId === folder.id && (
                    <div className="flex items-center gap-1 mb-3 ml-7">
                      <input
                        autoFocus
                        value={newSubFolderName}
                        onChange={e => setNewSubFolderName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') createSubFolder(folder.id); if (e.key === 'Escape') { setNewSubFolderParentId(null); setNewSubFolderName(''); } }}
                        placeholder="Subfolder name…"
                        className="w-36 bg-surface-800 border border-surface-700 rounded px-2.5 py-1 text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-[#FF5F1F]"
                      />
                      <button onClick={() => createSubFolder(folder.id)} className="px-2 py-1 text-xs bg-[#FF5F1F] text-white rounded hover:bg-[#E54E15]">Add</button>
                      <button onClick={() => { setNewSubFolderParentId(null); setNewSubFolderName(''); }} className="px-2 py-1 text-xs text-surface-500 hover:text-white">✕</button>
                    </div>
                  )}
                  {!isCollapsed && (
                    <>
                      {folderProjects.length === 0 && childFolders.length === 0 ? (
                        <div className={cn('border border-dashed rounded-xl p-6 text-center text-xs transition-colors', isDragOver ? 'border-current bg-current/10' : 'border-surface-800 text-surface-600')} style={isDragOver ? { borderColor: folder.color, color: folder.color } : {}}>
                          {isDragOver ? `Drop here →` : 'No projects in this folder yet.'}
                        </div>
                      ) : (
                        folderProjects.length > 0 && (
                          viewMode === 'list' ? (
                            <div className="flex flex-col gap-2">
                              {folderProjects.map(project => (
                                <ProjectCard key={project.id} project={project} folders={folders} moveMenuProjectId={moveMenuProjectId} setMoveMenuProjectId={setMoveMenuProjectId} moveToFolder={moveToFolder} statusColors={statusColors} draggingProjectId={draggingProjectId} setDraggingProjectId={setDraggingProjectId} viewMode={viewMode} />
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {folderProjects.map(project => (
                                <ProjectCard key={project.id} project={project} folders={folders} moveMenuProjectId={moveMenuProjectId} setMoveMenuProjectId={setMoveMenuProjectId} moveToFolder={moveToFolder} statusColors={statusColors} draggingProjectId={draggingProjectId} setDraggingProjectId={setDraggingProjectId} viewMode={viewMode} />
                              ))}
                            </div>
                          )
                        )
                      )}
                      {/* ── Subfolders ── */}
                      {childFolders.map(child => {
                        const childProjects = filteredProjects.filter(p => p.folder_id === child.id);
                        const childCollapsed = collapsedFolders.has(child.id);
                        const isDragOverChild = dragOverTarget === child.id;
                        const isRenamingChild = renamingFolderId === child.id;
                        return (
                          <div key={child.id}
                            className="mt-4 ml-5 pl-4 border-l-2"
                            style={{ borderColor: child.color + '50' }}
                            onDragOver={e => { e.preventDefault(); setDragOverTarget(child.id); }}
                            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTarget(null); }}
                            onDrop={e => { e.preventDefault(); const pid = e.dataTransfer.getData('projectId'); if (pid) moveToFolder(pid, child.id); setDragOverTarget(null); setDraggingProjectId(null); }}
                          >
                            <div className="flex items-center gap-2 mb-2 group/child">
                              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: child.color }} />
                              {child.emoji && <span className="text-xs">{child.emoji}</span>}
                              {isRenamingChild ? (
                                <input
                                  autoFocus
                                  value={renamingName}
                                  onChange={e => setRenamingName(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') renameFolder(child.id, renamingName); if (e.key === 'Escape') setRenamingFolderId(null); }}
                                  onBlur={() => renameFolder(child.id, renamingName)}
                                  className="text-xs font-semibold bg-surface-800 border border-surface-600 rounded px-2 py-0.5 text-white focus:outline-none w-36"
                                />
                              ) : (
                                <button onClick={() => toggleFolder(child.id)} className="text-xs font-semibold text-white/70 hover:text-white flex items-center gap-1">
                                  <svg className={cn('w-3 h-3 text-surface-500 transition-transform', childCollapsed && '-rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                  {child.name}
                                </button>
                              )}
                              <span className="text-[10px] text-surface-700">({childProjects.length})</span>
                              <div className="ml-1 flex items-center gap-1 opacity-0 group-hover/child:opacity-100 transition-opacity">
                                <button onClick={() => { setRenamingFolderId(child.id); setRenamingName(child.name); }} className="text-[10px] text-surface-500 hover:text-white px-1 py-0.5 rounded hover:bg-surface-800">Rename</button>
                                <button onClick={() => deleteFolder(child.id)} className="text-[10px] text-surface-600 hover:text-red-400 px-1 py-0.5 rounded hover:bg-surface-800">Delete</button>
                              </div>
                            </div>
                            {!childCollapsed && (
                              childProjects.length === 0 ? (
                                <div className={cn('border border-dashed rounded-lg p-4 text-center text-xs', isDragOverChild ? 'border-current' : 'border-surface-800 text-surface-700')} style={isDragOverChild ? { borderColor: child.color, color: child.color } : {}}>
                                  {isDragOverChild ? 'Drop here →' : 'Empty subfolder'}
                                </div>
                              ) : viewMode === 'list' ? (
                                <div className="flex flex-col gap-2">
                                  {childProjects.map(project => (
                                    <ProjectCard key={project.id} project={project} folders={folders} moveMenuProjectId={moveMenuProjectId} setMoveMenuProjectId={setMoveMenuProjectId} moveToFolder={moveToFolder} statusColors={statusColors} draggingProjectId={draggingProjectId} setDraggingProjectId={setDraggingProjectId} viewMode={viewMode} />
                                  ))}
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {childProjects.map(project => (
                                    <ProjectCard key={project.id} project={project} folders={folders} moveMenuProjectId={moveMenuProjectId} setMoveMenuProjectId={setMoveMenuProjectId} moveToFolder={moveToFolder} statusColors={statusColors} draggingProjectId={draggingProjectId} setDraggingProjectId={setDraggingProjectId} viewMode={viewMode} />
                                  ))}
                                </div>
                              )
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}

            {/* ── Unfiled projects ── */}
            {(() => {
              const unfiled = filteredProjects.filter(p => !p.folder_id);
              const isDragOver = dragOverTarget === 'unfiled';
              if (unfiled.length === 0 && folders.length > 0 && !isDragOver) return null;
              return (
                <div
                  className={cn('mt-2 rounded-xl transition-all duration-150', isDragOver && 'ring-2 ring-surface-600 ring-offset-2 ring-offset-[#070710]')}
                  onDragOver={e => { e.preventDefault(); setDragOverTarget('unfiled'); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTarget(null); }}
                  onDrop={e => {
                    e.preventDefault();
                    const pid = e.dataTransfer.getData('projectId');
                    if (pid) moveToFolder(pid, null);
                    setDragOverTarget(null);
                    setDraggingProjectId(null);
                  }}
                >
                  {folders.length > 0 && (
                    <div className={cn('flex items-center gap-2 mb-3 text-sm font-semibold transition-colors', isDragOver ? 'text-white' : 'text-surface-500')}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                      Unfiled
                      <span className="text-[10px] text-surface-700">({unfiled.length})</span>
                      {isDragOver && <span className="text-xs text-surface-400 ml-1">← drop to unfile</span>}
                    </div>
                  )}
                  {isDragOver && unfiled.length === 0 ? (
                    <div className="border border-dashed border-surface-600 rounded-xl p-6 text-center text-xs text-surface-400">
                      Drop here to remove from folder
                    </div>
                  ) : viewMode === 'list' ? (
                    <div className="flex flex-col gap-2">
                      {unfiled.map(project => (
                        <ProjectCard key={project.id} project={project} folders={folders} moveMenuProjectId={moveMenuProjectId} setMoveMenuProjectId={setMoveMenuProjectId} moveToFolder={moveToFolder} statusColors={statusColors} draggingProjectId={draggingProjectId} setDraggingProjectId={setDraggingProjectId} viewMode={viewMode} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {unfiled.map(project => (
                        <ProjectCard key={project.id} project={project} folders={folders} moveMenuProjectId={moveMenuProjectId} setMoveMenuProjectId={setMoveMenuProjectId} moveToFolder={moveToFolder} statusColors={statusColors} draggingProjectId={draggingProjectId} setDraggingProjectId={setDraggingProjectId} viewMode={viewMode} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
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
                    <img src={company.logo_url} alt={company.name || 'Company logo'} className="w-7 h-7 rounded-lg object-cover" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: company.brand_color || '#6366f1' }}
                    >
                      {company.name[0]}
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-white group-hover:text-[#FF5F1F] transition-colors">{company.name}</h3>
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
                        <div className="h-36 bg-gradient-to-br from-surface-800 to-surface-900 relative overflow-hidden">
                          {project.cover_url ? (
                            <img src={project.cover_url} alt={project.title || 'Project cover'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-5xl font-bold text-surface-700/60 group-hover:text-surface-600/60 transition-colors select-none">
                                {project.title[0]}
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent" />
                          <div className="absolute top-2.5 left-2.5">
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white"
                              style={{ backgroundColor: company.brand_color || '#6366f1' }}
                              title={company.name}
                            >
                              {company.name[0]}
                            </div>
                          </div>
                          <div className="absolute top-2.5 right-2.5">
                            <Badge variant={statusColors[project.status]}>
                              {project.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="text-base font-semibold text-white group-hover:text-[#FF5F1F] transition-colors truncate">
                            {project.title}
                          </h3>
                          {project.logline && (
                            <p className="mt-1 text-xs text-surface-400 line-clamp-2 leading-relaxed">{project.logline}</p>
                          )}
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex gap-1">
                              {project.genre?.slice(0, 2).map((g) => (
                                <Badge key={g} size="sm">{g}</Badge>
                              ))}
                              {(project.genre?.length || 0) > 2 && (
                                <span className="text-[10px] text-surface-500">+{(project.genre?.length || 0) - 2}</span>
                              )}
                            </div>
                            <span className="text-[10px] text-surface-600">{timeAgo(project.updated_at)}</span>
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

      <SupportButton />

      {/* Guided Tour */}
      {showTour && (
        <GuidedTour
          onComplete={() => setShowTour(false)}
          usageIntent={user?.usage_intent ?? 'writer'}
          projectId={projects[0]?.id ?? null}
        />
      )}

      {/* Gamification popups */}
      <GamificationOptIn />
      {levelUpEvent && (
        <LevelUpCelebration level={levelUpEvent.newLevel} unlocks={levelUpEvent.unlocks} onDismiss={dismissLevelUp} />
      )}
    </div>
  );
}

// ─── Project Card ──────────────────────────────────────────
function ProjectCard({
  project, folders, moveMenuProjectId, setMoveMenuProjectId, moveToFolder, statusColors,
  draggingProjectId, setDraggingProjectId, viewMode,
}: {
  project: Project;
  folders: DashboardFolder[];
  moveMenuProjectId: string | null;
  setMoveMenuProjectId: (id: string | null) => void;
  moveToFolder: (projectId: string, folderId: string | null) => void;
  statusColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'>;
  draggingProjectId: string | null;
  setDraggingProjectId: (id: string | null) => void;
  viewMode?: 'grid' | 'list';
}) {
  const isMenuOpen = moveMenuProjectId === project.id;
  const isDragging = draggingProjectId === project.id;
  const currentFolder = folders.find(f => f.id === project.folder_id);

  // List row view
  if (viewMode === 'list') {
    return (
      <div
        className={cn('relative group transition-all duration-150', isDragging && 'opacity-40 cursor-grabbing')}
        draggable
        onDragStart={e => { e.dataTransfer.setData('projectId', project.id); e.dataTransfer.effectAllowed = 'move'; setDraggingProjectId(project.id); }}
        onDragEnd={() => setDraggingProjectId(null)}
      >
        <Link href={`/projects/${project.id}`}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-surface-800 bg-surface-900/50 hover:border-surface-700 hover:bg-surface-800/50 transition-all group">
            {/* Thumbnail */}
            <div className="w-10 h-10 rounded-lg bg-surface-800 overflow-hidden flex-shrink-0">
              {project.cover_url ? (
                <img src={project.cover_url} alt={project.title || 'Project cover'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-lg font-bold text-surface-600">{project.title[0]}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white group-hover:text-[#FF5F1F] transition-colors truncate">{project.title}</p>
              {project.logline && <p className="text-xs text-surface-500 truncate">{project.logline}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {project.genre?.slice(0, 1).map((g) => <Badge key={g} size="sm">{g}</Badge>)}
              <Badge variant={statusColors[project.status]} size="sm">{project.status.replace('_', ' ')}</Badge>
              <span className="text-[10px] text-surface-600 hidden sm:inline">{timeAgo(project.updated_at)}</span>
            </div>
          </div>
        </Link>
        {/* Move folder button */}
        {folders.length > 0 && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10" onClick={e => e.preventDefault()}>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); setMoveMenuProjectId(isMenuOpen ? null : project.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded bg-black/60 text-white hover:bg-black/80 transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoveMenuProjectId(null)} />
                <div className="absolute right-0 top-6 z-50 w-44 bg-surface-900 border border-surface-700 rounded-lg shadow-xl py-1 text-xs">
                  <div className="px-3 py-1.5 text-[10px] text-surface-500 uppercase tracking-wider font-bold border-b border-surface-800 mb-1">Move to folder</div>
                  {project.folder_id && (
                    <button onClick={() => moveToFolder(project.id, null)} className="flex items-center gap-2 w-full px-3 py-1.5 text-surface-400 hover:bg-surface-800 hover:text-white">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      Remove from folder
                    </button>
                  )}
                  {folders.map(f => (
                    <button key={f.id} onClick={() => moveToFolder(project.id, f.id)} className={cn('flex items-center gap-2 w-full px-3 py-1.5 hover:bg-surface-800 transition-colors', project.folder_id === f.id ? 'text-white' : 'text-surface-300 hover:text-white')}>
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: f.color }} />
                      {f.emoji && <span>{f.emoji}</span>}
                      <span className="truncate">{f.name}</span>
                      {project.folder_id === f.id && <svg className="w-3 h-3 ml-auto text-[#FF5F1F] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.293 9.879a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn('relative group transition-all duration-150', isDragging && 'opacity-40 scale-95 cursor-grabbing')}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('projectId', project.id);
        e.dataTransfer.effectAllowed = 'move';
        setDraggingProjectId(project.id);
      }}
      onDragEnd={() => setDraggingProjectId(null)}
    >
      <Link href={`/projects/${project.id}`}>
        <Card hover className="overflow-hidden group">
          <div className="h-36 bg-gradient-to-br from-surface-800 to-surface-900 relative overflow-hidden">
            {project.cover_url ? (
              <img src={project.cover_url} alt={project.title || 'Project cover'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-5xl font-bold text-surface-700/60 group-hover:text-surface-600/60 transition-colors select-none">
                  {project.title[0]}
                </span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute top-2.5 right-2.5">
              <Badge variant={statusColors[project.status]}>
                {project.status.replace('_', ' ')}
              </Badge>
            </div>
            {currentFolder && (
              <div className="absolute top-2.5 left-2.5">
                <span className="text-[9px] font-bold text-white/80 px-1.5 py-0.5 rounded" style={{ backgroundColor: currentFolder.color + 'cc' }}>
                  {currentFolder.emoji ? `${currentFolder.emoji} ` : ''}{currentFolder.name}
                </span>
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="text-base font-semibold text-white group-hover:text-[#FF5F1F] transition-colors truncate">
              {project.title}
            </h3>
            {project.logline && (
              <p className="mt-1 text-xs text-surface-400 line-clamp-2 leading-relaxed">{project.logline}</p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1">
                {project.genre?.slice(0, 2).map((g) => (
                  <Badge key={g} size="sm">{g}</Badge>
                ))}
                {(project.genre?.length || 0) > 2 && (
                  <span className="text-[10px] text-surface-500">+{(project.genre?.length || 0) - 2}</span>
                )}
              </div>
              <span className="text-[10px] text-surface-600">{timeAgo(project.updated_at)}</span>
            </div>
          </div>
        </Card>
      </Link>

      {/* Move to folder button — shows on hover */}
      {folders.length > 0 && (
        <div className="absolute top-2.5 left-2.5 z-10" onClick={e => e.preventDefault()}>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setMoveMenuProjectId(isMenuOpen ? null : project.id); }}
            className={cn(
              'p-1 rounded text-[10px] transition-all',
              currentFolder ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100',
              'bg-black/60 text-white hover:bg-black/80',
            )}
            title="Move to folder"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMoveMenuProjectId(null)} />
              <div className="absolute top-6 left-0 z-50 w-44 bg-surface-900 border border-surface-700 rounded-lg shadow-xl py-1 text-xs">
                <div className="px-3 py-1.5 text-[10px] text-surface-500 uppercase tracking-wider font-bold border-b border-surface-800 mb-1">Move to folder</div>
                {project.folder_id && (
                  <button onClick={() => moveToFolder(project.id, null)} className="flex items-center gap-2 w-full px-3 py-1.5 text-surface-400 hover:bg-surface-800 hover:text-white">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    Remove from folder
                  </button>
                )}
                {folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => moveToFolder(project.id, f.id)}
                    className={cn('flex items-center gap-2 w-full px-3 py-1.5 hover:bg-surface-800 transition-colors', project.folder_id === f.id ? 'text-white' : 'text-surface-300 hover:text-white')}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: f.color }} />
                    {f.emoji && <span>{f.emoji}</span>}
                    <span className="truncate">{f.name}</span>
                    {project.folder_id === f.id && <svg className="w-3 h-3 ml-auto text-[#FF5F1F] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.293 9.879a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
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
  const [projectType, setProjectType] = useState<ProjectType>('film');
  const [genre, setGenre] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0); // 0 = script type, 1 = details
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [seasonNumber, setSeasonNumber] = useState('1');
  const [episodeCount, setEpisodeCount] = useState('');
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; description?: string; project_type: string; script_type?: string; genre?: string; format?: string; structure_snapshot?: any }>>([]);

  useEffect(() => {
    if (!isOpen || !userId) return;
    const supabase = createClient();
    supabase
      .from('project_templates')
      .select('id, name, description, project_type, script_type, genre, format, structure_snapshot')
      .or(`user_id.eq.${userId},is_public.eq.true`)
      .order('use_count', { ascending: false })
      .limit(6)
      .then(({ data }) => setTemplates(data || []));
  }, [isOpen, userId]);

  const applyTemplate = (t: typeof templates[0]) => {
    if (t.project_type) setProjectType(t.project_type as ProjectType);
    if (t.script_type) setScriptType(t.script_type as ScriptType);
    if (t.genre) setGenre([t.genre]);
    if (t.format) setFormat(t.format);
    setStep(1);
  };

  // Determine if this is a content creator project
  const isContentCreator = ['youtube', 'tiktok'].includes(scriptType);
  const isTvProduction = projectType === 'tv_production';
  const isAudioOrPodcast = scriptType === 'podcast' || scriptType === 'audio_drama';
  const isAudioDrama = (isAudioOrPodcast && ['bbc_radio', 'us_radio', 'starc_standard'].includes(format)) || projectType === 'audio_drama';
  const isEpisodic = scriptType === 'episodic';

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
      
      // Set project type based on script type
      let finalProjectType: ProjectType = projectType;
      if (projectType === 'tv_production') finalProjectType = 'tv_production';
      else if (isAudioOrPodcast && ['bbc_radio', 'us_radio', 'starc_standard'].includes(format)) finalProjectType = 'audio_drama';
      else if (isAudioOrPodcast) finalProjectType = 'podcast';
      else if (scriptType === 'youtube') finalProjectType = 'youtube';
      else if (scriptType === 'tiktok') finalProjectType = 'tiktok';
      else finalProjectType = 'film';
      
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert({
          title: title.trim(),
          logline: logline.trim() || null,
          format,
          genre,
          script_type: scriptType,
          project_type: finalProjectType,
          created_by: userId,
          company_id: selectedCompanyId || null,
          ...(scriptType === 'episodic' ? {
            season_number: seasonNumber ? parseInt(seasonNumber, 10) : 1,
            episode_count: episodeCount ? parseInt(episodeCount, 10) : null,
          } : {}),
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
        toast.success(pickToast(NEW_PROJECT));
        router.push(scriptType === 'episodic' ? `/projects/${data.id}/episodes` : `/projects/${data.id}`);
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
    <Modal isOpen={isOpen} onClose={onClose} title={step === 0 ? 'What are you creating?' : 'Project Details'} size="lg">
      {step === 0 ? (
        <div className="space-y-6">
          {/* Templates — shown if user has any */}
          {templates.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Start from template</p>
              <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="flex items-center gap-2 px-3 py-2 bg-surface-800 hover:bg-surface-700 border border-surface-700 hover:border-[#FF5F1F]/40 rounded-lg text-left transition-all"
                  >
                    <span className="text-sm">📋</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-surface-200 truncate max-w-[120px]">{t.name}</p>
                      {t.description && <p className="text-[10px] text-surface-500 truncate max-w-[120px]">{t.description}</p>}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3 border-t border-surface-800" />
            </div>
          )}

          <p className="text-sm text-surface-400">Choose the type of project you want to create.</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

            {/* TV Production — amber accent grid item */}
            <button
              type="button"
              onClick={() => {
                setProjectType('tv_production');
                setScriptType('screenplay');
              }}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                projectType === 'tv_production'
                  ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                  : 'border-surface-700 bg-surface-800/50 hover:border-amber-500/30 hover:bg-surface-800'
              }`}
            >
              <div className={`transition-colors ${projectType === 'tv_production' ? 'text-amber-400' : 'text-surface-400'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <h3 className={`text-sm font-semibold ${projectType === 'tv_production' ? 'text-amber-400' : 'text-white'}`}>TV Production</h3>
                <span className="text-[9px] px-1 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider">Pro</span>
              </div>
              <p className="mt-0.5 text-[10px] text-surface-500">Broadcast & studio — rundown, autocue, crew</p>
            </button>

            {/* Standard script-type options */}
            {SCRIPT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setScriptType(opt.value);
                  setProjectType('film');
                  if (opt.value === 'podcast') setFormat('starc_standard');
                  else if (opt.value === 'episodic') setFormat('series');
                  else setFormat('feature');
                }}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  scriptType === opt.value && projectType !== 'tv_production'
                    ? opt.value === 'podcast'
                      ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30'
                      : 'border-[#FF5F1F] bg-[#FF5F1F]/10 ring-1 ring-[#FF5F1F]/30'
                    : 'border-surface-700 bg-surface-800/50 hover:border-surface-600'
                }`}
              >
                <Icon
                  name={opt.icon}
                  size="md"
                  className={
                    scriptType === opt.value && projectType !== 'tv_production'
                      ? opt.value === 'podcast' ? 'text-violet-400' : 'text-[#FF5F1F]'
                      : 'text-surface-400'
                  }
                />
                <h3 className={`mt-1.5 text-sm font-semibold ${
                  scriptType === opt.value && projectType !== 'tv_production'
                    ? opt.value === 'podcast' ? 'text-violet-400' : 'text-[#FF5F1F]'
                    : 'text-white'
                }`}>{opt.label}</h3>
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
            <button type="button" onClick={() => { setStep(0); setProjectType('film'); }} className="text-xs text-surface-400 hover:text-white transition-colors flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              {isTvProduction ? (
                <>
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
                  <span className="text-amber-400">TV Production</span>
                </>
              ) : isAudioOrPodcast ? (
                <>
                  <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                  <span className="text-violet-400">Podcast & Audio Drama</span>
                </>
              ) : (
                <>
                  <Icon name={SCRIPT_TYPE_OPTIONS.find(o => o.value === scriptType)?.icon || 'film'} size="sm" className="text-surface-400" />
                  {SCRIPT_TYPE_OPTIONS.find(o => o.value === scriptType)?.label}
                </>
              )}
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
                      ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 text-[#FF5F1F] ring-1 ring-[#FF5F1F]/30'
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
                        ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 text-[#FF5F1F] ring-1 ring-[#FF5F1F]/30'
                        : 'border-surface-700 bg-surface-800/50 text-surface-300 hover:border-surface-600'
                    }`}
                  >
                    {m.company.logo_url ? (
                      <img src={m.company.logo_url} alt={m.company.name || 'Company logo'} className="w-4 h-4 rounded object-cover" />
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
            label={isTvProduction ? 'Production Name' : isContentCreator ? 'Video Title' : isAudioOrPodcast ? 'Audio Drama Title' : 'Project Title'}
            placeholder={isTvProduction ? 'Dagsrevyen 24. desember' : isContentCreator ? 'How I Make $10k/Month as a Creator' : isAudioOrPodcast ? 'Dark Waters: Episode 1' : 'The Midnight Hour'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          <Textarea
            label={isTvProduction ? 'Production Description' : isContentCreator ? 'Video Concept' : isAudioOrPodcast ? 'Episode Premise' : 'Logline'}
            placeholder={isTvProduction 
              ? 'Live broadcast from Studio 1, 45 minutes, 3-camera setup...'
              : isContentCreator 
              ? 'In this video, I break down my exact strategies for...'
              : isAudioOrPodcast
              ? 'A detective investigates a string of disappearances in a fog-bound coastal town...'
              : 'A hard-boiled detective uncovers a conspiracy that reaches the highest levels of power...'}
            value={logline}
            onChange={(e) => setLogline(e.target.value)}
            rows={3}
          />

          {!isContentCreator && !isTvProduction && !isAudioOrPodcast && (
            <>
              <Select
                label="Format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                options={FORMAT_OPTIONS}
              />

              {isEpisodic && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Season Number" type="number" min={1} value={seasonNumber} onChange={(e) => setSeasonNumber(e.target.value)} placeholder="1" />
                  <Input label="Episodes Planned" type="number" min={1} value={episodeCount} onChange={(e) => setEpisodeCount(e.target.value)} placeholder="8" />
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
                          ? 'bg-[#E54E15] text-white'
                          : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Audio Drama / Podcast — format picker + genre */}
          {isAudioOrPodcast && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-3">Script Format</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {AUDIO_DRAMA_FORMAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormat(opt.value)}
                      className={`text-left p-3.5 rounded-xl border-2 transition-all ${
                        format === opt.value
                          ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30'
                          : 'border-surface-700 bg-surface-800/50 hover:border-surface-600'
                      }`}
                    >
                      <h3 className={`text-sm font-semibold ${format === opt.value ? 'text-violet-300' : 'text-white'}`}>{opt.label}</h3>
                      <p className="mt-0.5 text-[10px] text-surface-500">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>
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
                          ? 'bg-violet-600 text-white'
                          : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isEpisodic && (
            <div className="bg-surface-800/50 rounded-xl p-4 border border-surface-700">
              <p className="text-sm text-surface-300 mb-3">📺 Your series gets:</p>
              <ul className="text-xs text-surface-400 space-y-1.5">
                <li className="flex items-center gap-2"><span className="text-[#FF5F1F]">✓</span> Episode manager — one script per episode, tracked together</li>
                <li className="flex items-center gap-2"><span className="text-[#FF5F1F]">✓</span> Season + episode numbering &amp; arc planning</li>
                <li className="flex items-center gap-2"><span className="text-[#FF5F1F]">✓</span> Series-wide character, location &amp; scene tracking</li>
                <li className="flex items-center gap-2"><span className="text-[#FF5F1F]">✓</span> Per-episode production scheduling &amp; shot lists</li>
                <li className="flex items-center gap-2"><span className="text-[#FF5F1F]">✓</span> Real-time collaboration across the entire season</li>
              </ul>
            </div>
          )}

          {isContentCreator && (
            <div className="bg-surface-800/50 rounded-xl p-4 border border-surface-700">
              <p className="text-sm text-surface-300 mb-3">🎉 You&apos;ll get access to:</p>
              <ul className="text-xs text-surface-400 space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Script editor with Hook, Intro, CTA templates
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Thumbnail planner with A/B testing
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> SEO optimizer (title, tags, description)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Sponsor segment tracker
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Upload checklist
                </li>
              </ul>
            </div>
          )}

          {isTvProduction && (
            <div className="bg-gradient-to-br from-amber-500/5 to-surface-800/50 rounded-xl p-4 border border-amber-500/20">
              <p className="text-sm text-amber-300 mb-3 font-semibold">Professional Production Tools</p>
              <ul className="text-xs text-surface-400 space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span> Rundown editor with live timing
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span> Dagsplan — day scheduling with crew calls
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span> HTML-based autocue / teleprompter
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span> Call sheet generator
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span> Crew & equipment management
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span> Real-time team chat
                </li>
              </ul>
            </div>
          )}

          {isAudioDrama && (
            <div className="bg-gradient-to-br from-violet-500/5 to-surface-800/50 rounded-xl p-4 border border-violet-500/20">
              <p className="text-sm text-violet-300 mb-3 font-semibold">🎧 Your audio drama workspace includes:</p>
              <ul className="text-xs text-surface-400 space-y-1.5">
                <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Script editor in STARC audio drama format</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> SFX, MUSIC &amp; AMBIENCE cue lines baked-in</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Sound Design library — manage all cues in one place</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Voice cast tracker (characters + casting notes)</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Episode manager for audio drama series</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Arc planner, ideas &amp; story documents</li>
              </ul>
            </div>
          )}

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
