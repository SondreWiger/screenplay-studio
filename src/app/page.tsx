import Link from 'next/link';
import { SiteVersion } from '@/components/SiteVersion';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ORANGE = '#FF5F1F';

/** Thin horizontal rule — shared across all sections */
function Rule() {
  return (
    <div className="max-w-screen-xl mx-auto px-6">
      <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
    </div>
  );
}

/** Consistent micro-label: tiny all-caps mono */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/25 font-mono">
      {children}
    </span>
  );
}

/** Page-level eyebrow row: orange tick + label */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-4 h-px shrink-0" style={{ background: ORANGE }} />
      <Label>{children}</Label>
    </div>
  );
}

export default async function LandingPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#070710', color: '#fff' }}>

      {/* ─── dot-grid texture ──────────────────────────────── */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          opacity: 0.032,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* ─── SYSTEM BAR ────────────────────────────────────── */}
      <div
        className="relative z-10 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="max-w-screen-xl mx-auto px-6 h-8 flex items-center justify-between">
          <div className="flex items-center gap-5">
            {/* live indicator */}
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
                style={{ background: ORANGE }}
              />
              <Label>SCREENPLAY STUDIO — NORTHEM DEVELOPMENT</Label>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-5">
            <Label>SINCE 2024</Label>
            <span className="text-white/10">·</span>
            <Label>OSLO, NORWAY</Label>
            <span className="text-white/10">·</span>
            <SiteVersion />
          </div>
        </div>
      </div>

      {/* ─── NAV ───────────────────────────────────────────── */}
      <nav
        className="relative z-10 max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between border-b"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div
            className="w-7 h-7 flex items-center justify-center text-[8px] font-black text-white shrink-0 transition-transform duration-150 group-hover:scale-95"
            style={{ background: ORANGE }}
          >
            SS
          </div>
          <div className="leading-none">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80 leading-none">SCREENPLAY</p>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] leading-none" style={{ color: ORANGE }}>STUDIO</p>
          </div>
        </Link>

        {/* Links */}
        <div className="flex items-center">
          {[['About', '/about'], ['Blog', '/blog'], ['Community', '/community']].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="relative px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30 hover:text-white/70 transition-colors duration-150 group"
            >
              {label}
              {/* underline slides in from left on hover */}
              <span
                className="absolute bottom-1.5 left-3.5 right-3.5 h-px origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-200"
                style={{ background: 'rgba(255,255,255,0.18)' }}
              />
            </Link>
          ))}

          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="group ml-3 inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-all duration-150 hover:-translate-y-px"
              style={{ background: ORANGE }}
            >
              Dashboard
              <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="relative px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30 hover:text-white/70 transition-colors duration-150 group"
              >
                Sign In
                <span
                  className="absolute bottom-1.5 left-3.5 right-3.5 h-px origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-200"
                  style={{ background: 'rgba(255,255,255,0.18)' }}
                />
              </Link>
              <Link
                href="/auth/register"
                className="group ml-3 inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-all duration-150 hover:-translate-y-px"
                style={{ background: ORANGE }}
              >
                Start Free
                <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
              </Link>
            </>
          )}
        </div>
      </nav>

      <main className="relative z-10">

        {/* ─── HERO ──────────────────────────────────────────── */}
        <section className="max-w-screen-xl mx-auto px-6 pt-16">
          <Eyebrow>Northem Development · Oslo, Norway</Eyebrow>

          {/* Giant display type */}
          <h1
            className="select-none"
            style={{
              fontSize: 'clamp(5rem, 18vw, 16rem)',
              fontWeight: 900,
              lineHeight: 0.86,
              letterSpacing: '-0.04em',
              color: '#fff',
            }}
          >
            WRITE.<br />
            PLAN.<br />
            <span style={{ color: ORANGE }}>PRODUCE.</span>
          </h1>

          {/* ── orange ticker bar — sits flush below the headline ── */}
          <div
            className="mt-8 overflow-hidden"
            style={{ background: ORANGE, height: '2.6rem' }}
          >
            <div className="flex items-center h-full">
              <div className="animate-marquee flex items-center shrink-0 whitespace-nowrap">
                {[
                  'SCREENPLAY EDITOR','SCENE BREAKDOWN','SHOT LISTS','CHARACTERS',
                  'ARC PLANNER','PRODUCTION SCHEDULE','BUDGET TRACKING',
                  'TEAM COLLABORATION','SUBMISSIONS','CORKBOARD',
                  'SCREENPLAY EDITOR','SCENE BREAKDOWN','SHOT LISTS','CHARACTERS',
                  'ARC PLANNER','PRODUCTION SCHEDULE','BUDGET TRACKING',
                  'TEAM COLLABORATION','SUBMISSIONS','CORKBOARD',
                ].map((t, i) => (
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

          {/* coordinate annotation */}
          <div className="hidden md:flex justify-end mt-2">
            <Label>59°54′N · 10°44′E / OSLO, NORWAY</Label>
          </div>

          {/* Hero sub-row */}
          <div
            className="mt-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-8 pb-14 border-b"
            style={{ borderColor: 'rgba(255,255,255,0.07)' }}
          >
            <div>
              <p className="text-sm text-white/40 max-w-[22rem] leading-loose">
                Script editor. Scene breakdown. Shot lists. Schedule. Budget. Collaboration.
              </p>
              <p className="text-sm text-white/20 max-w-[22rem] leading-loose">
                Every tool in one place. Free to use — Pro for productions that need more.
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
              <Link
                href={isLoggedIn ? '/dashboard' : '/auth/register'}
                className="group inline-flex items-center gap-2.5 px-8 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-all duration-150 hover:-translate-y-0.5"
                style={{ background: ORANGE, boxShadow: `0 8px 40px ${ORANGE}28` }}
              >
                {isLoggedIn ? 'Open Dashboard' : 'Start Writing — Free'}
                <span className="transition-transform duration-150 group-hover:translate-x-1">→</span>
              </Link>
              <Label>No credit card required</Label>
            </div>
          </div>
        </section>

        {/* ─── STATS ─────────────────────────────────────────── */}
        <section className="max-w-screen-xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            {[
              { num: '100%', label: 'Free To Use',    sub: 'No payment, ever',           live: false },
              { num: '2024', label: 'In Production',  sub: 'Actively maintained',         live: false },
              { num: '40+',  label: 'Tools Included', sub: 'Script to wrap',              live: false },
              { num: '7',    label: 'Script Formats',  sub: 'Film · TV · Audio · Stage',   live: false },
            ].map((s) => (
              <div
                key={s.label}
                className="group py-9 px-6 first:pl-0 last:pr-0 hover:bg-white/[0.018] transition-colors duration-200 cursor-default"
                style={{ borderColor: 'rgba(255,255,255,0.07)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {s.live && (
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                      style={{ background: ORANGE }}
                    />
                  )}
                  <span
                    className="font-black tracking-tight text-white leading-none transition-transform duration-200 group-hover:scale-[1.04] origin-left inline-block"
                    style={{ fontSize: 'clamp(1.8rem, 4vw, 3.25rem)' }}
                  >
                    {s.num}
                  </span>
                </div>
                <p
                  className="text-[9px] font-black uppercase tracking-[0.22em] mb-1"
                  style={{ color: ORANGE }}
                >
                  {s.label}
                </p>
                <p className="text-[10px] text-white/20">{s.sub}</p>
              </div>
            ))}
          </div>
        </section>

        <Rule />

        {/* ─── TOOL TAGS ─────────────────────────────────────── */}
        <section className="max-w-screen-xl mx-auto px-6 py-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <Label>Includes</Label>
            <span className="text-white/15 mx-1">—</span>
            {[
              'Script Editor','Scene Breakdown','Shot Lists','Scheduling',
              'Budget','Characters','Locations','Corkboard','Arc Planner',
              'Beat Sheet','Submissions','Revision History','Team Access',
              'AI Analysis','Mind Map','Export / PDF',
            ].map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30 border
                  transition-all duration-150 cursor-default
                  hover:text-[#FF5F1F] hover:border-[rgba(255,95,31,0.35)] hover:bg-[rgba(255,95,31,0.05)]"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        <Rule />

        {/* ─── FEATURES ──────────────────────────────────────── */}
        <section className="max-w-screen-xl mx-auto px-6 py-24" id="features">

          <div className="flex items-end justify-between mb-16">
            <div>
              <Eyebrow>Feature Set</Eyebrow>
              <h2
                className="font-black text-white"
                style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', letterSpacing: '-0.03em', lineHeight: 0.92 }}
              >
                THE FULL<br />PRODUCTION STACK.
              </h2>
            </div>
            <div className="hidden md:flex flex-col items-end gap-1.5">
              <Label>12 Core Tools</Label>
              <Label>Oslo · 2026</Label>
            </div>
          </div>

          {/* Grid with corner marks */}
          <div className="relative">
            {/* corner crosshairs */}
            {[
              'absolute -top-3 -left-3',
              'absolute -top-3 -right-3 rotate-90',
            ].map((cls, i) => (
              <svg key={i} className={`${cls} w-5 h-5 pointer-events-none`} style={{ color: 'rgba(255,255,255,0.12)' }} viewBox="0 0 20 20" fill="none">
                <path d="M6 1H1v5M14 1h5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            ))}
            {[
              'absolute -bottom-3 -left-3 -rotate-90',
              'absolute -bottom-3 -right-3 rotate-180',
            ].map((cls, i) => (
              <svg key={i} className={`${cls} w-5 h-5 pointer-events-none`} style={{ color: 'rgba(255,255,255,0.12)' }} viewBox="0 0 20 20" fill="none">
                <path d="M6 1H1v5M14 1h5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              {[
                { n: '01', title: 'SCREENPLAY EDITOR',       desc: 'Write in Courier Prime with formatting that adjusts as you type. Scene headings, dialogue, action lines — the structure handles itself. You just write.' },
                { n: '02', title: 'REAL-TIME COLLABORATION', desc: 'Everyone in the same draft at once. See who is editing what, comment inline, stop emailing PDFs back and forth.' },
                { n: '03', title: 'CHARACTER BIBLE',         desc: 'Build characters properly — backstory, arc, voice, relationships, casting notes. The document you would otherwise keep in a separate Google Doc.' },
                { n: '04', title: 'SCENE BREAKDOWN',         desc: 'Strip the script into production breakdown sheets. Props, costumes, SFX, stunts, VFX — extracted per scene and tracked across the project.' },
                { n: '05', title: 'SHOT LIST + STORYBOARD',  desc: 'Build the shot list as you plan the scene. Type, lens, movement, lighting notes — then drop storyboard frames or reference images next to it.' },
                { n: '06', title: 'CORKBOARD',               desc: 'Cards on a board. Drag scenes around, colour by act or storyline, see the whole structure at once without opening the script.' },
                { n: '07', title: 'ARC PLANNER',             desc: 'Plot your character arcs and story threads across the full length of the script. Useful when something is not working and you cannot see why on the page.' },
                { n: '08', title: 'BEAT SHEET',              desc: 'Map the script to whatever structure you use — Save the Cat, Syd Field, or none of them. Link scenes to beat points and see where the pacing breaks.' },
                { n: '09', title: 'PRODUCTION SCHEDULE',     desc: 'Schedule shooting days, call times, locations, and rehearsals on a proper calendar. Export it when you need to hand it off.' },
                { n: '10', title: 'BUDGET TRACKING',         desc: 'Keep the budget in the same place as everything else. Categories, estimated vs actual spend, vendor tracking — enough for a short or a full production.' },
                { n: '11', title: 'SUBMISSION TRACKER',      desc: 'A log of every submission — agent, manager, festival, production company. Dates sent, current status, follow-up notes. Because a spreadsheet for this is depressing.' },
                { n: '12', title: 'TEAM + ROLES',            desc: 'Invite your crew and give them the access level that makes sense. A producer does not need script editing access. A writer does not need the budget.' },
              ].map((f, i) => (
                <div
                  key={f.n}
                  className="group relative p-7 transition-colors duration-150 hover:bg-white/[0.025] cursor-default overflow-hidden"
                  style={{
                    borderRight: (i + 1) % 3 !== 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                    borderBottom: i < 9 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  }}
                >
                  {/* left accent bar slides in on hover */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[2px] origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-250"
                    style={{ background: ORANGE }}
                  />
                  <div className="flex items-start gap-4">
                    <span
                      className="text-[10px] font-black font-mono shrink-0 pt-0.5 transition-colors duration-150 group-hover:opacity-100 opacity-40"
                      style={{ color: ORANGE }}
                    >
                      {f.n}
                    </span>
                    <div>
                      <h3
                        className="text-[10px] font-black uppercase leading-tight mb-2 text-white/50 group-hover:text-white transition-colors duration-150"
                        style={{ letterSpacing: '0.1em' }}
                      >
                        {f.title}
                      </h3>
                      <p className="text-[11px] text-white/22 leading-relaxed group-hover:text-white/40 transition-colors duration-150">
                        {f.desc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Rule />

        {/* ─── CTA ───────────────────────────────────────────── */}
        <section className="max-w-screen-xl mx-auto px-6 py-24">
          <div className="relative overflow-hidden" style={{ background: ORANGE }}>
            {/* dot grid overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: 0.07,
                backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
                backgroundSize: '14px 14px',
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
                  <span className="text-[9px] font-black uppercase tracking-[0.28em] text-black/35">Open Studio · Start Now</span>
                </div>
                <h2
                  className="font-black text-black"
                  style={{ fontSize: 'clamp(3rem, 9vw, 7.5rem)', letterSpacing: '-0.035em', lineHeight: 0.88 }}
                >
                  {isLoggedIn
                    ? <><span>WELCOME</span><br /><span>BACK.</span></>
                    : <><span>GET TO</span><br /><span>WORK.</span></>
                  }
                </h2>
              </div>
              <div className="shrink-0 flex flex-col items-start md:items-end gap-3">
                <Link
                  href={isLoggedIn ? '/dashboard' : '/auth/register'}
                  className="group inline-flex items-center gap-2.5 px-10 py-5 text-[10px] font-black uppercase tracking-[0.16em] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-2xl"
                  style={{ background: '#000', color: '#fff' }}
                >
                  {isLoggedIn ? 'Open Dashboard' : 'Create Free Account'}
                  <span className="transition-transform duration-150 group-hover:translate-x-1">→</span>
                </Link>
                {!isLoggedIn && (
                  <span className="text-[9px] font-mono text-black/30 tracking-wider">
                    100% FREE · NO CREDIT CARD
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <Rule />

        {/* ─── SUPPORT ───────────────────────────────────────── */}
        <section className="max-w-screen-xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <Eyebrow>About This Project</Eyebrow>
              <h2
                className="font-black text-white"
                style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)', letterSpacing: '-0.02em', lineHeight: 0.95 }}
              >
                BUILT BY A<br />SOLO DEVELOPER.
              </h2>
            </div>
            <div className="flex flex-col justify-end gap-5">
              <p className="text-sm text-white/35 leading-[1.85]">
                Built and maintained by one developer at Northem Development in Norway — no team, no VC funding, no enterprise roadmap. The tool gets better when people use it and say what is broken. If it is worth using, it is worth supporting.
              </p>
              <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <a
                href="https://ko-fi.com/northemdevelopment"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2.5 px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] text-white transition-all duration-150 hover:-translate-y-px w-fit"
                style={{ background: '#FF5E5B' }}
              >
                <span>♥</span>
                Support on Ko-fi
                <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* ─── FOOTER ────────────────────────────────────────── */}
      <footer className="relative z-10 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-screen-xl mx-auto px-6 py-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-5 h-5 flex items-center justify-center text-[7px] font-black text-white shrink-0"
                style={{ background: ORANGE }}
              >
                SS
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/25">
                SCREENPLAY STUDIO
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Label>Professional Film Production Suite</Label>
              <span className="text-white/10">·</span>
              <SiteVersion />
            </div>
          </div>
          <div className="h-px mb-4" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="flex flex-wrap items-center justify-between gap-y-2">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {[
                ['Legal', '/legal'],
                ['Terms', '/legal/terms'],
                ['Privacy', '/legal/privacy'],
                ['Community Guidelines', '/legal/community-guidelines'],
                ['Security', '/legal/security'],
                ['Blog', '/blog'],
                ['Changelog', '/changelog'],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/15 hover:text-white/50 transition-colors duration-150"
                >
                  {label}
                </a>
              ))}
            </div>
            <a
              href="https://development.northem.no/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono uppercase tracking-[0.15em] transition-colors duration-150 text-[#FF5F1F]/60 hover:text-[#FF5F1F]"
            >
              Northem Development ♥ Oslo, Norway
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
