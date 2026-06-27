'use client';

import { useEffect, useState } from 'react';
import { PollModal } from '@/components/PollModal';

export function GlobalPollPopup() {
  const [pollId, setPollId] = useState<string | null>(null);

  useEffect(() => {
    // Small delay so it doesn't interrupt immediate load
    const timer = setTimeout(() => {
      fetch('/api/polls/global')
        .then((res) => res.json())
        .then((data) => {
          if (data && data.pollId) {
            setPollId(data.pollId);
          }
        })
        .catch((err) => console.error('Failed to check global poll:', err));
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (!pollId) return null;

  return <PollModal pollId={pollId} onClose={() => setPollId(null)} />;
}
