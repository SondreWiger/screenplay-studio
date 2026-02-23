'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

// ============================================================
// Guided Tour — shows after onboarding to highlight key features
// ============================================================

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: string;
  href?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Write Your Script',
    description: 'Start with the script editor — it supports industry-standard formatting with auto-complete for characters, scene headings, and transitions. Your work saves automatically.',
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    title: 'Build Your World',
    description: 'Create characters with personalities, add locations with photos, and map out your story with the mind map. All connected to your script.',
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    title: 'Plan Your Production',
    description: 'Break down scenes, plan shots with the storyboard, manage locations, and schedule shoot days. Toggle production tools on/off in settings anytime.',
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
  },
  {
    title: 'Collaborate With Your Team',
    description: 'Invite team members with different roles and permissions. Use real-time chat and comments to stay in sync. Everyone sees changes live.',
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  },
  {
    title: 'Pro Tools',
    description: 'Upgrade to unlock AI Script Analysis, Client Review portals, Advanced Export (PDF/DOCX/FDX), Custom Branding, Revisions, and Casting Tools — per-project or platform-wide.',
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5m-4.75-11.396c.251.023.501.05.75.082M12 3v5.386m0 0a2.25 2.25 0 001.5 2.122M12 8.386a2.25 2.25 0 00-1.5 2.122M5 14.5l3.5 3.5L12 14.5l3.5 3.5L19 14.5m-7 3.5V21" /></svg>,
  },
  {
    title: 'Share & Showcase',
    description: 'Share your script with secure links, join the community showcase, and use the blog for updates. Customize what\'s visible in project settings.',
    icon: <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
  },
];

interface GuidedTourProps {
  onComplete: () => void;
}

export function GuidedTour({ onComplete }: GuidedTourProps) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const handleFinish = useCallback(() => {
    setExiting(true);
    setTimeout(onComplete, 300);
  }, [onComplete]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleFinish();
      if (e.key === 'ArrowRight' && step < TOUR_STEPS.length - 1) setStep(s => s + 1);
      if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, handleFinish]);

  const current = TOUR_STEPS[step];

  return (
    <div className={cn(
      'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300',
      exiting ? 'opacity-0' : 'opacity-100'
    )}>
      <div className={cn(
        'relative w-full max-w-lg mx-4 bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300',
        exiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
      )}>
        {/* Progress */}
        <div className="h-1 bg-surface-800">
          <div
            className="h-full bg-brand-500 transition-all duration-500"
            style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-brand-400">
            {current.icon}
          </div>

          <div className="text-xs text-surface-500 font-medium mb-2">
            {step + 1} of {TOUR_STEPS.length}
          </div>

          <h2 className="text-xl font-bold text-white mb-3">{current.title}</h2>
          <p className="text-sm text-surface-400 leading-relaxed max-w-sm mx-auto">{current.description}</p>
        </div>

        {/* Navigation */}
        <div className="border-t border-surface-800 px-6 py-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  i === step ? 'bg-brand-500 w-5' : i < step ? 'bg-brand-500/40' : 'bg-surface-700'
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {step === 0 && (
              <button
                onClick={handleFinish}
                className="text-xs text-surface-500 hover:text-surface-300 transition-colors"
              >
                Skip tour
              </button>
            )}
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>Back</Button>
            )}
            {step < TOUR_STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>Next</Button>
            ) : (
              <Button size="sm" onClick={handleFinish}>Start Creating</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
