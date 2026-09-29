'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { validatePassword } from '@/lib/security';

/**
 * Where the password-reset email lands (via /auth/callback, which exchanges
 * the link's code for a session). Until this page existed the link signed the
 * user in and dropped them on Settings with no way to set a new password.
 */
export default function ResetPasswordPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const check = validatePassword(password);
    if (!check.valid) { setError(check.issues[0]); return; }
    if (password !== confirm) { setError("The passwords don't match."); return; }
    setSaving(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(/same/i.test(updateError.message)
        ? 'Choose a password different from your old one.'
        : "Couldn't update your password. The link may have expired — request a new one.");
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'rgb(var(--surface-950))' }}>
      <div className="w-full max-w-md">
        <Link href="/" className="mb-10 flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: '#FF5F1F' }}>
            <span className="font-semibold text-white text-sm" style={{ letterSpacing: '-0.04em' }}>SS</span>
          </div>
          <span className="text-xs font-medium text-white/45">Screenplay Studio</span>
        </Link>

        {hasSession === false ? (
          <>
            <h1 className="text-2xl font-semibold text-white mb-3">This link has expired</h1>
            <p className="text-sm text-white/45 mb-6">Password reset links work once and only for a limited time.</p>
            <Link href="/auth/forgot-password" className="ss-btn-primary inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
              Send a new link
            </Link>
          </>
        ) : done ? (
          <>
            <h1 className="text-2xl font-semibold text-white mb-3">Password updated</h1>
            <p className="text-sm text-white/45 mb-6">You&apos;re signed in and can use your new password from now on.</p>
            <Link href="/dashboard" className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
              Go to your projects
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold text-white mb-2">Choose a new password</h1>
              <p className="text-sm text-white/45">At least 8 characters, with upper- and lowercase letters, a number and a symbol.</p>
            </div>
            {error && (
              <div role="alert" className="px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                {error}
              </div>
            )}
            <div>
              <label className="ss-input-label" htmlFor="new-password">New password</label>
              <input id="new-password" className="ss-input w-full" type="password" autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="ss-input-label" htmlFor="confirm-password">Confirm new password</label>
              <input id="confirm-password" className="ss-input w-full" type="password" autoComplete="new-password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <button type="submit" disabled={saving || hasSession === null}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50">
              {saving ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
