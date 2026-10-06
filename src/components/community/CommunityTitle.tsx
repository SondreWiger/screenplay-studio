import type { ReactNode } from 'react';

/**
 * The community site's page title: orange eyebrow, uppercase display title,
 * one line of description and an optional row of figures. One look for every
 * community page, distinct from the studio's headers.
 */
export function CommunityTitle({ eyebrow, title, description, stats, children }: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  stats?: { label: string; value: number | string }[];
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-px w-4 shrink-0 bg-brand-500" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-500">{eyebrow}</span>
      </div>
      <h1 className="text-3xl font-bold uppercase text-white sm:text-4xl" style={{ letterSpacing: '-0.03em', lineHeight: 0.95 }}>{title}</h1>
      {description && <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">{description}</p>}
      {stats && stats.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.06em] text-white/50">
          {stats.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-brand-500" />
              <span className="text-white/80">{s.value}</span> {s.label}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
