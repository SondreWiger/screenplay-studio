'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button, Input } from '@/components/ui';
import { validatePassword } from '@/lib/security';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordValidation = validatePassword(password);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Honeypot check
    if (honeypot) return;

    // Read from DOM to handle autofill edge cases
    const form = e.currentTarget;
    const formEmail = (form.elements.namedItem('email') as HTMLInputElement)?.value || email;
    const formPassword = (form.elements.namedItem('password') as HTMLInputElement)?.value || password;
    const formName = (form.elements.namedItem('name') as HTMLInputElement)?.value || fullName;

    if (!formName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!formEmail) {
      setError('Please enter your email');
      return;
    }
    if (!formPassword) {
      setError('Please enter a password');
      return;
    }

    setLoading(true);
    setError('');

    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy');
      setLoading(false);
      return;
    }

    if (!passwordValidation.valid) {
      setError(passwordValidation.issues[0]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: formEmail,
      password: formPassword,
      options: {
        data: {
          full_name: formName,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
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
            <span className="text-white font-mono">{email}</span>.
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
            <p className="mt-1 text-sm text-white/30">Get your screenwriting workspace set up in seconds</p>
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
                    { label: 'Special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
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
              disabled={loading || !agreedToTerms}
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
