'use client';

import { Suspense } from 'react';
import { Palette } from 'lucide-react';
import { ProjectBoardTool } from '@/components/cinderra/ProjectBoardTool';
import LegacyMoodBoard from './LegacyMoodBoard';

export default function MoodBoardPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <ProjectBoardTool
        projectId={params.id}
        tool="moodboard"
        label="Mood board"
        icon={Palette}
        kinds={['freeform', 'mindmap', 'kanban']}
        legacyTable="mood_board_items"
        Legacy={LegacyMoodBoard}
      />
    </Suspense>
  );
}
