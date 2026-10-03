'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Fades content up the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0, y = 24 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Children reveal one after another as the group scrolls into view. */
export function RevealGroup({ children, className, stagger = 0.08 }: { children: ReactNode; className?: string; stagger?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}
    >
      {children}
    </motion.div>
  );
}

/** The WRITE. PLAN. PRODUCE. display lines, rising in one after another. */
export function HeroLines({ lines }: { lines: { text: string; className?: string; style?: React.CSSProperties }[] }) {
  const reduce = useReducedMotion();
  return (
    <>
      {lines.map((l, i) => (
        <span key={l.text} className="block overflow-hidden pb-[0.04em]">
          <motion.span
            className={`block ${l.className ?? ''}`}
            style={l.style}
            initial={reduce ? false : { y: '105%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.9, delay: 0.1 + i * 0.12, ease: EASE }}
          >
            {l.text}
          </motion.span>
        </span>
      ))}
    </>
  );
}
