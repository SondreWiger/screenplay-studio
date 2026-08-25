import React from 'react';
import Link from 'next/link';

interface ModuleLayoutProps {
  title: string;
  description: string;
  icon: string;
  children: React.ReactNode;
}

export default function ModuleLayout({ title, description, icon, children }: ModuleLayoutProps) {
  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="mb-8">
        <Link href="/learn" className="inline-flex items-center text-sm font-medium text-surface-400 hover:text-white transition-colors mb-4">
          <span className="mr-2">←</span> Back to Hub
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-900 border border-surface-800 flex items-center justify-center text-3xl shadow-sm">
            {icon}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
            <p className="text-surface-400 mt-1">{description}</p>
          </div>
        </div>
      </div>
      
      <div className="space-y-12">
        {children}
      </div>
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
