'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Tiny component that fetches and displays the site version from site_settings.
 * Use `light` prop for light-themed pages (blog).
 */
export function SiteVersion({ light = false }: { light?: boolean }) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'site_version')
      .single()
      .then(({ data }) => {
        if (data) setVersion(data.value);
      });
  }, []);

  if (!version) return null;

  return (
    <span
      className={
        light
          ? 'text-[11px] font-mono text-stone-400'
          : 'text-[11px] font-mono text-surface-600'
      }
    >
      v{version}
    </span>
  );
}
