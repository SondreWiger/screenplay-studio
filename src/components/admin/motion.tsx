'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useInView, useReducedMotion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

export const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Parent variants: children fade up one after another. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

/** Number that tweens from its previous value to the new one. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString('en-US'), duration = 0.9, className }: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView) return;
    if (reduce) {
      node.textContent = formatRef.current(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => { node.textContent = formatRef.current(v); },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, inView, duration, reduce]);

  return <span ref={ref} className={cn('tabular-nums', className)}>{format(reduce ? value : from.current)}</span>;
}

/** Segmented control with a sliding highlight pill. */
export function Segmented<T extends string>({ options, value, onChange, id, size = 'md' }: {
  options: { key: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Unique id so multiple controls don't share the pill animation. */
  id: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-surface-800 bg-surface-900/70 p-1 backdrop-blur">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={active}
            title={o.title}
            onClick={() => onChange(o.key)}
            className={cn(
              'relative shrink-0 rounded-lg font-semibold transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              active ? 'text-white' : 'text-surface-400 hover:text-surface-200',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-lg bg-brand-600/25 ring-1 ring-brand-500/40"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Card wrapper used across the dashboard; animates in with its parent's stagger. */
export function Panel({ title, subtitle, action, children, className, bodyClassName }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <motion.section
      variants={fadeUp}
      className={cn('rounded-2xl border border-surface-800 bg-surface-900/60 shadow-sm shadow-black/20', className)}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[11px] text-surface-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn('p-5', title && 'pt-3', bodyClassName)}>{children}</div>
    </motion.section>
  );
}

/** Up/down change pill. `invert` for metrics where down is good. */
export function Delta({ value, invert = false, className }: { value: number | null; invert?: boolean; className?: string }) {
  if (value == null) return <span className={cn('text-[11px] font-medium text-surface-500', className)}>—</span>;
  const good = invert ? value < 0 : value > 0;
  const flat = value === 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
        flat ? 'bg-surface-800 text-surface-400' : good ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400',
        className,
      )}
      title="Change vs. previous period"
    >
      <span aria-hidden>{flat ? '→' : value > 0 ? '↑' : '↓'}</span>
      {Math.abs(value) >= 1000 ? `${Math.round(Math.abs(value) / 100) / 10}K` : Math.abs(value)}%
    </span>
  );
}

/** Pulsing "live" dot. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex h-2 w-2', className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
    </span>
  );
}

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-shimmer rounded-lg bg-[length:200%_100%]', className)}
      style={{ backgroundImage: 'linear-gradient(90deg, rgb(var(--surface-800) / 0.5) 0%, rgb(var(--surface-700) / 0.6) 50%, rgb(var(--surface-800) / 0.5) 100%)' }}
    />
  );
}

/** Generic placeholder while a tab's data loads. */
export function TabSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between">
        <Shimmer className="h-7 w-48" />
        <Shimmer className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="space-y-2 rounded-xl border border-surface-800 p-3">
        {Array.from({ length: 8 }).map((_, i) => <Shimmer key={i} className="h-10" />)}
      </div>
    </div>
  );
}

/** Re-renders every `ms` so relative timestamps stay fresh. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
