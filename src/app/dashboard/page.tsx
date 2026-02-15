'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/stores';
import { Button, Card, Badge, Avatar, LoadingPage, EmptyState, Modal, Input, Textarea, Select } from '@/components/ui';
import { formatDate, timeAgo } from '@/lib/utils';
import type { Project } from '@/lib/types';
import { FORMAT_OPTIONS, GENRE_OPTIONS } from '@/lib/types';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    fetchProjects();
  }, [user, authLoading]);

  const fetchProjects = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) console.error('Error fetching projects:', error.message);
      setProjects(data || []);
    } catch (err) {
      console.error('Unexpected error fetching projects:', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || (!user && loading)) return <LoadingPage />;

  const statusColors: Record<string, string> = {
    development: 'info',
    pre_production: 'warning',
    production: 'success',
    post_production: 'warning',
    completed: 'success',
    archived: 'default',
  };

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-surface-800 bg-surface-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-orange-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-white">Screenplay Studio</h1>
          </div>
          <div className="flex items-center gap-4">
            {user?.id === ADMIN_UID && (
              <Link href="/admin" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors border border-red-500/20">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Admin
              </Link>
            )}
            <Button onClick={() => setShowNewProject(true)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </Button>
            <button
              onClick={() => useAuthStore.getState().signOut().then(() => router.replace('/auth/login'))}
              className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Sign out"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
            <Avatar src={user?.avatar_url} name={user?.full_name} size="md" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-white">
            Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
          </h2>
          <p className="mt-1 text-surface-400">Your film projects and recent work</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Projects', value: projects.length, color: '#6366f1' },
            { label: 'In Development', value: projects.filter(p => p.status === 'development').length, color: '#3b82f6' },
            { label: 'In Production', value: projects.filter(p => p.status === 'production').length, color: '#22c55e' },
            { label: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: '#f59e0b' },
          ].map((stat) => (
            <Card key={stat.label} className="p-5">
              <p className="text-sm text-surface-400">{stat.label}</p>
              <p className="mt-1 text-3xl font-bold text-white">{stat.value}</p>
              <div className="mt-3 h-1 rounded-full bg-surface-800">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${projects.length > 0 ? (stat.value / projects.length) * 100 : 0}%`,
                    backgroundColor: stat.color,
                  }}
                />
              </div>
            </Card>
          ))}
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
              </svg>
            }
            title="No projects yet"
            description="Create your first screenplay project to get started"
            action={
              <Button onClick={() => setShowNewProject(true)}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create First Project
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card hover className="overflow-hidden group">
                  {/* Cover */}
                  <div className="h-32 bg-gradient-to-br from-surface-800 to-surface-900 relative overflow-hidden">
                    {project.cover_url ? (
                      <img src={project.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-5xl font-bold text-surface-700 group-hover:text-surface-600 transition-colors">
                          {project.title[0]}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <Badge variant={statusColors[project.status] as any}>
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-white group-hover:text-brand-400 transition-colors">
                      {project.title}
                    </h3>
                    {project.logline && (
                      <p className="mt-1 text-sm text-surface-400 line-clamp-2">{project.logline}</p>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex gap-1.5">
                        {project.genre?.slice(0, 3).map((g) => (
                          <Badge key={g} size="sm">{g}</Badge>
                        ))}
                      </div>
                      <span className="text-xs text-surface-500">{timeAgo(project.updated_at)}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProject}
        onClose={() => setShowNewProject(false)}
        onCreated={() => {
          setShowNewProject(false);
          fetchProjects();
        }}
        userId={user?.id || ''}
      />
    </div>
  );
}

function NewProjectModal({
  isOpen,
  onClose,
  onCreated,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  userId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [format, setFormat] = useState('feature');
  const [genre, setGenre] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !userId) return;
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert({
          title: title.trim(),
          logline: logline.trim() || null,
          format,
          genre,
          created_by: userId,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating project:', insertError);
        setError(insertError.message);
        setLoading(false);
        return;
      }

      if (data) {
        router.push(`/projects/${data.id}`);
        onCreated();
      }
    } catch (err) {
      console.error('Unexpected error creating project:', err);
      setError('Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleGenre = (g: string) => {
    setGenre((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project" size="lg">
      <form onSubmit={handleCreate} className="space-y-6">
        <Input
          label="Project Title"
          placeholder="The Midnight Hour"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />

        <Textarea
          label="Logline"
          placeholder="A hard-boiled detective uncovers a conspiracy that reaches the highest levels of power..."
          value={logline}
          onChange={(e) => setLogline(e.target.value)}
          rows={3}
        />

        <Select
          label="Format"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          options={FORMAT_OPTIONS}
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-surface-300">Genre</label>
          <div className="flex flex-wrap gap-2">
            {GENRE_OPTIONS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggleGenre(g)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  genre.includes(g)
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-2">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
}
