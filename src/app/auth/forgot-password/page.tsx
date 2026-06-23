'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/components/TranslationProvider';

function friendlyResetError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('rate limit') || m.includes('too many') || m.includes('over_email_send_rate_limit')) {
    return 'Too many reset requests. Please wait a few minutes before trying again.';
  }
  if (m.includes('invalid email') || m.includes('unable to validate')) {
    return 'Please enter a valid email address.';
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch')) {
    return 'Network error — please check your connection and try again.';
  }
  return msg;
}

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  // Track the email that was actually submitted (handles autofill)
  const [sentEmail, setSentEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Read from DOM to capture autofilled values React state may have missed
    const form = e.currentTarget;
    const formEmail = (form.elements.namedItem('email') as HTMLInputElement)?.value?.trim() || email.trim();

    if (!formEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(formEmail, {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/settings`,
      });

      if (resetError) {
        setError(friendlyResetError(resetError.message));
        setLoading(false);
        return;
      }

      setSentEmail(formEmail);
      setSent(true);
    } catch (err: unknown) {
      setError(friendlyResetError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'));
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ background: 'rgb(var(--surface-950))' }}>
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
            <span className="ss-label">{t('auth.reset_link_sent')}</span>
            <div className="w-3 h-px" style={{ background: '#FF5F1F' }} />
          </div>
          <h1 className="text-2xl font-black text-white mb-3" style={{ letterSpacing: '-0.03em' }}>{t('auth.check_email')}</h1>
          <p className="text-sm text-white/35 mb-8 leading-relaxed">
            {t('auth.reset_check_inbox')}{' '}
            <span className="text-white font-mono">{sentEmail}</span>,
            {t('auth.reset_check_spam')}
          </p>
          <Link href="/auth/login" className="text-[11px] font-mono uppercase tracking-widest hover:opacity-60 transition-opacity" style={{ color: '#FF5F1F' }}>
            {t('auth.back_to_signin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ background: 'rgb(var(--surface-950))' }}>
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
              <span className="ss-label">{t('auth.password_reset')}</span>
            </div>
            <h1 className="text-2xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>{t('auth.password_reset')}</h1>
            <p className="mt-1 text-sm text-white/30">
              {t('auth.reset_instruction')}
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
              <label className="ss-input-label">{t('auth.email')}</label>
              <input
                className="ss-input w-full"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="ss-btn-orange w-full" disabled={loading}>
              {loading ? t('auth.sending') : t('auth.send_reset_link')}
            </button>
          </form>

          <div className="mt-8 pt-6 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[11px] font-mono text-white/25 uppercase tracking-widest">
              <Link href="/auth/login" className="hover:opacity-70 transition-opacity" style={{ color: '#FF5F1F' }}>
                {t('auth.remember_it')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
