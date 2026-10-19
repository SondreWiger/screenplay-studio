'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, LayoutGrid, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * "Log in with Screenplay Studio" on Cinderra lands here.
 *
 * Cinderra sends `state` and `redirect_uri`. Once the person is signed in here
 * and says yes, /api/cinderra/sso checks the redirect is Cinderra's own
 * callback and hands back where to go, carrying a signed two-minute assertion
 * of who they are. They arrive in Cinderra in the same account their embedded
 * boards use, so the mind maps and mood boards from their projects are there.
 */
function CinderraConsent() {
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const state = params.get('state') || '';
  const redirectUri = params.get('redirect_uri') || '';
  const valid = Boolean(state && redirectUri);

  useEffect(() => {
    if (loading || user || !valid) return;
    const here = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/auth/login?redirect=${encodeURIComponent(here)}`);
  }, [loading, user, valid]);

  const proceed = async () => {
    setBusy(true);
    setError('');
    const res = await fetch('/api/cinderra/sso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, redirect_uri: redirectUri }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.redirect) {
      setError(json.error || 'Could not sign you in to Cinderra. Start again from Cinderra.');
      setBusy(false);
      return;
    }
    window.location.href = json.redirect;
  };

  const name = user?.display_name || user?.full_name || user?.email || '';

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-surface-800 bg-surface-900 p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
            <LayoutGrid className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-surface-500">Sign in to</p>
            <h1 className="text-lg font-semibold text-white">Cinderra</h1>
          </div>
        </div>

        {!valid ? (
          <>
            <p className="mt-6 text-sm text-surface-300">
              This sign-in link is incomplete. Go back to Cinderra and choose
              &ldquo;Continue with Screenplay Studio&rdquo; again.
            </p>
            <Link href="/dashboard" className="mt-6 inline-flex text-sm font-medium text-brand-400 hover:text-brand-300">
              Go to your dashboard
            </Link>
          </>
        ) : loading || !user ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-surface-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your sign-in…
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm leading-relaxed text-surface-300">
              Continue to Cinderra as <span className="font-semibold text-white">{name}</span>.
              You&apos;ll find the mind maps, mood boards and idea boards from your
              Screenplay Studio projects there too.
            </p>
            <p className="mt-3 text-xs text-surface-500">
              Cinderra receives your name and profile picture. It never sees your password or email.
            </p>
            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-surface-700 px-4 py-2.5 text-sm font-medium text-surface-300 hover:text-white"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={proceed}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Continue to Cinderra
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CinderraOAuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-950" />}>
      <CinderraConsent />
    </Suspense>
  );
}
