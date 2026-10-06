'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Badge, LoadingPage, EmptyState, SkeletonCard, KeyboardShortcuts, toast } from '@/components/ui';
import { ShellActions } from '@/components/shell/ShellActions';
import { Pill, Segmented } from '@/components/kit';
import { NewProjectModal } from '@/components/dashboard/NewProjectModal';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { StreakBadge } from '@/components/dashboard/StreakBadge';
import { DashboardOverview, PIPELINE, StageBadge, stageOf } from '@/components/dashboard/DashboardOverview';
import { useFeatureAccess } from '@/components/FeatureGate';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { useCommandPalette } from '@/components/ui/CommandPalette';
import { SupportButton } from '@/components/SupportButton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import dynamic from 'next/dynamic';
import { GamificationOptIn } from '@/components/GamificationOptIn';
import { LevelUpCelebration } from '@/components/LevelUpCelebration';
import { startTour, getTourState, endTour } from '@/lib/tourState';

const GuidedTour = dynamic(() => import('@/components/GuidedTour').then(m => ({ default: m.GuidedTour })), { ssr: false });
const OnboardingChecklist = dynamic(() => import('@/components/OnboardingChecklist').then(m => ({ default: m.OnboardingChecklist })), { ssr: false });
import { useGamification } from '@/hooks/useGamification';
import { useNotifications } from '@/hooks/useNotifications';
import { timeAgo, cn } from '@/lib/utils';
import { useRecentProjects } from '@/hooks/useRecentProjects';
import { useTranslation } from '@/components/TranslationProvider';
import type { Project, Company, CompanyMember, CompanyRole, DashboardFolder, UsageIntent } from '@/lib/types';
import { isElectronMode, isLocalMode } from '@/lib/supabase/electron-client';
import { cacheRows, getCachedProjects } from '@/lib/offline/db';
import { renameProject, deleteProject } from '@/lib/project-actions';
import { RenameDialog, DeleteProjectDialog } from '@/components/projects/ManageControls';

const WritingGoalWidget = dynamic(() => import('@/components/WritingGoalWidget').then(m => ({ default: m.WritingGoalWidget })), { ssr: false });

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingPage />}>
        <DashboardContent />
      </Suspense>
    </ErrorBoundary>
  );
}

function DashboardContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { canUse: canUseFeature } = useFeatureAccess();

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
  // Project being renamed / deleted from a card's "⋯" menu
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
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

  // Guided tour (triggered after onboarding via ?tour=1 query param, or resumed from sessionStorage)
  const searchParams = useSearchParams();
  const [showTour, setShowTour] = useState(false);
  const [tourIntent, setTourIntent] = useState<UsageIntent>('writer');
  const [tourProjectId, setTourProjectId] = useState<string | null>(null);

  useEffect(() => {
    // Check for ?tour=1 (fresh start from onboarding)
    if (searchParams.get('tour') === '1') {
      const intent = (user?.usage_intent as UsageIntent) ?? 'writer';
      const pid = projects[0]?.id ?? null;
      startTour(intent, pid);
      setTourIntent(intent);
      setTourProjectId(pid);
      setShowTour(true);
      window.history.replaceState({}, '', '/dashboard');
      return;
    }
    // Check for active tour in sessionStorage (resuming from another page)
    const saved = getTourState();
    if (saved?.active) {
      setTourIntent(saved.intent);
      setTourProjectId(saved.projectId);
      setShowTour(true);
    }
  }, [searchParams, user?.usage_intent, projects]);

  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      setShowNewProject(true);
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
      // Don't redirect to login when offline — the user was authenticated
      // before losing connection and will be restored from sessionStorage.
      if (navigator.onLine) {
        router.replace('/auth/login');
      }
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
  // Keyed on id: a refreshed profile object must not refetch everything.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.onboarding_completed, authLoading]);

  const fetchProjects = async () => {
    if (!user?.id) return;
    try {
      let diskProjects: Project[] = [];
      if (isElectronMode()) {
        const { listLocalProjects } = await import('@/lib/local-files');
        diskProjects = await listLocalProjects();
      }

      if (isLocalMode()) {
        const idbProjects = await getCachedProjects() as unknown as Project[];
        const merged = new Map<string, Project>();
        for (const p of diskProjects) merged.set(p.id, p);
        for (const p of idbProjects) {
          const existing = merged.get(p.id);
          if (!existing || (p.updated_at || p.created_at || '') > (existing.updated_at || existing.created_at || '')) {
            merged.set(p.id, p);
          }
        }
        setProjects(Array.from(merged.values()).sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')));
        setLoading(false);
        return;
      }
      // When offline, fall back to IndexedDB cache + disk projects
      if (!navigator.onLine) {
        const idbProjects = await getCachedProjects() as unknown as Project[];
        const merged = new Map<string, Project>();
        for (const p of diskProjects) merged.set(p.id, p);
        for (const p of idbProjects) {
          const existing = merged.get(p.id);
          if (!existing || (p.updated_at || p.created_at || '') > (existing.updated_at || existing.created_at || '')) {
            merged.set(p.id, p);
          }
        }
        setProjects(Array.from(merged.values()).sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')));
        setLoading(false);
        return;
      }
      const supabase = createClient();

      // Paint last session's projects straight away; the network refresh below
      // replaces them. (Cached rows already carry the personal folder_id.)
      if (projects.length === 0) {
        try {
          const cached = (await getCachedProjects() as unknown as Project[]).filter((p) => !p.company_id);
          if (cached.length > 0) {
            setProjects(cached.sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')));
            setLoading(false);
          }
        } catch { /* no cache */ }
      }

      // Memberships and folder assignments don't depend on each other
      const [{ data: memberships }, { data: assignments }] = await Promise.all([
        supabase.from('project_members').select('project_id').eq('user_id', user.id),
        supabase.from('user_project_folder_assignments').select('project_id, folder_id').eq('user_id', user.id),
      ]);
      const memberProjectIds = (memberships || []).map((m) => m.project_id);

      // Fetch projects the user created OR is a member of (personal, non-company)
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .is('company_id', null)
        .or(`created_by.eq.${user.id}${memberProjectIds.length ? `,id.in.(${memberProjectIds.join(',')})` : ''}`)
        .order('updated_at', { ascending: false });
      if (error) console.error('Error fetching projects:', error.message);
      if (error) {
        // Keep what's on screen (cache) rather than blanking the dashboard
        toast.error("Couldn't refresh your projects. Showing your last saved list.");
        return;
      }
      const projectList = data || [];

      // Personal folder assignments (private per-user, not on the project row)
      const folderMap = new Map(
        (assignments || []).map((a: { project_id: string; folder_id: string | null }) => [a.project_id, a.folder_id])
      );
      // Override folder_id on each project with the user's personal assignment
      const finalProjects = projectList.map((p) => ({ ...p, folder_id: folderMap.has(p.id) ? folderMap.get(p.id) ?? null : null }));
      
      const merged = new Map<string, Project>();
      for (const p of diskProjects) merged.set(p.id, p);
      for (const p of finalProjects) {
        const existing = merged.get(p.id);
        if (!existing || (p.updated_at || p.created_at || '') > (existing.updated_at || existing.created_at || '')) {
          merged.set(p.id, p);
        }
      }
      const sortedMerged = Array.from(merged.values()).sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));
      
      setProjects(sortedMerged);
      // Cache projects to IndexedDB so they're available offline
      if (sortedMerged.length > 0) {
        cacheRows('projects', sortedMerged as unknown as Record<string, unknown>[]).catch(() => {});
      }
    } catch (err) {
      // Network failure: keep the cached list if we painted one
      console.error('Unexpected error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyData = async () => {
    if (!user?.id) return;
    // Company memberships aren't cached in IndexedDB — skip when offline
    if (!navigator.onLine) return;
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
    } catch {
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
    if (!confirm(t('dashboard.delete_folder'))) return;
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
    // Optimistic local update
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, folder_id: folderId } : p));
  };

  const toggleFolder = async (id: string) => {
    const newIsCollapsed = !collapsedFolders.has(id);
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (newIsCollapsed) next.add(id); else next.delete(id);
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

  return (
    <div className="min-h-screen bg-surface-950" id="main-content">
      <ShellActions>
        <button
          onClick={() => setShowShortcuts(true)}
          className="hidden items-center rounded-lg px-1.5 py-1 text-surface-500 transition-colors hover:text-white lg:flex"
          title="Keyboard shortcuts"
        >
          <kbd className="rounded border border-surface-700 bg-surface-800 px-1.5 py-0.5 font-mono text-[11px]">⌘/</kbd>
        </button>
        <Link href="/dashboard/import" title="Import a script" className="inline-flex items-center gap-1.5 rounded-xl border border-surface-800 px-3 py-1.5 text-xs font-semibold text-surface-300 transition-colors hover:text-white">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
          <span className="hidden sm:inline">Import</span>
        </Link>
        <button onClick={() => setShowNewProject(true)} title="New project (⌘N)" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-500">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">New project</span>
        </button>
      </ShellActions>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Pending Company Invitations Banner */}
        {pendingInvitations.length > 0 && (
          <div className="mb-6 space-y-3">
            {pendingInvitations.map((inv: { id: string; company_name?: string; company_logo?: string; company_color?: string; role: string; invited_by_name?: string }) => (
              <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ backgroundColor: inv.company_color || '#3B82F6' }}>
                    {inv.company_logo ? <img src={inv.company_logo} alt={inv.company_name || 'Company logo'} className="w-full h-full object-cover rounded-lg" loading="lazy" /> : inv.company_name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      <span className="text-brand-500">{inv.company_name}</span> invited you to join as <span className="capitalize text-brand-400">{inv.role}</span>
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
        <DashboardOverview
          name={user?.full_name ? user.full_name.split(' ')[0] : user?.display_name ?? null}
          badges={<>{user?.is_pro && <Pill tone="amber">Pro</Pill>}<StreakBadge /></>}
          projects={allProjects}
          lastProject={lastProject}
          filterStatus={filterStatus}
          onFilter={setFilterStatus}
          onNewProject={() => setShowNewProject(true)}
          showCommunity={canUseFeature('community') && isFeatureEnabled('community') && user?.show_community !== false && !isElectronMode()}
        />

        {/* Onboarding Checklist */}
        {/* Only for people getting started — not a to-do list for veterans */}
        {projects.length > 0 && projects.length < 3 && (
          <div className="mb-8">
            <OnboardingChecklist projectId={projects[0]?.id ?? null} />
          </div>
        )}

        {/* Writing Goal Widget */}
        {user && (
          <div className="mb-8">
            <WritingGoalWidget userId={user.id} />
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('dashboard.search_projects')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-800 bg-surface-900/50 backdrop-blur-sm text-sm text-surface-50 placeholder:text-surface-500 focus:border-brand-500/50 focus:ring-4 focus:ring-brand-500/10 focus:outline-none transition-all duration-300 ease-spring"
            />
          </div>
          <Segmented
            id="dashboard-status"
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { key: 'all', label: 'All' },
              ...PIPELINE.map((st) => ({ key: st.key as string, label: st.key === 'pre_production' ? 'Pre-prod' : st.key === 'post_production' ? 'Post' : st.label })),
            ]}
          />
        </div>

        {/* Recently Viewed Strip */}
        {recentProjects.length >= 2 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-[0.04em]">{t('dashboard.recently_viewed')}</h3>
              <button onClick={clearRecent} className="text-[11px] text-surface-500 hover:text-surface-400 transition-colors">{t('dashboard.clear')}</button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {recentProjects.map(rp => (
                <Link
                  key={rp.id}
                  href={`/projects/${rp.id}`}
                  className="flex-shrink-0 group flex items-center gap-2.5 bg-surface-900/40 hover:bg-surface-800/60 border border-surface-800/50 hover:border-surface-600/50 rounded-2xl px-3 py-2.5 transition-all duration-300 ease-spring backdrop-blur-md hover:-translate-y-0.5 hover:shadow-lg shadow-sm"
                >
                  <div className="relative w-8 h-8 rounded-xl bg-surface-800 flex items-center justify-center shrink-0 overflow-hidden">
                    <span className="text-sm font-bold text-surface-400">{(rp.title || '?')[0].toUpperCase()}</span>
                    {rp.cover_url && (
                      <img src={rp.cover_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full rounded-lg object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget).style.display = 'none'; }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-surface-200 group-hover:text-white truncate max-w-[120px] transition-colors">{rp.title}</p>
                    <p className="text-[11px] text-surface-500">{timeAgo(rp.viewed_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* My Projects — Folder-organised */}
        <div className="mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
          <h3 className="text-lg font-semibold text-white">{t('dashboard.my_projects')}</h3>
          <span className="text-xs text-surface-500">({filteredProjects.length}{searchQuery || filterStatus !== 'all' ? ` of ${projects.length}` : ''})</span>
          <div className="ml-auto flex items-center gap-3">
            {/* Grid / List toggle */}
            <div className="flex items-center gap-0.5 bg-surface-900/50 backdrop-blur-sm rounded-xl p-0.5 border border-surface-800">
              <button
                onClick={() => toggleViewMode('grid')}
                title="Grid view"
                className={cn('p-1.5 rounded transition-colors', viewMode === 'grid' ? 'bg-brand-500 text-white' : 'text-surface-500 hover:text-surface-300')}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              </button>
              <button
                onClick={() => toggleViewMode('list')}
                title="List view"
                className={cn('p-1.5 rounded transition-colors', viewMode === 'list' ? 'bg-brand-500 text-white' : 'text-surface-500 hover:text-surface-300')}
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
                  placeholder={t('dashboard.folder_name')}
                  className="w-36 bg-surface-800 border border-surface-700 rounded px-2.5 py-1 text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500"
                />
                <button onClick={createFolder} className="px-2 py-1 text-xs bg-brand-500 text-white rounded hover:bg-brand-600">Add</button>
                <button onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }} className="px-2 py-1 text-xs text-surface-500 hover:text-white">✕</button>
              </div>
            ) : (
              <button onClick={() => setShowNewFolderInput(true)} className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('dashboard.new_folder')}
              </button>
            )}
          </div>
        </div>

        {filteredProjects.length === 0 && (searchQuery || filterStatus !== 'all') ? (
          <div className="text-center py-12 text-surface-500 text-sm mb-8">
            {t('dashboard.no_match')}{' '}
            <button onClick={() => { setSearchQuery(''); setFilterStatus('all'); }} className="text-brand-500 hover:text-brand-400 transition-colors">{t('dashboard.clear_filters')}</button>
          </div>
        ) : projects.length === 0 && loading ? (
          // Still fetching — don't flash "no projects yet" at people who have some
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8" aria-busy="true" aria-label="Loading projects">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
              </svg>
            }
            title={t('dashboard.no_projects')}
            description={t('dashboard.create_first')}
            action={
              <Button onClick={() => setShowNewProject(true)}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('dashboard.create_first_project')}
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
                  className={cn('mb-6 rounded-xl transition-colors duration-150', isDragOver && 'ring-2 ring-offset-2 ring-offset-surface-950')}
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
                    <div className="mb-2 h-0.5 rounded-full bg-brand-500/70 transition-[width]" />
                  )}
                  {/* Drop zone highlight bar (for projects) */}
                  {isDragOver && !isFolderDragOver && (
                    <div className="mb-2 rounded-lg border-2 border-dashed py-2 px-4 text-xs font-semibold text-center transition-colors" style={{ borderColor: folder.color, color: folder.color, backgroundColor: folder.color + '15' }}>
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
                    <span className="w-3 h-3 rounded-md flex-shrink-0" style={{ backgroundColor: folder.color }} />
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
                    <span className="text-[11px] text-surface-500">({folderProjects.length + childFolders.reduce((acc, c) => acc + filteredProjects.filter(p => p.folder_id === c.id).length, 0)})</span>
                    {/* Folder actions */}
                    <div className="ml-1 flex items-center gap-1 opacity-0 group-hover/folder:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setRenamingFolderId(folder.id); setRenamingName(folder.name); }}
                        className="text-[11px] text-surface-500 hover:text-white px-1.5 py-0.5 rounded hover:bg-surface-800"
                      >Rename</button>
                      <button
                        onClick={() => { setNewSubFolderParentId(newSubFolderParentId === folder.id ? null : folder.id); setNewSubFolderName(''); }}
                        className="text-[11px] text-surface-500 hover:text-white px-1.5 py-0.5 rounded hover:bg-surface-800"
                        title="Add subfolder"
                      >+ Sub</button>
                      <button
                        onClick={() => deleteFolder(folder.id)}
                        className="text-[11px] text-surface-500 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-surface-800"
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
                        className="w-36 bg-surface-800 border border-surface-700 rounded px-2.5 py-1 text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500"
                      />
                      <button onClick={() => createSubFolder(folder.id)} className="px-2 py-1 text-xs bg-brand-500 text-white rounded hover:bg-brand-600">Add</button>
                      <button onClick={() => { setNewSubFolderParentId(null); setNewSubFolderName(''); }} className="px-2 py-1 text-xs text-surface-500 hover:text-white">✕</button>
                    </div>
                  )}
                  {!isCollapsed && (
                    <>
                      {folderProjects.length === 0 && childFolders.length === 0 ? (
                        <div className={cn('border border-dashed rounded-xl p-6 text-center text-xs transition-colors', isDragOver ? 'border-current bg-current/10' : 'border-surface-800 text-surface-500')} style={isDragOver ? { borderColor: folder.color, color: folder.color } : {}}>
                          {isDragOver ? `Drop here →` : 'No projects in this folder yet.'}
                        </div>
                      ) : (
                        folderProjects.length > 0 && (
                          viewMode === 'list' ? (
                            <div className="flex flex-col gap-2">
                              {folderProjects.map(project => (
                                <ProjectCard key={project.id} project={project} folders={folders} moveToFolder={moveToFolder} draggingProjectId={draggingProjectId} setDraggingProjectId={setDraggingProjectId} viewMode={viewMode} currentUserId={user?.id} onRename={setRenameTarget} onDelete={setDeleteTarget} />
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {folderProjects.map(project => (
                                <ProjectCard key={project.id} project={project} folders={folders} moveToFolder={moveToFolder} draggingProjectId={draggingProjectId} setDraggingProjectId={setDraggingProjectId} viewMode={viewMode} currentUserId={user?.id} onRename={setRenameTarget} onDelete={setDeleteTarget} />
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
                              <span className="w-2.5 h-2.5 rounded-md flex-shrink-0" style={{ backgroundColor: child.color }} />
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
                              <span className="text-[11px] text-surface-700">({childProjects.length})</span>
                              <div className="ml-1 flex items-center gap-1 opacity-0 group-hover/child:opacity-100 transition-opacity">
                                <button onClick={() => { setRenamingFolderId(child.id); setRenamingName(child.name); }} className="text-[11px] text-surface-500 hover:text-white px-1 py-0.5 rounded hover:bg-surface-800">Rename</button>
                                <button onClick={() => deleteFolder(child.id)} className="text-[11px] text-surface-500 hover:text-red-400 px-1 py-0.5 rounded hover:bg-surface-800">Delete</button>
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
                                    <ProjectCard key={project.id} project={project} folders={folders} moveToFolder={moveToFolder} draggingProjectId={draggingProjectId} setDraggingProjectId={setDraggingProjectId} viewMode={viewMode} currentUserId={user?.id} onRename={setRenameTarget} onDelete={setDeleteTarget} />
                                  ))}
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {childProjects.map(project => (
                                    <ProjectCard key={project.id} project={project} folders={folders} moveToFolder={moveToFolder} draggingProjectId={draggingProjectId} setDraggingProjectId={setDraggingProjectId} viewMode={viewMode} currentUserId={user?.id} onRename={setRenameTarget} onDelete={setDeleteTarget} />
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
                  className={cn('mt-2 rounded-xl transition-colors duration-150', isDragOver && 'ring-2 ring-surface-600 ring-offset-2 ring-offset-surface-950')}
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
                      {t('dashboard.unfiled')}
                      <span className="text-[11px] text-surface-700">({unfiled.length})</span>
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
                        <ProjectCard key={project.id} project={project} folders={folders} moveToFolder={moveToFolder} draggingProjectId={draggingProjectId} setDraggingProjectId={setDraggingProjectId} viewMode={viewMode} currentUserId={user?.id} onRename={setRenameTarget} onDelete={setDeleteTarget} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {unfiled.map(project => (
                        <ProjectCard key={project.id} project={project} folders={folders} moveToFolder={moveToFolder} draggingProjectId={draggingProjectId} setDraggingProjectId={setDraggingProjectId} viewMode={viewMode} currentUserId={user?.id} onRename={setRenameTarget} onDelete={setDeleteTarget} />
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
                    <img src={company.logo_url} alt={company.name || 'Company logo'} className="w-7 h-7 rounded-lg object-cover" loading="lazy" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: company.brand_color || '#6366f1' }}
                    >
                      {company.name[0]}
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-white group-hover:text-brand-500 transition-colors">{company.name}</h3>
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
              <div
            className="h-36 bg-gradient-to-br from-surface-800 to-surface-900 relative overflow-hidden"
            style={{ backgroundImage: `radial-gradient(120% 90% at 100% 0%, ${stageOf(project.status).color}26, transparent 60%), linear-gradient(to bottom right, rgb(var(--surface-800)), rgb(var(--surface-900)))` }}
          >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl font-bold text-surface-700/60 group-hover:text-surface-600/60 transition-colors select-none">{project.title[0]}</span>
                </div>
                {project.cover_url && (
                  <img src={project.cover_url} alt={project.title || 'Project cover'} loading="lazy" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget).style.display = 'none'; }} />
                )}
                          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent" />
                          <div className="absolute top-2.5 left-2.5">
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold text-white"
                              style={{ backgroundColor: company.brand_color || '#6366f1' }}
                              title={company.name}
                            >
                              {company.name[0]}
                            </div>
                          </div>
                          <div className="absolute top-2.5 right-2.5">
                            <StageBadge status={project.status} />
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="text-base font-semibold text-white group-hover:text-brand-500 transition-colors truncate">
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
                                <span className="text-[11px] text-surface-500">+{(project.genre?.length || 0) - 2}</span>
                              )}
                            </div>
                            <span className="text-[11px] text-surface-500">{timeAgo(project.updated_at)}</span>
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

      <RenameDialog
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Rename project"
        label="Project name"
        initialValue={renameTarget?.title || ''}
        onSave={async (title) => {
          if (!renameTarget) return true;
          const res = await renameProject(renameTarget.id, title);
          if (!res.ok) { toast.error(res.message); return false; }
          setProjects((prev) => prev.map((p) => (p.id === res.data.id ? { ...p, title: res.data.title, updated_at: res.data.updated_at } : p)));
          toast.success('Project renamed');
          return true;
        }}
      />
      <DeleteProjectDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        projectTitle={deleteTarget?.title || ''}
        onConfirm={async () => {
          if (!deleteTarget) return true;
          const res = await deleteProject(deleteTarget.id);
          if (!res.ok) { toast.error(res.message); return false; }
          setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
          toast.success(`Deleted “${deleteTarget.title}”`);
          return true;
        }}
      />

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

      <SupportButton />

      {/* Guided Tour */}
      {showTour && (
        <GuidedTour
          onComplete={() => { endTour(); setShowTour(false); }}
          usageIntent={tourIntent}
          projectId={tourProjectId}
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
