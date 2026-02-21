import Link from 'next/link';
import { SiteVersion } from '@/components/SiteVersion';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-950 relative overflow-hidden">
      {/* Background effects — layered glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-60 -right-60 w-[500px] h-[500px] bg-brand-600/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -left-60 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-1/4 w-[700px] h-[700px] bg-orange-500/4 rounded-full blur-[150px]" />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Support banner */}
      <div className="relative z-10 flex items-center justify-center px-4 py-2.5 bg-surface-900/60 border-b border-surface-800/50 backdrop-blur-sm">
        <p className="text-xs text-surface-400">
          Built &amp; run for free by a solo developer.{' '}
          <a href="https://ko-fi.com/northemdevelopment" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Support the project &#x2764;
          </a>
        </p>
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
            </svg>
          </div>
          <span className="text-xl font-bold text-white">Screenplay Studio</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/blog" className="px-4 py-2 text-sm font-medium text-surface-300 hover:text-white transition-colors">
            Blog
          </Link>
          <Link href="/community" className="px-4 py-2 text-sm font-medium text-surface-300 hover:text-white transition-colors">
            Community
          </Link>
          <Link href="/auth/login" className="px-4 py-2 text-sm font-medium text-surface-300 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-lg shadow-brand-600/25"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-16 pb-32">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600/10 border border-brand-600/20 text-brand-400 text-sm font-medium mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse-subtle" />
            Professional Film Production Suite
          </div>

          <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.9]">
            <span className="text-white">From script</span>
            <br />
            <span className="text-white">to </span>
            <span className="gradient-text">screen.</span>
          </h1>

          <p className="mt-8 text-lg md:text-xl text-surface-400 max-w-2xl mx-auto leading-relaxed">
            Write screenplays with industry-standard formatting, break down scenes,
            plan shots, manage budgets, schedule production — all in one place.
            Free and open. No paywalls. No limits.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="group relative px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 rounded-xl transition-all shadow-xl shadow-brand-600/20 hover:shadow-brand-500/30 hover:-translate-y-0.5"
            >
              <span className="relative z-10">Start Writing — Free</span>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 text-base font-medium text-surface-300 border border-surface-700 hover:border-surface-500 hover:text-white rounded-xl transition-all hover:-translate-y-0.5"
            >
              Explore Features
            </Link>
          </div>

          {/* Tool badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            {['Script Editor', 'Scene Breakdown', 'Shot Lists', 'Scheduling', 'Budget', 'Team', 'Characters', 'Locations'].map((t) => (
              <span key={t} className="px-3 py-1.5 text-[11px] font-medium text-surface-400 bg-surface-900/60 border border-surface-800 rounded-full backdrop-blur-sm">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Script Preview Mock — floating editor */}
        <div className="mt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-transparent to-transparent z-10 pointer-events-none" />
          {/* Ambient glow behind the editor */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-brand-500/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="max-w-4xl mx-auto rounded-2xl border border-surface-700/50 bg-surface-900/90 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-800/70 bg-surface-900/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 flex items-center justify-center gap-2">
                <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs text-surface-500 font-medium">THE_MIDNIGHT_HOUR.screenplay</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-subtle" />
                <span className="text-[10px] text-surface-500">Auto-saved</span>
              </div>
            </div>
            {/* Script content */}
            <div className="p-8 font-screenplay text-sm leading-relaxed bg-white/[0.02]">
              <p className="uppercase font-bold text-brand-400 mb-4 tracking-wider">FADE IN:</p>
              <p className="uppercase font-bold text-blue-400 mb-3">EXT. CITY SKYLINE - NIGHT</p>
              <p className="text-surface-300 mb-4 leading-relaxed">
                Rain cascades down glass towers. The city breathes in neon.<br />
                A FIGURE moves through the crowd — purposeful, alone.
              </p>
              <p className="uppercase text-center text-orange-400 mb-1 ml-32 font-semibold">DETECTIVE MARLOW</p>
              <p className="text-center text-surface-500 mb-0.5 ml-20 italic text-xs">(into phone, urgent)</p>
              <p className="text-surface-300 ml-16 mr-24 mb-4">
                You said midnight. It&apos;s midnight. Where are you?
              </p>
              <p className="text-surface-300 mb-4 leading-relaxed">
                A beat. Only rain. Then — a gunshot echoes across the water.
              </p>
              <p className="uppercase font-bold text-blue-400 mb-3">INT. WAREHOUSE - CONTINUOUS</p>
              <p className="text-surface-300 leading-relaxed">
                Darkness. The sound of dripping water. A flashlight beam cuts through<br />
                the void, revealing...
              </p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-24 max-w-3xl mx-auto grid grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-3xl font-bold text-white">100%</p>
            <p className="text-sm text-surface-500 mt-1">Free to use</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">Real-time</p>
            <p className="text-sm text-surface-500 mt-1">Collaboration</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">Full suite</p>
            <p className="text-sm text-surface-500 mt-1">Pre to post production</p>
          </div>
        </div>

        {/* Features */}
        <div id="features" className="mt-40">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white">Everything for Production</h2>
            <p className="mt-4 text-lg text-surface-400">From first draft to final cut — all the tools you need</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Screenplay Editor',
                desc: 'Industry-standard Courier Prime formatting. Scene headings, action, dialogue, parentheticals, transitions — all auto-formatted as you type.',
                icon: '✍️',
              },
              {
                title: 'Real-time Collaboration',
                desc: 'Multiple writers working simultaneously. See cursors, track presence, and collaborate with inline comments and suggestions.',
                icon: '👥',
              },
              {
                title: 'Character Bible',
                desc: 'Deep character profiles with backstory, arcs, relationships, personality traits, voice notes, and casting information.',
                icon: '🎭',
              },
              {
                title: 'Location Scouting',
                desc: 'Track locations with photos, contacts, permits, availability, cost per day, parking, power, and sound considerations.',
                icon: '📍',
              },
              {
                title: 'Scene Breakdown',
                desc: 'Full breakdown sheets with props, costumes, special effects, stunts, vehicles, music cues, and VFX requirements.',
                icon: '🎬',
              },
              {
                title: 'Shot List & Storyboard',
                desc: 'Plan every shot with type, movement, lens, lighting, and sound notes. Attach storyboard frames and reference images.',
                icon: '📸',
              },
              {
                title: 'Production Schedule',
                desc: 'Calendar-based scheduling with shooting days, rehearsals, location scouts, call/wrap times, and weather backup plans.',
                icon: '📅',
              },
              {
                title: 'Ideas Board',
                desc: 'Kanban-style brainstorming board. Capture sparks of inspiration, develop them, and organize by category and priority.',
                icon: '💡',
              },
              {
                title: 'Budget Tracking',
                desc: 'Full production budget with categories, estimated vs actual costs, vendor tracking, and payment status.',
                icon: '💰',
              },
              {
                title: 'Revision Tracking',
                desc: 'Industry-standard colored revision pages. Track every change with full revision history and snapshot comparisons.',
                icon: '📝',
              },
              {
                title: 'Team Management',
                desc: 'Invite crew members with role-based access. Writers, editors, viewers — everyone sees exactly what they need.',
                icon: '🎪',
              },
              {
                title: 'Export & Print',
                desc: 'Export to industry-standard PDF format. Print-ready screenplay pages with proper margins and pagination.',
                icon: '📤',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-surface-800 bg-surface-900/30 p-6 hover:border-surface-600 hover:bg-surface-800/30 transition-all duration-300"
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-surface-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-40 text-center">
          <div className="max-w-2xl mx-auto rounded-3xl border border-surface-700 bg-gradient-to-br from-surface-900 to-surface-800 p-12 glow-brand">
            <h2 className="text-3xl font-bold text-white">Ready to bring your story to life?</h2>
            <p className="mt-4 text-surface-400">
              Join filmmakers using Screenplay Studio to write, plan, and produce.
            </p>
            <Link
              href="/auth/register"
              className="inline-block mt-8 px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl shadow-xl shadow-brand-600/20 hover:shadow-brand-500/30 transition-all"
            >
              Create Your First Project
            </Link>
          </div>
        </div>
      </main>

      {/* Support section */}
      <section className="relative z-10 border-t border-surface-800 py-16 px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600/10 border border-brand-600/20 mb-6">
            <span className="text-2xl">&#x2764;&#xFE0F;</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Made with love by a solo developer</h2>
          <p className="text-surface-400 leading-relaxed mb-2">
            Screenplay Studio is self-funded, built, and maintained by a single developer.
            The platform is completely free to use — no subscriptions, no paywalls, no ads.
          </p>
          <p className="text-surface-400 leading-relaxed mb-8">
            If you find this tool useful and want to help keep it running and growing,
            consider supporting the project. Every contribution goes directly towards
            server costs, development time, and new features.
          </p>
          <a
            href="https://ko-fi.com/northemdevelopment"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[#FF5E5B] hover:bg-[#e54e4b] text-white font-semibold text-sm transition-colors shadow-lg shadow-[#FF5E5B]/20"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 7.5C4.5 7.5 3 9.5 3 12c0 5 8 9.5 9 10 1-.5 9-5 9-10 0-2.5-1.5-4.5-4.5-4.5-1.8 0-3 1-3.5 1.5C12.5 8.5 11.3 7.5 9.5 7.5h-2z" /></svg>
            Support on Ko-fi
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-surface-800 py-8 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-surface-500">Screenplay Studio</p>
            <div className="flex items-center gap-4">
              <p className="text-sm text-surface-600">Professional film production suite</p>
              <SiteVersion />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-surface-600">
            <a href="/terms" className="hover:text-brand-400 transition-colors">Terms of Service</a>
            <a href="/privacy" className="hover:text-brand-400 transition-colors">Privacy Policy</a>
            <a href="/community-guidelines" className="hover:text-brand-400 transition-colors">Community Guidelines</a>
            <a href="/acceptable-use" className="hover:text-brand-400 transition-colors">Acceptable Use</a>
            <a href="/content-policy" className="hover:text-brand-400 transition-colors">Content Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
