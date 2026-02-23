export default function CommunityLoading() {
  return (
    <div className="min-h-screen bg-surface-950 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="mb-8 h-8 w-40 rounded-lg bg-surface-800" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-800 bg-surface-900 p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-surface-800" />
                <div className="h-4 w-32 rounded bg-surface-800" />
              </div>
              <div className="mb-2 h-5 w-3/4 rounded bg-surface-800/60" />
              <div className="h-3 w-full rounded bg-surface-800/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
