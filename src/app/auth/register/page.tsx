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
      <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p className="text-surface-400 mb-8">
            We&apos;ve sent a verification link to <strong className="text-white">{email}</strong>.
            Click the link to activate your account.
          </p>
          <Link
            href="/auth/login"
            className="text-brand-400 hover:text-brand-300 text-sm font-medium"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="w-full max-w-md">
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
          <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
          <p className="text-sm text-surface-400 mb-8">Get your screenwriting workspace set up in seconds</p>

          <form onSubmit={handleRegister} noValidate className="space-y-4">
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
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <Input
              label="Full Name"
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div>
              <Input
                label="Password"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {[
                    { label: '8+ characters', met: password.length >= 8 },
                    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
                    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
                    { label: 'Number', met: /\d/.test(password) },
                    { label: 'Special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
                  ].map((rule) => (
                    <div key={rule.label} className="flex items-center gap-2 text-xs">
                      <span className={rule.met ? 'text-green-400' : 'text-surface-600'}>
                        <svg className="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {rule.met ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /> : <circle cx="12" cy="12" r="8" strokeWidth={2} />}
                        </svg>
                      </span>
                      <span className={rule.met ? 'text-surface-300' : 'text-surface-500'}>{rule.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500 focus:ring-offset-0"
              />
              <span className="text-xs text-surface-400">
                I agree to the{' '}
                <Link href="/legal/terms" className="text-brand-400 hover:text-brand-300 underline" target="_blank">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/legal/privacy" className="text-brand-400 hover:text-brand-300 underline" target="_blank">Privacy Policy</Link>
              </span>
            </label>

            <Button type="submit" className="w-full" loading={loading} disabled={!agreedToTerms}>
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-surface-400">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
