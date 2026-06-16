'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-surface-950 text-white antialiased" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="mb-6 w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Something went wrong</h1>
          <p className="text-surface-400 text-center max-w-md mb-2">
            A critical error occurred. Please try again.
          </p>
          {error.digest && (
            <p className="text-xs text-surface-600 font-mono mb-8">Error ID: {error.digest}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="rounded-lg border border-surface-700 px-5 py-2.5 text-sm font-bold text-surface-300 hover:text-white hover:bg-surface-800 transition-colors"
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
