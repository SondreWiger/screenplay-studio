'use client';

import { useState, Suspense, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/components/TranslationProvider';

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
  const searchParams = useSearchParams();
  const { t } = useTranslation();
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
      const { data, error: authError } = await supabase.auth.signInWithPassword({
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
      }).catch(() => {});

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
                className="text-[11px] font-mono text-white/30 hover:text-white/60 transition-colors"
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

          <div
            className="mt-8 pt-6 text-center"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-[11px] font-mono text-white/25 uppercase tracking-widest">
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
