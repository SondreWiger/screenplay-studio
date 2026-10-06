'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SubNavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  active: boolean;
}

export interface SubNavGroup {
  label?: string;
  items: SubNavItem[];
}

/**
 * Secondary navigation inside an area (settings sections, legal documents,
 * learning topics): a sticky column on desktop, scrolling chips on mobile.
 */
export function SubNav({ title, groups, id, footer }: { title?: string; groups: SubNavGroup[]; id: string; footer?: ReactNode }) {
  const all = groups.flatMap((g) => g.items);
  return (
    <>
      {/* Mobile: chips */}
      <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden" aria-label={title}>
        {all.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              item.active ? 'text-white' : 'text-surface-400 hover:text-white',
            )}
          >
            {item.active && <motion.span layoutId={`subnav-chip-${id}`} className="absolute inset-0 rounded-lg bg-brand-600/20 ring-1 ring-brand-500/40" />}
            <span className="relative">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Desktop: column */}
      <nav className="sticky top-6 hidden w-56 shrink-0 self-start lg:block" aria-label={title}>
        {title && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">{title}</p>}
        <div className="space-y-4">
          {groups.map((group, gi) => (
            <div key={group.label ?? gi}>
              {group.label && <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">{group.label}</p>}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                      item.active ? 'font-medium text-white' : 'text-surface-400 hover:bg-surface-800/40 hover:text-white',
                    )}
                  >
                    {item.active && (
                      <motion.span layoutId={`subnav-${id}`} className="absolute inset-0 rounded-lg bg-surface-800/70 ring-1 ring-surface-700" transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
                        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand-400" />
                      </motion.span>
                    )}
                    {item.icon && <span className={cn('relative [&>svg]:h-4 [&>svg]:w-4', item.active ? 'text-brand-400' : 'text-surface-500')}>{item.icon}</span>}
                    <span className="relative truncate">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        {footer && <div className="mt-6 border-t border-surface-800 px-3 pt-5">{footer}</div>}
      </nav>
    </>
  );
}
