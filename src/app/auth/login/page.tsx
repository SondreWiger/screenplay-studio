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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown';
      log(`Exception: ${message}`);
      setError(`Unexpected error: ${message}`);
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
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">Screenplay Studio</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-surface-400 mb-8">Sign in to your account to continue</p>

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <Input
              ref={emailRef}
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
            />

            <Input
              ref={passwordRef}
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />

            <div className="flex justify-end">
              <Link href="/auth/forgot-password" className="text-xs text-brand-400 hover:text-brand-300">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" loading={loading} onClick={handleButtonClick}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-surface-400">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-brand-400 hover:text-brand-300 font-medium">
              Create one
            </Link>
          </p>
        </div>


      </div>
    </div>
  );
}
