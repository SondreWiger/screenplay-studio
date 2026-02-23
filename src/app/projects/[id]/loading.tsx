export default function ProjectLoading() {
  return (
    <div className="flex min-h-screen bg-surface-950">
      {/* Sidebar skeleton */}
      <aside className="hidden w-56 shrink-0 border-r border-surface-800 bg-surface-900 p-4 lg:block">
        <div className="mb-6 h-6 w-32 rounded bg-surface-800 animate-pulse" />
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-surface-800/60 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </aside>
      {/* Content skeleton */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-pulse">
        <div className="mb-6 h-7 w-64 rounded-lg bg-surface-800" />
        <div className="space-y-4">
          <div className="h-40 rounded-xl bg-surface-800/50" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-surface-800/40" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
