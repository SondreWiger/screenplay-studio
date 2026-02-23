'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-950 px-4 text-center">
      <div className="mb-6 text-red-500/60">
        <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-surface-400">
        An unexpected error occurred. You can try again or go back to the dashboard.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-surface-600">Error ID: {error.digest}</p>
      )}
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
        >
          Try Again
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-surface-700 bg-surface-900 px-5 py-2.5 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-800"
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}
