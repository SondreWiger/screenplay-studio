'use client';

import { notFound } from 'next/navigation';
import { Badge, Card } from '@/components/ui';
import { ProToolShell } from '@/components/pro-tools/ProToolShell';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useProjectStore } from '@/lib/stores';
import { getProTool } from '@/lib/pro-tools';

// Every Pro tool renders through here — the slug picks the definition out of
// the registry in lib/pro/tools.ts.

export default function ProToolPage({ params }: { params: { id: string; tool: string } }) {
  const tool = getProTool(params.tool);
  const { isStudio: accountStudio, loading } = useProFeatures();
  // Studio on the account, or bought for this production alone
  const productionStudio = useProjectStore((st) => st.currentProject?.pro_enabled === true);
  const isStudio = accountStudio || productionStudio;

  if (!tool) notFound();

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Matches the sidebar's Studio gating in projects/[id]/layout.tsx.
  if (!isStudio) return (
    <div className="p-3 sm:p-4 md:p-8 max-w-3xl">
      <Card className="p-8 text-center">
        <Badge variant="warning" className="mb-3">Studio</Badge>
        <h2 className="text-xl font-bold text-white mb-2">{tool.label}</h2>
        <p className="text-surface-400 mb-4">{tool.tagline}</p>
        <a
          href="/pro#studio"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors"
        >
          About Studio
        </a>
      </Card>
    </div>
  );

  return <ProToolShell key={tool.slug} tool={tool} projectId={params.id} />;
}
