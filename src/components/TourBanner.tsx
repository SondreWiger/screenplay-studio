'use client';

import { useState, useEffect } from 'react';
import { getTourState, resumeTour, endTour } from '@/lib/tourState';
import { cn } from '@/lib/utils';

interface TourBannerProps {
  onResume: () => void;
}

export default function TourBanner({ onResume }: TourBannerProps) {
  const [visible, setVisible] = useState(false);
  const [stepLabel, setStepLabel] = useState('');

  useEffect(() => {
    const saved = getTourState();
    // Show banner only when tour is paused (not active, but has progress)
    if (saved && !saved.active && saved.step > 0) {
      setStepLabel(`Step ${saved.step + 1}`);
      // Fade in after a short delay
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const handleResume = () => {
    setVisible(false);
    setTimeout(() => {
      resumeTour();
      onResume();
    }, 250);
  };

  const handleDismiss = () => {
    setVisible(false);
    endTour();
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-white/15 bg-slate-900/95 px-5 py-3.5 shadow-2xl backdrop-blur-md',
        'transition-all duration-300',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-500)] text-sm font-bold text-white">
        1
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-white/90">Continue the tour</span>
        <span className="text-[11px] text-white/50">{stepLabel}</span>
      </div>
      <button
        onClick={handleResume}
        className="ml-2 rounded-lg bg-[var(--accent-500)] px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-110"
      >
        Resume
      </button>
      <button
        onClick={handleDismiss}
        className="ml-1 rounded-lg px-2 py-1.5 text-[12px] text-white/40 transition hover:text-white/70"
        aria-label="Dismiss tour"
      >
        ✕
      </button>
    </div>
  );
}
