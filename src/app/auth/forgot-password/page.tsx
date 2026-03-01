'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button, Input } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?redirect=/settings`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ background: '#070710' }}>
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative z-10 max-w-md text-center">
          <div
            className="w-14 h-14 flex items-center justify-center mx-auto mb-8"
            style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#FF5F1F">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex items-center gap-2.5 mb-4 justify-center">
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
            <span className="ss-label">Reset Link Sent</span>
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
          </div>
          <h1 className="text-2xl font-black text-white mb-3" style={{ letterSpacing: '-0.03em' }}>CHECK YOUR EMAIL</h1>
          <p className="text-sm text-white/35 mb-8 leading-relaxed">
            If an account exists for{' '}
            <span className="text-white font-mono">{email}</span>,
            we sent a password reset link. Check your inbox and spam folder.
          </p>
          <Link href="/auth/login" className="text-[11px] font-mono uppercase tracking-widest hover:opacity-60 transition-opacity" style={{ color: '#FF5F1F' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ background: '#070710' }}>
      {/* Dot-grid texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.18]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative w-full max-w-md z-10">
        {/* Logo mark */}
        <div className="flex items-center gap-3 mb-10">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: '#FF5F1F' }}>
              <span className="font-black text-white text-sm" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/30 uppercase tracking-widest group-hover:text-white/50 transition-colors">
              Screenplay Studio
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="ss-auth-card">
          <div className="mb-8 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-3 h-px shrink-0" style={{ background: '#FF5F1F' }} />
              <span className="ss-label">Password Reset</span>
            </div>
            <h1 className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>RESET PASSWORD</h1>
            <p className="mt-1 text-sm text-white/30">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                className="px-4 py-3 text-sm"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#fca5a5',
                }}
              >
                {error}
              </div>
            )}

            <div>
              <label className="ss-input-label">Email</label>
              <input
                className="ss-input w-full"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="ss-btn-orange w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-8 pt-6 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[11px] font-mono text-white/25 uppercase tracking-widest">
              Remember it?{' '}
              <Link href="/auth/login" className="hover:opacity-70 transition-opacity" style={{ color: '#FF5F1F' }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
