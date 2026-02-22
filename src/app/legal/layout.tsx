'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

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
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <div className="border-b border-surface-800/60 bg-surface-950/90 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-surface-500 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              </Link>
              <div className="w-px h-5 bg-surface-800" />
              <Link href="/legal" className="text-sm font-semibold text-white hover:text-red-400 transition-colors">
                Screenplay Studio Legal
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/support" className="text-xs text-surface-400 hover:text-white transition-colors">
                Support
              </Link>
              <Link href="/dashboard" className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/15">
                Back to App
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex gap-10">
          {/* Sidebar */}
          <nav className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-20 space-y-0.5">
              {LEGAL_NAV.map(item => {
                const isActive = pathname === item.href || (item.href !== '/legal' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'block px-3 py-2 rounded-md text-[13px] transition-all duration-150',
                      isActive
                        ? 'text-red-400 bg-red-500/8 font-medium'
                        : 'text-surface-400 hover:text-white hover:bg-surface-800/40'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="pt-6 mt-6 border-t border-surface-800/60">
                <div className="px-3 py-3 rounded-lg bg-surface-900/50 border border-surface-800/40">
                  <p className="text-[11px] text-surface-500 leading-relaxed">
                    Last updated February 2026
                  </p>
                  <p className="text-[11px] text-surface-500 mt-1.5">
                    Questions?{' '}
                    <a href="mailto:legal@screenplaystudio.fun" className="text-red-400 hover:text-red-300 transition-colors">
                      legal@screenplaystudio.fun
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </nav>

          {/* Mobile Nav */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-950/95 backdrop-blur-xl border-t border-surface-800/60 overflow-x-auto">
            <div className="flex gap-0.5 p-2 min-w-max">
              {LEGAL_NAV.map(item => {
                const isActive = pathname === item.href || (item.href !== '/legal' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'px-2.5 py-1.5 rounded-md text-[11px] whitespace-nowrap transition-colors',
                      isActive ? 'bg-red-500/10 text-red-400 font-medium' : 'text-surface-500'
                    )}
                  >
                    {item.label.split(' ')[0]}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 min-w-0 pb-20 lg:pb-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
