'use client';

// ============================================================
// LevelUpCelebration — a non-intrusive corner popup
// Auto-dismisses after 5 seconds
// ============================================================

import { useEffect, useState } from 'react';
import { getLevelTitle } from '@/lib/gamification';

interface Props {
  level: number;
  unlocks: string[];
  onDismiss: () => void;
}

export function LevelUpCelebration({ level, unlocks, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50);
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDismiss]);

  const title = getLevelTitle(level);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] w-72 rounded-2xl border border-[#FF5F1F]/30 bg-[#0D0D1A] shadow-2xl transition-all duration-400 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ boxShadow: '0 0 32px rgba(255,95,31,0.2)' }}
    >
      {/* Shimmer top bar */}
      <div className="h-1 rounded-t-2xl bg-gradient-to-r from-[#FF5F1F] via-yellow-400 to-[#FF5F1F] animate-pulse" />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#FF5F1F]/60 mb-0.5">
              Level up!
            </p>
            <p className="text-lg font-black text-white">Level {level}</p>
            <p className="text-sm text-[#FF5F1F] font-medium">{title}</p>

            {unlocks.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {unlocks.map((u) => (
                  <p key={u} className="text-[11px] text-white/60 flex items-center gap-1">
                    <span className="text-[#FF5F1F]">✦</span> {u}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 w-12 h-12 rounded-xl bg-[#FF5F1F]/10 border border-[#FF5F1F]/20 flex items-center justify-center">
            <span className="text-2xl">⭐</span>
          </div>
        </div>

        {/* Progress bar counting down */}
        <div className="mt-3 h-0.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-[#FF5F1F]/60 rounded-full"
            style={{ animation: 'shrink-width 5s linear forwards' }}
          />
        </div>

        <style>{`
          @keyframes shrink-width {
            from { width: 100%; }
            to   { width:   0%; }
          }
        `}</style>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 400); }}
        className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors text-xs"
      >
        ✕
      </button>
    </div>
  );
}
