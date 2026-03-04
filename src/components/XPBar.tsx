'use client';

// ============================================================
// XPBar — compact experience progress bar for profile pages
// ============================================================

import { getLevelInfo, getLevelTitle, getGlowTier, GLOW_CLASSES } from '@/lib/gamification';

interface Props {
  xpTotal: number;
  level: number;
  multiplier?: number;
  /** Show level title */
  showTitle?: boolean;
  /** Show multiplier badge */
  showMultiplier?: boolean;
  animated?: boolean;
  className?: string;
}

export function XPBar({
  xpTotal,
  level,
  multiplier = 1,
  showTitle = true,
  showMultiplier = true,
  animated = false,
  className = '',
}: Props) {
  const { progressPercent, xpForCurrentLevel, xpForNextLevel } = getLevelInfo(xpTotal);
  const title = getLevelTitle(level);
  const glowTier = getGlowTier(level);
  const glowClass = GLOW_CLASSES[glowTier];

  // Color gradient shifts per glow tier
  const barColors: Record<typeof glowTier, string> = {
    none:     'from-[#FF5F1F] to-orange-400',
    bronze:   'from-amber-600 to-amber-400',
    silver:   'from-slate-400 to-slate-200',
    gold:     'from-yellow-500 to-yellow-300',
    platinum: 'from-sky-300 to-white',
    rainbow:  'from-pink-500 via-yellow-400 to-cyan-400',
  };

  return (
    <div className={`select-none ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-xs font-black text-[#FF5F1F] ${glowClass}`}
          >
            Lvl {level}
          </span>
          {showTitle && (
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">
              {title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showMultiplier && multiplier > 1 && (
            <span className="text-[9px] font-black text-[#FF5F1F] bg-[#FF5F1F]/10 px-1.5 py-0.5 rounded-full border border-[#FF5F1F]/20 animate-pulse">
              {multiplier}× XP
            </span>
          )}
          <span className="text-[10px] text-white/25 font-mono">
            {xpTotal.toLocaleString()} XP
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColors[glowTier]} ${
            animated ? 'transition-all duration-1000 ease-out' : ''
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {level < 100 && (
        <div className="flex justify-end mt-0.5">
          <span className="text-[9px] text-white/20 font-mono">
            {(xpForNextLevel - xpTotal).toLocaleString()} XP to next level
          </span>
        </div>
      )}
    </div>
  );
}
