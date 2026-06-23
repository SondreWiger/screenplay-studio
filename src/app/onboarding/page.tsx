'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/stores';
import { Button, LoadingPage, Input, toast } from '@/components/ui';
import { Icon } from '@/components/ui/icons';
import { ThemePreview } from '@/components/ThemePreview';
import type { UsageIntent, ScriptType } from '@/lib/types';
import { SCRIPT_TYPE_OPTIONS } from '@/lib/types';

const TOTAL_STEPS = 7;

const STEP_LABELS = [
  'Welcome',
  'Your Role',
  'Format',
  'Style',
  'Workspace',
  'Rewards',
  'Team',
];

const STEP_ICONS = [
  '👋',
  '🎯',
  '📝',
  '🎨',
  '⚙️',
  '🏆',
  '🤝',
];

const USAGE_OPTIONS: { value: UsageIntent; label: string; description: string; icon: string; color: string; emoji: string }[] = [
  { value: 'writer', label: 'Writer', description: 'I want to write screenplays and scripts', icon: 'edit', color: '#FF5F1F', emoji: '✍️' },
  { value: 'producer', label: 'Producer / Filmmaker', description: 'I want to manage productions and collaborate', icon: 'camera', color: '#3B82F6', emoji: '🎬' },
  { value: 'both', label: 'Writer & Producer', description: 'I write and produce — I want it all', icon: 'film', color: '#8B5CF6', emoji: '🎭' },
  { value: 'content_creator', label: 'Content Creator', description: 'YouTube, TikTok, podcasts — I make online content', icon: 'play', color: '#10B981', emoji: '📱' },
  { value: 'student', label: 'Student / Learning', description: 'I\'m learning screenwriting and filmmaking', icon: 'book', color: '#F59E0B', emoji: '📚' },
];

const FEATURE_TOGGLES = [
  { key: 'show_community' as const, label: 'Community Hub', description: 'Share scripts, get feedback, join challenges', emoji: '🌐' },
  { key: 'show_production_tools' as const, label: 'Production Tools', description: 'Locations, shots, schedule, budget tracking', emoji: '🎥' },
  { key: 'show_collaboration' as const, label: 'Collaboration', description: 'Team members, real-time editing, comments', emoji: '👥' },
  { key: 'show_accountability' as const, label: 'Writing Accountability', description: 'Streaks, writing buddies, groups, activity grid', emoji: '🔥' },
];

const LEVEL_PREVIEW = [
  { level: 1, title: 'Aspiring Writer', icon: '🌱' },
  { level: 2, title: 'Scribbler', icon: '✏️', unlock: 'Bronze username glow' },
  { level: 5, title: 'Scene Builder', icon: '📋', unlock: 'XP bar on profile' },
  { level: 10, title: 'Plot Weaver', icon: '🕸️', unlock: 'Silver glow, Level badge' },
  { level: 20, title: 'Screenplay Veteran', icon: '🎖️', unlock: 'Gold glow, Animated XP' },
  { level: 50, title: 'Legend of the Page', icon: '👑', unlock: 'Platinum glow, Custom accent' },
];

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-[width] duration-500 ${
            i === current
              ? 'w-8 h-2 bg-brand-500'
              : i < current
              ? 'w-2 h-2 bg-brand-500/40'
              : 'w-2 h-2 bg-surface-700'
          }`}
        />
      ))}
    </div>
  );
}

function AnimatedCheckmark() {
  return (
    <svg className="w-6 h-6 text-green-400 animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [usageIntent, setUsageIntent] = useState<UsageIntent>('writer');
  const [scriptType, setScriptType] = useState<ScriptType>('screenplay');
  const [showCommunity, setShowCommunity] = useState(true);
  const [showProductionTools, setShowProductionTools] = useState(true);
  const [showCollaboration, setShowCollaboration] = useState(true);
  const [showAccountability, setShowAccountability] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [country, _setCountry] = useState('');
  const [_direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [wantsCompany, setWantsCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [gamificationChoice, setGamificationChoice] = useState<boolean | null>(null);
  const [uiTheme, setUiTheme] = useState<'default' | 'soft'>('default');

  const applyIntentDefaults = (intent: UsageIntent) => {
    setUsageIntent(intent);
    switch (intent) {
      case 'writer':
        setShowCommunity(true); setShowProductionTools(false); setShowCollaboration(false); setShowAccountability(true);
        setScriptType('screenplay');
        break;
      case 'producer':
        setShowCommunity(false); setShowProductionTools(true); setShowCollaboration(true); setShowAccountability(false);
        break;
      case 'both':
        setShowCommunity(true); setShowProductionTools(true); setShowCollaboration(true); setShowAccountability(true);
        break;
      case 'content_creator':
        setShowCommunity(true); setShowProductionTools(true); setShowCollaboration(true); setShowAccountability(true);
        setScriptType('youtube');
        break;
      case 'student':
        setShowCommunity(true); setShowProductionTools(false); setShowCollaboration(false); setShowAccountability(true);
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
      country: country.trim() || null,
      ui_theme: uiTheme,
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
        ui_theme: uiTheme,
      });
    }

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

    if (gamificationChoice !== null) {
      await supabase.from('user_gamification')
        .upsert({ user_id: user.id, gamification_enabled: gamificationChoice, popup_shown: true })
        .eq('user_id', user.id);
    }

    setSaving(false);
    router.replace('/dashboard?tour=1');
  };

  const goNext = () => {
    if (step === 1 && !usageIntent) return;
    if (step < TOTAL_STEPS - 1) {
      setDirection('forward');
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection('backward');
      setStep(step - 1);
    }
  };

  if (authLoading) return <LoadingPage />;

  const intentMeta = USAGE_OPTIONS.find(o => o.value === usageIntent);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#070710' }}>
      {/* Top bar with progress */}
      <div className="sticky top-0 z-50" style={{ background: 'rgba(7,7,16,0.92)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 flex items-center justify-center shrink-0" style={{ background: '#FF5F1F' }}>
                <span className="font-black text-white text-[10px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
              </div>
              <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
                Step {step + 1} of {TOTAL_STEPS}
              </span>
            </div>
            <button
              onClick={handleComplete}
              className="text-[11px] text-surface-500 hover:text-surface-300 transition-colors font-medium"
            >
              Skip to dashboard
            </button>
          </div>
          <ProgressDots current={step} total={TOTAL_STEPS} />
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm">{STEP_ICONS[step]}</span>
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">{STEP_LABELS[step]}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-16">
        <div className="w-full max-w-2xl animate-fade-in">
          {step === 0 && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="relative inline-block mb-6">
                  <div className="w-24 h-24 rounded-xl flex items-center justify-center mx-auto relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #FF5F1F, #E54E15)' }}>
                    <div className="absolute inset-0 opacity-20" style={{
                      background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 70%)'
                    }} />
                    <svg className="w-12 h-12 text-white relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-green-500/20 border-2 border-surface-950 flex items-center justify-center animate-float">
                    <span className="text-sm">✨</span>
                  </div>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black text-white mb-3 tracking-tight">
                  Your story starts<br /> <span style={{ color: '#FF5F1F' }}>here</span>
                </h1>
                <p className="text-surface-400 max-w-md mx-auto text-sm leading-relaxed">
                  Screenplay Studio is your all-in-one space to write, plan, and produce
                  screenplays. Let&apos;s set things up in about 30 seconds.
                </p>
              </div>

              <div className="max-w-sm mx-auto space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                    What should we call you?
                  </label>
                  <Input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={user?.full_name || 'Your display name'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  {[
                    { id: 'writer', label: '✍️ Writer' },
                    { id: 'producer', label: '🎬 Producer' },
                    { id: 'both', label: '🎭 Both' },
                    { id: 'student', label: '📚 Student' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => { applyIntentDefaults(id as UsageIntent); goNext(); }}
                      className="p-3 rounded-xl border border-surface-700 bg-surface-900/50 hover:border-brand-500/40 hover:bg-brand-500/5 transition-colors text-center"
                    >
                      <span className="text-sm font-medium text-white">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">🎯</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">How will you use the platform?</h2>
                <p className="text-surface-400 text-sm">We&apos;ll tailor the sidebar and tools to match your workflow.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
                {USAGE_OPTIONS.map((opt) => {
                  const selected = usageIntent === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => applyIntentDefaults(opt.value)}
                      className={`group relative text-left p-5 rounded-xl border-2 transition-colors duration-200 ${
                        selected
                          ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/5'
                          : 'border-surface-700 bg-surface-900/50 hover:border-surface-600 hover:bg-surface-800/50 hover:shadow-md'
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-3 right-3">
                          <AnimatedCheckmark />
                        </div>
                      )}
                      <div className={`text-2xl mb-2 transition-transform duration-200 ${selected ? 'scale-110' : ''}`}>
                        {opt.emoji}
                      </div>
                      <h3 className={`text-sm font-bold ${selected ? 'text-brand-500' : 'text-white group-hover:text-white'}`}>
                        {opt.label}
                      </h3>
                      <p className="mt-1 text-xs text-surface-500 leading-relaxed">{opt.description}</p>
                      {selected && (
                        <div className="mt-3 pt-3 border-t border-brand-500/10">
                          <div className="flex flex-wrap gap-2">
                            {showCommunity && <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-800 text-surface-400">🌐 Community</span>}
                            {showProductionTools && <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-800 text-surface-400">🎥 Production</span>}
                            {showCollaboration && <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-800 text-surface-400">👥 Collab</span>}
                            {showAccountability && <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-800 text-surface-400">🔥 Streaks</span>}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">📝</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">What format do you write in?</h2>
                <p className="text-surface-400 text-sm">We&apos;ll set the default formatting for new projects.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl mx-auto">
                {SCRIPT_TYPE_OPTIONS.map((opt) => {
                  const selected = scriptType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setScriptType(opt.value)}
                      className={`relative text-left p-4 rounded-xl border-2 transition-colors duration-200 ${
                        selected
                          ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/5'
                          : 'border-surface-700 bg-surface-900/50 hover:border-surface-600 hover:bg-surface-800/50'
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2">
                          <AnimatedCheckmark />
                        </div>
                      )}
                      <Icon name={opt.icon} size="md" className={selected ? 'text-brand-500' : 'text-surface-400'} />
                      <h3 className={`mt-1.5 text-sm font-bold ${selected ? 'text-brand-500' : 'text-white'}`}>
                        {opt.label}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-surface-500">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">✨</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">Pick your style</h2>
                <p className="text-surface-400 text-sm max-w-md mx-auto">
                  Choose how the editor looks. You can change this later in settings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                <button
                  onClick={() => setUiTheme('default')}
                  className={`text-left rounded-xl transition-all duration-200 ${
                    uiTheme === 'default'
                      ? 'ring-2 ring-[var(--brand-500)] shadow-lg shadow-[var(--brand-500)]/10'
                      : 'ring-1 ring-surface-700 hover:ring-surface-500'
                  }`}
                >
                  <ThemePreview theme="default" accentColor="brand" />
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Default</h3>
                      <p className="text-[11px] text-surface-500">Bold, vibrant colours</p>
                    </div>
                    {uiTheme === 'default' && (
                      <div className="w-5 h-5 rounded-full bg-[var(--brand-500)] flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setUiTheme('soft')}
                  className={`text-left rounded-xl transition-all duration-200 ${
                    uiTheme === 'soft'
                      ? 'ring-2 ring-[var(--brand-500)] shadow-lg shadow-[var(--brand-500)]/10'
                      : 'ring-1 ring-surface-700 hover:ring-surface-500'
                  }`}
                >
                  <ThemePreview theme="soft" accentColor="brand" />
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Soft Pastels</h3>
                      <p className="text-[11px] text-surface-500">Muted, easy on the eyes</p>
                    </div>
                    {uiTheme === 'soft' && (
                      <div className="w-5 h-5 rounded-full bg-[var(--brand-500)] flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">🎨</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">Customize your workspace</h2>
                <p className="text-surface-400 text-sm">Toggle features on or off. Hidden items are always one click away under &quot;More Tools&quot;.</p>
              </div>

              <div className="max-w-md mx-auto space-y-2">
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
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-colors duration-200 ${
                        isOn
                          ? 'border-brand-500/40 bg-brand-500/5'
                          : 'border-surface-700/50 bg-surface-900/30 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <span className="text-xl">{feat.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white">{feat.label}</h3>
                        <p className="text-[11px] text-surface-500">{feat.description}</p>
                      </div>
                      <div className={`w-11 h-6 rounded-full shrink-0 transition-colors duration-300 relative ${
                        isOn ? 'bg-brand-500 shadow-sm shadow-brand-500/30' : 'bg-surface-700'
                      }`}>
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                          isOn ? 'left-[22px]' : 'left-0.5'
                        }`} />
                      </div>
                    </button>
                  );
                })}

                <p className="text-[11px] text-surface-600 text-center pt-2">
                  Everything stays accessible — hidden features appear in a &quot;More Tools&quot; menu
                </p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">🏆</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">Turn writing into a game</h2>
                <p className="text-surface-400 text-sm max-w-sm mx-auto">
                  Earn XP for every word, build streaks, level up, and unlock profile rewards.
                </p>
              </div>

              {/* Level Preview Roadmap */}
              <div className="max-w-lg mx-auto">
                <div className="relative pl-8 space-y-0">
                  {LEVEL_PREVIEW.map((lvl, i) => (
                    <div key={lvl.level} className="relative pb-4 last:pb-0">
                      {/* Timeline line */}
                      {i < LEVEL_PREVIEW.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gradient-to-b from-brand-500/30 to-transparent" />
                      )}
                      {/* Timeline dot */}
                      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-surface-800 border-2 border-brand-500/30 flex items-center justify-center">
                        <span className="text-[10px]">{lvl.icon}</span>
                      </div>
                      <div className="bg-surface-900/50 rounded-xl border border-surface-800/50 p-3 hover:border-surface-700/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-mono text-brand-500 font-bold">LVL {lvl.level}</span>
                            <h4 className="text-sm font-semibold text-white">{lvl.title}</h4>
                          </div>
                          {lvl.unlock && (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-brand-500/10 text-brand-500 font-medium whitespace-nowrap">
                              Unlocks: {lvl.unlock}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gamification choice */}
              <div className="max-w-md mx-auto pt-2">
                <div className="flex gap-3">
                  <button
                    onClick={() => setGamificationChoice(true)}
                    className={`flex-1 p-4 rounded-xl border-2 text-center transition-colors duration-200 ${
                      gamificationChoice === true
                        ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/5'
                        : 'border-surface-700 bg-surface-900/50 hover:border-surface-600'
                    }`}
                  >
                    <div className="text-2xl mb-1">🚀</div>
                    <h3 className={`text-sm font-bold ${gamificationChoice === true ? 'text-brand-500' : 'text-white'}`}>
                      Yes, let&apos;s go!
                    </h3>
                    <p className="text-[10px] text-surface-500 mt-0.5">Earn XP, badges & profile effects</p>
                  </button>
                  <button
                    onClick={() => setGamificationChoice(false)}
                    className={`flex-1 p-4 rounded-xl border-2 text-center transition-colors duration-200 ${
                      gamificationChoice === false
                        ? 'border-surface-500 bg-surface-800/50'
                        : 'border-surface-700 bg-surface-900/50 hover:border-surface-600'
                    }`}
                  >
                    <div className="text-2xl mb-1">🤫</div>
                    <h3 className={`text-sm font-bold ${gamificationChoice === false ? 'text-white' : 'text-surface-300'}`}>
                      Not for me
                    </h3>
                    <p className="text-[10px] text-surface-500 mt-0.5">XP still collected silently</p>
                  </button>
                </div>
                <p className="text-[10px] text-surface-600 text-center mt-3">
                  Change this anytime in Settings → Gamification
                </p>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-3">🤝</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">Working with a team?</h2>
                <p className="text-surface-400 text-sm max-w-sm mx-auto">
                  Create a company to collaborate, share projects, and manage roles together.
                </p>
              </div>

              <div className="max-w-sm mx-auto space-y-4">
                <div className="flex gap-4">
                  <button
                    onClick={() => setWantsCompany(false)}
                    className={`flex-1 p-5 rounded-xl border-2 text-center transition-colors duration-200 ${
                      !wantsCompany
                        ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/5'
                        : 'border-surface-700 bg-surface-900/50 hover:border-surface-600'
                    }`}
                  >
                    <div className="text-3xl mb-2">🙋</div>
                    <h3 className={`text-sm font-bold ${!wantsCompany ? 'text-brand-500' : 'text-white'}`}>Just me</h3>
                    <p className="text-[11px] text-surface-500 mt-1">Solo projects, full control</p>
                  </button>
                  <button
                    onClick={() => setWantsCompany(true)}
                    className={`flex-1 p-5 rounded-xl border-2 text-center transition-colors duration-200 ${
                      wantsCompany
                        ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/5'
                        : 'border-surface-700 bg-surface-900/50 hover:border-surface-600'
                    }`}
                  >
                    <div className="text-3xl mb-2">🏢</div>
                    <h3 className={`text-sm font-bold ${wantsCompany ? 'text-brand-500' : 'text-white'}`}>Team / Company</h3>
                    <p className="text-[11px] text-surface-500 mt-1">Collaborate together</p>
                  </button>
                </div>

                {wantsCompany && (
                  <div className="animate-slide-up space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Company Name</label>
                      <Input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Pictures"
                        autoFocus
                      />
                    </div>
                    <p className="text-[11px] text-surface-600">You&apos;ll be able to invite team members after setup.</p>
                  </div>
                )}

                {(showAccountability || showCommunity) && (
                  <div className="rounded-xl bg-gradient-to-r from-brand-500/5 to-transparent border border-brand-500/10 p-4">
                    <p className="text-xs text-surface-400 leading-relaxed">
                      💡 <span className="text-white/80 font-medium">Pro tip:</span> With collaboration enabled, you and your team can
                      edit scripts in real-time, leave comments, and track changes together.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="max-w-sm mx-auto pt-2">
              <div className="rounded-xl border border-surface-700/50 bg-surface-900/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-800/50">
                  <h3 className="text-xs font-semibold text-white/80">Your Setup Summary</h3>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    { label: 'Name', value: displayName || user?.full_name || '—' },
                    { label: 'Role', value: intentMeta?.emoji + ' ' + intentMeta?.label },
                    { label: 'Format', value: SCRIPT_TYPE_OPTIONS.find(o => o.value === scriptType)?.label },
                    { label: 'Features', value: [showCommunity && 'Community', showProductionTools && 'Production', showCollaboration && 'Collab', showAccountability && 'Streaks'].filter(Boolean).join(', ') },
                    { label: 'Rewards', value: gamificationChoice === true ? '✅ Enabled' : gamificationChoice === false ? '❌ Disabled' : '⏸️ Decide later' },
                    { label: 'Team', value: wantsCompany && companyName ? companyName : 'Solo' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[11px] text-surface-500">{label}</span>
                      <span className="text-[11px] text-white/70 font-medium truncate ml-2 max-w-[180px]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="border-t border-surface-800/80 sticky bottom-0" style={{ background: 'rgba(7,7,16,0.92)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <div>
            {step > 0 && (
              <Button variant="ghost" onClick={goBack}>
                ← Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step < TOTAL_STEPS - 1 ? (
              <Button onClick={goNext}>
                Continue →
              </Button>
            ) : (
              <Button onClick={handleComplete} loading={saving} className="min-w-[160px]">
                🚀 Start Creating
              </Button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
