'use client';

export default function BeatBoardModule() {
  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-4">Beat Board</h1>
        <p className="text-surface-300 text-lg leading-relaxed max-w-3xl">
          Visualise your story's structure. The Beat Board allows you to organise your ideas into acts, sequences, and beats using a flexible Kanban-style interface.
        </p>
      </div>

      {/* Anatomy of the Board */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Anatomy of the Board</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
            <h3 className="text-brand-400 font-semibold mb-2 text-lg">Acts & Sequences</h3>
            <p className="text-sm text-surface-400 leading-relaxed mb-4">
              Columns represent Acts or Sequences. Use them to establish the structural backbone of your screenplay (e.g. Act I, Act IIa, Act IIb, Act III).
            </p>
            <ul className="space-y-2 text-sm text-surface-300">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> Add a column with the <span className="px-1.5 py-0.5 rounded-md bg-surface-800 text-surface-50 text-xs font-medium border border-surface-700">+ Add Act</span> button.</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> Drag and drop columns by their headers to reorder your story structure.</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> Click the column title to rename it.</li>
            </ul>
          </div>
          <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
            <h3 className="text-brand-400 font-semibold mb-2 text-lg">Beats (Cards)</h3>
            <p className="text-sm text-surface-400 leading-relaxed mb-4">
              Cards represent individual story beats, scenes, or ideas. They live inside your columns and contain the details of your story.
            </p>
            <ul className="space-y-2 text-sm text-surface-300">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> Click a card to open its detail view.</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> Add colour tags to track storylines (A-story, B-story) or character arcs.</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> Drag cards between columns to change when they occur.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Writing & Detail View */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">The Beat Detail View</h2>
        <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
          <p className="text-sm text-surface-300 leading-relaxed mb-6">
            Clicking on any beat card opens the detail inspector. Here you can flesh out the beat without cluttering the main board.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h4 className="font-medium text-surface-50 text-sm">Title & Summary</h4>
              </div>
              <p className="text-xs text-surface-400">Give your beat a punchy title and write a concise summary of what happens.</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                </div>
                <h4 className="font-medium text-surface-50 text-sm">Colour Coding</h4>
              </div>
              <p className="text-xs text-surface-400">Assign a colour to visually group related beats across your entire board.</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                </div>
                <h4 className="font-medium text-surface-50 text-sm">Rich Text Notes</h4>
              </div>
              <p className="text-xs text-surface-400">Add detailed notes, snippets of dialogue, or visual ideas in the expanded notes area.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Integration */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Syncing with your Script</h2>
        <div className="bg-brand-500/5 border border-brand-500/20 rounded-2xl p-6">
          <p className="text-sm text-brand-100 leading-relaxed">
            The Beat Board is designed to be your outlining tool. Currently, the Beat Board serves as a standalone structural document. In future updates, you will be able to push your beats directly into the Script Editor to generate your scene headings automatically.
          </p>
        </div>
      </section>
    </div>
  );
}
