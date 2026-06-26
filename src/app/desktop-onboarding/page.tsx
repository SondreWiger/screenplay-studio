'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Icon } from '@/components/ui/icons';
import { isElectronMode } from '@/lib/supabase/electron-client';

export default function DesktopOnboarding() {
  const router = useRouter();
  const [selectedChoice, setSelectedChoice] = useState<'login' | 'local' | null>(null);

  useEffect(() => {
    if (!isElectronMode()) {
      router.replace('/dashboard');
      return;
    }

    // Check if onboarding already completed
    const checkOnboardingStatus = async () => {
      if (window.electron?.getPreferenceSync) {
        const completed = window.electron.getPreferenceSync('ss-onboarding-completed');
        const choice = window.electron.getPreferenceSync('ss-auth-choice');
        
        if (completed === '1' && choice) {
          // Onboarding already done - redirect based on choice
          if (choice === 'local') {
            // Set local mode and go to welcome
            if (window.electron.setPreference) {
              window.electron.setPreference('ss-local-mode', '1');
            }
            localStorage.setItem('ss-local-mode', '1');
            document.cookie = 'ss-local-mode=1; path=/; max-age=31536000; SameSite=Lax';
            router.replace('/desktop-welcome');
          } else {
            router.replace('/auth/login');
          }
        }
      }
    };

    checkOnboardingStatus();
  }, [router]);

   const handleChoice = async (choice: 'login' | 'local') => {
     setSelectedChoice(choice);

     console.log('[DesktopOnboarding] Saving choice:', choice);

     // Save to localStorage (simple and reliable)
     localStorage.setItem('ss-onboarding-completed', '1');
     localStorage.setItem('ss-auth-choice', choice);
     console.log('[DesktopOnboarding] Saved to localStorage');

     // Save to Electron preferences
     if (window.electron?.setPreference) {
       window.electron.setPreference('ss-onboarding-completed', '1');
       window.electron.setPreference('ss-auth-choice', choice);
     }

     if (choice === 'local') {
       // Enable local mode
       localStorage.setItem('ss-local-mode', '1');
       // Set cookie for server-side detection
       document.cookie = 'ss-onboarding-completed=1; path=/; max-age=31536000; SameSite=Lax';
       document.cookie = 'ss-auth-choice=local; path=/; max-age=31536000; SameSite=Lax';
       document.cookie = 'ss-local-mode=1; path=/; max-age=31536000; SameSite=Lax';
       console.log('[DesktopOnboarding] Set local mode cookies');
       
       // Create local user
       const { createLocalUser } = await import('@/lib/supabase/electron-client');
       createLocalUser('Local Writer');
       console.log('[DesktopOnboarding] Created local user');
       
       router.replace('/desktop-welcome');
     } else {
       // Set cookies for cloud mode
       document.cookie = 'ss-onboarding-completed=1; path=/; max-age=31536000; SameSite=Lax';
       document.cookie = 'ss-auth-choice=cloud; path=/; max-age=31536000; SameSite=Lax';
       router.replace('/auth/login');
     }
   };


  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent">
      <div className="max-w-2xl w-full p-8 flex flex-col items-center">
        {/* App Icon */}
        <div className="w-24 h-24 bg-brand-500 rounded-3xl shadow-2xl flex items-center justify-center mb-8">
          <Icon name="feather" size="xl" className="text-white" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome to Screenplay Studio</h1>
        <p className="text-surface-400 mb-12 text-center max-w-md">
          How would you like to use the app?
        </p>

        <div className="w-full space-y-4">
          {/* Login Option */}
          <button
            onClick={() => handleChoice('login')}
            className={`w-full p-6 rounded-2xl border-2 transition-all duration-200 text-left group ${
              selectedChoice === 'login'
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-surface-800 bg-surface-900/50 hover:border-surface-700'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                selectedChoice === 'login' ? 'bg-brand-500' : 'bg-surface-800 group-hover:bg-surface-700'
              }`}>
                <Icon name="cloud" className={selectedChoice === 'login' ? 'text-white' : 'text-surface-400'} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">Sign In to Cloud</h3>
                <p className="text-sm text-surface-400">
                  Sync your projects across devices, collaborate with your team, and access cloud features.
                </p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                selectedChoice === 'login' ? 'border-brand-500 bg-brand-500' : 'border-surface-700'
              }`}>
                {selectedChoice === 'login' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                )}
              </div>
            </div>
          </button>

          {/* Local Option */}
          <button
            onClick={() => handleChoice('local')}
            className={`w-full p-6 rounded-2xl border-2 transition-all duration-200 text-left group ${
              selectedChoice === 'local'
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-surface-800 bg-surface-900/50 hover:border-surface-700'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                selectedChoice === 'local' ? 'bg-brand-500' : 'bg-surface-800 group-hover:bg-surface-700'
              }`}>
                <Icon name="hard-drive" className={selectedChoice === 'local' ? 'text-white' : 'text-surface-400'} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">Use Offline Only</h3>
                <p className="text-sm text-surface-400">
                  Keep everything on your computer. No account needed, no cloud sync, complete privacy.
                </p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                selectedChoice === 'local' ? 'border-brand-500 bg-brand-500' : 'border-surface-700'
              }`}>
                {selectedChoice === 'local' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                )}
              </div>
            </div>
          </button>
        </div>

        <p className="text-xs text-surface-500 mt-8 text-center">
          You can change this preference later in Settings
        </p>
      </div>
    </div>
  );
}
