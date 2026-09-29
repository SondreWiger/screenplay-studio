'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * "Didn't get the email?" — resends the signup confirmation. Confirmation
 * emails regularly land in spam or get delayed, and without this the only way
 * forward was to register again (which silently does nothing for an existing
 * address).
 */
export function ResendConfirmation({ email, className }: { email: string; className?: string }) {
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const resend = async () => {
    setStatus('sending');
    const { error } = await createClient().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?redirect=%2Fdashboard` },
    });
    if (error) {
      setStatus('error');
      setMessage(/rate|too many|seconds/i.test(error.message)
        ? 'Please wait a minute before asking for another email.'
        : "Couldn't resend right now. Try again shortly.");
    } else {
      setStatus('sent');
      setMessage('Sent. Check your inbox and spam folder.');
    }
    setCooldown(60);
  };

  return (
    <div className={className ?? 'mb-6 text-xs text-white/45'}>
      <p className="mb-2">Didn&apos;t get it? Check your spam folder, or</p>
      <button
        type="button"
        onClick={resend}
        disabled={status === 'sending' || cooldown > 0}
        className="rounded-lg border border-white/15 px-3 py-1.5 font-medium text-white/80 hover:bg-white/5 disabled:opacity-50"
      >
        {status === 'sending' ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend confirmation email'}
      </button>
      {message && <p className={`mt-2 ${status === 'error' ? 'text-red-400' : 'text-emerald-400'}`} role="status">{message}</p>}
    </div>
  );
}
