'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/stores';
import { Button, Card, Input, Textarea, LoadingPage } from '@/components/ui';
import { SCRIPT_TYPE_OPTIONS } from '@/lib/types';
import type { UsageIntent, ScriptType, Company } from '@/lib/types';

// ============================================================
// User Settings — profile, preferences, company
// ============================================================

type SettingsTab = 'profile' | 'preferences' | 'company' | 'privacy';

export default function UserSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile form
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [username, setUsername] = useState('');
  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [profileTheme, setProfileTheme] = useState('default');
  const [showEmail, setShowEmail] = useState(false);
  const [showProjects, setShowProjects] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [allowDms, setAllowDms] = useState(true);

  // Preferences form
  const [usageIntent, setUsageIntent] = useState<UsageIntent>('writer');
  const [showCommunity, setShowCommunity] = useState(true);
  const [showProductionTools, setShowProductionTools] = useState(true);
  const [showCollaboration, setShowCollaboration] = useState(true);
  const [preferredScriptType, setPreferredScriptType] = useState<ScriptType>('screenplay');

  // Company
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth/login'); return; }

    setFullName(user.full_name || '');
    setDisplayName(user.display_name || '');
    setBio(user.bio || '');
    setAvatarUrl(user.avatar_url || '');
    setUsername(user.username || '');
    setHeadline(user.headline || '');
    setLocation(user.location || '');
    setWebsite(user.website || '');
    setBannerUrl(user.banner_url || '');
    setSocialLinks(user.social_links || {});
    setProfileTheme(user.profile_theme || 'default');
    setShowEmail(user.show_email ?? false);
    setShowProjects(user.show_projects !== false);
    setShowActivity(user.show_activity !== false);
    setAllowDms(user.allow_dms !== false);
    setUsageIntent(user.usage_intent || 'writer');
    setShowCommunity(user.show_community !== false);
    setShowProductionTools(user.show_production_tools !== false);
    setShowCollaboration(user.show_collaboration !== false);
    setPreferredScriptType(user.preferred_script_type || 'screenplay');

    loadCompanies();
  }, [user, authLoading]);

  const loadCompanies = async () => {
    const supabase = createClient();
    const { data } = await supabase.from('companies').select('*').order('name');
    setCompanies(data || []);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    const updates = {
      full_name: fullName.trim() || null,
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      username: username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || null,
      headline: headline.trim() || null,
      location: location.trim() || null,
      website: website.trim() || null,
      banner_url: bannerUrl.trim() || null,
      social_links: socialLinks,
      profile_theme: profileTheme,
      show_email: showEmail,
      show_projects: showProjects,
      show_activity: showActivity,
      allow_dms: allowDms,
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);

    if (error) {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        alert('That username is already taken. Please choose a different one.');
      } else {
        alert('Failed to save: ' + error.message);
      }
      setSaving(false);
      return;
    }

    useAuthStore.getState().setUser({ ...user, ...updates });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const savePreferences = async () => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('profiles').update({
      usage_intent: usageIntent,
      show_community: showCommunity,
      show_production_tools: showProductionTools,
      show_collaboration: showCollaboration,
      preferred_script_type: preferredScriptType,
    }).eq('id', user.id);

    useAuthStore.getState().setUser({
      ...user,
      usage_intent: usageIntent,
      show_community: showCommunity,
      show_production_tools: showProductionTools,
      show_collaboration: showCollaboration,
      preferred_script_type: preferredScriptType,
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const createCompany = async () => {
    if (!user || !companyName.trim() || !companySlug.trim()) return;
    setCreatingCompany(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('companies').insert({
      name: companyName.trim(),
      slug: companySlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
      description: companyDescription.trim() || null,
      owner_id: user.id,
    }).select().single();

    if (error) {
      console.error('Company creation error:', error.message, error.details, error.hint, error.code);
      alert(`Failed to create company: ${error.message}`);
      setCreatingCompany(false);
      return;
    }

    if (data) {
      // Ensure user is a member (trigger should handle this, but insert as fallback)
      await supabase.from('company_members').upsert({
        company_id: data.id,
        user_id: user.id,
        role: 'owner',
        job_title: 'Company Owner',
      }, { onConflict: 'company_id,user_id' });

      await supabase.from('profiles').update({ company_id: data.id }).eq('id', user.id);
      useAuthStore.getState().setUser({ ...user, company_id: data.id });
      setCompanyName('');
      setCompanySlug('');
      setCompanyDescription('');
      loadCompanies();
    }
    setCreatingCompany(false);
  };

  if (authLoading) return <LoadingPage />;
  if (!user) return null;

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'Profile', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { key: 'preferences', label: 'Preferences', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg> },
    { key: 'company', label: 'Company', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    { key: 'privacy', label: 'Privacy & Data', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
  ];

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-surface-800 bg-surface-950/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-white/5 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <h1 className="text-lg font-semibold text-white">Settings</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Tab bar */}
        <div className="flex gap-1 mb-8 p-1 rounded-xl bg-surface-900 w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-surface-800 text-white shadow-sm'
                  : 'text-surface-400 hover:text-white'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {tab === 'profile' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Your Profile</h2>
              <div className="space-y-4">
                <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
                <Input label="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How you appear to others" />
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Username</label>
                  <div className="flex items-center gap-0">
                    <span className="px-3 py-2.5 rounded-l-lg border border-r-0 border-surface-700 bg-surface-800 text-xs text-surface-500">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      className="flex-1 rounded-r-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white placeholder:text-surface-600 outline-none focus:border-brand-500"
                      placeholder="your-username"
                    />
                  </div>
                  <p className="text-[10px] text-surface-500 mt-1">Your public profile will be at /u/{username || 'username'}</p>
                </div>
                <Input label="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Screenwriter, Director, Producer..." />
                <Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} />
                <Input label="Avatar URL" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
              </div>
            </Card>

            {/* Public Profile Customisation */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Public Profile</h2>
              <p className="text-sm text-surface-400 mb-6">Customise how your profile appears to visitors.</p>
              <div className="space-y-4">
                <Input label="Banner Image URL" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://... (hero image for your profile)" />
                <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Los Angeles, CA" />
                <Input label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yoursite.com" />
              </div>

              {/* Profile Theme */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-surface-300 mb-3">Profile Theme</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'default', label: 'Default', gradient: 'from-stone-900 to-stone-800' },
                    { key: 'midnight', label: 'Midnight', gradient: 'from-indigo-950 to-slate-900' },
                    { key: 'sunset', label: 'Sunset', gradient: 'from-orange-600 to-rose-700' },
                    { key: 'forest', label: 'Forest', gradient: 'from-emerald-900 to-teal-800' },
                    { key: 'ocean', label: 'Ocean', gradient: 'from-cyan-800 to-blue-900' },
                    { key: 'noir', label: 'Noir', gradient: 'from-neutral-950 to-neutral-900' },
                    { key: 'royal', label: 'Royal', gradient: 'from-purple-900 to-fuchsia-800' },
                    { key: 'crimson', label: 'Crimson', gradient: 'from-red-900 to-rose-800' },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setProfileTheme(t.key)}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                        profileTheme === t.key ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-surface-700 hover:border-surface-600'
                      }`}
                    >
                      <div className={`h-12 bg-gradient-to-br ${t.gradient}`} />
                      <p className="text-[10px] font-medium text-surface-300 py-1 text-center">{t.label}</p>
                      {profileTheme === t.key && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-brand-500 rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Social Links */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Social Links</h2>
              <p className="text-sm text-surface-400 mb-6">Add links to your social profiles. Leave blank to hide.</p>
              <div className="space-y-3">
                {[
                  { key: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/username', icon: '𝕏' },
                  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username', icon: '📷' },
                  { key: 'imdb', label: 'IMDb', placeholder: 'https://imdb.com/name/nm...', icon: '🎬' },
                  { key: 'letterboxd', label: 'Letterboxd', placeholder: 'https://letterboxd.com/username', icon: '🎞️' },
                  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/username', icon: '💼' },
                  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@channel', icon: '▶️' },
                  { key: 'vimeo', label: 'Vimeo', placeholder: 'https://vimeo.com/username', icon: '🎥' },
                  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/username', icon: '💻' },
                ].map((social) => (
                  <div key={social.key} className="flex items-center gap-3">
                    <span className="text-lg w-6 text-center shrink-0">{social.icon}</span>
                    <input
                      type="text"
                      value={socialLinks[social.key] || ''}
                      onChange={(e) => setSocialLinks((prev) => ({ ...prev, [social.key]: e.target.value }))}
                      placeholder={social.placeholder}
                      className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-600 outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                ))}
              </div>
            </Card>

            {/* Privacy & Visibility */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Privacy & Visibility</h2>
              <p className="text-sm text-surface-400 mb-6">Control what others can see on your profile.</p>
              <div className="space-y-3">
                {[
                  { label: 'Show email on profile', desc: 'Let visitors see your email address', value: showEmail, set: setShowEmail },
                  { label: 'Show projects', desc: 'Display your projects on your public profile', value: showProjects, set: setShowProjects },
                  { label: 'Show activity', desc: 'Display recent activity and stats', value: showActivity, set: setShowActivity },
                  { label: 'Allow direct messages', desc: 'Let people message you from your profile', value: allowDms, set: setAllowDms },
                ].map((toggle) => (
                  <button
                    key={toggle.label}
                    onClick={() => toggle.set(!toggle.value)}
                    className="w-full flex items-center justify-between gap-4 p-3 rounded-lg border border-surface-700 hover:border-surface-600 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{toggle.label}</p>
                      <p className="text-[11px] text-surface-500">{toggle.desc}</p>
                    </div>
                    <div className={`w-10 h-5.5 rounded-full shrink-0 transition-colors relative ${toggle.value ? 'bg-brand-500' : 'bg-surface-700'}`}>
                      <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${toggle.value ? 'left-[19px]' : 'left-0.5'}`} />
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Account Info</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-surface-500">Email</p>
                  <p className="text-surface-300 mt-1">{user.email}</p>
                </div>
                <div>
                  <p className="text-surface-500">Member Since</p>
                  <p className="text-surface-300 mt-1">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                {username && (
                  <div className="col-span-2">
                    <p className="text-surface-500">Public Profile</p>
                    <Link href={`/u/${username}`} className="text-brand-400 hover:text-brand-300 transition-colors mt-1 inline-block text-sm">/u/{username}</Link>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex items-center gap-3">
              <Button onClick={saveProfile} loading={saving}>
                {saved ? '✓ Saved' : 'Save Profile'}
              </Button>
              {saved && <span className="text-sm text-green-400">Changes saved</span>}
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {tab === 'preferences' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-2">How do you use Screenplay Studio?</h2>
              <p className="text-sm text-surface-400 mb-6">This adjusts your default workspace layout.</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'writer' as UsageIntent, label: 'Writer', icon: '✍️' },
                  { value: 'producer' as UsageIntent, label: 'Producer', icon: '🎥' },
                  { value: 'both' as UsageIntent, label: 'Both', icon: '🎬' },
                  { value: 'student' as UsageIntent, label: 'Student', icon: '📚' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setUsageIntent(opt.value)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                      usageIntent === opt.value
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-surface-700 hover:border-surface-600'
                    }`}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    <span className={`text-sm font-medium ${usageIntent === opt.value ? 'text-brand-400' : 'text-white'}`}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Feature Visibility</h2>
              <p className="text-sm text-surface-400 mb-6">
                Hidden features are still accessible under the &quot;More Tools&quot; dropdown in projects.
              </p>
              <div className="space-y-3">
                {[
                  { key: 'community' as const, label: 'Community Hub', desc: 'Share scripts, get feedback, join challenges', icon: '🌐', value: showCommunity, set: setShowCommunity },
                  { key: 'production' as const, label: 'Production Tools', desc: 'Locations, shots, schedule, budget', icon: '🎞️', value: showProductionTools, set: setShowProductionTools },
                  { key: 'collab' as const, label: 'Collaboration', desc: 'Team members, real-time editing', icon: '👥', value: showCollaboration, set: setShowCollaboration },
                ].map((feat) => (
                  <button
                    key={feat.key}
                    onClick={() => feat.set(!feat.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                      feat.value ? 'border-brand-500/40 bg-brand-500/5' : 'border-surface-700 opacity-50'
                    }`}
                  >
                    <span className="text-xl shrink-0">{feat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white">{feat.label}</h3>
                      <p className="text-[11px] text-surface-400">{feat.desc}</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full shrink-0 transition-colors relative ${feat.value ? 'bg-brand-500' : 'bg-surface-700'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${feat.value ? 'left-[22px]' : 'left-0.5'}`} />
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Default Script Type</h2>
              <p className="text-sm text-surface-400 mb-4">Pre-selected when you create new projects.</p>
              <div className="grid grid-cols-3 gap-2">
                {SCRIPT_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPreferredScriptType(opt.value)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      preferredScriptType === opt.value
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-surface-700 hover:border-surface-600'
                    }`}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    <p className={`text-xs font-medium mt-1 ${preferredScriptType === opt.value ? 'text-brand-400' : 'text-white'}`}>{opt.label}</p>
                  </button>
                ))}
              </div>
            </Card>

            <div className="flex items-center gap-3">
              <Button onClick={savePreferences} loading={saving}>
                {saved ? '✓ Saved' : 'Save Preferences'}
              </Button>
              {saved && <span className="text-sm text-green-400">Preferences saved</span>}
            </div>
          </div>
        )}

        {/* Company Tab */}
        {tab === 'company' && (
          <div className="space-y-6">
            {companies.length > 0 ? (
              <>
                <div className="space-y-4">
                  {companies.map((company) => (
                    <Card key={company.id} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          {company.logo_url ? (
                            <img src={company.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white" style={{ backgroundColor: company.brand_color }}>
                              {company.name[0]}
                            </div>
                          )}
                          <div>
                            <h3 className="text-lg font-semibold text-white">{company.name}</h3>
                            <p className="text-xs text-surface-400">/{company.slug}</p>
                            {company.description && <p className="text-sm text-surface-400 mt-1">{company.description}</p>}
                          </div>
                        </div>
                        <Link
                          href={`/company/${company.slug}`}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 transition-colors"
                        >
                          Manage
                        </Link>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-surface-500">Plan</p>
                          <p className="text-surface-300 capitalize">{company.plan}</p>
                        </div>
                        <div>
                          <p className="text-surface-500">Public Page</p>
                          <p className="text-surface-300">{company.public_page_enabled ? 'Enabled' : 'Disabled'}</p>
                        </div>
                        <div>
                          <p className="text-surface-500">Created</p>
                          <p className="text-surface-300">{new Date(company.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <Card className="p-8 text-center">
                <div className="w-16 h-16 bg-surface-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">No Company Yet</h3>
                <p className="text-sm text-surface-400 mb-6 max-w-sm mx-auto">
                  Create a company to organize projects under a shared workspace with teams and permissions.
                  <span className="block mt-1 text-brand-400 text-xs">Pro Feature</span>
                </p>
              </Card>
            )}

            {/* Create Company */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Create a Company</h2>
              <div className="space-y-4">
                <Input
                  label="Company Name"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setCompanySlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                  }}
                  placeholder="Acme Pictures"
                />
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">URL Slug</label>
                  <div className="flex items-center gap-0">
                    <span className="px-3 py-2.5 rounded-l-lg border border-r-0 border-surface-700 bg-surface-800 text-xs text-surface-500">/</span>
                    <input
                      type="text"
                      value={companySlug}
                      onChange={(e) => setCompanySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      className="flex-1 rounded-r-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white placeholder:text-surface-600 outline-none focus:border-brand-500"
                      placeholder="acme-pictures"
                    />
                  </div>
                  <p className="text-[10px] text-surface-500 mt-1">Company projects will appear at /{companySlug || 'slug'}/projects</p>
                </div>
                <Textarea
                  label="Description"
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  placeholder="What does your company do?"
                  rows={2}
                />
              </div>
              <div className="mt-6 pt-6 border-t border-surface-800">
                <Button onClick={createCompany} loading={creatingCompany} disabled={!companyName.trim() || !companySlug.trim()}>
                  Create Company
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ============================================================ */}
        {/* Privacy & Data Tab */}
        {/* ============================================================ */}
        {tab === 'privacy' && (
          <div className="space-y-6">
            {/* GDPR Data Export */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Export Your Data</h2>
              <p className="text-sm text-surface-400 mb-4">
                Download all your personal data in a machine-readable format (JSON).
                This includes your profile, projects, scripts, characters, messages, and all other data
                associated with your account. This is your right under GDPR Article 20.
              </p>
              <Button variant="secondary" onClick={async () => {
                const supabase = createClient();
                const userId = user?.id;
                if (!userId) return;
                const [
                  profileRes, projectsRes, scriptsRes, elementsRes,
                  charsRes, locsRes, scenesRes, shotsRes,
                  ideasRes, commentsRes, notificationsRes,
                  dmsRes, communityRes,
                ] = await Promise.all([
                  supabase.from('profiles').select('*').eq('id', userId),
                  supabase.from('projects').select('*').eq('created_by', userId),
                  supabase.from('scripts').select('*').eq('created_by', userId),
                  supabase.from('script_elements').select('*').eq('created_by', userId),
                  supabase.from('characters').select('*').eq('created_by', userId),
                  supabase.from('locations').select('*').eq('created_by', userId),
                  supabase.from('scenes').select('*').eq('created_by', userId),
                  supabase.from('shots').select('*').eq('created_by', userId),
                  supabase.from('ideas').select('*').eq('created_by', userId),
                  supabase.from('comments').select('*').eq('user_id', userId),
                  supabase.from('notifications').select('*').eq('user_id', userId),
                  supabase.from('direct_messages').select('*').eq('sender_id', userId),
                  supabase.from('community_posts').select('*').eq('author_id', userId),
                ]);
                const exportData = {
                  exported_at: new Date().toISOString(),
                  gdpr_notice: 'This file contains all personal data associated with your Screenplay Studio account.',
                  profile: profileRes.data?.[0] || null,
                  projects: projectsRes.data || [],
                  scripts: scriptsRes.data || [],
                  script_elements: elementsRes.data || [],
                  characters: charsRes.data || [],
                  locations: locsRes.data || [],
                  scenes: scenesRes.data || [],
                  shots: shotsRes.data || [],
                  ideas: ideasRes.data || [],
                  comments: commentsRes.data || [],
                  notifications: notificationsRes.data || [],
                  direct_messages: dmsRes.data || [],
                  community_posts: communityRes.data || [],
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `screenplay_studio_data_export_${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}>
                Download My Data
              </Button>
            </Card>

            {/* Cookie Preferences */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Cookie Preferences</h2>
              <p className="text-sm text-surface-400 mb-4">
                Manage which types of cookies you allow. Necessary cookies cannot be disabled.
              </p>
              <Button variant="secondary" onClick={() => {
                try { localStorage.removeItem('ss_cookie_consent'); } catch {}
                window.location.reload();
              }}>
                Reset Cookie Preferences
              </Button>
            </Card>

            {/* Privacy Settings */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Privacy Settings</h2>
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white">Show Email on Profile</span>
                    <p className="text-xs text-surface-500">Allow other users to see your email address.</p>
                  </div>
                  <input type="checkbox" checked={showEmail}
                    onChange={(e) => setShowEmail(e.target.checked)}
                    className="rounded border-surface-600 bg-surface-700 text-brand-500 focus:ring-brand-500" />
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white">Show Projects on Profile</span>
                    <p className="text-xs text-surface-500">Display your projects publicly on your profile.</p>
                  </div>
                  <input type="checkbox" checked={showProjects}
                    onChange={(e) => setShowProjects(e.target.checked)}
                    className="rounded border-surface-600 bg-surface-700 text-brand-500 focus:ring-brand-500" />
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white">Show Activity</span>
                    <p className="text-xs text-surface-500">Display your recent activity on your profile.</p>
                  </div>
                  <input type="checkbox" checked={showActivity}
                    onChange={(e) => setShowActivity(e.target.checked)}
                    className="rounded border-surface-600 bg-surface-700 text-brand-500 focus:ring-brand-500" />
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white">Allow Direct Messages</span>
                    <p className="text-xs text-surface-500">Let other users send you direct messages.</p>
                  </div>
                  <input type="checkbox" checked={allowDms}
                    onChange={(e) => setAllowDms(e.target.checked)}
                    className="rounded border-surface-600 bg-surface-700 text-brand-500 focus:ring-brand-500" />
                </label>
              </div>
              <div className="mt-4 pt-4 border-t border-surface-800">
                <Button onClick={saveProfile} loading={saving}>Save Privacy Settings</Button>
              </div>
            </Card>

            {/* Delete Account */}
            <Card className="p-6 border-red-500/20">
              <h2 className="text-lg font-semibold text-red-400 mb-2">Delete Account</h2>
              <p className="text-sm text-surface-400 mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
                All your projects, scripts, characters, and other content will be permanently removed
                within 30 days as required by GDPR Article 17 (Right to Erasure).
              </p>
              <Button variant="danger" onClick={async () => {
                const confirmation = prompt('Type "DELETE" to confirm account deletion:');
                if (confirmation !== 'DELETE') return;

                const secondConfirm = confirm(
                  'Are you absolutely sure? This will permanently delete:\n\n' +
                  '- Your profile and all personal data\n' +
                  '- All projects you own\n' +
                  '- All scripts and documents\n' +
                  '- All community posts and comments\n' +
                  '- All messages and conversations\n\n' +
                  'This cannot be undone.'
                );
                if (!secondConfirm) return;

                try {
                  const supabase = createClient();
                  const userId = user?.id;
                  if (!userId) return;

                  // Delete user's owned projects (cascade deletes scripts, elements, etc.)
                  await supabase.from('projects').delete().eq('created_by', userId);

                  // Delete community posts
                  await supabase.from('community_posts').delete().eq('author_id', userId);

                  // Delete direct messages
                  await supabase.from('direct_messages').delete().eq('sender_id', userId);

                  // Delete notifications
                  await supabase.from('notifications').delete().eq('user_id', userId);

                  // Anonymize comments on other's content
                  await supabase.from('comments').update({
                    content: '[deleted]',
                    user_id: null,
                  }).eq('user_id', userId);

                  // Delete profile
                  await supabase.from('profiles').delete().eq('id', userId);

                  // Sign out auth
                  await supabase.auth.signOut();

                  // Redirect
                  router.push('/');
                } catch (err) {
                  console.error('Account deletion error:', err);
                  alert('An error occurred. Please contact support.');
                }
              }}>
                Delete My Account
              </Button>
              <p className="text-[10px] text-surface-600 mt-3">
                By proceeding, you acknowledge that this action is permanent and irreversible.
                <br />
                <a href="/privacy" className="text-brand-400 hover:text-brand-300">Read our Privacy Policy</a>
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
