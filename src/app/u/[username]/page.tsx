'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Badge, Avatar, LoadingSpinner } from '@/components/ui';
import { formatDate, timeAgo } from '@/lib/utils';
import type { Profile, Project, CommunityPost, ProductionRole, UserBadge } from '@/lib/types';
import { PRODUCTION_ROLES } from '@/lib/types';
import { BadgeDisplay, getDisplayBadges } from '@/components/BadgeDisplay';

// ============================================================
// Public User Profile Page — /u/<username>
// ============================================================

// Theme presets for profile customisation
const PROFILE_THEMES: Record<string, { gradient: string; accent: string; accentRgb: string; cardBg: string; textAccent: string }> = {
  default:   { gradient: 'from-[#0a0818] via-[#0d0b17] to-[#070710]',   accent: '#FF5F1F',   accentRgb: '255,95,31', cardBg: 'bg-white/[0.04]',  textAccent: 'text-[#FF5F1F]' },
  midnight:  { gradient: 'from-indigo-950 via-blue-900 to-slate-900',   accent: 'indigo-400',  accentRgb: '129,140,248', cardBg: 'bg-indigo-500/[0.06]', textAccent: 'text-indigo-400' },
  sunset:    { gradient: 'from-orange-700 via-rose-700 to-pink-800',    accent: 'orange-500',  accentRgb: '249,115,22', cardBg: 'bg-orange-500/[0.06]', textAccent: 'text-orange-400' },
  forest:    { gradient: 'from-emerald-900 via-teal-800 to-green-900',  accent: 'emerald-400', accentRgb: '52,211,153', cardBg: 'bg-emerald-500/[0.06]', textAccent: 'text-emerald-400' },
  ocean:     { gradient: 'from-cyan-900 via-blue-800 to-indigo-900',    accent: 'cyan-400',    accentRgb: '34,211,238', cardBg: 'bg-cyan-500/[0.06]',  textAccent: 'text-cyan-400' },
  noir:      { gradient: 'from-neutral-950 via-neutral-900 to-zinc-900',accent: 'neutral-300', accentRgb: '212,212,216', cardBg: 'bg-white/[0.03]',  textAccent: 'text-neutral-300' },
  royal:     { gradient: 'from-purple-900 via-fuchsia-800 to-violet-900',accent: 'purple-400', accentRgb: '192,132,252', cardBg: 'bg-purple-500/[0.06]', textAccent: 'text-purple-400' },
  crimson:   { gradient: 'from-red-950 via-rose-800 to-red-900',        accent: 'red-400',     accentRgb: '248,113,113', cardBg: 'bg-red-500/[0.06]',  textAccent: 'text-red-400' },
};

const SOCIAL_ICONS: Record<string, string> = {
  twitter: '𝕏',
  instagram: '📷',
  imdb: '🎬',
  letterboxd: '🎞️',
  linkedin: '💼',
  youtube: '▶️',
  vimeo: '🎥',
  github: '💻',
  website: '🌐',
};

export default function UserProfilePage({ params }: { params: { username: string } }) {
  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [publicProjects, setPublicProjects] = useState<Project[]>([]);
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([]);
  const [filmography, setFilmography] = useState<(Project & { member_role?: ProductionRole; character_name?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'projects' | 'about' | 'courses'>('posts');
  const [startingDm, setStartingDm] = useState(false);
  const [profileBadges, setProfileBadges] = useState<UserBadge[]>([]);
  type ProfileCourse = { id: string; progress_percent: number; completed_at: string | null; course: { id: string; title: string; short_desc: string | null; difficulty: string; xp_reward: number; thumbnail_url: string | null } };
  const [profileCourses, setProfileCourses] = useState<ProfileCourse[]>([]);

  const isOwnProfile = currentUser?.id === profile?.id;
  const theme = PROFILE_THEMES[profile?.profile_theme || 'default'] || PROFILE_THEMES.default;

  useEffect(() => {
    fetchProfile();
  }, [params.username]);

  const fetchProfile = async () => {
    const supabase = createClient();

    // Try username first, then fall back to id
    let query = supabase.from('profiles').select('*');
    const decodedUsername = decodeURIComponent(params.username);

    // If it looks like a UUID, search by id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedUsername);
    if (isUuid) {
      query = query.eq('id', decodedUsername);
    } else {
      query = query.eq('username', decodedUsername);
    }

    const { data: prof, error } = await query.single();

    if (error || !prof) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setProfile(prof);

    // Fetch display badges
    const { data: badgeData } = await supabase
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', prof.id)
      .not('display_slot', 'is', null)
      .order('display_slot');
    if (badgeData) setProfileBadges(badgeData as UserBadge[]);

    // Fetch course enrollments
    const { data: enrollData } = await supabase
      .from('course_enrollments')
      .select('id,progress_percent,completed_at,course:courses(id,title,short_desc,difficulty,xp_reward,thumbnail_url)')
      .eq('user_id', prof.id)
      .order('last_accessed_at', { ascending: false })
      .limit(12);
    if (enrollData) setProfileCourses(enrollData as unknown as ProfileCourse[]);
    if (!isUuid || prof.id !== (currentUser?.id ?? '')) {
      supabase.rpc('increment_profile_views', { p_user_id: prof.id }).then(() => {});
    }

    // Parallel fetch: published posts + public projects
    const [postsRes, projectsRes] = await Promise.all([
      supabase
        .from('community_posts')
        .select('*, author:profiles!author_id(*)')
        .eq('author_id', prof.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(50),
      prof.show_projects !== false
        ? supabase
            .from('projects')
            .select('*')
            .eq('created_by', prof.id)
            .order('updated_at', { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] }),
    ]);

    setPosts(postsRes.data || []);
    const allProjects = projectsRes.data || [];
    setPublicProjects(allProjects);

    // Featured projects
    if (prof.featured_project_ids && prof.featured_project_ids.length > 0) {
      const featured = allProjects.filter((p: Project) => prof.featured_project_ids.includes(p.id));
      setFeaturedProjects(featured);
    }

    // Filmography: fetch showcased projects where this user is a team member
    const { data: memberShips } = await supabase
      .from('project_members')
      .select('project_id, production_role, character_name')
      .eq('user_id', prof.id);

    if (memberShips && memberShips.length > 0) {
      const projectIds = memberShips.map((m) => m.project_id);
      const { data: showcasedProjects } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .eq('is_showcased', true);

      if (showcasedProjects && showcasedProjects.length > 0) {
        const filmographyList = showcasedProjects.map((p) => {
          const membership = memberShips.find((m) => m.project_id === p.id);
          return {
            ...p,
            member_role: membership?.production_role as ProductionRole | undefined,
            character_name: membership?.character_name,
          };
        });
        setFilmography(filmographyList);
      }
    }

    setLoading(false);
  };

  // ============================================================
  // START DM
  // ============================================================

  const handleStartDm = async () => {
    if (!currentUser || !profile || startingDm) return;
    setStartingDm(true);

    try {
      const supabase = createClient();

      // Check for existing direct conversation
      const { data: myMembers } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUser.id);

      if (myMembers && myMembers.length > 0) {
        const myConvoIds = myMembers.map((m) => m.conversation_id);

        // Find conversations where the target user is also a member and type is direct
        const { data: theirMembers } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', profile.id)
          .in('conversation_id', myConvoIds);

        if (theirMembers && theirMembers.length > 0) {
          // Check if any of these is a direct conversation
          const sharedConvoIds = theirMembers.map((m) => m.conversation_id);
          const { data: directConvos } = await supabase
            .from('conversations')
            .select('id')
            .in('id', sharedConvoIds)
            .eq('conversation_type', 'direct')
            .limit(1);

          if (directConvos && directConvos.length > 0) {
            router.push(`/messages?convo=${directConvos[0].id}`);
            return;
          }
        }
      }

      // Create new conversation
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({
          conversation_type: 'direct',
          name: null,
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (error || !conv) throw error;

      // Add both members
      await supabase.from('conversation_members').insert([
        { conversation_id: conv.id, user_id: currentUser.id, role: 'admin' },
        { conversation_id: conv.id, user_id: profile.id, role: 'member' },
      ]);

      // System message
      await supabase.from('direct_messages').insert({
        conversation_id: conv.id,
        sender_id: currentUser.id,
        content: `${currentUser.full_name || currentUser.email} started a conversation`,
        message_type: 'system',
      });

      router.push(`/messages?convo=${conv.id}`);
    } catch (err) {
      console.error('Error starting DM:', err);
    } finally {
      setStartingDm(false);
    }
  };

  // Social link entries
  const socialEntries = useMemo(() => {
    if (!profile?.social_links) return [];
    return Object.entries(profile.social_links).filter(([, url]) => url?.trim());
  }, [profile?.social_links]);

  // ============================================================
  // LOADING / NOT FOUND
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#070710' }}>
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-amber-500" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#070710' }}>
        <div className="text-6xl">👤</div>
        <h1 className="text-3xl font-black text-white">User not found</h1>
        <p className="text-white/40">This profile doesn&apos;t exist or has been removed.</p>
        <Link href="/community" className="mt-2 px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-colors">
          Browse Community
        </Link>
      </div>
    );
  }

  const displayName = profile.display_name || profile.full_name || 'User';

  return (
    <div className="min-h-screen text-white" style={{ background: '#070710' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: 'rgba(7,7,16,0.92)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/community" className="text-sm text-white/40 hover:text-white transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Community
          </Link>
          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                <Link href="/dashboard" className="text-xs text-white/40 hover:text-white transition-colors">Dashboard</Link>
                <Link href="/messages" className="text-xs text-white/40 hover:text-white transition-colors">Messages</Link>
              </>
            ) : (
              <Link href="/auth/login" className="text-sm text-white/40 hover:text-white transition-colors">Sign In</Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero banner — larger, more dramatic */}
      <div className={`relative h-56 md:h-72 bg-gradient-to-br ${theme.gradient} overflow-hidden`}>
        {profile.banner_url ? (
          <img src={profile.banner_url} alt={`${displayName}'s profile banner`} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          /* Animated subtle grid pattern for non-banner profiles */
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070710] via-[#070710]/40 to-transparent" />
        {/* Decorative accent glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-32 rounded-full blur-[100px] opacity-20" style={{ backgroundColor: `rgb(${theme.accentRgb})` }} />
      </div>

      {/* Profile header — overlaps banner */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="relative -mt-20 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar */}
            <div className="shrink-0 relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-36 h-36 rounded-2xl border-4 border-[#070710] object-cover shadow-2xl"
                />
              ) : (
                <div className="w-36 h-36 rounded-2xl border-4 border-[#070710] bg-white/10 backdrop-blur-sm flex items-center justify-center text-5xl font-bold text-white/60 shadow-2xl">
                  {displayName[0].toUpperCase()}
                </div>
              )}
              {profile.is_pro && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white" style={{ background: '#FF5F1F' }}>
                  PRO
                </div>
              )}
            </div>

            {/* Name + meta + actions */}
            <div className="flex-1 min-w-0 pt-4 md:pt-8">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-3xl md:text-4xl font-black" style={{ letterSpacing: '-0.03em' }}>
                    {displayName}
                  </h1>
                  {profileBadges.length > 0 && (
                    <div className="mt-2">
                      <BadgeDisplay badges={profileBadges} max={2} size="sm" />
                    </div>
                  )}
                  {profile.username && (
                    <p className="text-sm text-white/30 mt-1 font-mono">@{profile.username}</p>
                  )}
                  {profile.headline && (
                    <p className={`text-base mt-2 leading-relaxed ${theme.textAccent}`}>{profile.headline}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {isOwnProfile ? (
                    <Link
                      href="/settings"
                      className="px-5 py-2.5 text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition-all"
                    >
                      Edit Profile
                    </Link>
                  ) : (
                    <>
                      {profile.allow_dms !== false && currentUser && (
                        <button
                          onClick={handleStartDm}
                          disabled={startingDm}
                          className="px-5 py-2.5 text-sm font-semibold text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-500/20"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          {startingDm ? 'Opening...' : 'Message'}
                        </button>
                      )}
                      {currentUser && (
                        <Link
                          href={`/support?type=user&id=${profile.id}&subject=${encodeURIComponent('Report user: ' + displayName)}`}
                          className="px-4 py-2.5 text-sm font-medium text-white/50 hover:text-red-400 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 rounded-xl transition-all flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          Report
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Meta info chips */}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                {profile.role && profile.role !== 'writer' && profileBadges.length === 0 && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border capitalize ${
                    profile.role === 'admin'
                      ? 'text-red-400 bg-red-500/10 border-red-500/20'
                      : profile.role === 'moderator'
                        ? 'text-green-400 bg-green-500/10 border-green-500/20'
                        : 'text-white/70 bg-white/[0.06] border-white/[0.08]'
                  }`}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    {profile.role}
                  </span>
                )}
                {profile.location && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white/70 bg-white/[0.06] rounded-full border border-white/[0.08]">
                    <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {profile.location}
                  </span>
                )}
                {profile.website && (
                  <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white/70 bg-white/[0.06] hover:bg-white/[0.1] rounded-full border border-white/[0.08] transition-colors">
                    <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                )}
                <span className="text-xs text-white/20">Joined {formatDate(profile.created_at)}</span>
                {(profile.profile_views || 0) > 0 && (
                  <span className="text-xs text-white/20">{profile.profile_views.toLocaleString()} profile views</span>
                )}
              </div>

              {/* Social links */}
              {socialEntries.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {socialEntries.map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url.startsWith('http') ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/60 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] rounded-lg transition-all capitalize"
                    >
                      <span className="text-sm">{SOCIAL_ICONS[platform] || '🔗'}</span>
                      {platform}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bio — prominent card */}
        {profile.bio && (
          <div className={`mb-8 rounded-2xl ${theme.cardBg} border border-white/[0.06] p-6`}>
            <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Scripts', value: posts.length, icon: '📝' },
            { label: 'Projects', value: publicProjects.length, icon: '🎬' },
            { label: 'Filmography', value: filmography.length, icon: '🎞️' },
            { label: 'Upvotes', value: posts.reduce((sum, p) => sum + p.upvote_count, 0), icon: '⬆️' },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl ${theme.cardBg} border border-white/[0.06] p-4 text-center`}>
              <div className="text-xl mb-1">{stat.icon}</div>
              <p className="text-2xl font-black text-white">{stat.value}</p>
              <p className="text-[11px] text-white/30 uppercase tracking-wider mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Featured projects — cinematic cards */}
        {featuredProjects.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              Featured
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredProjects.map((project) => (
                <div key={project.id} className={`rounded-2xl ${theme.cardBg} border border-white/[0.06] overflow-hidden hover:border-white/[0.15] transition-all group`}>
                  {project.poster_url || project.cover_url ? (
                    <div className="aspect-[16/10] overflow-hidden">
                      <img src={project.poster_url || project.cover_url || ''} alt={project.title || 'Project poster'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className={`aspect-[16/10] bg-gradient-to-br ${theme.gradient} flex items-center justify-center`}>
                      <svg className="w-12 h-12 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-semibold text-white truncate">{project.title}</h3>
                    {project.logline && <p className="text-xs text-white/40 mt-1.5 line-clamp-2 leading-relaxed">{project.logline}</p>}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-[10px] text-white/30 capitalize">{project.format}</span>
                      {project.genre.length > 0 && <span className="text-[10px] text-white/30">· {project.genre.join(', ')}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filmography — cinematic horizontal cards */}
        {filmography.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
              Filmography
            </h2>
            <div className="space-y-3">
              {filmography.map((project) => {
                const ytMatch = project.wrap_url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                const thumb = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg` : project.cover_url || project.poster_url;
                const roleLabel = project.member_role ? PRODUCTION_ROLES.find((r) => r.value === project.member_role)?.label : null;

                return (
                  <Link
                    key={project.id}
                    href={`/community/showcase/${project.id}`}
                    className={`flex items-center gap-5 rounded-xl ${theme.cardBg} border border-white/[0.06] hover:border-white/[0.15] transition-all p-4 group`}
                  >
                    <div className="w-28 h-[4.5rem] rounded-lg overflow-hidden shrink-0 bg-white/5">
                      {thumb ? (
                        <img src={thumb} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors truncate">{project.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {roleLabel && (
                          <span className={`text-xs font-medium ${theme.textAccent}`}>{roleLabel}</span>
                        )}
                        {project.character_name && (
                          <span className="text-xs text-amber-400/70">as {project.character_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/25">
                        {project.format && <span className="capitalize">{project.format}</span>}
                        {project.genre && project.genre.length > 0 && <span>· {project.genre.join(', ')}</span>}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-white/15 group-hover:text-white/40 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
          {[
            { key: 'posts' as const, label: `Scripts`, count: posts.length },
            ...(profile.show_projects !== false ? [{ key: 'projects' as const, label: `Projects`, count: publicProjects.length }] : []),
            ...(profileCourses.length > 0 ? [{ key: 'courses' as const, label: 'Courses', count: profileCourses.length }] : []),
            { key: 'about' as const, label: 'About', count: 0 },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 text-xs text-white/30">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* scripts / posts tab */}
        {activeTab === 'posts' && (
          <div>
            {posts.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-3">📝</div>
                <p className="text-white/40">No published scripts yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/community/post/${post.slug}`}
                    className={`block rounded-xl ${theme.cardBg} border border-white/[0.06] hover:border-white/[0.15] transition-all p-5 group`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
                        <svg className="w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        <span className="text-sm font-bold text-white/60">{post.upvote_count}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-white group-hover:text-amber-400 transition-colors line-clamp-1">{post.title}</h3>
                        {post.description && <p className="text-sm text-white/40 mt-1.5 line-clamp-2 leading-relaxed">{post.description}</p>}
                        <div className="flex items-center gap-4 mt-3 text-xs text-white/25">
                          <span>{timeAgo(post.created_at)}</span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            {post.comment_count}
                          </span>
                          {post.view_count > 0 && <span>{post.view_count} views</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {post.allow_free_use && <span className="px-2 py-0.5 text-[10px] font-semibold text-green-400 bg-green-500/10 rounded-full border border-green-500/20">Free to Use</span>}
                          {post.allow_distros && <span className="px-2 py-0.5 text-[10px] font-semibold text-blue-400 bg-blue-500/10 rounded-full border border-blue-500/20">Distros</span>}
                        </div>
                      </div>
                      {post.cover_image_url && (
                        <div className="hidden sm:block w-24 h-16 rounded-lg overflow-hidden shrink-0">
                          <img src={post.cover_image_url} alt={post.title || 'Blog post cover'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projects tab */}
        {activeTab === 'projects' && (
          <div>
            {publicProjects.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-3">🎬</div>
                <p className="text-white/40">No projects to show.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicProjects.map((project) => (
                  <div key={project.id} className={`rounded-2xl ${theme.cardBg} border border-white/[0.06] overflow-hidden hover:border-white/[0.15] transition-all group`}>
                    {project.poster_url || project.cover_url ? (
                      <div className="aspect-[16/10] overflow-hidden">
                        <img src={project.poster_url || project.cover_url || ''} alt={project.title || 'Project poster'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    ) : (
                      <div className={`aspect-[16/10] bg-gradient-to-br ${theme.gradient} flex items-center justify-center`}>
                        <svg className="w-12 h-12 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md ${
                          project.status === 'completed' ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                          : project.status === 'production' ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                          : 'text-white/40 bg-white/[0.04] border border-white/[0.08]'
                        }`}>
                          {project.status?.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white truncate">{project.title}</h3>
                      {project.logline && <p className="text-xs text-white/40 mt-1.5 line-clamp-2 leading-relaxed">{project.logline}</p>}
                      <div className="flex items-center gap-2 mt-3 text-[10px] text-white/25">
                        <span className="capitalize">{project.format}</span>
                        {project.genre.length > 0 && <span>· {project.genre.join(', ')}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* About tab */}
        {activeTab === 'about' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
            {/* Main details */}
            <div className="lg:col-span-2 space-y-6">
              <div className={`rounded-2xl ${theme.cardBg} border border-white/[0.06] p-6`}>
                <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-5">Details</h3>
                <dl className="space-y-4">
                  {[
                    { label: 'Name', value: displayName },
                    profile.username ? { label: 'Username', value: `@${profile.username}` } : null,
                    (profile.show_email && profile.email) ? { label: 'Email', value: profile.email, isEmail: true } : null,
                    profile.role ? { label: 'Role', value: profile.role, capitalize: true } : null,
                    profile.location ? { label: 'Location', value: profile.location } : null,
                    { label: 'Member since', value: formatDate(profile.created_at) },
                  ].filter(Boolean).map((item: any) => (
                    <div key={item.label} className="flex justify-between items-center">
                      <dt className="text-sm text-white/30">{item.label}</dt>
                      <dd className={`text-sm font-medium text-white/70 ${item.capitalize ? 'capitalize' : ''}`}>
                        {item.isEmail ? (
                          <a href={`mailto:${item.value}`} className={`${theme.textAccent} hover:underline transition-colors`}>{item.value}</a>
                        ) : item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {profile.bio && (
                <div className={`rounded-2xl ${theme.cardBg} border border-white/[0.06] p-6`}>
                  <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">Bio</h3>
                  <p className="text-sm text-white/60 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Social links expanded */}
              {socialEntries.length > 0 && (
                <div className={`rounded-2xl ${theme.cardBg} border border-white/[0.06] p-6`}>
                  <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">Links</h3>
                  <div className="space-y-2">
                    {socialEntries.map(([platform, url]) => (
                      <a
                        key={platform}
                        href={url.startsWith('http') ? url : `https://${url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors group"
                      >
                        <span className="text-lg">{SOCIAL_ICONS[platform] || '🔗'}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white/70 capitalize">{platform}</p>
                          <p className={`text-[11px] text-white/25 truncate group-hover:${theme.textAccent} transition-colors`}>{url.replace(/^https?:\/\//, '')}</p>
                        </div>
                        <svg className="w-3.5 h-3.5 text-white/15 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick stats */}
              <div className={`rounded-2xl ${theme.cardBg} border border-white/[0.06] p-6`}>
                <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">Activity</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Published Scripts</span>
                    <span className="text-lg font-bold text-white">{posts.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Projects</span>
                    <span className="text-lg font-bold text-white">{publicProjects.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Total Upvotes</span>
                    <span className="text-lg font-bold text-white">{posts.reduce((sum, p) => sum + p.upvote_count, 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/40">Filmography</span>
                    <span className="text-lg font-bold text-white">{filmography.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Courses tab */}
        {activeTab === 'courses' && (
          <div>
            {profileCourses.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-3">📚</div>
                <p className="text-white/40">No courses enrolled yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {profileCourses.map(({ id, course, progress_percent, completed_at }) => {
                  const diffColor = course.difficulty === 'beginner' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
                    : course.difficulty === 'intermediate' ? 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10'
                    : 'text-red-400 border-red-500/20 bg-red-500/10';
                  return (
                    <Link key={id} href={`/community/courses/${course.id}`}
                      className={`block rounded-2xl ${theme.cardBg} border border-white/[0.06] hover:border-white/[0.18] transition-all overflow-hidden group`}>
                      {course.thumbnail_url ? (
                        <div className="aspect-video overflow-hidden">
                          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                      ) : (
                        <div className="aspect-video bg-gradient-to-br from-[#FF5F1F]/10 to-[#0E0E1C] flex items-center justify-center">
                          <span className="text-4xl opacity-30">📚</span>
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${diffColor}`}>{course.difficulty}</span>
                          {completed_at ? (
                            <span className="text-[9px] font-semibold text-emerald-400 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                              Done
                            </span>
                          ) : (
                            <span className="text-[9px] text-[#FF5F1F]">{course.xp_reward} XP</span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-white group-hover:text-[#FF7A3F] transition-colors line-clamp-2 leading-snug">{course.title}</h3>
                        {course.short_desc && <p className="text-xs text-white/40 mt-1 line-clamp-1">{course.short_desc}</p>}
                        {/* Progress bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-white/30">Progress</span>
                            <span className="text-[9px] text-white/50 font-medium">{progress_percent}%</span>
                          </div>
                          <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${progress_percent}%`, background: completed_at ? '#10B981' : '#FF5F1F' }} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-10 px-6 mt-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm text-white/30">
            {displayName}&apos;s profile on{' '}
            <Link href="/" className="text-white/50 hover:text-white font-medium transition-colors">Screenplay Studio</Link>
          </span>
          <div className="flex items-center gap-6 text-sm text-white/30">
            <Link href="/community" className="hover:text-white transition-colors">Community</Link>
            <Link href="/community/showcase" className="hover:text-white transition-colors">Showcase</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <span className="text-white/10">·</span>
            <a
              href="https://development.northem.no/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-mono uppercase tracking-[0.15em] transition-colors text-[#FF5F1F]/40 hover:text-[#FF5F1F]/80"
            >
              Northem ♥
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
