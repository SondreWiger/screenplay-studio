'use client';

export default function ShotListModule() {
  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white mb-4">Shot List</h1>
        <p className="text-surface-300 text-lg leading-relaxed max-w-3xl">
          Translate your script into visual directions. The Shot List tool helps you plan the camera angles, movements, and framing required to bring your scenes to life on set.
        </p>
      </div>

      {/* Anatomy of a Shot */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Anatomy of a Shot</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
            <h3 className="text-brand-400 font-semibold mb-2 text-lg">Shot Types</h3>
            <p className="text-sm text-surface-400 leading-relaxed mb-4">
              Use standard abbreviations to define how close the camera is to your subject.
            </p>
            <ul className="grid grid-cols-2 gap-2 text-sm text-surface-300">
              <li className="flex flex-col p-2 bg-surface-800/50 rounded-lg">
                <span className="font-bold text-white">WS</span>
                <span className="text-[10px] text-surface-500">Wide Shot</span>
              </li>
              <li className="flex flex-col p-2 bg-surface-800/50 rounded-lg">
                <span className="font-bold text-white">MS</span>
                <span className="text-[10px] text-surface-500">Medium Shot</span>
              </li>
              <li className="flex flex-col p-2 bg-surface-800/50 rounded-lg">
                <span className="font-bold text-white">CU</span>
                <span className="text-[10px] text-surface-500">Close Up</span>
              </li>
              <li className="flex flex-col p-2 bg-surface-800/50 rounded-lg">
                <span className="font-bold text-white">ECU</span>
                <span className="text-[10px] text-surface-500">Extreme Close Up</span>
              </li>
            </ul>
          </div>
          <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
            <h3 className="text-brand-400 font-semibold mb-2 text-lg">Angles & Movement</h3>
            <p className="text-sm text-surface-400 leading-relaxed mb-4">
              Describe how the camera sees the subject and how it moves through space.
            </p>
            <ul className="space-y-2 text-sm text-surface-300">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> High Angle / Low Angle</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> Pan / Tilt</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> Tracking / Dolly</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> Handheld / Steadicam</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Building the List */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Building Your Shot List</h2>
        <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
          <p className="text-sm text-surface-300 leading-relaxed mb-6">
            The shot list is organised by scene. You can add as many shots as you need to cover the action.
          </p>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-surface-800 text-surface-400 flex items-center justify-center shrink-0 font-bold">1</div>
              <div>
                <h4 className="font-medium text-surface-50">Select a Scene</h4>
                <p className="text-sm text-surface-400">Choose the scene you want to break down from the scene dropdown.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-surface-800 text-surface-400 flex items-center justify-center shrink-0 font-bold">2</div>
              <div>
                <h4 className="font-medium text-surface-50">Add a Shot</h4>
                <p className="text-sm text-surface-400">Click the <span className="px-1.5 py-0.5 rounded-md bg-brand-500 text-white text-xs font-medium">+ Add Shot</span> button to create a new row.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-surface-800 text-surface-400 flex items-center justify-center shrink-0 font-bold">3</div>
              <div>
                <h4 className="font-medium text-surface-50">Fill in Details</h4>
                <p className="text-sm text-surface-400">Specify the Shot Size (e.g. CU), Shot Type (e.g. Over the Shoulder), Movement (e.g. Static), and Equipment.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-surface-800 text-surface-400 flex items-center justify-center shrink-0 font-bold">4</div>
              <div>
                <h4 className="font-medium text-surface-50">Describe the Action</h4>
                <p className="text-sm text-surface-400">Use the Description field to explain exactly what is happening in the frame.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Estimating Time */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">Setup & Duration</h2>
        <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-6">
          <p className="text-sm text-surface-300 leading-relaxed mb-4">
            For production planning, you can estimate how long each shot will take.
          </p>
          <ul className="space-y-2 text-sm text-surface-300">
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> <span className="font-bold text-white">Setup Time:</span> How long it takes to light and position the camera.</li>
            <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-surface-600"/> <span className="font-bold text-white">Action Time:</span> How long the shot itself takes to perform.</li>
          </ul>
          <p className="text-xs text-surface-500 mt-4 italic">
            Tip: These estimates will eventually integrate with Call Sheets to help you schedule your shoot day.
          </p>
        </div>
      </section>
    </div>
  );
}
