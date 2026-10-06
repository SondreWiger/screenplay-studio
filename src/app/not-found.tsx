'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ReportIssueButton } from '@/components/feedback/ReportIssueButton';

type Line = { k: 'heading' | 'action' | 'character' | 'paren' | 'dialogue' | 'transition'; t: string };

/** A screenwriting app's 404 should at least be properly formatted. */
const SCENES: ((path: string) => Line[])[] = [
  (path) => [
    { k: 'heading', t: 'INT. THE INTERNET - NIGHT' },
    { k: 'action', t: 'A WRITER clicks a link. Nothing loads. Somewhere, a page that was never written refuses to exist.' },
    { k: 'character', t: 'WRITER' },
    { k: 'paren', t: '(squinting at the address bar)' },
    { k: 'dialogue', t: `"${path}"? That's not in the script.` },
    { k: 'action', t: 'The WRITER considers a rewrite. Decides to go home instead.' },
  ],
  (path) => [
    { k: 'heading', t: 'EXT. PAGE 404 - CONTINUOUS' },
    { k: 'action', t: 'A tumbleweed rolls across a perfectly empty page.' },
    { k: 'character', t: 'SCRIPT SUPERVISOR (O.S.)' },
    { k: 'dialogue', t: `Continuity error. "${path}" was cut in the edit.` },
    { k: 'character', t: 'DIRECTOR' },
    { k: 'dialogue', t: 'Then we go back to one.' },
  ],
  (path) => [
    { k: 'heading', t: 'INT. EDIT BAY - 3 A.M.' },
    { k: 'action', t: "An EDITOR scrubs the timeline. The shot isn't there." },
    { k: 'character', t: 'EDITOR' },
    { k: 'dialogue', t: `I've got everything except "${path}".` },
    { k: 'character', t: 'PRODUCER (V.O.)' },
    { k: 'dialogue', t: 'Fix it in post.' },
    { k: 'character', t: 'EDITOR' },
    { k: 'paren', t: '(closing the laptop)' },
    { k: 'dialogue', t: "You can't fix what was never shot." },
  ],
  (path) => [
    { k: 'heading', t: "INT. WRITERS' ROOM - DAY" },
    { k: 'action', t: `The whiteboard reads "${path}". Someone has crossed it out.` },
    { k: 'character', t: 'SHOWRUNNER' },
    { k: 'dialogue', t: "We don't have that page." },
    { k: 'character', t: 'STAFF WRITER' },
    { k: 'paren', t: '(hopeful)' },
    { k: 'dialogue', t: '...Yet?' },
  ],
];

const LINE_CLASS: Record<Line['k'], string> = {
  heading: 'mt-0 font-bold uppercase',
  action: 'mt-4',
  character: 'mt-4 pl-[37%] uppercase',
  paren: 'pl-[30%]',
  dialogue: 'pl-[20%] pr-[15%]',
  transition: 'mt-4 text-right uppercase',
};

export default function NotFound() {
  const pathname = usePathname() || '/';
  const reduce = useReducedMotion();
  // Pick the scene after mount so server and client render the same first frame
  const [scene, setScene] = useState(0);
  useEffect(() => { setScene(Math.floor(Math.random() * SCENES.length)); }, []);

  const path = pathname.length > 40 ? `${pathname.slice(0, 37)}…` : pathname;
  const lines = SCENES[scene](path);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-950 px-4 py-16">
      <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.2em] text-surface-500">Page 404 · Scene missing</p>

      <motion.div
        key={scene}
        initial={reduce ? false : { opacity: 0, y: 16, rotate: -0.6 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-full max-w-xl rounded-sm bg-[#f8f6f1] px-8 py-10 font-mono text-[12.5px] leading-[1.6] text-[#1c1b19] shadow-2xl shadow-black/60 sm:px-14"
      >
        <div className="mb-6 flex justify-between text-[10px] text-black/35">
          <span>404.</span>
          <span>PINK REV.</span>
        </div>
        <h1 className="sr-only">Page not found</h1>
        {lines.map((l, i) => (
          <motion.p
            key={`${scene}-${i}`}
            className={LINE_CLASS[l.k]}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 + i * 0.28, duration: 0.3 }}
          >
            {l.t}
          </motion.p>
        ))}

        {/* The way out, as transitions */}
        <motion.nav
          className="mt-8 flex flex-col items-end gap-1.5 text-[12.5px] font-bold uppercase"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 + lines.length * 0.28 }}
          aria-label="Where to go next"
        >
          <Link href="/" className="rounded px-1 underline-offset-4 hover:bg-black/5 hover:underline">CUT TO: HOME</Link>
          <Link href="/dashboard" className="rounded px-1 underline-offset-4 hover:bg-black/5 hover:underline">SMASH CUT TO: YOUR DASHBOARD</Link>
          <Link href="/community" className="rounded px-1 underline-offset-4 hover:bg-black/5 hover:underline">DISSOLVE TO: THE COMMUNITY</Link>
        </motion.nav>

        <p className="mt-10 text-center text-[12.5px] uppercase">THE END</p>
      </motion.div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => setScene((s) => (s + 1) % SCENES.length)}
          className="rounded-xl border border-surface-800 px-4 py-2 text-xs font-semibold text-surface-300 transition-colors hover:border-surface-700 hover:text-white"
        >
          Another take
        </button>
        <ReportIssueButton
          label="Report a broken link"
          prefillTitle="404 – Page not found"
          prefillBody={`I got a 404 error trying to visit a page on Screenplay Studio. The URL was: ${pathname}`}
        />
      </div>
    </div>
  );
}
