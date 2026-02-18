'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';
import { ScriptContentViewer } from '@/components/ScreenplayRenderer';
import { formatDate, timeAgo, cn } from '@/lib/utils';
import type { Festival, FestivalSubmission, Project } from '@/lib/types';

// ============================================================
// Festival Submissions Page
// ============================================================

export default function FestivalsPage() {
  const { user } = useAuth();
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [submissions, setSubmissions] = useState<FestivalSubmission[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedFestival, setSelectedFestival] = useState<Festival | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [scriptElements, setScriptElements] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<any>(null);

  useEffect(() => { fetchData(); }, [user]);

  const fetchData = async () => {
    const supabase = createClient();
    const [festRes, subRes] = await Promise.all([
      supabase.from('festivals').select('*').eq('is_active', true).order('deadline', { ascending: true }),
      user
        ? supabase.from('festival_submissions').select('*, festival:festivals(*), project:projects(title, logline, genre, format)').eq('user_id', user.id).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    setFestivals(festRes.data || []);
    setSubmissions((subRes.data || []) as any);
    setLoading(false);
  };

  const loadUserProjects = async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('created_by', user.id)
      .order('updated_at', { ascending: false });
    setProjects(data || []);
  };

  const loadScriptPreview = async (projectId: string) => {
    const supabase = createClient();
    const { data: scriptData } = await supabase
      .from('scripts')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at')
      .limit(1);

    if (!scriptData?.length) { setScriptElements([]); return; }

    const { data: elements } = await supabase
      .from('script_elements')
      .select('element_type, content, sort_order, scene_number, revision_color')
      .eq('script_id', scriptData[0].id)
      .eq('is_omitted', false)
      .order('sort_order');

    setScriptElements(elements || []);
  };

  const handleSelectProject = async (project: Project) => {
    setSelectedProject(project);
    await loadScriptPreview(project.id);
  };

  const handleSubmit = async () => {
    if (!user || !selectedFestival || !selectedProject) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('snapshot_script_for_festival', {
        p_project_id: selectedProject.id,
        p_festival_id: selectedFestival.id,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;

      // Mark as submitted
      await supabase.from('festival_submissions')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', data);

      setShowSubmitModal(false);
      setSelectedFestival(null);
      setSelectedProject(null);
      setNotes('');
      setScriptElements([]);
      await fetchData();
    } catch (err: any) {
      alert('Failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSubmit = async (festival: Festival) => {
    setSelectedFestival(festival);
    setSelectedProject(null);
    setScriptElements([]);
    setNotes('');
    await loadUserProjects();
    setShowSubmitModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-[#faf9f7]/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Community
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="text-xs text-stone-500 hover:text-stone-900 transition-colors">Dashboard</Link>
            ) : (
              <Link href="/auth/login?redirect=/community/festivals" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Sign In</Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-stone-900 tracking-tight mb-2">🏆 Festival Submissions</h1>
        <p className="text-stone-500 mb-8">Submit your screenplays to film festivals. Your script's formatting will be preserved in the submission.</p>

        {/* Active Festivals */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">Active Festivals</h2>
          {festivals.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-stone-200 bg-white">
              <div className="text-4xl mb-3">🏆</div>
              <p className="text-stone-500 text-sm">No active festivals right now.</p>
              <p className="text-stone-400 text-xs mt-1">Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {festivals.map((fest) => (
                <div key={fest.id} className="rounded-xl border border-stone-200 bg-white p-5 hover:border-stone-300 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-3">
                    {fest.logo_url ? (
                      <img src={fest.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center text-2xl shrink-0">🏆</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-stone-900">{fest.name}</h3>
                      {fest.description && <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{fest.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-stone-400">
                        {fest.deadline && <span>📅 Deadline: {formatDate(fest.deadline)}</span>}
                        {fest.location && <span>📍 {fest.location}</span>}
                      </div>
                      {fest.categories && fest.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {fest.categories.map((cat) => (
                            <span key={cat} className="px-2 py-0.5 text-[10px] font-medium text-stone-600 bg-stone-100 rounded-full">{cat}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-100">
                    {fest.website && (
                      <a href={fest.website} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:text-brand-700 transition-colors">
                        Visit Website →
                      </a>
                    )}
                    {user && (
                      <button
                        onClick={() => handleStartSubmit(fest)}
                        className="px-4 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                      >
                        Submit Script
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My Submissions */}
        {user && submissions.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-4">My Submissions</h2>
            <div className="space-y-3">
              {submissions.map((sub) => (
                <div key={sub.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'px-2 py-0.5 text-[10px] font-semibold rounded-full',
                          sub.status === 'submitted' ? 'text-blue-700 bg-blue-50 border border-blue-200' :
                          sub.status === 'accepted' ? 'text-green-700 bg-green-50 border border-green-200' :
                          sub.status === 'rejected' ? 'text-red-700 bg-red-50 border border-red-200' :
                          sub.status === 'withdrawn' ? 'text-stone-600 bg-stone-100 border border-stone-200' :
                          'text-amber-700 bg-amber-50 border border-amber-200'
                        )}>
                          {sub.status}
                        </span>
                        <span className="text-sm font-medium text-stone-900">{sub.title}</span>
                      </div>
                      <p className="text-xs text-stone-500">
                        {sub.festival?.name} · {sub.page_count} pages · {sub.word_count?.toLocaleString()} words
                        {sub.submitted_at && ` · submitted ${formatDate(sub.submitted_at)}`}
                      </p>
                    </div>
                    <button
                      onClick={() => { setPreviewSnapshot(sub.script_snapshot); setShowPreview(true); }}
                      className="text-xs text-brand-600 hover:text-brand-700 transition-colors shrink-0 ml-3"
                    >
                      Preview Script
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Submit Modal */}
      {showSubmitModal && selectedFestival && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSubmitModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-stone-900 mb-1">Submit to {selectedFestival.name}</h3>
            <p className="text-sm text-stone-500 mb-5">Select a project — its script will be snapshotted with full formatting preserved.</p>

            {/* Project selection */}
            <h4 className="text-sm font-medium text-stone-700 mb-3">Choose a Project</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project)}
                  className={cn(
                    'text-left rounded-xl border p-3 transition-all',
                    selectedProject?.id === project.id
                      ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-300'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-sm font-bold text-stone-500">
                      {(project.title || 'P')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">{project.title}</p>
                      <p className="text-[10px] text-stone-400">{project.format} · {project.script_type || 'screenplay'}</p>
                    </div>
                    {selectedProject?.id === project.id && (
                      <svg className="w-5 h-5 text-brand-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    )}
                  </div>
                  {project.logline && <p className="text-[10px] text-stone-400 mt-1 line-clamp-2">{project.logline}</p>}
                </button>
              ))}
            </div>

            {/* Script preview */}
            {selectedProject && scriptElements.length > 0 && (
              <div className="mb-5">
                <h4 className="text-sm font-medium text-stone-700 mb-2">Script Preview ({scriptElements.length} elements)</h4>
                <div className="rounded-xl border border-stone-200 bg-white p-4 max-h-48 overflow-y-auto">
                  <ScriptContentViewer content={JSON.stringify(scriptElements)} />
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-stone-700 mb-1">Submission Notes (optional)</label>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes for this submission..."
                rows={2}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 focus:border-brand-400 focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSubmitModal(false)} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!selectedProject || submitting}
                className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Script'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Script Preview Modal */}
      {showPreview && previewSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowPreview(false); setPreviewSnapshot(null); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900">Submitted Script</h3>
              <button onClick={() => { setShowPreview(false); setPreviewSnapshot(null); }} className="text-stone-400 hover:text-stone-700 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="bg-stone-50 rounded-xl p-6 border border-stone-200">
              <ScriptContentViewer content={JSON.stringify(previewSnapshot)} />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#faf9f7] border-t border-stone-200 py-10 px-6 mt-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">← Back to Community</Link>
          <div className="flex items-center gap-6 text-sm text-stone-500">
            <Link href="/" className="hover:text-stone-900 transition-colors">Home</Link>
            <Link href="/community/free-scripts" className="hover:text-stone-900 transition-colors">Free Scripts</Link>
            <SiteVersion light />
          </div>
        </div>
      </footer>
    </div>
  );
}
