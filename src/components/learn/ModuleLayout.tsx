import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/kit';
import { GUIDES } from './guides';

interface ModuleLayoutProps {
  title: string;
  description: string;
  /** Fallback when the guide isn't in GUIDES. */
  icon: string;
  children: React.ReactNode;
}

export default function ModuleLayout({ title, description, icon, children }: ModuleLayoutProps) {
  const index = GUIDES.findIndex((g) => g.title === title);
  const guide = index >= 0 ? GUIDES[index] : null;
  const prev = index > 0 ? GUIDES[index - 1] : null;
  const next = index >= 0 && index < GUIDES.length - 1 ? GUIDES[index + 1] : null;

  return (
    <div className="max-w-4xl">
      <div className="mb-10">
        <PageHeader
          icon={guide?.icon ?? <span className="text-lg">{icon}</span>}
          title={title}
          description={description}
          meta={guide && <>{guide.group} · guide {index + 1} of {GUIDES.length}</>}
        />
      </div>

      <div className="space-y-12">
        {children}
      </div>

      {(prev || next) && (
        <nav className="mt-14 grid gap-3 border-t border-surface-800 pt-6 sm:grid-cols-2" aria-label="More guides">
          {prev ? (
            <Link href={prev.href} className="group rounded-xl border border-surface-800 p-4 transition-colors hover:border-surface-700">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">← Previous</span>
              <p className="mt-1 text-sm font-semibold text-white group-hover:text-brand-300">{prev.title}</p>
            </Link>
          ) : <span />}
          {next && (
            <Link href={next.href} className="group rounded-xl border border-surface-800 p-4 text-right transition-colors hover:border-surface-700">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">Next →</span>
              <p className="mt-1 text-sm font-semibold text-white group-hover:text-brand-300">{next.title}</p>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export function ModuleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white border-b border-surface-800 pb-2">{title}</h2>
      <div className="text-surface-300 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function KeybindTable({ binds }: { binds: { key: string; action: string }[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-surface-800 bg-surface-900/40">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-900/80 border-b border-surface-800">
          <tr>
            <th className="px-4 py-3 font-semibold text-surface-200">Shortcut</th>
            <th className="px-4 py-3 font-semibold text-surface-200">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-800/50">
          {binds.map((bind, i) => (
            <tr key={i} className="hover:bg-surface-800/30 transition-colors">
              <td className="px-4 py-3">
                <kbd className="px-2 py-1 bg-surface-800 rounded border border-surface-700 text-brand-300 font-mono text-xs shadow-sm">
                  {bind.key}
                </kbd>
              </td>
              <td className="px-4 py-3 text-surface-300">{bind.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
