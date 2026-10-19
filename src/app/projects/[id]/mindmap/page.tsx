'use client';

import { Suspense } from 'react';
import { Network } from 'lucide-react';
import { ProjectBoardTool } from '@/components/cinderra/ProjectBoardTool';
import LegacyMindMap from './LegacyMindMap';

export default function MindMapPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <ProjectBoardTool
        projectId={params.id}
        tool="mindmap"
        label="Mind map"
        icon={Network}
        kinds={['mindmap', 'freeform', 'kanban']}
        legacyTable="mindmap_nodes"
        Legacy={LegacyMindMap}
      />
    </Suspense>
  );
}
