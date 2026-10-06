'use client';

import { useGamification } from '@/hooks/useGamification';

export function StreakBadge() {
  const { gamif, loading } = useGamification();
  const streak = gamif?.login_streak ?? 0;

  if (loading || streak < 2) return null;

  const label = streak >= 30 ? 'HOT' : streak >= 14 ? 'ON FIRE' : streak >= 7 ? 'BLAZING' : 'LIT';
  const colors = streak >= 30 ? 'from-red-500 to-orange-500 text-red-100 border-red-500/30'
    : streak >= 14 ? 'from-orange-500 to-amber-500 text-orange-100 border-orange-500/30'
    : streak >= 7 ? 'from-amber-500 to-yellow-500 text-amber-100 border-amber-500/30'
    : 'from-yellow-500 to-brand-500 text-yellow-100 border-yellow-500/30';

  return (
    <span
      className={`text-xs px-2 py-0.5 font-semibold uppercase tracking-[0.04em] bg-gradient-to-r ${colors} border rounded-full flex items-center gap-1`}
      title={`${streak}-day login streak`}
    >
      <span className="text-[11px] font-bold">{streak}</span>
      <span className="hidden sm:inline">&nbsp;{label}</span>
    </span>
  );
}
