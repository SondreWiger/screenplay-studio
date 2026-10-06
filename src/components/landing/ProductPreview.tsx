'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type Line = { kind: 'heading' | 'action' | 'character' | 'paren' | 'dialogue'; text: string };

const SCENE: Line[] = [
  { kind: 'heading', text: 'INT. ST. AGNES HOSPITAL - CORRIDOR - NIGHT' },
  { kind: 'action', text: 'Rain hammers the windows. MARA (30s), scrubs soaked at the cuffs, stops outside bed 12.' },
  { kind: 'character', text: 'MARA' },
  { kind: 'paren', text: '(whispering)' },
  { kind: 'dialogue', text: 'Who signed your chart?' },
  { kind: 'action', text: 'The patient opens one eye. Down the hall, a door clicks shut.' },
  { kind: 'character', text: 'DR. OKAFOR (O.S.)' },
  { kind: 'dialogue', text: 'Nurse Lind. A word.' },
];

const LINE_CLASS: Record<Line['kind'], string> = {
  heading: 'font-bold uppercase',
  action: '',
  character: 'mt-3 pl-[38%] uppercase',
  paren: 'pl-[31%]',
  dialogue: 'pl-[22%] pr-[18%]',
};

const TOTAL = SCENE.reduce((n, l) => n + l.text.length, 0);

const SIDEBAR = ['Overview', 'Script', 'Characters', 'Scenes', 'Shot list', 'Schedule', 'Budget'];

/**
 * A live-looking slice of the app for the landing page: the script editor
 * typing a scene, with the breakdown and a collaborator alongside.
 */
export function ProductPreview() {
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(reduce ? TOTAL : 0);

  useEffect(() => {
    if (reduce) { setTyped(TOTAL); return; }
    const id = setInterval(() => {
      // Type, hold on the finished page, then start the scene again
      setTyped((n) => (n >= TOTAL + 90 ? 0 : n + 1));
    }, 32);
    return () => clearInterval(id);
  }, [reduce]);

  let left = Math.min(typed, TOTAL);
  const shown = SCENE.map((l) => {
    const take = Math.max(0, Math.min(l.text.length, left));
    left -= take;
    return { ...l, text: l.text.slice(0, take), done: take === l.text.length, started: take > 0 };
  });
  const cursorLine = shown.findIndex((l) => !l.done);
  const progress = Math.min(1, typed / TOTAL);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 40, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1, delay: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ transformPerspective: 1600 }}
      className="relative"
      aria-hidden
    >
      {/* Glow */}
      <div className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 rounded-[3rem] bg-brand-500/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface-950 shadow-2xl shadow-black/60">
        {/* Window chrome */}
        <div className="flex h-9 items-center gap-2 border-b border-white/[0.06] bg-surface-900/80 px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
          <div className="mx-auto hidden rounded-md bg-surface-950/80 px-3 py-0.5 font-mono text-[10px] text-white/45 sm:block">
            screenplaystudio.fun/projects/the-long-night/script
          </div>
        </div>

        <div className="flex h-[340px] sm:h-[400px]">
          {/* Project sidebar */}
          <div className="hidden w-40 shrink-0 border-r border-white/[0.06] p-3 md:block">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-500 text-[9px] font-bold text-white">TL</span>
              <span className="truncate text-[11px] font-semibold text-white/80">The Long Night</span>
            </div>
            {SIDEBAR.map((s) => (
              <div key={s} className={`relative mb-0.5 rounded-md px-2 py-1.5 text-[11px] ${s === 'Script' ? 'bg-white/[0.06] text-white' : 'text-white/50'}`}>
                {s === 'Script' && <span className="absolute left-0 top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-brand-400" />}
                {s}
              </div>
            ))}
          </div>

          {/* Script page */}
          <div className="relative min-w-0 flex-1 overflow-hidden bg-surface-900/40 px-4 py-5 sm:px-8">
            <div className="mx-auto min-h-[115%] max-w-[460px] rounded-sm bg-[#f8f6f1] px-6 py-6 font-mono text-[10.5px] leading-[1.55] text-[#1c1b19] shadow-xl shadow-black/40 sm:px-10 sm:text-[11.5px]">
              <div className="mb-3 flex justify-between text-[9px] text-black/30"><span>14.</span><span>Blue rev.</span></div>
              {shown.map((l, i) => l.started && (
                <p key={i} className={`${LINE_CLASS[l.kind]} ${l.kind === 'action' || l.kind === 'heading' ? 'mt-3 first:mt-0' : ''}`}>
                  {l.text}
                  {i === cursorLine && <span className="ml-px inline-block h-[1.1em] w-[1.5px] translate-y-[2px] animate-pulse bg-brand-500" />}
                </p>
              ))}
            </div>

            {/* Collaborator cursor */}
            <motion.div
              className="absolute hidden sm:block"
              animate={reduce ? undefined : { left: ['62%', '70%', '58%', '62%'], top: ['30%', '52%', '64%', '30%'] }}
              transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
              style={{ left: '62%', top: '30%' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 1l4.5 12 1.8-5.2L12.5 6z" fill="#22d3ee" stroke="#0b0b0f" strokeWidth="1" /></svg>
              <span className="ml-3 rounded-md bg-cyan-400 px-1.5 py-0.5 text-[9px] font-semibold text-black">Sam</span>
            </motion.div>
          </div>

          {/* Breakdown rail */}
          <div className="hidden w-48 shrink-0 space-y-3 border-l border-white/[0.06] p-3 lg:block">
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-white/45">Scene 14 breakdown</p>
            {[
              { k: 'Cast', v: 'Mara · Okafor · Patient', c: '#a78bfa' },
              { k: 'Props', v: 'Chart · Monitor', c: '#fbbf24' },
              { k: 'Location', v: 'St. Agnes, 3rd floor', c: '#34d399' },
            ].map((r) => (
              <div key={r.k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.06em]" style={{ color: r.c }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.c }} />{r.k}
                </p>
                <p className="mt-0.5 text-[10px] text-white/60">{r.v}</p>
              </div>
            ))}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
              <div className="flex justify-between text-[9px] font-semibold uppercase tracking-[0.06em] text-white/50">
                <span>Draft</span><span className="font-mono text-white/60">{Math.round(progress * 100)}%</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-brand-500 transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center -space-x-1.5 pt-1">
              {['#f97316', '#22d3ee', '#a78bfa'].map((c, i) => (
                <span key={c} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-950 text-[9px] font-bold text-black" style={{ background: c }}>
                  {['A', 'S', 'K'][i]}
                </span>
              ))}
              <span className="pl-3 text-[10px] text-white/50">3 writing now</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
