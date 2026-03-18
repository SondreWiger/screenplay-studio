'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CommunityScriptInfoPanel } from '@/components/community/CommunityScriptReader';
import type { ProjectShareLink } from '@/lib/types';

// ============================================================
// Public Share Viewer — new token-based share system
// No authentication required for content links.
// Invite links prompt sign in / sign up then auto-join project.
// ============================================================

// ---- Types --------------------------------------------------

interface ShareProject {
  id: string;
  title: string;
  logline: string | null;
  format: string;
  cover_url: string | null;
  accent_color: string | null;
}

interface ScriptElement {
  id: string;
  element_type: string;
  content: string;
  sort_order: number;
}

interface ShareScript {
  id: string;
  title: string;
  version: number;
  elements: ScriptElement[];
}

interface ShareCharacter {
  id: string;
  name: string;
  full_name: string | null;
  age: string | null;
  description: string | null;
  avatar_url: string | null;
  color: string;
  is_main: boolean;
  role: string | null;
}

interface ShareScene {
  id: string;
  scene_number: string | null;
  scene_heading: string | null;
  location_type: string;
  location_name: string | null;
  time_of_day: string;
  synopsis: string | null;
  page_count: number;
  sort_order: number;
}

interface ShareDocument {
  id: string;
  title: string;
  doc_type: string;
  content: string;
  word_count: number;
  tags: string[];
}

interface ShareData {
  link: Pick<ProjectShareLink,
    'id' | 'name' | 'is_invite' | 'invite_role' |
    'can_view_script' | 'can_view_characters' | 'can_view_scenes' |
    'can_view_schedule' | 'can_view_documents' | 'expires_at'
  >;
  project: ShareProject | null;
  script?: ShareScript | null;
  characters?: ShareCharacter[];
  scenes?: ShareScene[];
  schedule?: Record<string, unknown>[];
  documents?: ShareDocument[];
}

// ---- Tab definitions ----------------------------------------

type Tab = 'script' | 'characters' | 'scenes' | 'schedule' | 'documents';
const TAB_LABELS: Record<Tab, string> = {
  script: 'Script',
  characters: 'Characters',
  scenes: 'Scenes',
  schedule: 'Schedule',
  documents: 'Documents',
};

// ---- Main component -----------------------------------------

export default function ShareViewerPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const token = params.token;

  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('script');

  // Invite / auth state
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);

  // ---- Fetch share data -------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/share/${token}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Link not found or has expired.');
          return;
        }
        const json: ShareData = await res.json();
        setData(json);
        // Set default tab to first available
        if (json.link.can_view_script) setActiveTab('script');
        else if (json.link.can_view_characters) setActiveTab('characters');
        else if (json.link.can_view_scenes) setActiveTab('scenes');
        else if (json.link.can_view_schedule) setActiveTab('schedule');
        else if (json.link.can_view_documents) setActiveTab('documents');
      } catch {
        setError('Failed to load shared content.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  // ---- Auth handler (invite links) --------------------------
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    const supabase = createClient();

    let authErr: string | null = null;

    if (authMode === 'signup') {
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (signUpErr) authErr = signUpErr.message;
    } else {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) authErr = signInErr.message;
    }

    if (authErr) {
      setAuthError(authErr);
      setAuthLoading(false);
      return;
    }

    // Accept the invite
    const { error: rpcErr } = await supabase.rpc('accept_share_invite', { link_token: token });
    if (rpcErr && !rpcErr.message.includes('already')) {
      setAuthError('Could not join the project: ' + rpcErr.message);
      setAuthLoading(false);
      return;
    }

    setAuthSuccess(true);
    // Redirect to the project after a brief delay
    setTimeout(() => {
      if (data?.project?.id) {
        router.push(`/projects/${data.project.id}`);
      } else {
        router.push('/dashboard');
      }
    }, 1500);
    setAuthLoading(false);
  }

  // ---- Render states ----------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
        <div className="text-4xl">🔗</div>
        <h1 className="text-xl font-semibold text-white">{error ?? 'Link unavailable'}</h1>
        <p className="text-gray-400 text-sm max-w-xs">This link may have expired, been deactivated, or the URL is incorrect.</p>
        <a href="https://screenplaystudio.fun" className="text-sm text-indigo-400 hover:underline mt-2">
          Screenplay Studio
        </a>
      </div>
    );
  }

  const { link, project } = data;
  const tabs = (['script', 'characters', 'scenes', 'schedule', 'documents'] as Tab[]).filter((t) => {
    if (t === 'script') return link.can_view_script && data.script;
    if (t === 'characters') return link.can_view_characters;
    if (t === 'scenes') return link.can_view_scenes;
    if (t === 'schedule') return link.can_view_schedule;
    if (t === 'documents') return link.can_view_documents;
    return false;
  });

  // ---- Invite link view -------------------------------------
  if (link.is_invite) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {project?.cover_url && (
              <img src={project.cover_url} alt="" className="w-8 h-8 rounded object-cover" />
            )}
            <span className="font-semibold text-white text-sm">{project?.title ?? 'Screenplay Studio'}</span>
          </div>
          <a href="https://screenplaystudio.fun" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Screenplay Studio
          </a>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm">
            {authSuccess ? (
              <div className="text-center">
                <div className="text-3xl mb-4">✓</div>
                <p className="text-white font-semibold">You&apos;ve joined the project!</p>
                <p className="text-gray-400 text-sm mt-2">Redirecting you now…</p>
              </div>
            ) : (
              <>
                <div className="mb-8 text-center">
                  <p className="text-gray-400 text-sm">You&apos;ve been invited to collaborate on</p>
                  <h1 className="text-xl font-bold text-white mt-1">{project?.title ?? 'a project'}</h1>
                  <p className="text-gray-500 text-sm mt-1">
                    You&apos;ll join as <span className="text-indigo-400 capitalize">{link.invite_role}</span>
                  </p>
                </div>

                {/* Auth toggle */}
                <div className="flex bg-white/5 rounded-lg p-1 mb-6">
                  <button
                    onClick={() => { setAuthMode('signin'); setAuthError(null); }}
                    className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${authMode === 'signin' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                    className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${authMode === 'signup' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Sign up
                  </button>
                </div>

                <form onSubmit={handleAuth} className="space-y-3">
                  {authMode === 'signup' && (
                    <input
                      type="text"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                  )}
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />

                  {authError && (
                    <p className="text-red-400 text-xs">{authError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                  >
                    {authLoading ? 'Please wait…' : authMode === 'signup' ? 'Create account & join' : 'Sign in & join'}
                  </button>
                </form>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ---- Content viewer (no auth required) --------------------

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0a0a0b]/90 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          {project?.cover_url && (
            <img src={project.cover_url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
          )}
          <div className="min-w-0">
            <span className="font-semibold text-white text-sm truncate block">{project?.title ?? link.name}</span>
            {project?.format && (
              <span className="text-gray-500 text-xs">{project.format}</span>
            )}
          </div>
        </div>
        <a href="https://screenplaystudio.fun" className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 ml-4">
          Screenplay Studio
        </a>
      </header>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex gap-0.5 px-6 pt-4 border-b border-white/10 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'text-white bg-white/10 border-b-2 border-indigo-500'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Script tab */}
        {activeTab === 'script' && data.script && (
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">{data.script.title}</h2>
              {data.script.version > 1 && (
                <span className="text-xs text-gray-500 mt-0.5">Version {data.script.version}</span>
              )}
            </div>
            <CommunityScriptInfoPanel
              content={JSON.stringify(data.script.elements)}
              title={data.script.title}
            />
          </div>
        )}

        {/* Characters tab */}
        {activeTab === 'characters' && data.characters && (
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.characters.map((char) => (
                <div key={char.id} className="bg-white/5 rounded-xl p-4 flex gap-3">
                  {char.avatar_url ? (
                    <img src={char.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
                      style={{ background: char.color ?? '#4f46e5' }}
                    >
                      {char.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{char.name}</p>
                    {char.role && <p className="text-xs text-gray-400 capitalize mt-0.5">{char.role}</p>}
                    {char.age && <p className="text-xs text-gray-500 mt-0.5">{char.age}</p>}
                    {char.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-3">{char.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scenes tab */}
        {activeTab === 'scenes' && data.scenes && (
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-3">
            {data.scenes.map((scene, i) => (
              <div key={scene.id} className="bg-white/5 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                      Scene {scene.scene_number ?? i + 1}
                    </p>
                    <p className="font-semibold text-white text-sm mt-0.5 uppercase">
                      {scene.scene_heading ?? `${scene.location_type === 'INT' ? 'INT.' : 'EXT.'} ${scene.location_name ?? 'LOCATION'} — ${scene.time_of_day}`}
                    </p>
                    {scene.synopsis && (
                      <p className="text-xs text-gray-400 mt-2">{scene.synopsis}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0 bg-white/5 px-2 py-0.5 rounded">
                    {scene.page_count}p
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Schedule tab */}
        {activeTab === 'schedule' && data.schedule && (
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-3">
            {data.schedule.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-12">No schedule days added yet.</p>
            )}
            {data.schedule.map((day, i) => (
              <div key={String(day.id ?? i)} className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white text-sm">
                      Day {String(day.day_number ?? i + 1)}
                      {day.shoot_date ? ` — ${new Date(day.shoot_date as string).toLocaleDateString()}` : ''}
                    </p>
                    {!!(day.call_time || day.wrap_time) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Call {String(day.call_time ?? '')} · Wrap {String(day.wrap_time ?? '')}
                      </p>
                    )}
                    {!!day.notes && <p className="text-xs text-gray-500 mt-1">{String(day.notes)}</p>}
                  </div>
                  {!!day.is_completed && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Done</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Documents tab */}
        {activeTab === 'documents' && data.documents && (
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
            {data.documents.map((doc) => (
              <div key={doc.id} className="bg-white/5 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">{doc.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{doc.doc_type.replace('_', ' ')} · {doc.word_count.toLocaleString()} words</p>
                  </div>
                  {doc.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap justify-end">
                      {doc.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{doc.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Empty state when no content tabs available */}
        {tabs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
            <p className="text-gray-400 text-sm">This link doesn&apos;t have any viewable content yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
