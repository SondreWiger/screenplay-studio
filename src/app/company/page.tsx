'use client';

import {
  Activity, Building2, CalendarDays, ClipboardList, ExternalLink, FolderKanban, GraduationCap, Hash,
  KanbanSquare, LayoutDashboard, LayoutGrid, Library, Lightbulb, Megaphone, PenSquare, Plus, Settings,
  ShieldCheck, UserPlus, Users, UsersRound, type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, ConfirmDialog, Input, Textarea, LoadingPage, toast } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { useNotifications } from '@/hooks/useNotifications';
import type {
  Company, CompanyMember, CompanyTeam,
  CompanyInvitation, CompanyActivityLog, CompanyRole, Profile, Project,
  CompanyBlogPost
} from '@/lib/types';
import { OrgPipeline } from '@/components/org/OrgPipeline';
import { OrgChannels } from '@/components/org/OrgChannels';
import { OrgAssignments } from '@/components/org/OrgAssignments';
import { OrgCalendar } from '@/components/org/OrgCalendar';
import { OrgResources } from '@/components/org/OrgResources';
import { OrgPitches } from '@/components/org/OrgPitches';
import { OrgAnnouncements } from '@/components/org/OrgAnnouncements';
import { OrgEducation } from '@/components/org/OrgEducation';
import { CompanyOverview, type CompanySection } from '@/components/org/CompanyOverview';
import { CinderraBoards } from '@/components/cinderra/CinderraBoards';

type CompanyTab = CompanySection;

interface NavItem { key: CompanyTab; label: string; icon: LucideIcon; count?: number; managersOnly?: boolean }

const SECTION_COPY: Partial<Record<CompanyTab, { title: string; description: string }>> = {
  boards: { title: 'Boards', description: 'Mind maps, mood boards, slates and planning walls, shared with the whole company.' },
  pipeline: { title: 'Pipeline', description: 'Every company project and the stage it is at. Drag a card, or use its menu, to move it on.' },
  calendar: { title: 'Calendar', description: 'Deadlines, table reads, shoot days and meetings across the company.' },
  channels: { title: 'Channels', description: 'Conversations for the whole company, a team or a project.' },
  announcements: { title: 'Announcements', description: 'News everyone should see. Unread ones are marked until opened.' },
  pitches: { title: 'Pitches', description: 'Submit ideas, vote on them, and move the best ones toward a greenlight.' },
  assignments: { title: 'Assignments', description: 'Writing and review work handed to people, with deadlines and revision rounds.' },
  resources: { title: 'Resources', description: 'Templates, guides, references and links the company keeps in one place.' },
  education: { title: 'Classes', description: 'Courses with assignments, submissions, grading and peer review.' },
  members: { title: 'Members', description: 'Who is in the company, and what they can do.' },
  teams: { title: 'Teams', description: 'Group people by department and set what each team may change.' },
  projects: { title: 'Projects', description: 'Productions that belong to the company.' },
  blog: { title: 'Blog', description: 'Posts for the public company page.' },
  settings: { title: 'Settings', description: 'Company details and what the public page shows.' },
  activity: { title: 'Activity', description: 'The latest changes across the company.' },
};

const ALL_TABS: CompanyTab[] = ['overview', 'boards', 'pipeline', 'calendar', 'channels', 'announcements', 'pitches', 'assignments', 'resources', 'education', 'members', 'teams', 'projects', 'blog', 'settings', 'activity'];

export default function CompanyDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTabState] = useState<CompanyTab>('overview');

  // The section lives in ?tab= so a reload, a shared link or Back lands where
  // you were. Read once on mount and written with replaceState, which keeps
  // this page out of useSearchParams and its Suspense requirement.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab') as CompanyTab | null;
    if (fromUrl && ALL_TABS.includes(fromUrl)) setTabState(fromUrl);
  }, []);
  const setTab = useCallback((next: CompanyTab) => {
    setTabState(next);
    const url = new URL(window.location.href);
    if (next === 'overview') url.searchParams.delete('tab'); else url.searchParams.set('tab', next);
    window.history.replaceState(null, '', url.toString());
    window.scrollTo({ top: 0 });
  }, []);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<{ id: string; name: string } | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [teams, setTeams] = useState<CompanyTeam[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<CompanyActivityLog[]>([]);
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [myRole, setMyRole] = useState<CompanyRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Blog state
  const [blogPosts, setBlogPosts] = useState<CompanyBlogPost[]>([]);
  const [showBlogEditor, setShowBlogEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<CompanyBlogPost | null>(null);
  const [blogForm, setBlogForm] = useState({ title: '', excerpt: '', content: '', tags: '', cover_image_url: '', allow_comments: true });

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showAddToTeamModal, setShowAddToTeamModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CompanyRole>('member');

  // Team form
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamColor, setTeamColor] = useState('#3B82F6');
  const [teamPerms, setTeamPerms] = useState({
    can_create_projects: false,
    can_edit_scripts: true,
    can_manage_production: false,
    can_view_budget: false,
    can_manage_budget: false,
    can_invite_members: false,
    can_publish_community: false,
    can_manage_company: false,
  });

  // Settings form
  const [settingsForm, setSettingsForm] = useState<Partial<Company>>({});

  // Team member selection
  const [selectedMemberForTeam, setSelectedMemberForTeam] = useState('');

  const supabase = createClient();

  useNotifications(user?.id);

  const loadCompany = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Find the user's company: either via company_id on profile or via company_members
    let companyId = user.company_id;

    if (!companyId) {
      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      companyId = membership?.company_id || null;
    }

    if (!companyId) {
      // Check if user owns any company
      const { data: owned } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle();
      companyId = owned?.id || null;
    }

    if (!companyId) {
      setLoading(false);
      return;
    }

    const { data: co, error: coError } = await supabase.from('companies').select('*').eq('id', companyId).single();
    if (coError || !co) {
      if (coError) toast.error('Failed to load company');
      setLoading(false);
      return;
    }
    setCompany(co);
    setSettingsForm(co);

    // Fetch all company data in parallel
    const [memsRes, tsRes, psRes, invsRes, bPostsRes, actsRes] = await Promise.all([
      supabase.from('company_members')
        .select('*, profile:profiles!user_id(*)')
        .eq('company_id', co.id)
        .order('role'),
      supabase.from('company_teams')
        .select('*')
        .eq('company_id', co.id)
        .order('name'),
      supabase.from('projects')
        .select('*')
        .eq('company_id', co.id)
        .order('updated_at', { ascending: false }),
      supabase.from('company_invitations')
        .select('*')
        .eq('company_id', co.id)
        .eq('accepted', false)
        .order('created_at', { ascending: false }),
      supabase.from('company_blog_posts')
        .select('*, author:profiles!author_id(*)')
        .eq('company_id', co.id)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('company_activity_log')
        .select('*, profile:profiles(*)')
        .eq('company_id', co.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const mems = memsRes.data || [];
    setMembers(mems);

    const me = mems.find((m: CompanyMember) => m.user_id === user.id);
    setMyRole(me?.role || (co.owner_id === user.id ? 'owner' : null));

    setTeams(tsRes.data || []);
    setProjects(psRes.data || []);
    setInvitations(invsRes.data || []);
    setBlogPosts(bPostsRes.data || []);
    setActivity(actsRes.data || []);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth/login'); return; }
    loadCompany();
  }, [user, authLoading, loadCompany]);

  const canManage = myRole === 'owner' || myRole === 'admin';

  const [lastInviteLink, setLastInviteLink] = useState('');

  const sendInvite = async () => {
    if (!company || !inviteEmail.trim()) return;
    setSaving(true);
    const token = crypto.randomUUID();
    const { error: inviteError } = await supabase.from('company_invitations').insert({
      company_id: company.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      team_ids: [],
      invited_by: user!.id,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (inviteError) {
      toast.error(`Couldn't create the invite: ${inviteError.message}`);
      setSaving(false);
      return;
    }
    await supabase.from('company_activity_log').insert({
      company_id: company.id, user_id: user!.id, action: 'invited_member',
      entity_type: 'invitation', metadata: { email: inviteEmail.trim(), role: inviteRole },
    });
    // Build the invite link so admin can share it directly
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setLastInviteLink(`${origin}/company/invite/${token}`);
    setInviteEmail('');
    loadCompany();
    setSaving(false);
  };

  const createTeam = async () => {
    if (!company || !teamName.trim()) return;
    setSaving(true);
    const { error: teamError } = await supabase.from('company_teams').insert({
      company_id: company.id,
      name: teamName.trim(),
      description: teamDescription.trim() || null,
      color: teamColor,
      ...teamPerms,
    });
    if (teamError) {
      toast.error(`Couldn't create the team: ${teamError.message}`);
      setSaving(false);
      return;
    }
    await supabase.from('company_activity_log').insert({
      company_id: company.id, user_id: user!.id, action: 'created_team',
      entity_type: 'team', metadata: { name: teamName.trim() },
    });
    setTeamName('');
    setTeamDescription('');
    setShowTeamModal(false);
    loadCompany();
    setSaving(false);
  };

  const addMemberToTeam = async (teamId: string, memberId: string) => {
    if (!company) return;
    setSaving(true);
    const { error } = await supabase.from('company_team_members').insert({
      team_id: teamId,
      member_id: memberId,
      role: 'member',
    });
    if (error) {
      console.error('Add to team error:', error.message);
      toast.error(error.message.includes('duplicate') ? 'Already a team member' : `Error: ${error.message}`);
    } else {
      await supabase.from('company_activity_log').insert({
        company_id: company.id, user_id: user!.id, action: 'added_team_member',
        entity_type: 'team', entity_id: teamId, metadata: { member_id: memberId },
      });
    }
    setShowAddToTeamModal(null);
    setSelectedMemberForTeam('');
    loadCompany();
    setSaving(false);
  };

  const removeMember = async (memberId: string) => {
    if (!company) return;
    const { error } = await supabase.from('company_members').delete().eq('id', memberId);
    if (error) toast.error(`Couldn't remove them: ${error.message}`);
    else toast.success('Removed from the company');
    setConfirmRemove(null);
    loadCompany();
  };

  const updateMemberRole = async (memberId: string, role: CompanyRole) => {
    if (!company) return;
    const { error } = await supabase.from('company_members').update({ role }).eq('id', memberId);
    if (error) toast.error(`Couldn't change the role: ${error.message}`);
    loadCompany();
  };

  const revokeInvitation = async (invId: string) => {
    const { error } = await supabase.from('company_invitations').delete().eq('id', invId);
    if (error) toast.error(`Couldn't revoke the invite: ${error.message}`);
    loadCompany();
  };

  const deleteTeam = async (teamId: string) => {
    if (!company) return;
    const { error } = await supabase.from('company_teams').delete().eq('id', teamId);
    if (error) toast.error(`Couldn't delete the team: ${error.message}`);
    setConfirmDeleteTeam(null);
    loadCompany();
  };

  // Blog functions
  const resetBlogForm = () => {
    setBlogForm({ title: '', excerpt: '', content: '', tags: '', cover_image_url: '', allow_comments: true });
    setEditingPost(null);
    setShowBlogEditor(false);
  };

  const saveBlogPost = async (publish: boolean) => {
    if (!company || !user) return;
    setSaving(true);
    const slug = blogForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const tags = blogForm.tags.split(',').map((t) => t.trim()).filter(Boolean);

    let blogError: { message: string } | null = null;
    if (editingPost) {
      ({ error: blogError } = await supabase.from('company_blog_posts').update({
        title: blogForm.title,
        excerpt: blogForm.excerpt || null,
        content: blogForm.content,
        cover_image_url: blogForm.cover_image_url || null,
        tags,
        allow_comments: blogForm.allow_comments,
        status: publish ? 'published' : 'draft',
        published_at: publish && editingPost.status !== 'published' ? new Date().toISOString() : editingPost.published_at,
      }).eq('id', editingPost.id));
    } else {
      ({ error: blogError } = await supabase.from('company_blog_posts').insert({
        company_id: company.id,
        author_id: user.id,
        title: blogForm.title,
        slug,
        excerpt: blogForm.excerpt || null,
        content: blogForm.content,
        cover_image_url: blogForm.cover_image_url || null,
        tags,
        allow_comments: blogForm.allow_comments,
        status: publish ? 'published' : 'draft',
        published_at: publish ? new Date().toISOString() : null,
      }));
      if (!blogError) await supabase.from('company_activity_log').insert({
        company_id: company.id, user_id: user.id,
        action: publish ? 'published_blog_post' : 'created_blog_draft',
        entity_type: 'blog_post', metadata: { title: blogForm.title },
      });
    }

    setSaving(false);
    if (blogError) {
      toast.error(`Couldn't save the post: ${blogError.message}`);
      return;
    }
    toast.success(publish ? 'Post published' : 'Draft saved');
    resetBlogForm();
    loadCompany();
  };

  const editBlogPost = (post: CompanyBlogPost) => {
    setEditingPost(post);
    setBlogForm({
      title: post.title,
      excerpt: post.excerpt || '',
      content: post.content,
      tags: post.tags.join(', '),
      cover_image_url: post.cover_image_url || '',
      allow_comments: post.allow_comments,
    });
    setShowBlogEditor(true);
  };

  const deleteBlogPost = async (postId: string) => {
    if (!confirm('Delete this blog post?')) return;
    await supabase.from('company_blog_posts').delete().eq('id', postId);
    loadCompany();
  };

  const togglePinPost = async (post: CompanyBlogPost) => {
    await supabase.from('company_blog_posts').update({ pinned: !post.pinned }).eq('id', post.id);
    loadCompany();
  };

  const saveSettings = async () => {
    if (!company) return;
    setSaving(true);
    const { name, description, website, email, phone, address, tagline, brand_color,
      public_page_enabled, show_team_on_public, show_projects_on_public, allow_script_reading } = settingsForm;
    const { error: settingsError } = await supabase.from('companies').update({
      name, description, website, email, phone, address, tagline, brand_color,
      public_page_enabled, show_team_on_public, show_projects_on_public, allow_script_reading,
    }).eq('id', company.id);
    if (settingsError) {
      toast.error(`Couldn't save: ${settingsError.message}`);
      setSaving(false);
      return;
    }
    toast.success('Settings saved');
    await supabase.from('company_activity_log').insert({
      company_id: company.id, user_id: user!.id, action: 'updated_settings',
      entity_type: 'company', metadata: {},
    });
    loadCompany();
    setSaving(false);
  };

  if (authLoading || loading) return <LoadingPage />;

  // No company found — show create/join prompt
  if (!company) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-surface-800 bg-gradient-to-br from-surface-900 via-surface-900/80 to-brand-950/40 p-8 md:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-surface-700 bg-surface-900 text-brand-400">
            <Building2 className="h-6 w-6" />
          </span>
          <h1 className="relative mt-5 text-2xl font-bold tracking-tight text-white">No company yet</h1>
          <p className="relative mt-1.5 max-w-lg text-sm text-surface-400">Create a company to collaborate with your team, manage projects together, and set granular permissions.</p>
          <div className="relative mt-6 grid gap-2 sm:grid-cols-3">
            {[
              { icon: Users, t: 'Members & teams', d: 'Invite people and group them into teams.' },
              { icon: FolderKanban, t: 'Shared projects', d: 'Every production in one company space.' },
              { icon: ShieldCheck, t: 'Permissions', d: 'Decide who can see and change what.' },
            ].map((f) => (
              <div key={f.t} className="rounded-xl border border-surface-800 bg-surface-950/40 p-3">
                <f.icon className="h-4 w-4 text-brand-400" />
                <p className="mt-2 text-xs font-semibold text-white">{f.t}</p>
                <p className="mt-0.5 text-[11px] text-surface-500">{f.d}</p>
              </div>
            ))}
          </div>
          <div className="relative mt-6 flex flex-wrap gap-2">
            <Link href="/settings?tab=company" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500">
              <Plus className="h-3.5 w-3.5" /> Create company
            </Link>
            <Link href="/dashboard" className="inline-flex items-center rounded-xl border border-surface-800 px-4 py-2 text-xs font-semibold text-surface-300 hover:text-white">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const navGroups = ([
    {
      label: 'Workspace',
      items: [
        { key: 'overview', label: 'Overview', icon: LayoutDashboard },
        { key: 'boards', label: 'Boards', icon: LayoutGrid },
        { key: 'pipeline', label: 'Pipeline', icon: KanbanSquare },
        { key: 'calendar', label: 'Calendar', icon: CalendarDays },
      ],
    },
    {
      label: 'Talk',
      items: [
        { key: 'channels', label: 'Channels', icon: Hash },
        { key: 'announcements', label: 'Announcements', icon: Megaphone },
      ],
    },
    {
      label: 'Develop',
      items: [
        { key: 'pitches', label: 'Pitches', icon: Lightbulb },
        { key: 'assignments', label: 'Assignments', icon: ClipboardList },
        { key: 'resources', label: 'Resources', icon: Library },
        { key: 'education', label: 'Classes', icon: GraduationCap },
      ],
    },
    {
      label: 'Company',
      items: [
        { key: 'members', label: 'Members', icon: Users, count: members.length },
        { key: 'teams', label: 'Teams', icon: UsersRound, count: teams.length },
        { key: 'projects', label: 'Projects', icon: FolderKanban, count: projects.length },
        { key: 'blog', label: 'Blog', icon: PenSquare, count: blogPosts.length },
        { key: 'settings', label: 'Settings', icon: Settings, managersOnly: true },
        { key: 'activity', label: 'Activity', icon: Activity, managersOnly: true },
      ],
    },
  ] as { label: string; items: NavItem[] }[]).map((g) => ({ ...g, items: g.items.filter((i) => !i.managersOnly || canManage) }));
  const navItems = navGroups.flatMap((g) => g.items);
  const current = navItems.find((i) => i.key === tab) ?? navItems[0];
  const copy = SECTION_COPY[tab];
  const roleLabel = myRole ? myRole[0].toUpperCase() + myRole.slice(1) : 'Member';

  return (
    <div className="min-h-screen bg-surface-950">
      <AppHeader />
      <div className="mx-auto flex max-w-7xl gap-8 px-4 sm:px-6">
        {/* Side navigation, desktop */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-4 space-y-5 py-6">
            <div className="flex items-center gap-3 px-1">
              {company.logo_url ? (
                <img src={company.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover" loading="lazy" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white" style={{ backgroundColor: company.brand_color }}>
                  {company.name[0]}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{company.name}</p>
                <p className="text-xs text-surface-500">{roleLabel}</p>
              </div>
            </div>
            <nav aria-label="Company" className="space-y-4">
              {navGroups.map((g) => (
                <div key={g.label}>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-600">{g.label}</p>
                  <ul className="space-y-0.5">
                    {g.items.map((item) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => setTab(item.key)}
                          aria-current={tab === item.key ? 'page' : undefined}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                            tab === item.key
                              ? 'bg-brand-500/10 font-medium text-white ring-1 ring-inset ring-brand-500/20'
                              : 'text-surface-400 hover:bg-surface-900 hover:text-white'
                          }`}
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${tab === item.key ? 'text-brand-400' : 'text-surface-500'}`} />
                          <span className="flex-1 truncate text-left">{item.label}</span>
                          {item.count ? <span className="text-[11px] tabular-nums text-surface-500">{item.count}</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            {company.public_page_enabled && (
              <Link href={`/p/${company.slug}`} className="flex items-center gap-2 px-3 text-xs text-surface-500 hover:text-white">
                <ExternalLink className="h-3.5 w-3.5" /> Public page
              </Link>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-16 pt-6">
          {/* Navigation, phones and tablets: one scrolling row */}
          <div className="lg:hidden">
            <div className="mb-4 flex items-center gap-3">
              {company.logo_url ? (
                <img src={company.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" loading="lazy" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: company.brand_color }}>
                  {company.name[0]}
                </div>
              )}
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{company.name}</p>
            </div>
            <nav aria-label="Company" className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-surface-800 px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  aria-current={tab === item.key ? 'page' : undefined}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    tab === item.key ? 'bg-surface-800 text-white' : 'text-surface-400 hover:text-white'
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" /> {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Section heading */}
          {tab === 'overview' ? (
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-white">{company.name}</h1>
                <p className="mt-1 text-sm text-surface-400">{company.tagline || 'Your studio at a glance.'}</p>
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setTab('members'); setShowInviteModal(true); }}>
                    <UserPlus className="h-4 w-4" /> Invite
                  </Button>
                  <Button size="sm" onClick={() => setTab('boards')}>
                    <LayoutGrid className="h-4 w-4" /> Open boards
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
                  <current.icon className="h-5 w-5 text-brand-400" /> {copy?.title ?? current.label}
                </h1>
                {copy?.description && <p className="mt-1 max-w-2xl text-sm text-surface-400">{copy.description}</p>}
              </div>
              {tab === 'members' && canManage && (
                <Button size="sm" onClick={() => setShowInviteModal(true)}><UserPlus className="h-4 w-4" /> Invite member</Button>
              )}
              {tab === 'teams' && canManage && (
                <Button size="sm" onClick={() => setShowTeamModal(true)}><Plus className="h-4 w-4" /> New team</Button>
              )}
              {tab === 'blog' && canManage && !showBlogEditor && (
                <Button size="sm" onClick={() => { resetBlogForm(); setShowBlogEditor(true); }}><Plus className="h-4 w-4" /> New post</Button>
              )}
            </div>
          )}

        {tab === 'overview' && user && (
          <CompanyOverview
            company={company}
            userId={user.id}
            canManage={canManage}
            memberCount={members.length}
            teamCount={teams.length}
            projects={projects as { id: string; title: string; pipeline_stage_id?: string | null }[]}
            activity={activity}
            go={setTab}
            onInvite={() => { setTab('members'); setShowInviteModal(true); }}
          />
        )}

        {tab === 'boards' && (
          <div className="h-[calc(100dvh-13rem)] min-h-[28rem] overflow-hidden rounded-xl border border-surface-800 lg:h-[calc(100dvh-11rem)]">
            <CinderraBoards
              scope="company"
              scopeId={company.id}
              tool="board"
              label="Company boards"
              icon={LayoutGrid}
              kinds={['freeform', 'mindmap', 'kanban']}
            />
          </div>
        )}

        {/* Members */}
        {tab === 'members' && (
          <div className="space-y-6">
            <div className="space-y-3">
              {members.map((m) => (
                <Card key={m.id} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-800 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {(m as CompanyMember & { profile?: Profile }).profile?.avatar_url ? (
                      <img src={(m as CompanyMember & { profile?: Profile }).profile!.avatar_url!} alt={'Team member avatar'} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
                    ) : (
                      (m as CompanyMember & { profile?: Profile }).profile?.display_name?.[0] || (m as CompanyMember & { profile?: Profile }).profile?.full_name?.[0] || '?'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{(m as CompanyMember & { profile?: Profile }).profile?.display_name || (m as CompanyMember & { profile?: Profile }).profile?.full_name || 'Member'}</p>
                    <p className="text-xs text-surface-400">{m.job_title || m.role} {m.department ? `· ${m.department}` : ''}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide ${
                    m.role === 'owner' ? 'bg-brand-500/20 text-brand-500' :
                    m.role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                    m.role === 'manager' ? 'bg-green-500/20 text-green-400' :
                    'bg-surface-700 text-surface-300'
                  }`}>{m.role}</span>
                  {canManage && m.role !== 'owner' && m.user_id !== user?.id && (
                    <div className="flex gap-1">
                      <select
                        value={m.role}
                        onChange={(e) => updateMemberRole(m.id, e.target.value as CompanyRole)}
                        className="text-xs bg-surface-800 text-white border border-surface-700 rounded px-2 py-1"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button onClick={() => setConfirmRemove({ id: m.id, name: (m as CompanyMember & { profile?: Profile }).profile?.display_name || (m as CompanyMember & { profile?: Profile }).profile?.full_name || 'this member' })} className="text-red-400 hover:text-red-300 text-xs px-2">Remove</button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
            {invitations.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-surface-400 mt-8 mb-3">Pending Invitations</h3>
                <div className="space-y-2">
                  {invitations.map((inv) => (
                    <Card key={inv.id} className="p-4 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-sm text-surface-400">📧</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{inv.email}</p>
                        <p className="text-xs text-surface-400">Invited as {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                      </div>
                      {canManage && (
                        <button onClick={() => revokeInvitation(inv.id)} className="text-xs text-red-400 hover:text-red-300">Revoke</button>
                      )}
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Teams */}
        {tab === 'teams' && (
          <div className="space-y-6">
            {teams.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-surface-400">No teams created yet.</p>
                <p className="text-xs text-surface-500 mt-1">Teams let you organize members and control permissions for different departments.</p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {teams.map((team) => (
                  <Card key={team.id} className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: team.color }}>
                        {team.icon || team.name[0]}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-white">{team.name}</h3>
                        {team.description && <p className="text-[11px] text-surface-400">{team.description}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {[
                        team.can_create_projects && 'Projects',
                        team.can_edit_scripts && 'Scripts',
                        team.can_manage_production && 'Production',
                        team.can_view_budget && 'View Budget',
                        team.can_manage_budget && 'Manage Budget',
                        team.can_invite_members && 'Invite',
                        team.can_publish_community && 'Publish',
                        team.can_manage_company && 'Admin',
                      ].filter(Boolean).map((perm) => (
                        <span key={perm as string} className="px-1.5 py-0.5 text-[11px] rounded bg-surface-800 text-surface-400">{perm}</span>
                      ))}
                    </div>
                    {canManage && (
                      <div className="mt-4 pt-3 border-t border-surface-800 flex justify-between items-center">
                        <button
                          onClick={() => setShowAddToTeamModal(team.id)}
                          className="text-xs text-brand-500 hover:text-brand-400 flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          Add Member
                        </button>
                        <button onClick={() => setConfirmDeleteTeam({ id: team.id, name: team.name })} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projects */}
        {tab === 'projects' && (
          <div className="space-y-4">
            {projects.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-surface-400">No projects assigned to this company yet.</p>
                <p className="text-xs text-surface-500 mt-1">Assign projects from the project settings page.</p>
              </Card>
            ) : (
              projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="p-4 flex items-center gap-4 hover:bg-surface-800/50 transition-colors cursor-pointer">
                    {project.poster_url ? (
                      <img src={project.poster_url} alt={project.title || 'Project poster'} className="w-12 h-16 rounded-lg object-cover" loading="lazy" />
                    ) : (
                      <div className="w-12 h-16 rounded-lg bg-surface-800 flex items-center justify-center text-surface-500">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white">{project.title}</h3>
                      {project.logline && <p className="text-xs text-surface-400 line-clamp-1 mt-0.5">{project.logline}</p>}
                    </div>
                    <span className="text-xs text-surface-500 capitalize">{project.status.replace(/_/g, ' ')}</span>
                  </Card>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Blog */}
        {tab === 'blog' && (
          <div className="space-y-6">
            {showBlogEditor && (
              <Card className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">{editingPost ? 'Edit Post' : 'New Blog Post'}</h3>
                <Input
                  label="Title"
                  value={blogForm.title}
                  onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                  placeholder="Your blog post title"
                />
                <Input
                  label="Excerpt"
                  value={blogForm.excerpt}
                  onChange={(e) => setBlogForm({ ...blogForm, excerpt: e.target.value })}
                  placeholder="A short summary shown in previews"
                />
                <Input
                  label="Cover Image URL"
                  value={blogForm.cover_image_url}
                  onChange={(e) => setBlogForm({ ...blogForm, cover_image_url: e.target.value })}
                  placeholder="https://..."
                />
                <Textarea
                  label="Content"
                  value={blogForm.content}
                  onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
                  rows={12}
                  placeholder="Write your blog post content here... (Markdown supported)"
                />
                <Input
                  label="Tags (comma separated)"
                  value={blogForm.tags}
                  onChange={(e) => setBlogForm({ ...blogForm, tags: e.target.value })}
                  placeholder="news, update, behind-the-scenes"
                />
                <button
                  onClick={() => setBlogForm({ ...blogForm, allow_comments: !blogForm.allow_comments })}
                  className="flex items-center gap-3 p-3 rounded-lg border border-surface-700 hover:border-surface-600 transition-colors text-left w-full"
                >
                  <div>
                    <p className="text-sm font-medium text-white">Allow Comments</p>
                    <p className="text-[11px] text-surface-400">Let readers comment on this post</p>
                  </div>
                  <div className={`ml-auto w-10 h-6 rounded-full shrink-0 transition-colors relative ${blogForm.allow_comments ? 'bg-brand-500' : 'bg-surface-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-surface-900 shadow transition-transform ${blogForm.allow_comments ? 'left-5' : 'left-1'}`} />
                  </div>
                </button>
                <div className="flex justify-end gap-2 pt-4 border-t border-surface-800">
                  <Button variant="ghost" onClick={resetBlogForm}>Cancel</Button>
                  <Button variant="ghost" onClick={() => saveBlogPost(false)} loading={saving} disabled={!blogForm.title.trim()}>Save Draft</Button>
                  <Button onClick={() => saveBlogPost(true)} loading={saving} disabled={!blogForm.title.trim() || !blogForm.content.trim()}>Publish</Button>
                </div>
              </Card>
            )}

            {!showBlogEditor && blogPosts.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-surface-400">No blog posts yet.</p>
                <p className="text-xs text-surface-500 mt-1">Share company updates, behind-the-scenes, and news with your audience.</p>
              </Card>
            )}

            {!showBlogEditor && blogPosts.map((post) => (
              <Card key={post.id} className="p-5">
                <div className="flex items-start gap-4">
                  {post.cover_image_url && (
                    <img src={post.cover_image_url} alt={post.title || 'Blog post cover'} className="w-20 h-14 rounded-lg object-cover shrink-0" loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {post.pinned && <span className="text-[11px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-500 font-bold">PINNED</span>}
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${
                        post.status === 'published' ? 'bg-green-500/20 text-green-400' :
                        post.status === 'draft' ? 'bg-surface-700 text-surface-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>{post.status}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">{post.title}</h3>
                    {post.excerpt && <p className="text-xs text-surface-400 mt-0.5 line-clamp-2">{post.excerpt}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-500">
                      <span>{(post as CompanyBlogPost & { author?: { display_name?: string } }).author?.display_name || 'Unknown'}</span>
                      <span>·</span>
                      <span>{new Date(post.created_at).toLocaleDateString()}</span>
                      {post.tags.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{post.tags.join(', ')}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{post.view_count} views</span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => togglePinPost(post)} className="text-xs text-surface-400 hover:text-yellow-400 px-2 py-1" title={post.pinned ? 'Unpin' : 'Pin'}>
                        📌
                      </button>
                      <button onClick={() => editBlogPost(post)} className="text-xs text-brand-500 hover:text-brand-400 px-2 py-1">Edit</button>
                      <button onClick={() => deleteBlogPost(post.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Settings */}
        {tab === 'settings' && canManage && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Company Details</h3>
              <div className="space-y-4">
                <Input label="Name" value={settingsForm.name || ''} onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })} />
                <Input label="Tagline" value={settingsForm.tagline || ''} onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })} placeholder="A short slogan" />
                <Textarea label="Description" value={settingsForm.description || ''} onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })} rows={3} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Website" value={settingsForm.website || ''} onChange={(e) => setSettingsForm({ ...settingsForm, website: e.target.value })} />
                  <Input label="Email" value={settingsForm.email || ''} onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Phone" value={settingsForm.phone || ''} onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })} />
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={settingsForm.brand_color || '#dd574e'} onChange={(e) => setSettingsForm({ ...settingsForm, brand_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                      <span className="text-sm text-surface-400">{settingsForm.brand_color}</span>
                    </div>
                  </div>
                </div>
                <Textarea label="Address" value={settingsForm.address || ''} onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })} rows={2} />
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Public Page</h3>
              <div className="space-y-4">
                {[
                  { key: 'public_page_enabled', label: 'Enable Public Page', desc: 'Allow visitors to see your company page' },
                  { key: 'show_team_on_public', label: 'Show Team', desc: 'Display team members on public page' },
                  { key: 'show_projects_on_public', label: 'Show Projects', desc: 'Display projects on public page' },
                  { key: 'allow_script_reading', label: 'Allow Script Reading', desc: 'Let visitors read published scripts' },
                ].map((toggle) => (
                  <button
                    key={toggle.key}
                    onClick={() => setSettingsForm({ ...settingsForm, [toggle.key]: !(settingsForm as Record<string, unknown>)[toggle.key] })}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-surface-700 hover:border-surface-600 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{toggle.label}</p>
                      <p className="text-[11px] text-surface-400">{toggle.desc}</p>
                    </div>
                    <div className={`w-10 h-[22px] rounded-full shrink-0 transition-colors relative ${(settingsForm as Record<string, unknown>)[toggle.key] ? 'bg-brand-500' : 'bg-surface-700'}`}>
                      <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${(settingsForm as Record<string, unknown>)[toggle.key] ? 'left-[20px]' : 'left-[2px]'}`} />
                    </div>
                  </button>
                ))}
              </div>
            </Card>
            <Button onClick={saveSettings} loading={saving}>Save Settings</Button>
          </div>
        )}

        {/* Pipeline */}
        {tab === 'pipeline' && company && (
          <OrgPipeline companyId={company.id} canManage={canManage} />
        )}

        {/* Channels */}
        {tab === 'channels' && company && (
          <OrgChannels companyId={company.id} userId={user!.id} canManage={canManage} />
        )}

        {/* Assignments */}
        {tab === 'assignments' && company && (
          <OrgAssignments companyId={company.id} userId={user!.id} canManage={canManage} />
        )}

        {/* Calendar */}
        {tab === 'calendar' && company && (
          <OrgCalendar companyId={company.id} userId={user!.id} canManage={canManage} />
        )}

        {/* Resources */}
        {tab === 'resources' && company && (
          <OrgResources companyId={company.id} userId={user!.id} canManage={canManage} />
        )}

        {/* Pitches */}
        {tab === 'pitches' && company && (
          <OrgPitches companyId={company.id} userId={user!.id} canManage={canManage} />
        )}

        {/* Announcements */}
        {tab === 'announcements' && company && (
          <OrgAnnouncements companyId={company.id} userId={user!.id} canManage={canManage} />
        )}

        {/* Education */}
        {tab === 'education' && company && (
          <OrgEducation companyId={company.id} userId={user!.id} canManage={canManage} />
        )}

        {/* Activity */}
        {tab === 'activity' && canManage && (
          <div className="space-y-2">
            {activity.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-surface-400">No activity yet.</p>
              </Card>
            ) : (
              activity.map((act) => (
                <Card key={act.id} className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {(act as CompanyActivityLog & { profile?: { display_name?: string } }).profile?.display_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-300">
                      <span className="text-white font-medium">{(act as CompanyActivityLog & { profile?: { display_name?: string } }).profile?.display_name || 'System'}</span>
                      {' '}{act.action.replace(/_/g, ' ')}
                      {act.entity_type && <span className="text-surface-500"> · {act.entity_type}</span>}
                    </p>
                  </div>
                  <span className="text-xs text-surface-500 shrink-0">{new Date(act.created_at).toLocaleString()}</span>
                </Card>
              ))
            )}
          </div>
        )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(confirmRemove)}
        title={`Remove ${confirmRemove?.name ?? ''}?`}
        message="They lose access to the company's channels, boards and tools. Projects they own stay theirs."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => confirmRemove && removeMember(confirmRemove.id)}
        onCancel={() => setConfirmRemove(null)}
      />
      <ConfirmDialog
        isOpen={Boolean(confirmDeleteTeam)}
        title={`Delete the ${confirmDeleteTeam?.name ?? ''} team?`}
        message="Members stay in the company; only the team and its permissions go."
        confirmLabel="Delete team"
        variant="danger"
        onConfirm={() => confirmDeleteTeam && deleteTeam(confirmDeleteTeam.id)}
        onCancel={() => setConfirmDeleteTeam(null)}
      />

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowInviteModal(false); setLastInviteLink(''); }}>
          <div className="w-full max-w-md p-6 rounded-xl border border-surface-800 bg-surface-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-6">Invite Member</h2>

            {lastInviteLink ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-center">
                  <p className="text-sm text-green-400 font-medium mb-1">Invitation sent!</p>
                  <p className="text-xs text-surface-400">If the recipient doesn&apos;t have an account yet, share this link directly:</p>
                </div>
                <div className="flex gap-2">
                  <input readOnly value={lastInviteLink} className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-xs text-surface-300 outline-none" />
                  <button
                    onClick={() => { navigator.clipboard.writeText(lastInviteLink); }}
                    className="px-3 py-2 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-600 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[11px] text-surface-500 text-center">Link expires in 7 days. They&apos;ll also see a banner on their dashboard if they&apos;re registered.</p>
                <div className="flex justify-between items-center pt-2">
                  <button onClick={() => setLastInviteLink('')} className="text-xs text-brand-500 hover:text-brand-400">Invite another</button>
                  <Button variant="ghost" onClick={() => { setShowInviteModal(false); setLastInviteLink(''); }}>Done</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <Input label="Email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" />
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Role</label>
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as CompanyRole)}
                      className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500">
                      <option value="admin">Admin — Full access</option>
                      <option value="manager">Manager — Manage projects & members</option>
                      <option value="member">Member — Edit content</option>
                      <option value="viewer">Viewer — Read only</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-surface-800">
                  <Button variant="ghost" onClick={() => setShowInviteModal(false)}>Cancel</Button>
                  <Button onClick={sendInvite} loading={saving} disabled={!inviteEmail.trim()}>Send Invite</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowTeamModal(false)}>
          <div className="w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto rounded-xl border border-surface-800 bg-surface-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-6">Create Team</h2>
            <div className="space-y-4">
              <Input label="Team Name" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Writers Room" />
              <Textarea label="Description" value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} placeholder="What does this team do?" rows={2} />
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Color</label>
                <input type="color" value={teamColor} onChange={(e) => setTeamColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-3">Permissions</label>
                <div className="space-y-2">
                  {[
                    { key: 'can_create_projects', label: 'Create Projects' },
                    { key: 'can_edit_scripts', label: 'Edit Scripts' },
                    { key: 'can_manage_production', label: 'Manage Production' },
                    { key: 'can_view_budget', label: 'View Budget' },
                    { key: 'can_manage_budget', label: 'Manage Budget' },
                    { key: 'can_invite_members', label: 'Invite Members' },
                    { key: 'can_publish_community', label: 'Publish to Community' },
                    { key: 'can_manage_company', label: 'Manage Company' },
                  ].map((perm) => (
                    <label key={perm.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-800 cursor-pointer">
                      <input type="checkbox" checked={(teamPerms as Record<string, boolean>)[perm.key]}
                        onChange={(e) => setTeamPerms({ ...teamPerms, [perm.key]: e.target.checked })}
                        className="rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500" />
                      <span className="text-sm text-surface-300">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-surface-800">
              <Button variant="ghost" onClick={() => setShowTeamModal(false)}>Cancel</Button>
              <Button onClick={createTeam} loading={saving} disabled={!teamName.trim()}>Create Team</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Team Modal */}
      {showAddToTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddToTeamModal(null)}>
          <div className="w-full max-w-md p-6 rounded-xl border border-surface-800 bg-surface-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-2">Add Member to Team</h2>
            <p className="text-xs text-surface-400 mb-6">Select a company member to add to this team.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemberForTeam(m.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    selectedMemberForTeam === m.id
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-surface-700 hover:border-surface-600'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {(m as CompanyMember & { profile?: Profile }).profile?.display_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{(m as CompanyMember & { profile?: Profile }).profile?.display_name || (m as CompanyMember & { profile?: Profile }).profile?.full_name || 'Member'}</p>
                    <p className="text-[11px] text-surface-400">{m.role}</p>
                  </div>
                  {selectedMemberForTeam === m.id && (
                    <svg className="w-5 h-5 text-brand-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-surface-800">
              <Button variant="ghost" onClick={() => { setShowAddToTeamModal(null); setSelectedMemberForTeam(''); }}>Cancel</Button>
              <Button
                onClick={() => addMemberToTeam(showAddToTeamModal, selectedMemberForTeam)}
                loading={saving}
                disabled={!selectedMemberForTeam}
              >
                Add to Team
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
