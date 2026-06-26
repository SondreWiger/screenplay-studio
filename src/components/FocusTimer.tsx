'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type Phase = 'work' | 'break';

interface FocusTimerProps {
  /** Called when a full work session completes — hook up to XP award */
  onSessionComplete?: () => void;
  /** Work duration in minutes (default 25) */
  workMinutes?: number;
  /** Break duration in minutes (default 5) */
  breakMinutes?: number;
}

export function FocusTimer({
  onSessionComplete,
  workMinutes = 25,
  breakMinutes = 5,
}: FocusTimerProps) {
  const [phase, setPhase] = useState<Phase>('work');
  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const totalSeconds = phase === 'work' ? workMinutes * 60 : breakMinutes * 60;
  const progress = (secondsLeft / totalSeconds) * 100;
  const circumference = 2 * Math.PI * 22; // r=22
  const dashOffset = circumference * (1 - progress / 100);

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');

  const switchPhase = useCallback((nextPhase: Phase) => {
    setPhase(nextPhase);
    setSecondsLeft(nextPhase === 'work' ? workMinutes * 60 : breakMinutes * 60);
    setRunning(false);
  }, [workMinutes, breakMinutes]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          if (phase === 'work') {
            setSessions((s) => s + 1);
            onSessionComplete?.();
            // Browser notification if permitted
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('Focus session complete! 🎉', {
                body: 'Take a 5-minute break.',
                icon: '/icon-192/icon.png',
              });
            }
            switchPhase('break');
          } else {
            switchPhase('work');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, phase, switchPhase, onSessionComplete]);

  const toggle = () => setRunning((r) => !r);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(workMinutes * 60);
    setPhase('work');
  };

  const ringColor = phase === 'work'
    ? 'var(--theme-brand, #FF5F1F)'
    : '#4ade80';

  if (!expanded) {
    // Collapsed pill — just shows the timer + toggle
    return (
      <button
        onClick={() => setExpanded(true)}
        title="Open Focus Timer"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-surface-700 bg-surface-900 hover:bg-surface-800 transition-colors text-xs font-mono text-surface-300 hover:text-surface-100"
        aria-label="Open focus timer"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-green-400 animate-pulse' : 'bg-surface-600'}`} />
        {minutes}:{seconds}
      </button>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl w-[200px]"
      role="timer"
      aria-label={`Focus timer — ${phase === 'work' ? 'Work' : 'Break'} phase`}
    >
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <span className="text-[10px] font-bold uppercase tracking-widest text-surface-500">
          {phase === 'work' ? '🎯 Focus' : '☕ Break'}
        </span>
        <button
          onClick={() => setExpanded(false)}
          className="text-surface-600 hover:text-surface-400 transition-colors text-xs"
          aria-label="Collapse timer"
        >
          ✕
        </button>
      </div>

      {/* Ring */}
      <div className="relative">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
          <circle cx="32" cy="32" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
          <circle
            cx="32" cy="32" r="22"
            fill="none"
            stroke={ringColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-sm font-bold text-surface-100">
            {minutes}:{seconds}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
          style={{ background: running ? '#374151' : ringColor }}
          aria-label={running ? 'Pause timer' : 'Start timer'}
        >
          {running ? '⏸ Pause' : '▶ Start'}
        </button>
        <button
          onClick={reset}
          className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors"
          aria-label="Reset timer"
        >
          ↺
        </button>
      </div>

      {/* Session count */}
      <div className="flex items-center gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i < sessions % 4
                ? 'bg-[--theme-brand]'
                : 'bg-surface-700'
            }`}
          />
        ))}
        {sessions > 0 && (
          <span className="text-[10px] text-surface-500 ml-1">{sessions} done</span>
        )}
      </div>
    </div>
  );
}
