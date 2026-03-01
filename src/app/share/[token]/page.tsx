'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Input, LoadingPage, toast } from '@/components/ui';
import type { ExternalShare, ReviewSession } from '@/lib/types';

// ============================================================
// Public Share Viewer — external stakeholders view shared content
// No authentication required.
// ============================================================

export default function ShareViewerPage({ params }: { params: { token: string } }) {
  const [share, setShare] = useState<ExternalShare | null>(null);
  const [project, setProject] = useState<{ title: string; logline?: string; genre?: string[]; format?: string; cover_url?: string } | null>(null);
  const [scriptContent, setScriptContent] = useState<{ title?: string; content: { type?: string; text: string }[] | string }[]>([]);
  const [scriptElements, setScriptElements] = useState<{ type?: string; text: string }[]>([]);
  const [shots, setShots] = useState<{ id: string; scene_id?: string; image_url?: string; description?: string; shot_type?: string; shot_size?: string }[]>([]);
  const [scenes, setScenes] = useState<{ id: string; scene_heading?: string; scene_number?: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; location_type?: string; description?: string; address?: string; photos?: string[] }[]>([]);
  const [characters, setCharacters] = useState<{ id: string; name: string; avatar_url?: string; is_main?: boolean; description?: string; age?: string; role_type?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  // Review state
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);
  const [overallRating, setOverallRating] = useState(0);
  const [overallNotes, setOverallNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchShare(); }, [params.token]);

  const fetchShare = async () => {
    try {
      const supabase = createClient();
      // Fetch via RPC or direct select (public access needed)
      const { data, error: fetchErr } = await supabase
        .from('external_shares')
        .select('*')
        .eq('access_token', params.token)
        .eq('is_active', true)
        .maybeSingle();

      if (fetchErr || !data) {
        setError('This share link is invalid or has been deactivated.');
        setLoading(false);
        return;
      }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError('This share link has expired.');
        setLoading(false);
        return;
      }

      // Check max views
      if (data.max_views && data.view_count >= data.max_views) {
        setError('This share link has reached its maximum number of views.');
        setLoading(false);
        return;
      }

      setShare(data);

      // Check if password protected
      if (data.password_hash) {
        setLoading(false);
        return;
      }

      setAuthenticated(true);
      await loadContent(data, supabase);
    } catch {
      setError('Something went wrong loading this share.');
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!share) return;
    // Simple check (in production, use bcrypt)
    if (btoa(passwordInput) !== share.password_hash) {
      setError('Incorrect password');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setAuthenticated(true);
    setLoading(true);
    const supabase = createClient();
    await loadContent(share, supabase);
  };

  const loadContent = async (shareData: ExternalShare, supabase: ReturnType<typeof createClient>) => {
    try {
      // Increment view count
      supabase.from('external_shares').update({
        view_count: (shareData.view_count || 0) + 1,
      }).eq('id', shareData.id).then(() => {});

      // Use snapshot data stored at share creation time
      if (shareData.content_snapshot) {
        const snap = shareData.content_snapshot as Record<string, unknown>;
        if (snap.project) setProject(snap.project as typeof project);
        if (snap.scripts) setScriptContent(snap.scripts as typeof scriptContent);
        if (snap.script_elements) setScriptElements(snap.script_elements as typeof scriptElements);
        if (snap.shots) setShots(snap.shots as typeof shots);
        if (snap.scenes) setScenes(snap.scenes as typeof scenes);
        if (snap.locations) setLocations(snap.locations as typeof locations);
        if (snap.characters) setCharacters(snap.characters as typeof characters);
      }
    } catch (err) {
      console.error('Error loading content:', err);
    } finally {
      setLoading(false);
    }
  };

  const startReview = async () => {
    if (!share || !reviewerName.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase.from('review_sessions').insert({
      share_id: share.id,
      project_id: share.project_id,
      reviewer_name: reviewerName.trim(),
      reviewer_email: reviewerEmail.trim() || null,
      status: 'in_progress',
    }).select().single();
    if (error) { toast.error('Failed to start review session'); return; }
    if (data) setReviewSession(data);
    setShowReviewForm(false);
  };

  const submitReview = async () => {
    if (!reviewSession) return;
    setSubmitting(true);
    const supabase = createClient();
    await supabase.from('review_sessions').update({
      status: 'submitted',
      overall_rating: overallRating || null,
      overall_notes: overallNotes.trim() || null,
      submitted_at: new Date().toISOString(),
    }).eq('id', reviewSession.id);
    setReviewSession({ ...reviewSession, status: 'submitted' });
    setSubmitting(false);
  };

  if (loading) return <LoadingPage />;

  if (error && !share) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-black text-white mb-2">Link Unavailable</h1>
          <p className="text-sm text-surface-400">{error}</p>
        </Card>
      </div>
    );
  }

  // Password gate
  if (share && !authenticated) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <Card className="p-8 max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="text-3xl mb-3">🔒</div>
            <h1 className="text-xl font-black text-white mb-1">Password Protected</h1>
            <p className="text-sm text-surface-400">Enter the password to view this content.</p>
          </div>
          {error && <p className="text-sm text-red-400 text-center mb-3">{error}</p>}
          <Input
            type="password"
            value={passwordInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordInput(e.target.value)}
            placeholder="Enter password"
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handlePasswordSubmit()}
          />
          <Button className="w-full mt-3" onClick={handlePasswordSubmit}>Access</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <div className="border-b border-surface-800 bg-surface-950 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {share?.branding?.logo_url ? (
              <img src={share.branding.logo_url} alt={'Branding logo'} className="h-8 w-auto" />
            ) : (
              <div className="w-8 h-8 bg-[#E54E15] rounded-lg flex items-center justify-center text-xs font-bold text-white">
                SS
              </div>
            )}
            <div>
              <h1 className="text-sm font-semibold text-white">{share?.title || project?.title || 'Shared Content'}</h1>
              {share?.branding?.company_name && (
                <p className="text-[11px] text-surface-500">{share.branding.company_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {share?.allow_comments && !reviewSession && (
              <Button size="sm" variant="secondary" onClick={() => setShowReviewForm(true)}>
                Leave Feedback
              </Button>
            )}
            {reviewSession && reviewSession.status !== 'submitted' && (
              <Button size="sm" onClick={submitReview} loading={submitting}>
                Submit Review
              </Button>
            )}
            {reviewSession?.status === 'submitted' && (
              <span className="text-xs text-green-400 font-medium">✓ Review Submitted</span>
            )}
          </div>
        </div>
      </div>

      {/* Watermark overlay */}
      {share?.watermark_text && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden opacity-[0.04]">
          <div className="text-8xl font-bold text-white whitespace-nowrap rotate-[-30deg] select-none">
            {share.watermark_text}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Project header */}
        {project && (
          <div className="mb-8">
            <h2 className="text-2xl font-black text-white mb-1">{project.title}</h2>
            {project.logline && <p className="text-surface-400">{project.logline}</p>}
            {project.genre && <p className="text-xs text-surface-500 mt-2">{Array.isArray(project.genre) ? project.genre.join(', ') : project.genre} • {project.format}</p>}
          </div>
        )}

        {/* Script content — prefer script_elements over scripts.content */}
        {(scriptElements.length > 0 || scriptContent.length > 0) && (
          <div className="space-y-6">
            {scriptElements.length > 0 ? (
              <Card key="elements" className="p-6 sm:p-8">
                <div className="screenplay-content space-y-2">
                  {scriptElements.map((element, elIdx: number) => (
                    <div key={elIdx} className={`script-element ${element.type || 'action'}`}>
                      {element.type === 'scene_heading' && (
                        <p className="font-bold text-white uppercase tracking-wide mt-6">{element.text}</p>
                      )}
                      {element.type === 'action' && (
                        <p className="text-surface-300">{element.text}</p>
                      )}
                      {element.type === 'character' && (
                        <p className="text-center font-semibold text-white uppercase mt-4">{element.text}</p>
                      )}
                      {element.type === 'dialogue' && (
                        <p className="text-surface-300 mx-auto max-w-md text-center">{element.text}</p>
                      )}
                      {element.type === 'parenthetical' && (
                        <p className="text-surface-500 italic mx-auto max-w-sm text-center">({element.text})</p>
                      )}
                      {element.type === 'transition' && (
                        <p className="text-right text-surface-400 uppercase">{element.text}</p>
                      )}
                      {!['scene_heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition'].includes(element.type || '') && element.text && (
                        <p className="text-surface-400">{element.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              scriptContent.map((script, idx) => (
                <Card key={idx} className="p-6 sm:p-8">
                  {script.title && <h3 className="text-lg font-semibold text-white mb-4 pb-3 border-b border-surface-800">{script.title}</h3>}
                  <div className="screenplay-content space-y-2">
                    {Array.isArray(script.content) ? (
                      (script.content as { type?: string; text: string }[]).map((element, elIdx: number) => (
                        <div key={elIdx} className={`script-element ${element.type || 'action'}`}>
                          {element.type === 'scene_heading' && <p className="font-bold text-white uppercase tracking-wide">{element.text}</p>}
                          {element.type === 'action' && <p className="text-surface-300">{element.text}</p>}
                          {element.type === 'character' && <p className="text-center font-semibold text-white uppercase mt-4">{element.text}</p>}
                          {element.type === 'dialogue' && <p className="text-surface-300 mx-auto max-w-md text-center">{element.text}</p>}
                          {element.type === 'parenthetical' && <p className="text-surface-500 italic mx-auto max-w-sm text-center">({element.text})</p>}
                          {element.type === 'transition' && <p className="text-right text-surface-400 uppercase">{element.text}</p>}
                          {!['scene_heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition'].includes(element.type || '') && <p className="text-surface-400">{element.text}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-surface-400 whitespace-pre-wrap">{typeof script.content === 'string' ? script.content : JSON.stringify(script.content, null, 2)}</p>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Storyboard content */}
        {shots.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Storyboard</h3>
            {(() => {
              // Group shots by scene
              const sceneMap = new Map<string, any>();
              for (const s of scenes) sceneMap.set(s.id, s);
              const grouped = new Map<string, any[]>();
              for (const shot of shots) {
                const key = shot.scene_id || 'unassigned';
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(shot);
              }
              return Array.from(grouped.entries()).map(([sceneId, sceneShots]) => {
                const scene = sceneMap.get(sceneId);
                return (
                  <Card key={sceneId} className="p-5">
                    {scene && (
                      <h4 className="text-sm font-semibold text-white mb-3">
                        {scene.scene_heading || `Scene ${scene.scene_number}`}
                      </h4>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {sceneShots.map((shot) => (
                        <div key={shot.id} className="rounded-lg border border-surface-800 overflow-hidden">
                          {shot.image_url ? (
                            <img src={shot.image_url} alt={shot.description || ''} className="w-full aspect-video object-cover" />
                          ) : (
                            <div className="w-full aspect-video bg-surface-800 flex items-center justify-center text-surface-600 text-xs">
                              No image
                            </div>
                          )}
                          <div className="p-2">
                            <p className="text-xs font-medium text-surface-300">
                              {[shot.shot_type, shot.shot_size].filter(Boolean).join(' — ') || 'Shot'}
                            </p>
                            {shot.description && <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-2">{shot.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              });
            })()}
          </div>
        )}

        {/* Locations / Moodboard content */}
        {locations.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Locations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {locations.map((loc) => (
                <Card key={loc.id} className="p-4">
                  <h4 className="text-sm font-semibold text-white">{loc.name}</h4>
                  {loc.location_type && <p className="text-xs text-surface-500 mt-0.5">{loc.location_type}</p>}
                  {loc.description && <p className="text-sm text-surface-400 mt-2">{loc.description}</p>}
                  {loc.address && <p className="text-xs text-surface-500 mt-1">{loc.address}</p>}
                  {loc.photos && loc.photos.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto">
                      {loc.photos.slice(0, 4).map((photo: string, i: number) => (
                        <img key={i} src={photo} alt={`Location photo ${i + 1}`} className="w-24 h-16 object-cover rounded" />
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Characters (full project share) */}
        {characters.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Characters</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.map((char) => (
                <Card key={char.id} className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    {char.avatar_url ? (
                      <img src={char.avatar_url} alt={char.name || 'Character avatar'} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center text-sm font-bold text-white">
                        {char.name?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-semibold text-white">{char.name}</h4>
                      <div className="flex items-center gap-2">
                        {char.is_main && <span className="text-[10px] text-amber-400 font-medium">Lead</span>}
                        {char.age && <span className="text-[10px] text-surface-500">{char.age}</span>}
                        {(char as any).gender && <span className="text-[10px] text-surface-500">{(char as any).gender}</span>}
                      </div>
                    </div>
                  </div>
                  {char.description && <p className="text-sm text-surface-400 line-clamp-3">{char.description}</p>}
                  {(char as any).cast_actor && <p className="text-xs text-[#FF5F1F] mt-2">Actor: {(char as any).cast_actor}</p>}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No content fallback */}
        {scriptContent.length === 0 && scriptElements.length === 0 && shots.length === 0 && locations.length === 0 && characters.length === 0 && (
          <Card className="p-12 text-center">
            <div className="text-4xl mb-4">📄</div>
            <h3 className="text-lg font-semibold text-white mb-2">No content available</h3>
            <p className="text-surface-400 text-sm">This share link doesn't contain any viewable content yet. The project owner may need to re-create the share link.</p>
          </Card>
        )}

        {/* Review rating */}
        {reviewSession && reviewSession.status !== 'submitted' && (
          <Card className="p-6 mt-8 border border-[#FF5F1F]/20">
            <h3 className="text-lg font-semibold text-white mb-4">Your Review</h3>
            <div className="mb-4">
              <label className="block text-sm text-surface-300 mb-2">Overall Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setOverallRating(star)}
                    className={`text-2xl transition-colors ${star <= overallRating ? 'text-amber-400' : 'text-surface-700 hover:text-surface-500'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-surface-300 mb-2">Notes</label>
              <textarea
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white resize-none"
                placeholder="Share your overall thoughts..."
              />
            </div>
            <Button onClick={submitReview} loading={submitting}>Submit Review</Button>
          </Card>
        )}
      </div>

      {/* Review form modal */}
      {showReviewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowReviewForm(false)}>
          <div onClick={(e) => e.stopPropagation()}>
                <Card className="p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Start Your Review</h3>
            <div className="space-y-3">
              <Input label="Your Name" value={reviewerName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReviewerName(e.target.value)} placeholder="Jane Smith" />
              <Input label="Email (optional)" type="email" value={reviewerEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReviewerEmail(e.target.value)} placeholder="jane@company.com" />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="secondary" onClick={() => setShowReviewForm(false)}>Cancel</Button>
              <Button onClick={startReview} disabled={!reviewerName.trim()}>Start Reviewing</Button>
            </div>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}
