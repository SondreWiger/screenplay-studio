'use client';

import { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────
// SMPTE 75% Color Bars  (EBU 3-row layout)
// Row 1 (67%): 7 bars   White / Yellow / Cyan / Green / Magenta / Red / Blue
// Row 2 (8%):  reverse cyan/black/magenta/black/yellow/black/white sub-bars
// Row 3 (25%): –I / white / +Q / black / PLUGE (–4 / black / +4)
// Audio: 1 kHz tone at –20 dBFS on left channel, silence right
// ─────────────────────────────────────────────────────────────

const BARS_ROW1: [number, number, number][] = [
  [192, 192, 192], // 75% White
  [192, 192, 0],   // 75% Yellow
  [0, 192, 192],   // 75% Cyan
  [0, 192, 0],     // 75% Green
  [192, 0, 192],   // 75% Magenta
  [192, 0, 0],     // 75% Red
  [0, 0, 192],     // 75% Blue
];

const BARS_ROW2: [number, number, number][] = [
  [0, 0, 192],     // Blue (reverse of row1)
  [19, 19, 19],    // Near-black
  [192, 0, 192],   // Magenta
  [19, 19, 19],
  [0, 192, 192],   // Cyan
  [19, 19, 19],
  [192, 192, 192], // White
];

function drawBars(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const r1h = Math.floor(H * 0.67);
  const r2h = Math.floor(H * 0.08);
  const r3h = H - r1h - r2h;
  const bw = W / 7;

  // Row 1
  BARS_ROW1.forEach(([r, g, b], i) => {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(Math.floor(i * bw), 0, Math.ceil(bw), r1h);
  });

  // Row 2
  BARS_ROW2.forEach(([r, g, b], i) => {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(Math.floor(i * bw), r1h, Math.ceil(bw), r2h);
  });

  // Row 3
  const r3y = r1h + r2h;
  // –I patch (cyan-ish)
  ctx.fillStyle = 'rgb(0,33,76)';
  ctx.fillRect(0, r3y, Math.floor(bw * 1.5), r3h);
  // White
  ctx.fillStyle = `rgb(192,192,192)`;
  ctx.fillRect(Math.floor(bw * 1.5), r3y, Math.ceil(bw * 2.5), r3h);
  // +Q patch (purple-ish)
  ctx.fillStyle = 'rgb(50,0,106)';
  ctx.fillRect(Math.floor(bw * 4), r3y, Math.ceil(bw), r3h);
  // Black
  ctx.fillStyle = 'rgb(19,19,19)';
  ctx.fillRect(Math.floor(bw * 5), r3y, Math.ceil(bw * 0.5), r3h);
  // PLUGE: –4 / black / +4
  ctx.fillStyle = 'rgb(7,7,7)';   // –4 (just below black)
  ctx.fillRect(Math.floor(bw * 5.5), r3y, Math.ceil(bw * 0.5), r3h);
  ctx.fillStyle = 'rgb(19,19,19)'; // reference black
  ctx.fillRect(Math.floor(bw * 6), r3y, Math.ceil(bw * 0.25), r3h);
  ctx.fillStyle = 'rgb(30,30,30)'; // +4 (just above black)
  ctx.fillRect(Math.floor(bw * 6.25), r3y, Math.ceil(bw * 0.75), r3h);
}

function drawOverlay(canvas: HTMLCanvasElement, ident: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  const now = new Date();
  const clock = now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const date = now.toLocaleDateString('nb-NO', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' });

  // Semi-transparent box
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(W / 2 - 220, H * 0.67 / 2 - 55, 440, 110);

  // Clock
  ctx.fillStyle = 'white';
  ctx.font = `bold ${Math.floor(W * 0.065)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(clock, W / 2, H * 0.67 / 2 - 14);

  // Date
  ctx.font = `${Math.floor(W * 0.022)}px monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(date, W / 2, H * 0.67 / 2 + 22);

  // Ident
  if (ident) {
    ctx.font = `bold ${Math.floor(W * 0.018)}px monospace`;
    ctx.fillStyle = 'rgba(255,165,0,0.9)';
    ctx.fillText(ident.toUpperCase(), W / 2, H * 0.67 / 2 + 44);
  }
}

export default function ColorbarsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const toneRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const animRef = useRef<number>();

  const [toneOn, setToneOn] = useState(false);
  const [ident, setIdent] = useState('ScreenPlay Studio — Test Signal');
  const [resolution, setResolution] = useState<'1920x1080' | '1280x720' | '3840x2160'>('1920x1080');

  const [W, H] = resolution.split('x').map(Number) as [number, number];

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;

    const loop = () => {
      drawBars(canvas);
      drawOverlay(canvas, ident);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [ident, W, H]);

  // 1 kHz tone at –20 dBFS
  const startTone = () => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1000;
    gain.gain.value = 0.1; // –20 dBFS approx
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    toneRef.current = osc;
    gainRef.current = gain;
    setToneOn(true);
  };

  const stopTone = () => {
    toneRef.current?.stop();
    audioCtxRef.current?.close();
    toneRef.current = null;
    audioCtxRef.current = null;
    setToneOn(false);
  };

  const [showControls, setShowControls] = useState(true);

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Canvas fills entire viewport, letterboxed */}
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '100vw',
          maxHeight: '100vh',
          aspectRatio: `${W}/${H}`,
          imageRendering: 'pixelated',
        }}
      />

      {/* Controls overlay */}
      <div
        className="fixed bottom-0 left-0 right-0 transition-opacity duration-300"
        style={{ opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none' }}
      >
        <div className="flex items-center justify-center gap-4 p-4 bg-black/70 backdrop-blur-sm">
          {/* Tone toggle */}
          <button
            onClick={toneOn ? stopTone : startTone}
            className={`px-4 py-2 rounded text-sm font-mono font-bold border transition-colors ${
              toneOn
                ? 'bg-orange-500 border-orange-400 text-white'
                : 'bg-surface-900 border-surface-600 text-surface-300 hover:border-orange-500 hover:text-white'
            }`}
          >
            {toneOn ? '● 1 kHz TONE ON' : '○ 1 kHz TONE OFF'}
          </button>

          {/* Resolution */}
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value as typeof resolution)}
            className="bg-surface-900 text-surface-300 border border-surface-600 rounded px-3 py-2 text-sm font-mono"
          >
            <option value="1280x720">HD 720p</option>
            <option value="1920x1080">Full HD 1080p</option>
            <option value="3840x2160">4K UHD</option>
          </select>

          {/* Ident */}
          <input
            value={ident}
            onChange={(e) => setIdent(e.target.value)}
            className="bg-surface-900 text-white border border-surface-600 rounded px-3 py-2 text-sm font-mono w-80"
            placeholder="Station ident..."
          />

          <span className="text-surface-500 text-xs font-mono">
            {W}×{H} · SMPTE 75% EBU
          </span>

          <a
            href="/colorbar"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs font-mono text-surface-400 hover:text-white border border-surface-700 rounded hover:border-surface-500 transition-colors"
          >
            ⤢ Open fullscreen
          </a>
        </div>
      </div>
    </div>
  );
}
