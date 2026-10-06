import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteVersion } from '@/components/SiteVersion';
import { ArrowRight, CalendarDays, Clapperboard, FileDown, LayoutGrid, PenLine, Users } from 'lucide-react';
import { HeroLines, Reveal, RevealGroup, RevealItem } from '@/components/landing/motion';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

export const metadata: Metadata = {
  title: 'Screenplay Studio — Write, plan, and collaborate on screenplays',
  description: 'Free screenwriting software with a professional script editor, scene breakdowns, shot lists, scheduling tools, and real-time collaboration. Write your next film or TV script.',
  openGraph: {
    type: 'website',
    siteName: 'Screenplay Studio',
    title: 'Screenplay Studio — Free screenwriting software',
    description: 'Write screenplays, plan productions, and collaborate with your team. Script editor, scene breakdowns, shot lists, scheduling, budget tracking, and more.',
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/api/og?title=${encodeURIComponent('Screenplay Studio')}&subtitle=${encodeURIComponent('Write, plan, and collaborate on screenplays')}`,
        width: 1200,
        height: 630,
        alt: 'Screenplay Studio — Free screenwriting software',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Screenplay Studio — Free screenwriting software',
    description: 'Write screenplays, plan productions, and collaborate with your team. Script editor, scene breakdowns, shot lists, scheduling, budget tracking, and more.',
    images: [`${SITE_URL}/api/og?title=${encodeURIComponent('Screenplay Studio')}&subtitle=${encodeURIComponent('Write, plan, and collaborate on screenplays')}`],
  },
};

/* ════════════════════════════════════════════════════════════
   MICRO-COMPONENTS
   ════════════════════════════════════════════════════════════ */

function Mono({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[11px] uppercase tracking-[0.04em] ${className}`}>{children}</span>;
}

function Cross({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-3 h-3 ${className}`} viewBox="0 0 12 12" fill="none">
      <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="0.5" />
      <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  );
}

function GridLine({ orientation = 'h', className = '' }: { orientation?: 'h' | 'v'; className?: string }) {
  if (orientation === 'h') {
    return <div className={`w-full h-px bg-white/[0.04] ${className}`} />;
  }
  return <div className={`h-full w-px bg-white/[0.04] ${className}`} />;
}

function FeatureCard({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 transition-colors duration-300 hover:border-white/[0.14] md:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" style={{ background: 'rgb(var(--brand-500) / 0.12)' }} />
      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]" style={{ color: 'rgb(var(--brand-500))' }}>
        {icon}
      </span>
      <h3 className="relative mt-5 text-base font-semibold text-white">{title}</h3>
      <p className="relative mt-1.5 text-[13px] leading-relaxed text-white/45">{body}</p>
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TESTIMONIALS (server component)
   ════════════════════════════════════════════════════════════ */

async function TestimonialsRow() {
  const supabase = createServerSupabaseClient();
  const { data: recent } = await supabase
    .from('public_testimonials')
    .select('id,title,body,rating,display_name,created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  // The landing page is the first impression: show substantive reviews, best
  // rated first, and hide the row rather than show one-liners. Everything is
  // still on /testimonials.
  const testimonials = (recent || [])
    .filter((t: { body: string | null }) => (t.body || '').trim().length >= 80)
    .sort((a: { rating: number | null }, b: { rating: number | null }) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 4);

  if (testimonials.length < 2) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.04]">
      {testimonials.map((t: { id: string; title: string; body: string; rating: number | null; display_name: string | null; created_at: string }) => (
        <div
          key={t.id}
          className="bg-[rgb(var(--surface-950))] p-8 md:p-10 group hover:bg-white/[0.015] transition-colors duration-500"
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-8 h-8 flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ background: 'rgb(var(--brand-500))' }}
            >
              {(t.display_name ?? 'A')[0].toUpperCase()}
            </div>
            <div>
              <Mono className="text-white/45 block">{t.display_name ?? 'Anonymous'}</Mono>
              {t.rating && (
                <div className="text-[11px] mt-0.5" style={{ color: 'rgb(var(--brand-500))' }}>
                  {'●'.repeat(t.rating)}{'○'.repeat(5 - t.rating)}
                </div>
              )}
            </div>
          </div>
          <p className="text-[13px] text-white/50 leading-[2] group-hover:text-white/60 transition-colors duration-500">
            &ldquo;{t.body}&rdquo;
          </p>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */

export default async function LandingPage() {
  const cookieStore = cookies();

  const userAgent = headers().get('user-agent') || '';
  const isElectron = userAgent.includes('Electron');

  if (isElectron) {
    const onboardingCompleted = cookieStore.get('ss-onboarding-completed')?.value === '1';
    if (!onboardingCompleted) redirect('/desktop-onboarding');
    const authChoice = cookieStore.get('ss-auth-choice')?.value;
    if (authChoice === 'local') redirect('/dashboard');
    redirect('/dashboard');
  }

  if (cookieStore.get('ss-local-mode')?.value === '1') redirect('/dashboard');

  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  const tools = [
    { n: '01', name: 'Script Editor', sub: 'Courier Prime · auto-format' },
    { n: '02', name: 'Collaboration', sub: 'Real-time · multiplayer' },
    { n: '03', name: 'Character Bible', sub: 'Arc · voice · casting' },
    { n: '04', name: 'Scene Breakdown', sub: 'Props · costume · VFX' },
    { n: '05', name: 'Shot List', sub: 'Lens · movement · storyboard' },
    { n: '06', name: 'Corkboard', sub: 'Cards · drag · colour' },
    { n: '07', name: 'Arc Planner', sub: 'Threads · structure · beats' },
    { n: '08', name: 'Beat Sheet', sub: 'Save the Cat · Syd Field' },
    { n: '09', name: 'Schedule', sub: 'Days · calls · locations' },
    { n: '10', name: 'Budget', sub: 'Estimate · actual · vendors' },
    { n: '11', name: 'Submissions', sub: 'Festivals · agents · status' },
    { n: '12', name: 'Team Roles', sub: 'Producer · writer · viewer' },
    { n: '13', name: 'Theme Editor', sub: 'Colours · fonts · yours' },
  ];

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ backgroundColor: 'rgb(var(--surface-950))', color: '#fff' }}>

      {/* ─── GRAIN TEXTURE OVERLAY ────────────────────────── */}
      <div
        className="fixed inset-0 pointer-events-none z-[1]"
        style={{
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />

      {/* ─── VERTICAL GRID LINES (structural decoration) ──── */}
      <div className="fixed inset-0 pointer-events-none z-0 hidden lg:flex justify-between max-w-screen-xl mx-auto px-8">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-px h-full bg-white/[0.025]" />
        ))}
      </div>

      {/* ═══════════════════ SYSTEM BAR ═══════════════════ */}
      <div className="relative z-10 border-b border-white/[0.04]">
        <div className="max-w-screen-xl mx-auto px-6 md:px-8 h-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: 'rgb(var(--brand-500))' }} />
            <Mono className="text-white/20">Screenplay Studio</Mono>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <Mono className="text-white/15">59°54′N 10°44′E</Mono>
            <Mono className="text-white/15">Oslo, Norway</Mono>
            <SiteVersion />
          </div>
        </div>
      </div>

      {/* ═══════════════════ NAVIGATION ═══════════════════ */}
      <nav className="sticky top-0 z-30 border-b border-white/[0.06] bg-surface-950/75 backdrop-blur-xl">
        <div className="max-w-screen-xl mx-auto px-6 md:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-3">
            <div
              className="w-8 h-8 flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
              style={{ background: 'rgb(var(--brand-500))' }}
            >
              SS
            </div>
            <div className="leading-none hidden sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Screenplay</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'rgb(var(--brand-500))' }}>Studio</p>
            </div>
          </Link>

          <div className="flex items-center">
            {[['About', '/about'], ['Tools', '/tools'], ['Blog', '/blog'], ['Community', '/community']].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="hidden md:inline-block px-4 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-white/55 hover:text-white/70 transition-colors duration-300"
              >
                {label}
              </Link>
            ))}

            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="ml-3 inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-white transition-all duration-200 hover:-translate-y-px"
                style={{ background: 'rgb(var(--brand-500))' }}
              >
                Dashboard <span>→</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="hidden md:inline-block px-4 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-white/55 hover:text-white/70 transition-colors duration-300"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  className="ml-2 inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-white transition-all duration-200 hover:-translate-y-px"
                  style={{ background: 'rgb(var(--brand-500))' }}
                >
                  Start Free <span>→</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10">

        {/* ═══════════════════ HERO ═══════════════════════ */}
        <section className="relative max-w-screen-xl mx-auto px-6 md:px-8 pt-16 md:pt-24 pb-0">

          {/* Crosshair decoration */}
          <Cross className="absolute top-12 right-8 text-white/10 hidden md:block" />
          <Cross className="absolute top-40 left-[42%] text-white/10 hidden lg:block" />

          {/* What this is, in one line */}
          <Reveal className="mb-8">
            <Link href="/changelog" className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 text-[11px] text-white/60 transition-colors hover:border-white/20 hover:text-white">
              <span className="rounded-full px-2 py-0.5 font-semibold text-white" style={{ background: 'rgb(var(--brand-500))' }}>Free</span>
              Screenwriting &amp; production, in one place
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>

          {/* SEO-invisible H1 */}
          <h1 className="sr-only">Free Professional Screenwriting Software and Production Suite</h1>

          {/* ── MASSIVE DISPLAY TYPE ── */}
          <div className="relative" aria-hidden="true">
            {/* Background number watermark */}
            <div
              className="absolute -top-10 -right-4 text-[20rem] font-semibold leading-none pointer-events-none select-none hidden lg:block"
              style={{ color: 'rgba(255,255,255,0.015)' }}
            >
              SS
            </div>

            <div
              className="select-none relative"
              style={{
                fontSize: 'clamp(3rem, 13.5vw, 14rem)',
                fontWeight: 900,
                lineHeight: 0.85,
                letterSpacing: '-0.045em',
              }}
            >
              <HeroLines
                lines={[
                  { text: 'WRITE.', className: 'text-white' },
                  { text: 'PLAN.', className: 'text-white/20' },
                  { text: 'PRODUCE.', style: { color: 'rgb(var(--brand-500))' } },
                ]}
              />
            </div>

            {/* Side annotation column */}
            <div className="absolute right-0 top-4 hidden xl:flex flex-col items-end gap-2 max-w-[180px]">
              <Mono className="text-white/20 text-right leading-relaxed">
                Free screenwriting<br />
                software<br />
                and production suite
              </Mono>
              <div className="w-12 h-px mt-2" style={{ background: 'rgb(var(--brand-500))', opacity: 0.4 }} />
              <Mono className="text-white/10">2024 — Present</Mono>
            </div>
          </div>

          {/* ── SUB-HEADLINE + CTA ── */}
          <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 pb-16 border-b border-white/[0.04]">
            <div className="md:col-span-5">
              <p className="text-[14px] text-white/50 leading-[2] font-light">
                Professional screenplay editor with automatic formatting. Scene breakdowns, shot lists, scheduling, budget tracking, 
                and real-time collaboration — every tool in one place, free. Pro and Studio when your production needs more.
              </p>
            </div>
            <div className="md:col-span-3 flex flex-col gap-3">
              <Mono className="text-white/15 mb-1">Includes</Mono>
              {['Script Editor', 'Shot Lists', 'Corkboard', 'Beat Sheet', 'Team Access', 'AI Analysis'].map(t => (
                <div key={t} className="flex items-center gap-2">
                  <div className="w-1 h-1 shrink-0" style={{ background: 'rgb(var(--brand-500))' }} />
                  <span className="text-[11px] text-white/45 font-medium">{t}</span>
                </div>
              ))}
            </div>
            <div className="md:col-span-4 flex flex-col items-start md:items-end justify-end gap-3">
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Link
                  href={isLoggedIn ? '/dashboard' : '/auth/register'}
                  className="group inline-flex items-center gap-3 rounded-xl px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.04em] text-white shadow-2xl shadow-brand-600/30 transition-all duration-200 hover:-translate-y-0.5"
                  style={{ background: 'rgb(var(--brand-500))' }}
                >
                  {isLoggedIn ? 'Open Dashboard' : 'Start Writing — Free'}
                  <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                </Link>
                <Link
                  href="/tools"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.04em] text-white/60 transition-colors hover:border-white/25 hover:text-white"
                >
                  Explore tools
                </Link>
              </div>
              <Mono className="text-white/45">Free forever · No credit card</Mono>
            </div>
          </div>

          {/* The product itself */}
          <div className="py-16 md:py-20">
            <ProductPreview />
          </div>
        </section>

        {/* ═══════════════════ THE PHILOSOPHY / REASONING ═════════════ */}
        <section className="relative w-full max-w-screen-xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <div className="relative w-full">
            {/* Corner brackets */}
            <div className="absolute -top-3 -left-3 w-6 h-6 border-l border-t border-white/10" />
            <div className="absolute -top-3 -right-3 w-6 h-6 border-r border-t border-white/10" />
            <div className="absolute -bottom-3 -left-3 w-6 h-6 border-l border-b border-white/10" />
            <div className="absolute -bottom-3 -right-3 w-6 h-6 border-r border-b border-white/10" />

            <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-8 p-8 md:p-12 bg-white/[0.01]">
              <div className="md:col-span-4">
                <div className="flex items-center gap-3 mb-4">
                  <Mono className="text-white/20">01.0</Mono>
                  <div className="w-6 h-px bg-white/10" />
                  <Mono className="text-white/45">STATEMENT</Mono>
                </div>
                <h3 className="text-lg font-semibold uppercase tracking-[0.04em] text-white">
                  WHY WE BUILT THIS.
                </h3>
              </div>
              <div className="md:col-span-8 flex flex-col gap-6">
                <p className="text-[13px] text-white/50 leading-[2.2] font-light">
                  Most modern screenwriting software locks your words behind restrictive paywalls, recurring monthly subscriptions, 
                  or proprietary file formats. We believe the tools to tell stories should be universally accessible. Screenplay Studio 
                  was built from a simple premise: a writer needs focus, collaborative speed, and absolute ownership of their files.
                </p>
                <p className="text-[13px] text-white/50 leading-[2.2] font-light">
                  The whole writing and production toolkit is free, and will stay free: no limits on projects or scripts, every
                  export format, version history, sharing and collaboration included. Pro adds storage and our sister apps; Studio
                  adds a production-office suite for large shoots. You focus on the page; paying is for when you need more.
                </p>
                <div className="flex items-center gap-6 mt-2 font-mono text-[11px] text-white/20">
                  <span>NO EXPORT LOCKS</span>
                  <span>NO PROJECT LIMITS</span>
                  <span>YOUR FILES, YOUR FORMATS</span>
                </div>
              </div>
            </div>

            {/* Annotations */}
            <div className="flex justify-between mt-3">
              <Mono className="text-white/10">fig. 01 — Philosophy slice</Mono>
              <Mono className="text-white/10">Northem Development · Manifesto</Mono>
            </div>
          </div>
        </section>

        <GridLine />

        {/* ═══════════════════ STATS ROW ══════════════════ */}
        <section className="max-w-screen-xl mx-auto px-6 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { num: 'Free', label: 'Forever', sub: 'The whole core product' },
              { num: '80+', label: 'Tools', sub: 'Script to wrap' },
              { num: '7', label: 'Formats', sub: 'Film · TV · Audio · Stage' },
              { num: '2024', label: 'Since', sub: 'Actively maintained' },
            ].map((s, i) => (
              <div
                key={s.label}
                className="py-10 md:py-14 px-4 md:px-8 border-b border-white/[0.04] group cursor-default hover:bg-white/[0.01] transition-colors duration-500"
                style={{
                  borderRight: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <span
                  className="block font-semibold tracking-tight text-white leading-none mb-2"
                  style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
                >
                  {s.num}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] block mb-1" style={{ color: 'rgb(var(--brand-500))' }}>
                  {s.label}
                </span>
                <span className="text-[11px] text-white/15">{s.sub}</span>
              </div>
            ))}
          </div>
        </section>


        {/* ═══════════════════ FEATURES ═══════════════════ */}
        <section className="max-w-screen-xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <Reveal>
            <div className="flex items-center gap-4 mb-4">
              <Mono className="text-white/15">002</Mono>
              <div className="w-8 h-px bg-white/10" />
              <Mono className="text-white/15">Features</Mono>
            </div>
            <h2
              className="mb-12 max-w-3xl font-semibold text-white"
              style={{ fontSize: 'clamp(2.25rem, 5.5vw, 4.5rem)', letterSpacing: '-0.04em', lineHeight: 0.92 }}
            >
              ONE PROJECT. <span className="text-white/45">EVERY DEPARTMENT.</span>
            </h2>
          </Reveal>

          <RevealGroup className="grid gap-3 md:grid-cols-3">
            <RevealItem className="md:col-span-2">
              <FeatureCard
                icon={<PenLine className="h-5 w-5" />}
                title="A script editor that formats for you"
                body="Tab between scene headings, action, character and dialogue. Industry formatting as you type, revision colours, title pages, and a focus mode for the long nights."
              >
                <div className="mt-6 flex flex-wrap gap-1.5">
                  {['Scene heading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Transition'].map((el, i) => (
                    <span key={el} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-white/50">
                      <span className="mr-1.5 text-white/45">{i === 0 ? '↵' : 'Tab'}</span>{el}
                    </span>
                  ))}
                </div>
              </FeatureCard>
            </RevealItem>
            <RevealItem>
              <FeatureCard
                icon={<Users className="h-5 w-5" />}
                title="Write together, live"
                body="Everyone in the same draft at once — see who is where, leave inline comments, and stop emailing PDFs back and forth."
              />
            </RevealItem>
            <RevealItem>
              <FeatureCard
                icon={<Clapperboard className="h-5 w-5" />}
                title="Breakdowns & shot lists"
                body="Tag cast, props and locations straight from the page, then turn every scene into shots with lens, movement and storyboard frames."
              />
            </RevealItem>
            <RevealItem>
              <FeatureCard
                icon={<CalendarDays className="h-5 w-5" />}
                title="Schedule & budget"
                body="Shooting days, locations and calls on one calendar, with estimates and actuals tracked line by line."
              />
            </RevealItem>
            <RevealItem>
              <FeatureCard
                icon={<LayoutGrid className="h-5 w-5" />}
                title="Corkboard & beat sheets"
                body="Shuffle index cards, plan arcs, and check your structure against Save the Cat, Syd Field — or your own."
              />
            </RevealItem>
            <RevealItem className="md:col-span-3">
              <div className="flex flex-col gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 transition-colors hover:border-white/[0.14] md:flex-row md:items-center md:justify-between md:p-8">
                <div className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]" style={{ color: 'rgb(var(--brand-500))' }}>
                    <FileDown className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-white">Your files, your formats</h3>
                    <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-white/45">Import an existing script and keep going. Export to every format, free — no lock-in.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['FDX', 'PDF', 'Fountain', 'DOCX', 'HTML'].map((f) => (
                    <span key={f} className="rounded-lg border border-white/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-white/70">.{f.toLowerCase()}</span>
                  ))}
                </div>
              </div>
            </RevealItem>
          </RevealGroup>
        </section>

        <GridLine />

        {/* ═══════════════════ WORKFLOW ═══════════════════ */}
        <section className="max-w-screen-xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <Reveal className="mb-12 grid gap-6 md:grid-cols-12">
            <div className="md:col-span-7">
              <div className="flex items-center gap-4 mb-4">
                <Mono className="text-white/15">003</Mono>
                <div className="w-8 h-px bg-white/10" />
                <Mono className="text-white/15">Workflow</Mono>
              </div>
              <h2 className="font-semibold text-white" style={{ fontSize: 'clamp(2.25rem, 5.5vw, 4.5rem)', letterSpacing: '-0.04em', lineHeight: 0.92 }}>
                FIRST DRAFT<br />TO <span style={{ color: 'rgb(var(--brand-500))' }}>FINAL WRAP.</span>
              </h2>
            </div>
            <p className="self-end text-[13px] leading-[2] text-white/50 md:col-span-5">
              The script is the source of truth. Change a scene and the breakdown, shot list and schedule built on it are right there with it.
            </p>
          </Reveal>
          <RevealGroup className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-4" stagger={0.12}>
            <div className="pointer-events-none absolute left-0 right-0 top-[2.15rem] hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent lg:block" />
            {[
              { n: '01', t: 'Write', d: 'Draft in a proper screenplay editor, alone or with your co-writers.' },
              { n: '02', t: 'Break down', d: 'Tag what every scene needs: cast, props, wardrobe, locations, VFX.' },
              { n: '03', t: 'Plan', d: 'Build shot lists, a shooting schedule and a budget from the breakdown.' },
              { n: '04', t: 'Shoot & wrap', d: 'Call sheets, day-of changes and a team that sees the same plan.' },
            ].map((step) => (
              <RevealItem key={step.n}>
                <div className="relative h-full rounded-2xl border border-white/[0.07] bg-surface-950 p-6 transition-colors hover:border-white/[0.14]">
                  <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-surface-950 font-mono text-[11px] font-bold" style={{ color: 'rgb(var(--brand-500))' }}>
                    {step.n}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-white">{step.t}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">{step.d}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        <GridLine />

        {/* ═══════════════════ TESTIMONIALS ═══════════════ */}
        <section className="max-w-screen-xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <div className="flex items-center gap-4 mb-4">
            <Mono className="text-white/15">004</Mono>
            <div className="w-8 h-px bg-white/10" />
            <Mono className="text-white/15">Voices</Mono>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
            <div className="md:col-span-8">
              <h2
                className="font-semibold text-white"
                style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', letterSpacing: '-0.04em', lineHeight: 0.9 }}
              >
                WHAT<br />
                <span style={{ color: 'rgb(var(--brand-500))' }}>WRITERS</span><br />
                ARE SAYING.
              </h2>
            </div>
            <div className="md:col-span-4 flex items-end">
              <Link
                href="/testimonials"
                className="text-[11px] font-medium uppercase tracking-[0.04em] text-white/55 hover:text-white/60 transition-colors duration-300 border-b border-white/10 pb-0.5"
              >
                See all reviews →
              </Link>
            </div>
          </div>

          <TestimonialsRow />
        </section>

        <GridLine />

        {/* ═══════════════════ TOOL MAP ═══════════════════ */}
        <section className="max-w-screen-xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <div className="flex items-center gap-4 mb-4">
            <Mono className="text-white/15">005</Mono>
            <div className="w-8 h-px bg-white/10" />
            <Mono className="text-white/15">Stack</Mono>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-16">
            <div className="lg:col-span-7">
              <h2
                className="font-semibold text-white"
                style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', letterSpacing: '-0.04em', lineHeight: 0.9 }}
              >
                THE FULL<br />
                PRODUCTION<br />
                <span style={{ color: 'rgb(var(--brand-500))' }}>STACK.</span>
              </h2>
            </div>
            <div className="lg:col-span-5 flex flex-col justify-end gap-4">
              <p className="text-[13px] text-white/50 leading-[2]">
                Thirteen of the tools that cover every stage of film production — from first draft to final wrap.
                No switching between apps. No exporting between tools. Everything lives in one place.
              </p>
              <Mono className="text-white/10">Highlights · Oslo · 2026</Mono>
            </div>
          </div>

          {/* Tool Grid — editorial data-vis style */}
          <div className="border-t border-white/[0.04]">
            {tools.map((tool, i) => (
              <div
                key={tool.n}
                className="grid grid-cols-12 items-center border-b border-white/[0.04] group cursor-default hover:bg-white/[0.015] transition-colors duration-400"
              >
                {/* Number */}
                <div className="col-span-2 md:col-span-1 py-5 px-4">
                  <span className="font-mono text-[11px] font-bold group-hover:opacity-100 opacity-30 transition-opacity duration-300" style={{ color: 'rgb(var(--brand-500))' }}>
                    {tool.n}
                  </span>
                </div>

                {/* Vertical divider */}
                <div className="col-span-0 hidden md:block w-px h-full bg-white/[0.04]" />

                {/* Name */}
                <div className="col-span-6 md:col-span-5 py-5 px-4">
                  <span className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.1em] text-white/50 group-hover:text-white transition-colors duration-300">
                    {tool.name}
                  </span>
                </div>

                {/* Sub */}
                <div className="col-span-4 md:col-span-5 py-5 px-4 text-right md:text-left">
                  <span className="text-[11px] text-white/15 font-mono group-hover:text-white/45 transition-colors duration-300">
                    {tool.sub}
                  </span>
                </div>

                {/* Arrow indicator */}
                <div className="col-span-0 hidden md:flex col-span-1 justify-end py-5 px-4">
                  <span className="opacity-0 group-hover:opacity-40 transition-opacity duration-300 text-xs" style={{ color: 'rgb(var(--brand-500))' }}>
                    →
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Tag cloud under tools */}
          <div className="mt-8 flex flex-wrap gap-1.5">
            {[
              'Export PDF', 'Revision History', 'Mind Map', 'AI Analysis',
              'Mood Board', 'Locations', 'Ideas', 'Comments', 'Dark Mode',
            ].map(tag => (
              <span
                key={tag}
                className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/15 border border-white/[0.04]
                  hover:text-white/50 hover:border-white/10 transition-all duration-300 cursor-default"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <GridLine />

        {/* ═══════════════════ CTA BLOCK ══════════════════ */}
        <section className="max-w-screen-xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <div className="relative overflow-hidden" style={{ background: 'rgb(var(--brand-500))' }}>
            {/* Grain overlay on CTA */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: 0.08,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'repeat',
                backgroundSize: '256px 256px',
              }}
            />

            {/* Corner brackets */}
            <div className="absolute top-5 left-5 w-5 h-5 border-l border-t border-black/15" />
            <div className="absolute top-5 right-5 w-5 h-5 border-r border-t border-black/15" />
            <div className="absolute bottom-5 left-5 w-5 h-5 border-l border-b border-black/15" />
            <div className="absolute bottom-5 right-5 w-5 h-5 border-r border-b border-black/15" />

            <div className="relative z-10 p-10 md:p-16 lg:p-20">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
                <div className="md:col-span-8">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-black/30 block mb-6">
                    Open Studio · Start Now
                  </span>
                  <h2
                    className="font-semibold text-black"
                    style={{ fontSize: 'clamp(3.5rem, 10vw, 9rem)', letterSpacing: '-0.04em', lineHeight: 0.85 }}
                  >
                    {isLoggedIn
                      ? <>WELCOME<br />BACK.</>
                      : <>GET TO<br />WORK.</>
                    }
                  </h2>
                </div>
                <div className="md:col-span-4 flex flex-col items-start md:items-end gap-3">
                  <Link
                    href={isLoggedIn ? '/dashboard' : '/auth/register'}
                    className="group inline-flex items-center gap-3 px-10 py-5 text-[11px] font-semibold uppercase tracking-[0.04em] bg-black text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
                  >
                    {isLoggedIn ? 'Open Dashboard' : 'Create Free Account'}
                    <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </Link>
                  {!isLoggedIn && (
                    <span className="text-[11px] font-mono text-black/25 tracking-wider">
                      FREE FOREVER · NO CREDIT CARD
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <GridLine />

        {/* ═══════════════════ ABOUT ══════════════════════ */}
        <section className="max-w-screen-xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <div className="flex items-center gap-4 mb-4">
            <Mono className="text-white/15">006</Mono>
            <div className="w-8 h-px bg-white/10" />
            <Mono className="text-white/15">Origin</Mono>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
            <div className="md:col-span-6">
              <h2
                className="font-semibold text-white"
                style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)', letterSpacing: '-0.03em', lineHeight: 0.92 }}
              >
                BUILT BY A<br />
                <span style={{ color: 'rgb(var(--brand-500))' }}>SOLO</span><br />
                DEVELOPER.
              </h2>
            </div>
            <div className="md:col-span-6 flex flex-col gap-6">
              <p className="text-[13px] text-white/45 leading-[2]">
                Built and maintained by one developer at Northem Development in Norway — no team,
                no VC funding, no enterprise roadmap. The tool gets better when people use it
                and say what is broken.
              </p>
              <GridLine />
              <a
                href="https://ko-fi.com/northemdevelopment"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-white transition-all duration-200 hover:-translate-y-px w-fit"
                style={{ background: '#FF5E5B' }}
              >
                <span>♥</span>
                Support on Ko-fi
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </a>
            </div>
          </div>
        </section>

        <GridLine />

        {/* ═══════════════════ FAQ ════════════════════════ */}
        <section className="max-w-screen-xl mx-auto px-6 md:px-8 py-20 md:py-28">
          <div className="flex items-center gap-4 mb-4">
            <Mono className="text-white/15">007</Mono>
            <div className="w-8 h-px bg-white/10" />
            <Mono className="text-white/15">FAQ</Mono>
          </div>

          <h2
            className="font-semibold text-white mb-12"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.03em', lineHeight: 0.92 }}
          >
            EVERYTHING<br />
            YOU NEED TO <span style={{ color: 'rgb(var(--brand-500))' }}>KNOW.</span>
          </h2>

          <div className="max-w-3xl">
            {[
              { q: 'What is Screenplay Studio?', a: 'Screenplay Studio is free screenwriting and film production software. It provides a professional script editor with automatic formatting, real-time collaboration, character bibles, scene breakdowns, shot lists, corkboard planning, production scheduling, and budget tracking — all in one platform.' },
              { q: 'Is Screenplay Studio really free?', a: 'Yes. The script editor, collaboration, scene planning, shot lists, scheduling, version history, sharing and every export format are free, with no project limits. Pro ($29/month or $249/year) adds 200 GB of storage, Cinderra Pro and CastingCall Pro; Studio adds a production-office tool suite for large shoots.' },
              { q: 'Does it support real-time collaboration?', a: 'Yes. Multiple people can work on the same script simultaneously. You can see who is editing what, leave inline comments, and stop emailing PDFs back and forth.' },
              { q: 'What script formats are supported?', a: 'The script editor supports screenplays, episodic TV, stage plays, audio dramas, YouTube scripts, TikTok scripts, podcasts, and educational content.' },
              { q: 'Can I plan a full film production?', a: 'Yes. Screenplay Studio covers the full production stack: script writing, character development, scene breakdowns, shot lists, corkboard planning, arc planning, beat sheets, production scheduling, budget tracking, submission tracking, and team role management.' },
              { q: 'Can I export to Final Draft?', a: 'Yes. Export to Final Draft (FDX), PDF, Fountain, DOCX and HTML — all included free. You can also import FDX, Fountain and PDF scripts.' },
            ].map((faq, i) => (
              <details
                key={i}
                className="group border-b border-white/[0.04] cursor-pointer"
              >
                <summary className="font-bold text-[15px] text-white/60 group-hover:text-white transition-colors duration-300 list-none flex justify-between items-center py-5">
                  {faq.q}
                  <span className="font-mono text-lg transition-transform duration-200 group-open:rotate-45" style={{ color: 'rgb(var(--brand-500))' }}>+</span>
                </summary>
                <p className="pb-5 text-[13px] text-white/45 leading-[2] pr-8">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

      </main>

      {/* ═══════════════════ FOOTER ═══════════════════════ */}
      <footer className="relative z-10 border-t border-white/[0.04]">
        <div className="max-w-screen-xl mx-auto px-6 md:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 flex items-center justify-center text-[11px] font-semibold text-white"
                style={{ background: 'rgb(var(--brand-500))' }}
              >
                SS
              </div>
              <Mono className="text-white/20">Screenplay Studio</Mono>
            </div>
            <div className="flex items-center gap-4">
              <Mono className="text-white/10">Professional Film Production Suite</Mono>
              <SiteVersion />
            </div>
          </div>
          <GridLine className="mb-6" />
          <div className="flex flex-wrap items-center justify-between gap-y-3">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {[
                ['Legal', '/legal'],
                ['Terms', '/legal/terms'],
                ['Privacy', '/legal/privacy'],
                ['Guidelines', '/legal/community-guidelines'],
                ['Security', '/legal/security'],
                ['Blog', '/blog'],
                ['Changelog', '/changelog'],
                ['Tools', '/tools'],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="text-[11px] font-medium uppercase tracking-[0.04em] text-white/10 hover:text-white/50 transition-colors duration-300"
                >
                  {label}
                </a>
              ))}
            </div>
            <a
              href="https://development.northem.no/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] uppercase tracking-[0.04em] transition-colors duration-300"
              style={{ color: 'rgb(var(--brand-500) / 0.5)' }}
            >
              Northem Development ♥ Oslo
            </a>
          </div>
        </div>
      </footer>

      {/* FAQ Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'What is Screenplay Studio?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Screenplay Studio is free screenwriting and film production software. It provides a professional script editor with automatic formatting, real-time collaboration, character bibles, scene breakdowns, shot lists, corkboard planning, production scheduling, and budget tracking — all in one platform.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is Screenplay Studio really free?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. The script editor, collaboration, scene planning, shot lists, scheduling, version history, sharing and every export format are free, with no project limits. Pro ($29/month or $249/year) adds 200 GB of storage, Cinderra Pro and CastingCall Pro; Studio adds a production-office tool suite for large shoots.',
                },
              },
              {
                '@type': 'Question',
                name: 'Does Screenplay Studio support real-time collaboration?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Multiple people can work on the same script simultaneously. You can see who is editing what, leave inline comments, and stop emailing PDFs back and forth.',
                },
              },
              {
                '@type': 'Question',
                name: 'What formats does Screenplay Studio support?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'The script editor supports screenplays, episodic TV, stage plays, audio dramas, YouTube scripts, TikTok scripts, podcasts, and educational content.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I plan a full film production with Screenplay Studio?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Screenplay Studio covers the full production stack: script writing, character development, scene breakdowns, shot lists with storyboard references, corkboard planning, arc planning, beat sheets, production scheduling, budget tracking, submission tracking, and team role management.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I export to Final Draft?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Export to Final Draft (FDX), PDF, Fountain, DOCX and HTML — all included free. You can also import FDX, Fountain and PDF scripts.',
                },
              },
            ],
          }),
        }}
      />
    </div>
  );
}
