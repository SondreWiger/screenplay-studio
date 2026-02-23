'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================
// Version History — Redirects to Revisions (merged feature)
// ============================================================

export default function VersionHistoryPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/projects/${params.id}/revisions`);
  }, [params.id, router]);

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-neutral-400">Redirecting to Revisions…</p>
    </div>
  );
}

