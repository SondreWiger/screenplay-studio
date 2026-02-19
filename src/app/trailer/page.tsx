'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button, Avatar, Badge } from '@/components/ui';
import { formatTime } from '@/lib/utils';
import type { CommunityPost, Profile } from '@/lib/types';

const VERBS = ['Write', 'Collaborate', 'Plan', 'Shoot', 'Edit', 'Ship'];
const STAGE_DURATION = 3800; // ms per stage

export default function TrailerPage() {
  const [playing, setPlaying] = useState(true);
  const [stage, setStage] = useState(0);
  const [verbIndex, setVerbIndex] = useState(0);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [authors, setAuthors] = useState<Profile[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Fetch latest published community posts (public)
    supabase
      .from('community_posts')
      .select('id,slug,title,description,cover_image_url,created_at,author:profiles!author_id(id,full_name,avatar_url,username)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(6)
      .then((r) => { if (r.data) setPosts(r.data); });

    // Fetch a few public profiles (recent)
    supabase
      .from('profiles')
      .select('id,full_name,avatar_url,username')
      .order('created_at', { ascending: false })
      .limit(8)
      .then((r) => { if (r.data) setAuthors(r.data); });
  }, []);

  // autoplay stage loop
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setStage((s) => (s + 1) % 5);
      setVerbIndex((v) => (v + 1) % VERBS.length);
    }, STAGE_DURATION);

    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [stage, playing]);

  // small verb ticker faster than stage
  useEffect(() => {
    const id = setInterval(() => setVerbIndex((v) => (v + 1) % VERBS.length), 1100);
    return () => clearInterval(id);
  }, []);

  const togglePlay = () => setPlaying((p) => !p);
  const jumpTo = (i: number) => { setStage(i); setPlaying(false); };

  // Typewriter content using post titles (falls back to static lines)
  const scriptLines = (posts.length > 0)
    ? posts.slice(0, 4).map((p) => p.title)
    : ['FADE IN:', 'EXT. CITY SKYLINE - NIGHT', 'A lone figure moves through the rain.'];

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-stretch overflow-hidden">
      {/* animated background glows */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-[420px] h-[420px] bg-brand-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 left-1/4 w-[820px] h-[820px] bg-orange-500/6 rounded-full blur-[160px]" />
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 max-w-7xl mx-auto w-full">
        {/* Hero */}
        <section className="w-full max-w-5xl text-center pb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600/10 border border-brand-600/20 text-brand-400 text-sm font-medium mb-6 backdrop-blur-sm trailer-slide-in">
            <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse-subtle" />
            Live demo — rendered from your product data
          </div>

          <h1 className="text-6xl md:text-8xl font-extrabold leading-[0.95] tracking-tight mb-6">
            <span className="block text-surface-300">Make movies —</span>
            <span className="block gradient-text">fast, collaborative, beautiful</span>
          </h1>

          <div className="mt-6 flex items-center justify-center gap-4">
            <div className="text-3xl md:text-5xl font-bold">{VERBS[verbIndex]}</div>
            <div className="w-[1px] h-8 bg-surface-800/60" />
            <div className="text-left text-surface-400 max-w-2xl">
              <p className="text-lg md:text-xl leading-relaxed">A quick visual tour that uses real public content from this site — community posts, creators, and live UI previews. Fast, punchy, and looped.</p>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button onClick={togglePlay} className="flex items-center gap-2">
              {playing ? 'Pause' : 'Play'}
            </Button>
            <div className="w-80 bg-surface-800/30 rounded-full overflow-hidden" aria-hidden>
              <div
                className="trailer-progress"
                style={{ width: `${((stage + 1) / 5) * 100}%`, transition: `width ${STAGE_DURATION}ms linear` }}
              />
            </div>
            <div className="text-xs text-surface-500">Looped demo — {stage + 1}/5</div>
          </div>
        </section>

        {/* Stage area (plays like a short looping video) */}
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Left — script / editor mock */}
          <div className={`col-span-2 rounded-2xl border border-surface-800 bg-surface-900/60 p-6 shadow-2xl trailer-slide-in ${stage === 0 ? 'animate-scale-in' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-orange-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">SS</div>
                <div className="text-sm text-surface-300 font-medium">Live Editor Preview</div>
              </div>
              <div className="text-[11px] text-surface-500">simulated • {formatTime(new Date().toISOString())}</div>
            </div>

            <div className="bg-white/[0.02] rounded-lg p-6 font-screenplay text-sm leading-relaxed min-h-[220px] relative overflow-hidden">
              {/* animated typewriter lines */}
              <TypewriterLines lines={scriptLines} highlightIndex={stage === 1 ? 1 : 0} />
              <div className="absolute right-3 bottom-3 text-xs text-surface-600">Auto-saved • Live</div>
            </div>

            <div className="mt-4 flex items-center gap-3 text-sm">
              <Badge variant="default">Realtime</Badge>
              <Badge variant="secondary">Collaboration</Badge>
              <Badge variant="default">Revision tracking</Badge>
            </div>
          </div>

          {/* Right — community highlights / creators */}
          <aside className="rounded-2xl border border-surface-800 bg-surface-900/50 p-4 shadow-lg trailer-slide-in">
            <h3 className="text-sm font-semibold text-white mb-3">Community Highlights</h3>

            <div className="space-y-3">
              {posts.slice(0, 4).map((p, i) => (
                <div key={p.id} className={`flex items-start gap-3 p-3 rounded-lg bg-surface-800/40 trailer-grid-tile ${i < 2 ? 'trailer-float' : ''}`}>
                  <div className="w-12 h-12 rounded-md bg-surface-800/20 overflow-hidden flex items-center justify-center">
                    {p.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.cover_image_url} alt="cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-xs text-surface-500">Post</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{p.title}</div>
                    <div className="text-[11px] text-surface-500 truncate mt-1">by {p.author?.full_name || 'User'}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-surface-800 pt-3">
              <h4 className="text-xs text-surface-500 mb-2">Creators</h4>
              <div className="flex gap-2 flex-wrap">
                {authors.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 bg-surface-800/30 rounded-full px-2 py-1 text-xs">
                    <Avatar src={a.avatar_url} name={a.full_name || a.username || 'User'} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{a.full_name || a.username || 'User'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* Marquee of small feature-cards (fast-moving) */}
        <div className="w-full overflow-hidden rounded-xl border border-surface-800 bg-surface-900/50 p-4 trailer-slide-in">
          <div className="flex gap-4 items-center trailer-marquee" style={{ width: '200%' }}>
            {Array.from({ length: 2 }).map((_, cycle) => (
              <div key={cycle} className="flex gap-4 min-w-full">
                <FeatureCard title="Script Editor" desc="Auto-formatting • Revisions" />
                <FeatureCard title="Scene Breakdown" desc="Props • Costumes • VFX" />
                <FeatureCard title="Shot Lists" desc="Angles • Movement • Lenses" />
                <FeatureCard title="Production Schedule" desc="Call sheets • Weather" />
                <FeatureCard title="Moodboards" desc="Pin images, colours, refs" />
                <FeatureCard title="Team Chat" desc="Channels & roles" />
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link href="/auth/register" className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold shadow-lg shadow-brand-600/20 hover:scale-[1.01]">
            Try the Studio — It’s Free
          </Link>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="min-w-[220px] rounded-xl p-4 bg-gradient-to-br from-surface-900/50 to-surface-900/70 border border-surface-800 shadow-lg trailer-grid-tile">
      <div className="text-sm font-semibold mb-1">{title}</div>
      <div className="text-xs text-surface-500">{desc}</div>
    </div>
  );
}

function TypewriterLines({ lines, highlightIndex = 0 }: { lines: string[]; highlightIndex?: number }) {
  const [visible, setVisible] = useState<string[]>(() => lines.map(() => ''));
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < lines.length; i++) {
        const text = lines[i];
        let out = '';
        for (let j = 0; j <= text.length; j++) {
          if (cancelled) return;
          out = text.slice(0, j);
          setVisible((v) => { const copy = [...v]; copy[i] = out; return copy; });
          await new Promise((r) => setTimeout(r, 14 + Math.random() * 12));
        }
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
      }
    })();
    return () => { cancelled = true; };
  }, [lines]);

  return (
    <div>
      {lines.map((ln, idx) => (
        <p key={idx} className={idx === highlightIndex ? 'text-orange-400 font-semibold' : 'text-surface-300'}>
          {visible[idx] || (idx === highlightIndex ? '…' : '')}
        </p>
      ))}
    </div>
  );
}
