'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { LoadingPage } from '@/components/ui';
import { CinderraBoards } from '@/components/cinderra/CinderraBoards';
import LegacyIdeaBoards from './LegacyIdeaBoards';

/**
 * Idea boards: personal Cinderra boards, not tied to a project. The previous
 * built-in boards stay at ?legacy=1 (and /idea-boards/:id) for anyone who has
 * some, since their data was not moved.
 */
function IdeaBoards() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const showLegacy = useSearchParams().get('legacy') === '1';
  const [hasLegacy, setHasLegacy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login?redirect=/idea-boards');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    createClient()
      .from('idea_boards')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .then(({ count }) => { if (!cancelled) setHasLegacy((count ?? 0) > 0); });
    return () => { cancelled = true; };
  }, [user]);

  if (loading || !user) return <LoadingPage />;

  if (showLegacy) {
    return (
      <div className="relative">
        <LegacyIdeaBoards />
        <Link
          href="/idea-boards"
          className="fixed bottom-4 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-surface-700 bg-surface-900/95 px-4 py-2 text-xs font-medium text-white shadow-2xl backdrop-blur hover:border-brand-500/50 md:left-auto md:right-6 md:translate-x-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the new idea boards
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)]">
      <CinderraBoards
        scope="user"
        scopeId={user.id}
        tool="ideas"
        label="Idea boards"
        icon={Lightbulb}
        kinds={['freeform', 'mindmap', 'kanban']}
        fallback={<LegacyIdeaBoards />}
        legacy={hasLegacy ? { href: '/idea-boards?legacy=1', label: 'Previous idea boards' } : undefined}
      />
    </div>
  );
}

export default function IdeaBoardsPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <IdeaBoards />
    </Suspense>
  );
}
