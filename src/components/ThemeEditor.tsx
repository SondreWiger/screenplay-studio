'use client';

import { useState, useCallback } from 'react';
import { useThemeStore, useAuthStore } from '@/lib/stores';
import { DEFAULT_THEME, THEME_COLOR_FIELDS, encodeTheme, THEME_CATEGORIES, type AppTheme, type ThemeColors } from '@/lib/theme';
import { Button, Input, toast } from '@/components/ui';
import { Icon } from '@/components/ui/icons';

// ── Simplified screenplay preview ──────────────────────────────

function ScriptPreview({ colors }: { colors: ThemeColors }) {
  return (
    <div
      className="w-[340px] rounded-xl border overflow-hidden shadow-2xl flex-shrink-0"
      style={{ background: colors.scriptBg, borderColor: colors.border }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ background: colors.bgElevated, borderColor: colors.border }}>
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs ml-2 font-mono" style={{ color: colors.textMuted }}>screenplay.txt</span>
      </div>

      {/* Page */}
      <div className="p-6 mx-4 my-4 rounded-lg" style={{ background: '#fff' }}>
        <div className="font-mono text-[11px] leading-relaxed" style={{ color: '#111' }}>
          <p className="text-center font-bold text-[13px] mb-4" style={{ color: '#000' }}>UNTITLED SCREENPLAY</p>
          <p className="text-center text-[10px] mb-6" style={{ color: '#555' }}>Written by Author Name</p>

          <p className="uppercase font-bold mt-4 mb-1" style={{ color: '#000' }}>INT. OFFICE - DAY</p>
          <p className="mb-3" style={{ color: '#222' }}>A dimly lit workspace. Monitors cast blue light across scattered papers.</p>

          <p className="uppercase text-right font-bold mt-3 mb-1" style={{ color: '#000' }}>ALEX</p>
          <p className="text-center italic mb-1" style={{ color: '#333' }}>(staring at screen)</p>
          <p className="text-center mb-3" style={{ color: '#222' }}>We need to finish this before the deadline.</p>

          <p className="uppercase text-right font-bold mt-3" style={{ color: '#000' }}>SARAH</p>
          <p className="text-center mb-1 italic" style={{ color: '#333' }}>(nodding)</p>
          <p className="text-center" style={{ color: '#222' }}>I&apos;m almost done with the color system.</p>
        </div>
      </div>

      {/* Accent bar */}
      <div className="h-1" style={{ background: colors.brand }} />
    </div>
  );
}

// ── Color picker row ───────────────────────────────────────────

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="relative w-8 h-8 rounded-lg border-2 border-surface-600 overflow-hidden cursor-pointer hover:border-surface-400 transition-colors flex-shrink-0">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="w-full h-full" style={{ background: value }} />
      </label>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-surface-200">{label}</div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1 text-xs text-surface-300 font-mono focus:outline-none focus:border-[--theme-brand]"
        />
      </div>
    </div>
  );
}

// ── Main theme editor ──────────────────────────────────────────

export function ThemeEditor() {
  const { theme, updateColor, setTheme, editorOpen, setEditorOpen } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [publishName, setPublishName] = useState('');
  const [publishCategory, setPublishCategory] = useState('dark');
  const [publishDesc, setPublishDesc] = useState('');
  const [publishing, setPublishing] = useState(false);

  const handleShare = useCallback(async () => {
    const { sha } = await encodeTheme(theme);
    // Try to create short URL
    try {
      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: theme.name || 'Shared Theme',
          colors: theme.colors,
          sha,
          author_id: user?.id || null,
          author_name: user?.display_name || user?.email || null,
          category: 'dark',
        }),
      });
      if (res.ok) {
        const { theme: saved } = await res.json();
        if (saved?.id) {
          const shortUrl = `${window.location.origin}/t/${saved.id}`;
          setShareUrl(shortUrl);
          try {
            await navigator.clipboard.writeText(shortUrl);
            setCopied(true);
            toast.success('Short URL copied!');
            setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.success('Short URL ready');
          }
          return;
        }
      }
    } catch { /* fall through */ }
    // Fallback: full URL
    const fullUrl = `${window.location.origin}/colors/${sha}`;
    setShareUrl(fullUrl);
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success('Share URL copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.success('URL generated');
    }
  }, [theme, user]);

  const handlePublish = useCallback(async () => {
    if (!publishName.trim()) {
      toast.error('Give your theme a name');
      return;
    }
    setPublishing(true);
    try {
      const { sha } = await encodeTheme(theme);
      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: publishName.trim(),
          description: publishDesc.trim() || null,
          category: publishCategory,
          colors: theme.colors,
          sha,
          author_id: user?.id || null,
          author_name: user?.display_name || user?.email || null,
        }),
      });
      if (res.ok) {
        toast.success('Theme published to store!');
        setPublishName('');
        setPublishDesc('');
      } else {
        toast.error('Failed to publish');
      }
    } catch {
      toast.error('Failed to publish');
    }
    setPublishing(false);
  }, [theme, publishName, publishDesc, publishCategory, user]);

  if (!editorOpen) return null;

  const groups = {
    ui: THEME_COLOR_FIELDS.filter((f) => f.group === 'ui'),
    text: THEME_COLOR_FIELDS.filter((f) => f.group === 'text'),
    script: THEME_COLOR_FIELDS.filter((f) => f.group === 'script'),
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: theme.colors.bgBase }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0" style={{ background: theme.colors.bgSurface, borderColor: theme.colors.border }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: theme.colors.brand + '22' }}>
            <Icon name="palette" size="md" className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>Theme Editor</h1>
            <p className="text-[11px]" style={{ color: theme.colors.textMuted }}>Customize colors · Share with others</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { useThemeStore.getState().resetTheme(); toast.success('Reset to default'); }}>
            Reset
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare}>
            <Icon name="share" size="sm" className="mr-1" />
            Share Theme
          </Button>
          <button onClick={() => setEditorOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
            <Icon name="close" size="md" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: preview */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto" style={{ background: theme.colors.bgBase }}>
          <ScriptPreview colors={theme.colors} />
        </div>

        {/* Right: controls */}
        <div className="w-[320px] border-l overflow-y-auto p-5 space-y-6 flex-shrink-0" style={{ background: theme.colors.bgSurface, borderColor: theme.colors.border }}>
          {/* UI Colors */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: theme.colors.textMuted }}>Interface</h3>
            <div className="space-y-3">
              {groups.ui.map((f) => (
                <ColorField
                  key={f.key}
                  label={f.label}
                  value={theme.colors[f.key]}
                  onChange={(v) => updateColor(f.key, v)}
                />
              ))}
            </div>
          </div>

          {/* Text Colors */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: theme.colors.textMuted }}>Text</h3>
            <div className="space-y-3">
              {groups.text.map((f) => (
                <ColorField
                  key={f.key}
                  label={f.label}
                  value={theme.colors[f.key]}
                  onChange={(v) => updateColor(f.key, v)}
                />
              ))}
            </div>
          </div>

          {/* Script Colors */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: theme.colors.textMuted }}>Script Editor</h3>
            <div className="space-y-3">
              {groups.script.map((f) => (
                <ColorField
                  key={f.key}
                  label={f.label}
                  value={theme.colors[f.key]}
                  onChange={(v) => updateColor(f.key, v)}
                />
              ))}
            </div>
          </div>

          {/* Share URL */}
          {shareUrl && (
            <div className="pt-4 border-t" style={{ borderColor: theme.colors.border }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: theme.colors.textMuted }}>Share URL</h3>
              <div className="flex gap-1">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-[10px] text-surface-300 font-mono focus:outline-none"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Copied'); }}
                  className="px-2 py-1.5 rounded text-xs font-medium transition-colors"
                  style={{ background: theme.colors.brand + '22', color: theme.colors.brand }}
                >
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Publish to Store */}
          <div className="pt-4 border-t" style={{ borderColor: theme.colors.border }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: theme.colors.textMuted }}>Publish to Store</h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Theme name"
                value={publishName}
                onChange={(e) => setPublishName(e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-xs text-surface-300 focus:outline-none focus:border-white/30"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={publishDesc}
                onChange={(e) => setPublishDesc(e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-xs text-surface-300 focus:outline-none focus:border-white/30"
              />
              <select
                value={publishCategory}
                onChange={(e) => setPublishCategory(e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-xs text-surface-300 focus:outline-none"
              >
                {THEME_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                ))}
              </select>
              <button
                onClick={handlePublish}
                disabled={publishing || !publishName.trim()}
                className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                style={{ background: theme.colors.brand, color: '#fff' }}
              >
                {publishing ? 'Publishing...' : 'Publish Theme'}
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="pt-4 border-t" style={{ borderColor: theme.colors.border }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: theme.colors.textMuted }}>Presets</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Default', colors: DEFAULT_THEME.colors },
                { name: 'Midnight', colors: { ...DEFAULT_THEME.colors, bgBase: '#0a0a1a', bgSurface: '#0f0f2a', brand: '#818cf8' } },
                { name: 'Ember', colors: { ...DEFAULT_THEME.colors, bgBase: '#0f0505', bgSurface: '#1a0a0a', brand: '#ef4444' } },
                { name: 'Forest', colors: { ...DEFAULT_THEME.colors, bgBase: '#050f08', bgSurface: '#0a1a10', brand: '#22c55e' } },
                { name: 'Ocean', colors: { ...DEFAULT_THEME.colors, bgBase: '#050a0f', bgSurface: '#0a1520', brand: '#0ea5e9' } },
                { name: 'Lavender', colors: { ...DEFAULT_THEME.colors, bgBase: '#0a050f', bgSurface: '#150a20', brand: '#a78bfa' } },
              ].map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setTheme({ name: preset.name, colors: preset.colors })}
                  className="flex items-center gap-2 p-2 rounded-lg border transition-all hover:scale-[1.02]"
                  style={{ borderColor: theme.colors.border, background: theme.colors.bgElevated }}
                >
                  <div className="flex gap-0.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: preset.colors.brand }} />
                    <div className="w-3 h-3 rounded-sm" style={{ background: preset.colors.bgBase }} />
                    <div className="w-3 h-3 rounded-sm" style={{ background: preset.colors.scriptBg }} />
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: theme.colors.textSecondary }}>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
