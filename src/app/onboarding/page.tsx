'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/stores';
import { Button, LoadingPage, Input, toast } from '@/components/ui';
import { Icon } from '@/components/ui/icons';
import type { UsageIntent, ScriptType } from '@/lib/types';
import { SCRIPT_TYPE_OPTIONS } from '@/lib/types';

// ============================================================
// Onboarding — shown after first sign-up
// ============================================================

const USAGE_OPTIONS: { value: UsageIntent; label: string; description: string; icon: string }[] = [
  { value: 'writer', label: 'Writer', description: 'I want to write screenplays and scripts', icon: 'edit' },
  { value: 'producer', label: 'Producer / Filmmaker', description: 'I want to manage productions and collaborate', icon: 'camera' },
  { value: 'both', label: 'Writer & Producer', description: 'I write and produce — I want it all', icon: 'film' },
  { value: 'content_creator', label: 'Content Creator', description: 'YouTube, TikTok, podcasts — I make online content', icon: 'play' },
  { value: 'student', label: 'Student / Learning', description: 'I\'m learning screenwriting and filmmaking', icon: 'book' },
];

const FEATURE_TOGGLES = [
  { key: 'show_community' as const, label: 'Community Hub', description: 'Share scripts, get feedback, join challenges', icon: 'globe' },
  { key: 'show_production_tools' as const, label: 'Production Tools', description: 'Locations, shots, schedule, budget tracking', icon: 'film' },
  { key: 'show_collaboration' as const, label: 'Collaboration', description: 'Team members, real-time editing, comments', icon: 'users' },
  { key: 'show_accountability' as const, label: 'Writing Accountability', description: 'Streaks, writing buddies, groups, activity grid', icon: 'activity' },
];

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Selections
  const [usageIntent, setUsageIntent] = useState<UsageIntent>('writer');
  const [scriptType, setScriptType] = useState<ScriptType>('screenplay');
  const [showCommunity, setShowCommunity] = useState(true);
  const [showProductionTools, setShowProductionTools] = useState(true);
  const [showCollaboration, setShowCollaboration] = useState(true);
  const [showAccountability, setShowAccountability] = useState(true);
  const [displayName, setDisplayName] = useState('');

  // Optional company creation
  const [wantsCompany, setWantsCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');

  // Gamification opt-in (null = skip / decide later)
  const [gamificationChoice, setGamificationChoice] = useState<boolean | null>(null);

  // Auto-set defaults based on intent
  const applyIntentDefaults = (intent: UsageIntent) => {
    setUsageIntent(intent);
    switch (intent) {
      case 'writer':
        setShowCommunity(true);
        setShowProductionTools(false);
        setShowCollaboration(false);
        setShowAccountability(true);
        setScriptType('screenplay');
        break;
      case 'producer':
        setShowCommunity(false);
        setShowProductionTools(true);
        setShowCollaboration(true);
        setShowAccountability(false);
        break;
      case 'both':
        setShowCommunity(true);
        setShowProductionTools(true);
        setShowCollaboration(true);
        setShowAccountability(true);
        break;
      case 'content_creator':
        setShowCommunity(true);
        setShowProductionTools(true);
        setShowCollaboration(true);
        setShowAccountability(true);
        setScriptType('youtube');
        break;
      case 'student':
        setShowCommunity(true);
        setShowProductionTools(false);
        setShowCollaboration(false);
        setShowAccountability(true);
        break;
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({
      onboarding_completed: true,
      usage_intent: usageIntent,
      show_community: showCommunity,
      show_production_tools: showProductionTools,
      show_collaboration: showCollaboration,
      show_accountability: showAccountability,
      preferred_script_type: scriptType,
      display_name: displayName.trim() || user.full_name || null,
    }).eq('id', user.id);

    if (!error) {
      useAuthStore.getState().setUser({
        ...user,
        onboarding_completed: true,
        usage_intent: usageIntent,
        show_community: showCommunity,
        show_production_tools: showProductionTools,
        show_collaboration: showCollaboration,
        show_accountability: showAccountability,
        preferred_script_type: scriptType,
        display_name: displayName.trim() || user.full_name || null,
      });
    }

    // Create company if user wants one
    if (wantsCompany && companyName.trim()) {
      const slug = companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { data: co, error: companyError } = await supabase.from('companies').insert({
        name: companyName.trim(),
        slug,
        owner_id: user.id,
      }).select().single();

      if (companyError) { toast.error('Failed to create company'); setSaving(false); return; }
      if (co) {
        await supabase.from('profiles').update({ company_id: co.id }).eq('id', user.id);
        useAuthStore.getState().setUser({
          ...useAuthStore.getState().user!,
          company_id: co.id,
        });
      }
    }

    // Save gamification preference if the user made a choice
    if (gamificationChoice !== null) {
      await supabase.from('user_gamification')
        .upsert({ user_id: user.id, gamification_enabled: gamificationChoice, popup_shown: true })
        .eq('user_id', user.id);
    }

    setSaving(false);
    router.replace('/dashboard?tour=1');
  };

  if (authLoading) return <LoadingPage />;

  const steps = [
    // Step 0: Welcome + Display Name
    <div key="welcome" className="space-y-8">
      <div className="text-center">
        <div className="w-20 h-20 bg-[#E54E15] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Welcome to Screenplay Studio</h1>
        <p className="text-surface-400 max-w-md mx-auto">
          Let&apos;s set things up so the app works exactly how you need it. This takes about 30 seconds.
        </p>
      </div>

      <div className="max-w-sm mx-auto space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">What should we call you?</label>
          <Input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={user?.full_name || 'Your display name'}
          />
        </div>
      </div>
    </div>,

    // Step 1: Usage Intent
    <div key="intent" className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white mb-2">How will you use Screenplay Studio?</h2>
        <p className="text-surface-400">This helps us show you the right tools. You can always change this later.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
        {USAGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => applyIntentDefaults(opt.value)}
            className={`text-left p-5 rounded-xl border-2 transition-all ${
              usageIntent === opt.value
                ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 ring-1 ring-[#FF5F1F]/30'
                : 'border-surface-700 bg-surface-900 hover:border-surface-600 hover:bg-surface-800'
            }`}
          >
            <Icon name={opt.icon} size="lg" className={usageIntent === opt.value ? 'text-[#FF5F1F]' : 'text-surface-400'} />
            <h3 className={`mt-2 text-sm font-semibold ${usageIntent === opt.value ? 'text-[#FF5F1F]' : 'text-white'}`}>
              {opt.label}
            </h3>
            <p className="mt-1 text-xs text-surface-400">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>,

    // Step 2: Script Type
    <div key="scripttype" className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white mb-2">What do you write?</h2>
        <p className="text-surface-400">We&apos;ll set the default formatting for new projects.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl mx-auto">
        {SCRIPT_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setScriptType(opt.value)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              scriptType === opt.value
                ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 ring-1 ring-[#FF5F1F]/30'
                : 'border-surface-700 bg-surface-900 hover:border-surface-600 hover:bg-surface-800'
            }`}
          >
            <Icon name={opt.icon} size="md" className={scriptType === opt.value ? 'text-[#FF5F1F]' : 'text-surface-400'} />
            <h3 className={`mt-1.5 text-sm font-semibold ${scriptType === opt.value ? 'text-[#FF5F1F]' : 'text-white'}`}>
              {opt.label}
            </h3>
            <p className="mt-0.5 text-[11px] text-surface-400">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>,

    // Step 3: Feature Visibility
    <div key="features" className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white mb-2">Customize your workspace</h2>
        <p className="text-surface-400">Toggle features on or off. Hidden tools are always accessible under &quot;More Tools&quot;.</p>
      </div>

      <div className="max-w-md mx-auto space-y-3">
        {FEATURE_TOGGLES.map((feat) => {
          const isOn = feat.key === 'show_community' ? showCommunity
            : feat.key === 'show_production_tools' ? showProductionTools
            : feat.key === 'show_collaboration' ? showCollaboration
            : showAccountability;

          const toggle = () => {
            if (feat.key === 'show_community') setShowCommunity(!showCommunity);
            else if (feat.key === 'show_production_tools') setShowProductionTools(!showProductionTools);
            else if (feat.key === 'show_collaboration') setShowCollaboration(!showCollaboration);
            else setShowAccountability(!showAccountability);
          };

          return (
            <button
              key={feat.key}
              onClick={toggle}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                isOn
                  ? 'border-[#FF5F1F]/50 bg-[#FF5F1F]/5'
                  : 'border-surface-700 bg-surface-900 opacity-60'
              }`}
            >
              <Icon name={feat.icon} size="md" className="text-surface-300" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">{feat.label}</h3>
                <p className="text-[11px] text-surface-400">{feat.description}</p>
              </div>
              <div className={`w-11 h-6 rounded-full shrink-0 transition-colors relative ${isOn ? 'bg-[#FF5F1F]' : 'bg-surface-700'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-surface-900 shadow transition-transform ${isOn ? 'left-[22px]' : 'left-0.5'}`} />
              </div>
            </button>
          );
        })}

        <p className="text-[11px] text-surface-500 text-center pt-2">
          Everything stays accessible — hidden features appear in a &quot;More Tools&quot; menu
        </p>
      </div>
    </div>,

    // Step 4: Gamification Opt-In
    <div key="gamification" className="space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#FF5F1F]/10 border border-[#FF5F1F]/20 flex items-center justify-center mx-auto mb-5 text-3xl">
          🎮
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Want to gamify your writing?</h2>
        <p className="text-surface-400 max-w-sm mx-auto">
          Earn XP for every word, level up, collect badges, and unlock profile effects. You can change this anytime.
        </p>
      </div>

      <div className="max-w-md mx-auto space-y-3">
        {[
          { icon: '✍️', text: 'Every 10 words = 1 XP' },
          { icon: '🔥', text: 'Time multiplier: 1h = 2×, 2h = 4×, 3h = 8× XP' },
          { icon: '🏅', text: 'Badges for admins, moderators, contributors & more' },
          { icon: '✨', text: 'Level up to unlock profile glows and display options' },
        ].map(({ icon, text }) => (
          <div key={text} className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/50 border border-surface-700">
            <span className="text-xl shrink-0">{icon}</span>
            <p className="text-sm text-surface-300">{text}</p>
          </div>
        ))}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setGamificationChoice(true)}
            className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
              gamificationChoice === true
                ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 ring-1 ring-[#FF5F1F]/30'
                : 'border-surface-700 bg-surface-900 hover:border-surface-600'
            }`}
          >
            <div className="text-2xl mb-1">🚀</div>
            <h3 className={`text-sm font-bold ${gamificationChoice === true ? 'text-[#FF5F1F]' : 'text-white'}`}>
              Yes, let&apos;s go!
            </h3>
            <p className="text-[11px] text-surface-400 mt-0.5">Show XP, levels & badges</p>
          </button>
          <button
            onClick={() => setGamificationChoice(false)}
            className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
              gamificationChoice === false
                ? 'border-surface-500 bg-surface-800 ring-1 ring-surface-500/30'
                : 'border-surface-700 bg-surface-900 hover:border-surface-600'
            }`}
          >
            <div className="text-2xl mb-1">🤫</div>
            <h3 className={`text-sm font-bold ${gamificationChoice === false ? 'text-white' : 'text-surface-300'}`}>
              Not for me
            </h3>
            <p className="text-[11px] text-surface-400 mt-0.5">XP still collected silently</p>
          </button>
        </div>

        <p className="text-[11px] text-surface-500 text-center">
          You can enable or disable this anytime in Settings → Gamification
        </p>
      </div>
    </div>,

    // Step 5: Optional Company Creation
    <div key="company" className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white mb-2">Work with a team?</h2>
        <p className="text-surface-400">Create a company to collaborate, invite team members, and manage projects together. You can always do this later.</p>
      </div>

      <div className="max-w-sm mx-auto space-y-4">
        <div className="flex gap-4">
          <button
            onClick={() => setWantsCompany(false)}
            className={`flex-1 p-5 rounded-xl border-2 text-center transition-all ${
              !wantsCompany
                ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 ring-1 ring-[#FF5F1F]/30'
                : 'border-surface-700 bg-surface-900 hover:border-surface-600'
            }`}
          >
            <svg className="w-8 h-8 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <h3 className={`mt-2 text-sm font-semibold ${!wantsCompany ? 'text-[#FF5F1F]' : 'text-white'}`}>Just me</h3>
            <p className="text-[11px] text-surface-400 mt-1">Solo projects</p>
          </button>
          <button
            onClick={() => setWantsCompany(true)}
            className={`flex-1 p-5 rounded-xl border-2 text-center transition-all ${
              wantsCompany
                ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 ring-1 ring-[#FF5F1F]/30'
                : 'border-surface-700 bg-surface-900 hover:border-surface-600'
            }`}
          >
            <svg className="w-8 h-8 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            <h3 className={`mt-2 text-sm font-semibold ${wantsCompany ? 'text-[#FF5F1F]' : 'text-white'}`}>Team / Company</h3>
            <p className="text-[11px] text-surface-400 mt-1">Collaborate together</p>
          </button>
        </div>

        {wantsCompany && (
          <div className="animate-slide-up">
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Company Name</label>
            <Input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Pictures"
              autoFocus
            />
            <p className="text-[11px] text-surface-500 mt-1.5">You can invite team members after setup.</p>
          </div>
        )}
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Progress bar */}
      <div className="w-full h-1 bg-surface-900">
        <div
          className="h-full bg-[#FF5F1F] transition-all duration-500"
          style={{ width: `${((step + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {steps[step]}
        </div>
      </div>

      {/* Footer nav */}
      <div className="border-t border-surface-800 bg-surface-950/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? 'bg-[#FF5F1F]' : i < step ? 'bg-[#FF5F1F]/40' : 'bg-surface-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}

            {step === 0 && (
              <button
                onClick={() => {
                  // Skip onboarding entirely
                  handleComplete();
                }}
                className="text-xs text-surface-500 hover:text-surface-300 transition-colors mr-2"
              >
                Skip setup
              </button>
            )}

            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>
                Continue
              </Button>
            ) : (
              <Button onClick={handleComplete} loading={saving}>
                Get Started
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
