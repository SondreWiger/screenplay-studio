'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Input, Modal, Toggle, toast, ToastContainer } from '@/components/ui';
import type { ExternalShare } from '@/lib/types';

// ============================================================
// External Share Portal — Pro feature
// Create secure, branded links to share project content externally
// ============================================================

const SHARE_TYPES = [
  { value: 'script', label: 'Script', desc: 'Share the full script for reading', icon: '📝' },
  { value: 'storyboard', label: 'Storyboard', desc: 'Visual storyboard and shot plans', icon: '🖼️' },
  { value: 'moodboard', label: 'Mood Board', desc: 'Visual references and inspiration', icon: '🎨' },
  { value: 'full', label: 'Full Project', desc: 'Script, storyboard, characters, and locations', icon: '📦' },
] as const;

export default function SharePortalPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { isPro, hasExternalShares } = useProFeatures();
  const { currentProject } = useProjectStore();
  const [shares, setShares] = useState<ExternalShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [shareType, setShareType] = useState<string>('script');
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [allowComments, setAllowComments] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [watermark, setWatermark] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [maxViews, setMaxViews] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchShares(); }, [params.id]);

  const fetchShares = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('external_shares')
      .select('*')
      .eq('project_id', params.id)
      .order('created_at', { ascending: false });
    setShares(data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    const supabase = createClient();

    // Snapshot project + content so the public viewer doesn't need auth
    let contentSnapshot: any = {};
    try {
      const { data: proj } = await supabase
        .from('projects')
        .select('title, logline, genre, format, cover_url, custom_branding')
        .eq('id', params.id)
        .single();
      contentSnapshot.project = proj || {};

      if (['script', 'full'].includes(shareType)) {
        // Get scripts
        const { data: scripts } = await supabase
          .from('scripts')
          .select('id, title, content, updated_at')
          .eq('project_id', params.id)
          .order('created_at', { ascending: true });
        contentSnapshot.scripts = scripts || [];

        // Get actual script_elements for rich content
        if (scripts && scripts.length > 0) {
          const { data: elements } = await supabase
            .from('script_elements')
            .select('element_type, content, sort_order, scene_number')
            .eq('script_id', scripts[0].id)
            .eq('is_omitted', false)
            .order('sort_order');

          // Derive character names positionally for the snapshot
          const enriched: any[] = [];
          let charName: string | null = null;
          for (const e of (elements || [])) {
            if (e.element_type === 'character') {
              charName = (e.content || '').replace(/\s*\(.*\)\s*$/, '').trim();
            }
            enriched.push({
              type: e.element_type,
              text: e.content,
              scene_number: e.scene_number,
              character_name: e.element_type === 'dialogue' || e.element_type === 'parenthetical' ? charName : null,
            });
            if (e.element_type !== 'dialogue' && e.element_type !== 'parenthetical' && e.element_type !== 'character') {
              charName = null;
            }
          }
          contentSnapshot.script_elements = enriched;
        }
      }

      if (['storyboard', 'full'].includes(shareType)) {
        const { data: shots } = await supabase
          .from('shots')
          .select('id, scene_id, shot_type, shot_size, description, image_url, sort_order, notes')
          .eq('project_id', params.id)
          .order('sort_order');
        contentSnapshot.shots = shots || [];

        const { data: scenes } = await supabase
          .from('scenes')
          .select('id, scene_number, scene_heading, location_type, time_of_day')
          .eq('project_id', params.id)
          .order('scene_number');
        contentSnapshot.scenes = scenes || [];
      }

      if (['moodboard', 'full'].includes(shareType)) {
        // Moodboard images are typically in project metadata or a dedicated table
        // Snapshot locations as visual reference data
        const { data: locations } = await supabase
          .from('locations')
          .select('id, name, description, address, photos, location_type')
          .eq('project_id', params.id);
        contentSnapshot.locations = locations || [];
      }

      if (shareType === 'full') {
        const { data: characters } = await supabase
          .from('characters')
          .select('id, name, full_name, description, age, gender, is_main, cast_actor, avatar_url, personality_traits')
          .eq('project_id', params.id)
          .order('is_main', { ascending: false })
          .order('name');
        contentSnapshot.characters = characters || [];
      }
    } catch (err) {
      console.error('Error snapshotting content:', err);
    }

    const { data, error } = await supabase.from('external_shares').insert({
      project_id: params.id,
      created_by: user.id,
      share_type: shareType,
      title: title.trim() || `${currentProject?.title || 'Project'} — ${SHARE_TYPES.find(s => s.value === shareType)?.label}`,
      allow_comments: allowComments,
      allow_download: allowDownload,
      watermark_text: watermark.trim() || null,
      expires_at: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : null,
      max_views: maxViews || null,
      branding: currentProject?.custom_branding || {},
      content_snapshot: contentSnapshot,
    }).select().single();

    if (error) {
      toast('Failed to create share link', 'error');
    } else if (data) {
      // If password needed, hash it (simple for now — in production, use bcrypt)
      if (password.trim()) {
        await supabase.from('external_shares').update({
          password_hash: btoa(password.trim()), // Simple encoding for dev — use bcrypt in prod
        }).eq('id', data.id);
      }
      toast('Share link created!', 'success');
      setShowCreate(false);
      resetForm();
      fetchShares();
    }
    setCreating(false);
  };

  const handleToggleActive = async (share: ExternalShare) => {
    const supabase = createClient();
    await supabase.from('external_shares').update({
      is_active: !share.is_active,
      updated_at: new Date().toISOString(),
    }).eq('id', share.id);
    fetchShares();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this share link? External reviewers will lose access.')) return;
    const supabase = createClient();
    await supabase.from('external_shares').delete().eq('id', id);
    fetchShares();
    toast('Share link deleted');
  };

  const getShareUrl = (token: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/share/${token}`;
    }
    return `/share/${token}`;
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getShareUrl(token));
    toast('Link copied to clipboard!', 'success');
  };

  const resetForm = () => {
    setShareType('script');
    setTitle('');
    setPassword('');
    setAllowComments(true);
    setAllowDownload(false);
    setWatermark('');
    setExpiresInDays(null);
    setMaxViews(null);
  };

  const hasProAccess = isPro || currentProject?.pro_enabled === true;

  if (!hasProAccess) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md p-8 text-center">
          <div className="text-4xl mb-4">
            <svg className="w-12 h-12 mx-auto text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Share Portal</h2>
          <p className="text-sm text-surface-400 mb-4">Create secure, branded links to share project content with external stakeholders.</p>
          <Badge variant="warning">Pro Feature</Badge>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-4xl">
      <ToastContainer />
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-white">Share Portal</h1>
            <Badge variant="warning">⭐ Pro</Badge>
          </div>
          <p className="text-sm text-surface-400 mt-1">Create secure, branded links to share project content with external stakeholders.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Share Link
        </Button>
      </div>

      {/* Existing shares */}
      {shares.length > 0 ? (
        <div className="space-y-3">
          {shares.map((share) => {
            const isExpired = share.expires_at && new Date(share.expires_at) < new Date();
            const isMaxed = share.max_views && share.view_count >= share.max_views;
            const isLive = share.is_active && !isExpired && !isMaxed;
            return (
              <Card key={share.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{SHARE_TYPES.find(s => s.value === share.share_type)?.icon || '📤'}</span>
                      <h3 className="text-sm font-semibold text-white truncate">{share.title || 'Untitled Share'}</h3>
                      <Badge variant={isLive ? 'success' : 'error'}>
                        {isLive ? 'Live' : isExpired ? 'Expired' : isMaxed ? 'Max views' : 'Paused'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-surface-500 mb-2">
                      <span>{share.view_count} views{share.max_views ? ` / ${share.max_views} max` : ''}</span>
                      {share.expires_at && <span>Expires {new Date(share.expires_at).toLocaleDateString()}</span>}
                      {share.password_hash && <span>🔒 Password</span>}
                      {share.watermark_text && <span>💧 Watermark</span>}
                      {share.allow_comments && <span>💬 Comments</span>}
                      {share.allow_download && <span>📥 Download</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-surface-400 bg-surface-800/50 px-2 py-1 rounded font-mono truncate max-w-xs">
                        {getShareUrl(share.access_token)}
                      </code>
                      <button onClick={() => copyLink(share.access_token)} className="text-xs text-[#FF5F1F] hover:text-[#FF8F5F] whitespace-nowrap">
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleActive(share)}
                      className={`p-2 rounded-lg transition-colors ${share.is_active ? 'text-green-400 hover:bg-green-500/10' : 'text-surface-500 hover:bg-surface-800'}`}
                      title={share.is_active ? 'Pause' : 'Activate'}
                    >
                      {share.is_active ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      )}
                    </button>
                    <button onClick={() => handleDelete(share.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-4">📤</div>
          <h3 className="text-lg font-semibold text-white mb-2">No share links yet</h3>
          <p className="text-sm text-surface-400 mb-4">Create a secure link to share your script, storyboard, or full project with clients and stakeholders.</p>
          <Button onClick={() => setShowCreate(true)}>Create First Share Link</Button>
        </Card>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal isOpen onClose={() => setShowCreate(false)} title="Create Share Link" size="lg">
          <div className="space-y-5 p-1">
            {/* Share type */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">What to share</label>
              <div className="grid grid-cols-2 gap-2">
                {SHARE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setShareType(t.value)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      shareType === t.value ? 'border-[#FF5F1F] bg-[#FF5F1F]/10' : 'border-surface-700 hover:border-surface-600'
                    }`}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <p className="text-sm font-medium text-white mt-1">{t.label}</p>
                    <p className="text-[11px] text-surface-500">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <Input label="Title (optional)" value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder={`${currentProject?.title || 'Project'} — Script`} />

            {/* Security */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Password (optional)" type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} placeholder="Leave blank for no password" />
              <Input label="Watermark text (optional)" value={watermark} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWatermark(e.target.value)} placeholder="e.g. CONFIDENTIAL" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Expires after</label>
                <select
                  value={expiresInDays ?? ''}
                  onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white"
                >
                  <option value="">Never</option>
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Max views</label>
                <select
                  value={maxViews ?? ''}
                  onChange={(e) => setMaxViews(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white"
                >
                  <option value="">Unlimited</option>
                  <option value="1">1 view</option>
                  <option value="5">5 views</option>
                  <option value="10">10 views</option>
                  <option value="50">50 views</option>
                  <option value="100">100 views</option>
                </select>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-6">
              <Toggle checked={allowComments} onChange={setAllowComments} label="Allow comments" size="sm" />
              <Toggle checked={allowDownload} onChange={setAllowDownload} label="Allow download" size="sm" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} loading={creating}>Create Share Link</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
