'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Badge, Avatar, LoadingSpinner } from '@/components/ui';
import { formatDate, timeAgo } from '@/lib/utils';
import type { Profile, Project, CommunityPost } from '@/lib/types';

// ============================================================
// Public User Profile Page — /u/<username>
// ============================================================

// Theme presets for profile customisation
const PROFILE_THEMES: Record<string, { gradient: string; accent: string; cardBg: string }> = {
  default:   { gradient: 'from-stone-900 to-stone-800',       accent: 'brand-500',  cardBg: 'bg-white' },
  midnight:  { gradient: 'from-indigo-950 to-slate-900',      accent: 'indigo-400', cardBg: 'bg-slate-50' },
  sunset:    { gradient: 'from-orange-600 to-rose-700',       accent: 'orange-500', cardBg: 'bg-orange-50' },
  forest:    { gradient: 'from-emerald-900 to-teal-800',      accent: 'emerald-400',cardBg: 'bg-emerald-50' },
  ocean:     { gradient: 'from-cyan-800 to-blue-900',         accent: 'cyan-400',   cardBg: 'bg-cyan-50' },
  noir:      { gradient: 'from-neutral-950 to-neutral-900',   accent: 'neutral-300',cardBg: 'bg-neutral-50' },
  royal:     { gradient: 'from-purple-900 to-fuchsia-800',    accent: 'purple-400', cardBg: 'bg-purple-50' },
  crimson:   { gradient: 'from-red-900 to-rose-800',          accent: 'red-400',    cardBg: 'bg-red-50' },
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
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'projects' | 'about'>('posts');
  const [startingDm, setStartingDm] = useState(false);

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

    // Increment profile views (don't await, fire-and-forget)
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
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center">
        <div className="text-6xl mb-4">👤</div>
        <h1 className="text-3xl font-bold text-stone-900 mb-2">User not found</h1>
        <p className="text-stone-500 mb-6">This profile doesn&apos;t exist or has been removed.</p>
        <Link href="/community" className="px-6 py-3 bg-stone-900 text-white rounded-lg font-medium hover:bg-stone-800 transition-colors">
          Browse Community
        </Link>
      </div>
    );
  }

  const displayName = profile.display_name || profile.full_name || 'User';

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-[#faf9f7]/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Community
          </Link>
          <div className="flex items-center gap-3">
            {currentUser ? (
              <>
                <Link href="/dashboard" className="text-xs text-stone-500 hover:text-stone-900 transition-colors">Dashboard</Link>
                <Link href="/messages" className="text-xs text-stone-500 hover:text-stone-900 transition-colors">Messages</Link>
              </>
            ) : (
              <Link href="/auth/login" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Sign In</Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero banner */}
      <div className={`relative h-48 md:h-64 bg-gradient-to-br ${theme.gradient}`}>
        {profile.banner_url && (
          <img src={profile.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {/* Profile header */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="relative -mt-16 mb-6 flex flex-col md:flex-row md:items-end gap-4">
          {/* Avatar */}
          <div className="shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="w-32 h-32 rounded-2xl border-4 border-[#faf9f7] object-cover shadow-lg"
              />
            ) : (
              <div className="w-32 h-32 rounded-2xl border-4 border-[#faf9f7] bg-stone-200 flex items-center justify-center text-4xl font-bold text-stone-500 shadow-lg">
                {displayName[0].toUpperCase()}
              </div>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-2xl md:text-3xl font-bold text-stone-900 truncate">{displayName}</h1>
            {profile.username && (
              <p className="text-sm text-stone-400 mt-0.5">@{profile.username}</p>
            )}
            {profile.headline && (
              <p className="text-stone-600 mt-1 line-clamp-2">{profile.headline}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-stone-400">
              {profile.location && (
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {profile.location}
                </span>
              )}
              {profile.website && (
                <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-stone-500 hover:text-stone-800 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              )}
              <span>Joined {formatDate(profile.created_at)}</span>
              {profile.is_pro && (
                <span className="px-2 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 rounded-full border border-amber-200">PRO</span>
              )}
              {(profile.profile_views || 0) > 0 && (
                <span>{profile.profile_views} views</span>
              )}
            </div>

            {/* Social links */}
            {socialEntries.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {socialEntries.map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url.startsWith('http') ? url : `https://${url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors capitalize"
                  >
                    <span>{SOCIAL_ICONS[platform] || '🔗'}</span>
                    {platform}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 pb-1">
            {isOwnProfile ? (
              <Link
                href="/settings"
                className="px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
              >
                Edit Profile
              </Link>
            ) : (
              <>
                {profile.allow_dms !== false && currentUser && (
                  <button
                    onClick={handleStartDm}
                    disabled={startingDm}
                    className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    {startingDm ? 'Opening...' : 'Message'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mb-8 rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Featured projects */}
        {featuredProjects.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">Featured Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredProjects.map((project) => (
                <div key={project.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
                  {project.poster_url ? (
                    <img src={project.poster_url} alt="" className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center">
                      <svg className="w-10 h-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-stone-900 truncate">{project.title}</h3>
                    {project.logline && <p className="text-xs text-stone-500 mt-1 line-clamp-2">{project.logline}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-stone-400 capitalize">{project.format}</span>
                      {project.genre.length > 0 && <span className="text-[10px] text-stone-400">· {project.genre.join(', ')}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-stone-100 rounded-lg p-1 w-fit">
          {[
            { key: 'posts' as const, label: `Scripts (${posts.length})` },
            ...(profile.show_projects !== false ? [{ key: 'projects' as const, label: `Projects (${publicProjects.length})` }] : []),
            { key: 'about' as const, label: 'About' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* scripts / posts tab */}
        {activeTab === 'posts' && (
          <div>
            {posts.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-3">📝</div>
                <p className="text-stone-500">No published scripts yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/community/post/${post.slug}`}
                    className="block rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
                        <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        <span className="text-sm font-semibold text-stone-700">{post.upvote_count}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-stone-900 line-clamp-1">{post.title}</h3>
                        {post.description && <p className="text-sm text-stone-500 mt-1 line-clamp-2">{post.description}</p>}
                        <div className="flex items-center gap-4 mt-2 text-xs text-stone-400">
                          <span>{timeAgo(post.created_at)}</span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            {post.comment_count}
                          </span>
                          {post.view_count > 0 && <span>{post.view_count} views</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {post.allow_free_use && <span className="px-2 py-0.5 text-[10px] font-semibold text-green-700 bg-green-50 rounded-full">Free to Use</span>}
                          {post.allow_distros && <span className="px-2 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 rounded-full">Distros</span>}
                        </div>
                      </div>
                      {post.cover_image_url && (
                        <div className="hidden sm:block w-24 h-16 rounded-lg overflow-hidden shrink-0">
                          <img src={post.cover_image_url} alt="" className="w-full h-full object-cover" />
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
              <div className="text-center py-16">
                <div className="text-5xl mb-3">🎬</div>
                <p className="text-stone-500">No projects to show.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicProjects.map((project) => (
                  <div key={project.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
                    {project.poster_url ? (
                      <img src={project.poster_url} alt="" className="w-full h-36 object-cover" />
                    ) : (
                      <div className="w-full h-36 bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center">
                        <svg className="w-10 h-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-stone-900 truncate">{project.title}</h3>
                      {project.logline && <p className="text-xs text-stone-500 mt-1 line-clamp-2">{project.logline}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-stone-400 capitalize">{project.format}</span>
                        {project.genre.length > 0 && <span className="text-[10px] text-stone-400">· {project.genre.join(', ')}</span>}
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
          <div className="space-y-6 max-w-2xl">
            <div className="rounded-xl border border-stone-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">Details</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-stone-500">Name</dt>
                  <dd className="text-sm text-stone-900 font-medium">{displayName}</dd>
                </div>
                {profile.username && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-stone-500">Username</dt>
                    <dd className="text-sm text-stone-900 font-medium">@{profile.username}</dd>
                  </div>
                )}
                {profile.show_email && profile.email && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-stone-500">Email</dt>
                    <dd className="text-sm text-stone-900 font-medium">
                      <a href={`mailto:${profile.email}`} className="hover:text-brand-600 transition-colors">{profile.email}</a>
                    </dd>
                  </div>
                )}
                {profile.role && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-stone-500">Role</dt>
                    <dd className="text-sm text-stone-900 font-medium capitalize">{profile.role}</dd>
                  </div>
                )}
                {profile.location && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-stone-500">Location</dt>
                    <dd className="text-sm text-stone-900 font-medium">{profile.location}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-sm text-stone-500">Member since</dt>
                  <dd className="text-sm text-stone-900 font-medium">{formatDate(profile.created_at)}</dd>
                </div>
              </dl>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-stone-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-stone-900">{posts.length}</p>
                <p className="text-xs text-stone-500 mt-1">Published Scripts</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-stone-900">{publicProjects.length}</p>
                <p className="text-xs text-stone-500 mt-1">Projects</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-stone-900">{posts.reduce((sum, p) => sum + p.upvote_count, 0)}</p>
                <p className="text-xs text-stone-500 mt-1">Total Upvotes</p>
              </div>
            </div>

            {profile.bio && (
              <div className="rounded-xl border border-stone-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">Bio</h3>
                <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {/* Social links expanded */}
            {socialEntries.length > 0 && (
              <div className="rounded-xl border border-stone-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">Links</h3>
                <div className="space-y-2">
                  {socialEntries.map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url.startsWith('http') ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors group"
                    >
                      <span className="text-lg">{SOCIAL_ICONS[platform] || '🔗'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-800 capitalize">{platform}</p>
                        <p className="text-xs text-stone-400 truncate group-hover:text-brand-500 transition-colors">{url.replace(/^https?:\/\//, '')}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-[#faf9f7] border-t border-stone-200 py-10 px-6 mt-16">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm text-stone-500">
            {displayName}&apos;s profile on <Link href="/" className="text-stone-700 hover:text-stone-900 font-medium transition-colors">Screenplay Studio</Link>
          </span>
          <div className="flex items-center gap-6 text-sm text-stone-500">
            <Link href="/community" className="hover:text-stone-900 transition-colors">Community</Link>
            <Link href="/blog" className="hover:text-stone-900 transition-colors">Blog</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
