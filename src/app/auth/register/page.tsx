'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { validatePassword } from '@/lib/auth/password';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { sendWelcomeEmailAction } from '@/lib/email-actions';
import logger from '@/lib/logger';
import { useTranslation } from '@/components/TranslationProvider';

// Map raw Supabase/auth error messages to user-friendly ones
function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('already registered') || m.includes('user already exists') || m.includes('email already in use')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('over_email_send_rate_limit')) {
    return 'Too many sign-up attempts. Please wait a few minutes and try again.';
  }
  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return 'Please enter a valid email address.';
  }
  if (m.includes('password') && m.includes('short')) {
    return 'Password is too short. Use at least 8 characters.';
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch')) {
    return 'Network error — please check your connection and try again.';
  }
  return msg;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasFeature } = useFeatureFlags();
  const { t } = useTranslation();
  const googleAuthEnabled = hasFeature('google_auth_enabled');
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  // Capture ref from ?ref= query param and persist to localStorage
  useEffect(() => {
    const ref = searchParams?.get('ref');
    if (ref) {
      try { localStorage.setItem('creator_ref', ref); } catch { /* ssr */ }
    }
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Read from the DOM so password-manager autofill is captured even
    // if React's onChange never fired (autofill doesn't always trigger it)
    const form = e.currentTarget;
    const formEmail = (form.elements.namedItem('email') as HTMLInputElement)?.value?.trim() || email.trim();
    const formPassword = (form.elements.namedItem('password') as HTMLInputElement)?.value || password;
    const formName = (form.elements.namedItem('name') as HTMLInputElement)?.value?.trim() || fullName.trim();

    setError('');

    // Client-side validation (in submission order so user sees the first issue)
    if (!formName) {
      setError('Please enter your full name.');
      return;
    }
    if (!formEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!formPassword) {
      setError('Please enter a password.');
      return;
    }
    // Validate against the actual DOM value, not the potentially-stale React state
    const pwValidation = validatePassword(formPassword);
    if (!pwValidation.valid) {
      setError(pwValidation.issues[0]);
      return;
    }
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);

    try {
      // Check if IP is banned before allowing signup
      try {
        const banCheck = await fetch('/api/auth/check-ban', { method: 'POST' });
        const banResult = await banCheck.json();
        if (banResult.banned) {
          setError(banResult.message);
          setLoading(false);
          return;
        }
      } catch { /* If ban check fails, allow signup to proceed */ }

      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email: formEmail,
        password: formPassword,
        options: {
          data: { full_name: formName },
        },
      });

      if (authError) {
        setError(friendlyAuthError(authError.message));
        setLoading(false);
        return;
      }

      // If Supabase returned a live session (email confirmation disabled),
      // go straight to the dashboard.
      // Track referral signup regardless of whether email confirmation is required.
      // Uses service-role API so no session needed at this point.
      if (data?.user?.id) {
        try {
          const ref = localStorage.getItem('creator_ref');
          if (ref) {
            fetch('/api/creator/track-signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ref_code: ref, new_user_id: data.user.id }),
            }).then(() => {
              try { localStorage.removeItem('creator_ref'); } catch { /* ok */ }
            }).catch((err) => logger.error('Auth', 'Failed to track referral signup:', err));
          }
        } catch { /* ok */ }

        // Send welcome email (best-effort, fire-and-forget)
        sendWelcomeEmailAction(formEmail, formName).catch((err) => logger.error('Auth', 'Failed to send welcome email:', err));
      }

      if (data?.session) {
        window.location.href = '/dashboard';
        return;
      }

      // Email confirmation required — show success screen.
      // Sync state to match what was actually submitted (handles autofill).
      setEmail(formEmail);
      setSuccessEmail(formEmail);
    } catch (err: unknown) {
      setError(friendlyAuthError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'));
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?redirect=/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setError(friendlyAuthError(err instanceof Error ? err.message : 'Google sign-in failed.'));
      setLoading(false);
    }
  };

  if (successEmail) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 relative"
        style={{ background: 'rgb(var(--surface-950))' }}
      >
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex items-center gap-2.5 mb-4 justify-center">
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
            <span className="ss-label">{t('auth.verify_email')}</span>
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
          </div>
          <h1 className="text-2xl font-black text-white mb-3" style={{ letterSpacing: '-0.03em' }}>{t('auth.check_email')}</h1>
          <p className="text-sm text-white/35 mb-8 leading-relaxed">
            {t('auth.verification_sent')}{' '}
            <span className="text-white font-mono">{successEmail}</span>.
            {t('auth.click_to_activate')}
          </p>
          <Link
            href="/auth/login"
            className="text-[11px] font-mono uppercase tracking-widest transition-opacity hover:opacity-60"
            style={{ color: '#FF5F1F' }}
          >
            {t('auth.back_to_signin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 relative"
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
              <span className="ss-label">New Account</span>
            </div>
            <h1 className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>
              {t('auth.create_account')}
            </h1>
            <p className="mt-1 text-sm text-white/30">{t('auth.free_no_card')}</p>
          </div>

          <form onSubmit={handleRegister} noValidate className="space-y-5">

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
              <label className="ss-input-label">{t('auth.full_name')}</label>
              <input
                className="ss-input w-full"
                type="text"
                name="name"
                autoComplete="name"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="ss-input-label">{t('auth.email')}</label>
              <input
                className="ss-input w-full"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="ss-input-label">{t('auth.password')}</label>
              <input
                className="ss-input w-full"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {password.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {[
                    { label: t('auth.password_rule_length'), met: password.length >= 8 },
                    { label: t('auth.password_rule_upper'), met: /[A-Z]/.test(password) },
                    { label: t('auth.password_rule_lower'), met: /[a-z]/.test(password) },
                    { label: t('auth.password_rule_number'), met: /\d/.test(password) },
                    { label: t('auth.password_rule_special'), met: /[^A-Za-z0-9]/.test(password) },
                  ].map((rule) => (
                    <div key={rule.label} className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 shrink-0"
                        style={{ background: rule.met ? '#FF5F1F' : 'rgba(255,255,255,0.15)' }}
                      />
                      <span
                        className="text-[11px] font-mono uppercase tracking-wider"
                        style={{ color: rule.met ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)' }}
                      >
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0"
                style={{ accentColor: '#FF5F1F' }}
              />
              <span className="text-[11px] font-mono text-white/30 leading-relaxed">
                {t('auth.agree_terms')}
              </span>
            </label>

            <button
              type="submit"
              className="ss-btn-orange w-full"
              disabled={loading}
            >
              {loading ? t('auth.creating_account') : t('auth.create_account')}
            </button>
          </form>

          {googleAuthEnabled && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] uppercase tracking-widest text-white/30 font-mono">Or</span>
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
                Continue with Google
              </button>
            </div>
          )}

          <div
            className="mt-8 pt-6 text-center"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-[11px] font-mono text-white/25 uppercase tracking-widest">
              <Link href="/auth/login" className="hover:opacity-70 transition-opacity" style={{ color: '#FF5F1F' }}>
                {t('auth.has_account')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}