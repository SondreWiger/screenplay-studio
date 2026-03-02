'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Project } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Creative {
  id: string;
  name: string;
  role: string;
  department?: string;
  email?: string;
}

// ── Genre tag ─────────────────────────────────────────────────────────────────
function GenreTag({ label }: { label: string }) {
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-neutral-700 text-neutral-300 bg-neutral-800">
      {label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PressKitPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchProject();
  }, [params.id]);

  const fetchProject = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .eq('press_kit_enabled', true)
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setProject(data as Project);

    // If no password required, unlock immediately
    if (!data.press_kit_password) {
      setUnlocked(true);
      await fetchCreatives(data.id);
    }
    setLoading(false);
  };

  const fetchCreatives = async (projectId: string) => {
    const supabase = createClient();
    // Try stage production team first
    const { data: stageTeam } = await supabase
      .from('stage_production_team')
      .select('id, name, role, department, contact_email')
      .eq('project_id', projectId)
      .order('sort_order')
      .order('name')
      .limit(20);

    if (stageTeam && stageTeam.length > 0) {
      setCreatives(stageTeam.map((m: { id: string; name: string; role: string; department?: string; contact_email?: string }) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        department: m.department,
        email: m.contact_email,
      })));
      return;
    }

    // Fallback: project members with profiles
    const { data: members } = await supabase
      .from('project_members')
      .select('id, role, profiles(display_name, email)')
      .eq('project_id', projectId)
      .limit(20);

    if (members) {
      setCreatives(
        (members as unknown as { id: string; role: string; profiles: { display_name: string | null; email: string | null } | null }[])
          .filter((m) => m.profiles?.display_name)
          .map((m) => ({
            id: m.id,
            name: m.profiles?.display_name ?? '',
            role: m.role,
          }))
      );
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (passwordInput === project.press_kit_password) {
      setUnlocked(true);
      setPasswordError(false);
      await fetchCreatives(project.id);
    } else {
      setPasswordError(true);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-neutral-700 border-t-white animate-spin" />
      </div>
    );
  }

  // ── Not found ───────────────────────────────────────────────
  if (notFound || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center text-3xl mb-2">🎬</div>
        <h1 className="text-xl font-bold text-white">Press kit not found</h1>
        <p className="text-neutral-500 max-w-xs">This press kit is either unavailable or the link has expired.</p>
      </div>
    );
  }

  // ── Password gate ───────────────────────────────────────────
  if (project.press_kit_password && !unlocked) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-sm">
          {/* Project name hint */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-2xl mx-auto mb-4">🔒</div>
            <h1 className="text-xl font-bold text-white">{project.title}</h1>
            <p className="text-sm text-neutral-500 mt-1">This press kit is password protected</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
              placeholder="Enter password"
              autoFocus
              className={`w-full px-4 py-3 bg-neutral-900 border rounded-xl text-white placeholder-neutral-600 text-sm outline-none focus:ring-2 transition-all ${passwordError ? 'border-red-500 focus:ring-red-500/30' : 'border-neutral-800 focus:ring-white/10 focus:border-neutral-600'}`}
            />
            {passwordError && (
              <p className="text-xs text-red-400 pl-1">Incorrect password. Try again.</p>
            )}
            <button
              type="submit"
              className="w-full py-3 bg-white text-black font-bold text-sm rounded-xl hover:bg-neutral-200 active:scale-95 transition-all"
            >
              View Press Kit
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Press Kit Content ───────────────────────────────────────
  const hasCoverImage = project.cover_url || project.poster_url;
  const format = project.format;
  const genres: string[] = project.genre || [];

  const formatColor: Record<string, string> = {
    feature: '#6366f1',
    short: '#22d3ee',
    series: '#f59e0b',
    mini_series: '#f59e0b',
    stage_play: '#a855f7',
    audio_drama: '#3b82f6',
    documentary: '#10b981',
    other: '#6b7280',
  };
  const fColor = formatColor[format ?? ''] ?? '#6b7280';

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">

      {/* ── Top bar ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-10">
        <span className="text-[11px] text-neutral-600 uppercase tracking-widest">Press Kit</span>
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-white transition-colors px-2.5 py-1 rounded-lg hover:bg-neutral-900"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      {/* ── Hero image ──────────────────────────────── */}
      {hasCoverImage && (
        <div className="mb-8 rounded-2xl overflow-hidden aspect-video bg-neutral-900 border border-neutral-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.poster_url || project.cover_url || ''}
            alt={project.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* ── Title + badges ──────────────────────────── */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {format && (
            <span
              className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{ background: fColor + '20', color: fColor, border: `1px solid ${fColor}30` }}
            >
              {format.replace(/_/g, ' ')}
            </span>
          )}
          {genres.map((g) => <GenreTag key={g} label={g} />)}
        </div>
        <h1 className="text-3xl font-black text-white leading-tight">{project.title}</h1>
        {project.press_kit_tagline && (
          <p className="text-lg text-neutral-400 mt-2 italic">{project.press_kit_tagline}</p>
        )}
      </div>

      {/* ── Logline ─────────────────────────────────── */}
      {project.logline && (
        <div className="mb-6 p-5 rounded-2xl bg-neutral-900 border border-neutral-800">
          <p className="text-[11px] text-neutral-600 uppercase tracking-widest mb-2">Logline</p>
          <p className="text-white text-base leading-relaxed font-medium">{project.logline}</p>
        </div>
      )}

      {/* ── Synopsis ────────────────────────────────── */}
      {project.synopsis && (
        <div className="mb-8">
          <p className="text-[11px] text-neutral-600 uppercase tracking-widest mb-3">Synopsis</p>
          <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">{project.synopsis}</p>
        </div>
      )}

      {/* ── Divider ─────────────────────────────────── */}
      {creatives.length > 0 && <hr className="border-neutral-800 mb-8" />}

      {/* ── Key Creatives ───────────────────────────── */}
      {creatives.length > 0 && (
        <div className="mb-8">
          <p className="text-[11px] text-neutral-600 uppercase tracking-widest mb-4">Key Creatives</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {creatives.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold"
                  style={{ background: (fColor) + '20', color: fColor }}
                >
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                  <p className="text-[11px] text-neutral-500 truncate">{c.role}</p>
                  {c.department && c.department !== c.role && (
                    <p className="text-[10px] text-neutral-600">{c.department}</p>
                  )}
                </div>
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors shrink-0"
                    title={`Email ${c.name}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Contact ─────────────────────────────────── */}
      {project.press_kit_contact && (
        <>
          <hr className="border-neutral-800 mb-8" />
          <div className="mb-8 text-center">
            <p className="text-[11px] text-neutral-600 uppercase tracking-widest mb-3">Press Contact</p>
            <a
              href={`mailto:${project.press_kit_contact}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-bold text-sm rounded-xl hover:bg-neutral-200 active:scale-95 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Press Team
            </a>
            <p className="text-[11px] text-neutral-600 mt-2">{project.press_kit_contact}</p>
          </div>
        </>
      )}

      {/* ── Footer ──────────────────────────────────── */}
      <div className="text-center pt-8 border-t border-neutral-900">
        <p className="text-[10px] text-neutral-800">
          {project.title} · Press Kit · Powered by{' '}
          <a href="/" className="hover:text-neutral-600 transition-colors">Screenplay Studio</a>
        </p>
      </div>
    </div>
  );
}
