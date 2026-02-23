export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-surface-950 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl animate-pulse">
        {/* Header skeleton */}
        <div className="mb-8 flex items-center justify-between">
          <div className="h-8 w-48 rounded-lg bg-surface-800" />
          <div className="h-10 w-32 rounded-lg bg-surface-800" />
        </div>
        {/* Project cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-800 bg-surface-900 p-5">
              <div className="mb-3 h-5 w-3/4 rounded bg-surface-800" />
              <div className="mb-2 h-4 w-1/2 rounded bg-surface-800/60" />
              <div className="h-3 w-full rounded bg-surface-800/40" />
              <div className="mt-4 flex gap-2">
                <div className="h-6 w-16 rounded-full bg-surface-800/50" />
                <div className="h-6 w-16 rounded-full bg-surface-800/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
