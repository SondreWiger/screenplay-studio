'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const ACCENT_PRESETS = ['#FF5F1F','#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6'];
const ICON_OPTIONS   = ['🎬','🎭','🎞️','📝','✍️','🌍','🦁','🚀','🎸','📚','🔮','🦋','⚡','🌊','🎨','🏆'];

export default function CreateCommunityPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [name,        setName]     = useState('');
  const [slug,        setSlug]     = useState('');
  const [slugEdited,  setSlugyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [icon,        setIcon]     = useState('🎬');
  const [accent,      setAccent]   = useState('#FF5F1F');
  const [visibility,  setVisibility]  = useState<'public'|'restricted'|'private'>('public');
  const [postingMode, setPostingMode] = useState<'open'|'require_approval'|'apply_to_post'>('open');
  const [saving,      setSaving]   = useState(false);
  const [error,       setError]    = useState('');

  const onNameChange = (v: string) => {
    setName(v);
    if (!slugEdited)
      setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('Sign in to create a community'); return; }
    if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
      setError('Slug must be 3–30 lowercase letters, numbers, or hyphens'); return;
    }
    setSaving(true); setError('');
    try {
      const sb = createClient();
      const { data: existing } = await sb.from('sub_communities').select('id').eq('slug', slug).single();
      if (existing) { setError('That slug is already taken. Try another.'); return; }

      const { data, error: err } = await sb.from('sub_communities').insert({
        slug, name: name.trim(),
        description: description.trim() || null,
        icon, accent_color: accent, accent_color2: accent,
        visibility, posting_mode: postingMode,
        created_by: user.id,
      }).select().single();

      if (err) throw err;

      // Auto-join creator as admin
      await sb.from('sub_community_members').insert({
        community_id: data.id, user_id: user.id, role: 'admin', can_post: true,
      });

      router.push(`/community/c/${slug}`);
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#070710' }}>
      <p className="text-white/40 text-sm">Sign in to create a community.</p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#070710', color: '#fff' }}>
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="mb-8">
          <p className="text-[10px] font-mono text-[#FF5F1F] uppercase tracking-widest mb-1">New Community</p>
          <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.03em' }}>CREATE YOUR SPACE</h1>
          <p className="text-white/40 text-sm mt-1">Build a community for writers who share your passion.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Icon */}
          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map(i => (
                <button key={i} type="button" onClick={() => setIcon(i)}
                  className={cn('w-9 h-9 text-xl rounded-xl transition-all', icon === i ? 'ring-2 scale-110' : 'opacity-40 hover:opacity-70')}
                  style={{ background: icon === i ? accent + '33' : 'rgba(255,255,255,0.05)', outlineColor: accent }}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">Community Name *</label>
            <input required value={name} onChange={e => onNameChange(e.target.value)} maxLength={80}
              placeholder="Screenplay Writers"
              className="w-full px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 rounded-xl outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }} />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">URL Slug *</label>
            <div className="flex items-center rounded-xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <span className="pl-3.5 text-white/30 text-sm shrink-0">c/</span>
              <input required value={slug}
                onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugyEdited(true); }}
                maxLength={30} placeholder="screenplay-writers"
                className="flex-1 px-1 py-2.5 text-sm text-white bg-transparent outline-none" />
            </div>
            <p className="text-[10px] text-white/25 mt-1">3–30 chars. Cannot be changed later.</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={500}
              placeholder="What's this community about?"
              className="w-full px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 rounded-xl outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }} />
          </div>

          {/* Accent colour */}
          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Accent Colour</label>
            <div className="flex items-center gap-2 flex-wrap">
              {ACCENT_PRESETS.map(c => (
                <button key={c} type="button" onClick={() => setAccent(c)}
                  className={cn('w-7 h-7 rounded-full border-2 transition-all hover:scale-110',
                    accent === c ? 'border-white scale-110' : 'border-transparent')}
                  style={{ background: c }} />
              ))}
              <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer border-0 bg-transparent" title="Custom colour" />
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Visibility</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['public',     '🌍', 'Anyone can discover it'],
                ['restricted', '🔒', 'Must join to post'],
                ['private',    '🔑', 'Invite only'],
              ] as const).map(([v, ico, desc]) => (
                <button key={v} type="button" onClick={() => setVisibility(v)}
                  className={cn('p-2.5 rounded-xl text-left transition-all', visibility === v ? '' : 'opacity-50 hover:opacity-75')}
                  style={visibility === v
                    ? { background: accent + '22', border: `1px solid ${accent}` }
                    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-base mb-1">{ico}</div>
                  <p className="text-[11px] font-semibold text-white capitalize">{v}</p>
                  <p className="text-[10px] text-white/35 leading-tight">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Posting mode */}
          <div>
            <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Posting Mode</label>
            <div className="space-y-2">
              {([
                ['open',             '✍️', 'Any member can post immediately'],
                ['require_approval', '👁️', 'Mods approve each post first'],
                ['apply_to_post',    '📬', 'Users must apply before posting'],
              ] as const).map(([v, ico, desc]) => (
                <button key={v} type="button" onClick={() => setPostingMode(v)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all', postingMode === v ? '' : 'opacity-50 hover:opacity-75')}
                  style={postingMode === v
                    ? { background: accent + '22', border: `1px solid ${accent}` }
                    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-base">{ico}</span>
                  <div>
                    <p className="text-xs font-semibold text-white">{v.replace(/_/g,' ')}</p>
                    <p className="text-[10px] text-white/35">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2.5 rounded-xl">{error}</p>
          )}

          <button type="submit" disabled={saving || !name.trim() || !slug}
            className="w-full py-3 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-40 hover:opacity-90"
            style={{ background: accent }}>
            {saving ? 'Creating…' : `Create c/${slug || '…'}`}
          </button>
        </form>
      </div>
    </div>
  );
}
