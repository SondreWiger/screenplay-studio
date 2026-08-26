'use client';

import { useState, Suspense, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { createLocalUser, isElectronMode } from '@/lib/supabase/electron-client';
import logger from '@/lib/logger';
import { useTranslation } from '@/components/TranslationProvider';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

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
    <Suspense fallback={<div className="min-h-screen" style={{ background: 'rgb(var(--surface-950))' }} />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { hasAccess } = useFeatureFlags();
  // const googleAuthEnabled = hasAccess('google_auth_enabled');
  const googleAuthEnabled = false;
  
  const redirect = searchParams.get('redirect') || '/dashboard';
  const [loading, setLoading] = useState(false);
  const urlError = searchParams.get('error');
  const [error, setError] = useState(urlError ? friendlyAuthError(decodeURIComponent(urlError)) : '');

  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const doLogin = useCallback(async () => {
    const emailVal = emailRef.current?.value || '';
    const passVal = passwordRef.current?.value || '';

    if (!emailVal || !passVal) {
      setError(!emailVal && !passVal ? 'Both fields are empty' : !emailVal ? 'Email is empty' : 'Password is empty');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailVal,
        password: passVal,
      });

      if (authError) {
        setError(friendlyAuthError(authError.message));
        setLoading(false);
        return;
      }

      fetch('/api/auth/track-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'email', success: true }),
      }).catch((err) => logger.error('Auth', 'Failed to track login:', err));

      sessionStorage.setItem('ss_session_active', '1');
      window.location.href = redirect;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown';
      setError(friendlyAuthError(message));
      setLoading(false);
    }
  }, [redirect]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    doLogin();
  };

  const handleButtonClick = () => {
    if (!loading) doLogin();
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // The code-exchange route lives at /auth/callback. /api/auth/callback
          // does not exist, so Google sent everyone to a 404 and no session was
          // ever created. The redirect target is encoded so paths with their own
          // query strings survive the round trip.
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setError(friendlyAuthError(err instanceof Error ? err.message : 'Google sign-in failed.'));
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: 'rgb(var(--surface-950))' }}
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
              <span className="font-semibold text-white text-sm" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-xs font-medium text-white/45 group-hover:text-white/70 transition-colors">
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
            <h1 className="text-2xl font-semibold text-white" style={{ letterSpacing: '-0.03em' }}>
              {t('auth.welcome_back')}
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
              <label className="ss-input-label">{t('auth.email')}</label>
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
              <label className="ss-input-label">{t('auth.password')}</label>
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
                className="text-xs text-white/50 hover:text-white/75 transition-colors"
              >
                {t('auth.forgot_password')}
              </Link>
            </div>

            <button
              type="submit"
              className="ss-btn-orange w-full"
              onClick={handleButtonClick}
              disabled={loading}
            >
              {loading ? t('auth.signing_in') : t('auth.login')}
            </button>
          </form>

          {googleAuthEnabled && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-white/45">Or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded font-medium text-sm transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>
            </div>
          )}

          <div
            className="mt-8 pt-6 text-center"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            {/* Use without account — Electron mode only */}
            {isElectronMode() && (
              <button
                onClick={() => {
                  createLocalUser();
                  window.location.href = redirect;
                }}
                className="w-full mb-4 h-10 flex items-center justify-center text-sm text-white/55 hover:text-white/80 transition-colors border hover:border-white/20"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                Use without account
              </button>
            )}
            <p className="text-xs text-white/50">
              <Link href="/auth/register" className="hover:opacity-70 transition-opacity" style={{ color: '#FF5F1F' }}>
                {t('auth.no_account')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
