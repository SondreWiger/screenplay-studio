'use client';

import { useState } from 'react';

type Tab = 'editor' | 'corkboard' | 'shots' | 'timeline';

interface Scene {
  id: string;
  num: string;
  slug: string;
  type: 'INT' | 'EXT';
  time: 'DAY' | 'NIGHT';
  desc: string;
  characters: string[];
  props: string[];
  shots: { num: string; size: string; angle: string; desc: string }[];
  tension: number; // 0 to 100
}

const SCENES: Scene[] = [
  {
    id: 's1',
    num: '01',
    slug: 'INT. OBSERVER STATION - NIGHT',
    type: 'INT',
    time: 'NIGHT',
    desc: 'Dr. Eleanor Vance adjusts the positioning dial on the telescope array. The hum of the massive machinery is the only sound.',
    characters: ['ELEANOR VANCE'],
    props: ['Telescope Console', 'Positioning Dial', 'Glow Stick'],
    tension: 30,
    shots: [
      { num: '1A', size: 'WS', angle: 'High Angle', desc: 'Establishing the dome space. Vance is a silhouette against the telescope.' },
      { num: '1B', size: 'MCU', angle: 'Eye Level', desc: 'Vance. Concentration and exhaustion show in her eyes.' },
      { num: '1C', size: 'CU', angle: 'Overhead', desc: 'The console dials rotating. Coordinates shifting rapidly.' }
    ]
  },
  {
    id: 's2',
    num: '02',
    slug: 'EXT. RIDGE - NIGHT',
    type: 'EXT',
    time: 'NIGHT',
    desc: 'Vance drives her vehicle to the edge of the overlook. The desert sky is clear, but a shadow starts encroaching the stars.',
    characters: ['ELEANOR VANCE'],
    props: ['SUV', 'Flashlight', 'Binoculars'],
    tension: 65,
    shots: [
      { num: '2A', size: 'ELS', angle: 'Wide Profile', desc: 'The SUV headlights cutting through the pitch black desert.' },
      { num: '2B', size: 'MS', angle: 'Low Angle', desc: 'Vance stepping out of the vehicle, looking up at the sky.' }
    ]
  },
  {
    id: 's3',
    num: '03',
    slug: 'INT. LAB - NIGHT',
    type: 'INT',
    time: 'NIGHT',
    desc: 'The screens flicker with static. Mark Thorne paces the floor, holding a printout of the satellite telemetry.',
    characters: ['MARK THORNE'],
    props: ['Satellite Printout', 'Flickering Monitor', 'Cold Coffee Cup'],
    tension: 85,
    shots: [
      { num: '3A', size: 'WS', angle: 'Static', desc: 'Pacing the lab. The green monitor light casting long shadows.' },
      { num: '3B', size: 'CU', angle: 'Macro', desc: 'The paper printout. Numbers dropping to absolute zero.' }
    ]
  },
  {
    id: 's4',
    num: '04',
    slug: 'EXT. SKY - CONTINUOUS',
    type: 'EXT',
    time: 'NIGHT',
    desc: 'The moon begins to cross the path of the sun. An eclipse in the middle of midnight.',
    characters: [],
    props: [],
    tension: 95,
    shots: [
      { num: '4A', size: 'XLS', angle: 'Extreme Tilt Up', desc: 'The black sphere of the moon covering the dark sky.' }
    ]
  }
];

export function InteractivePreview() {
  const [activeTab, setActiveTab] = useState<Tab>('editor');
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);
  const selectedScene = SCENES[selectedSceneIndex];

  return (
    <div className="w-full border border-white/[0.06] bg-white/[0.01] rounded-lg overflow-hidden flex flex-col font-sans">
      {/* ─── TAB BAR ─── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 bg-black/45">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgb(var(--brand-500))' }} />
          <span className="text-[10px] font-mono tracking-widest text-white/50 uppercase">workspace_preview</span>
        </div>
        <div className="flex border border-white/[0.08] rounded overflow-hidden">
          {(['editor', 'corkboard', 'shots', 'timeline'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider transition-all border-r border-white/[0.08] last:border-r-0 ${
                activeTab === tab
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ─── WORKSPACE CONTENT AREA ─── */}
      <div className="min-h-[420px] grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.06]">
        {/* LEFT COLUMN: ACTIVE VIEW */}
        <div className="lg:col-span-8 p-6 lg:p-8 flex flex-col overflow-y-auto max-h-[500px]">
          {activeTab === 'editor' && (
            <div className="font-mono text-xs md:text-sm text-white/80 leading-relaxed max-w-xl mx-auto space-y-6 select-text">
              {/* Scene Heading */}
              <div className="text-white font-bold tracking-wide uppercase select-all">
                {selectedScene.slug}
              </div>

              {/* Action */}
              <div className="pl-0 text-white/60 text-justify">
                {selectedScene.desc}
              </div>

              {/* Character & Dialogue */}
              {selectedScene.characters.length > 0 && (
                <div className="space-y-4">
                  <div className="text-center w-full max-w-[200px] mx-auto text-white font-bold uppercase tracking-wider">
                    {selectedScene.characters[0]}
                  </div>
                  <div className="max-w-[320px] mx-auto text-white/70 text-left">
                    We're nearly locked. The telescope alignments are fluctuating. Something's wrong.
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'corkboard' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
              {SCENES.map((scene, idx) => (
                <button
                  key={scene.id}
                  onClick={() => setSelectedSceneIndex(idx)}
                  className={`p-5 text-left border rounded transition-all duration-300 relative group flex flex-col justify-between h-[110px] ${
                    selectedSceneIndex === idx
                      ? 'border-brand-500 bg-brand-500/5'
                      : 'border-white/[0.06] bg-white/[0.01] hover:border-white/20'
                  }`}
                  style={{ borderColor: selectedSceneIndex === idx ? 'rgb(var(--brand-500))' : undefined }}
                >
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-mono tracking-widest text-white/30">{scene.num}</span>
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-white/40">
                        {scene.time}
                      </span>
                    </div>
                    <h4 className="text-[11px] font-black uppercase text-white tracking-wide truncate">
                      {scene.slug}
                    </h4>
                  </div>
                  <p className="text-[9px] text-white/45 truncate mt-2">{scene.desc}</p>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'shots' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] text-white/30 uppercase tracking-widest">
                    <th className="py-2 px-3">Shot</th>
                    <th className="py-2 px-3">Size</th>
                    <th className="py-2 px-3">Angle</th>
                    <th className="py-2 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-white/60">
                  {selectedScene.shots.map((shot) => (
                    <tr key={shot.num} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 text-white font-bold" style={{ color: 'rgb(var(--brand-500))' }}>{shot.num}</td>
                      <td className="py-2.5 px-3">{shot.size}</td>
                      <td className="py-2.5 px-3">{shot.angle}</td>
                      <td className="py-2.5 px-3 text-white/50">{shot.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="flex flex-col h-full justify-between">
              {/* Tension Curve visualization (Swiss/Geneva map style) */}
              <div className="relative w-full h-[180px] border border-white/[0.04] bg-black/20 rounded overflow-hidden flex items-end">
                {/* SVG Curve */}
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(var(--brand-500), 0.05)" />
                      <stop offset="100%" stopColor="rgba(var(--brand-500), 0.3)" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M 0 180 
                       L 0 ${180 - SCENES[0].tension} 
                       C 50 ${180 - SCENES[0].tension}, 100 ${180 - SCENES[1].tension}, 200 ${180 - SCENES[1].tension}
                       C 300 ${180 - SCENES[1].tension}, 400 ${180 - SCENES[2].tension}, 500 ${180 - SCENES[2].tension}
                       C 600 ${180 - SCENES[2].tension}, 700 ${180 - SCENES[3].tension}, 800 ${180 - SCENES[3].tension}
                       L 800 180 Z`}
                    fill="url(#gradient)"
                    stroke="rgb(var(--brand-500))"
                    strokeWidth="1.5"
                    style={{ transition: 'all 0.5s ease' }}
                  />
                  {/* Scene coordinate nodes */}
                  {SCENES.map((scene, idx) => {
                    const xCoord = `${(idx / (SCENES.length - 1)) * 90 + 5}%`;
                    const yCoord = 180 - scene.tension;
                    return (
                      <g key={scene.id} className="cursor-pointer" onClick={() => setSelectedSceneIndex(idx)}>
                        <circle
                          cx={xCoord}
                          cy={yCoord}
                          r={selectedSceneIndex === idx ? '6' : '4'}
                          fill={selectedSceneIndex === idx ? 'rgb(var(--brand-500))' : '#fff'}
                          stroke="rgb(var(--brand-500))"
                          strokeWidth="2"
                        />
                        <text
                          x={xCoord}
                          y={yCoord - 12}
                          textAnchor="middle"
                          fill="#fff"
                          className="text-[9px] font-mono font-bold"
                          opacity={selectedSceneIndex === idx ? 1 : 0.4}
                        >
                          {scene.num}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Data vis metrics */}
              <div className="grid grid-cols-3 gap-4 mt-6 border-t border-white/[0.04] pt-4">
                <div>
                  <span className="block text-[8px] font-mono uppercase tracking-widest text-white/30">tension_level</span>
                  <span className="text-xl font-bold text-white font-mono">{selectedScene.tension}%</span>
                </div>
                <div>
                  <span className="block text-[8px] font-mono uppercase tracking-widest text-white/30">pace_frequency</span>
                  <span className="text-xl font-bold text-white font-mono">0.42 Hz</span>
                </div>
                <div>
                  <span className="block text-[8px] font-mono uppercase tracking-widest text-white/30">rhythm_metric</span>
                  <span className="text-xl font-bold text-white font-mono">STABLE</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: DETAIL/SCHEMATIC PANEL */}
        <div className="lg:col-span-4 p-6 lg:p-8 flex flex-col justify-between bg-black/20">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-white/[0.06] pb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Scene properties</span>
              <span className="text-[10px] font-mono text-brand-500 font-bold" style={{ color: 'rgb(var(--brand-500))' }}>
                #{selectedScene.num}
              </span>
            </div>

            {/* Scene Dropdown mock selector */}
            <div className="space-y-4">
              <div>
                <label className="block text-[8px] font-mono uppercase tracking-widest text-white/30 mb-1">active_scene</label>
                <div className="flex border border-white/[0.08] rounded px-3 py-2 justify-between items-center text-[10px] font-mono text-white/80 bg-white/[0.02]">
                  <span className="truncate">{selectedScene.slug}</span>
                  <span className="text-[8px] text-white/30">▼</span>
                </div>
              </div>

              {/* Breakdown Tags / Elements */}
              <div>
                <label className="block text-[8px] font-mono uppercase tracking-widest text-white/30 mb-2">tagged_breakdown_elements</label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedScene.props.length > 0 ? (
                    selectedScene.props.map((p) => (
                      <span key={p} className="px-2 py-0.5 text-[9px] font-mono border border-white/[0.04] bg-white/[0.02] text-white/50 rounded">
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] font-mono text-white/20 italic">No elements tagged</span>
                  )}
                </div>
              </div>

              {/* Characters */}
              <div>
                <label className="block text-[8px] font-mono uppercase tracking-widest text-white/30 mb-2">cast_in_scene</label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedScene.characters.length > 0 ? (
                    selectedScene.characters.map((c) => (
                      <span key={c} className="px-2 py-0.5 text-[9px] font-mono border border-brand-500/20 bg-brand-500/5 text-brand-400 rounded"
                        style={{
                          borderColor: 'rgba(var(--brand-500), 0.2)',
                          background: 'rgba(var(--brand-500), 0.05)',
                          color: 'rgb(var(--brand-400))'
                        }}
                      >
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] font-mono text-white/20 italic">Silent scene</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Scene Selector dots at bottom right */}
          <div className="mt-8 pt-4 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-[8px] font-mono uppercase tracking-widest text-white/30">navigate_scenes</span>
            <div className="flex gap-1.5">
              {SCENES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSceneIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    selectedSceneIndex === idx
                      ? 'bg-brand-500'
                      : 'bg-white/10 hover:bg-white/30'
                  }`}
                  style={{ background: selectedSceneIndex === idx ? 'rgb(var(--brand-500))' : undefined }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
