'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button, Input } from '@/components/ui';

function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('wrong password') || m.includes('email not found')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (m.includes('email not confirmed') || m.includes('not confirmed')) {
    return 'Please verify your email address before signing in. Check your inbox for the verification link.';
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('over_email_send_rate_limit')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch')) {
    return 'Network error — please check your connection and try again.';
  }
  if (m.includes('user not found') || m.includes('no user')) {
    return 'No account found with that email address.';
  }
  return msg;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#070710' }} />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const [loading, setLoading] = useState(false);
  // Show errors from URL params (e.g. expired magic-link → callback redirects here with ?error=...)
  const urlError = searchParams.get('error');
  const [error, setError] = useState(urlError ? friendlyAuthError(decodeURIComponent(urlError)) : '');

  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const log = useCallback((_msg: string) => {
    // Debug logging removed for production
  }, []);

  // Clear any stale auth cookies on mount
  useEffect(() => {
    log('Mount — checking for existing session...');
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        log(`Active session found for ${user.email} — redirecting to ${redirect}`);
        router.replace(redirect);
      } else {
        log('No active session — clearing stale cookies');
        supabase.auth.signOut().catch(() => {});
      }
    }).catch((err) => {
      log(`getUser error: ${err?.message || err} — clearing cookies`);
      supabase.auth.signOut().catch(() => {});
    });
  }, [redirect, router, log]);

  // Use a plain click handler on the button as backup
  const doLogin = useCallback(async () => {
    // Read values directly from DOM refs — most reliable with autofill
    const emailVal = emailRef.current?.value || '';
    const passVal = passwordRef.current?.value || '';

    log(`Submit — email: "${emailVal}" (${emailVal.length} chars), password: ${'*'.repeat(passVal.length)} (${passVal.length} chars)`);

    if (!emailVal || !passVal) {
      const msg = !emailVal && !passVal 
        ? 'Both fields are empty — browser autofill may not have filled them'
        : !emailVal ? 'Email is empty' : 'Password is empty';
      setError(msg);
      log(`Validation failed: ${msg}`);
      return;
    }

    setLoading(true);
    setError('');
    log('Calling supabase.auth.signInWithPassword...');

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: emailVal,
        password: passVal,
      });

      if (authError) {
        log(`Auth error: ${authError.message} (status: ${authError.status})`);
        setError(friendlyAuthError(authError.message));
        setLoading(false);
        return;
      }

      log(`Success! User: ${data?.user?.email} — redirecting to ${redirect}`);

      // Track login attempt (fire-and-forget)
      fetch('/api/auth/track-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'email', success: true }),
      }).catch(() => {});

      sessionStorage.setItem('ss_session_active', '1');
      router.push(redirect);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown';
      log(`Exception: ${message}`);
      setError(`${friendlyAuthError(message)}`);
      setLoading(false);
    }
  }, [redirect, router, log]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    log('Form onSubmit fired');
    doLogin();
  };

  const handleButtonClick = () => {
    log('Button onClick fired');
    // Safety net: if form onSubmit doesn't fire (can happen in some mobile browsers),
    // call doLogin directly.
    if (!loading) doLogin();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: '#070710' }}
    >
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
            <div
              className="w-9 h-9 flex items-center justify-center shrink-0"
              style={{ background: '#FF5F1F' }}
            >
              <span className="font-black text-white text-sm" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-[11px] font-mono text-white/30 uppercase tracking-widest group-hover:text-white/50 transition-colors">
              Screenplay Studio
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="ss-auth-card">
          {/* Header */}
          <div className="mb-8 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-3 h-px shrink-0" style={{ background: '#FF5F1F' }} />
              <span className="ss-label">Authentication</span>
            </div>
            <h1 className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>
              WELCOME BACK
            </h1>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
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
                ref={emailRef}
                className="ss-input w-full"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="ss-input-label">Password</label>
              <input
                ref={passwordRef}
                className="ss-input w-full"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            <div className="flex justify-end">
              <Link
                href="/auth/forgot-password"
                className="text-[11px] font-mono text-white/30 hover:text-white/60 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="ss-btn-orange w-full"
              onClick={handleButtonClick}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div
            className="mt-8 pt-6 text-center"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-[11px] font-mono text-white/25 uppercase tracking-widest">
              No account?{' '}
              <Link href="/auth/register" className="hover:opacity-70 transition-opacity" style={{ color: '#FF5F1F' }}>
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
