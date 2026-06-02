export default function ScriptEditorLoading() {
  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-56 border-r border-surface-800 flex-col bg-surface-950 animate-pulse">
        <div className="p-3 border-b border-surface-800">
          <div className="h-4 w-20 rounded bg-surface-800 mb-3" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 w-full rounded bg-surface-800/50 mb-1.5" />
          ))}
        </div>
        <div className="p-3 flex-1">
          <div className="h-4 w-16 rounded bg-surface-800 mb-2" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-5 w-full rounded bg-surface-800/40 mb-1" />
          ))}
        </div>
      </div>

      {/* Editor skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar row 1 */}
        <div className="border-b border-surface-800/60 bg-surface-950/90 px-4 py-2 flex items-center gap-2">
          <div className="flex gap-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-7 w-16 rounded-md bg-surface-800/50" />
            ))}
          </div>
          <div className="flex-1" />
          <div className="h-4 w-16 rounded bg-surface-800/40" />
        </div>
        {/* Toolbar row 2 */}
        <div className="border-b border-surface-800 bg-surface-950/70 px-4 py-1 flex items-center gap-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-7 w-7 rounded-md bg-surface-800/40" />
          ))}
        </div>

        {/* Script content skeleton */}
        <div className="flex-1 overflow-hidden p-8 md:p-16">
          <div className="max-w-[8.5in] mx-auto space-y-6">
            {/* Page skeleton */}
            <div className="bg-white rounded-sm shadow-lg p-[1in] min-h-[11in]">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="mb-4" style={{ paddingLeft: i % 3 === 0 ? '0' : i % 3 === 1 ? '35%' : '15%', width: i % 3 === 2 ? '50%' : '100%' }}>
                  <div className="h-4 rounded bg-gray-200" style={{ width: `${50 + Math.random() * 40}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
