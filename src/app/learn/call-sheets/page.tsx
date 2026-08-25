'use client';

export default function CallSheetsModule() {
  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white mb-4">Call Sheets</h1>
        <p className="text-surface-300 text-lg leading-relaxed max-w-3xl">
          Organise your shoot day. Call Sheets tell your cast and crew where to be, when to be there, and what they'll be doing.
        </p>
      </div>

      {/* Generating a Call Sheet */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Generating a Call Sheet</h2>
        <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
          <p className="text-sm text-surface-300 leading-relaxed mb-6">
            You can create a call sheet for any day of your shoot.
          </p>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-surface-800 text-surface-400 flex items-center justify-center shrink-0 font-bold">1</div>
              <div>
                <h4 className="font-medium text-surface-50">New Call Sheet</h4>
                <p className="text-sm text-surface-400">Click the <span className="px-1.5 py-0.5 rounded-md bg-brand-500 text-white text-xs font-medium">New Call Sheet</span> button in the Call Sheets tab.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-surface-800 text-surface-400 flex items-center justify-center shrink-0 font-bold">2</div>
              <div>
                <h4 className="font-medium text-surface-50">Select Date & Location</h4>
                <p className="text-sm text-surface-400">Set the date of the shoot and the primary location (Basecamp).</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-surface-800 text-surface-400 flex items-center justify-center shrink-0 font-bold">3</div>
              <div>
                <h4 className="font-medium text-surface-50">General Call Time</h4>
                <p className="text-sm text-surface-400">Set the time when the majority of the crew needs to arrive.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Anatomy of a Call Sheet */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Anatomy of a Call Sheet</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
            <h3 className="text-brand-400 font-semibold mb-2 text-lg">Schedule (Scenes)</h3>
            <p className="text-sm text-surface-400 leading-relaxed mb-4">
              List the scenes you plan to shoot that day. This schedule forms the core of the call sheet.
            </p>
            <ul className="space-y-2 text-sm text-surface-300">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> Add scenes directly from your script.</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> Specify the estimated time for each scene.</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> Characters needed for the scene will be automatically highlighted.</li>
            </ul>
          </div>
          <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
            <h3 className="text-brand-400 font-semibold mb-2 text-lg">Cast & Crew Calls</h3>
            <p className="text-sm text-surface-400 leading-relaxed mb-4">
              Not everyone arrives at the same time. Specify individual call times.
            </p>
            <ul className="space-y-2 text-sm text-surface-300">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> <span className="font-bold text-white">Cast Call:</span> Time the actor arrives.</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> <span className="font-bold text-white">HMU:</span> Time for Hair and Make-Up.</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> <span className="font-bold text-white">Set Call:</span> Time they are needed on set, ready to shoot.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Advanced Features */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Advanced Details</h2>
        <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
          <p className="text-sm text-surface-300 leading-relaxed mb-4">
            A professional call sheet includes essential logistics:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-surface-800/30 rounded-xl">
              <h4 className="font-medium text-surface-50 text-sm mb-1">Weather & Hospital</h4>
              <p className="text-xs text-surface-400">Important safety information. Include the nearest hospital address and forecasted weather.</p>
            </div>
            <div className="p-4 bg-surface-800/30 rounded-xl">
              <h4 className="font-medium text-surface-50 text-sm mb-1">Advance Schedule</h4>
              <p className="text-xs text-surface-400">A brief look at what is being shot the *next* day, so the crew can prepare.</p>
            </div>
            <div className="p-4 bg-surface-800/30 rounded-xl">
              <h4 className="font-medium text-surface-50 text-sm mb-1">Important Notes</h4>
              <p className="text-xs text-surface-400">Parking instructions, dietary restrictions, or specific gear requirements.</p>
            </div>
             <div className="p-4 bg-surface-800/30 rounded-xl">
              <h4 className="font-medium text-surface-50 text-sm mb-1">Exporting</h4>
              <p className="text-xs text-surface-400">Export the call sheet as a PDF to easily distribute it to your cast and crew via email.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
