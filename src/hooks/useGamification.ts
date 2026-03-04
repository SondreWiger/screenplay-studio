'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import {
  getSessionMultiplier, touchSession, getSessionHours,
  getLevelInfo, getLevelUnlocks, SESSION_STORAGE_KEY,
} from '@/lib/gamification';
import type { UserGamification, UserBadge, XPEventType } from '@/lib/types';

// ============================================================
// useGamification
//
// Provides:
//  - gamification state (xp, level, enabled flag)
//  - user badges
//  - awardXP()  — fires an XP event via API
//  - session multiplier (live, updated every 60 s)
//  - level-up detection (triggers brief celebration)
// ============================================================

export interface LevelUpEvent {
  newLevel: number;
  unlocks: string[];
}

export function useGamification() {
  const { user } = useAuth();
  const [gamif, setGamif] = useState<UserGamification | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [multiplier, setMultiplier] = useState(1);
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);
  const prevLevelRef = useRef<number>(1);

  // ── Load state ──────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const supabase = createClient();

    const [{ data: g }, { data: b }] = await Promise.all([
      supabase.from('user_gamification').select('*').eq('user_id', user.id).single(),
      supabase.from('user_badges').select('*, badge:badges(*)').eq('user_id', user.id),
    ]);

    if (g) {
      setGamif(g as UserGamification);
      prevLevelRef.current = (g as UserGamification).level;
    }
    if (b) setBadges(b as UserBadge[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Live multiplier refresh (every 60 s) ────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Start session on first mount
    if (!sessionStorage.getItem(SESSION_STORAGE_KEY)) {
      touchSession();
    }
    setMultiplier(getSessionMultiplier());

    const id = setInterval(() => {
      touchSession();
      setMultiplier(getSessionMultiplier());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Award XP ────────────────────────────────────────────────
  const awardXP = useCallback(async (
    eventType: XPEventType,
    overrideMultiplier?: number,
  ) => {
    if (!user) return;

    const mult = overrideMultiplier ?? (
      // Time-based multiplier only applies to writing events
      eventType === 'words_written' ? getSessionMultiplier() : 1
    );

    try {
      const res = await fetch('/api/gamification/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, multiplier: mult }),
      });
      if (!res.ok) return;

      const { xp_awarded, xp_total, level } = await res.json() as {
        xp_awarded: number; xp_total: number; level: number;
      };

      setGamif((prev) => prev ? { ...prev, xp_total, level } : prev);

      // Level-up detection
      if (level > prevLevelRef.current) {
        const unlocks = getLevelUnlocks(level);
        setLevelUpEvent({ newLevel: level, unlocks });
        prevLevelRef.current = level;
      }

      return xp_awarded;
    } catch {
      // Silently ignore — XP is best-effort
    }
  }, [user]);

  // ── Dismiss level-up event ──────────────────────────────────
  const dismissLevelUp = useCallback(() => setLevelUpEvent(null), []);

  // ── Opt-in / opt-out ────────────────────────────────────────
  const setGamificationEnabled = useCallback(async (enabled: boolean) => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from('user_gamification')
      .update({ gamification_enabled: enabled, popup_shown: true })
      .eq('user_id', user.id);
    setGamif((prev) => prev ? { ...prev, gamification_enabled: enabled, popup_shown: true } : prev);
  }, [user]);

  const markPopupShown = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from('user_gamification').update({ popup_shown: true }).eq('user_id', user.id);
    setGamif((prev) => prev ? { ...prev, popup_shown: true } : prev);
  }, [user]);

  // ── Derived ─────────────────────────────────────────────────
  const levelInfo = gamif ? getLevelInfo(gamif.xp_total) : null;
  const enabled   = gamif?.gamification_enabled ?? null;
  const hours     = getSessionHours();

  return {
    gamif,
    badges,
    loading,
    enabled,
    levelInfo,
    multiplier,
    sessionHours: hours,
    levelUpEvent,
    dismissLevelUp,
    awardXP,
    setGamificationEnabled,
    markPopupShown,
    reload: load,
  };
}
