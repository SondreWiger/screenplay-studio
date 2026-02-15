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
          const minimalProfile: Profile = {
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
            avatar_url: authUser.user_metadata?.avatar_url || '',
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
          setUser(null);
          setLoading(false);
          return;
        }

        if (session?.user) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            setUser(profile as Profile || null);
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
