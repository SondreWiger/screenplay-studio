'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { decodeTheme, applyTheme, type AppTheme } from '@/lib/theme';
import { useThemeStore, useAuthStore } from '@/lib/stores';
import { Button, toast } from '@/components/ui';

export function ColorThemeClient({ sha, serverTheme }: { sha: string; serverTheme: AppTheme | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTheme, setEditorOpen } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const [applied, setApplied] = useState(false);
  const [theme, setThemeState] = useState<AppTheme | null>(serverTheme);

  useEffect(() => {
    // Try to decode from URL search params first (?t=encoded)
    const t = searchParams.get('t');
    if (t) {
      const decoded = decodeTheme(t);
      if (decoded) {
        setThemeState(decoded);
        return;
      }
    }

    // Try fetching from API
    if (!serverTheme) {
      fetch(`/api/colors/${sha}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.colors) setThemeState(data);
        })
        .catch(() => {});
    }
  }, [sha, serverTheme, searchParams]);

  const handleApply = () => {
    if (!theme) return;
    setTheme(theme);
    setApplied(true);
    toast.success('Theme applied!');
  };

  const handleOpenEditor = () => {
    if (theme) setTheme(theme);
    setEditorOpen(true);
  };

  if (!theme) {
    return (
      <div className="text-center space-y-4">
        <div className="text-6xl">?</div>
        <h1 className="text-2xl font-bold text-white">Theme not found</h1>
        <p className="text-surface-400">This theme link may be invalid or expired.</p>
        <Button onClick={() => router.push('/')}>Go Home</Button>
      </div>
    );
  }

  const c = theme.colors;
  const stripeColors = [c.bgBase, c.bgSurface, c.bgElevated, c.brand, c.scriptBg, c.textPrimary, c.scriptText, c.border];

  return (
    <div className="w-full max-w-2xl space-y-8">
      {/* Stripe preview */}
      <div className="rounded-2xl overflow-hidden border border-surface-700 shadow-2xl">
        <div className="flex h-8">
          {stripeColors.map((col, i) => (
            <div key={i} className="flex-1" style={{ background: col }} />
          ))}
        </div>
      </div>

      {/* Theme name + info */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">{theme.name || 'Custom Theme'}</h1>
        <p className="text-surface-400 font-mono text-sm">sha:{sha.slice(0, 16)}...</p>
      </div>

      {/* Color grid */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(c).map(([key, val]) => (
          <div key={key} className="space-y-1">
            <div
              className="w-full h-12 rounded-lg border border-surface-700"
              style={{ background: val as string }}
            />
            <p className="text-[10px] text-surface-500 text-center truncate">{key}</p>
            <p className="text-[10px] text-surface-400 text-center font-mono">{val as string}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3">
        {applied ? (
          <Button onClick={() => router.push('/dashboard')} className="px-8">
            Go to Dashboard
          </Button>
        ) : (
          <>
            <Button onClick={handleApply} className="px-8">
              Apply This Theme
            </Button>
            <Button variant="ghost" onClick={handleOpenEditor}>
              Open in Editor
            </Button>
          </>
        )}
      </div>

      {user && (
        <p className="text-center text-xs text-surface-500">
          Signed in as {user.display_name || user.email}. Theme will be saved locally.
        </p>
      )}
      {!user && (
        <p className="text-center text-xs text-surface-500">
          Theme will be applied to this session. Sign in to save it permanently.
        </p>
      )}
    </div>
  );
}
