export default function BreakdownLoading() {
  return (
    <div className="min-h-screen bg-surface-950 p-4 md:p-8 animate-pulse">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="h-8 w-48 rounded-lg bg-surface-800" />
          <div className="h-10 w-24 rounded-lg bg-surface-800" />
        </div>

        {/* Summary chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 mb-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-800 bg-surface-900 p-3">
              <div className="h-4 w-12 rounded bg-surface-800 mb-1" />
              <div className="h-6 w-8 rounded bg-surface-800/60" />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-lg bg-surface-800/50" />
          ))}
        </div>

        {/* Table rows */}
        <div className="rounded-xl border border-surface-800 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="border-b border-surface-800/50 px-4 py-3 flex items-center gap-4">
              <div className="h-4 w-8 rounded bg-surface-800/40" />
              <div className="h-4 flex-1 rounded bg-surface-800/50" />
              <div className="h-4 w-12 rounded bg-surface-800/40" />
              <div className="h-4 w-12 rounded bg-surface-800/40" />
              <div className="h-4 w-10 rounded bg-surface-800/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
