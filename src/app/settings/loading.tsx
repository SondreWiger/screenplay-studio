export default function SettingsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <aside className="w-full lg:w-56 shrink-0 animate-pulse">
          <div className="h-6 w-20 rounded bg-surface-800 mb-4" />
          <div className="space-y-1">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-surface-800/60" />
            ))}
          </div>
        </aside>
        <main className="flex-1 min-w-0 space-y-4 animate-pulse">
          <div className="h-8 w-40 rounded-lg bg-surface-800" />
          <div className="h-48 rounded-xl bg-surface-800/50" />
          <div className="h-32 rounded-xl bg-surface-800/40" />
        </main>
      </div>
    </div>
  );
}
