'use client';

export default function WorldbuildingModule() {
  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-4">Worldbuilding</h1>
        <p className="text-surface-300 text-lg leading-relaxed max-w-3xl">
          Flesh out your universe. The Worldbuilding tool is your central repository for characters, locations, items, and lore, keeping all your contextual information organised and accessible.
        </p>
      </div>

      {/* Categories */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Core Categories</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white">Characters</h3>
            </div>
            <p className="text-sm text-surface-400 leading-relaxed">
              Track character profiles, motivations, physical descriptions, and arcs. Character names can link directly to dialogue in the Script Editor.
            </p>
          </div>
          
          <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white">Locations</h3>
            </div>
            <p className="text-sm text-surface-400 leading-relaxed">
              Define the settings of your story. Add reference images, historical context, and link them to scene headings.
            </p>
          </div>

          <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white">Items (MacGuffins)</h3>
            </div>
            <p className="text-sm text-surface-400 leading-relaxed">
              Important props, weapons, or key items that drive the plot forward.
            </p>
          </div>

          <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white">Lore & Rules</h3>
            </div>
            <p className="text-sm text-surface-400 leading-relaxed">
              Magic systems, historical events, cultural norms, and the fundamental rules that govern your fictional world.
            </p>
          </div>
        </div>
      </section>

      {/* Creating an Entity */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Creating an Entity</h2>
        <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
          <p className="text-sm text-surface-300 leading-relaxed mb-6">
            Each piece of lore or character is an "Entity".
          </p>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-surface-800 text-surface-400 flex items-center justify-center shrink-0 font-bold">1</div>
              <div>
                <h4 className="font-medium text-surface-50">Add New</h4>
                <p className="text-sm text-surface-400">Click the <span className="px-1.5 py-0.5 rounded-md bg-brand-500 text-white text-xs font-medium">+ New Entity</span> button.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-surface-800 text-surface-400 flex items-center justify-center shrink-0 font-bold">2</div>
              <div>
                <h4 className="font-medium text-surface-50">Select Category</h4>
                <p className="text-sm text-surface-400">Choose whether it's a Character, Location, Item, or general Lore.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-surface-800 text-surface-400 flex items-center justify-center shrink-0 font-bold">3</div>
              <div>
                <h4 className="font-medium text-surface-50">Add Details</h4>
                <p className="text-sm text-surface-400">Upload a reference image, write a brief summary, and add detailed rich-text notes about the entity.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
