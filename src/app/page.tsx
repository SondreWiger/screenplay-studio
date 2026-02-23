import Link from 'next/link';
import { SiteVersion } from '@/components/SiteVersion';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function LandingPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-hidden">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
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
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-lg shadow-brand-600/25"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="px-4 py-2 text-sm font-medium text-surface-300 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-lg shadow-brand-600/25"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-16 pb-32">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-900 border border-surface-800 text-surface-300 text-sm font-medium mb-8">
            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full" />
            Open-source screenwriting suite
          </div>

          <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.9]">
            <span className="text-white">Write.</span>
            <br />
            <span className="text-white">Plan. </span>
            <span className="text-brand-400">Produce.</span>
          </h1>

          <p className="mt-8 text-lg md:text-xl text-surface-400 max-w-2xl mx-auto leading-relaxed">
            Screenplay Studio is a free, all-in-one workspace for screenwriters and
            filmmakers. Format scripts, break down scenes, plan shots, track budgets
            and schedules — no account limits, no paywalls.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={isLoggedIn ? '/dashboard' : '/auth/register'}
              className="px-8 py-4 text-base font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors">
              <span>{isLoggedIn ? 'Go to Dashboard' : 'Start Writing — Free'}</span>
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
              <span key={t} className="px-3 py-1.5 text-[11px] font-medium text-surface-400 bg-surface-900 border border-surface-800 rounded-full">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Script Preview Mock — floating editor */}
        <div className="mt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-transparent to-transparent z-10 pointer-events-none" />
          <div className="max-w-4xl mx-auto rounded-2xl border border-surface-700/50 bg-surface-900 overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-800/70 bg-surface-900">
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
            <h2 className="text-4xl font-bold text-white">The full production toolkit</h2>
            <p className="mt-4 text-lg text-surface-400">Everything screenwriters and filmmakers need, in one place</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Screenplay Editor',
                desc: 'Industry-standard Courier Prime formatting. Scene headings, action, dialogue, parentheticals, transitions — all auto-formatted as you type.',
                iconPath: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10',
              },
              {
                title: 'Real-time Collaboration',
                desc: 'Multiple writers working simultaneously. See cursors, track presence, and collaborate with inline comments and suggestions.',
                iconPath: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
              },
              {
                title: 'Character Bible',
                desc: 'Deep character profiles with backstory, arcs, relationships, personality traits, voice notes, and casting information.',
                iconPath: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
              },
              {
                title: 'Location Scouting',
                desc: 'Track locations with photos, contacts, permits, availability, cost per day, parking, power, and sound considerations.',
                iconPath: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
              },
              {
                title: 'Scene Breakdown',
                desc: 'Full breakdown sheets with props, costumes, special effects, stunts, vehicles, music cues, and VFX requirements.',
                iconPath: 'M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4',
              },
              {
                title: 'Shot List & Storyboard',
                desc: 'Plan every shot with type, movement, lens, lighting, and sound notes. Attach storyboard frames and reference images.',
                iconPath: 'M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z',
              },
              {
                title: 'Production Schedule',
                desc: 'Calendar-based scheduling with shooting days, rehearsals, location scouts, call/wrap times, and weather backup plans.',
                iconPath: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
              },
              {
                title: 'Ideas Board',
                desc: 'Kanban-style brainstorming board. Capture ideas, develop them, organize by category and priority.',
                iconPath: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
              },
              {
                title: 'Budget Tracking',
                desc: 'Full production budget with categories, estimated vs actual costs, vendor tracking, and payment status.',
                iconPath: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
              },
              {
                title: 'Revision Tracking',
                desc: 'Industry-standard colored revision pages. Track every change with full revision history and snapshot comparisons.',
                iconPath: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
              },
              {
                title: 'Team Management',
                desc: 'Invite crew members with role-based access. Writers, editors, viewers — everyone sees exactly what they need.',
                iconPath: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
              },
              {
                title: 'Export & Print',
                desc: 'Export to industry-standard PDF format. Print-ready screenplay pages with proper margins and pagination.',
                iconPath: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-surface-800 bg-surface-900/30 p-6 hover:border-surface-600 hover:bg-surface-800/30 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-800 flex items-center justify-center mb-4 text-surface-300 group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.iconPath} />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-surface-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-40 text-center">
          <div className="max-w-2xl mx-auto rounded-3xl border border-surface-700 bg-surface-900 p-12">
            <h2 className="text-3xl font-bold text-white">{isLoggedIn ? 'Welcome back!' : 'Ready to start writing?'}</h2>
            <p className="mt-4 text-surface-400">
              {isLoggedIn ? 'Continue working on your projects.' : 'Join writers and filmmakers already using Screenplay Studio.'}
            </p>
            <Link
              href={isLoggedIn ? '/dashboard' : '/auth/register'}
              className="inline-block mt-8 px-8 py-4 text-base font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors"
            >
              {isLoggedIn ? 'Go to Dashboard' : 'Create Your First Project'}
            </Link>
          </div>
        </div>
      </main>

      {/* Support section */}
      <section className="relative z-10 border-t border-surface-800 py-16 px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600/10 border border-brand-600/20 mb-6">
            <svg className="w-6 h-6 text-brand-400" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 7.5C4.5 7.5 3 9.5 3 12c0 5 8 9.5 9 10 1-.5 9-5 9-10 0-2.5-1.5-4.5-4.5-4.5-1.8 0-3 1-3.5 1.5C12.5 8.5 11.3 7.5 9.5 7.5h-2z" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Built by a solo developer</h2>
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
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[#FF5E5B] hover:bg-[#e54e4b] text-white font-semibold text-sm transition-colors"
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
            <a href="/legal" className="hover:text-brand-400 transition-colors">Legal Center</a>
            <a href="/legal/terms" className="hover:text-brand-400 transition-colors">Terms of Service</a>
            <a href="/legal/privacy" className="hover:text-brand-400 transition-colors">Privacy Policy</a>
            <a href="/legal/community-guidelines" className="hover:text-brand-400 transition-colors">Community Guidelines</a>
            <a href="/legal/acceptable-use" className="hover:text-brand-400 transition-colors">Acceptable Use</a>
            <a href="/legal/content-policy" className="hover:text-brand-400 transition-colors">Content Policy</a>
            <a href="/legal/security" className="hover:text-brand-400 transition-colors">Security</a>
            <a href="/legal/blog" className="hover:text-brand-400 transition-colors">Legal Blog</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
