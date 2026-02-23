import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-950 px-4 text-center">
      <div className="mb-6 text-surface-700">
        <svg className="mx-auto h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-5xl font-bold text-white">404</h1>
      <p className="mt-3 text-lg text-surface-400">This page doesn&apos;t exist or has been moved.</p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
        >
          Go Home
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-surface-700 bg-surface-900 px-5 py-2.5 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-800"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
