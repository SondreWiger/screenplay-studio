/**
 * PageHeader — shared header block for all project sub-pages and app pages.
 *
 * Usage:
 *   <PageHeader
 *     eyebrow="Scene Breakdown"
 *     title="Scenes"
 *     meta="14 scenes · 3 locations"
 *     actions={<button className="ss-btn-orange">Add Scene</button>}
 *   />
 */
import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Small all-caps label above the title */
  eyebrow?: string;
  /** Page title — rendered large and bold */
  title: string;
  /** Optional subtitle / description below the title */
  subtitle?: string;
  /** Optional meta string (counts, status) shown beside title or below */
  meta?: React.ReactNode;
  /** Action buttons rendered right-aligned */
  actions?: React.ReactNode;
  /** Extra className on the root wrapper */
  className?: string;
  /** If true, uses larger display-scale font on the title */
  large?: boolean;
}

const ORANGE = '#FF5F1F';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
  className,
  large = false,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'border-b flex items-start justify-between gap-6',
        'px-0 py-6',
        className,
      )}
      style={{ borderColor: 'rgba(255,255,255,0.07)' }}
    >
      <div className="min-w-0">
        {/* Eyebrow */}
        {eyebrow && (
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-3 h-px shrink-0" style={{ background: ORANGE }} />
            <span className="ss-label">{eyebrow}</span>
          </div>
        )}

        {/* Title */}
        <h1
          className={cn(
            'font-black text-white leading-none tracking-tight',
            large
              ? 'text-3xl md:text-5xl'
              : 'text-2xl md:text-3xl',
          )}
          style={{ letterSpacing: large ? '-0.04em' : '-0.025em' }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        {subtitle && (
          <p className="mt-2 text-sm text-white/35 leading-relaxed max-w-lg">
            {subtitle}
          </p>
        )}

        {/* Meta */}
        {meta && (
          <p className="mt-2 text-[10px] font-mono text-white/20 uppercase tracking-wider">
            {meta}
          </p>
        )}
      </div>

      {/* Actions */}
      {actions && (
        <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

/**
 * SectionHeader — lighter variant for within-page section breaks.
 */
interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ eyebrow, title, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-4 mb-6', className)}>
      <div>
        {eyebrow && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-px shrink-0" style={{ background: ORANGE }} />
            <span className="ss-label">{eyebrow}</span>
          </div>
        )}
        <h2
          className="text-lg font-black text-white"
          style={{ letterSpacing: '-0.02em' }}
        >
          {title}
        </h2>
      </div>
      {actions && (
        <div className="shrink-0 flex items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/**
 * EmptySlate — design-system-consistent empty-state for lists/grids.
 */
interface EmptySlateProps {
  label?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function EmptySlate({ label, title, description, action, icon }: EmptySlateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon && (
        <div
          className="w-14 h-14 flex items-center justify-center mb-6 text-white/20"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {icon}
        </div>
      )}
      {label && (
        <div className="flex items-center gap-2.5 mb-4 justify-center">
          <div className="w-3 h-px" style={{ background: ORANGE }} />
          <span className="ss-label">{label}</span>
          <div className="w-3 h-px" style={{ background: ORANGE }} />
        </div>
      )}
      <h3 className="text-lg font-black text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
        {title}
      </h3>
      {description && (
        <p className="text-sm text-white/30 max-w-xs leading-relaxed mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
