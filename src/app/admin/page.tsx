'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Badge, Card, Modal, Input, Textarea, LoadingPage, Avatar, Select, toast } from '@/components/ui';
import { cn, formatDate, timeAgo, getChallengePhase, getPhaseLabel } from '@/lib/utils';
import type { BlogPost, BlogPostSection, CommunityPost, CommunityCategory, ChallengeTheme, CommunityChallenge, SupportTicket, TicketMessage, Badge as BadgeType } from '@/lib/types';
import { BadgeDisplay } from '@/components/BadgeDisplay';


const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';
const MOD_TABS: Tab[] = ['tickets', 'community'];
const isStaff = (role?: string) => role === 'moderator' || role === 'admin';
const isFullAdmin = (id?: string, role?: string) => id === ADMIN_UID || role === 'admin';

interface PlatformStats {
  // Totals
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
  proUsers: number;
  pushSubscriptions: number;
  // Tickets
  totalTickets: number;
  openTickets: number;
  bugReports: number;
  ticketsByCategory: { category: string; count: number }[];
  ticketsByStatus: { status: string; count: number }[];
  // Trends (last 30 days, daily buckets)
  signupsByDay: { date: string; count: number }[];
  projectsByDay: { date: string; count: number }[];
  // Breakdowns
  scriptTypeBreakdown: { type: string; count: number }[];
  projectTypeBreakdown: { type: string; count: number }[];
  episodicProjects: number;
  // Recent
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
  is_pro: boolean;
  pro_since: string | null;
  created_at: string;
  updated_at: string;
  projectCount?: number;
}

interface ContributorRow {
  id: string;
  user_id: string;
  github_handle: string | null;
  bio: string | null;
  cached_name: string | null;
  cached_avatar_url: string | null;
  contribution_areas: string[];
  is_featured: boolean;
  added_at: string;
  added_by: string | null;
}

type Tab = 'overview' | 'users' | 'projects' | 'blog' | 'community' | 'tickets' | 'system' | 'contributors' | 'badges' | 'courses' | 'creators';

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
  const [opensourceEnabled, setOpensourceEnabled] = useState(true);
  const [proGatingEnabled, setProGatingEnabled] = useState(false);
  const [creatorProgramEnabled, setCreatorProgramEnabled] = useState(false);
  const [creatorPayoutEnabled, setCreatorPayoutEnabled] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Community
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityCategories, setCommunityCategories] = useState<CommunityCategory[]>([]);
  const [challengeThemes, setChallengeThemes] = useState<ChallengeTheme[]>([]);
  const [challenges, setChallenges] = useState<CommunityChallenge[]>([]);

  // Tickets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [ticketReply, setTicketReply] = useState('');

  // Contributors
  const [contributors, setContributors] = useState<ContributorRow[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isStaff(user.role)) {
      router.replace('/dashboard');
      return;
    }
    // Full admins get all data; mods only get tickets + community
    if (isFullAdmin(user.id, user.role)) {
      loadStats();
      loadUsers();
      loadProjects();
      loadBlogPosts();
      loadSiteVersion();
      loadOpensourceSetting();
      loadProGatingSetting();
      loadCreatorProgramSetting();
      loadCreatorPayoutSetting();
      loadContributors();
    } else {
      // Mods don't call loadStats, so clear loading immediately
      setLoading(false);
    }
    loadCommunityData();
    loadTickets();
    // Default mods to 'tickets' tab
    if (!isFullAdmin(user.id, user.role)) {
      setActiveTab('tickets');
    }
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

  const loadOpensourceSetting = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('site_settings').select('value').eq('key', 'opensource_enabled').single();
      if (data) setOpensourceEnabled(data.value !== 'false');
    } catch { /* row may not exist yet — default true */ }
  };

  const handleToggleOpensource = async (enabled: boolean) => {
    try {
      const supabase = createClient();
      await supabase.from('site_settings').upsert({ key: 'opensource_enabled', value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() });
      setOpensourceEnabled(enabled);
    } catch (err) {
      console.error('Error updating opensource setting:', err);
    }
  };

  const loadProGatingSetting = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('site_settings').select('value').eq('key', 'pro_gating_enabled').maybeSingle();
      if (data) setProGatingEnabled(data.value !== 'false');
    } catch { /* default true — gating on */ }
  };

  const handleToggleProGating = async (enabled: boolean) => {
    try {
      const supabase = createClient();
      await supabase.from('site_settings').upsert({ key: 'pro_gating_enabled', value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() });
      setProGatingEnabled(enabled);
    } catch (err) {
      console.error('Error updating pro gating setting:', err);
    }
  };

  const loadCreatorProgramSetting = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('site_settings').select('value').eq('key', 'creator_program_enabled').maybeSingle();
      if (data) setCreatorProgramEnabled(data.value === 'true');
    } catch { /* default false */ }
  };

  const handleToggleCreatorProgram = async (enabled: boolean) => {
    try {
      const supabase = createClient();
      await supabase.from('site_settings').upsert({ key: 'creator_program_enabled', value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() });
      setCreatorProgramEnabled(enabled);
    } catch (err) {
      console.error('Error updating creator program setting:', err);
    }
  };

  const loadCreatorPayoutSetting = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('site_settings').select('value').eq('key', 'creator_payout_enabled').maybeSingle();
      if (data) setCreatorPayoutEnabled(data.value === 'true');
    } catch { /* default false */ }
  };

  const handleToggleCreatorPayout = async (enabled: boolean) => {
    try {
      const supabase = createClient();
      await supabase.from('site_settings').upsert({ key: 'creator_payout_enabled', value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() });
      setCreatorPayoutEnabled(enabled);
    } catch (err) {
      console.error('Error updating creator payout setting:', err);
    }
  };

  const loadStats = async () => {
    try {
      const supabase = createClient();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        profilesRes, projectsRes, scriptsRes, elementsRes,
        charsRes, locsRes, scenesRes, shotsRes, ideasRes,
        budgetRes, schedRes, commentsRes,
        recentUsersRes, recentProjectsRes,
        proUsersRes, pushSubsRes,
        // Trends
        recentSignupsRes, recentProjectsCreatedRes,
        // Breakdowns
        scriptTypesRes, projectTypesRes, episodicRes,
        // Tickets
        ticketsTotalRes, ticketsOpenRes, ticketsBugRes,
        allTicketsRes,
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
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(8),
        supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(8),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_pro', true),
        supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }),
        // 30-day signup trend
        supabase.from('profiles').select('created_at').gte('created_at', thirtyDaysAgo),
        // 30-day project creation trend
        supabase.from('projects').select('created_at').gte('created_at', thirtyDaysAgo),
        // Script type breakdown
        supabase.from('scripts').select('script_type'),
        // Project type breakdown
        supabase.from('projects').select('project_type'),
        // Episodic projects
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('script_type', 'episodic'),
        // Ticket counts
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('category', 'bug'),
        // All tickets for breakdown
        supabase.from('support_tickets').select('status, category'),
      ]);

      // ── Words ─────────────────────────────────────────────────────────
      const allElements = elementsRes.data || [];
      const totalWords = allElements.reduce((sum, el) => {
        const words = (el.content || '').trim().split(/\s+/).filter(Boolean).length;
        return sum + words;
      }, 0);

      // ── 30-day trend buckets ──────────────────────────────────────────
      const bucketByDay = (rows: { created_at: string }[]) => {
        const map: Record<string, number> = {};
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          map[d.toISOString().slice(0, 10)] = 0;
        }
        for (const r of rows) {
          const day = r.created_at.slice(0, 10);
          if (day in map) map[day] = (map[day] || 0) + 1;
        }
        return Object.entries(map).map(([date, count]) => ({ date, count }));
      };
      const signupsByDay   = bucketByDay(recentSignupsRes.data || []);
      const projectsByDay  = bucketByDay(recentProjectsCreatedRes.data || []);

      // ── Breakdowns ────────────────────────────────────────────────────
      const groupBy = (rows: any[], key: string) => {
        const map: Record<string, number> = {};
        for (const r of rows) {
          const v = r[key] || 'unknown';
          map[v] = (map[v] || 0) + 1;
        }
        return Object.entries(map).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
      };
      const scriptTypeBreakdown  = groupBy(scriptTypesRes.data || [], 'script_type');
      const projectTypeBreakdown = groupBy(projectTypesRes.data || [], 'project_type');
      const ticketsByCat  = groupBy(allTicketsRes.data || [], 'category').map(({ type: category, count }) => ({ category, count }));
      const ticketsByStat = groupBy(allTicketsRes.data || [], 'status').map(({ type: status, count }) => ({ status, count }));

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
        proUsers: proUsersRes.count || 0,
        pushSubscriptions: pushSubsRes.count || 0,
        totalTickets: ticketsTotalRes.count || 0,
        openTickets: ticketsOpenRes.count || 0,
        bugReports: ticketsBugRes.count || 0,
        ticketsByCategory: ticketsByCat,
        ticketsByStatus: ticketsByStat,
        signupsByDay,
        projectsByDay,
        scriptTypeBreakdown,
        projectTypeBreakdown,
        episodicProjects: episodicRes.count || 0,
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

  const loadCommunityData = async () => {
    try {
      const supabase = createClient();
      const [postsRes, catsRes, themesRes, challengesRes] = await Promise.all([
        supabase.from('community_posts').select('*, author:profiles!author_id(full_name, email)').order('created_at', { ascending: false }),
        supabase.from('community_categories').select('*').order('display_order'),
        supabase.from('challenge_themes').select('*').order('title'),
        supabase.from('community_challenges').select('*').order('starts_at', { ascending: false }),
      ]);
      setCommunityPosts(postsRes.data || []);
      setCommunityCategories(catsRes.data || []);
      setChallengeThemes(themesRes.data || []);
      setChallenges(challengesRes.data || []);
    } catch (err) {
      console.error('Error loading community data:', err);
    }
  };

  const loadTickets = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('support_tickets')
        .select('*, profile:profiles(*)')
        .order('updated_at', { ascending: false });
      setTickets(data || []);
    } catch (err) {
      console.error('Error loading tickets:', err);
    }
  };

  const loadContributors = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('contributors')
        .select('*')
        .order('added_at', { ascending: false });
      if (error) { console.error('Contributors load error:', error); toast.error('Contributors: ' + error.message); return; }
      setContributors((data || []) as ContributorRow[]);
    } catch (err) {
      console.error('Error loading contributors:', err);
    }
  };

  const handleAddContributor = async (userId: string, github: string, bio: string, areas: string[]) => {
    const supabase = createClient();
    // Fetch profile details to cache for join-free public display
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, display_name, avatar_url')
      .eq('id', userId)
      .single();
    const cachedName = profile?.full_name || profile?.display_name || null;
    const cachedAvatar = profile?.avatar_url || null;
    const { data, error } = await supabase
      .from('contributors')
      .insert({
        user_id: userId,
        github_handle: github || null,
        bio: bio || null,
        contribution_areas: areas,
        cached_name: cachedName,
        cached_avatar_url: cachedAvatar,
        added_by: user!.id,
      })
      .select('*')
      .single();
    if (error) {
      console.error('Contributors insert error:', error);
      toast.error(`Failed to add contributor: ${error.message}`);
      return;
    }
    if (data) setContributors(prev => [data as ContributorRow, ...prev]);
    toast.success('Contributor added!');
  };

  const handleRemoveContributor = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('contributors').delete().eq('id', id);
    if (error) { toast.error('Failed to remove: ' + error.message); return; }
    setContributors(prev => prev.filter(c => c.id !== id));
    toast.success('Contributor removed');
  };

  const handleToggleFeatured = async (id: string, featured: boolean) => {
    const supabase = createClient();
    const { error } = await supabase.from('contributors').update({ is_featured: featured }).eq('id', id);
    if (error) { toast.error('Failed to update: ' + error.message); return; }
    setContributors(prev => prev.map(c => c.id === id ? { ...c, is_featured: featured } : c));
  };

  const loadTicketMessages = async (ticketId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('ticket_messages')
      .select('*, profile:profiles(*)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setTicketMessages(data || []);
  };

  const handleSelectTicket = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    await loadTicketMessages(ticketId);
  };

  const handleTicketReply = async () => {
    if (!ticketReply.trim() || !selectedTicketId || !user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ticket_messages')
      .insert({ ticket_id: selectedTicketId, user_id: user.id, content: ticketReply.trim(), is_staff: true })
      .select('*, profile:profiles(*)')
      .single();
    if (!error && data) {
      setTicketMessages((prev) => [...prev, data]);
      setTicketReply('');
      await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', selectedTicketId);
      // Send notification to the ticket owner
      const ticket = tickets.find((t) => t.id === selectedTicketId);
      if (ticket && ticket.user_id !== user.id) {
        const notifTitle = 'New reply on your support ticket';
        const notifBody = `Staff replied to "${ticket.subject}"`;
        const notifLink = `/support?ticket=${ticket.id}`;
        await supabase.from('notifications').insert({
          user_id: ticket.user_id,
          type: 'ticket_reply',
          title: notifTitle,
          body: notifBody,
          link: notifLink,
          actor_id: user.id,
          entity_type: 'support_ticket',
          entity_id: ticket.id,
        });
        // Push delivery is handled by the recipient's useNotifications hook (triggerSelfPush)
        // Trigger email notification
        const { data: ownerProfile, error: profileError } = await supabase.from('profiles').select('email, full_name, display_name').eq('id', ticket.user_id).single();
        if (profileError) console.error('Failed to fetch ticket owner profile:', profileError.message);
        if (ownerProfile?.email) {
          fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: { email: ownerProfile.email, name: ownerProfile.display_name || ownerProfile.full_name || undefined },
              subject: `Re: ${ticket.subject} — Screenplay Studio Support`,
              heading: 'New reply on your support ticket',
              body: `Our team responded to your ticket: <strong>${ticket.subject}</strong>`,
              ctaLabel: 'View Ticket',
              ctaUrl: `/support?ticket=${ticket.id}`,
            }),
          }).catch(() => {}); // best-effort
        }
      }
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticketId);
    if (!error) {
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status: status as any } : t));
    }
  };

  const handleUpdateTicketPriority = async (ticketId: string, priority: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('support_tickets').update({ priority, updated_at: new Date().toISOString() }).eq('id', ticketId);
    if (!error) {
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, priority: priority as any } : t));
    }
  };

  const handleDeleteCommunityPost = async (id: string) => {
    if (!confirm('Delete this community post?')) return;
    const supabase = createClient();
    await supabase.from('community_post_categories').delete().eq('post_id', id);
    await supabase.from('community_comments').delete().eq('post_id', id);
    await supabase.from('community_upvotes').delete().eq('post_id', id);
    await supabase.from('community_posts').delete().eq('id', id);
    await loadCommunityData();
  };

  const handleSaveCategory = async (cat: Partial<CommunityCategory> & { id?: string }) => {
    const supabase = createClient();
    if (cat.id) {
      await supabase.from('community_categories').update({ name: cat.name, slug: cat.slug, description: cat.description, icon: cat.icon, color: cat.color, display_order: cat.display_order }).eq('id', cat.id);
    } else {
      await supabase.from('community_categories').insert({ name: cat.name!, slug: cat.slug!, description: cat.description, icon: cat.icon, color: cat.color, display_order: cat.display_order || 0 });
    }
    await loadCommunityData();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    const supabase = createClient();
    await supabase.from('community_post_categories').delete().eq('category_id', id);
    await supabase.from('community_categories').delete().eq('id', id);
    await loadCommunityData();
  };

  const handleSaveTheme = async (theme: Partial<ChallengeTheme> & { id?: string }) => {
    const supabase = createClient();
    if (theme.id) {
      await supabase.from('challenge_themes').update({ title: theme.title, description: theme.description, genre_hint: theme.genre_hint, constraints: theme.constraints, difficulty: theme.difficulty, is_active: theme.is_active }).eq('id', theme.id);
    } else {
      await supabase.from('challenge_themes').insert({ title: theme.title!, description: theme.description!, genre_hint: theme.genre_hint, constraints: theme.constraints, difficulty: theme.difficulty || 'intermediate', is_active: true });
    }
    await loadCommunityData();
  };

  const handleDeleteTheme = async (id: string) => {
    if (!confirm('Delete this challenge theme?')) return;
    const supabase = createClient();
    await supabase.from('challenge_themes').delete().eq('id', id);
    await loadCommunityData();
  };

  const handleCreateCustomChallenge = async (data: { title: string; description: string; starts_at: string; submissions_close_at: string; voting_close_at: string; reveal_at: string; prize_title?: string; prize_description?: string }) => {
    const supabase = createClient();
    await supabase.from('community_challenges').insert({ ...data, challenge_type: 'custom', created_by: user!.id });
    await loadCommunityData();
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
  if (!user || !isStaff(user.role)) return null;
  const isFull = isFullAdmin(user.id, user.role);

  const filteredUsers = users.filter((u) =>
    !userSearch || (u.email + ' ' + (u.full_name || '')).toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredProjects = projects.filter((p) =>
    !projectSearch || p.title.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const allTabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
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
    {
      key: 'community' as Tab, label: 'Community',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    },
    {
      key: 'tickets' as Tab, label: 'Tickets',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>,
    },
    {
      key: 'contributors' as Tab, label: 'Contributors',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    },
    {
      key: 'badges' as Tab, label: 'Badges',
      icon: <span className="text-base leading-5">🎖️</span>,
    },
    {
      key: 'courses' as Tab, label: 'Courses',
      icon: <span className="text-base leading-5">📚</span>,
    },
    {
      key: 'creators' as Tab, label: 'Creators',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    },
  ];
  // Mods only see tickets + community; full admins see everything
  const tabs = isFull ? allTabs : allTabs.filter((t) => MOD_TABS.includes(t.key));

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950 relative">
      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 bg-surface-950 border-b border-surface-800 flex items-center px-3 gap-3">
        <button onClick={() => setShowMobileSidebar(!showMobileSidebar)} className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-900/10">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span className="text-sm font-semibold text-white">{isFull ? 'Admin' : 'Mod'} Panel</span>
      </div>

      {/* Mobile overlay */}
      {showMobileSidebar && <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setShowMobileSidebar(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        'w-64 flex flex-col border-r border-surface-800 bg-surface-950 shrink-0',
        'fixed md:relative inset-y-0 left-0 z-40 transition-transform duration-200',
        showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <div className="border-b border-surface-800 p-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                A
              </div>
            </Link>
            <div>
              <h2 className="text-sm font-semibold text-white">{isFull ? 'Admin Panel' : 'Mod Panel'}</h2>
              <p className="text-[11px] text-surface-500">{isFull ? 'Platform Management' : 'Moderation Tools'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setShowMobileSidebar(false); }}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                activeTab === tab.key
                  ? 'bg-[#E54E15]/10 text-[#FF5F1F]'
                  : 'text-surface-400 hover:bg-surface-900/5 hover:text-white'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}

          {isFull && (
            <div className="mt-4 pt-4 border-t border-surface-800">
              <p className="px-3 py-1 text-[10px] text-surface-600 uppercase tracking-wider font-medium">Tools</p>
              <Link href="/admin/legal" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                Legal Blog
              </Link>
              <Link href="/admin/security" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Security
              </Link>
              <Link href="/admin/reports" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg>
                Reports
              </Link>
              <Link href="/admin/features" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                Feature Flags
              </Link>
              <Link href="/admin/changelog" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                Changelog
              </Link>
              <Link href="/admin/feedback" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" /></svg>
                Feedback
              </Link>
              <Link href="/admin/polls" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-surface-900/5 hover:text-white transition-all duration-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Polls
              </Link>
            </div>
          )}
        </nav>

        <div className="border-t border-surface-800 p-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs text-surface-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto pt-12 md:pt-0">
        <div className="p-3 sm:p-4 md:p-8 max-w-7xl mx-auto">
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
              opensourceEnabled={opensourceEnabled}
              onToggleOpensource={handleToggleOpensource}
              proGatingEnabled={proGatingEnabled}
              onToggleProGating={handleToggleProGating}
              creatorProgramEnabled={creatorProgramEnabled}
              onToggleCreatorProgram={handleToggleCreatorProgram}
              creatorPayoutEnabled={creatorPayoutEnabled}
              onToggleCreatorPayout={handleToggleCreatorPayout}
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
          {activeTab === 'community' && (
            <CommunityTab
              posts={communityPosts}
              categories={communityCategories}
              themes={challengeThemes}
              challenges={challenges}
              onDeletePost={handleDeleteCommunityPost}
              onSaveCategory={handleSaveCategory}
              onDeleteCategory={handleDeleteCategory}
              onSaveTheme={handleSaveTheme}
              onDeleteTheme={handleDeleteTheme}
              onCreateChallenge={handleCreateCustomChallenge}
            />
          )}
          {activeTab === 'tickets' && (
            <TicketsTab
              tickets={tickets}
              selectedTicketId={selectedTicketId}
              messages={ticketMessages}
              replyText={ticketReply}
              onSelectTicket={handleSelectTicket}
              onReply={handleTicketReply}
              onReplyChange={setTicketReply}
              onStatusChange={handleUpdateTicketStatus}
              onPriorityChange={handleUpdateTicketPriority}
            />
          )}
          {activeTab === 'contributors' && (
            <ContributorsTab
              contributors={contributors}
              onRemove={handleRemoveContributor}
              onAdd={handleAddContributor}
              onToggleFeatured={handleToggleFeatured}
            />
          )}
          {activeTab === 'badges' && (
            <BadgesAdminTab />
          )}
          {activeTab === 'courses' && (
            <CoursesAdminTab />
          )}
          {activeTab === 'creators' && (
            <CreatorsTab
              programEnabled={creatorProgramEnabled}
              payoutEnabled={creatorPayoutEnabled}
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

// ── helpers ──────────────────────────────────────────────────────────────────

/** Pure-SVG sparkline (no deps). values = array of numbers. */
function Sparkline({
  values,
  color = '#7c3aed',
  height = 48,
  strokeWidth = 2,
}: {
  values: number[];
  color?: string;
  height?: number;
  strokeWidth?: number;
}) {
  if (values.length < 2) return null;
  const w   = 300;
  const h   = height;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  // Fill polygon
  const fill = `${pts[0]} ${pts.join(' ')} ${w},${h} 0,${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="overflow-visible">
      <polygon points={fill} fill={color} fillOpacity={0.12} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Horizontal bar chart row */
function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-surface-400 w-28 shrink-0 truncate capitalize">{label.replace(/_/g, ' ')}</span>
      <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold text-white w-8 text-right shrink-0">{count}</span>
    </div>
  );
}

/** A big KPI card */
function KpiCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-surface-800 bg-gradient-to-br p-4 flex flex-col gap-2 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-surface-400">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-black text-white tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        <p className="text-xs text-surface-400 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-surface-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({ stats }: { stats: PlatformStats }) {
  const proRate      = stats.totalUsers > 0 ? ((stats.proUsers / stats.totalUsers) * 100).toFixed(1) : '0';
  const projPerUser  = stats.totalUsers > 0 ? (stats.totalProjects / stats.totalUsers).toFixed(1) : '0';
  const avgWords     = stats.totalScripts > 0 ? Math.round(stats.totalWords / stats.totalScripts).toLocaleString() : '0';
  const newSignups30 = stats.signupsByDay.reduce((s, d) => s + d.count, 0);
  const newProj30    = stats.projectsByDay.reduce((s, d) => s + d.count, 0);

  const signupValues   = stats.signupsByDay.map((d) => d.count);
  const projectValues  = stats.projectsByDay.map((d) => d.count);

  const scriptColors: Record<string, string> = {
    screenplay:'#7c3aed', episodic:'#0369a1', stageplay:'#047857',
    youtube:'#b45309', tiktok:'#be185d', podcast:'#6d28d9', other:'#374151',
  };
  const projColors: Record<string, string> = {
    film:'#7c3aed', youtube:'#0369a1', documentary:'#047857',
    tv_production:'#b45309', podcast:'#be185d', tiktok:'#6d28d9', other:'#374151',
  };
  const ticketColors: Record<string, string> = {
    bug:'#dc2626', general:'#0369a1', feature_request:'#047857',
    abuse:'#b45309', content_report:'#be185d',
  };
  const statusColors: Record<string, string> = {
    open:'#dc2626', in_progress:'#b45309', resolved:'#047857', closed:'#374151',
  };

  const maxScript  = Math.max(...stats.scriptTypeBreakdown.map((d) => d.count), 1);
  const maxProj    = Math.max(...stats.projectTypeBreakdown.map((d) => d.count), 1);
  const maxTickCat = Math.max(...stats.ticketsByCategory.map((d) => d.count), 1);
  const maxTickSt  = Math.max(...stats.ticketsByStatus.map((d) => d.count), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white mb-1">Platform Overview</h1>
        <p className="text-sm text-surface-400">Live stats across all of Screenplay Studio</p>
      </div>

      {/* ── Primary KPI row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Users"
          value={stats.totalUsers}
          sub={`+${newSignups30} in last 30 days`}
          color="from-blue-500/20 to-blue-900/5"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <KpiCard
          label="Pro Users"
          value={stats.proUsers}
          sub={`${proRate}% conversion`}
          color="from-yellow-500/20 to-yellow-900/5"
          icon={<svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
        />
        <KpiCard
          label="Projects"
          value={stats.totalProjects}
          sub={`+${newProj30} in last 30 days`}
          color="from-violet-500/20 to-violet-900/5"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>}
        />
        <KpiCard
          label="Total Words Written"
          value={stats.totalWords}
          sub={`~${avgWords} per script`}
          color="from-emerald-500/20 to-emerald-900/5"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
        />
      </div>

      {/* ── Growth charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signups sparkline */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">New Signups — Last 30 Days</h3>
              <p className="text-xs text-surface-500 mt-0.5">{newSignups30} total new users</p>
            </div>
            <span className="text-2xl font-black text-blue-400">{newSignups30}</span>
          </div>
          <Sparkline values={signupValues} color="#3b82f6" height={56} />
          {/* Day labels: first and last */}
          <div className="flex justify-between text-[10px] text-surface-600 mt-1">
            <span>{stats.signupsByDay[0]?.date.slice(5)}</span>
            <span>{stats.signupsByDay[stats.signupsByDay.length - 1]?.date.slice(5)}</span>
          </div>
        </div>

        {/* Projects sparkline */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">New Projects — Last 30 Days</h3>
              <p className="text-xs text-surface-500 mt-0.5">{newProj30} projects created</p>
            </div>
            <span className="text-2xl font-black text-violet-400">{newProj30}</span>
          </div>
          <Sparkline values={projectValues} color="#7c3aed" height={56} />
          <div className="flex justify-between text-[10px] text-surface-600 mt-1">
            <span>{stats.projectsByDay[0]?.date.slice(5)}</span>
            <span>{stats.projectsByDay[stats.projectsByDay.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      </div>

      {/* ── Engagement metrics row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Scripts', value: stats.totalScripts, c: 'text-green-400' },
          { label: 'Elements', value: stats.totalElements.toLocaleString(), c: 'text-cyan-400' },
          { label: 'Characters', value: stats.totalCharacters, c: 'text-rose-400' },
          { label: 'Locations', value: stats.totalLocations, c: 'text-emerald-400' },
          { label: 'Scenes', value: stats.totalScenes, c: 'text-indigo-400' },
          { label: 'Shots', value: stats.totalShots, c: 'text-orange-400' },
          { label: 'Ideas', value: stats.totalIdeas, c: 'text-yellow-400' },
          { label: 'Budget Items', value: stats.totalBudgetItems, c: 'text-teal-400' },
          { label: 'Schedule Events', value: stats.totalScheduleEvents, c: 'text-pink-400' },
          { label: 'Comments', value: stats.totalComments, c: 'text-violet-400' },
          { label: 'Push Subs', value: stats.pushSubscriptions, c: 'text-sky-400' },
          { label: 'Episodic Projects', value: stats.episodicProjects, c: 'text-blue-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-surface-800 bg-surface-900/50 p-3 text-center">
            <p className={`text-xl font-black ${s.c}`}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
            <p className="text-[10px] text-surface-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Content breakdown charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Script types */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Script Types</h3>
          <div className="space-y-2.5">
            {stats.scriptTypeBreakdown.map((d) => (
              <BarRow key={d.type} label={d.type} count={d.count} max={maxScript} color={scriptColors[d.type] || '#374151'} />
            ))}
          </div>
        </div>
        {/* Project types */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Project Types</h3>
          <div className="space-y-2.5">
            {stats.projectTypeBreakdown.map((d) => (
              <BarRow key={d.type} label={d.type} count={d.count} max={maxProj} color={projColors[d.type] || '#374151'} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Support / tickets ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick ticket KPIs */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-white">Support Overview</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Tickets', value: stats.totalTickets, c: 'text-white' },
              { label: 'Open / Active', value: stats.openTickets, c: 'text-amber-400' },
              { label: 'Bug Reports', value: stats.bugReports, c: 'text-red-400' },
            ].map((t) => (
              <div key={t.label} className="text-center">
                <p className={`text-2xl font-black ${t.c}`}>{t.value}</p>
                <p className="text-[10px] text-surface-500 mt-0.5">{t.label}</p>
              </div>
            ))}
          </div>
          {/* Open rate bar */}
          <div>
            <div className="flex justify-between text-[10px] text-surface-500 mb-1">
              <span>Open rate</span>
              <span>{stats.totalTickets > 0 ? ((stats.openTickets / stats.totalTickets) * 100).toFixed(0) : 0}%</span>
            </div>
            <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${stats.totalTickets > 0 ? (stats.openTickets / stats.totalTickets) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tickets by category */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">By Category</h3>
          <div className="space-y-2.5">
            {stats.ticketsByCategory.length > 0 ? stats.ticketsByCategory.map((d) => (
              <BarRow key={d.category} label={d.category} count={d.count} max={maxTickCat} color={ticketColors[d.category] || '#374151'} />
            )) : <p className="text-xs text-surface-600">No tickets yet</p>}
          </div>
        </div>

        {/* Tickets by status */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">By Status</h3>
          <div className="space-y-2.5">
            {stats.ticketsByStatus.length > 0 ? stats.ticketsByStatus.map((d) => (
              <BarRow key={d.status} label={d.status} count={d.count} max={maxTickSt} color={statusColors[d.status] || '#374151'} />
            )) : <p className="text-xs text-surface-600">No tickets yet</p>}
          </div>
        </div>
      </div>

      {/* ── Platform health + recent activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health metrics */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Platform Health</h3>
          <div className="space-y-3">
            {[
              { label: 'Projects / User', value: projPerUser },
              { label: 'Pro Conversion', value: `${proRate}%` },
              { label: 'Avg Words / Script', value: avgWords },
              { label: 'Scripts / Project', value: stats.totalProjects > 0 ? (stats.totalScripts / stats.totalProjects).toFixed(1) : '0' },
              { label: 'Elements / Script', value: stats.totalScripts > 0 ? Math.round(stats.totalElements / stats.totalScripts) : 0 },
              { label: 'Database', value: '🟢 Active' },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between border-b border-surface-800/50 pb-2 last:border-0 last:pb-0">
                <span className="text-xs text-surface-400">{m.label}</span>
                <span className="text-xs font-semibold text-white">{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent users */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Signups</h3>
          <div className="space-y-3">
            {stats.recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3">
                <Avatar src={u.avatar_url} name={u.full_name || u.email} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white truncate">{u.full_name || 'Unnamed'}</p>
                  <p className="text-[10px] text-surface-500 truncate">{u.email}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-[10px] text-surface-600">{timeAgo(u.created_at)}</span>
                  {u.is_pro && <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/10 px-1 rounded">PRO</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent projects */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Projects</h3>
          <div className="space-y-3">
            {stats.recentProjects.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#E54E15] flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {(p.title || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white truncate">{p.title}</p>
                  <p className="text-[10px] text-surface-500 capitalize">{(p.script_type || '').replace('_', ' ')}</p>
                </div>
                <span className="text-[10px] text-surface-600 shrink-0">{timeAgo(p.created_at)}</span>
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
  const [copied, setCopied] = useState(false);
  const [dmAllOpen, setDmAllOpen] = useState(false);
  const [dmAllMessage, setDmAllMessage] = useState('');
  const [dmAllSending, setDmAllSending] = useState(false);
  const [dmAllProgress, setDmAllProgress] = useState('');
  const router = useRouter();

  const handleDmUser = async (targetUser: UserRow) => {
    const supabase = createClient();
    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me) return;

    // Check for existing direct conversation
    const { data: myConvos } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', me.id);
    const myConvoIds = (myConvos || []).map((c) => c.conversation_id);

    if (myConvoIds.length > 0) {
      const { data: theirConvos } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', targetUser.id)
        .in('conversation_id', myConvoIds);

      if (theirConvos && theirConvos.length > 0) {
        // Check which one is direct
        for (const tc of theirConvos) {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id, conversation_type')
            .eq('id', tc.conversation_id)
            .eq('conversation_type', 'direct')
            .single();
          if (conv) {
            router.push(`/messages?convo=${conv.id}`);
            return;
          }
        }
      }
    }

    // Create new direct conversation
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ conversation_type: 'direct', created_by: me.id })
      .select()
      .single();
    if (!conv) return;

    await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: me.id, role: 'admin' },
      { conversation_id: conv.id, user_id: targetUser.id, role: 'member' },
    ]);

    router.push(`/messages?convo=${conv.id}`);
  };

  const handleDmAll = async () => {
    if (!dmAllMessage.trim()) return;
    setDmAllSending(true);
    const supabase = createClient();
    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me) { setDmAllSending(false); return; }

    let sent = 0;
    const total = users.filter((u) => u.id !== me.id).length;

    for (const targetUser of users) {
      if (targetUser.id === me.id) continue;
      try {
        // Find or create conversation
        let convoId: string | null = null;

        const { data: myConvos } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', me.id);
        const myConvoIds = (myConvos || []).map((c) => c.conversation_id);

        if (myConvoIds.length > 0) {
          const { data: theirConvos } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', targetUser.id)
            .in('conversation_id', myConvoIds);

          if (theirConvos) {
            for (const tc of theirConvos) {
              const { data: conv } = await supabase
                .from('conversations')
                .select('id, conversation_type')
                .eq('id', tc.conversation_id)
                .eq('conversation_type', 'direct')
                .single();
              if (conv) { convoId = conv.id; break; }
            }
          }
        }

        if (!convoId) {
          const { data: conv } = await supabase
            .from('conversations')
            .insert({ conversation_type: 'direct', created_by: me.id })
            .select()
            .single();
          if (conv) {
            convoId = conv.id;
            await supabase.from('conversation_members').insert([
              { conversation_id: conv.id, user_id: me.id, role: 'admin' },
              { conversation_id: conv.id, user_id: targetUser.id, role: 'member' },
            ]);
          }
        }

        if (convoId) {
          await supabase.from('direct_messages').insert({
            conversation_id: convoId,
            sender_id: me.id,
            content: dmAllMessage.trim(),
            message_type: 'text',
          });
          sent++;
          setDmAllProgress(`Sent ${sent}/${total}`);
        }
      } catch (e) {
        console.error('DM send error for', targetUser.id, e);
      }
    }

    setDmAllSending(false);
    setDmAllOpen(false);
    setDmAllMessage('');
    setDmAllProgress('');
    toast.success(`Message sent to ${sent} user${sent !== 1 ? 's' : ''}`);
  };

  const handleCopyEmails = async () => {
    const emails = users.map((u) => u.email).filter(Boolean).join(', ');
    try {
      await navigator.clipboard.writeText(emails);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = emails;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">User Management</h1>
          <p className="text-sm text-surface-400">{users.length} users total</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDmAllOpen(true)}
            title={`Send DM to ${search ? 'filtered' : 'all'} users`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-150 bg-[#FF5F1F]/10 border-[#FF5F1F]/30 text-[#FF5F1F] hover:bg-[#FF5F1F]/20 hover:border-[#FF5F1F]/50"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            DM {search ? `${users.length} filtered` : 'all'} users
          </button>
          <button
            onClick={handleCopyEmails}
            title={`Copy ${users.length} email${users.length !== 1 ? 's' : ''} to clipboard`}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-150',
              copied
                ? 'bg-green-500/15 border-green-500/40 text-green-400'
                : 'bg-surface-800 border-surface-700 text-surface-300 hover:text-white hover:border-surface-600',
            )}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied {users.length} email{users.length !== 1 ? 's' : ''}
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Copy {search ? `${users.length} filtered` : 'all'} emails
              </>
            )}
          </button>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder:text-surface-500 outline-none focus:border-[#FF5F1F] w-64"
            />
          </div>
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
                  <div className="flex items-center gap-1.5">
                    <Badge variant={u.role === 'admin' || u.id === ADMIN_UID ? 'warning' : u.role === 'moderator' ? 'success' : 'default'} size="sm">
                      {u.role === 'admin' || u.id === ADMIN_UID ? 'Admin' : u.role === 'moderator' ? 'Moderator' : u.role || 'user'}
                    </Badge>
                    {u.is_pro && <Badge variant="success" size="sm">PRO</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-surface-400">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => handleDmUser(u)} className="p-1.5 rounded text-surface-400 hover:text-[#FF5F1F] hover:bg-[#FF5F1F]/10 transition-colors" title="Send DM">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    </button>
                    <button onClick={() => onEdit(u)} className="p-1.5 rounded text-surface-400 hover:text-white hover:bg-surface-900/10 transition-colors" title="Edit">
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

      {/* DM All Modal */}
      <Modal isOpen={dmAllOpen} onClose={() => { setDmAllOpen(false); setDmAllMessage(''); setDmAllProgress(''); }} title={`DM ${search ? 'Filtered' : 'All'} Users`}>
        <div className="space-y-4">
          <p className="text-sm text-surface-400">
            This will send a direct message to <strong className="text-white">{users.filter((u) => u.id !== ADMIN_UID).length}</strong> user{users.filter((u) => u.id !== ADMIN_UID).length !== 1 ? 's' : ''}. Each user will receive an individual DM.
          </p>
          <Textarea
            value={dmAllMessage}
            onChange={(e) => setDmAllMessage(e.target.value)}
            placeholder="Type your message..."
            rows={4}
          />
          {dmAllProgress && (
            <p className="text-xs text-[#FF5F1F] font-mono">{dmAllProgress}</p>
          )}
          <div className="flex gap-2">
            <Button onClick={handleDmAll} disabled={!dmAllMessage.trim() || dmAllSending} className="flex-1">
              {dmAllSending ? 'Sending...' : `Send to ${users.filter((u) => u.id !== ADMIN_UID).length} users`}
            </Button>
            <Button variant="secondary" onClick={() => { setDmAllOpen(false); setDmAllMessage(''); }}>Cancel</Button>
          </div>
        </div>
      </Modal>
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
          <h1 className="text-2xl font-black text-white mb-1">All Projects</h1>
          <p className="text-sm text-surface-400">{projects.length} projects total</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder:text-surface-500 outline-none focus:border-[#FF5F1F] w-64"
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
              <div className="w-10 h-10 rounded-lg bg-[#E54E15] flex items-center justify-center text-sm font-bold text-white shrink-0">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 mb-4">
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

function SystemTab({ rebootStatus, onSoftReboot, onClearPresence, onRefreshStats, siteVersion, onUpdateVersion, opensourceEnabled, onToggleOpensource, proGatingEnabled, onToggleProGating, creatorProgramEnabled, onToggleCreatorProgram, creatorPayoutEnabled, onToggleCreatorPayout }: {
  rebootStatus: string | null;
  onSoftReboot: () => void;
  onClearPresence: () => void;
  onRefreshStats: () => void;
  siteVersion: string;
  onUpdateVersion: (v: string) => void;
  opensourceEnabled: boolean;
  onToggleOpensource: (enabled: boolean) => void;
  proGatingEnabled: boolean;
  onToggleProGating: (enabled: boolean) => void;
  creatorProgramEnabled: boolean;
  onToggleCreatorProgram: (enabled: boolean) => void;
  creatorPayoutEnabled: boolean;
  onToggleCreatorPayout: (enabled: boolean) => void;
}) {
  const [editingVersion, setEditingVersion] = useState(false);
  const [versionDraft, setVersionDraft] = useState(siteVersion);

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-1">System Management</h1>
      <p className="text-sm text-surface-400 mb-8">Maintenance tools for the platform</p>

      {/* Open Source toggle */}
      <div className="mb-6 rounded-xl border bg-surface-900/50 p-5 flex items-center justify-between"
        style={{ borderColor: opensourceEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: opensourceEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)' }}>
            <span className="text-xl">{opensourceEnabled ? '🔓' : '🔒'}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Open Source Mode
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                opensourceEnabled
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  : 'text-white/30 border-white/10 bg-white/5'
              }`}>
                {opensourceEnabled ? 'ON' : 'OFF'}
              </span>
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {opensourceEnabled
                ? 'Shows /contribute page, open-source mentions in metadata, and contributor sections'
                : 'Hides /contribute, strips open-source from titles/embeds, hides contributor section in /about'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onToggleOpensource(!opensourceEnabled)}
          className={`relative w-12 h-6 rounded-full transition-all ${
            opensourceEnabled ? 'bg-emerald-500' : 'bg-surface-700'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            opensourceEnabled ? 'translate-x-6' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Pro Gating toggle */}
      <div className="mb-6 rounded-xl border bg-surface-900/50 p-5 flex items-center justify-between"
        style={{ borderColor: proGatingEnabled ? 'rgba(255,255,255,0.1)' : 'rgba(255,95,31,0.4)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: proGatingEnabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,95,31,0.15)' }}>
            <span className="text-xl">{proGatingEnabled ? '🔐' : '🎁'}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Pro Feature Gating
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                proGatingEnabled
                  ? 'text-white/30 border-white/10 bg-white/5'
                  : 'text-[#FF5F1F] border-[#FF5F1F]/30 bg-[#FF5F1F]/10'
              }`}>
                {proGatingEnabled ? 'ON' : 'ALL FREE'}
              </span>
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {proGatingEnabled
                ? 'Pro features only visible to paid subscribers. Normal billing applies.'
                : 'All Pro features are unlocked for every user — no subscription required.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onToggleProGating(!proGatingEnabled)}
          className={`relative w-12 h-6 rounded-full transition-all ${
            proGatingEnabled ? 'bg-surface-700' : 'bg-[#FF5F1F]'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            proGatingEnabled ? 'translate-x-0' : 'translate-x-6'
          }`} />
        </button>
      </div>

      {/* Creator Program toggle */}
      <div className="mb-6 rounded-xl border bg-surface-900/50 p-5 flex items-center justify-between"
        style={{ borderColor: creatorProgramEnabled ? 'rgba(255,95,31,0.3)' : 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: creatorProgramEnabled ? 'rgba(255,95,31,0.15)' : 'rgba(255,255,255,0.06)' }}>
            <svg className="w-5 h-5" style={{ color: creatorProgramEnabled ? '#FF5F1F' : 'rgba(255,255,255,0.3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Creator Affiliate Program
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                creatorProgramEnabled
                  ? 'text-[#FF5F1F] border-[#FF5F1F]/30 bg-[#FF5F1F]/10'
                  : 'text-white/30 border-white/10 bg-white/5'
              }`}>
                {creatorProgramEnabled ? 'ON' : 'OFF'}
              </span>
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {creatorProgramEnabled
                ? 'Users can apply for creator profiles and generate referral links.'
                : 'Creator program is disabled. Settings page shows a coming-soon banner.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onToggleCreatorProgram(!creatorProgramEnabled)}
          className={`relative w-12 h-6 rounded-full transition-all ${
            creatorProgramEnabled ? 'bg-[#FF5F1F]' : 'bg-surface-700'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            creatorProgramEnabled ? 'translate-x-6' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Creator Payout toggle */}
      <div className="mb-6 rounded-xl border bg-surface-900/50 p-5 flex items-center justify-between"
        style={{ borderColor: creatorPayoutEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: creatorPayoutEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)' }}>
            <svg className="w-5 h-5" style={{ color: creatorPayoutEnabled ? '#10b981' : 'rgba(255,255,255,0.3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Creator Payouts
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                creatorPayoutEnabled
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  : 'text-white/30 border-white/10 bg-white/5'
              }`}>
                {creatorPayoutEnabled ? 'ON' : 'OFF'}
              </span>
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {creatorPayoutEnabled
                ? 'Payout history is visible to creators. Admin can issue monthly payouts on the 12th.'
                : 'Payout UI is hidden from creators. Use this to pause payouts without disabling the program.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onToggleCreatorPayout(!creatorPayoutEnabled)}
          className={`relative w-12 h-6 rounded-full transition-all ${
            creatorPayoutEnabled ? 'bg-emerald-500' : 'bg-surface-700'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            creatorPayoutEnabled ? 'translate-x-6' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Version control */}
      <div className="mb-6 rounded-xl border border-surface-800 bg-surface-900/50 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FF5F1F]/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#FF5F1F]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
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
              className="w-32 rounded-lg border border-surface-700 bg-surface-900 px-3 py-1.5 text-sm text-white font-mono focus:border-[#FF5F1F] focus:outline-none focus:ring-1 focus:ring-[#FF5F1F]"
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
            <span className="text-sm font-mono text-[#FF5F1F]">v{siteVersion || '—'}</span>
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
  const [isPro, setIsPro] = useState(user.is_pro || false);

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

        {/* Pro Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-surface-700 bg-surface-800/50">
          <div>
            <p className="text-sm font-medium text-white">Pro Status</p>
            <p className="text-xs text-surface-400 mt-0.5">
              {isPro ? `Pro since ${user.pro_since ? new Date(user.pro_since).toLocaleDateString() : 'unknown'}` : 'Free tier user'}
            </p>
          </div>
          <button
            onClick={() => setIsPro(!isPro)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
              isPro ? 'bg-green-500' : 'bg-surface-600'
            )}
          >
            <span className={cn(
              'inline-block h-5 w-5 rounded-full bg-surface-900 shadow-lg transition-transform duration-200',
              isPro ? 'translate-x-5' : 'translate-x-0'
            )} />
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(user.id, {
            full_name: fullName,
            display_name: displayName,
            role,
            is_pro: isPro,
            pro_since: isPro && !user.is_pro ? new Date().toISOString() : isPro ? user.pro_since : null,
          } as any)}>
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
          <h1 className="text-2xl font-black text-white mb-1">Blog Management</h1>
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
// Community Tab
// ============================================================

function CommunityTab({ posts, categories, themes, challenges, onDeletePost, onSaveCategory, onDeleteCategory, onSaveTheme, onDeleteTheme, onCreateChallenge }: {
  posts: CommunityPost[];
  categories: CommunityCategory[];
  themes: ChallengeTheme[];
  challenges: CommunityChallenge[];
  onDeletePost: (id: string) => void;
  onSaveCategory: (cat: any) => void;
  onDeleteCategory: (id: string) => void;
  onSaveTheme: (theme: any) => void;
  onDeleteTheme: (id: string) => void;
  onCreateChallenge: (data: any) => void;
}) {
  const [view, setView] = useState<'posts' | 'categories' | 'themes' | 'challenges' | 'productions'>('posts');
  const [editingCat, setEditingCat] = useState<any>(null); // CommunityCategory | 'new'
  const [editingTheme, setEditingTheme] = useState<any>(null);
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [pendingProductions, setPendingProductions] = useState<any[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  // New challenge form
  const [chTitle, setChTitle] = useState('');
  const [chDesc, setChDesc] = useState('');
  const [chStart, setChStart] = useState('');
  const [chSubClose, setChSubClose] = useState('');
  const [chVoteClose, setChVoteClose] = useState('');
  const [chReveal, setChReveal] = useState('');
  const [chPrize, setChPrize] = useState('');
  const [chPrizeDesc, setChPrizeDesc] = useState('');

  // Category form
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catIcon, setCatIcon] = useState('');
  const [catColor, setCatColor] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // Theme form
  const [thTitle, setThTitle] = useState('');
  const [thDesc, setThDesc] = useState('');
  const [thGenre, setThGenre] = useState('');
  const [thConstraints, setThConstraints] = useState('');

  const startEditCat = (cat: CommunityCategory | null) => {
    if (cat) {
      setCatName(cat.name); setCatSlug(cat.slug); setCatIcon(cat.icon || ''); setCatColor(cat.color || ''); setCatDesc(cat.description || '');
    } else {
      setCatName(''); setCatSlug(''); setCatIcon(''); setCatColor(''); setCatDesc('');
    }
    setEditingCat(cat || 'new');
  };

  const saveCat = () => {
    if (!catName.trim() || !catSlug.trim()) return;
    const data: any = { name: catName.trim(), slug: catSlug.trim(), icon: catIcon.trim() || null, color: catColor.trim() || null, description: catDesc.trim() || null };
    if (editingCat !== 'new') data.id = editingCat.id;
    onSaveCategory(data);
    setEditingCat(null);
  };

  const startEditTheme = (theme: ChallengeTheme | null) => {
    if (theme) {
      setThTitle(theme.title); setThDesc(theme.description); setThGenre(theme.genre_hint || ''); setThConstraints(theme.constraints || '');
    } else {
      setThTitle(''); setThDesc(''); setThGenre(''); setThConstraints('');
    }
    setEditingTheme(theme || 'new');
  };

  const saveTheme = () => {
    if (!thTitle.trim() || !thDesc.trim()) return;
    const data: any = { title: thTitle.trim(), description: thDesc.trim(), genre_hint: thGenre.trim() || null, constraints: thConstraints.trim() || null, difficulty: 'intermediate' };
    if (editingTheme !== 'new') { data.id = editingTheme.id; data.is_active = editingTheme.is_active; }
    onSaveTheme(data);
    setEditingTheme(null);
  };

  const createChallenge = () => {
    if (!chTitle.trim() || !chDesc.trim() || !chStart || !chSubClose || !chVoteClose || !chReveal) return;
    onCreateChallenge({
      title: chTitle.trim(), description: chDesc.trim(),
      starts_at: new Date(chStart).toISOString(),
      submissions_close_at: new Date(chSubClose).toISOString(),
      voting_close_at: new Date(chVoteClose).toISOString(),
      reveal_at: new Date(chReveal).toISOString(),
      prize_title: chPrize.trim() || null,
      prize_description: chPrizeDesc.trim() || null,
    });
    setShowNewChallenge(false);
    setChTitle(''); setChDesc(''); setChStart(''); setChSubClose(''); setChVoteClose(''); setChReveal(''); setChPrize(''); setChPrizeDesc('');
  };

  // Productions review
  const loadProductions = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('script_productions')
      .select('*, submitter:profiles!submitter_id(full_name, email, avatar_url), post:community_posts!post_id(title, slug)')
      .order('created_at', { ascending: false });
    setPendingProductions(data || []);
  }, []);

  useEffect(() => { if (view === 'productions') loadProductions(); }, [view, loadProductions]);

  const handleReviewProduction = async (id: string, status: 'approved' | 'rejected') => {
    const supabase = createClient();
    await supabase.from('script_productions').update({
      status,
      review_notes: reviewNotes[id] || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'f0e0c4a4-0833-4c64-b012-15829c087c77',
    }).eq('id', id);
    await loadProductions();
  };

  const inputCls = 'w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:border-[#FF5F1F] focus:outline-none focus:ring-1 focus:ring-[#FF5F1F] transition-colors';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Community</h1>
          <p className="text-sm text-surface-400">Manage posts, categories, themes & challenges</p>
        </div>
        <Link href="/community" className="text-sm text-surface-400 hover:text-white transition-colors">
          View Community →
        </Link>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 bg-surface-900 rounded-lg p-1 w-fit overflow-x-auto">
        {([
          { k: 'posts', label: `Posts (${posts.length})` },
          { k: 'productions', label: `Productions (${pendingProductions.filter(p => p.status === 'pending').length})` },
          { k: 'categories', label: `Categories (${categories.length})` },
          { k: 'themes', label: `Themes (${themes.length})` },
          { k: 'challenges', label: `Challenges (${challenges.length})` },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setView(t.k as any)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              view === t.k ? 'bg-surface-700 text-white shadow-sm' : 'text-surface-400 hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* POSTS */}
      {view === 'posts' && (
        <div className="space-y-3">
          {posts.length === 0 ? (
            <p className="text-center text-surface-400 text-sm py-12">No community posts yet.</p>
          ) : posts.map((post) => (
            <div key={post.id} className="rounded-xl border border-surface-800 bg-surface-900/50 p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={post.status === 'published' ? 'success' : post.status === 'archived' ? 'warning' : 'default'} size="sm">{post.status}</Badge>
                  {post.allow_free_use && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold">Free Use</span>}
                </div>
                <p className="text-sm font-medium text-white truncate">{post.title}</p>
                <p className="text-xs text-surface-500 mt-0.5">
                  by {(post.author as any)?.full_name || (post.author as any)?.email || 'Unknown'} · {timeAgo(post.created_at)} · ↑{post.upvote_count} · 💬{post.comment_count}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`/community/post/${post.slug}`} target="_blank" className="text-xs text-surface-400 hover:text-white transition-colors">View</a>
                <button onClick={() => onDeletePost(post.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PRODUCTIONS REVIEW */}
      {view === 'productions' && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-4">Film Productions — Review Queue</h3>
          {pendingProductions.length === 0 ? (
            <p className="text-center text-surface-400 text-sm py-12">No productions submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {pendingProductions.map((prod: any) => (
                <div key={prod.id} className="rounded-xl border border-surface-800 bg-surface-900/50 p-4">
                  <div className="flex items-start gap-4">
                    {prod.thumbnail_url && (
                      <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0">
                        <img src={prod.thumbnail_url} alt={prod.title || 'Production thumbnail'} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={prod.status === 'approved' ? 'success' : prod.status === 'rejected' ? 'error' : 'warning'} size="sm">{prod.status}</Badge>
                        <span className="text-sm font-medium text-white">{prod.title}</span>
                      </div>
                      {prod.description && <p className="text-xs text-surface-400 line-clamp-2">{prod.description}</p>}
                      <p className="text-xs text-surface-500 mt-1">
                        by {prod.submitter?.full_name || prod.submitter?.email || 'Unknown'} · {timeAgo(prod.created_at)}
                        {prod.post && <> · script: <a href={`/community/post/${prod.post.slug}`} target="_blank" className="text-[#FF5F1F] hover:underline">{prod.post.title}</a></>}
                      </p>
                      {prod.url && <a href={prod.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#FF5F1F] hover:underline mt-1 inline-block">🔗 Watch →</a>}
                    </div>
                  </div>
                  {prod.status === 'pending' && (
                    <div className="mt-3 pt-3 border-t border-surface-800">
                      <input
                        value={reviewNotes[prod.id] || ''}
                        onChange={(e) => setReviewNotes(prev => ({ ...prev, [prod.id]: e.target.value }))}
                        placeholder="Review notes (optional)..."
                        className={inputCls + ' mb-2'}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleReviewProduction(prod.id, 'approved')}>✅ Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => handleReviewProduction(prod.id, 'rejected')}>❌ Reject</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CATEGORIES */}
      {view === 'categories' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => startEditCat(null)}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Category
            </Button>
          </div>

          {editingCat && (
            <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 mb-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">{editingCat === 'new' ? 'New Category' : 'Edit Category'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Name" value={catName} onChange={(e) => setCatName(e.target.value)} />
                <input className={inputCls} placeholder="slug" value={catSlug} onChange={(e) => setCatSlug(e.target.value)} />
                <input className={inputCls} placeholder="Icon (emoji)" value={catIcon} onChange={(e) => setCatIcon(e.target.value)} />
                <input className={inputCls} placeholder="Color (#hex)" value={catColor} onChange={(e) => setCatColor(e.target.value)} />
              </div>
              <input className={inputCls} placeholder="Description" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveCat}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingCat(null)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-lg border border-surface-800 bg-surface-900/50 px-4 py-3 flex items-center gap-3">
                <span className="text-lg">{cat.icon || '📁'}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-white">{cat.name}</span>
                  <span className="text-xs text-surface-500 ml-2">/{cat.slug}</span>
                  {cat.color && <span className="inline-block w-3 h-3 rounded-full ml-2" style={{ backgroundColor: cat.color }} />}
                </div>
                <button onClick={() => startEditCat(cat)} className="text-xs text-surface-400 hover:text-white transition-colors">Edit</button>
                <button onClick={() => onDeleteCategory(cat.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* THEMES */}
      {view === 'themes' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => startEditTheme(null)}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Theme
            </Button>
          </div>

          {editingTheme && (
            <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 mb-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">{editingTheme === 'new' ? 'New Theme' : 'Edit Theme'}</h3>
              <input className={inputCls} placeholder="Title" value={thTitle} onChange={(e) => setThTitle(e.target.value)} />
              <textarea className={inputCls + ' resize-none'} rows={3} placeholder="Description / prompt for writers" value={thDesc} onChange={(e) => setThDesc(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Genre hint (optional)" value={thGenre} onChange={(e) => setThGenre(e.target.value)} />
                <input className={inputCls} placeholder="Constraints (optional)" value={thConstraints} onChange={(e) => setThConstraints(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveTheme}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingTheme(null)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {themes.map((theme) => (
              <div key={theme.id} className="rounded-lg border border-surface-800 bg-surface-900/50 px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white">{theme.title}</span>
                    {!theme.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">Inactive</span>}
                    <span className="text-[10px] text-surface-500">used {theme.used_count}×</span>
                  </div>
                  <p className="text-xs text-surface-400 line-clamp-1">{theme.description}</p>
                </div>
                <button onClick={() => startEditTheme(theme)} className="text-xs text-surface-400 hover:text-white transition-colors shrink-0">Edit</button>
                <button onClick={() => onDeleteTheme(theme.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0">Delete</button>
              </div>
            ))}
            {themes.length === 0 && <p className="text-center text-surface-400 text-sm py-8">No challenge themes. Add some to enable weekly challenges.</p>}
          </div>
        </div>
      )}

      {/* CHALLENGES */}
      {view === 'challenges' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowNewChallenge(true)}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Custom Challenge
            </Button>
          </div>

          {showNewChallenge && (
            <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 mb-5 space-y-3">
              <h3 className="text-sm font-semibold text-white">Create Custom Challenge</h3>
              <input className={inputCls} placeholder="Title" value={chTitle} onChange={(e) => setChTitle(e.target.value)} />
              <textarea className={inputCls + ' resize-none'} rows={3} placeholder="Description / prompt" value={chDesc} onChange={(e) => setChDesc(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-surface-400 block mb-1">Starts At</label><input type="datetime-local" className={inputCls} value={chStart} onChange={(e) => setChStart(e.target.value)} /></div>
                <div><label className="text-xs text-surface-400 block mb-1">Submissions Close</label><input type="datetime-local" className={inputCls} value={chSubClose} onChange={(e) => setChSubClose(e.target.value)} /></div>
                <div><label className="text-xs text-surface-400 block mb-1">Voting Closes</label><input type="datetime-local" className={inputCls} value={chVoteClose} onChange={(e) => setChVoteClose(e.target.value)} /></div>
                <div><label className="text-xs text-surface-400 block mb-1">Reveal At</label><input type="datetime-local" className={inputCls} value={chReveal} onChange={(e) => setChReveal(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Prize title (optional)" value={chPrize} onChange={(e) => setChPrize(e.target.value)} />
                <input className={inputCls} placeholder="Prize description (optional)" value={chPrizeDesc} onChange={(e) => setChPrizeDesc(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={createChallenge}>Create Challenge</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewChallenge(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {challenges.map((ch) => {
              const phase = getChallengePhase(ch);
              return (
                <div key={ch.id} className="rounded-lg border border-surface-800 bg-surface-900/50 px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-white">{ch.title}</span>
                      <Badge variant={phase === 'completed' ? 'default' : phase === 'submissions' ? 'success' : phase === 'voting' ? 'warning' : 'info'} size="sm">{getPhaseLabel(phase)}</Badge>
                      <span className="text-[10px] text-surface-500">{ch.challenge_type}</span>
                    </div>
                    <p className="text-xs text-surface-400">{ch.submission_count} submissions · {formatDate(ch.starts_at)} → {formatDate(ch.reveal_at)}</p>
                  </div>
                  <a href={`/community/challenges/${ch.id}`} target="_blank" className="text-xs text-surface-400 hover:text-white transition-colors shrink-0">View</a>
                </div>
              );
            })}
            {challenges.length === 0 && <p className="text-center text-surface-400 text-sm py-8">No challenges yet. Weekly challenges auto-create when themes exist.</p>}
          </div>
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
      toast.error('Failed to save post');
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
              className="rounded border-surface-600 bg-surface-900 text-[#FF5F1F] focus:ring-[#FF5F1F]"
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
                    className="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder:text-surface-500 focus:border-[#FF5F1F] focus:outline-none focus:ring-1 focus:ring-[#FF5F1F] resize-none transition-colors font-mono"
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

// ============================================================
// Tickets Tab — manage support tickets
// ============================================================

const STATUS_COLORS: Record<string, string> = {
  open: 'text-green-400 bg-green-500/10 border-green-500/20',
  in_progress: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  resolved: 'text-surface-400 bg-surface-500/10 border-surface-500/20',
  closed: 'text-surface-500 bg-surface-500/5 border-surface-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-surface-400',
  normal: 'text-surface-200',
  high: 'text-amber-400',
  urgent: 'text-red-400',
};

function TicketsTab({ tickets, selectedTicketId, messages, replyText, onSelectTicket, onReply, onReplyChange, onStatusChange, onPriorityChange }: {
  tickets: SupportTicket[];
  selectedTicketId: string | null;
  messages: TicketMessage[];
  replyText: string;
  onSelectTicket: (id: string) => void;
  onReply: () => void;
  onReplyChange: (text: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onPriorityChange: (id: string, priority: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const selected = tickets.find((t) => t.id === selectedTicketId);

  const filtered = tickets.filter((t) => statusFilter === 'all' || t.status === statusFilter);

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Support Tickets</h2>
          <p className="text-sm text-surface-400 mt-1">
            {openCount} open · {inProgressCount} in progress · {tickets.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['all', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize',
                statusFilter === s ? 'bg-[#E54E15]/20 text-[#FF5F1F]' : 'text-surface-400 hover:text-white hover:bg-surface-900/5'
              )}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6" style={{ height: 'calc(100vh - 260px)' }}>
        {/* Ticket list */}
        <div className="w-96 shrink-0 overflow-y-auto space-y-2 pr-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">🎫</div>
              <p className="text-sm text-surface-500">No tickets</p>
            </div>
          ) : (
            filtered.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => onSelectTicket(ticket.id)}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-all',
                  selectedTicketId === ticket.id
                    ? 'border-[#FF5F1F]/30 bg-[#FF5F1F]/5'
                    : 'border-surface-800 bg-surface-900 hover:border-surface-700'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-white line-clamp-1">{ticket.subject}</p>
                  <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded border capitalize ${STATUS_COLORS[ticket.status]}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-surface-400">{ticket.profile?.full_name || ticket.profile?.email || 'User'}</span>
                  <span className="text-surface-600">·</span>
                  <span className="text-surface-500 capitalize">{ticket.category.replace('_', ' ')}</span>
                  <span className="text-surface-600">·</span>
                  <span className={`font-semibold capitalize ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                  <span className="text-surface-600">·</span>
                  <span className="text-surface-500">{timeAgo(ticket.updated_at)}</span>
                </div>
                {ticket.reported_content_type && (
                  <p className="text-[10px] text-surface-500 mt-1">
                    Reported: {ticket.reported_content_type} · {ticket.reported_content_id?.slice(0, 8)}…
                  </p>
                )}
              </button>
            ))
          )}
        </div>

        {/* Ticket detail & conversation */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="bg-surface-900 border border-surface-800 rounded-xl flex flex-col h-full">
              {/* Header */}
              <div className="px-6 py-4 border-b border-surface-800">
                <h3 className="text-lg font-bold text-white">{selected.subject}</h3>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-xs text-surface-400">
                    by {selected.profile?.full_name || 'User'} ({selected.profile?.email})
                  </span>
                  <span className="text-surface-600">·</span>
                  <span className="text-xs text-surface-500">{timeAgo(selected.created_at)}</span>

                  {/* Status control */}
                  <select
                    value={selected.status}
                    onChange={(e) => onStatusChange(selected.id, e.target.value)}
                    className="ml-auto text-xs bg-surface-800 border border-surface-700 text-white rounded-lg px-2 py-1 focus:outline-none"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>

                  {/* Priority control */}
                  <select
                    value={selected.priority}
                    onChange={(e) => onPriorityChange(selected.id, e.target.value)}
                    className="text-xs bg-surface-800 border border-surface-700 text-white rounded-lg px-2 py-1 focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                {selected.reported_content_type && (
                  <p className="text-xs text-amber-400/70 mt-2">
                    ⚠ Reported: {selected.reported_content_type} · ID: {selected.reported_content_id}
                  </p>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.is_staff ? 'flex-row-reverse' : ''}`}>
                    <div className="shrink-0">
                      {msg.profile?.avatar_url ? (
                        <img src={msg.profile.avatar_url} alt={msg.profile.full_name || 'User avatar'} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-400">
                          {(msg.profile?.full_name || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className={`max-w-[70%] ${msg.is_staff ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-2 mb-1 ${msg.is_staff ? 'justify-end' : ''}`}>
                        <span className="text-xs font-semibold text-surface-300">{msg.profile?.full_name || 'User'}</span>
                        {msg.is_staff && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold text-[#FF5F1F] bg-[#FF5F1F]/10 rounded border border-[#FF5F1F]/20">STAFF</span>
                        )}
                        <span className="text-[10px] text-surface-500">{timeAgo(msg.created_at)}</span>
                      </div>
                      <div className={`inline-block px-4 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.is_staff
                          ? 'bg-[#E54E15]/10 text-[#FF8F5F] border border-[#FF5F1F]/20'
                          : 'bg-surface-800 text-surface-200 border border-surface-700'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply */}
              {(selected.status === 'open' || selected.status === 'in_progress') && (
                <div className="px-6 py-4 border-t border-surface-800">
                  <div className="flex gap-2">
                    <input
                      value={replyText}
                      onChange={(e) => onReplyChange(e.target.value)}
                      placeholder="Type a staff reply..."
                      className="flex-1 px-4 py-2.5 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder:text-surface-500 focus:border-[#FF5F1F] focus:outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onReply(); } }}
                    />
                    <button
                      onClick={onReply}
                      disabled={!replyText.trim()}
                      className="px-5 py-2.5 text-sm font-medium text-white bg-[#E54E15] hover:bg-[#FF5F1F] rounded-lg transition-colors disabled:opacity-50"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-3">🎫</div>
              <p className="text-sm text-surface-400">Select a ticket to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Contributors Tab ──────────────────────────────────────────────────────────
const CONTRIBUTOR_AREA_OPTIONS = ['Code', 'Design', 'Docs', 'Testing', 'Community', 'Translation'];

function ContributorsTab({ contributors, onRemove, onAdd, onToggleFeatured }: {
  contributors: ContributorRow[];
  onRemove: (id: string) => void;
  onAdd: (userId: string, github: string, bio: string, areas: string[]) => Promise<void>;
  onToggleFeatured: (id: string, featured: boolean) => void;
}) {
  const [filter, setFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [github, setGithub] = useState('');
  const [bio, setBio] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setUserResults([]); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, display_name, avatar_url, role, is_pro, pro_since, created_at, updated_at')
      .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
      .limit(10);
    setUserResults((data || []) as UserRow[]);
  };

  const handleAdd = async () => {
    if (!selectedUser) return;
    setSaving(true);
    await onAdd(selectedUser.id, github, bio, areas);
    setSaving(false);
    setShowAddForm(false);
    setSelectedUser(null);
    setUserQuery('');
    setGithub('');
    setBio('');
    setAreas([]);
    setUserResults([]);
  };

  const filtered = contributors.filter(c =>
    !filter ||
    (c.cached_name || '').toLowerCase().includes(filter.toLowerCase()) ||
    (c.github_handle || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Contributors</h1>
          <p className="text-sm text-surface-400 mt-1">
            Manage contributors listed on the{' '}
            <a href="/contribute" target="_blank" rel="noopener noreferrer" className="text-[#FF5F1F] hover:underline">/contribute</a>{' '}
            and{' '}
            <a href="/about" target="_blank" rel="noopener noreferrer" className="text-[#FF5F1F] hover:underline">/about</a>{' '}
            pages. Featured contributors appear highlighted.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="https://github.com/SondreWiger/screenplay-studio/graphs/contributors"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-surface-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            GitHub Contributors
          </a>
          <Button onClick={() => setShowAddForm(v => !v)} size="sm">
            {showAddForm ? 'Cancel' : '+ Add Contributor'}
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="mb-6 rounded-xl border border-[#FF5F1F]/20 p-5" style={{ background: 'rgba(255,95,31,0.04)' }}>
          <h3 className="text-sm font-semibold text-white mb-4">Add Contributor</h3>
          <div className="space-y-4">

            {/* User search */}
            <div>
              <label className="text-xs text-surface-400 block mb-1.5">Search user by name or email</label>
              <Input
                value={userQuery}
                onChange={e => { setUserQuery(e.target.value); searchUsers(e.target.value); }}
                placeholder="john@example.com"
              />
              {userResults.length > 0 && !selectedUser && (
                <div className="mt-1 rounded-lg border border-surface-700 bg-surface-900 divide-y divide-surface-800 max-h-44 overflow-y-auto">
                  {userResults.map(u => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setUserResults([]); setUserQuery(u.email); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-800 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {(u.full_name || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-white">{u.full_name || '—'}</p>
                        <p className="text-xs text-surface-500">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedUser && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#FF5F1F]/25" style={{ background: 'rgba(255,95,31,0.08)' }}>
                  <div className="w-6 h-6 rounded-full bg-[#FF5F1F] flex items-center justify-center text-[10px] font-black text-white shrink-0">
                    {(selectedUser.full_name || selectedUser.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{selectedUser.full_name || selectedUser.email}</p>
                    <p className="text-[10px] text-surface-500 truncate">{selectedUser.email}</p>
                  </div>
                  <button onClick={() => { setSelectedUser(null); setUserQuery(''); }} className="text-xs text-surface-500 hover:text-white ml-1">✕</button>
                </div>
              )}
            </div>

            {/* GitHub + Bio */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-surface-400 block mb-1.5">GitHub handle <span className="text-surface-600">(optional)</span></label>
                <Input value={github} onChange={e => setGithub(e.target.value)} placeholder="e.g. johndoe" />
              </div>
              <div>
                <label className="text-xs text-surface-400 block mb-1.5">Short bio <span className="text-surface-600">(optional)</span></label>
                <Input value={bio} onChange={e => setBio(e.target.value)} placeholder="e.g. Frontend dev" />
              </div>
            </div>

            {/* Contribution areas */}
            <div>
              <label className="text-xs text-surface-400 block mb-2">Contribution areas</label>
              <div className="flex flex-wrap gap-2">
                {CONTRIBUTOR_AREA_OPTIONS.map(a => (
                  <button
                    key={a}
                    onClick={() => setAreas(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                    className={cn(
                      'px-3 py-1 text-[11px] font-medium rounded-full border transition-all',
                      areas.includes(a)
                        ? 'bg-[#FF5F1F]/20 text-[#FF5F1F] border-[#FF5F1F]/30'
                        : 'bg-surface-900 text-surface-400 border-surface-700 hover:border-surface-500'
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button onClick={() => setShowAddForm(false)} className="text-sm text-surface-400 hover:text-white transition-colors">Cancel</button>
              <Button onClick={handleAdd} disabled={!selectedUser || saving} size="sm">
                {saving ? 'Adding...' : 'Add Contributor'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-5">
        <Input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by name, email or GitHub handle…"
          className="max-w-sm"
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-5">
        <span className="text-sm text-surface-400">{contributors.length} total</span>
        <span className="text-surface-700">·</span>
        <span className="text-sm text-surface-400">{contributors.filter(c => c.is_featured).length} featured</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-3">🔶</div>
          <p className="text-sm text-surface-400">
            {contributors.length === 0
              ? 'No contributors yet. Add someone above to get started.'
              : 'No contributors match your filter.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden">
                  {c.cached_avatar_url
                    ? <img src={c.cached_avatar_url} className="w-full h-full object-cover" alt="" />
                    : (c.cached_name || '?')[0].toUpperCase()
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {c.cached_name || '—'}
                  </p>
                  {c.github_handle && (
                    <a
                      href={`https://github.com/${c.github_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#FF5F1F] hover:underline"
                    >
                      @{c.github_handle}
                    </a>
                  )}
                  {c.bio && <p className="text-[11px] text-surface-400 mt-0.5 truncate max-w-md">{c.bio}</p>}
                  {c.contribution_areas?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.contribution_areas.map(a => (
                        <span key={a} className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-surface-800 text-surface-400 border border-surface-700">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onToggleFeatured(c.id, !c.is_featured)}
                    title={c.is_featured ? 'Remove featured' : 'Mark as featured'}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                      c.is_featured
                        ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25 hover:bg-yellow-500/8'
                        : 'bg-surface-900 text-surface-500 border-surface-700 hover:border-surface-500 hover:text-white'
                    )}
                  >
                    {c.is_featured ? '⭐ Featured' : '☆ Feature'}
                  </button>
                  <span className="text-[10px] text-surface-600 hidden sm:inline">{formatDate(c.added_at)}</span>
                  <button
                    onClick={() => onRemove(c.id)}
                    title="Remove contributor"
                    className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Badges Admin Tab ──────────────────────────────────────────────────────────
function BadgesAdminTab() {
  const supabase = createClient();
  const [badges, setBadges] = useState<BadgeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', emoji: '🏅', description: '', color: '#6366F1' });
  const [saving, setSaving] = useState(false);
  const [awardForm, setAwardForm] = useState<{ badgeId: string; username: string }>({ badgeId: '', username: '' });
  const [awardMsg, setAwardMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('badges').select('*').order('is_system', { ascending: false }).order('created_at');
    setBadges((data as BadgeType[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await supabase.from('badges').insert({ name: form.name.trim(), emoji: form.emoji, description: form.description, color: form.color, is_system: false });
    setForm({ name: '', emoji: '🏅', description: '', color: '#6366F1' });
    setSaving(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this badge? It will be removed from all users.')) return;
    await supabase.from('user_badges').delete().eq('badge_id', id);
    await supabase.from('badges').delete().eq('id', id);
    load();
  };

  const handleAward = async () => {
    if (!awardForm.badgeId || !awardForm.username.trim()) return;
    setAwardMsg(null);
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .or(`username.eq.${awardForm.username.trim()},email.eq.${awardForm.username.trim()}`)
      .maybeSingle();
    if (!profile) { setAwardMsg('User not found.'); return; }
    const { error } = await supabase.from('user_badges').upsert({ user_id: profile.id, badge_id: awardForm.badgeId }, { onConflict: 'user_id,badge_id' });
    setAwardMsg(error ? `Error: ${error.message}` : 'Badge awarded!');
    setAwardForm(p => ({ ...p, username: '' }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Badge Management</h2>
        <p className="text-sm text-white/40">Create custom badges and award them to users. System badges (Admin, Moderator, Contributor) are managed automatically by user roles.</p>
      </div>

      {/* Existing Badges */}
      <Card className="bg-white/5 border border-white/10 p-6">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">All Badges</h3>
        {loading ? (
          <p className="text-white/40 text-sm">Loading…</p>
        ) : (
          <div className="space-y-3">
            {badges.map(badge => (
              <div key={badge.id} className="flex items-center justify-between gap-4 bg-white/5 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: badge.color + '33', color: badge.color }}
                  >
                    <span>{badge.emoji}</span>
                    <span>{badge.name}</span>
                  </span>
                  {badge.is_system && (
                    <span className="text-xs text-white/30 italic">system</span>
                  )}
                  {badge.description && (
                    <span className="text-xs text-white/40">{badge.description}</span>
                  )}
                </div>
                {!badge.is_system && (
                  <button
                    onClick={() => handleDelete(badge.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Badge */}
      <Card className="bg-white/5 border border-white/10 p-6">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Create New Badge</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Badge Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Early Adopter"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Emoji</label>
            <input
              value={form.emoji}
              onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))}
              maxLength={4}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Description</label>
            <input
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
              />
              <span className="text-sm text-white/50">{form.color}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          {form.name && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: form.color + '33', color: form.color }}
            >
              <span>{form.emoji}</span>
              <span>{form.name}</span>
            </span>
          )}
          <button
            onClick={handleCreate}
            disabled={saving || !form.name.trim()}
            className="ml-auto px-4 py-2 rounded-lg bg-[#FF5F1F] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#FF5F1F]/80 transition-colors"
          >
            {saving ? 'Creating…' : 'Create Badge'}
          </button>
        </div>
      </Card>

      {/* Award Badge */}
      <Card className="bg-white/5 border border-white/10 p-6">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Award Badge to User</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Badge</label>
            <select
              value={awardForm.badgeId}
              onChange={e => setAwardForm(p => ({ ...p, badgeId: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40"
            >
              <option value="">Select a badge…</option>
              {badges.filter(b => !b.is_system).map(b => (
                <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Username or Email</label>
            <input
              value={awardForm.username}
              onChange={e => setAwardForm(p => ({ ...p, username: e.target.value }))}
              placeholder="username or email"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
            />
          </div>
        </div>
        {awardMsg && (
          <p className={`mt-2 text-sm ${awardMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{awardMsg}</p>
        )}
        <button
          onClick={handleAward}
          disabled={!awardForm.badgeId || !awardForm.username.trim()}
          className="mt-4 px-4 py-2 rounded-lg bg-[#FF5F1F] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#FF5F1F]/80 transition-colors"
        >
          Award Badge
        </button>
      </Card>
    </div>
  );
}

function CoursesAdminTab() {
  const supabase = createClient();
  type CourseRow = {
    id: string; title: string; difficulty: string; status: string;
    enrollment_count: number; created_at: string;
    creator: { full_name: string | null; email: string } | null;
  };
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('courses')
      .select('id,title,difficulty,status,enrollment_count,created_at,creator:profiles!courses_creator_id_fkey(full_name,email)')
      .order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setCourses((data as unknown as CourseRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const setStatus = async (id: string, status: 'published' | 'rejected') => {
    await supabase.from('courses').update({ status }).eq('id', id);
    setCourses(cs => cs.map(c => c.id === id ? { ...c, status } : c));
  };

  const deleteCourse = async (id: string) => {
    if (!confirm('Delete this course permanently?')) return;
    await supabase.from('course_lessons').delete().eq('course_id', id);
    await supabase.from('course_sections').delete().eq('course_id', id);
    await supabase.from('courses').delete().eq('id', id);
    setCourses(cs => cs.filter(c => c.id !== id));
  };

  const DIFF_COLOR: Record<string, string> = {
    beginner: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    intermediate: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    advanced: 'text-red-400 bg-red-500/10 border-red-500/20',
  };
  const STATUS_COLOR: Record<string, string> = {
    pending: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    published: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rejected: 'text-red-400 bg-red-500/10 border-red-500/20',
    draft: 'text-white/40 bg-white/5 border-white/10',
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Course Moderation</h2>
          <p className="text-sm text-surface-400 mt-0.5">Review and manage community-submitted courses</p>
        </div>
        <div className="flex items-center gap-1.5 bg-surface-900 border border-surface-800 rounded-xl p-1">
          {(['pending','published','rejected','all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                filter === f ? 'bg-[#FF5F1F] text-white' : 'text-surface-400 hover:text-white'
              }`}>{f}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#FF5F1F]/30 border-t-[#FF5F1F] rounded-full animate-spin" /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 text-surface-400 text-sm">No {filter === 'all' ? '' : filter} courses.</div>
      ) : (
        <div className="space-y-2">
          {courses.map(c => (
            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-surface-900 border border-surface-800 hover:border-surface-700 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white truncate">{c.title}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${DIFF_COLOR[c.difficulty] ?? ''}`}>{c.difficulty}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${STATUS_COLOR[c.status] ?? ''}`}>{c.status}</span>
                </div>
                <div className="text-xs text-surface-500 mt-0.5">
                  by {c.creator?.full_name || c.creator?.email || 'Unknown'} &middot; {c.enrollment_count} enrolled &middot; {new Date(c.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`/community/courses/${c.id}`} target="_blank" rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors">View</a>
                <a href={`/community/courses/${c.id}/edit`} target="_blank" rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors">Edit</a>
                {c.status !== 'published' && (
                  <button onClick={() => setStatus(c.id, 'published')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">Approve</button>
                )}
                {c.status !== 'rejected' && (
                  <button onClick={() => setStatus(c.id, 'rejected')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20 transition-colors">Reject</button>
                )}
                <button onClick={() => deleteCourse(c.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Creators Tab
// ============================================================
function CreatorsTab({ programEnabled, payoutEnabled }: { programEnabled: boolean; payoutEnabled: boolean }) {
  const supabase = createClient();

  type CreatorApplication = {
    id: string;
    user_id: string;
    ref_code: string;
    status: 'pending' | 'approved' | 'rejected';
    application_note: string | null;
    applied_at: string;
    approved_at: string | null;
    rejected_reason: string | null;
    social_instagram: string | null;
    social_twitter: string | null;
    social_tiktok: string | null;
    social_youtube: string | null;
    profile: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
  };

  type PayoutBatch = {
    id: string;
    period_start: string;
    period_end: string;
    total_amount: number;
    status: string;
    created_at: string;
  };

  const [creators, setCreators] = useState<CreatorApplication[]>([]);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<{ id: string; reason: string } | null>(null);

  // Payout calculator
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutPeriodStart, setPayoutPeriodStart] = useState('');
  const [payoutPeriodEnd, setPayoutPeriodEnd] = useState('');
  const [payoutPreview, setPayoutPreview] = useState<any[]>([]);
  const [payoutBatchId, setPayoutBatchId] = useState<string | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [batches, setBatches] = useState<PayoutBatch[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('creator_profiles')
      .select('id,user_id,ref_code,status,application_note,applied_at,approved_at,rejected_reason,social_instagram,social_twitter,social_tiktok,social_youtube,profile:profiles!creator_profiles_user_id_fkey(full_name,username,avatar_url)')
      .eq('status', filterStatus)
      .order('applied_at', { ascending: false });
    setCreators((data as unknown as CreatorApplication[]) || []);
    setLoading(false);
  };

  const loadBatches = async () => {
    const { data } = await supabase.from('creator_payout_batches').select('*').order('created_at', { ascending: false }).limit(10);
    setBatches((data as PayoutBatch[]) || []);
  };

  useEffect(() => { load(); }, [filterStatus]);
  useEffect(() => { if (payoutEnabled) loadBatches(); }, [payoutEnabled]);

  const approve = async (id: string) => {
    setActionLoading(id);
    await supabase.from('creator_profiles').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'f0e0c4a4-0833-4c64-b012-15829c087c77' }).eq('id', id);
    setCreators(cs => cs.filter(c => c.id !== id));
    setActionLoading(null);
  };

  const reject = async (id: string, reason: string) => {
    setActionLoading(id);
    await supabase.from('creator_profiles').update({ status: 'rejected', rejected_reason: reason }).eq('id', id);
    setCreators(cs => cs.filter(c => c.id !== id));
    setActionLoading(null);
    setRejectReason(null);
  };

  const computePayout = async () => {
    if (!payoutAmount || !payoutPeriodStart || !payoutPeriodEnd) return;
    setPayoutLoading(true);
    // Create a draft batch
    const { data: batch } = await supabase.from('creator_payout_batches').insert({
      period_start: payoutPeriodStart,
      period_end: payoutPeriodEnd,
      total_amount: parseFloat(payoutAmount),
      status: 'draft',
    }).select().single();
    if (!batch) { setPayoutLoading(false); return; }
    setPayoutBatchId(batch.id);
    // Call the stored function
    await supabase.rpc('compute_creator_payout_items', {
      p_batch_id: batch.id,
      p_start: payoutPeriodStart,
      p_end: payoutPeriodEnd,
      p_total: parseFloat(payoutAmount),
    });
    const { data: items } = await supabase
      .from('creator_payout_items')
      .select('id,creator_id,signups_count,proportion,amount,creator:creator_profiles!creator_payout_items_creator_id_fkey(ref_code,profile:profiles!creator_profiles_user_id_fkey(full_name,username))')
      .eq('batch_id', batch.id)
      .order('amount', { ascending: false });
    setPayoutPreview(items || []);
    loadBatches();
    setPayoutLoading(false);
  };

  const markPaid = async () => {
    if (!payoutBatchId) return;
    await supabase.from('creator_payout_batches').update({ status: 'paid' }).eq('id', payoutBatchId);
    setPayoutBatchId(null);
    setPayoutPreview([]);
    setPayoutAmount('');
    setPayoutPeriodStart('');
    setPayoutPeriodEnd('');
    loadBatches();
  };

  const statusColors: Record<string, string> = {
    pending: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    approved: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    rejected: 'text-red-400 border-red-500/30 bg-red-500/10',
    draft: 'text-surface-400 border-surface-600 bg-surface-800',
    paid: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  };

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-1">Creator Program</h1>
      <p className="text-sm text-surface-400 mb-8">Manage affiliate creator applications and payouts</p>

      {!programEnabled && (
        <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="text-sm text-yellow-400">Creator Program is currently <strong>disabled</strong>. Toggle it on in the System tab to let users apply.</p>
        </div>
      )}

      {/* Applications */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-white">Applications</h2>
          <div className="flex gap-1">
            {(['pending', 'approved', 'rejected'] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  filterStatus === s ? 'bg-[#FF5F1F] text-white' : 'bg-surface-800 text-surface-400 hover:text-white'
                }`}>{s}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-surface-500">Loading…</p>
        ) : creators.length === 0 ? (
          <p className="text-sm text-surface-500">No {filterStatus} applications.</p>
        ) : (
          <div className="space-y-3">
            {creators.map((c) => (
              <div key={c.id} className="rounded-xl border border-surface-800 bg-surface-900/50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.profile?.avatar_url && (
                      <img src={c.profile.avatar_url} className="w-9 h-9 rounded-full shrink-0 object-cover" alt="" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white truncate">{c.profile?.full_name || c.profile?.username || c.user_id.slice(0, 8)}</span>
                        <span className="text-xs text-surface-500">@{c.profile?.username}</span>
                        <span className="font-mono text-xs text-[#FF5F1F]">/ref/{c.ref_code}</span>
                      </div>
                      {c.application_note && (
                        <p className="text-xs text-surface-400 mt-1 italic">"{c.application_note}"</p>
                      )}
                      <div className="flex gap-3 mt-1 flex-wrap">
                        {c.social_instagram && <span className="text-xs text-surface-500">IG: @{c.social_instagram}</span>}
                        {c.social_twitter && <span className="text-xs text-surface-500">X: @{c.social_twitter}</span>}
                        {c.social_tiktok && <span className="text-xs text-surface-500">TT: @{c.social_tiktok}</span>}
                        {c.social_youtube && <span className="text-xs text-surface-500">YT: @{c.social_youtube}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-surface-500">{new Date(c.applied_at).toLocaleDateString()}</span>
                    {filterStatus === 'pending' && (
                      <>
                        <button onClick={() => approve(c.id)} disabled={actionLoading === c.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors disabled:opacity-50">
                          {actionLoading === c.id ? '…' : 'Approve'}
                        </button>
                        <button onClick={() => setRejectReason({ id: c.id, reason: '' })}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">
                          Reject
                        </button>
                      </>
                    )}
                    {filterStatus === 'rejected' && c.rejected_reason && (
                      <span className="text-xs text-surface-500 italic max-w-xs truncate">"{c.rejected_reason}"</span>
                    )}
                  </div>
                </div>
                {/* Reject inline form */}
                {rejectReason?.id === c.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={rejectReason.reason}
                      onChange={(e) => setRejectReason({ ...rejectReason, reason: e.target.value })}
                      placeholder="Rejection reason (optional)"
                      className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-3 py-1.5 text-sm text-white focus:border-[#FF5F1F] focus:outline-none"
                    />
                    <button onClick={() => reject(c.id, rejectReason.reason)} disabled={actionLoading === c.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50">
                      {actionLoading === c.id ? '…' : 'Confirm'}
                    </button>
                    <button onClick={() => setRejectReason(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-800 text-surface-400 hover:text-white transition-colors">Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payout Calculator */}
      {payoutEnabled && (
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
          <h2 className="text-base font-semibold text-white mb-1">Monthly Payout Calculator</h2>
          <p className="text-xs text-surface-500 mb-5">Distribute a fixed amount proportionally among creators based on signups in the period.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Period start</label>
              <input type="date" value={payoutPeriodStart} onChange={(e) => setPayoutPeriodStart(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-1.5 text-sm text-white focus:border-[#FF5F1F] focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Period end</label>
              <input type="date" value={payoutPeriodEnd} onChange={(e) => setPayoutPeriodEnd(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-1.5 text-sm text-white focus:border-[#FF5F1F] focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Total amount (USD)</label>
              <input type="number" min="0" step="0.01" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="e.g. 500"
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-1.5 text-sm text-white focus:border-[#FF5F1F] focus:outline-none" />
            </div>
          </div>

          <button onClick={computePayout} disabled={payoutLoading || !payoutAmount || !payoutPeriodStart || !payoutPeriodEnd}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#FF5F1F] text-white hover:bg-[#e5541b] transition-colors disabled:opacity-50 mb-5">
            {payoutLoading ? 'Computing…' : 'Compute Payout'}
          </button>

          {payoutPreview.length > 0 && (
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800">
                    <th className="text-left text-xs text-surface-500 font-medium pb-2">Creator</th>
                    <th className="text-right text-xs text-surface-500 font-medium pb-2">Signups</th>
                    <th className="text-right text-xs text-surface-500 font-medium pb-2">Share</th>
                    <th className="text-right text-xs text-surface-500 font-medium pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/50">
                  {payoutPreview.map((item: any) => (
                    <tr key={item.id}>
                      <td className="py-2 text-white">{item.creator?.profile?.full_name || item.creator?.profile?.username || '—'} <span className="text-surface-500 text-xs">/ref/{item.creator?.ref_code}</span></td>
                      <td className="py-2 text-right text-surface-300">{item.signups_count}</td>
                      <td className="py-2 text-right text-surface-300">{(item.proportion * 100).toFixed(1)}%</td>
                      <td className="py-2 text-right font-semibold text-emerald-400">${Number(item.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex gap-3">
                <button onClick={markPaid}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">
                  Mark as Paid
                </button>
                <button onClick={() => { setPayoutPreview([]); setPayoutBatchId(null); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-surface-800 text-surface-400 hover:text-white transition-colors">
                  Discard
                </button>
              </div>
            </div>
          )}

          {batches.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-white mb-3">Recent Batches</h3>
              <div className="space-y-2">
                {batches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-900 px-4 py-2">
                    <span className="text-sm text-white">{b.period_start} → {b.period_end}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-white">${Number(b.total_amount).toFixed(2)}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusColors[b.status] || ''}`}>{b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}