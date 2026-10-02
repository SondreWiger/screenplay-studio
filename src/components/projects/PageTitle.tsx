'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { sidebarIcons } from '@/components/sidebar/SidebarIcons';
import { cn } from '@/lib/utils';

/**
 * Title for a project tool page: the tool's sidebar icon in a badge plus a
 * consistent heading. The icon is picked from the route (/projects/:id/<tool>).
 */
export function PageTitle({ children, className, icon }: { children: ReactNode; className?: string; icon?: ReactNode }) {
  const pathname = usePathname() || '';
  const segment = pathname.split('/')[3] || 'overview';
  const glyph = icon ?? sidebarIcons[segment];
  return (
    <div className="flex min-w-0 items-center gap-3">
      {glyph && (
        <motion.span
          initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-surface-800 bg-gradient-to-br from-surface-800/80 to-surface-900 text-brand-400 shadow-inner [&>svg]:h-5 [&>svg]:w-5"
          aria-hidden
        >
          {glyph}
        </motion.span>
      )}
      <h1 className={cn('min-w-0 text-xl font-bold tracking-tight text-white sm:text-2xl', className)}>{children}</h1>
    </div>
  );
}
