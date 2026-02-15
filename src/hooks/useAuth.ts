'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import type { Profile } from '@/lib/types';

export function useAuth() {
  const { user, loading, setUser, setLoading } = useAuthStore();
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent double-initialization in React StrictMode
    if (initialized.current) return;
    initialized.current = true;

    const supabase = createClient();

    const initAuth = async () => {
      try {
        // Session-only auth: if there's no sessionStorage flag, sign out any persisted session.
        // This ensures users must log in fresh each browser session.
        const hasSessionFlag = sessionStorage.getItem('ss_session_active');
        if (!hasSessionFlag) {
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }

        // Use getUser() to validate session server-side and refresh token if needed
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        // Auth user exists — fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (profile) {
          setUser(profile as Profile);
        } else {
          // Profile missing — create minimal one from auth data
          const meta = authUser.user_metadata || {};
          const minimalProfile: Profile = {
            id: authUser.id,
            email: authUser.email || '',
            full_name: meta.full_name || meta.name || '',
            avatar_url: meta.avatar_url || meta.picture || '',
          } as Profile;

          // Try to insert the missing profile
          await supabase.from('profiles').upsert({
            id: authUser.id,
            email: authUser.email || '',
            full_name: minimalProfile.full_name,
            avatar_url: minimalProfile.avatar_url,
          });

          setUser(minimalProfile);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setUser(null);
      } finally {
        setLoading(false);
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
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            if (profile) {
              setUser(profile as Profile);
            } else {
              // OAuth user with no profile yet — create one
              const meta = session.user.user_metadata || {};
              const newProfile: Profile = {
                id: session.user.id,
                email: session.user.email || '',
                full_name: meta.full_name || meta.name || '',
                avatar_url: meta.avatar_url || meta.picture || '',
              } as Profile;
              await supabase.from('profiles').upsert({
                id: session.user.id,
                email: session.user.email || '',
                full_name: newProfile.full_name,
                avatar_url: newProfile.avatar_url,
              });
              setUser(newProfile);
            }
          } catch {
            // Keep existing user state on error
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
