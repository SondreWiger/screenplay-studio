'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ORANGE = '#FF5F1F';

const LEGAL_NAV = [
  { href: '/legal', label: 'Legal Center' },
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/cookies', label: 'Cookie Policy' },
  { href: '/legal/community-guidelines', label: 'Community Guidelines' },
  { href: '/legal/acceptable-use', label: 'Acceptable Use' },
  { href: '/legal/content-policy', label: 'Content Policy' },
  { href: '/legal/copyright', label: 'Copyright Policy' },
  { href: '/legal/dmca', label: 'DMCA & Takedowns' },
  { href: '/legal/data-processing', label: 'Data Processing' },
  { href: '/legal/security', label: 'Security' },
  { href: '/legal/blog', label: 'Legal Updates' },
  { href: '/legal/creator-terms', label: 'Creator Affiliate Terms' },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen" style={{ background: '#070710', color: '#fff' }}>
      {/* Top nav bar */}
      <div
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(7,7,16,0.92)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 flex items-center justify-center" style={{ background: ORANGE }}>
                  <span className="font-black text-white text-[9px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
                </div>
                <Link
                  href="/legal"
                  className="text-[11px] font-mono uppercase tracking-widest text-white/50 hover:text-white transition-colors"
                >
                  Legal Center
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/support"
                className="text-[11px] font-mono uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors"
              >
                Support
              </Link>
              <Link
                href="/dashboard"
                className="ss-btn-orange"
                style={{ padding: '0.35rem 0.9rem', fontSize: '10px' }}
              >
                Back to App
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex gap-12">
          {/* Sidebar */}
          <nav className="hidden lg:block w-52 flex-shrink-0">
            <div className="sticky top-24 space-y-px">
              {/* Eyebrow */}
              <div className="flex items-center gap-2 mb-5">
                <div className="w-3 h-px" style={{ background: ORANGE }} />
                <span className="ss-label">Navigation</span>
              </div>

              {LEGAL_NAV.map(item => {
                const isActive = pathname === item.href || (item.href !== '/legal' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="ss-nav-link block py-2 text-[12px]"
                    style={isActive ? { color: ORANGE } : undefined}
                    data-active={isActive ? 'true' : undefined}
                  >
                    {isActive && (
                      <span className="inline-block w-1.5 h-1.5 mr-2 mb-px shrink-0" style={{ background: ORANGE }} />
                    )}
                    {item.label}
                  </Link>
                );
              })}

              {/* Contact block */}
              <div
                className="mt-8 pt-6 space-y-1.5"
                style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p className="text-[10px] font-mono text-white/20 uppercase tracking-wider">Last updated</p>
                <p className="text-[11px] text-white/30">February 2026</p>
                <p className="text-[10px] font-mono text-white/20 uppercase tracking-wider mt-3">Questions?</p>
                <a
                  href="mailto:legal@screenplaystudio.fun"
                  className="text-[11px] transition-colors"
                  style={{ color: ORANGE }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  legal@screenplaystudio.fun
                </a>              </div>
                {/* Northem attribution */}
                <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] font-mono text-white/20 uppercase tracking-wider mb-2">Developed by</p>
                  <a
                    href="https://development.northem.no/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    <span className="text-[11px] font-semibold tracking-tight leading-snug">
                      Northem Development
                    </span>
                    <svg className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <p className="text-[10px] text-white/20 mt-0.5">Made with ♥ in Norway</p>
                </div>
            </div>
          </nav>

          {/* Mobile bottom nav */}
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl overflow-x-auto"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(7,7,16,0.95)' }}
          >
            <div className="flex gap-0.5 p-2 min-w-max">
              {LEGAL_NAV.map(item => {
                const isActive = pathname === item.href || (item.href !== '/legal' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-1.5 text-[10px] font-mono uppercase whitespace-nowrap transition-colors"
                    style={{
                      color: isActive ? ORANGE : 'rgba(255,255,255,0.3)',
                      background: isActive ? 'rgba(255,95,31,0.08)' : 'transparent',
                      border: isActive ? '1px solid rgba(255,95,31,0.2)' : '1px solid transparent',
                    }}
                  >
                    {item.label.split(' ')[0]}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <main className="ss-prose flex-1 min-w-0 pb-24 lg:pb-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}