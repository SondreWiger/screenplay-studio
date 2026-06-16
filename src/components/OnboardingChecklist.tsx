'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  emoji: string;
  verifyKey: string;
}

const CHECKLIST: ChecklistItem[] = [
  {
    id: 'project',
    label: 'Create your first project',
    description: 'Set up a screenplay project to start writing',
    href: '/dashboard',
    emoji: '📁',
    verifyKey: 'has_projects',
  },
  {
    id: 'write',
    label: 'Write your first words',
    description: 'Add 100 words to your script and earn your first XP',
    href: '/script',
    emoji: '✍️',
    verifyKey: 'has_written',
  },
  {
    id: 'character',
    label: 'Add a character',
    description: 'Create your first character profile',
    href: '/characters',
    emoji: '👤',
    verifyKey: 'has_characters',
  },
  {
    id: 'scene',
    label: 'Break down a scene',
    description: 'Plan your first scene breakdown',
    href: '/scenes',
    emoji: '🎬',
    verifyKey: 'has_scenes',
  },
  {
    id: 'location',
    label: 'Add a location',
    description: 'Log where your story takes place',
    href: '/locations',
    emoji: '📍',
    verifyKey: 'has_locations',
  },
  {
    id: 'schedule',
    label: 'Schedule a shoot day',
    description: 'Plan your first production day',
    href: '/schedule',
    emoji: '📅',
    verifyKey: 'has_schedule',
  },
  {
    id: 'team',
    label: 'Invite a collaborator',
    description: 'Work together with your team',
    href: '/team',
    emoji: '👥',
    verifyKey: 'has_team',
  },
  {
    id: 'profile',
    label: 'Complete your profile',
    description: 'Add a bio, avatar, and social links',
    href: '/settings',
    emoji: '🪪',
    verifyKey: 'has_profile',
  },
];

const STORAGE_KEY = 'ss-onboarding-checklist';

interface ChecklistState {
  completed: string[];
  dismissed: boolean;
}

function loadState(): ChecklistState {
  if (typeof window === 'undefined') return { completed: [], dismissed: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { completed: [], dismissed: false };
}

function saveState(state: ChecklistState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function OnboardingChecklist({ projectId }: { projectId?: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<ChecklistState>({ completed: [], dismissed: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = loadState();
    setState(s);
    setLoaded(true);
  }, []);

  const persistCompleted = useCallback((id: string) => {
    setState(prev => {
      if (prev.completed.includes(id)) return prev;
      const next = { ...prev, completed: [...prev.completed, id] };
      saveState(next);
      return next;
    });
  }, []);

  const completeItem = useCallback((item: ChecklistItem) => {
    persistCompleted(item.id);
  }, [persistCompleted]);

  const dismiss = useCallback(() => {
    const next = { ...state, dismissed: true };
    saveState(next);
    setState(next);
  }, [state]);

  // Auto-verify completed items when projectId is known
  useEffect(() => {
    if (!projectId || !loaded) return;

    const checkVerification = async () => {
      const currentState = loadState();

      // Check if profile is complete (display_name set)
      if (!currentState.completed.includes('profile')) {
        try {
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser?.user_metadata?.full_name || authUser?.user_metadata?.display_name) {
            // Check if user has a display name set
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, bio')
              .eq('id', authUser.id)
              .single();
            if (profile?.display_name || profile?.bio) {
              persistCompleted('profile');
            }
          }
        } catch {}
      }

      // Check if project has content
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();

        const checks: { id: string; fn: () => Promise<boolean> }[] = [
          {
            id: 'write',
            fn: async () => {
              if (currentState.completed.includes('write')) return false;
              const { count } = await supabase
                .from('script_elements')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', projectId);
              return (count || 0) >= 10;
            },
          },
          {
            id: 'character',
            fn: async () => {
              if (currentState.completed.includes('character')) return false;
              const { count } = await supabase
                .from('characters')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', projectId);
              return (count || 0) > 0;
            },
          },
          {
            id: 'scene',
            fn: async () => {
              if (currentState.completed.includes('scene')) return false;
              const { count } = await supabase
                .from('scenes')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', projectId);
              return (count || 0) > 0;
            },
          },
          {
            id: 'location',
            fn: async () => {
              if (currentState.completed.includes('location')) return false;
              const { count } = await supabase
                .from('locations')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', projectId);
              return (count || 0) > 0;
            },
          },
          {
            id: 'schedule',
            fn: async () => {
              if (currentState.completed.includes('schedule')) return false;
              const { count } = await supabase
                .from('production_schedule')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', projectId);
              return (count || 0) > 0;
            },
          },
          {
            id: 'team',
            fn: async () => {
              if (currentState.completed.includes('team')) return false;
              const { count } = await supabase
                .from('project_members')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', projectId)
                .not('user_id', 'eq', (await supabase.auth.getUser()).data.user?.id || '');
              return (count || 0) > 0;
            },
          },
        ];

        for (const check of checks) {
          if (!currentState.completed.includes(check.id)) {
            const done = await check.fn();
            if (done) persistCompleted(check.id);
          }
        }
      } catch {}
    };

    checkVerification();
  }, [projectId, loaded, persistCompleted]);

  if (!loaded || state.dismissed) return null;

  const remaining = CHECKLIST.filter(item => !state.completed.includes(item.id));
  const completedCount = CHECKLIST.length - remaining.length;
  const allDone = remaining.length === 0;

  return (
    <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 overflow-hidden transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">{allDone ? '🎉' : '🚀'}</span>
          <h3 className="text-sm font-semibold text-white">
            {allDone ? 'All set!' : 'Getting Started'}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-surface-500 tabular-nums">
            {completedCount}/{CHECKLIST.length}
          </span>
          <button
            onClick={dismiss}
            className="text-surface-600 hover:text-surface-400 transition-colors"
            title="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-0.5 bg-surface-800">
        <div
          className="h-full bg-gradient-to-r from-[#FF5F1F] to-[#FF8F5F] transition-[width] duration-500"
          style={{ width: `${(completedCount / CHECKLIST.length) * 100}%` }}
        />
      </div>

      {/* Items */}
      <div className="px-3 py-2 space-y-1">
        {remaining.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => {
              completeItem(item);
              const basePath = projectId ? `/projects/${projectId}` : '';
              router.push(basePath + item.href);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group"
          >
            <span className="text-base shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/80 group-hover:text-white transition-colors">{item.label}</p>
              <p className="text-[10px] text-surface-500 mt-0.5">{item.description}</p>
            </div>
            <svg className="w-4 h-4 text-surface-600 group-hover:text-[#FF5F1F] transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}

        {/* Completed items (collapsed) */}
        {state.completed.length > 0 && (
          <details className="group">
            <summary className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[10px] text-surface-600 hover:text-surface-400 transition-colors">
              <svg className="w-2.5 h-2.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {state.completed.length} completed
            </summary>
            <div className="space-y-0.5 mt-1">
              {CHECKLIST.filter(item => state.completed.includes(item.id)).map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="text-green-400 shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-[11px] text-surface-500 line-through">{item.label}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* All done state */}
      {allDone && (
        <div className="px-4 py-3 border-t border-surface-800/50 bg-gradient-to-r from-green-500/5 to-transparent">
          <p className="text-xs text-surface-400 text-center">
            🎉 You&apos;ve completed all the steps! Now dive into your project and start creating.
          </p>
        </div>
      )}
    </div>
  );
}
