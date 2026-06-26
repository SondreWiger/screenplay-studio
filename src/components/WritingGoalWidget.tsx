'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui';

interface WritingStats {
  totalWords: number;
  wordsToday: number;
  wordsThisWeek: number;
  avgWordsPerDay: number;
  totalProjects: number;
  writingGoal: number | null;
  goalProgress: number | null;
}

interface WritingGoalWidgetProps {
  userId: string;
}

export function WritingGoalWidget({ userId }: WritingGoalWidgetProps) {
  const [stats, setStats] = useState<WritingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/user/writing-stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setGoalInput(String(data.writingGoal ?? 500));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const saveGoal = async () => {
    const goal = parseInt(goalInput, 10);
    if (isNaN(goal) || goal < 1 || goal > 100000) {
      toast.error('Enter a valid goal between 1 and 100,000 words');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({ writing_goal_words_per_day: goal })
        .eq('id', userId);
      if (error) throw error;
      toast.success('Goal updated!');
      setEditingGoal(false);
      fetchStats();
    } catch {
      toast.error('Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 animate-pulse">
        <div className="h-4 w-32 bg-surface-700 rounded mb-4" />
        <div className="h-8 w-20 bg-surface-700 rounded" />
      </div>
    );
  }

  if (!stats) return null;

  const hasGoal = stats.writingGoal !== null && stats.writingGoal > 0;
  const progress = stats.goalProgress ?? 0;
  const circumference = 2 * Math.PI * 28; // r=28
  const dashOffset = circumference - (progress / 100) * circumference;
  const goalMet = progress >= 100;

  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">✍️</span>
          <h3 className="text-sm font-semibold text-surface-100">Writing Goal</h3>
        </div>
        <button
          onClick={() => setEditingGoal(!editingGoal)}
          className="text-[11px] font-medium text-surface-500 hover:text-surface-300 transition-colors"
        >
          {editingGoal ? 'cancel' : 'set goal'}
        </button>
      </div>

      {/* Goal editor */}
      {editingGoal && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder="e.g. 500"
            min={1}
            max={100000}
            className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-surface-800 border border-surface-700 text-surface-100 focus:outline-none focus:border-[--theme-brand]"
            onKeyDown={(e) => e.key === 'Enter' && saveGoal()}
            autoFocus
          />
          <span className="text-xs text-surface-500">words/day</span>
          <button
            onClick={saveGoal}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[--theme-brand] text-white disabled:opacity-50 transition-opacity"
          >
            {saving ? '…' : 'Save'}
          </button>
        </div>
      )}

      {/* Progress ring + today count */}
      {hasGoal ? (
        <div className="flex items-center gap-5">
          {/* Ring */}
          <div className="relative shrink-0">
            <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
              {/* Track */}
              <circle
                cx="36" cy="36" r="28"
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="5"
              />
              {/* Progress */}
              <circle
                cx="36" cy="36" r="28"
                fill="none"
                stroke={goalMet ? '#4ade80' : 'var(--theme-brand, #FF5F1F)'}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-bold ${goalMet ? 'text-green-400' : 'text-surface-100'}`}>
                {goalMet ? '✓' : `${progress}%`}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold text-surface-100 leading-none">
              {stats.wordsToday.toLocaleString()}
            </p>
            <p className="text-xs text-surface-500 mt-1">
              of {stats.writingGoal!.toLocaleString()} words today
            </p>
            {goalMet && (
              <p className="text-xs text-green-400 font-medium mt-1">🎉 Goal reached!</p>
            )}
            {!goalMet && stats.wordsToday > 0 && (
              <p className="text-xs text-surface-500 mt-1">
                {(stats.writingGoal! - stats.wordsToday).toLocaleString()} to go
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          <p className="text-sm text-surface-500">Set a daily word goal to track progress</p>
          <button
            onClick={() => setEditingGoal(true)}
            className="mt-2 text-xs font-semibold text-[--theme-brand] hover:underline"
          >
            Set goal →
          </button>
        </div>
      )}

      {/* Bottom stats row */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-800">
        {[
          { label: 'This week', value: stats.wordsThisWeek.toLocaleString() },
          { label: 'Daily avg', value: stats.avgWordsPerDay.toLocaleString() },
          { label: 'All time', value: stats.totalWords >= 1000
            ? `${(stats.totalWords / 1000).toFixed(1)}k`
            : stats.totalWords.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-sm font-semibold text-surface-100">{s.value}</p>
            <p className="text-[10px] text-surface-600 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
