'use client';

import { cn } from '@/lib/utils';

interface ThemePreviewProps {
  theme: 'default' | 'soft';
  accentColor?: string;
  className?: string;
}

/**
 * Mini screenplay snippet preview showing how the theme looks.
 * Used in onboarding and settings.
 */
export function ThemePreview({ theme, accentColor, className }: ThemePreviewProps) {
  const accent = accentColor || 'brand';

  return (
    <div
      data-accent={accent}
      data-theme={theme === 'soft' ? 'soft' : undefined}
      className={cn(
        'rounded-xl overflow-hidden border-2 transition-all duration-300',
        theme === 'soft'
          ? 'border-white/10 bg-[#0d0d18]'
          : 'border-white/10 bg-[#070710]',
        className
      )}
    >
      {/* Mini toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.02]">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <div className="w-2 h-2 rounded-full bg-white/10" />
        </div>
        <span className="text-[9px] text-white/30 font-medium ml-1 tracking-wide">screenplay.studio</span>
      </div>

      {/* Script content */}
      <div className="px-5 py-4 space-y-3 font-mono text-white">
        {/* Scene heading */}
        <div className="text-[11px] uppercase tracking-wider text-white/90 font-bold">
          INT. COFFEE SHOP — DAY
        </div>

        {/* Action */}
        <div className="text-[10px] text-white/60 leading-relaxed pl-0">
          A quiet corner booth. Maya fidgets with her napkin, eyes fixed on the door.
        </div>

        {/* Character */}
        <div className="text-[10px] uppercase font-semibold text-white/80 tracking-wider pt-1" style={{ marginLeft: '0.5in' }}>
          MAYA
        </div>

        {/* Dialogue */}
        <div className="text-[10px] text-white/60 leading-relaxed" style={{ marginLeft: '1.5in', marginRight: '0.5in' }}>
          You&apos;re late. Again.
        </div>

        {/* Accent bar — shows the brand color */}
        <div className="pt-2">
          <div
            className="h-0.5 w-16 rounded-full mx-auto"
            style={{ backgroundColor: 'rgb(var(--brand-500))' }}
          />
        </div>
      </div>

      {/* Theme label */}
      <div className="px-3 py-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-[9px] text-white/25 font-medium uppercase tracking-wider">
          {theme === 'soft' ? 'Soft Pastels' : 'Default'}
        </span>
        <div className="flex gap-0.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(var(--brand-400))' }} />
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(var(--brand-600))' }} />
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(var(--brand-800))' }} />
        </div>
      </div>
    </div>
  );
}
