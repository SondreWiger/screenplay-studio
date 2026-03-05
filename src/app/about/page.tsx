import Link from 'next/link';
import type { Metadata } from 'next';
import ContributorsList from '@/components/ContributorsList';
import { isOpenSourceEnabled } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const oss = await isOpenSourceEnabled();
  return {
    title: 'About — Screenplay Studio',
    description: oss
      ? 'Why we built an open-source screenwriting suite — and where we want to take it.'
      : 'Why we built Screenplay Studio — and where we want to take it.',
  };
}

const ORANGE = '#FF5F1F';

function Rule() {
  return (
    <div className="max-w-screen-lg mx-auto px-6">
      <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/25 font-mono">
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-4 h-px shrink-0" style={{ background: ORANGE }} />
      <Label>{children}</Label>
    </div>
  );
}

const TIMELINE = [
  { year: '2023', label: 'Idea & first lines of code', detail: 'Started as a script formatter written out of frustration with expensive, fragmented production tools. Immediately became clear the problem was bigger than formatting.' },
  { year: '2024', label: 'First public release', detail: 'Script editor, scene breakdown, shot list, and basic team tools shipped. Early users were film students and indie filmmakers.' },
  { year: '2025', label: 'Platform expansion', detail: 'Audio drama, stage play, TV production, and content creator formats added. Community, AI analysis, and casting tools launched.' },
  { year: '2026', label: 'Now', detail: 'Tens of thousands of projects. Open-source code base. Continual feature work driven by user feedback.' },
];

export default async function AboutPage() {
  const oss = await isOpenSourceEnabled();
  const displayTimeline = oss
    ? TIMELINE
    : TIMELINE.map((t, i) =>
        i === TIMELINE.length - 1
          ? { ...t, detail: 'Tens of thousands of projects. Continual feature work driven by user feedback.' }
          : t,
      );
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#070710', color: '#fff' }}>

      {/* dot-grid texture */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          opacity: 0.032,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top bar */}
      <div className="relative z-10 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-screen-lg mx-auto px-6 h-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center shrink-0" style={{ background: ORANGE }}>
              <span className="font-black text-white text-xs" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-xs font-black text-white uppercase tracking-tight hidden sm:inline">Screenplay Studio</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/" className="text-xs text-white/35 hover:text-white/70 transition-colors">Home</Link>
            <Link href="/blog" className="text-xs text-white/35 hover:text-white/70 transition-colors">Blog</Link>
            <Link href="/dashboard" className="text-xs px-3 py-1.5 font-semibold transition-colors" style={{ background: ORANGE, color: '#fff' }}>
              Open App
            </Link>
          </div>
        </div>
      </div>

      <main className="relative z-10">

        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 pt-20 pb-16">
          <Eyebrow>About</Eyebrow>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6"
            style={{ letterSpacing: '-0.04em', lineHeight: 1.05 }}
          >
            MADE FOR WRITERS.
            <br />
            <span style={{ color: ORANGE }}>BUILT FOR PRODUCTION.</span>
          </h1>
          <p className="text-base sm:text-lg text-white/45 max-w-2xl leading-relaxed">
            {oss
              ? 'Script to screen, in one workspace. An open-source production tool for writers, directors, and crews of every format — because the standard setup is fragmented, expensive, and slower than it needs to be.'
              : 'Script to screen, in one workspace. A production tool for writers, directors, and crews of every format — because the standard setup is fragmented, expensive, and slower than it needs to be.'}
          </p>
        </section>

        <Rule />

        {/* ── Why we built this ──────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-16">
          <Eyebrow>The Why</Eyebrow>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-5" style={{ letterSpacing: '-0.03em' }}>
                The standard setup is worse than it needs to be
              </h2>
              <div className="space-y-4 text-sm sm:text-base text-white/50 leading-relaxed">
                <p>
                  The standard setup in 2024: Final Draft or Celtx at $100+/yr for formatting. A separate Google Sheet for the schedule. Another one for the budget. Notion for character bibles. Your inbox handling feedback rounds. Screenplay Studio puts all of it in one place — not because "all-in-one" is a marketing phrase, but because that fragmented setup genuinely wastes time that should go into the work.
                </p>
                <p>
                  We built Screenplay Studio because that should not be the default. A student in Oslo writing their first short film deserves the same toolset as a production company in Los Angeles. Format should not determine access.
                </p>
                {oss && (
                <p>
                  The platform is open-source. The code is on GitHub. Anyone can inspect it, contribute to it, or run their own instance. We believe transparency and community ownership produce better software than any closed product roadmap ever will.
                </p>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {[
                { q: 'Who is this for?', a: 'Writers, directors, producers, stage companies, podcasters, content creators — anyone who uses a script as the foundation of their work.' },
                { q: 'Is it really free?', a: 'The core platform is free with no time limit. Pro features (advanced exports, AI analysis, custom branding) are available as an optional subscription to keep the lights on.' },
                { q: 'What formats do you support?', a: 'Feature film, TV (episodic & pilot), audio drama, stage play, podcast, content creation (YouTube, TikTok), and broadcast TV production.' },
              ].map(({ q, a }) => (
                <div key={q} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-xs font-bold text-white/60 mb-1.5">{q}</p>
                  <p className="text-sm text-white/45 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Rule />

        {/* ── What this actually is ──────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-16">
          <Eyebrow>The honest version</Eyebrow>
          <div className="max-w-2xl space-y-6">
            <p className="text-base sm:text-lg text-white/60 leading-relaxed">
              Screenplay Studio started as a script formatter and it quickly became obvious that the problem was bigger than formatting. The script is just the start of a production. Breakdown, schedule, budget, casting, crew — all of it flows from the same document, and all of it was living in a dozen different places.
            </p>
            <p className="text-base sm:text-lg text-white/40 leading-relaxed">
              The platform supports film, TV, audio drama, stage, podcast, and content creation because the core problem is the same across all of them. Screenplay Studio carries the production from first draft to final wrap — in one workspace.
            </p>
            <p className="text-base sm:text-lg text-white/25 leading-relaxed">
              No investor roadmap. No enterprise pivot. Built by one developer in Norway and shaped by the people who actually use it. That is the whole model.
            </p>
          </div>
        </section>

        <Rule />

        {/* ── Timeline ───────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-16">
          <Eyebrow>History</Eyebrow>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-10" style={{ letterSpacing: '-0.03em' }}>
            How we got here
          </h2>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[5.5rem] top-0 bottom-0 w-px hidden sm:block" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="space-y-8">
              {displayTimeline.map((t, i) => (
                <div key={t.year} className="flex gap-6 sm:gap-10 items-start">
                  <div className="shrink-0 w-20 text-right">
                    <span
                      className="text-sm font-black"
                      style={{ color: i === TIMELINE.length - 1 ? ORANGE : 'rgba(255,255,255,0.35)' }}
                    >
                      {t.year}
                    </span>
                  </div>
                  {/* Dot */}
                  <div className="shrink-0 w-2.5 h-2.5 rounded-full mt-1 hidden sm:block" style={{ background: i === TIMELINE.length - 1 ? ORANGE : 'rgba(255,255,255,0.2)' }} />
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">{t.label}</p>
                    <p className="text-xs text-white/35 leading-relaxed">{t.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Rule />

        {/* ── What's next ────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-16">
          <Eyebrow>Roadmap</Eyebrow>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-5" style={{ letterSpacing: '-0.03em' }}>
            Where we are going
          </h2>
          <p className="text-sm text-white/45 max-w-2xl leading-relaxed mb-8">
            The platform is under active development. Here are the areas we are focused on in 2026:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            {[
              'Deeper AI assistance — not autocomplete, but a script reader that actually understands story structure and where the draft is going wrong',
              'Mobile-first crew tools for on-set and on-stage use — call sheets, shot tracking, cue sheets on a phone',
              'True offline mode: the app should work on a plane or in a studio basement and sync when it gets a connection back',
              'A script library and structured peer critique space — not just a forum, but feedback with actual process behind it',
              'Proper internationalisation — multiple script languages, UI in more than English',
              'A documented API so you can connect Screenplay Studio to whatever pipeline you already use',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-xs text-white/45 leading-relaxed">
                <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ background: ORANGE + '30', color: ORANGE }}>
                  {i + 1}
                </span>
                {item}
              </div>
            ))}
          </div>
        </section>

        <Rule />

        {/* ── Contributors ───────────────────────────────────── */}
        {oss && (
        <section className="max-w-screen-lg mx-auto px-6 py-16">
          <Eyebrow>Contributors · Open Source</Eyebrow>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3" style={{ letterSpacing: '-0.03em' }}>
            Built by the community
          </h2>
          <p className="text-sm text-white/40 max-w-xl leading-relaxed mb-8">
            Screenplay Studio is open source. These are the people who have contributed to the codebase, design, documentation, and community.
          </p>
          <ContributorsList />
          <div className="mt-8">
            <Link href="/contribute" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-80" style={{ color: ORANGE }}>
              Want to contribute? →
            </Link>
          </div>
        </section>
        )}

        {oss && <Rule />}

        {/* ── CTA ────────────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4" style={{ letterSpacing: '-0.04em' }}>
            Just try it.
          </h2>
          <p className="text-sm text-white/40 mb-8">Free. No card. No time limit.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/auth/register"
              className="px-6 py-3 text-sm font-black text-white uppercase tracking-tight transition-opacity hover:opacity-90"
              style={{ background: ORANGE }}
            >
              Get Started Free
            </Link>
            <Link
              href="/community"
              className="px-6 py-3 text-sm font-semibold text-white/50 hover:text-white transition-colors border border-white/10 hover:border-white/20 rounded-sm"
            >
              Join the Community →
            </Link>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-screen-lg mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center shrink-0" style={{ background: ORANGE }}>
              <span className="font-black text-white text-[10px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-xs text-white/20">
              {oss ? 'Screenplay Studio — open-source & free' : 'Screenplay Studio'}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Shoutout to</p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="https://sergioedup.com/" target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://sergioedup.com/images/png/sep_badge.png" alt="SergioEduP.com 88x31 Badge" style={{ imageRendering: 'pixelated', height: '31px', width: '88px' }} />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-5 flex-wrap">
            <Link href="/blog" className="text-xs text-white/25 hover:text-white/50 transition-colors">Blog</Link>
            <Link href="/legal/privacy" className="text-xs text-white/25 hover:text-white/50 transition-colors">Privacy</Link>
            <Link href="/legal/terms" className="text-xs text-white/25 hover:text-white/50 transition-colors">Terms</Link>
            <span className="text-white/10">·</span>
            <a
              href="https://development.northem.no/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono uppercase tracking-[0.15em] transition-colors text-[#FF5F1F]/60 hover:text-[#FF5F1F]"
            >
              Northem Development ♥ Oslo
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
