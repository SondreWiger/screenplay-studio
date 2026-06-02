export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-surface-950 p-4 md:p-8 animate-pulse">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="h-8 w-48 rounded-lg bg-surface-800" />
          <div className="h-10 w-32 rounded-lg bg-surface-800" />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-800 bg-surface-900 p-4">
              <div className="h-3 w-16 rounded bg-surface-800/50 mb-2" />
              <div className="h-7 w-12 rounded bg-surface-800" />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-lg bg-surface-800/50" />
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-surface-800 overflow-hidden">
          <div className="bg-surface-900/50 px-4 py-3 flex gap-4 border-b border-surface-800">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-3 rounded bg-surface-800/50" style={{ width: `${20 + i * 5}%` }} />
            ))}
          </div>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="border-b border-surface-800/50 px-4 py-3 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-surface-800" />
              <div className="h-4 flex-1 rounded bg-surface-800/50" />
              <div className="h-4 w-24 rounded bg-surface-800/40" />
              <div className="h-5 w-16 rounded-full bg-surface-800/50" />
              <div className="h-4 w-20 rounded bg-surface-800/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
