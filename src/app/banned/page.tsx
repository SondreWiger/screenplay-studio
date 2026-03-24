'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function BannedContent() {
  const params = useSearchParams();
  const reason = params?.get('reason') || 'Your account has been permanently banned.';
  const isIpBan = params?.get('ip') === '1';

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#070710' }}>
      <div className="pointer-events-none fixed inset-0 opacity-[0.06]" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,0,0,0.5) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />
      <div className="relative z-10 max-w-lg text-center">
        <div className="w-16 h-16 flex items-center justify-center mx-auto mb-6 rounded-full bg-red-500/10 border border-red-500/30">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>

        <h1 className="text-3xl font-black text-white mb-3" style={{ letterSpacing: '-0.03em' }}>
          {isIpBan ? 'Access Denied' : 'You Are Banned'}
        </h1>

        <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-6 py-4 mb-6">
          <p className="text-sm text-red-300 font-medium mb-1">Reason</p>
          <p className="text-sm text-white/70">{reason}</p>
        </div>

        {isIpBan && (
          <p className="text-sm text-white/40 mb-6">
            This IP address has been banned from Screenplay Studio.
            Creating new accounts will not bypass this restriction.
          </p>
        )}

        <p className="text-sm text-white/40 mb-8">
          If you believe this was done in error, you may submit an appeal.
        </p>

        <a
          href="mailto:sondre@northem.no?subject=Ban%20Appeal%20-%20Screenplay%20Studio"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Appeal via Email
        </a>

        <p className="text-xs text-white/20 mt-4 font-mono">sondre@northem.no</p>
      </div>
    </div>
  );
}

export default function BannedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#070710' }} />}>
      <BannedContent />
    </Suspense>
  );
}
