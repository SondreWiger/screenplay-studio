import Link from 'next/link';
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun';

export const metadata: Metadata = {
  title: 'Compare — Screenplay Studio',
  description: 'How Screenplay Studio stacks up against Final Draft, WriterDuet, and Arc Studio. Free, open-source, and built for the full production lifecycle.',
  openGraph: {
    type: 'website',
    siteName: 'Screenplay Studio',
    title: 'Screenplay Studio vs Final Draft, WriterDuet & Arc Studio',
    description: 'Side-by-side comparison of screenwriting software. See how the free, open-source option compares to $250 industry standards.',
    images: [
      {
        url: `${SITE_URL}/api/og?title=${encodeURIComponent('Compare')}&subtitle=${encodeURIComponent('Screenplay Studio vs Final Draft, WriterDuet & Arc Studio')}`,
        width: 1200,
        height: 630,
        alt: 'Screenplay Studio vs Final Draft, WriterDuet & Arc Studio',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Screenplay Studio vs Final Draft, WriterDuet & Arc Studio',
    description: 'Side-by-side comparison of screenwriting software. See how the free, open-source option compares to $250 industry standards.',
    images: [`${SITE_URL}/api/og?title=${encodeURIComponent('Compare')}&subtitle=${encodeURIComponent('Screenplay Studio vs Final Draft, WriterDuet & Arc Studio')}`],
  },
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

function Check() {
  return <span style={{ color: ORANGE }}>✓</span>;
}

function Dash() {
  return <span className="text-white/20">—</span>;
}

const COMPETITORS = [
  {
    id: 'final-draft',
    name: 'Final Draft',
    slug: 'final-draft',
    price: '$249.99 one-time or $9.99/mo',
    tagline: 'Industry standard, but expensive and closed.',
    pros: [
      'Industry-standard format compatibility (FDX)',
      'Beat Board for story structure',
      'Navigator for character tracking',
      'Mac & Windows desktop apps',
    ],
    cons: [
      'No real-time collaboration (async only)',
      'No production scheduling or budget tools',
      'No shot list or storyboard features',
      'No free tier — $250 entry cost',
      'Not open source',
    ],
  },
  {
    id: 'writerduet',
    name: 'WriterDuet',
    slug: 'writerduet',
    price: 'Free (3 projects) · Plus $9.99/mo · Pro $11.99/mo',
    tagline: 'Great for real-time collab, thin on production.',
    pros: [
      'Real-time collaboration',
      'Multi-platform (web, mobile, desktop)',
      'FDX export/import',
      'Affordable paid tiers',
    ],
    cons: [
      'Free tier limited to 3 projects',
      'No scene breakdown or production reports',
      'No scheduling or budget tracking',
      'No shot list or storyboard',
      'No arc planner or mind map',
      'Not open source',
    ],
  },
  {
    id: 'arc-studio',
    name: 'Arc Studio',
    slug: 'arc-studio',
    price: 'Free (2 scripts, watermarked) · Essentials $69/yr · Pro $99/yr',
    tagline: 'Clean UI, growing fast — but Pro is needed for real use.',
    pros: [
      'Polished, modern interface',
      'Smart outlining and storyline view',
      'AI research assistant (Pro)',
      'Character profiles with images',
      'Native Mac, Windows & iOS apps',
    ],
    cons: [
      'Free tier: max 2 scripts, watermarked PDFs',
      'No production scheduling or budget',
      'No shot list or storyboard',
      'No scene breakdown sheets',
      'Collaboration limited on cheaper tiers',
      'Not open source',
    ],
  },
];

const FEATURE_TABLE = [
  { feature: 'Price', screenplay: 'Free (core)', finalDraft: '$249.99', writerDuet: 'Free (3 proj.)', arcStudio: 'Free (2 scripts)' },
  { feature: 'Real-time Collaboration', screenplay: <Check />, finalDraft: <Dash />, writerDuet: <Check />, arcStudio: 'Pro only' },
  { feature: 'Screenplay Editor', screenplay: <Check />, finalDraft: <Check />, writerDuet: <Check />, arcStudio: <Check /> },
  { feature: '7 Script Formats', screenplay: <Check />, finalDraft: 'Film/TV only', writerDuet: 'Film/TV only', arcStudio: 'Film/TV only' },
  { feature: 'Scene Breakdown', screenplay: <Check />, finalDraft: 'Reports only', writerDuet: <Dash />, arcStudio: <Dash /> },
  { feature: 'Shot List + Storyboard', screenplay: <Check />, finalDraft: <Dash />, writerDuet: <Dash />, arcStudio: <Dash /> },
  { feature: 'Corkboard', screenplay: <Check />, finalDraft: <Check />, writerDuet: <Check />, arcStudio: <Check /> },
  { feature: 'Arc Planner', screenplay: <Check />, finalDraft: <Dash />, writerDuet: <Dash />, arcStudio: 'Storylines' },
  { feature: 'Beat Sheet', screenplay: <Check />, finalDraft: <Check />, writerDuet: <Dash />, arcStudio: <Check /> },
  { feature: 'Mind Map', screenplay: <Check />, finalDraft: <Dash />, writerDuet: <Dash />, arcStudio: <Dash /> },
  { feature: 'Character Bible', screenplay: <Check />, finalDraft: <Check />, writerDuet: <Dash />, arcStudio: 'Profiles' },
  { feature: 'Production Schedule', screenplay: <Check />, finalDraft: <Dash />, writerDuet: <Dash />, arcStudio: <Dash /> },
  { feature: 'Budget Tracking', screenplay: <Check />, finalDraft: <Dash />, writerDuet: <Dash />, arcStudio: <Dash /> },
  { feature: 'Submission Tracker', screenplay: <Check />, finalDraft: <Dash />, writerDuet: <Dash />, arcStudio: <Dash /> },
  { feature: 'AI Analysis', screenplay: <Check />, finalDraft: <Dash />, writerDuet: <Dash />, arcStudio: <Check /> },
  { feature: 'Revision History', screenplay: <Check />, finalDraft: <Check />, writerDuet: 'Premium', arcStudio: 'Pro' },
  { feature: 'Offline Mode', screenplay: <Check />, finalDraft: <Check />, writerDuet: <Check />, arcStudio: <Check /> },
  { feature: 'Open Source', screenplay: <Check />, finalDraft: <Dash />, writerDuet: <Dash />, arcStudio: <Dash /> },
  { feature: 'Desktop App', screenplay: 'PWA / browser', finalDraft: <Check />, writerDuet: 'Plus+', arcStudio: <Check /> },
  { feature: 'Mobile App', screenplay: 'PWA', finalDraft: 'Go ($)', writerDuet: <Check />, arcStudio: 'iOS' },
];

export default function ComparePage() {
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
            <Link href="/about" className="text-xs text-white/35 hover:text-white/70 transition-colors">About</Link>
            <Link href="/dashboard" className="text-xs px-3 py-1.5 font-semibold transition-colors" style={{ background: ORANGE, color: '#fff' }}>
              Open App
            </Link>
          </div>
        </div>
      </div>

      <main className="relative z-10">

        {/* ── Hero ── */}
        <section className="max-w-screen-lg mx-auto px-6 pt-20 pb-16">
          <Eyebrow>Comparison</Eyebrow>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6"
            style={{ letterSpacing: '-0.04em', lineHeight: 1.05 }}
          >
            Screenplay Studio
            <br />
            <span style={{ color: ORANGE }}>vs the alternatives</span>
          </h1>
          <p className="text-base sm:text-lg text-white/45 max-w-2xl leading-relaxed">
            Final Draft is the industry standard at $250. WriterDuet leads in collaboration. Arc Studio has the cleanest UI.
            Screenplay Studio is the only one that{' '}
            <span className="text-white/70">does all of it — for free, open source,</span> with production tools none of them have.
          </p>
        </section>

        <Rule />

        {/* ── Feature Comparison Table ── */}
        <section className="max-w-screen-lg mx-auto px-6 py-16">
          <Eyebrow>Feature comparison</Eyebrow>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-8" style={{ letterSpacing: '-0.03em' }}>
            Side by side
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <th className="text-left py-3 pr-4 font-bold text-white/80 whitespace-nowrap">Feature</th>
                  <th className="text-left py-3 px-4 font-bold whitespace-nowrap" style={{ color: ORANGE }}>Screenplay Studio</th>
                  <th className="text-left py-3 px-4 font-bold text-white/50 whitespace-nowrap">Final Draft</th>
                  <th className="text-left py-3 px-4 font-bold text-white/50 whitespace-nowrap">WriterDuet</th>
                  <th className="text-left py-3 px-4 font-bold text-white/50 whitespace-nowrap">Arc Studio</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_TABLE.map((row) => (
                  <tr key={row.feature} className="border-b" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                    <td className="py-3 pr-4 text-white/60 font-medium whitespace-nowrap">{row.feature}</td>
                    <td className="py-3 px-4" style={{ color: ORANGE }}>
                      {row.screenplay}
                    </td>
                    <td className="py-3 px-4 text-white/35">{row.finalDraft}</td>
                    <td className="py-3 px-4 text-white/35">{row.writerDuet}</td>
                    <td className="py-3 px-4 text-white/35">{row.arcStudio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-xs text-white/20">
            Prices and feature availability checked May 2026. Subject to change.
          </p>
        </section>

        <Rule />

        {/* ── Why Screenplay Studio wins ── */}
        <section className="max-w-screen-lg mx-auto px-6 py-16">
          <Eyebrow>The difference</Eyebrow>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-8" style={{ letterSpacing: '-0.03em' }}>
            What you get with Screenplay Studio
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                title: 'Full production stack',
                desc: 'Script → breakdown → shot list → schedule → budget → submissions. Every other tool stops at the script.',
                highlight: 'Only platform with end-to-end production tools.',
              },
              {
                title: 'Free, no asterisks',
                desc: 'No 3-project limit. No watermarked PDFs. No time limit. The core platform is genuinely free.',
                highlight: 'Not a trial. Not a freemium trap.',
              },
              {
                title: 'Open source',
                desc: 'The code is on GitHub. Audit it, fork it, contribute to it, run your own instance. No black box.',
                highlight: 'Transparency you cannot get elsewhere.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl p-6"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p className="text-sm font-bold text-white mb-2">{item.title}</p>
                <p className="text-xs text-white/40 leading-relaxed mb-3">{item.desc}</p>
                <p className="text-xs font-semibold" style={{ color: ORANGE }}>{item.highlight}</p>
              </div>
            ))}
          </div>
        </section>

        <Rule />

        {/* ── Competitor deep-dives ── */}
        {COMPETITORS.map((comp, idx) => (
          <section key={comp.id}>
            <section className="max-w-screen-lg mx-auto px-6 py-16">
              <Eyebrow>vs {comp.name}</Eyebrow>
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-3" style={{ letterSpacing: '-0.03em' }}>
                {comp.name}: {comp.tagline}
              </h2>
              <p className="text-sm text-white/40 mb-6">{comp.price}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-white/60 mb-3 uppercase tracking-wider">What {comp.name} does well</p>
                  <ul className="space-y-2">
                    {comp.pros.map((pro) => (
                      <li key={pro} className="flex items-start gap-2 text-xs text-white/45 leading-relaxed">
                        <span style={{ color: ORANGE }}>+</span>
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold text-white/60 mb-3 uppercase tracking-wider">What Screenplay Studio covers that {comp.name} does not</p>
                  <ul className="space-y-2">
                    {comp.cons.map((con) => (
                      <li key={con} className="flex items-start gap-2 text-xs text-white/35 leading-relaxed">
                        <span className="text-white/20">−</span>
                        {con}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
            {idx < COMPETITORS.length - 1 && <Rule />}
          </section>
        ))}

        <Rule />

        {/* ── Honest trade-offs ── */}
        <section className="max-w-screen-lg mx-auto px-6 py-16">
          <Eyebrow>Honest trade-offs</Eyebrow>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-5" style={{ letterSpacing: '-0.03em' }}>
            Where Screenplay Studio still lags
          </h2>
          <div className="max-w-2xl space-y-4 text-sm text-white/45 leading-relaxed">
            <p>
              Screenplay Studio is younger than every tool on this list. That shows in a few ways:
            </p>
            <ul className="space-y-3 pl-4">
              {[
                'No native desktop apps yet — the PWA works well, but some users prefer a standalone app.',
                'No FDX export yet (planned for Pro). If you need to exchange files with Final Draft users today, you will hit a wall.',
                'The user base is smaller — fewer templates, fewer community resources, fewer third-party integrations.',
                'No dedicated mobile app yet. The PWA works on mobile browsers, but it is not a native experience.',
                'No table read or read-aloud feature (Arc Studio and WriterDuet both have it).',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-white/20 mt-0.5 shrink-0">—</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="pt-2">
              These are known gaps and the roadmap addresses most of them. If any of these are dealbreakers, the other tools
              might be a better fit today. If you want something that covers the full production cycle and is{' '}
              <span className="text-white/70">genuinely free and open source</span>, Screenplay Studio is the only option.
            </p>
          </div>
        </section>

        <Rule />

        {/* ── CTA ── */}
        <section className="max-w-screen-lg mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4" style={{ letterSpacing: '-0.04em' }}>
            See for yourself.
          </h2>
          <p className="text-sm text-white/40 mb-8">No card. No limit. No watermarks.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/auth/register"
              className="px-6 py-3 text-sm font-black text-white uppercase tracking-tight transition-opacity hover:opacity-90"
              style={{ background: ORANGE }}
            >
              Get Started Free
            </Link>
            <Link
              href="/blog/complete-platform-guide-every-feature"
              className="px-6 py-3 text-sm font-semibold text-white/50 hover:text-white transition-colors border border-white/10 hover:border-white/20 rounded-md"
            >
              Read the Full Feature Guide →
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
            <span className="text-xs text-white/20">Screenplay Studio — free & open source</span>
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
              className="text-[10px] font-mono uppercase tracking-[0.15em] transition-colors text-brand-500/60 hover:text-brand-500"
            >
              Northem Development ♥ Oslo
            </a>
          </div>
        </div>
      </footer>

      {/* ComparePage structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Screenwriting Software Comparison',
            description: 'Compare Screenplay Studio vs Final Draft, WriterDuet, and Arc Studio.',
            breadcrumb: {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun'}/` },
                { '@type': 'ListItem', position: 2, name: 'Compare', item: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://screenplaystudio.fun'}/compare` },
              ],
            },
          }),
        }}
      />
    </div>
  );
}
