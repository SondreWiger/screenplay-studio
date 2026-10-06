'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NotebookPen, RefreshCw } from 'lucide-react';

/** Half craft, half app: one a day, and another on request. */
const NOTES = [
  'Enter into a scene as late as you can, and leave it as early as you can.',
  'Press Tab to cycle the line you’re on through scene heading, action, character and dialogue.',
  'If a character could say it in five words, they probably shouldn’t say it in twenty.',
  'Type INT. or EXT. on an empty line and it becomes a scene heading on its own.',
  'Action lines are read, not filmed. Keep them short enough to feel the pace.',
  'Press ⌘K anywhere to jump to a project, a page or a tool.',
  'Every scene should change something — a goal, a relationship, a piece of information.',
  'Save a draft snapshot with ⌘D before a big rewrite, so you can always go back.',
  'Subtext beats text. Let people want one thing and say another.',
  'Zen Mode hides everything but the page. Find it in the script editor’s toolbar.',
  'Read your dialogue out loud. The ear catches what the eye forgives.',
  'Press ⌘N on the dashboard to start a new project without reaching for the mouse.',
  'A parenthetical is a seasoning, not a sauce. Use one when the line could be misread.',
  'Stuck? Write the scene badly on purpose. Then rewrite it.',
  'Press / in the sidebar to jump to any part of the studio.',
  'Give every main character a want they can name and a need they can’t.',
  'Export to FDX, PDF or Fountain at any time — your script is always yours.',
  'The first ten pages are a promise. Make sure the rest of the script keeps it.',
];

function dayIndex() {
  const d = new Date();
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000) % NOTES.length;
}

/** "Note from the script supervisor": a daily tip on the dashboard. */
export function SupervisorNote() {
  const [i, setI] = useState<number | null>(null);
  // Picked after mount so the server and first client render agree
  useEffect(() => { setI(dayIndex()); }, []);
  if (i === null) return null;

  return (
    <div className="relative mt-4 flex items-start gap-2.5 rounded-xl border border-surface-800/80 bg-surface-950/40 px-3 py-2.5">
      <NotebookPen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">Note from the script supervisor</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="mt-0.5 text-xs text-surface-300"
          >
            {NOTES[i]}
          </motion.p>
        </AnimatePresence>
      </div>
      <button
        onClick={() => setI((n) => ((n ?? 0) + 1) % NOTES.length)}
        className="shrink-0 rounded-md p-1 text-surface-500 transition-colors hover:bg-surface-800 hover:text-white"
        aria-label="Another note"
        title="Another note"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
