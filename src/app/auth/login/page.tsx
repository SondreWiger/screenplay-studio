'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button, Input } from '@/components/ui';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-950" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const log = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    const entry = `[${ts}] ${msg}`;
    console.log('[LOGIN]', msg);
    setDebugLog(prev => [...prev, entry]);
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
        setError(authError.message);
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
    } catch (err: any) {
      log(`Exception: ${err?.message || err}`);
      setError(`Unexpected error: ${err?.message || 'Unknown'}`);
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
    // The form onSubmit should handle it, but as a safety net:
    // if for some reason onSubmit doesn't fire, we still run login
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-40 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-orange-500 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">Screenplay Studio</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-surface-800 bg-surface-900/80 backdrop-blur-xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-surface-400 mb-8">Sign in to your account to continue</p>

          {/* Google Login */}
          <button
            type="button"
            disabled
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-surface-700 bg-surface-800/50 px-4 py-2.5 text-sm font-medium text-surface-500 cursor-not-allowed mb-2 opacity-60"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
          <p className="text-[11px] text-surface-500 text-center mb-6">Google sign-in is under construction</p>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-surface-900 px-3 text-surface-500">or continue with email</span>
            </div>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-300">Email</label>
              <input
                ref={emailRef}
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder:text-surface-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors duration-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-300">Password</label>
              <input
                ref={passwordRef}
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder:text-surface-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors duration-200"
              />
            </div>

            <div className="flex justify-end">
              <Link href="/auth/forgot-password" className="text-xs text-brand-400 hover:text-brand-300">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              onClick={handleButtonClick}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 disabled:opacity-50 disabled:cursor-not-allowed bg-brand-600 text-white hover:bg-brand-700 shadow-sm px-4 py-2 text-sm"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-surface-400">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-brand-400 hover:text-brand-300 font-medium">
              Create one
            </Link>
          </p>
        </div>

        {/* Debug log panel */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-surface-600 hover:text-surface-400 transition-colors"
          >
            {showDebug ? 'Hide' : 'Show'} debug log ({debugLog.length})
          </button>
          {showDebug && (
            <div className="mt-2 rounded-lg bg-black/60 border border-surface-800 p-3 max-h-48 overflow-y-auto font-mono text-[11px] text-surface-400 space-y-0.5">
              {debugLog.length === 0 && <p className="text-surface-600">No events yet...</p>}
              {debugLog.map((entry, i) => (
                <p key={i} className={entry.includes('error') || entry.includes('Error') || entry.includes('failed') ? 'text-red-400' : entry.includes('Success') ? 'text-green-400' : ''}>{entry}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
