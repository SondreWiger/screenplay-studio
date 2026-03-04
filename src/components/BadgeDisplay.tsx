'use client';

// ============================================================
// BadgeDisplay — renders 1 or 2 badge chips next to a username
// ============================================================

import type { Badge, UserBadge } from '@/lib/types';

export type BadgeSize = 'xs' | 'sm' | 'md';

interface Props {
  /** Pass UserBadge[] (with .badge joined) or raw Badge[] */
  badges: (UserBadge & { badge?: Badge })[] | Badge[];
  /** Max badges to show (default: 2) */
  max?: number;
  size?: BadgeSize;
  className?: string;
}

function isBadge(b: unknown): b is Badge {
  return typeof b === 'object' && b !== null && 'emoji' in b && 'color' in b;
}

function resolveBadge(item: (UserBadge & { badge?: Badge }) | Badge): Badge | null {
  if (isBadge(item)) return item;
  return (item as UserBadge & { badge?: Badge }).badge ?? null;
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  xs: 'text-[10px] px-1 py-[1px] gap-0.5 rounded',
  sm: 'text-[11px] px-1.5 py-[1px] gap-0.5 rounded',
  md: 'text-xs px-2 py-0.5 gap-1 rounded-md',
};

export function BadgeDisplay({ badges, max = 2, size = 'xs', className = '' }: Props) {
  if (!badges || badges.length === 0) return null;

  const resolved = badges
    .slice(0, max)
    .map(resolveBadge)
    .filter((b): b is Badge => b !== null);

  if (resolved.length === 0) return null;

  return (
    <>
      {resolved.map((badge) => (
        <span
          key={badge.id}
          title={badge.description ?? badge.name}
          className={`inline-flex items-center font-bold border ${SIZE_CLASSES[size]} ${className}`}
          style={{
            color:           badge.color,
            borderColor:     `${badge.color}40`,
            backgroundColor: `${badge.color}15`,
          }}
        >
          <span role="img" aria-label={badge.name}>{badge.emoji}</span>
          <span>{badge.name}</span>
        </span>
      ))}
    </>
  );
}

/** Convenience: picks the display-slot-assigned badges (slot 1 or 2) */
export function getDisplayBadges(
  userBadges: (UserBadge & { badge?: Badge })[],
): (UserBadge & { badge?: Badge })[] {
  return userBadges
    .filter((b) => b.display_slot != null)
    .sort((a, b) => (a.display_slot ?? 9) - (b.display_slot ?? 9));
}
