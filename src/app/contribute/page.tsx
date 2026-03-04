'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import ContributorsList from '@/components/ContributorsList';
import { useOpenSource } from '@/hooks/useSiteSettings';

const ORANGE = '#FF5F1F';

// ── Shared UI primitives (same as landing / about) ─────────
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

// ── Scroll-reveal hook ─────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ── Animated number counter ────────────────────────────────
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  const { ref, visible } = useReveal(0.3);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setValue(target); clearInterval(timer); }
      else setValue(start);
    }, 28);
    return () => clearInterval(timer);
  }, [visible, target]);
  return <span ref={ref}>{value}{suffix}</span>;
}

// ── Reveal wrapper ─────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(22px)',
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── Code block ─────────────────────────────────────────────
function Code({ children, label }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="group relative rounded-sm overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {label && (
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <Label>{label}</Label>
          <button
            onClick={copy}
            className="text-[9px] font-bold uppercase tracking-[0.15em] transition-colors duration-150"
            style={{ color: copied ? ORANGE : 'rgba(255,255,255,0.2)' }}
          >
            {copied ? 'COPIED ✓' : 'COPY'}
          </button>
        </div>
      )}
      <pre className="px-4 py-4 overflow-x-auto text-xs font-mono leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

// ── Data ───────────────────────────────────────────────────

const CONTRIBUTION_TYPES = [
  {
    tag: 'CODE',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Code',
    body: 'Fix bugs, ship features, refactor, improve performance. TypeScript / Next.js / React / Supabase stack.',
    good_first: true,
  },
  {
    tag: 'DESIGN',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    title: 'Design',
    body: 'UI/UX improvements, icon sets, accessibility audits, print layout polish, mobile responsiveness.',
    good_first: true,
  },
  {
    tag: 'DOCS',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Documentation',
    body: 'Write guides, how-to articles, API references, and setup documentation for new contributors.',
    good_first: true,
  },
  {
    tag: 'TESTING',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    title: 'Testing & QA',
    body: 'Write unit, integration, and end-to-end tests. Report bugs with clear reproduction steps.',
    good_first: false,
  },
  {
    tag: 'COMMUNITY',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Community',
    body: 'Answer questions in discussions, triage issues, help onboard new contributors, write tutorials.',
    good_first: true,
  },
  {
    tag: 'TRANSLATION',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
    title: 'Translations',
    body: 'Help bring Screenplay Studio to non-English speaking writers. Any language welcome.',
    good_first: true,
  },
];

const OPEN_ISSUES = [
  { label: 'Mobile Script Editor', priority: 'HIGH', type: 'CODE', desc: 'Touch-optimised screenplay editing for phones and tablets.' },
  { label: 'Dark Mode PDF Export', priority: 'HIGH', type: 'CODE', desc: 'Option to export scripts with a dark background for screen reading.' },
  { label: 'Keyboard Shortcut Map', priority: 'MED', type: 'DOCS', desc: 'Complete visual reference page for all editor keyboard shortcuts.' },
  { label: 'Accessibility Audit', priority: 'HIGH', type: 'DESIGN', desc: 'Full WCAG 2.1 AA audit and fixes across all major pages.' },
  { label: 'Unit Tests for Stores', priority: 'MED', type: 'TESTING', desc: 'Zustand store logic needs coverage — no prior test experience needed.' },
  { label: 'Norwegian Translation', priority: 'MED', type: 'TRANSLATION', desc: 'UI strings for Norwegian bokmål / nynorsk.' },
  { label: 'Offline Mode (PWA)', priority: 'HIGH', type: 'CODE', desc: 'Service worker caching so the script editor works without internet.' },
  { label: 'Component Storybook', priority: 'LOW', type: 'DOCS', desc: 'Document and isolate all UI components in a Storybook instance.' },
];

const RULES = [
  {
    n: '01',
    title: 'Be Respectful',
    body: 'This is a community of writers and technologists. Treat everyone — regardless of experience level, background, or contribution size — with respect. Criticism must be directed at code or ideas, never at people.',
  },
  {
    n: '02',
    title: 'One Thing Per PR',
    body: 'Keep pull requests focused. A PR that fixes one bug or adds one feature is infinitely easier to review than a sprawling change. If you want to do multiple things, open multiple PRs.',
  },
  {
    n: '03',
    title: 'Write Clear Commits',
    body: 'Use conventional commit format: feat:, fix:, docs:, refactor:, test:. A future contributor (or future you) should understand what changed from the commit message alone.',
  },
  {
    n: '04',
    title: 'Test your Changes',
    body: 'Run tsc --noEmit before opening a PR. If you add a new feature, add at least a basic test. If you fix a bug, add a regression test. Do not leave the build in a broken state.',
  },
  {
    n: '05',
    title: 'No Regressions',
    body: 'If your change breaks existing functionality, it will not be merged until fixed. Run the app locally and check that all existing features still work in both the film and content-creator project types.',
  },
  {
    n: '06',
    title: 'Discuss Big Changes First',
    body: 'Before spending a week on a major refactor or a new subsystem, open a GitHub Discussion or issue to get alignment. Nothing is worse than a great piece of work that goes in a direction nobody agreed on.',
  },
];

const PRIORITY_STYLE: Record<string, React.CSSProperties> = {
  HIGH: { color: ORANGE, background: `${ORANGE}18`, borderColor: `${ORANGE}30` },
  MED:  { color: '#a3e635', background: 'rgba(163,230,53,0.1)', borderColor: 'rgba(163,230,53,0.25)' },
  LOW:  { color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' },
};

const TYPE_STYLE: Record<string, React.CSSProperties> = {
  CODE:        { color: '#60a5fa', borderColor: 'rgba(96,165,250,0.25)' },
  DESIGN:      { color: '#e879f9', borderColor: 'rgba(232,121,249,0.25)' },
  DOCS:        { color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.12)' },
  TESTING:     { color: '#34d399', borderColor: 'rgba(52,211,153,0.25)' },
  TRANSLATION: { color: '#fbbf24', borderColor: 'rgba(251,191,36,0.25)' },
};

const STEPS = [
  {
    n: '01',
    title: 'Fork & Clone',
    body: 'Fork the repository on GitHub, then clone your fork locally.',
    code: `git clone https://github.com/YOUR_USERNAME/screenplay-studio.git
cd screenplay-studio`,
    codeLabel: 'TERMINAL',
  },
  {
    n: '02',
    title: 'Install Dependencies',
    body: 'Install Node.js dependencies and set up your local environment file.',
    code: `npm install
cp .env.example .env.local
# Fill in your Supabase URL and anon key`,
    codeLabel: 'TERMINAL',
  },
  {
    n: '03',
    title: 'Create a Branch',
    body: 'Branch off main with a descriptive name. Use the type prefix that matches your change.',
    code: `git checkout -b feat/mobile-editor
# or: fix/pdf-export-crash
# or: docs/keyboard-shortcuts`,
    codeLabel: 'TERMINAL',
  },
  {
    n: '04',
    title: 'Make Your Change',
    body: 'Write code. TypeScript strict mode is enforced — keep it clean.',
    code: `npm run dev       # start dev server (localhost:3000)
npx tsc --noEmit  # must pass before you push`,
    codeLabel: 'TERMINAL',
  },
  {
    n: '05',
    title: 'Commit with Convention',
    body: 'Use conventional commit messages so the changelog writes itself.',
    code: `git add .
git commit -m "feat: add mobile script editor with touch formatting"`,
    codeLabel: 'TERMINAL',
  },
  {
    n: '06',
    title: 'Open a Pull Request',
    body: 'Push to your fork and open a PR against main. Fill in the PR template — describe what changed and why. A maintainer will review within a few days.',
    code: `git push origin feat/mobile-editor
# Then visit github.com and click "Compare & Pull Request"`,
    codeLabel: 'TERMINAL',
  },
];

const MARQUEE_ITEMS = [
  'NEXT.JS 14', 'TYPESCRIPT', 'SUPABASE', 'TAILWIND CSS', 'REACT', 'OPEN SOURCE',
  'GOOD FIRST ISSUES', 'FILM & TV', 'PLAYWRIGHT', 'VERCEL', 'REALTIME',
  'NEXT.JS 14', 'TYPESCRIPT', 'SUPABASE', 'TAILWIND CSS', 'REACT', 'OPEN SOURCE',
  'GOOD FIRST ISSUES', 'FILM & TV', 'PLAYWRIGHT', 'VERCEL', 'REALTIME',
];

// ── Page ────────────────────────────────────────────────────
export default function ContributePage() {
  const { enabled: ossEnabled, loading: ossLoading } = useOpenSource();
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  // Hide page entirely when opensource mode is disabled
  if (!ossLoading && !ossEnabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ background: '#070710', color: '#fff' }}>
        <span className="text-6xl">🔒</span>
        <div className="text-center">
          <h1 className="text-2xl font-black text-white mb-2" style={{ letterSpacing: '-0.03em' }}>Coming soon</h1>
          <p className="text-sm text-white/40 max-w-sm">The open-source section of Screenplay Studio is not yet publicly available.</p>
        </div>
        <Link href="/" className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: '#FF5F1F' }}>
          Back to Home
        </Link>
      </div>
    );
  }

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

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="relative z-10 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-screen-lg mx-auto px-6 h-12 flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5">
            <div
              className="w-7 h-7 flex items-center justify-center text-[8px] font-black text-white shrink-0 transition-transform duration-150 group-hover:scale-95"
              style={{ background: ORANGE }}
            >
              SS
            </div>
            <span className="text-xs font-black text-white uppercase tracking-tight hidden sm:inline">Screenplay Studio</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/about" className="text-xs text-white/35 hover:text-white/70 transition-colors">About</Link>
            <Link href="/blog" className="text-xs text-white/35 hover:text-white/70 transition-colors">Blog</Link>
            <Link
              href="/dashboard"
              className="text-xs px-3 py-1.5 font-semibold text-white transition-all hover:opacity-90 hover:-translate-y-px"
              style={{ background: ORANGE }}
            >
              Open App
            </Link>
          </div>
        </div>
      </div>

      <main className="relative z-10">

        {/* ── HERO ──────────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 pt-20 pb-10 overflow-hidden">
          <Eyebrow>Open Source · Community · GitHub</Eyebrow>

          {/* Giant headline with staggered word reveal */}
          <h1
            className="font-black text-white"
            style={{
              fontSize: 'clamp(3.8rem, 13vw, 10rem)',
              letterSpacing: '-0.04em',
              lineHeight: 0.88,
            }}
          >
            <span
              style={{
                display: 'block',
                animation: 'fade-in-up 0.5s ease both',
                animationDelay: '0ms',
              }}
            >
              WANT TO
            </span>
            <span
              style={{
                display: 'block',
                color: ORANGE,
                animation: 'fade-in-up 0.5s ease both',
                animationDelay: '120ms',
              }}
            >
              CONTRIB-
            </span>
            <span
              style={{
                display: 'block',
                color: ORANGE,
                animation: 'fade-in-up 0.5s ease both',
                animationDelay: '240ms',
              }}
            >
              UTE?
            </span>
          </h1>

          {/* Coordinate styling + subtitle */}
          <div
            className="mt-10 grid md:grid-cols-2 gap-8 items-end pb-14 border-b"
            style={{
              borderColor: 'rgba(255,255,255,0.07)',
              animation: 'fade-in-up 0.55s ease both',
              animationDelay: '380ms',
            }}
          >
            <div>
              <p className="text-base sm:text-lg text-white/40 leading-relaxed max-w-md">
                Screenplay Studio is open-source. Its quality depends entirely on
                people who care enough to look at the code and make it better.
                That includes you.
              </p>
              <div className="flex items-center gap-3 mt-5">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: ORANGE }} />
                <Label>ACTIVELY ACCEPTING CONTRIBUTIONS</Label>
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-3">
              <a
                href="https://github.com/SondreWiger/screenplay-studio"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2.5 px-7 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-all duration-150 hover:-translate-y-0.5"
                style={{ background: ORANGE, boxShadow: `0 8px 40px ${ORANGE}28` }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                View on GitHub
                <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
              </a>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <span className="text-xl font-black text-white"><Counter target={42} />+</span>
                  <Label>OPEN ISSUES</Label>
                </div>
                <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="flex flex-col items-center">
                  <span className="text-xl font-black" style={{ color: ORANGE }}>∞</span>
                  <Label>GOOD FIRST</Label>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TICKER ──────────────────────────────────────────── */}
        <div className="overflow-hidden" style={{ background: ORANGE, height: '2.4rem' }}>
          <div className="flex items-center h-full">
            <div className="animate-marquee flex items-center shrink-0 whitespace-nowrap">
              {MARQUEE_ITEMS.map((t, i) => (
                <span
                  key={i}
                  className="text-[9px] font-black uppercase tracking-[0.22em] text-black/40 px-5"
                >
                  {t}<span className="ml-5 text-black/20">·</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <Rule />

        {/* ── WHAT WE NEED ────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-20">
          <Reveal>
            <Eyebrow>Ways To Contribute</Eyebrow>
            <div className="flex items-end justify-between mb-12">
              <h2
                className="font-black text-white"
                style={{ fontSize: 'clamp(2rem, 6vw, 5rem)', letterSpacing: '-0.04em', lineHeight: 0.92 }}
              >
                WHAT WE<br />
                <span style={{ color: ORANGE }}>NEED.</span>
              </h2>
              <div className="hidden md:flex flex-col items-end gap-1.5">
                <Label>6 categories</Label>
                <Label>All skill levels welcome</Label>
              </div>
            </div>
          </Reveal>

          {/* Cards grid with corner marks */}
          <div className="relative">
            <svg className="absolute -top-3 -left-3 w-5 h-5 pointer-events-none" style={{ color: 'rgba(255,255,255,0.12)' }} viewBox="0 0 20 20" fill="none">
              <path d="M6 1H1v5M14 1h5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <svg className="absolute -top-3 -right-3 rotate-90 w-5 h-5 pointer-events-none" style={{ color: 'rgba(255,255,255,0.12)' }} viewBox="0 0 20 20" fill="none">
              <path d="M6 1H1v5M14 1h5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <svg className="absolute -bottom-3 -left-3 -rotate-90 w-5 h-5 pointer-events-none" style={{ color: 'rgba(255,255,255,0.12)' }} viewBox="0 0 20 20" fill="none">
              <path d="M6 1H1v5M14 1h5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <svg className="absolute -bottom-3 -right-3 rotate-180 w-5 h-5 pointer-events-none" style={{ color: 'rgba(255,255,255,0.12)' }} viewBox="0 0 20 20" fill="none">
              <path d="M6 1H1v5M14 1h5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {CONTRIBUTION_TYPES.map((ct, i) => (
                <Reveal key={ct.tag} delay={i * 60}>
                  <div
                    className="group relative p-7 h-full transition-colors duration-200 hover:bg-white/[0.028] cursor-default"
                    style={{
                      borderRight: (i + 1) % 3 !== 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                      borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                    }}
                  >
                    {/* left accent on hover */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[2px] origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-300"
                      style={{ background: ORANGE }}
                    />

                    <div className="mb-4 text-white/30 group-hover:text-white/60 transition-colors duration-200">
                      {ct.icon}
                    </div>

                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3
                        className="text-[11px] font-black uppercase tracking-[0.1em] text-white/50 group-hover:text-white transition-colors duration-200"
                      >
                        {ct.title}
                      </h3>
                      {ct.good_first && (
                        <span
                          className="shrink-0 text-[8px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-sm"
                          style={{ background: `${ORANGE}20`, color: ORANGE, border: `1px solid ${ORANGE}30` }}
                        >
                          Good First
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/25 leading-relaxed group-hover:text-white/45 transition-colors duration-200">
                      {ct.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Rule />

        {/* ── HOW TO CONTRIBUTE ────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-20">
          <Reveal>
            <Eyebrow>Step By Step</Eyebrow>
            <h2
              className="font-black text-white mb-14"
              style={{ fontSize: 'clamp(2rem, 6vw, 5rem)', letterSpacing: '-0.04em', lineHeight: 0.92 }}
            >
              HOW TO<br />
              <span style={{ color: ORANGE }}>DO IT.</span>
            </h2>
          </Reveal>

          <div className="relative">
            {/* vertical timeline line */}
            <div
              className="absolute left-[1.65rem] top-0 bottom-0 w-px hidden md:block"
              style={{ background: 'linear-gradient(to bottom, rgba(255,95,31,0.5), rgba(255,95,31,0.03))' }}
            />

            <div className="space-y-10">
              {STEPS.map((step, i) => (
                <Reveal key={step.n} delay={i * 80}>
                  <div className="flex gap-6 md:gap-10 items-start">
                    {/* step number circle */}
                    <div
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black border-2 relative z-10"
                      style={{
                        background: '#070710',
                        borderColor: i === 0 ? ORANGE : 'rgba(255,255,255,0.12)',
                        color: i === 0 ? ORANGE : 'rgba(255,255,255,0.3)',
                        boxShadow: i === 0 ? `0 0 16px ${ORANGE}30` : 'none',
                      }}
                    >
                      {step.n}
                    </div>

                    <div className="flex-1 min-w-0 -mt-0.5">
                      <h3
                        className="text-sm font-black text-white uppercase tracking-tight mb-1"
                        style={{ letterSpacing: '-0.01em' }}
                      >
                        {step.title}
                      </h3>
                      <p className="text-xs text-white/40 leading-relaxed mb-4">{step.body}</p>
                      <Code label={step.codeLabel}>{step.code}</Code>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Rule />

        {/* ── OPEN ISSUES ─────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-20">
          <Reveal>
            <Eyebrow>Active Needs</Eyebrow>
            <div className="flex items-end justify-between mb-10">
              <h2
                className="font-black text-white"
                style={{ fontSize: 'clamp(2rem, 6vw, 5rem)', letterSpacing: '-0.04em', lineHeight: 0.92 }}
              >
                WHAT WE&apos;RE<br />
                <span style={{ color: ORANGE }}>WORKING ON.</span>
              </h2>
              <div className="hidden md:flex flex-col items-end gap-1">
                <Label>Curated from GitHub Issues</Label>
                <Label>Updated regularly</Label>
              </div>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OPEN_ISSUES.map((issue, i) => (
              <Reveal key={issue.label} delay={i * 50}>
                <div
                  className="group relative p-5 rounded-sm transition-all duration-200 hover:border-white/15 cursor-default overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* animated gradient sweep on hover */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse 60% 60% at 10% 50%, ${ORANGE}08, transparent)`,
                    }}
                  />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span
                        className="text-[8px] font-black uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-sm border"
                        style={PRIORITY_STYLE[issue.priority]}
                      >
                        {issue.priority}
                      </span>
                      <span
                        className="text-[8px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-sm border"
                        style={TYPE_STYLE[issue.type]}
                      >
                        {issue.type}
                      </span>
                    </div>
                    <p className="text-sm font-black text-white mb-1 group-hover:text-white transition-colors">{issue.label}</p>
                    <p className="text-[11px] text-white/35 leading-relaxed">{issue.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={400}>
            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-8 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <p className="text-xs text-white/30 leading-relaxed max-w-sm">
                For the full list with discussion threads, labels, and assignees, head to the GitHub Issues tab.
              </p>
              <a
                href="https://github.com/SondreWiger/screenplay-studio/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="group shrink-0 inline-flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-all duration-150 hover:-translate-y-px border border-white/10 hover:border-white/20"
              >
                All GitHub Issues
                <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
              </a>
            </div>
          </Reveal>
        </section>

        <Rule />

        {/* ── RULES ───────────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-20">
          <Reveal>
            <Eyebrow>Contribution Rules · Code of Conduct</Eyebrow>
            <h2
              className="font-black text-white mb-12"
              style={{ fontSize: 'clamp(2rem, 6vw, 5rem)', letterSpacing: '-0.04em', lineHeight: 0.92 }}
            >
              THE<br />
              <span style={{ color: ORANGE }}>RULES.</span>
            </h2>
          </Reveal>

          <div className="space-y-1">
            {RULES.map((rule, i) => {
              const open = expandedRule === rule.n;
              return (
                <Reveal key={rule.n} delay={i * 40}>
                  <div
                    className="overflow-hidden transition-colors duration-150"
                    style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '2px' }}
                  >
                    <button
                      onClick={() => setExpandedRule(open ? null : rule.n)}
                      className="w-full flex items-center gap-5 px-6 py-5 text-left group hover:bg-white/[0.025] transition-colors duration-150"
                    >
                      <span
                        className="text-[10px] font-black font-mono shrink-0 transition-colors duration-150"
                        style={{ color: open ? ORANGE : 'rgba(255,255,255,0.2)' }}
                      >
                        {rule.n}
                      </span>
                      <span
                        className="flex-1 text-xs font-black uppercase tracking-[0.1em] transition-colors duration-150"
                        style={{ color: open ? '#fff' : 'rgba(255,255,255,0.45)' }}
                      >
                        {rule.title}
                      </span>
                      {/* animated chevron */}
                      <svg
                        className="w-4 h-4 shrink-0 transition-transform duration-300"
                        style={{ color: `rgba(255,255,255,0.25)`, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* expand panel */}
                    <div
                      style={{
                        maxHeight: open ? '200px' : '0px',
                        overflow: 'hidden',
                        transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
                      }}
                    >
                      <div
                        className="px-6 pb-6 pt-1 text-sm text-white/40 leading-relaxed border-t"
                        style={{ borderColor: 'rgba(255,255,255,0.05)', marginLeft: '3.25rem' }}
                      >
                        {rule.body}
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        <Rule />

        {/* ── RECOGNITION ─────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-20">
          <Reveal>
            <Eyebrow>Recognition · Credits</Eyebrow>
            <h2
              className="font-black text-white mb-5"
              style={{ fontSize: 'clamp(2rem, 6vw, 5rem)', letterSpacing: '-0.04em', lineHeight: 0.92 }}
            >
              YOUR NAME<br />
              <span style={{ color: ORANGE }}>IN THE BUILD.</span>
            </h2>
            <p className="text-sm text-white/40 max-w-2xl leading-relaxed mb-12">
              Every contributor is credited. Your GitHub handle appears in the automatic changelog, the CONTRIBUTORS.md file, and the in-app credits page as soon as your first PR is merged.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: '⭐',
                title: 'GitHub Credits',
                body: 'Every merged PR gets you listed in CONTRIBUTORS.md and the release notes. Automatically.',
              },
              {
                icon: '🏷️',
                title: 'In-App Credits',
                body: 'The /about page inside the app lists all contributors by name with links to their profiles.',
              },
              {
                icon: '🔶',
                title: 'Maintainer Status',
                body: 'Consistent contributors may be offered maintainer access — triaging issues, reviewing PRs, shaping the roadmap.',
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 80}>
                <div
                  className="group p-6 rounded-sm transition-all duration-200 hover:border-white/15"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <span className="text-3xl mb-4 block">{item.icon}</span>
                  <h3 className="text-xs font-black text-white uppercase tracking-tight mb-2">{item.title}</h3>
                  <p className="text-xs text-white/35 leading-relaxed">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <Rule />

        {/* ── CURRENT CONTRIBUTORS ────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-20">
          <Reveal>
            <Eyebrow>People · Credits</Eyebrow>
            <h2
              className="font-black text-white mb-4"
              style={{ fontSize: 'clamp(1.8rem, 5vw, 4rem)', letterSpacing: '-0.04em', lineHeight: 0.95 }}
            >
              CURRENT<br />
              <span style={{ color: ORANGE }}>CONTRIBUTORS.</span>
            </h2>
            <p className="text-sm text-white/40 max-w-xl leading-relaxed mb-10">
              Everyone who has contributed to the platform in any form. Get your name on this list by opening a pull request or helping the community.
            </p>
          </Reveal>
          <ContributorsList />
        </section>

        <Rule />

        {/* ── STACK ───────────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-20">
          <Reveal>
            <Eyebrow>Tech Stack · Prerequisites</Eyebrow>
            <h2
              className="font-black text-white mb-10"
              style={{ fontSize: 'clamp(1.8rem, 5vw, 4rem)', letterSpacing: '-0.04em', lineHeight: 0.95 }}
            >
              WHAT WE&apos;RE<br />BUILT WITH.
            </h2>
          </Reveal>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {[
              { name: 'Next.js 14', note: 'App Router' },
              { name: 'TypeScript', note: 'Strict mode' },
              { name: 'Supabase', note: 'Postgres + Auth + Realtime' },
              { name: 'Tailwind CSS', note: 'v3' },
              { name: 'Zustand', note: 'Global state' },
              { name: 'Vercel', note: 'Deployment' },
              { name: 'React 18', note: 'Server + Client' },
              { name: 'Sonner', note: 'Toast notifications' },
            ].map((t, i) => (
              <Reveal key={t.name} delay={i * 30}>
                <div
                  className="group p-4 rounded-sm transition-all duration-200 hover:bg-white/[0.04] cursor-default"
                  style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <p className="text-xs font-black text-white/70 group-hover:text-white transition-colors mb-0.5">{t.name}</p>
                  <p className="text-[10px] text-white/25">{t.note}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <Rule />

        {/* ── CTA ─────────────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 py-20">
          <Reveal>
            <div
              className="relative overflow-hidden"
              style={{ background: ORANGE }}
            >
              {/* dot grid overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  opacity: 0.06,
                  backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
                  backgroundSize: '14px 14px',
                }}
              />
              {/* animated scan line */}
              <div
                className="absolute inset-x-0 h-px pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
                  animation: 'scanline 4s linear infinite',
                  top: '50%',
                }}
              />

              {/* corner marks */}
              <svg className="absolute top-4 left-4 w-5 h-5 opacity-20 pointer-events-none" viewBox="0 0 20 20" fill="none">
                <path d="M6 1H1v5M14 1h5v5" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <svg className="absolute bottom-4 right-4 w-5 h-5 opacity-20 pointer-events-none rotate-180" viewBox="0 0 20 20" fill="none">
                <path d="M6 1H1v5M14 1h5v5" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
              </svg>

              <div className="relative z-10 p-12 md:p-20 flex flex-col md:flex-row items-start md:items-end justify-between gap-12">
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-4 h-px bg-black/25" />
                    <span className="text-[9px] font-black uppercase tracking-[0.28em] text-black/35">Ready · Start Now</span>
                  </div>
                  <h2
                    className="font-black text-black"
                    style={{ fontSize: 'clamp(3rem, 9vw, 7rem)', letterSpacing: '-0.04em', lineHeight: 0.88 }}
                  >
                    OPEN A<br />PULL<br />REQUEST.
                  </h2>
                </div>
                <div className="shrink-0 flex flex-col items-start md:items-end gap-4">
                  <a
                    href="https://github.com/SondreWiger/screenplay-studio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2.5 px-10 py-5 text-[10px] font-black uppercase tracking-[0.16em] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-2xl"
                    style={{ background: '#000', color: '#fff' }}
                  >
                    Fork on GitHub
                    <span className="transition-transform duration-150 group-hover:translate-x-1">→</span>
                  </a>
                  <a
                    href="https://github.com/SondreWiger/screenplay-studio/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-black/50 hover:text-black transition-colors"
                  >
                    Browse Good First Issues
                    <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
                  </a>
                  <span className="text-[9px] font-mono text-black/30 tracking-wider">
                    ALL SKILL LEVELS · ALL TIMEZONES
                  </span>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

      </main>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-screen-lg mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 flex items-center justify-center shrink-0" style={{ background: ORANGE }}>
              <span className="font-black text-white text-[10px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-xs text-white/20">Screenplay Studio — open-source &amp; free forever</span>
          </div>
          <div className="flex items-center gap-5 flex-wrap">
            <Link href="/about" className="text-xs text-white/25 hover:text-white/50 transition-colors">About</Link>
            <Link href="/blog" className="text-xs text-white/25 hover:text-white/50 transition-colors">Blog</Link>
            <Link href="/legal/privacy" className="text-xs text-white/25 hover:text-white/50 transition-colors">Privacy</Link>
            <a
              href="https://github.com/SondreWiger/screenplay-studio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/25 hover:text-white/50 transition-colors"
            >
              GitHub
            </a>
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

      {/* ── Inline keyframes for scanline ─────────────────────── */}
      <style>{`
        @keyframes scanline {
          0%   { top: -2px; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% + 2px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
