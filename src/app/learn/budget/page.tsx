'use client';

export default function BudgetModule() {
  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-4">Budget</h1>
        <p className="text-surface-300 text-lg leading-relaxed max-w-3xl">
          Track your production costs. The Budget tool provides a straightforward way to estimate expenses, track actual spending, and manage your financial resources across different departments.
        </p>
      </div>

      {/* Adding Items */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Adding Budget Items</h2>
        <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
          <p className="text-sm text-surface-300 leading-relaxed mb-6">
            Build your budget by adding individual line items for every anticipated cost.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
               <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">1</div>
                <div>
                  <h4 className="font-medium text-surface-50 text-sm">Add Item</h4>
                  <p className="text-xs text-surface-400">Click the <span className="px-1.5 py-0.5 rounded-md bg-surface-800 text-surface-50 text-[11px] font-medium border border-surface-700">+ Add Item</span> button.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">2</div>
                <div>
                  <h4 className="font-medium text-surface-50 text-sm">Category</h4>
                  <p className="text-xs text-surface-400">Assign the item to a department (e.g., Cast, Crew, Equipment, Locations).</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">3</div>
                <div>
                  <h4 className="font-medium text-surface-50 text-sm">Description</h4>
                  <p className="text-xs text-surface-400">Be specific (e.g., "Lead Actor Day Rate", "Cinema Camera Rental").</p>
                </div>
              </div>
            </div>
            <div className="bg-surface-800/30 rounded-xl p-4 border border-surface-700/50">
              <h4 className="font-medium text-brand-400 text-sm mb-2">Cost Breakdown</h4>
              <ul className="space-y-2 text-xs text-surface-300">
                <li className="flex justify-between items-center border-b border-surface-700/50 pb-1">
                  <span>Unit (e.g., Days, Items)</span>
                  <span className="font-mono bg-surface-900 px-1.5 py-0.5 rounded">Qty: 3</span>
                </li>
                 <li className="flex justify-between items-center border-b border-surface-700/50 pb-1">
                  <span>Rate per Unit</span>
                  <span className="font-mono bg-surface-900 px-1.5 py-0.5 rounded">$500</span>
                </li>
                <li className="flex justify-between items-center pt-1 text-white font-medium">
                  <span>Estimated Total</span>
                  <span className="font-mono text-brand-400">$1,500</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Tracking Expenses */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Tracking Actual Spending</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
            <h3 className="text-brand-400 font-semibold mb-2 text-lg">Estimated vs. Actual</h3>
            <p className="text-sm text-surface-400 leading-relaxed mb-4">
              Your budget isn't just for planning; it's a living document.
            </p>
            <ul className="space-y-2 text-sm text-surface-300">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-surface-600 mt-1.5 shrink-0"/> 
                <span><span className="font-bold text-white">Estimated Cost:</span> What you plan to spend based on your initial rates and quantities.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-surface-600 mt-1.5 shrink-0"/> 
                <span><span className="font-bold text-white">Actual Cost:</span> Enter the final amount paid once an expense is incurred.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-surface-600 mt-1.5 shrink-0"/> 
                <span><span className="font-bold text-white">Variance:</span> The tool automatically calculates the difference, showing if you are under or over budget.</span>
              </li>
            </ul>
          </div>
          <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6 flex flex-col justify-center">
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-surface-300">Total Budget</span>
                  <span className="font-mono text-lg font-bold text-white">$15,000</span>
                </div>
                <div className="w-full h-2 bg-surface-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: '65%' }}></div>
                </div>
                <div className="flex justify-between text-xs text-surface-400">
                  <span>Spent: $9,750</span>
                  <span>Remaining: $5,250</span>
                </div>
             </div>
             <p className="text-xs text-surface-500 text-center mt-6">
               Visual summaries help you understand your financial health at a glance.
             </p>
          </div>
        </div>
      </section>
    </div>
  );
}
