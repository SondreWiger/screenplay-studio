'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Cloud, HardDrive, Loader2, Lock, RefreshCw, Users } from 'lucide-react';
import { isElectronMode } from '@/lib/supabase/electron-client';
import { cn } from '@/lib/utils';

type Choice = 'cloud' | 'local';

const OPTIONS: {
  id: Choice;
  title: string;
  body: string;
  icon: typeof Cloud;
  points: { icon: typeof Cloud; text: string }[];
}[] = [
  {
    id: 'cloud',
    title: 'Sign in',
    body: 'Use your Screenplay Studio account.',
    icon: Cloud,
    points: [
      { icon: RefreshCw, text: 'Syncs with the web, iPhone and iPad' },
      { icon: Users, text: 'Write and plan with collaborators' },
    ],
  },
  {
    id: 'local',
    title: 'Use without an account',
    body: 'Everything stays on this computer.',
    icon: HardDrive,
    points: [
      { icon: Lock, text: 'Nothing leaves this machine' },
      { icon: HardDrive, text: 'Projects saved in your Documents folder' },
    ],
  },
];

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

function AppMark() {
  return (
    <svg width="72" height="72" viewBox="0 0 512 512" aria-hidden="true" className="drop-shadow-[0_14px_30px_rgba(255,95,31,0.3)]">
      <defs>
        <linearGradient id="onboarding-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF5F1F" />
          <stop offset="1" stopColor="#CC4312" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="480" height="480" rx="108" fill="url(#onboarding-mark)" />
      <path d="M160 176h192M160 240h160M160 304h176M160 176v192" stroke="#fff" strokeWidth="22" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The desktop app's first-run screen: sign in, or keep everything local.
 */
export default function DesktopOnboarding() {
  const router = useRouter();
  const [busy, setBusy] = useState<Choice | null>(null);

  useEffect(() => {
    if (!isElectronMode()) {
      router.replace('/dashboard');
      return;
    }
    // Already chosen (e.g. the cookie was cleared): skip straight past this.
    const completed = window.electron?.getPreferenceSync?.('ss-onboarding-completed');
    const choice = window.electron?.getPreferenceSync?.('ss-auth-choice');
    if (completed === '1' && choice) {
      setCookie('ss-onboarding-completed', '1');
      setCookie('ss-auth-choice', choice === 'local' ? 'local' : 'cloud');
      if (choice === 'local') {
        setCookie('ss-local-mode', '1');
        window.location.replace('/dashboard');
      } else {
        router.replace('/auth/login');
      }
    }
  }, [router]);

  const choose = async (choice: Choice) => {
    if (busy) return;
    setBusy(choice);

    const bridge = window.electron;
    await bridge?.setPreference('ss-onboarding-completed', '1');
    await bridge?.setPreference('ss-auth-choice', choice);
    localStorage.setItem('ss-onboarding-completed', '1');
    localStorage.setItem('ss-auth-choice', choice);
    setCookie('ss-onboarding-completed', '1');
    setCookie('ss-auth-choice', choice);

    if (choice === 'local') {
      await bridge?.setPreference('ss-local-mode', '1');
      localStorage.setItem('ss-local-mode', '1');
      setCookie('ss-local-mode', '1');
      const { createLocalUser } = await import('@/lib/supabase/electron-client');
      createLocalUser('Local Writer');
      // A full load, not a client navigation: auth already started up in
      // cloud mode on this page and has to start again in local mode.
      window.location.assign('/dashboard');
    } else {
      router.replace('/auth/login');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-6 py-16">
      <div className="w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="mb-10 flex flex-col items-center text-center"
        >
          <AppMark />
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white">Welcome to Screenplay Studio</h1>
          <p className="mt-2 max-w-md text-sm text-surface-400">
            How would you like to work? You can switch later in Settings, and nothing you write is lost either way.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((opt, i) => {
            const Icon = opt.icon;
            const isBusy = busy === opt.id;
            return (
              <motion.button
                key={opt.id}
                type="button"
                onClick={() => choose(opt.id)}
                disabled={!!busy}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 + i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                className={cn(
                  'group relative flex flex-col rounded-2xl border p-6 text-left transition-colors',
                  'border-surface-800 bg-surface-900/60 hover:border-brand-500/50 hover:bg-surface-900',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  busy && !isBusy && 'opacity-50',
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-800 text-surface-300 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-4 text-base font-semibold text-white">{opt.title}</span>
                <span className="mt-1 text-sm text-surface-400">{opt.body}</span>
                <ul className="mt-5 space-y-2">
                  {opt.points.map((p) => {
                    const PointIcon = p.icon;
                    return (
                      <li key={p.text} className="flex items-center gap-2 text-xs text-surface-400">
                        <PointIcon className="h-3.5 w-3.5 shrink-0 text-surface-500" />
                        {p.text}
                      </li>
                    );
                  })}
                </ul>
                <span className="mt-6 flex items-center gap-1.5 text-sm font-medium text-brand-400">
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isBusy ? 'One moment…' : 'Continue'}
                  {!isBusy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
