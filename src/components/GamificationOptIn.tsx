'use client';

// ============================================================
// GamificationOptIn — "one quick question" popup
// Shown once after onboarding completes (on next session)
// ============================================================

import { useState } from 'react';
import { useGamification } from '@/hooks/useGamification';

export function GamificationOptIn() {
  const { gamif, setGamificationEnabled, markPopupShown } = useGamification();
  const [dismissed, setDismissed] = useState(false);
  const [animating, setAnimating] = useState(false);

  // Don't render if:
  // - popup already shown
  // - already made a decision
  // - still loading (gamif is null)
  if (dismissed) return null;
  if (!gamif) return null;
  if (gamif.popup_shown) return null;
  if (gamif.gamification_enabled !== null) return null;

  const choose = async (enabled: boolean) => {
    setAnimating(true);
    await setGamificationEnabled(enabled);
    setDismissed(true);
  };

  const skip = async () => {
    await markPopupShown();
    setDismissed(true);
  };

  return (
    <div
      className={`fixed inset-0 z-[9998] flex items-end justify-center pb-8 px-4 pointer-events-none transition-opacity duration-300 ${
        animating ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-[#0D0D1A] border border-white/10 shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}
      >
        {/* Orange accent line */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-[#FF5F1F] to-transparent" />

        <div className="p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#FF5F1F]/60 mb-1">
            One quick question
          </p>
          <h2 className="text-xl font-black text-white mb-1">
            Want to gamify your writing? 🎮
          </h2>
          <p className="text-sm text-white/50 leading-relaxed mb-4">
            Earn XP for every word you write, post you share, and challenge you enter. 
            Level up, unlock profile effects, and collect badges — all without interrupting your flow.
          </p>

          {/* Feature overview */}
          <div className="space-y-2 mb-5">
            {[
              { icon: '✍️', text: 'XP per word — multiplied by how long you\'ve been writing' },
              { icon: '🏅', text: 'Badges: Admin, Moderator, Contributor, and custom ones' },
              { icon: '🔥', text: 'Time multiplier: 1h = 2×, 2h = 4×, 3h = 8× XP' },
              { icon: '✨', text: 'Level up to unlock profile glows and display options' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-start gap-2.5">
                <span className="text-base leading-5">{icon}</span>
                <p className="text-xs text-white/60 leading-4">{text}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => choose(true)}
              className="flex-1 py-2.5 rounded-xl bg-[#FF5F1F] hover:bg-[#E54E15] text-white text-sm font-bold transition-colors"
            >
              Let&apos;s go! 🚀
            </button>
            <button
              onClick={() => choose(false)}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium transition-colors"
            >
              Not for me
            </button>
          </div>

          <button
            onClick={skip}
            className="mt-2 w-full text-center text-[11px] text-white/20 hover:text-white/40 transition-colors"
          >
            Decide later
          </button>
        </div>
      </div>
    </div>
  );
}
