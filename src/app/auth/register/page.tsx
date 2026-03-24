'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button, Input } from '@/components/ui';
import { validatePassword } from '@/lib/security';

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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
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

  // Derived from React state for the strength indicator only.
  // Validation on submit uses the DOM value to handle autofill.
  const passwordStrength = validatePassword(password);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Honeypot — bots fill this, real users never see it
    if (honeypot) return;

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
            }).catch(() => {});
          }
        } catch { /* ok */ }
      }

      if (data?.session) {
        router.push('/dashboard');
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

  if (successEmail) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 relative"
        style={{ background: '#070710' }}
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
            <span className="ss-label">Verify Email</span>
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
          </div>
          <h1 className="text-2xl font-black text-white mb-3" style={{ letterSpacing: '-0.03em' }}>CHECK YOUR EMAIL</h1>
          <p className="text-sm text-white/35 mb-8 leading-relaxed">
            We sent a verification link to{' '}
            <span className="text-white font-mono">{successEmail}</span>.
            Click it to activate your account.
          </p>
          <Link
            href="/auth/login"
            className="text-[11px] font-mono uppercase tracking-widest transition-opacity hover:opacity-60"
            style={{ color: '#FF5F1F' }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 relative"
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
              <span className="ss-label">New Account</span>
            </div>
            <h1 className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>
              CREATE ACCOUNT
            </h1>
            <p className="mt-1 text-sm text-white/30">Free. No card. Takes about ten seconds.</p>
          </div>

          <form onSubmit={handleRegister} noValidate className="space-y-5">
            {/* Honeypot — hidden from real users, catches bots */}
            <div className="absolute -top-[9999px] -left-[9999px]" aria-hidden="true">
              <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

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
              <label className="ss-input-label">Full Name</label>
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
              <label className="ss-input-label">Email</label>
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
              <label className="ss-input-label">Password</label>
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
                    { label: '8+ characters', met: password.length >= 8 },
                    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
                    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
                    { label: 'Number', met: /\d/.test(password) },
                    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
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
                I agree to the{' '}
                <Link href="/legal/terms" className="text-white/50 hover:text-white underline transition-colors" target="_blank">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/legal/privacy" className="text-white/50 hover:text-white underline transition-colors" target="_blank">Privacy Policy</Link>
              </span>
            </label>

            <button
              type="submit"
              className="ss-btn-orange w-full"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div
            className="mt-8 pt-6 text-center"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-[11px] font-mono text-white/25 uppercase tracking-widest">
              Have an account?{' '}
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

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}