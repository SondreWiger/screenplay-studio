'use client';

import { useEffect, useRef, useCallback } from 'react';
import { toast } from '@/components/ui';
import { pickToast, WORK_1H, WORK_2H, WORK_3H, WORK_4H, WORK_5H, WORK_12H, WORK_24H } from '@/lib/funToasts';

// ============================================================
// useWorkTimeTracker
//
// Tracks actual working time without being exploitable:
//
// ACTIVITY DETECTION
//   Listens for keydown, mousedown, scroll, input, touchstart.
//   Any of these marks the user as "active" for the next 5 minutes.
//
// HEARTBEAT
//   Every 30 s, if the user was active in the last 5 minutes,
//   POST /api/work-session — adding 30 s to their total.
//
// THINKING GRACE PERIOD
//   When the tab regains visibility after being hidden for 5–20 min,
//   we add min(idle_time × 0.5, 10 min) as a one-time credit.
//   This covers: writing notes on paper, reading, quick coffee break.
//   > 20 min away = no credit (clearly not working any more).
//
// ANTI-EXPLOIT
//   • Server validates auth on every request.
//   • Server enforces a minimum 20 s gap between heartbeats.
//   • Server caps grace at 600 s regardless of client value.
//   • session_key is a per-tab UUID (sessionStorage) — can't replay
//     across tabs or sessions to inflate a single row beyond the math.
//   • Page-hidden tabs stop sending heartbeats immediately.
//   • keepalive: true is used for the final unmount heartbeat so it
//     survives the page being closed.
// ============================================================

const HEARTBEAT_INTERVAL_MS  = 30_000;  // 30 seconds
const IDLE_THRESHOLD_MS      = 5 * 60 * 1000;  // 5 min = stop heartbeats
const GRACE_MIN_IDLE_MS      = 5 * 60 * 1000;  // min break before grace applies
const GRACE_MAX_IDLE_MS      = 20 * 60 * 1000; // max break to still get grace
const GRACE_MAX_SECONDS      = 600;            // absolute cap (10 min)
const RATE_LIMIT_GAP_MS      = 22_000;         // local guard matching server's 20 s

const ACTIVITY_EVENTS = [
  'keydown',
  'mousedown',
  'scroll',
  'input',
  'touchstart',
  'pointermove',
] as const;

// ── session key ──────────────────────────────────────────────
// One key per browser tab: stored in sessionStorage so it's lost
// when the tab closes, creating a fresh session on next visit.
function getSessionKey(projectId: string): string {
  const storageKey = `ss_wt_${projectId}`;
  try {
    let key = sessionStorage.getItem(storageKey);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
    }
    return key;
  } catch {
    // Private-browsing / storage denied — generate a transient key
    return crypto.randomUUID();
  }
}

// ── format helper (exported for display components) ──────────
export function formatWorkSeconds(seconds: number): string {
  if (seconds <= 0) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

// ── hook options ──────────────────────────────────────────────
export interface UseWorkTimeTrackerOptions {
  /** The project being worked on */
  projectId: string;
  /** Where in the app the user is (e.g. 'script', 'documents', 'arc-planner') */
  context?: string;
  /** Pass true to suspend tracking (e.g. viewer-only role) */
  disabled?: boolean;
}

// ============================================================
// Main hook
// ============================================================
export function useWorkTimeTracker({
  projectId,
  context = 'general',
  disabled = false,
}: UseWorkTimeTrackerOptions): void {
  const lastActivityRef   = useRef<number>(Date.now());
  const lastHeartbeatRef  = useRef<number>(0);
  const lastHiddenRef     = useRef<number>(0);  // when tab became hidden
  const sessionKeyRef     = useRef<string>('');
  const pendingGraceRef   = useRef<number>(0);  // one-shot grace to add next heartbeat
  const heartbeatTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef        = useRef(true);
  const sessionSecondsRef = useRef<number>(0);  // total active seconds this session
  const firedMilestonesRef = useRef<Set<number>>(new Set()); // hours already toasted

  // ── send a heartbeat ────────────────────────────────────────
  const sendHeartbeat = useCallback(
    async (graceSecs: number = 0, keepalive = false) => {
      if (!projectId || !sessionKeyRef.current) return;

      const now = Date.now();
      // Local rate-limit
      if (now - lastHeartbeatRef.current < RATE_LIMIT_GAP_MS && graceSecs === 0) return;
      lastHeartbeatRef.current = now;

      try {
        await fetch('/api/work-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id:          projectId,
            session_key:         sessionKeyRef.current,
            context,
            idle_grace_seconds:  Math.min(graceSecs, GRACE_MAX_SECONDS),
          }),
          keepalive, // survives page unload when true
        });
      } catch {
        // Network errors are silently ignored — this is fire-and-forget
      }
    },
    [projectId, context],
  );

  // ── activity handler ────────────────────────────────────────
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // ── main effect ─────────────────────────────────────────────
  useEffect(() => {
    if (disabled || !projectId) return;

    mountedRef.current  = true;
    sessionKeyRef.current = getSessionKey(projectId);
    lastActivityRef.current = Date.now();
    lastHeartbeatRef.current = 0;
    sessionSecondsRef.current = 0;
    firedMilestonesRef.current = new Set();

    // Register activity listeners (passive — no scroll blocking)
    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, recordActivity, { passive: true }),
    );

    // ── heartbeat loop ───────────────────────────────────────
    heartbeatTimer.current = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;

      // Only count time when the user is actually engaged
      if (idleMs < IDLE_THRESHOLD_MS) {
        const grace = pendingGraceRef.current;
        pendingGraceRef.current = 0; // consume one-shot grace
        sendHeartbeat(grace);

        // Accumulate active seconds and fire milestone toasts
        sessionSecondsRef.current += HEARTBEAT_INTERVAL_MS / 1000;
        const hrs = sessionSecondsRef.current / 3600;

        const MILESTONES: Array<{ at: number; fire: () => void }> = [
          { at: 1,  fire: () => toast.success(pickToast(WORK_1H))  },
          { at: 2,  fire: () => toast.success(pickToast(WORK_2H))  },
          { at: 3,  fire: () => toast.success(pickToast(WORK_3H))  },
          { at: 4,  fire: () => toast.warning(pickToast(WORK_4H))  },
          { at: 5,  fire: () => toast.success(pickToast(WORK_5H))  },
          { at: 12, fire: () => toast.warning(pickToast(WORK_12H)) },
          { at: 24, fire: () => toast.error(pickToast(WORK_24H))   },
        ];

        for (const milestone of MILESTONES) {
          if (hrs >= milestone.at && !firedMilestonesRef.current.has(milestone.at)) {
            firedMilestonesRef.current.add(milestone.at);
            milestone.fire();
          }
        }
      }
      // If idle, timer keeps running so we pick back up automatically
    }, HEARTBEAT_INTERVAL_MS);

    // ── visibility-change: thinking-grace logic ──────────────
    const handleVisibility = () => {
      const now = Date.now();

      if (document.hidden) {
        // Tab is going away — record the moment
        lastHiddenRef.current = now;
      } else {
        // Tab came back
        const hiddenMs = now - lastHiddenRef.current;

        if (
          lastHiddenRef.current > 0 &&
          hiddenMs >= GRACE_MIN_IDLE_MS &&
          hiddenMs < GRACE_MAX_IDLE_MS
        ) {
          // 5–20 min break: credit half the break time, max 10 min.
          // The multiplier of 0.5 means a 10-min break → 5 min credit,
          // 20-min break → clipped to 10 min. Exploiting this requires
          // hiding/showing the tab repeatedly — each cycle only pays once
          // and can never exceed the cap.
          const graceSecs = Math.round(
            Math.min((hiddenMs / 2) / 1000, GRACE_MAX_SECONDS),
          );
          pendingGraceRef.current = graceSecs;
        }

        // Restart activity clock so heartbeats resume
        lastActivityRef.current = now;
        lastHiddenRef.current   = 0;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Initial heartbeat on mount (marks the session start)
    sendHeartbeat(0);

    // ── cleanup ─────────────────────────────────────────────
    return () => {
      mountedRef.current = false;
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, recordActivity),
      );
      document.removeEventListener('visibilitychange', handleVisibility);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      // Final heartbeat on navigate-away / unmount
      sendHeartbeat(0, true /* keepalive */);
    };
  }, [disabled, projectId, context, sendHeartbeat, recordActivity]);
}
