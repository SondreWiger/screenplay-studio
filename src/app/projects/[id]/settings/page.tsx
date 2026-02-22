'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Card, Input, Textarea, LoadingSpinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Project } from '@/lib/types';
import { GENRE_OPTIONS, FORMAT_OPTIONS, LANGUAGE_OPTIONS } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STATUSES = [
  { value: 'development', label: 'Development', color: 'bg-yellow-500' },
  { value: 'pre_production', label: 'Pre-Production', color: 'bg-blue-500' },
  { value: 'production', label: 'Production', color: 'bg-green-500' },
  { value: 'post_production', label: 'Post-Production', color: 'bg-purple-500' },
  { value: 'completed', label: 'Completed', color: 'bg-surface-500' },
  { value: 'archived', label: 'Archived', color: 'bg-surface-700' },
];

export default function SettingsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<any>({});
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [language, setLanguage] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Project customization
  const [projectAccentColor, setProjectAccentColor] = useState<string | null>(null);
  const [projectSidebarTabs, setProjectSidebarTabs] = useState<Record<string, boolean> | null>(null);
  const [savingCustom, setSavingCustom] = useState(false);
  const [savedCustom, setSavedCustom] = useState(false);

  useEffect(() => { fetchProject(); }, [params.id]);

  const fetchProject = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('projects').select('*').eq('id', params.id).single();
      if (error) console.error('Settings fetch error:', error.message);
      setProject(data);
      setForm(data || {});
      setCoverUrl(data?.cover_url || null);
      setLanguage(data?.language || '');
      setProjectAccentColor(data?.accent_color || null);
      setProjectSidebarTabs(data?.sidebar_tabs || null);
    } catch (err) {
      console.error('Unexpected error fetching project settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate file type and size
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }
    setUploadingCover(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${params.id}/cover.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('project-covers')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        console.error('Upload error:', uploadError.message);
        // Fallback: convert to data URL
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target?.result as string;
          await supabase.from('projects').update({ cover_url: dataUrl }).eq('id', params.id);
          setCoverUrl(dataUrl);
        };
        reader.readAsDataURL(file);
      } else {
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('project-covers')
          .getPublicUrl(filePath);
        const url = urlData.publicUrl;
        await supabase.from('projects').update({ cover_url: url }).eq('id', params.id);
        setCoverUrl(url);
      }
    } catch (err) {
      console.error('Cover upload error:', err);
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleRemoveCover = async () => {
    const supabase = createClient();
    await supabase.from('projects').update({ cover_url: null }).eq('id', params.id);
    setCoverUrl(null);
    // Try to delete from storage (ignore errors)
    try {
      await supabase.storage.from('project-covers').remove([`${params.id}/cover.jpg`, `${params.id}/cover.png`, `${params.id}/cover.webp`]);
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('projects').update({
      title: form.title, logline: form.logline, synopsis: form.synopsis,
      genre: form.genre, format: form.format, status: form.status,
      language: language || null,
    }).eq('id', params.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async () => {
    const confirmation = prompt('Type the project title to confirm deletion:');
    if (confirmation !== project?.title) return;
    const supabase = createClient();
    // Delete related data first (cascade should handle most, but be explicit)
    await supabase.from('projects').delete().eq('id', params.id);
    router.push('/dashboard');
  };

  if (loading) return <LoadingSpinner className="py-32" />;
  if (!project) return <div className="p-8 text-surface-400">Project not found.</div>;

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-3xl">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-4 md:mb-8">Project Settings</h1>

      {/* General settings */}
      <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg font-semibold text-white mb-6">General</h2>
        <div className="space-y-4">
          <Input label="Project Title" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Logline" value={form.logline || ''} onChange={(e) => setForm({ ...form, logline: e.target.value })} rows={2}
            placeholder="A one-sentence summary of your story..." />
          <Textarea label="Synopsis" value={form.synopsis || ''} onChange={(e) => setForm({ ...form, synopsis: e.target.value })} rows={5}
            placeholder="A detailed summary of the story..." />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Genre</label>
              <select value={form.genre || ''} onChange={(e) => setForm({ ...form, genre: e.target.value })}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
                <option value="">Select genre</option>
                {GENRE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Format</label>
              <select value={form.format || ''} onChange={(e) => setForm({ ...form, format: e.target.value })}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
                <option value="">Select format</option>
                {FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Status</label>
              <select value={form.status || 'development'} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              <option value="">Select language...</option>
              {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <p className="text-[11px] text-surface-500 mt-1">Primary language of the script / film.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-surface-800">
          <Button onClick={handleSave} loading={saving}>
            {saved ? '✓ Saved' : 'Save Changes'}
          </Button>
          {saved && <span className="text-sm text-green-400">Changes saved successfully</span>}
        </div>
      </Card>

      {/* Cover Image */}
      <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Cover Image</h2>
        <p className="text-sm text-surface-400 mb-4">This image is displayed on your dashboard project card.</p>
        <div className="flex items-start gap-6">
          {/* Preview */}
          <div className="w-48 h-28 rounded-lg border border-surface-700 bg-surface-900 overflow-hidden flex-shrink-0">
            {coverUrl ? (
              <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-surface-600">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
          {/* Upload controls */}
          <div className="flex-1 space-y-3">
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                loading={uploadingCover}
                onClick={() => coverInputRef.current?.click()}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Image
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowUrlInput(!showUrlInput)}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Paste URL
              </Button>
              {coverUrl && (
                <Button variant="ghost" size="sm" onClick={handleRemoveCover}>
                  Remove
                </Button>
              )}
            </div>
            {showUrlInput && (
              <div className="flex gap-2">
                <Input
                  value={coverUrlInput}
                  onChange={(e) => setCoverUrlInput(e.target.value)}
                  placeholder="https://... (paste image URL)"
                  className="flex-1"
                />
                <Button size="sm" onClick={async () => {
                  if (!coverUrlInput.trim()) return;
                  const supabase = createClient();
                  await supabase.from('projects').update({ cover_url: coverUrlInput.trim() }).eq('id', params.id);
                  setCoverUrl(coverUrlInput.trim());
                  setCoverUrlInput('');
                  setShowUrlInput(false);
                }}>Set</Button>
              </div>
            )}
            <p className="text-[11px] text-surface-500">Recommended: 800x450 (16:9). Max 5MB. JPG, PNG, or WebP. Or paste a URL.</p>
          </div>
        </div>
      </Card>

      {/* Project Customization */}
      <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Project Customization</h2>
        <p className="text-sm text-surface-400 mb-6">Override your global preferences for this project only. Leave on "Default" to use your account settings.</p>

        {/* Accent Color Override */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-surface-300 mb-3">Accent Color</h3>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            <button
              onClick={() => setProjectAccentColor(null)}
              className={`h-10 rounded-lg border-2 transition-all text-xs font-medium ${
                !projectAccentColor
                  ? 'border-white bg-surface-800 text-white'
                  : 'border-surface-700 bg-surface-900 text-surface-400 hover:border-surface-600'
              }`}
            >
              Default
            </button>
            {[
              { key: 'brand', color: '#dd574e', label: 'Red' },
              { key: 'blue', color: '#3b82f6', label: 'Blue' },
              { key: 'green', color: '#10b981', label: 'Green' },
              { key: 'purple', color: '#8b5cf6', label: 'Purple' },
              { key: 'pink', color: '#ec4899', label: 'Pink' },
              { key: 'orange', color: '#f97316', label: 'Orange' },
              { key: 'cyan', color: '#06b6d4', label: 'Cyan' },
              { key: 'amber', color: '#f59e0b', label: 'Amber' },
              { key: 'lime', color: '#84cc16', label: 'Lime' },
              { key: 'rose', color: '#f43f5e', label: 'Rose' },
              { key: 'indigo', color: '#6366f1', label: 'Indigo' },
              { key: 'teal', color: '#14b8a6', label: 'Teal' },
            ].map((c) => (
              <button
                key={c.key}
                onClick={() => setProjectAccentColor(c.key)}
                title={c.label}
                className={`relative h-10 rounded-lg border-2 transition-all ${
                  projectAccentColor === c.key
                    ? 'border-white scale-105 ring-2 ring-white/20'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c.color }}
              >
                {projectAccentColor === c.key && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Tabs Override */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-surface-300">Sidebar Tabs</h3>
            {projectSidebarTabs && (
              <button onClick={() => setProjectSidebarTabs(null)} className="text-xs text-brand-400 hover:text-brand-300">
                Reset to default
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { key: 'script', label: '📝 Script' }, { key: 'scenes', label: '🎬 Scenes' },
              { key: 'characters', label: '👤 Characters' }, { key: 'locations', label: '📍 Locations' },
              { key: 'shots', label: '🎥 Shots' }, { key: 'storyboard', label: '🖼️ Storyboard' },
              { key: 'schedule', label: '📅 Schedule' }, { key: 'budget', label: '💰 Budget' },
              { key: 'documents', label: '📄 Documents' }, { key: 'moodboard', label: '🎨 Moodboard' },
              { key: 'ideas', label: '💡 Ideas' }, { key: 'mindmap', label: '🧠 Mind Map' },
              { key: 'team', label: '👥 Team' }, { key: 'thumbnails', label: '🖼️ Thumbnails' },
              { key: 'seo', label: '📊 SEO' }, { key: 'sponsors', label: '💼 Sponsors' },
              { key: 'broll', label: '🎞️ B-Roll' }, { key: 'checklist', label: '✅ Checklist' },
            ].map((tab) => {
              const isOn = projectSidebarTabs ? (projectSidebarTabs[tab.key] !== false) : true;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    const prev = projectSidebarTabs || {};
                    setProjectSidebarTabs({ ...prev, [tab.key]: !isOn });
                  }}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    isOn
                      ? 'border-brand-500/40 bg-brand-500/5'
                      : 'border-surface-700 opacity-40'
                  }`}
                >
                  <p className={`text-xs font-medium ${isOn ? 'text-white' : 'text-surface-500'}`}>{tab.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-surface-800">
          <Button
            loading={savingCustom}
            onClick={async () => {
              setSavingCustom(true);
              const supabase = createClient();
              await supabase.from('projects').update({
                accent_color: projectAccentColor,
                sidebar_tabs: projectSidebarTabs,
              }).eq('id', params.id);
              // Apply immediately
              if (projectAccentColor) {
                document.documentElement.setAttribute('data-accent', projectAccentColor);
              }
              setSavingCustom(false);
              setSavedCustom(true);
              setTimeout(() => setSavedCustom(false), 2000);
            }}
          >
            {savedCustom ? '✓ Saved' : 'Save Customization'}
          </Button>
          {savedCustom && <span className="text-sm text-green-400">Project customization saved</span>}
        </div>
      </Card>

      {/* Project info */}
      <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Project Info</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-surface-500">Project ID</p>
            <p className="text-surface-300 font-mono text-xs mt-1">{project.id}</p>
          </div>
          <div>
            <p className="text-surface-500">Created</p>
            <p className="text-surface-300 mt-1">{new Date(project.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-surface-500">Last Updated</p>
            <p className="text-surface-300 mt-1">{new Date(project.updated_at).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-surface-500">Owner</p>
            <p className="text-surface-300 mt-1">{project.created_by === user?.id ? 'You' : project.created_by}</p>
          </div>
        </div>
      </Card>

      {/* Export */}
      <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Export</h2>
        <p className="text-sm text-surface-400 mb-4">Export your project data for backup or migration.</p>
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={async () => {
            const supabase = createClient();
            const [scripts, chars, locs, scenes, shots, schedule, ideas, budget] = await Promise.all([
              supabase.from('scripts').select('*').eq('project_id', params.id),
              supabase.from('characters').select('*').eq('project_id', params.id),
              supabase.from('locations').select('*').eq('project_id', params.id),
              supabase.from('scenes').select('*').eq('project_id', params.id),
              supabase.from('shots').select('*').eq('project_id', params.id),
              supabase.from('production_schedule').select('*').eq('project_id', params.id),
              supabase.from('ideas').select('*').eq('project_id', params.id),
              supabase.from('budget_items').select('*').eq('project_id', params.id),
            ]);
            const blob = new Blob([JSON.stringify({
              project, scripts: scripts.data, characters: chars.data,
              locations: locs.data, scenes: scenes.data, shots: shots.data,
              schedule: schedule.data, ideas: ideas.data, budget: budget.data,
            }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `${project.title.replace(/\s+/g, '_')}_export.json`;
            a.click(); URL.revokeObjectURL(url);
          }}>Export JSON</Button>
        </div>
      </Card>

      {/* Showcase & Finished Production */}
      <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Showcase & Finished Production</h2>
            <p className="text-sm text-surface-400">
              Configure how your project appears in the community showcase, add set photos, trivia, and more.
            </p>
          </div>
          <Link
            href={`/projects/${params.id}/showcase`}
            className="px-4 py-2 text-sm font-medium text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 rounded-lg transition-colors flex items-center gap-2 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            Open Showcase Settings
          </Link>
        </div>
      </Card>

      {/* Per-project Pro upgrade */}
      {!project?.pro_enabled && (
        <Card className="p-6 border-emerald-500/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-lg flex-shrink-0">🎬</div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white mb-1">Upgrade This Production to Pro</h2>
              <p className="text-sm text-surface-400 mb-3">
                Unlock AI Analysis, Client Review, Brand Kit, Revisions, Reports, and Casting tools on this production — with a one-time $100 payment. All team members get access. No subscription needed.
              </p>
              <Link href={`/pro?upgrade_project=${params.id}`}>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500">Upgrade for $100 — One Time</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
      {project?.pro_enabled && (
        <Card className="p-6 border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-lg">✓</div>
            <div>
              <h2 className="text-sm font-semibold text-emerald-400">Pro Enabled on This Project</h2>
              <p className="text-xs text-surface-500">All Pro tools are unlocked for this project permanently.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="p-6 border-red-500/20">
        <h2 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h2>
        <p className="text-sm text-surface-400 mb-4">
          Deleting this project is permanent. All scripts, characters, locations, scenes, and production data will be lost forever.
        </p>
        <Button variant="danger" onClick={handleDelete}>Delete Project</Button>
      </Card>
    </div>
  );
}
