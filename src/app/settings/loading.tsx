export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-surface-950 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl animate-pulse">
        <div className="mb-8 h-8 w-32 rounded-lg bg-surface-800" />
        <div className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-surface-800/60" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-48 rounded-xl bg-surface-800/50" />
            <div className="h-32 rounded-xl bg-surface-800/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
