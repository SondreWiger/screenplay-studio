import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About — Screenplay Studio',
  description: 'Why we built an open-source screenwriting suite — and where we want to take it.',
};

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

const PRINCIPLES = [
  {
    icon: '🔓',
    title: 'Open & Free',
    body: 'Professional-grade tools should not be locked behind expensive subscriptions. The core of Screenplay Studio is open-source and free — forever.',
  },
  {
    icon: '🎬',
    title: 'Every Format',
    body: 'Film. TV. Audio drama. Stage play. Podcast. Content creation. We support the full spectrum of storytelling formats in a single unified workspace.',
  },
  {
    icon: '🤝',
    title: 'Built for Collaboration',
    body: 'Storytelling is rarely a solo act. Real-time chat, inline comments, shared breakdowns, and team scheduling are first-class citizens — not add-ons.',
  },
  {
    icon: '🧱',
    title: 'Production-Ready',
    body: 'A script is just the beginning. Crew management, shot lists, budgets, schedules, cue sheets — we carry the project from first draft through to wrap.',
  },
  {
    icon: '🌍',
    title: 'Independent & Community-Driven',
    body: 'We are not backed by a legacy studio or a Silicon Valley fund. Features are shaped by the writers, directors, and producers who actually use the platform daily.',
  },
  {
    icon: '🔒',
    title: 'Your Work, Your Data',
    body: 'No lock-in. Export to industry-standard formats (FDX, PDF, CSV) at any time. Your scripts belong to you, not to us.',
  },
];

const TIMELINE = [
  { year: '2023', label: 'Idea & first lines of code', detail: 'Frustration with expensive, fragmented tools led to a question: what would the ideal screenwriting suite look like if it were built today?' },
  { year: '2024', label: 'First public release', detail: 'Script editor, scene breakdown, shot list, and basic team tools shipped. Early users were film students and indie filmmakers.' },
  { year: '2025', label: 'Platform expansion', detail: 'Audio drama, stage play, TV production, and content creator formats added. Community, AI analysis, and casting tools launched.' },
  { year: '2026', label: 'Now', detail: 'Tens of thousands of projects. Open-source code base. Continual feature work driven by user feedback.' },
];

export default function AboutPage() {
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
            TOOLS FOR PEOPLE
            <br />
            <span style={{ color: ORANGE }}>WHO TELL STORIES.</span>
          </h1>
          <p className="text-base sm:text-lg text-white/45 max-w-2xl leading-relaxed">
            Screenplay Studio is an open-source production suite for writers, directors, and crews across every storytelling format — built because the existing tools are either too expensive, too limited, or too locked down.
          </p>
        </section>

        <Rule />

        {/* ── Why we built this ──────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-16">
          <Eyebrow>The Why</Eyebrow>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-5" style={{ letterSpacing: '-0.03em' }}>
                Professional tools should not be a luxury
              </h2>
              <div className="space-y-4 text-sm sm:text-base text-white/50 leading-relaxed">
                <p>
                  The standard path for a new screenwriter is to pay hundreds of dollars a year for a formatting app, buy separate subscriptions for scheduling, budgeting, and collaboration tools, and still end up emailing PDFs back and forth.
                </p>
                <p>
                  We built Screenplay Studio because that should not be the default. A student in Oslo writing their first short film deserves the same toolset as a production company in Los Angeles. Format should not determine access.
                </p>
                <p>
                  The platform is open-source. The code is on GitHub. Anyone can inspect it, contribute to it, or run their own instance. We believe transparency and community ownership produce better software than any closed product roadmap ever will.
                </p>
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

        {/* ── Principles ─────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-16">
          <Eyebrow>Principles</Eyebrow>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-10" style={{ letterSpacing: '-0.03em' }}>
            What we believe
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRINCIPLES.map(p => (
              <div
                key={p.title}
                className="rounded-xl p-5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span className="text-2xl mb-3 block">{p.icon}</span>
                <h3 className="text-sm font-black text-white mb-2 uppercase tracking-tight">{p.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{p.body}</p>
              </div>
            ))}
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
              {TIMELINE.map((t, i) => (
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
              'Deeper AI assistance — not autocomplete, but a script reader that actually understands story',
              'Mobile-first crew tools for on-set and on-stage use',
              'Offline-first writing mode so you never lose work',
              'Community script library and peer feedback tools',
              'Full internationalisation — multiple script languages and UI languages',
              'Richer open API for third-party integrations',
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

        {/* ── CTA ────────────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4" style={{ letterSpacing: '-0.04em' }}>
            Ready to write?
          </h2>
          <p className="text-sm text-white/40 mb-8">Free to start. No credit card.</p>
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
            <span className="text-xs text-white/20">Screenplay Studio — open-source &amp; free</span>
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
          <div className="flex items-center gap-5">
            <Link href="/blog" className="text-xs text-white/25 hover:text-white/50 transition-colors">Blog</Link>
            <Link href="/legal/privacy" className="text-xs text-white/25 hover:text-white/50 transition-colors">Privacy</Link>
            <Link href="/legal/terms" className="text-xs text-white/25 hover:text-white/50 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
