'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Card, Input, Textarea, LoadingSpinner, toast } from '@/components/ui';
import type { Project } from '@/lib/types';

type SetPhoto = {
  url: string;
  caption?: string;
  scene?: string;
  context?: string;
};

export default function ShowcaseSettingsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Showcase state
  const [wrapUrl, setWrapUrl] = useState('');
  const [isShowcased, setIsShowcased] = useState(false);
  const [showcaseDescription, setShowcaseDescription] = useState('');
  const [showcaseScript, setShowcaseScript] = useState(false);
  const [showcaseMindmap, setShowcaseMindmap] = useState(false);
  const [showcaseMoodboard, setShowcaseMoodboard] = useState(false);
  const [setPhotos, setSetPhotos] = useState<SetPhoto[]>([]);
  const [externalLinks, setExternalLinks] = useState<Record<string, string>>({});
  const [productionTrivia, setProductionTrivia] = useState<{ title: string; content: string }[]>([]);

  useEffect(() => {
    fetchProject();
  }, [params.id]);

  const parseSetPhotos = (raw: unknown): SetPhoto[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
      if (typeof item === 'string') return { url: item, caption: '', scene: '', context: '' };
      if (typeof item === 'object' && item && 'url' in item) return { caption: '', scene: '', context: '', ...item } as SetPhoto;
      return null;
    }).filter(Boolean) as SetPhoto[];
  };

  const fetchProject = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('projects').select('*').eq('id', params.id).single();
      if (error) { toast.error('Failed to load showcase settings'); setLoading(false); return; }
      setProject(data);
      setWrapUrl(data?.wrap_url || '');
      setIsShowcased(data?.is_showcased || false);
      setShowcaseDescription(data?.showcase_description || '');
      setShowcaseScript(data?.showcase_script || false);
      setShowcaseMindmap(data?.showcase_mindmap || false);
      setShowcaseMoodboard(data?.showcase_moodboard || false);
      setSetPhotos(parseSetPhotos(data?.set_photos));
      setExternalLinks(data?.external_links || {});
      setProductionTrivia(data?.production_trivia || []);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('projects').update({
      wrap_url: wrapUrl || null,
      is_showcased: isShowcased,
      showcase_description: showcaseDescription || null,
      showcase_script: showcaseScript,
      showcase_mindmap: showcaseMindmap,
      showcase_moodboard: showcaseMoodboard,
      external_links: externalLinks,
      production_trivia: productionTrivia.filter((t) => t.title.trim() || t.content.trim()),
      set_photos: setPhotos.filter((p) => p.url.trim()),
      status: wrapUrl ? 'completed' : project?.status,
    }).eq('id', params.id);

    if (error) {
      console.error('Save error:', error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner className="py-32" />;
  if (!project) return <div className="p-8 text-surface-400">Project not found.</div>;

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-4 md:mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Showcase Settings</h1>
          <p className="text-sm text-surface-400">Configure how your project appears in the community showcase.</p>
        </div>
      </div>

      {/* Finished Work URL */}
      <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Finished Production</h2>
        <p className="text-sm text-surface-400 mb-4">
          Add a link to the final result and optionally showcase it on the community.
        </p>
        <div className="space-y-4">
          <Input
            label="Finished Work URL"
            value={wrapUrl}
            onChange={(e) => setWrapUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
          />
          <p className="text-[11px] text-surface-500 -mt-2">YouTube, Vimeo, or any link to the finished product.</p>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-surface-700 bg-surface-900/50 hover:border-[#FF5F1F]/30 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={isShowcased}
              onChange={(e) => setIsShowcased(e.target.checked)}
              className="rounded border-surface-600"
            />
            <div>
              <span className="text-sm font-medium text-surface-300">Showcase on Community</span>
              <p className="text-[11px] text-surface-500">Display this in the Finished Projects section of the community page.</p>
            </div>
          </label>
        </div>
      </Card>

      {isShowcased && (
        <>
          {/* Description */}
          <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Showcase Description</h2>
            <Textarea
              value={showcaseDescription}
              onChange={(e) => setShowcaseDescription(e.target.value)}
              placeholder="A brief description of the finished production for the community page..."
              rows={4}
            />
          </Card>

          {/* Deep Dive */}
          <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg font-semibold text-white mb-2">Deep Dive</h2>
            <p className="text-sm text-surface-400 mb-4">Let visitors explore your creative process — all content is shown read-only.</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-surface-700 bg-surface-900/50 hover:border-surface-600 transition-colors cursor-pointer">
                <input type="checkbox" checked={showcaseScript} onChange={(e) => setShowcaseScript(e.target.checked)} className="rounded border-surface-600" />
                <div>
                  <span className="text-sm font-medium text-surface-300">Share Script</span>
                  <p className="text-[11px] text-surface-500">Visitors can read the full screenplay.</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-surface-700 bg-surface-900/50 hover:border-surface-600 transition-colors cursor-pointer">
                <input type="checkbox" checked={showcaseMindmap} onChange={(e) => setShowcaseMindmap(e.target.checked)} className="rounded border-surface-600" />
                <div>
                  <span className="text-sm font-medium text-surface-300">Share Mind Map</span>
                  <p className="text-[11px] text-surface-500">Show your ideas and thought connections.</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-surface-700 bg-surface-900/50 hover:border-surface-600 transition-colors cursor-pointer">
                <input type="checkbox" checked={showcaseMoodboard} onChange={(e) => setShowcaseMoodboard(e.target.checked)} className="rounded border-surface-600" />
                <div>
                  <span className="text-sm font-medium text-surface-300">Share Moodboard</span>
                  <p className="text-[11px] text-surface-500">Display your visual inspiration board.</p>
                </div>
              </label>
            </div>
          </Card>

          {/* Set Photos */}
          <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg font-semibold text-white mb-2">Set Photos</h2>
            <p className="text-sm text-surface-400 mb-4">Add behind-the-scenes and set photos with optional descriptions.</p>
            <div className="space-y-4">
              {setPhotos.map((photo, idx) => (
                <div key={idx} className="rounded-lg border border-surface-700 bg-surface-900/50 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {/* Preview */}
                    {photo.url && (
                      <div className="w-24 h-16 rounded-lg overflow-hidden bg-surface-800 shrink-0">
                        <img src={photo.url} alt={photo.caption || `Set photo ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <Input
                        value={photo.url}
                        onChange={(e) => {
                          const updated = [...setPhotos];
                          updated[idx] = { ...updated[idx], url: e.target.value };
                          setSetPhotos(updated);
                        }}
                        placeholder="https://example.com/photo.jpg"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={photo.scene || ''}
                          onChange={(e) => {
                            const updated = [...setPhotos];
                            updated[idx] = { ...updated[idx], scene: e.target.value };
                            setSetPhotos(updated);
                          }}
                          placeholder="Scene (e.g. INT. CAFE - DAY)"
                        />
                        <Input
                          value={photo.context || ''}
                          onChange={(e) => {
                            const updated = [...setPhotos];
                            updated[idx] = { ...updated[idx], context: e.target.value };
                            setSetPhotos(updated);
                          }}
                          placeholder="Context (e.g. Behind the scenes)"
                        />
                      </div>
                      <Input
                        value={photo.caption || ''}
                        onChange={(e) => {
                          const updated = [...setPhotos];
                          updated[idx] = { ...updated[idx], caption: e.target.value };
                          setSetPhotos(updated);
                        }}
                        placeholder="Caption / description..."
                      />
                    </div>
                    <button
                      onClick={() => setSetPhotos(setPhotos.filter((_, i) => i !== idx))}
                      className="p-1.5 text-surface-500 hover:text-red-400 transition-colors shrink-0 mt-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setSetPhotos([...setPhotos, { url: '', caption: '', scene: '', context: '' }])}
                className="text-sm text-[#FF5F1F] hover:text-[#FF8F5F] transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add photo
              </button>
            </div>
          </Card>

          {/* External Links */}
          <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg font-semibold text-white mb-2">External Links</h2>
            <p className="text-sm text-surface-400 mb-4">Link to IMDB, TMDB, Letterboxd, or your official website.</p>
            <div className="space-y-3">
              {(['imdb', 'tmdb', 'letterboxd', 'website'] as const).map((key) => (
                <Input
                  key={key}
                  label={key === 'tmdb' ? 'TMDB' : key === 'imdb' ? 'IMDB' : key.charAt(0).toUpperCase() + key.slice(1)}
                  value={externalLinks[key] || ''}
                  onChange={(e) => setExternalLinks({ ...externalLinks, [key]: e.target.value })}
                  placeholder={`https://${key === 'imdb' ? 'www.imdb.com/title/tt...' : key === 'tmdb' ? 'www.themoviedb.org/movie/...' : key === 'letterboxd' ? 'letterboxd.com/film/...' : 'yoursite.com'}`}
                />
              ))}
            </div>
          </Card>

          {/* Production Trivia */}
          <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg font-semibold text-white mb-2">Production Trivia</h2>
            <p className="text-sm text-surface-400 mb-4">Share behind-the-scenes facts, fun stories, and production insights.</p>
            <div className="space-y-3">
              {productionTrivia.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-surface-700 bg-surface-900/50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={item.title}
                      onChange={(e) => {
                        const updated = [...productionTrivia];
                        updated[idx] = { ...updated[idx], title: e.target.value };
                        setProductionTrivia(updated);
                      }}
                      placeholder="e.g. Filming took only 3 days"
                      className="flex-1"
                    />
                    <button
                      onClick={() => setProductionTrivia(productionTrivia.filter((_, i) => i !== idx))}
                      className="p-1.5 text-surface-500 hover:text-red-400 transition-colors shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  <Textarea
                    value={item.content}
                    onChange={(e) => {
                      const updated = [...productionTrivia];
                      updated[idx] = { ...updated[idx], content: e.target.value };
                      setProductionTrivia(updated);
                    }}
                    placeholder="Tell the story behind this fact..."
                    rows={2}
                  />
                </div>
              ))}
              <button
                onClick={() => setProductionTrivia([...productionTrivia, { title: '', content: '' }])}
                className="text-sm text-[#FF5F1F] hover:text-[#FF8F5F] transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add trivia item
              </button>
            </div>
          </Card>
        </>
      )}

      {/* Save */}
      <div className="flex items-center gap-3 mb-8">
        <Button onClick={handleSave} loading={saving}>
          {saved ? '✓ Saved' : 'Save Showcase Settings'}
        </Button>
        {saved && <span className="text-sm text-green-400">Changes saved successfully</span>}
      </div>
    </div>
  );
}
