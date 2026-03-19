'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

const NAV = [
  {
    href: '/dev/features',
    label: 'Features',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    public: true,
    badge: 'Public',
  },
  {
    href: '/dev/stats',
    label: 'Stats',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    adminOnly: true,
  },
  {
    href: '/dev/test',
    label: 'Test Bench',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    adminOnly: true,
  },
];

export default function DevLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isAdmin = !loading && user && (user.id === ADMIN_UID || user.role === 'admin' || user.role === 'moderator');

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 border-r border-white/[0.06] flex flex-col py-6 px-3 sticky top-0 h-screen">
        {/* Logo / Back */}
        <div className="mb-6 px-2">
          <Link href="/dashboard" className="flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors text-xs mb-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-[10px] font-bold text-white">D</div>
            <span className="text-white text-sm font-semibold tracking-tight">Dev Portal</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1">
          {NAV.map((item) => {
            const visible = item.public || isAdmin;
            if (!visible) return null;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-violet-500/15 text-violet-300'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                )}
              >
                <span className={active ? 'text-violet-400' : 'text-white/40'}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold uppercase tracking-wide border border-emerald-500/20">
                    {item.badge}
                  </span>
                )}
                {item.adminOnly && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold uppercase tracking-wide border border-red-500/20">
                    Admin
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto px-2">
          <div className="text-[10px] text-white/20 leading-relaxed">
            <span className="block font-mono">dev.screenplay.studio</span>
            <span className="block">Internal tools</span>
          </div>
        </div>
      </aside>

      {/* ── Content ─────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
