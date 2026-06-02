export default function ScheduleLoading() {
  return (
    <div className="min-h-screen bg-surface-950 p-4 md:p-8 animate-pulse">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="h-8 w-48 rounded-lg bg-surface-800" />
          <div className="flex gap-2">
            <div className="h-10 w-28 rounded-lg bg-surface-800" />
            <div className="h-10 w-24 rounded-lg bg-surface-800" />
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-surface-800" />
              <div className="h-3 w-16 rounded bg-surface-800/40" />
            </div>
          ))}
        </div>

        {/* Calendar skeleton */}
        <div className="rounded-xl border border-surface-800 overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-surface-800/30">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="bg-surface-900 p-2">
                <div className="h-3 w-8 rounded bg-surface-800/50 mx-auto mb-2" />
                <div className="h-20 rounded bg-surface-800/30" />
              </div>
            ))}
            {[...Array(35)].map((_, i) => (
              <div key={i} className="bg-surface-900/50 p-1 min-h-[80px]">
                <div className="h-3 w-4 rounded bg-surface-800/30 mb-1" />
                {i % 5 === 0 && <div className="h-4 rounded bg-surface-800/20 mb-0.5" />}
                {i % 7 === 0 && <div className="h-3 w-3/4 rounded bg-surface-800/15" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
