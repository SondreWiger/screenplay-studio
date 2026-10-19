'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PollModal } from '@/components/PollModal';

// Routes where a survey popup would get in the way (sign-in, onboarding, the poll page itself)
const SKIP_PREFIXES = ['/poll', '/auth', '/onboarding', '/desktop-onboarding', '/desktop-welcome', '/admin', '/banned', '/suspended', '/offline', '/legal'];

// After "Maybe later" the poll comes back once this has passed, instead of on every page load
const SNOOZE_MS = 2 * 24 * 60 * 60 * 1000;
const snoozeKey = (id: string) => `sps-poll-snooze:${id}`;

function isSnoozed(id: string): boolean {
  try {
    const until = Number(localStorage.getItem(snoozeKey(id)) ?? 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

function snooze(id: string) {
  try { localStorage.setItem(snoozeKey(id), String(Date.now() + SNOOZE_MS)); } catch { /* storage blocked */ }
}

export function GlobalPollPopup() {
  const pathname = usePathname() ?? '/';
  const [pollId, setPollId] = useState<string | null>(null);
  const skip = pathname === '/' || SKIP_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (skip || pollId) return;
    // Give the page time to settle so the poll doesn't interrupt the first thing the user does
    const timer = setTimeout(() => {
      fetch('/api/polls/global')
        .then((res) => res.json())
        .then((data) => {
          if (data?.pollId && !isSnoozed(data.pollId)) setPollId(data.pollId);
        })
        .catch((err) => console.error('Failed to check global poll:', err));
    }, 4000);

    return () => clearTimeout(timer);
  }, [skip, pollId]);

  if (!pollId) return null;

  return (
    <PollModal
      pollId={pollId}
      onClose={(completed) => {
        if (!completed) snooze(pollId);
        setPollId(null);
      }}
    />
  );
}
