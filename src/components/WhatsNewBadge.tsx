'use client';

/**
 * WhatsNewBadge
 * Shows a pulsing orange dot on the changelog link when a new release
 * has shipped since the user last visited /changelog.
 *
 * Uses localStorage('ss_last_seen_version') compared to the live
 * site_version stored in site_settings (fetched once on mount).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const LS_KEY = 'ss_last_seen_version';

export function WhatsNewBadge() {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [seenVersion, setSeenVersion] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Fetch latest published version on mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(LS_KEY);
    setSeenVersion(stored);

    const supabase = createClient();
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'site_version')
      .single()
      .then(({ data }) => {
        if (data?.value) setLatestVersion(data.value);
      });
  }, []);

  // Don't render during SSR / before localStorage is read
  if (!mounted) return null;

  const hasNew = latestVersion && latestVersion !== seenVersion;

  const handleClick = () => {
    if (latestVersion) {
      localStorage.setItem(LS_KEY, latestVersion);
      setSeenVersion(latestVersion);
    }
  };

  return (
    <Link
      href="/changelog"
      onClick={handleClick}
      title={hasNew ? `What's New — v${latestVersion}` : 'Changelog'}
      className="relative p-2 text-white/30 hover:text-white/70 hover:bg-white/5 transition-all flex items-center justify-center"
    >
      {/* Bolt / sparkle icon */}
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>

      {/* Dot badge — only shown when there is an unseen release */}
      {hasNew && (
        <span
          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full animate-pulse"
          style={{ background: '#FF5F1F' }}
        />
      )}
    </Link>
  );
}
