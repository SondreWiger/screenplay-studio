'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Badge, Card, Modal, Input, Textarea, LoadingPage, Avatar, Select } from '@/components/ui';
import { cn, formatDate, timeAgo, getChallengePhase, getPhaseLabel } from '@/lib/utils';
import type { BlogPost, BlogPostSection, CommunityPost, CommunityCategory, ChallengeTheme, CommunityChallenge, SupportTicket, TicketMessage } from '@/lib/types';
import { triggerPush } from '@/lib/notifications';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';
const MOD_TABS: Tab[] = ['tickets', 'community'];
const isStaff = (role?: string) => role === 'moderator' || role === 'admin';
const isFullAdmin = (id?: string, role?: string) => id === ADMIN_UID || role === 'admin';

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
  proUsers: number;
  pushSubscriptions: number;
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

type Tab = 'overview' | 'users' | 'projects' | 'blog' | 'community' | 'tickets' | 'system';

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

  const loadStats = async () => {
    try {
      const supabase = createClient();

      const [
        profilesRes, projectsRes, scriptsRes, elementsRes,
        charsRes, locsRes, scenesRes, shotsRes, ideasRes,
        budgetRes, schedRes, commentsRes,
        recentUsersRes, recentProjectsRes,
        proUsersRes, pushSubsRes,
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
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_pro', true),
        supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }),
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
        proUsers: proUsersRes.count || 0,
        pushSubscriptions: pushSubsRes.count || 0,
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
        // Trigger Web Push delivery
        triggerPush(ticket.user_id, notifTitle, notifBody, notifLink);
        // Trigger email notification
        const { data: ownerProfile } = await supabase.from('profiles').select('email, full_name, display_name').eq('id', ticket.user_id).single();
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
  ];
  // Mods only see tickets + community; full admins see everything
  const tabs = isFull ? allTabs : allTabs.filter((t) => MOD_TABS.includes(t.key));

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950 relative">
      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 bg-surface-950 border-b border-surface-800 flex items-center px-3 gap-3">
        <button onClick={() => setShowMobileSidebar(!showMobileSidebar)} className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-white/10">
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
                  ? 'bg-brand-600/10 text-brand-400'
                  : 'text-surface-400 hover:bg-white/5 hover:text-white'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}

          {isFull && (
            <div className="mt-4 pt-4 border-t border-surface-800">
              <p className="px-3 py-1 text-[10px] text-surface-600 uppercase tracking-wider font-medium">Tools</p>
              <Link href="/admin/legal" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-white/5 hover:text-white transition-all duration-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                Legal Blog
              </Link>
              <Link href="/admin/security" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-white/5 hover:text-white transition-all duration-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Security
              </Link>
              <Link href="/admin/reports" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-white/5 hover:text-white transition-all duration-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg>
                Reports
              </Link>
              <Link href="/admin/features" className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-surface-400 hover:bg-white/5 hover:text-white transition-all duration-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                Feature Flags
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
    { label: 'Pro Users', value: stats.proUsers, icon: '⭐', color: 'from-yellow-500/20 to-yellow-600/5' },
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
    { label: 'Push Subscriptions', value: stats.pushSubscriptions, icon: '🔔', color: 'from-sky-500/20 to-sky-600/5' },
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

      {/* Platform Health */}
      <div className="mt-6 rounded-xl border border-surface-800 bg-surface-900/50 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Platform Health</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-green-400">Active</p>
            <p className="text-xs text-surface-400 mt-1">Database</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">
              {stats.totalUsers > 0 ? (stats.totalProjects / stats.totalUsers).toFixed(1) : '0'}
            </p>
            <p className="text-xs text-surface-400 mt-1">Projects/User</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">
              {stats.totalUsers > 0 ? ((stats.proUsers / stats.totalUsers) * 100).toFixed(1) : '0'}%
            </p>
            <p className="text-xs text-surface-400 mt-1">Pro Conversion</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">
              {stats.totalScripts > 0 ? Math.round(stats.totalWords / stats.totalScripts).toLocaleString() : '0'}
            </p>
            <p className="text-xs text-surface-400 mt-1">Avg Words/Script</p>
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
              'inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200',
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

  const inputCls = 'w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Community</h1>
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
                        <img src={prod.thumbnail_url} alt="" className="w-full h-full object-cover" />
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
                        {prod.post && <> · script: <a href={`/community/post/${prod.post.slug}`} target="_blank" className="text-brand-400 hover:underline">{prod.post.title}</a></>}
                      </p>
                      {prod.url && <a href={prod.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:underline mt-1 inline-block">🔗 Watch →</a>}
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
          <h2 className="text-xl font-bold text-white">Support Tickets</h2>
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
                statusFilter === s ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
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
                    ? 'border-brand-500/30 bg-brand-500/5'
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
                        <img src={msg.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
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
                          <span className="px-1.5 py-0.5 text-[9px] font-bold text-brand-400 bg-brand-500/10 rounded border border-brand-500/20">STAFF</span>
                        )}
                        <span className="text-[10px] text-surface-500">{timeAgo(msg.created_at)}</span>
                      </div>
                      <div className={`inline-block px-4 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.is_staff
                          ? 'bg-brand-600/10 text-brand-200 border border-brand-500/20'
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
                      className="flex-1 px-4 py-2.5 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder:text-surface-500 focus:border-brand-500 focus:outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onReply(); } }}
                    />
                    <button
                      onClick={onReply}
                      disabled={!replyText.trim()}
                      className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors disabled:opacity-50"
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