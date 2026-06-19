'use client';

import { useState } from 'react';
import { Button, Input, Textarea, toast } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface Props {
  userId: string;
  onComplete: (companyId: string) => void;
  onCancel: () => void;
}

type OrgSize = 'solo' | 'small' | 'medium' | 'large' | 'enterprise';
type OrgStyle = 'studio' | 'agency' | 'school' | 'indie' | 'corporate';

interface OnboardingData {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  size: OrgSize | null;
  style: OrgStyle | null;
  brandColor: string;
  features: string[];
}

const STEPS = ['basics', 'size', 'style', 'features', 'review'] as const;
type Step = typeof STEPS[number];

const SIZE_OPTIONS: { value: OrgSize; label: string; desc: string; icon: string; range: string }[] = [
  { value: 'solo', label: 'Solo Creator', desc: 'Just you, building your vision', icon: '🎬', range: '1 person' },
  { value: 'small', label: 'Small Team', desc: 'A tight-knit creative crew', icon: '🎭', range: '2–5 people' },
  { value: 'medium', label: 'Growing Studio', desc: 'Multiple departments & projects', icon: '🏢', range: '6–25 people' },
  { value: 'large', label: 'Production House', desc: 'Full-scale production operation', icon: '🎥', range: '26–100 people' },
  { value: 'enterprise', label: 'Enterprise', desc: 'Large organization with complex needs', icon: '🌐', range: '100+ people' },
];

const STYLE_OPTIONS: { value: OrgStyle; label: string; desc: string; icon: string }[] = [
  { value: 'studio', label: 'Production Studio', desc: 'Film, TV, or content production', icon: '🎬' },
  { value: 'agency', label: 'Creative Agency', desc: 'Client-based creative work', icon: '✨' },
  { value: 'school', label: 'Film School / Education', desc: 'Teaching and learning screenwriting', icon: '🎓' },
  { value: 'indie', label: 'Indie Collective', desc: 'Independent filmmakers collaborating', icon: '🎭' },
  { value: 'corporate', label: 'Corporate / Brand', desc: 'In-house content & storytelling team', icon: '💼' },
];

const FEATURE_OPTIONS: { key: string; label: string; desc: string; icon: string; recommended?: OrgStyle[] }[] = [
  { key: 'pipeline', label: 'Project Pipeline', desc: 'Kanban-style project tracking with stages', icon: '📊', recommended: ['studio', 'agency', 'corporate'] },
  { key: 'channels', label: 'Team Channels', desc: 'Real-time messaging for your team', icon: '💬', recommended: ['studio', 'agency', 'school', 'indie'] },
  { key: 'assignments', label: 'Script Assignments', desc: 'Assign scripts for review and feedback', icon: '📝', recommended: ['studio', 'school', 'agency'] },
  { key: 'calendar', label: 'Production Calendar', desc: 'Schedule events, deadlines, and milestones', icon: '📅', recommended: ['studio', 'agency', 'corporate'] },
  { key: 'resources', label: 'Resource Library', desc: 'Shared files, templates, and references', icon: '📁', recommended: ['studio', 'school', 'agency'] },
  { key: 'pitches', label: 'Pitch Board', desc: 'Submit and vote on story ideas', icon: '💡', recommended: ['studio', 'indie', 'agency'] },
  { key: 'announcements', label: 'Announcements', desc: 'Company-wide news and updates', icon: '📢', recommended: ['studio', 'corporate', 'school'] },
  { key: 'education', label: 'Classes & Courses', desc: 'Create classes, assignments, and peer reviews', icon: '🎓', recommended: ['school'] },
];

const BRAND_PRESETS = [
  '#FF5F1F', '#E54E15', '#3B82F6', '#8B5CF6', '#EC4899',
  '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#6366F1',
];

export function OrgOnboarding({ userId, onComplete, onCancel }: Props) {
  const [step, setStep] = useState<Step>('basics');
  const [creating, setCreating] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    name: '',
    slug: '',
    tagline: '',
    description: '',
    size: null,
    style: null,
    brandColor: '#FF5F1F',
    features: ['pipeline', 'channels'],
  });

  const supabase = createClient();
  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const canProceed = () => {
    switch (step) {
      case 'basics': return data.name.trim().length >= 2 && data.slug.trim().length >= 2;
      case 'size': return data.size !== null;
      case 'style': return data.style !== null;
      case 'features': return data.features.length > 0;
      case 'review': return true;
    }
  };

  const nextStep = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };

  const prevStep = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };

  const toggleFeature = (key: string) => {
    setData(prev => ({
      ...prev,
      features: prev.features.includes(key)
        ? prev.features.filter(f => f !== key)
        : [...prev.features, key],
    }));
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);

    try {
      // Create the company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: data.name.trim(),
          slug: data.slug.trim(),
          tagline: data.tagline.trim() || null,
          description: data.description.trim() || null,
          brand_color: data.brandColor,
          owner_id: userId,
          plan: 'free',
        })
        .select('id')
        .single();

      if (companyError || !company) {
        toast.error(companyError?.message || 'Failed to create organization');
        setCreating(false);
        return;
      }

      // Add creator as owner member
      await supabase.from('company_members').upsert({
        company_id: company.id,
        user_id: userId,
        role: 'owner',
      }, { onConflict: 'company_id,user_id' });

      // Update profile
      await supabase.from('profiles').update({ company_id: company.id }).eq('id', userId);

      // Log activity
      await supabase.from('company_activity_log').insert({
        company_id: company.id,
        user_id: userId,
        action: 'created_company',
        entity_type: 'company',
        metadata: {
          name: data.name,
          size: data.size,
          style: data.style,
          features: data.features,
        },
      });

      toast.success('Organization created!');
      onComplete(company.id);
    } catch {
      toast.error('Something went wrong');
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface-950/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <button onClick={onCancel} className="text-sm text-surface-500 hover:text-surface-300 transition-colors">
              Cancel
            </button>
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors duration-300',
                    i <= stepIndex ? 'bg-[#FF5F1F] scale-100' : 'bg-surface-700 scale-75'
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-surface-500 tabular-nums">{stepIndex + 1}/{STEPS.length}</span>
          </div>
          <div className="h-0.5 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#E54E15] to-[#FF5F1F] transition-[width] duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-surface-900/80 backdrop-blur-sm rounded-xl border border-surface-800 overflow-hidden">
          {/* ─── BASICS ─── */}
          {step === 'basics' && (
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#E54E15] to-[#FF5F1F] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-white mb-1">Set up your organization</h2>
                <p className="text-surface-400 text-sm">Give your creative workspace a name and identity.</p>
              </div>

              <div className="space-y-5 max-w-md mx-auto">
                <Input
                  label="Organization Name"
                  value={data.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setData(prev => ({
                      ...prev,
                      name,
                      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                    }));
                  }}
                  placeholder="Acme Pictures"
                />
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">URL Slug</label>
                  <div className="flex">
                    <span className="px-3 py-2.5 rounded-l-lg border border-r-0 border-surface-700 bg-surface-800 text-xs text-surface-500 flex items-center">/org/</span>
                    <input
                      type="text"
                      value={data.slug}
                      onChange={(e) => setData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      className="flex-1 rounded-r-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white placeholder:text-surface-600 outline-none focus:border-[#FF5F1F] transition-colors"
                      placeholder="acme-pictures"
                    />
                  </div>
                </div>
                <Input
                  label="Tagline (optional)"
                  value={data.tagline}
                  onChange={(e) => setData(prev => ({ ...prev, tagline: e.target.value }))}
                  placeholder="Stories that move the world"
                />
                <Textarea
                  label="Description (optional)"
                  value={data.description}
                  onChange={(e) => setData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What does your organization do?"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* ─── SIZE ─── */}
          {step === 'size' && (
            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-white mb-1">How big is your team?</h2>
                <p className="text-surface-400 text-sm">This helps us tailor the experience for you.</p>
              </div>

              <div className="space-y-3 max-w-md mx-auto">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setData(prev => ({ ...prev, size: opt.value }))}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-xl border transition-colors duration-200 text-left group',
                      data.size === opt.value
                        ? 'border-[#FF5F1F] bg-[#FF5F1F]/5 ring-1 ring-[#FF5F1F]/20'
                        : 'border-surface-800 hover:border-surface-700 hover:bg-surface-800/50'
                    )}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{opt.label}</p>
                      <p className="text-xs text-surface-400">{opt.desc}</p>
                    </div>
                    <span className="text-xs text-surface-500 shrink-0">{opt.range}</span>
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                      data.size === opt.value
                        ? 'border-[#FF5F1F] bg-[#FF5F1F]'
                        : 'border-surface-600'
                    )}>
                      {data.size === opt.value && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── STYLE ─── */}
          {step === 'style' && (
            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-white mb-1">What kind of organization?</h2>
                <p className="text-surface-400 text-sm">We'll customize recommendations based on your type.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 max-w-md mx-auto mb-8">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setData(prev => ({ ...prev, style: opt.value }))}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-xl border transition-colors duration-200 text-left',
                      data.style === opt.value
                        ? 'border-[#FF5F1F] bg-[#FF5F1F]/5 ring-1 ring-[#FF5F1F]/20'
                        : 'border-surface-800 hover:border-surface-700 hover:bg-surface-800/50'
                    )}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{opt.label}</p>
                      <p className="text-xs text-surface-400">{opt.desc}</p>
                    </div>
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                      data.style === opt.value
                        ? 'border-[#FF5F1F] bg-[#FF5F1F]'
                        : 'border-surface-600'
                    )}>
                      {data.style === opt.value && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Brand Color */}
              <div className="max-w-md mx-auto">
                <label className="block text-sm font-medium text-surface-300 mb-3">Brand Color</label>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {BRAND_PRESETS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setData(prev => ({ ...prev, brandColor: color }))}
                        className={cn(
                          'w-8 h-8 rounded-lg transition-colors',
                          data.brandColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900 scale-110' : ''
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={data.brandColor}
                    onChange={(e) => setData(prev => ({ ...prev, brandColor: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─── FEATURES ─── */}
          {step === 'features' && (
            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-white mb-1">What do you need?</h2>
                <p className="text-surface-400 text-sm">Select the tools you want enabled. You can change this anytime.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {FEATURE_OPTIONS.map((feat) => {
                  const isSelected = data.features.includes(feat.key);
                  const isRecommended = data.style ? feat.recommended?.includes(data.style) : false;
                  return (
                    <button
                      key={feat.key}
                      onClick={() => toggleFeature(feat.key)}
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-xl border transition-colors duration-200 text-left relative',
                        isSelected
                          ? 'border-[#FF5F1F] bg-[#FF5F1F]/5 ring-1 ring-[#FF5F1F]/20'
                          : 'border-surface-800 hover:border-surface-700 hover:bg-surface-800/50'
                      )}
                    >
                      {isRecommended && (
                        <span className="absolute -top-2 right-3 text-[9px] px-1.5 py-0.5 rounded-full bg-[#FF5F1F]/20 text-[#FF5F1F] font-bold">
                          RECOMMENDED
                        </span>
                      )}
                      <span className="text-lg mt-0.5">{feat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{feat.label}</p>
                        <p className="text-[11px] text-surface-400 leading-relaxed">{feat.desc}</p>
                      </div>
                      <div className={cn(
                        'w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'border-[#FF5F1F] bg-[#FF5F1F]'
                          : 'border-surface-600'
                      )}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── REVIEW ─── */}
          {step === 'review' && (
            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-white mb-1">Ready to launch</h2>
                <p className="text-surface-400 text-sm">Here's what we're setting up for you.</p>
              </div>

              <div className="max-w-md mx-auto space-y-4">
                {/* Org Preview */}
                <div className="rounded-xl border border-surface-800 bg-surface-800/30 p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-white shadow-lg"
                      style={{ backgroundColor: data.brandColor }}
                    >
                      {data.name[0]?.toUpperCase() || 'O'}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{data.name || 'Your Organization'}</h3>
                      {data.tagline && <p className="text-xs text-surface-400">{data.tagline}</p>}
                      <p className="text-[11px] text-surface-500 mt-0.5">/org/{data.slug}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-surface-800/50 rounded-lg p-2.5">
                      <p className="text-xs text-surface-500">Size</p>
                      <p className="text-sm font-semibold text-white capitalize">{data.size || '—'}</p>
                    </div>
                    <div className="bg-surface-800/50 rounded-lg p-2.5">
                      <p className="text-xs text-surface-500">Type</p>
                      <p className="text-sm font-semibold text-white capitalize">{data.style || '—'}</p>
                    </div>
                    <div className="bg-surface-800/50 rounded-lg p-2.5">
                      <p className="text-xs text-surface-500">Features</p>
                      <p className="text-sm font-semibold text-white">{data.features.length}</p>
                    </div>
                  </div>
                </div>

                {/* Features List */}
                <div className="rounded-xl border border-surface-800 bg-surface-800/30 p-4">
                  <p className="text-xs font-medium text-surface-400 mb-3">Enabled Features</p>
                  <div className="flex flex-wrap gap-2">
                    {data.features.map((key) => {
                      const feat = FEATURE_OPTIONS.find(f => f.key === key);
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-800 text-xs text-surface-300"
                        >
                          <span>{feat?.icon}</span>
                          {feat?.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[11px] text-surface-500 text-center leading-relaxed">
                  You can customize everything and enable more features later from your organization settings.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Footer */}
          <div className="px-8 py-5 border-t border-surface-800 flex items-center justify-between bg-surface-900/50">
            <div>
              {stepIndex > 0 && (
                <button
                  onClick={prevStep}
                  className="text-sm text-surface-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}
            </div>
            <div>
              {step === 'review' ? (
                <Button onClick={handleCreate} loading={creating}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Create Organization
                </Button>
              ) : (
                <Button onClick={nextStep} disabled={!canProceed()}>
                  Continue
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
