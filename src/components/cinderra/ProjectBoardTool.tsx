'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CinderraBoards, type CinderraKind, type CinderraTool } from './CinderraBoards';

/**
 * A project's visual tool — mind map or mood board — on Cinderra, with the
 * previous built-in version one click away for projects that have data in it.
 *
 * The old data was not moved: the two tools model things differently enough
 * that an automatic copy would come out wrong, and leaving it where it was
 * loses nothing. `?legacy=1` shows it, read-write, exactly as before.
 */
export function ProjectBoardTool({
  projectId,
  tool,
  label,
  icon,
  kinds,
  legacyTable,
  Legacy,
}: {
  projectId: string;
  tool: CinderraTool;
  label: string;
  icon: LucideIcon;
  kinds: CinderraKind[];
  /** The old tool's table, to tell whether there is anything to go back to. */
  legacyTable: string;
  Legacy: ComponentType<{ params: { id: string } }>;
}) {
  const pathname = usePathname();
  const showLegacy = useSearchParams().get('legacy') === '1';
  const [hasLegacy, setHasLegacy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from(legacyTable)
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .then(({ count }) => { if (!cancelled) setHasLegacy((count ?? 0) > 0); });
    return () => { cancelled = true; };
  }, [legacyTable, projectId]);

  if (showLegacy) {
    return (
      <div className="relative">
        <Legacy params={{ id: projectId }} />
        <Link
          href={pathname}
          className="fixed bottom-4 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-surface-700 bg-surface-900/95 px-4 py-2 text-xs font-medium text-white shadow-2xl backdrop-blur hover:border-brand-500/50 md:left-auto md:right-6 md:translate-x-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the new {label.toLowerCase()}
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-48px)] md:h-screen">
      <CinderraBoards
        scope="project"
        scopeId={projectId}
        tool={tool}
        label={label}
        icon={icon}
        kinds={kinds}
        autoCreate
        fallback={<Legacy params={{ id: projectId }} />}
        legacy={hasLegacy ? { href: `${pathname}?legacy=1`, label: `Previous ${label.toLowerCase()}` } : undefined}
      />
    </div>
  );
}
