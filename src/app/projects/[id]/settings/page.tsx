'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Card, Input, Textarea, LoadingSpinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Project } from '@/lib/types';
import { GENRE_OPTIONS, FORMAT_OPTIONS } from '@/lib/types';
import { useRouter } from 'next/navigation';

const STATUSES = [
  { value: 'development', label: 'Development', color: 'bg-yellow-500' },
  { value: 'pre_production', label: 'Pre-Production', color: 'bg-blue-500' },
  { value: 'production', label: 'Production', color: 'bg-green-500' },
  { value: 'post_production', label: 'Post-Production', color: 'bg-purple-500' },
  { value: 'completed', label: 'Completed', color: 'bg-surface-500' },
];

export default function SettingsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => { fetchProject(); }, [params.id]);

  const fetchProject = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('projects').select('*').eq('id', params.id).single();
      if (error) console.error('Settings fetch error:', error.message);
      setProject(data);
      setForm(data || {});
    } catch (err) {
      console.error('Unexpected error fetching project settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('projects').update({
      title: form.title, logline: form.logline, synopsis: form.synopsis,
      genre: form.genre, format: form.format, status: form.status,
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
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-8">Project Settings</h1>

      {/* General settings */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-6">General</h2>
        <div className="space-y-4">
          <Input label="Project Title" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Logline" value={form.logline || ''} onChange={(e) => setForm({ ...form, logline: e.target.value })} rows={2}
            placeholder="A one-sentence summary of your story..." />
          <Textarea label="Synopsis" value={form.synopsis || ''} onChange={(e) => setForm({ ...form, synopsis: e.target.value })} rows={5}
            placeholder="A detailed summary of the story..." />
          <div className="grid grid-cols-3 gap-4">
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
        </div>
        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-surface-800">
          <Button onClick={handleSave} loading={saving}>
            {saved ? '✓ Saved' : 'Save Changes'}
          </Button>
          {saved && <span className="text-sm text-green-400">Changes saved successfully</span>}
        </div>
      </Card>

      {/* Project info */}
      <Card className="p-6 mb-6">
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
      <Card className="p-6 mb-6">
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
