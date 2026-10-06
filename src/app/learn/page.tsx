import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { PageHeader } from '@/components/kit';
import { GUIDES } from '@/components/learn/guides';

const GROUPS = ['Core tools', 'Production', 'Reference'] as const;

export default function LearnPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={<GraduationCap className="h-5 w-5" />}
        title="Learning Hub"
        description="Master Screenplay Studio with guides for every tool, from the first scene heading to the last call sheet."
        meta={<>{GUIDES.length} guides · read in any order</>}
      />

      {GROUPS.map((group) => (
        <section key={group}>
          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">{group}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDES.filter((g) => g.group === group).map((g) => (
              <Link
                key={g.href}
                href={g.href}
                className="group relative h-full overflow-hidden rounded-2xl border border-surface-800 bg-surface-900/60 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-500/40"
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-brand-500/10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
                <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-surface-700 bg-surface-900 text-brand-400">{g.icon}</span>
                <h3 className="relative mt-4 text-sm font-semibold text-white transition-colors group-hover:text-brand-300">{g.title}</h3>
                <p className="relative mt-1 text-xs leading-relaxed text-surface-400">{g.description}</p>
                <span className="relative mt-3 inline-block text-[11px] font-semibold text-surface-500 transition-colors group-hover:text-brand-400">Read guide →</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
