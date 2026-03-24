'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const ORANGE = '#FF5F1F';

interface CreatorData {
  ref_code: string;
  social_instagram: string | null;
  social_twitter: string | null;
  social_tiktok: string | null;
  social_youtube: string | null;
  profile: {
    display_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
  } | null;
}

export default function RefLandingPage({ params }: { params: { username: string } }) {
  const [creator, setCreator] = useState<CreatorData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/creator/ref/${params.username}`);
      if (!res.ok) { setNotFound(true); return; }
      const data: CreatorData = await res.json();
      setCreator(data);
      // Store ref in localStorage so register page can pick it up
      try { localStorage.setItem('creator_ref', params.username); } catch { /* ssr */ }
    }
    load();
  }, [params.username]);

  // Track the visit server-side once creator is confirmed
  useEffect(() => {
    if (!creator || tracked) return;
    setTracked(true);
    fetch('/api/creator/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref_code: params.username }),
    }).catch(() => {});
  }, [creator, tracked, params.username]);

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#070710', color: '#fff' }}>
        <div className="text-center">
          <p className="text-white/30 text-sm uppercase tracking-widest font-mono mb-3">Creator not found</p>
          <Link href="/" className="text-[#FF5F1F] text-sm hover:underline">Go to Screenplay Studio →</Link>
        </div>
      </div>
    );
  }

  const displayName = creator?.profile?.display_name || creator?.profile?.full_name || creator?.ref_code || '…';
  const avatarUrl = creator?.profile?.avatar_url;
  const username = creator?.profile?.username ?? creator?.ref_code;

  const socials = creator ? [
    creator.social_instagram && { label: 'Instagram', href: `https://instagram.com/${creator.social_instagram.replace('@', '')}`, icon: 'IG' },
    creator.social_twitter && { label: 'X / Twitter', href: `https://x.com/${creator.social_twitter.replace('@', '')}`, icon: 'X' },
    creator.social_tiktok && { label: 'TikTok', href: `https://tiktok.com/@${creator.social_tiktok.replace('@', '')}`, icon: 'TT' },
    creator.social_youtube && { label: 'YouTube', href: creator.social_youtube.startsWith('http') ? creator.social_youtube : `https://youtube.com/@${creator.social_youtube.replace('@', '')}`, icon: 'YT' },
  ].filter(Boolean) : [];

  return (
    <div className="min-h-screen relative" style={{ background: '#070710', color: '#fff' }}>
      {/* Dot grid */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        opacity: 0.028,
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      {/* Nav */}
      <nav className="relative z-10 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-screen-lg mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 flex items-center justify-center text-[8px] font-black text-white shrink-0" style={{ background: ORANGE }}>
              SS
            </div>
            <div className="leading-none">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">SCREENPLAY</p>
              <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: ORANGE }}>STUDIO</p>
            </div>
          </Link>
          <Link href="/auth/register" className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white" style={{ background: ORANGE }}>
            Join Free →
          </Link>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Creator hero */}
        <section className="max-w-screen-lg mx-auto px-6 pt-20 pb-16 text-center">
          {/* Avatar */}
          <div className="w-20 h-20 mx-auto mb-5 rounded-full overflow-hidden border-2 flex items-center justify-center text-2xl font-black text-white" style={{ borderColor: ORANGE, background: 'rgba(255,95,31,0.15)' }}>
            {avatarUrl ? (
              <Image src={avatarUrl} alt={displayName} width={80} height={80} className="w-full h-full object-cover" />
            ) : (
              <span>{displayName.charAt(0).toUpperCase()}</span>
            )}
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-2" style={{ color: ORANGE }}>
            Creator Invite
          </p>
          <h1 className="font-black text-white mb-3" style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', letterSpacing: '-0.03em', lineHeight: 0.95 }}>
            {displayName.toUpperCase()}<br />
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>WANTS YOU TO</span><br />
            WRITE BETTER.
          </h1>
          <p className="text-white/40 text-sm max-w-sm mx-auto mt-4 leading-relaxed">
            You've been invited to try Screenplay Studio — the full professional screenwriting and production platform. Free, forever.
          </p>

          {/* Social links */}
          {socials.length > 0 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              {socials.map((s: any) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 border text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white hover:border-white/30 transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.12)' }}
                >
                  {s.icon}
                </a>
              ))}
              {username && (
                <Link href={`/u/${username}`} className="px-3 py-1.5 border text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white hover:border-white/30 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                  PROFILE
                </Link>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/auth/register?ref=${params.username}`}
              className="inline-flex items-center gap-2 px-8 py-4 text-[11px] font-black uppercase tracking-[0.14em] text-white transition-all hover:-translate-y-0.5"
              style={{ background: ORANGE }}
            >
              Create Free Account
              <span>→</span>
            </Link>
            <span className="text-[9px] font-mono text-white/20 tracking-wider uppercase">No credit card · Free forever</span>
          </div>
        </section>

        {/* Feature bullets */}
        <section className="max-w-screen-lg mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              { n: '01', title: 'SCREENPLAY EDITOR', desc: 'Write in proper Fountain format. Scene headings, dialogue, action — the formatting handles itself.' },
              { n: '02', title: 'SCENE BREAKDOWN', desc: 'Strip the script into production sheets. Props, costumes, SFX — extracted per scene.' },
              { n: '03', title: 'SHOT LISTS', desc: 'Build your shot list as you plan each scene. Type, lens, movement, notes.' },
              { n: '04', title: 'CORKBOARD', desc: 'Cards on a board. Drag scenes, colour by act, see the whole structure at once.' },
              { n: '05', title: 'CHARACTERS & LOCATIONS', desc: 'A full character bible and location database linked to every scene.' },
              { n: '06', title: 'TEAM COLLABORATION', desc: 'Invite your crew. Set access levels. Stop emailing PDFs.' },
            ].map((f, i) => (
              <div
                key={f.n}
                className="group relative p-7 transition-colors duration-150 hover:bg-white/[0.025] cursor-default overflow-hidden"
                style={{
                  borderRight: (i + 1) % 3 !== 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-0.5 origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-200" style={{ background: ORANGE }} />
                <div className="flex items-start gap-4">
                  <span className="text-[10px] font-black font-mono shrink-0 pt-0.5 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: ORANGE }}>{f.n}</span>
                  <div>
                    <h3 className="text-[10px] font-black uppercase leading-tight mb-2 text-white/50 group-hover:text-white transition-colors" style={{ letterSpacing: '0.1em' }}>{f.title}</h3>
                    <p className="text-[11px] text-white/20 leading-relaxed group-hover:text-white/40 transition-colors">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div className="mt-12 text-center">
            <Link
              href={`/auth/register?ref=${params.username}`}
              className="inline-flex items-center gap-2 px-10 py-5 text-[11px] font-black uppercase tracking-[0.14em] text-white transition-all hover:-translate-y-0.5 hover:shadow-2xl"
              style={{ background: ORANGE }}
            >
              Get Started Free
              <span>→</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t py-6 text-center" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <p className="text-[9px] font-mono text-white/15 uppercase tracking-widest">
          Screenplay Studio · Northem Development · Oslo, Norway
        </p>
      </footer>
    </div>
  );
}
