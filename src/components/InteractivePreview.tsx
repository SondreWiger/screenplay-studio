'use client';

import { useState } from 'react';

interface StoryBeat {
  id: string;
  name: string;
  act: string;
  page: number;
  elevation: number; // dramatic tension percentage
  intensity: string;
  excerpt: string;
  log: string;
}

const STORY_BEATS: StoryBeat[] = [
  {
    id: 'beat-1',
    name: '01 / Incident',
    act: 'Act I — Departure',
    page: 12,
    elevation: 320,
    intensity: '320m (Base Ascent)',
    excerpt: 'INT. OBSERVER STATION - NIGHT\n\nDr. Vance locks the coordinates. The telescope positioning dial clicks. On the monitor, the satellite signals drop to absolute zero.',
    log: 'Tension initiates. Standard frequency disrupted.'
  },
  {
    id: 'beat-2',
    name: '02 / Plot Point I',
    act: 'Act IIA — Descent',
    page: 28,
    elevation: 540,
    intensity: '540m (Steep Rise)',
    excerpt: 'EXT. DESERT RIDGE - NIGHT\n\nThe sky doesn\'t just turn black; it turns empty. A shadow moves across the stars. Vance looks through her binoculars, hands shaking.',
    log: 'Ascent accelerates. Visual anomalies verified.'
  },
  {
    id: 'beat-3',
    name: '03 / Midpoint',
    act: 'Act IIB — Confrontation',
    page: 60,
    elevation: 780,
    intensity: '780m (Sub-Peak)',
    excerpt: 'INT. CONTROL CENTER - DAY\n\nMark slams his hands on the metal console. The backup power grid fails. "It\'s not blocking the light," he whispers. "It\'s absorbing it."',
    log: 'Atmospheric pressure critical. Local power grid collapse.'
  },
  {
    id: 'beat-4',
    name: '04 / Climax',
    act: 'Act III — Resolution',
    page: 95,
    elevation: 1240,
    intensity: '1240m (Summit)',
    excerpt: 'EXT. ARRAY SITE - CONTINUOUS\n\nThe midnight eclipse is complete. Silence falls over the desert. Vance stands directly beneath the massive receiver dishes as the air turns to ice.',
    log: 'Dramatic peak reached. System equilibrium at absolute zero.'
  }
];

export function InteractivePreview() {
  const [activeBeatId, setActiveBeatId] = useState<string>('beat-1');
  const activeBeat = STORY_BEATS.find((b) => b.id === activeBeatId) || STORY_BEATS[0];

  return (
    <div className="w-full border border-white/[0.05] bg-black/40 rounded-lg p-6 md:p-8 flex flex-col font-sans select-none relative overflow-hidden">
      
      {/* ─── TITLE / SYSTEM DECORATION ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.05] pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgb(var(--brand-500))' }} />
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/30">NARRATIVE TOPOGRAPHY</span>
          </div>
          <h3 className="text-sm font-black uppercase tracking-wider text-white">THE GEOGRAPHY OF A STORY</h3>
        </div>
        <div className="flex items-center gap-6 font-mono text-[9px] text-white/20">
          <span>SCALE: 1 PAGE = 12 METERS</span>
          <span>UNIT: METERS OF DRAMATIC TENSION</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT PANEL: SVG CONTOUR MAP (Topography Visual) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative">
          
          {/* Elevation crosshair markers */}
          <div className="absolute top-0 left-0 font-mono text-[8px] text-white/10">N 59° 56\' 23"</div>
          <div className="absolute bottom-0 right-0 font-mono text-[8px] text-white/10">E 10° 45\' 18"</div>
          
          <div className="w-full max-w-[460px] aspect-square relative flex items-center justify-center border border-white/[0.03] bg-black/10 rounded-full">
            
            {/* Concentric Topographic Contours (SVGs) */}
            <svg className="absolute inset-0 w-full h-full p-6 text-white/[0.04]" viewBox="0 0 100 100" fill="none" stroke="currentColor">
              {/* Outer Contour Ring 1 */}
              <path d="M 50 2 C 78 2, 98 22, 98 50 C 98 78, 78 98, 50 98 C 22 98, 2 78, 2 50 C 2 22, 22 2 Z" strokeWidth="0.15" />
              
              {/* Contour Ring 2 */}
              <path d="M 50 12 C 72 12, 88 28, 88 50 C 88 72, 72 88, 50 88 C 28 88, 12 72, 12 50 C 12 28, 28 12, 50 12 Z" strokeWidth="0.15" />
              
              {/* Contour Ring 3 */}
              <path d="M 50 24 C 65 24, 76 35, 76 50 C 76 65, 65 76, 50 76 C 35 76, 24 65, 24 50 C 24 35, 35 24, 50 24 Z" strokeWidth="0.15" strokeDasharray="1 1" />
              
              {/* Inner Contour Ring 4 (High Ridge) */}
              <path d="M 50 36 C 58 36, 64 42, 64 50 C 64 58, 58 64, 50 64 C 42 64, 36 58, 36 50 C 36 42, 42 36, 50 36 Z" strokeWidth="0.2" />

              {/* Peak Summit Ring */}
              <path d="M 50 44 C 53 44, 56 47, 56 50 C 56 53, 53 56, 50 56 C 47 56, 44 53, 44 50 C 44 47, 47 44, 50 44 Z" strokeWidth="0.3" stroke="rgba(var(--brand-500), 0.2)" />
              
              {/* Crosshair Center */}
              <line x1="50" y1="48" x2="50" y2="52" stroke="rgb(var(--brand-500))" strokeWidth="0.4" />
              <line x1="48" y1="50" x2="52" y2="50" stroke="rgb(var(--brand-500))" strokeWidth="0.4" />
            </svg>

            {/* Interactive Beat Coordinates */}
            {STORY_BEATS.map((beat, idx) => {
              // Placing beats in a spiral-like ascent towards the peak
              const angles = [210, 310, 45, 120];
              const radii = [42, 30, 20, 9]; // Distances from center (50, 50)
              const angleRad = (angles[idx] * Math.PI) / 180;
              const x = 50 + radii[idx] * Math.cos(angleRad);
              const y = 50 + radii[idx] * Math.sin(angleRad);

              const isActive = beat.id === activeBeatId;

              return (
                <button
                  key={beat.id}
                  onClick={() => setActiveBeatId(beat.id)}
                  className="absolute group transition-all duration-300"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {/* Glowing Node ring */}
                  <span
                    className={`absolute inset-0 rounded-full border transition-transform duration-300 scale-150 ${
                      isActive
                        ? 'border-brand-500 animate-ping opacity-75'
                        : 'border-white/10 group-hover:scale-[2] group-hover:border-white/30'
                    }`}
                    style={{ borderColor: isActive ? 'rgb(var(--brand-500))' : undefined }}
                  />
                  
                  {/* Inner Node Dot */}
                  <span
                    className={`block w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      isActive ? 'bg-brand-500 scale-125' : 'bg-white/40 group-hover:bg-white'
                    }`}
                    style={{ background: isActive ? 'rgb(var(--brand-500))' : undefined }}
                  />

                  {/* Tiny label offset */}
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[9px] text-white/30 font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    {beat.name}
                  </span>
                </button>
              );
            })}

            {/* Aesthetic coordinate trails connecting nodes */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none text-white/[0.02]" viewBox="0 0 100 100" fill="none">
              <path d="M 13.6 71 L 27 27 L 64 36 L 54.5 42" stroke="currentColor" strokeWidth="0.2" strokeDasharray="0.5 0.5" />
            </svg>
          </div>
          
          {/* Quick Act indicators under map */}
          <div className="flex justify-between w-full mt-6 px-4">
            {STORY_BEATS.map((beat) => (
              <button
                key={beat.id}
                onClick={() => setActiveBeatId(beat.id)}
                className={`font-mono text-[8px] uppercase tracking-wider transition-all duration-300 ${
                  beat.id === activeBeatId
                    ? 'text-brand-500 font-bold'
                    : 'text-white/20 hover:text-white/40'
                }`}
                style={{ color: beat.id === activeBeatId ? 'rgb(var(--brand-500))' : undefined }}
              >
                {beat.name}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL: TECHNICAL READOUTS (Helvetica / Swiss Map Aesthetic) */}
        <div className="lg:col-span-5 flex flex-col justify-between border border-white/[0.05] bg-white/[0.01] p-6 rounded-md min-h-[360px]">
          <div>
            {/* Act Header */}
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-3 mb-5">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">NARRATIVE REGION</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: 'rgb(var(--brand-500))' }}>
                {activeBeat.act}
              </span>
            </div>

            {/* Readouts List */}
            <div className="space-y-4 font-mono text-[10px]">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-white/30 uppercase tracking-wider">elevation_alt</span>
                <span className="col-span-2 text-white/80">{activeBeat.intensity}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-white/30 uppercase tracking-wider">milestone_pg</span>
                <span className="col-span-2 text-white/80">Page {activeBeat.page} of 120</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-white/[0.03] pb-4">
                <span className="text-white/30 uppercase tracking-wider">telemetry</span>
                <span className="col-span-2 text-white/50">{activeBeat.log}</span>
              </div>
            </div>

            {/* Script Excerpt / Topography slice */}
            <div className="mt-5">
              <label className="block font-mono text-[8px] uppercase tracking-[0.25em] text-white/35 mb-2">TERRAIN EXCERPT</label>
              <div className="bg-black/40 border border-white/[0.03] p-4 rounded font-mono text-[10px] text-white/70 leading-relaxed whitespace-pre-wrap select-text h-[130px] overflow-y-auto">
                {activeBeat.excerpt}
              </div>
            </div>
          </div>

          {/* Compass / Elevation Index decoration */}
          <div className="mt-6 pt-4 border-t border-white/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-4 h-4 border border-white/20 rounded-full flex items-center justify-center animate-spin" style={{ animationDuration: '40s' }}>
                <span className="w-px h-2 bg-brand-500" style={{ background: 'rgb(var(--brand-500))' }} />
              </div>
              <span className="font-mono text-[8px] uppercase tracking-widest text-white/30">AZIMUTH N-12°</span>
            </div>
            <span className="font-mono text-[8px] text-white/25">PAGE GRADIENT INDEX: ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
