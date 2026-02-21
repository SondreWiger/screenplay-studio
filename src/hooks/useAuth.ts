'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import type { Profile } from '@/lib/types';

// Safety timeout — if auth init takes longer than this, force loading to false
// to prevent infinite loading screens.
const AUTH_INIT_TIMEOUT_MS = 8_000;

// Helper: race a promise against a timeout. Rejects on timeout.
// Accepts PromiseLike (e.g. Supabase PostgrestBuilder) as well as native Promises.
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} took longer than ${ms}ms`)), ms)
    ),
  ]);
}

export function useAuth() {
  const { user, loading, initialized, setUser, setLoading, setInitialized } = useAuthStore();

  useEffect(() => {
    // Use the store's `initialized` flag so that multiple components calling useAuth()
    // don't each run initAuth() independently (avoids race conditions & duplicate listeners).
    if (useAuthStore.getState().initialized) return;
    setInitialized(true);

    const supabase = createClient();

    // Global safety timeout: force-clear loading if init hasn't completed.
    // This prevents permanent loading screens from hung network requests.
    const safetyTimer = setTimeout(() => {
      if (useAuthStore.getState().loading) {
        console.warn('[useAuth] Safety timeout reached — forcing loading to false');
        setLoading(false);
      }
    }, AUTH_INIT_TIMEOUT_MS);

    const initAuth = async () => {
      try {
        // Session-only auth: if there's no sessionStorage flag, sign out any persisted session.
        let hasSessionFlag = false;
        try { hasSessionFlag = !!sessionStorage.getItem('ss_session_active'); } catch {}

        if (!hasSessionFlag) {
          // Don't await signOut — if it hangs we still want to finish init
          supabase.auth.signOut().catch(() => {});
          setUser(null);
          setLoading(false);
          return;
        }

        // Use getUser() with timeout to validate session
        const { data: { user: authUser }, error: authError } = await withTimeout(
          supabase.auth.getUser(),
          6_000,
          'getUser'
        );

        if (authError || !authUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        // Auth user exists — fetch profile (with timeout)
        const { data: profile } = await withTimeout(
          supabase.from('profiles').select('*').eq('id', authUser.id).single(),
          5_000,
          'fetchProfile'
        );

        if (profile) {
          setUser(profile as Profile);
          // Apply global accent color from profile
          if (typeof document !== 'undefined' && (profile as Profile).accent_color) {
            document.documentElement.setAttribute('data-accent', (profile as Profile).accent_color!);
          }
        } else {
          // Profile missing — create minimal one from auth data
          const meta = authUser.user_metadata || {};
          const minimalProfile: Profile = {
            id: authUser.id,
            email: authUser.email || '',
            full_name: meta.full_name || meta.name || '',
            avatar_url: meta.avatar_url || meta.picture || '',
          } as Profile;

          // Try to insert the missing profile (fire-and-forget)
          Promise.resolve(supabase.from('profiles').upsert({
            id: authUser.id,
            email: authUser.email || '',
            full_name: minimalProfile.full_name,
            avatar_url: minimalProfile.avatar_url,
          })).catch(() => {});

          setUser(minimalProfile);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setUser(null);
      } finally {
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return; // Already handled above

        if (event === 'SIGNED_OUT') {
          try { sessionStorage.removeItem('ss_session_active'); } catch {}
          setUser(null);
          setLoading(false);
          return;
        }

        if (session?.user) {
          // Mark session active (covers email verification, OAuth callbacks)
          try { sessionStorage.setItem('ss_session_active', '1'); } catch {}
          try {
            const { data: profile } = await withTimeout(
              supabase.from('profiles').select('*').eq('id', session.user.id).single(),
              5_000,
              'onAuthChange:fetchProfile'
            );
            if (profile) {
              setUser(profile as Profile);
              if (typeof document !== 'undefined' && (profile as Profile).accent_color) {
                document.documentElement.setAttribute('data-accent', (profile as Profile).accent_color!);
              }
            } else {
              // OAuth user with no profile yet — create one
              const meta = session.user.user_metadata || {};
              const newProfile: Profile = {
                id: session.user.id,
                email: session.user.email || '',
                full_name: meta.full_name || meta.name || '',
                avatar_url: meta.avatar_url || meta.picture || '',
              } as Profile;
              Promise.resolve(supabase.from('profiles').upsert({
                id: session.user.id,
                email: session.user.email || '',
                full_name: newProfile.full_name,
                avatar_url: newProfile.avatar_url,
              })).catch(() => {});
              setUser(newProfile);
            }
          } catch {
            // Keep existing user state on error
          }
          // Always ensure loading is cleared after handling auth state change
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  return { user, loading };
}
