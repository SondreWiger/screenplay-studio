'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Badge, Card, Select } from '@/components/ui';
import type { Badge as BadgeType } from '@/lib/types';

export function BadgesAdminTab() {
  const supabase = createClient();
  const [badges, setBadges] = useState<BadgeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', emoji: '🏅', description: '', color: '#6366F1' });
  const [saving, setSaving] = useState(false);
  const [awardForm, setAwardForm] = useState<{ badgeId: string; username: string }>({ badgeId: '', username: '' });
  const [awardMsg, setAwardMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('badges').select('*').order('is_system', { ascending: false }).order('created_at');
    setBadges((data as BadgeType[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await supabase.from('badges').insert({ name: form.name.trim(), emoji: form.emoji, description: form.description, color: form.color, is_system: false });
    setForm({ name: '', emoji: '🏅', description: '', color: '#6366F1' });
    setSaving(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this badge? It will be removed from all users.')) return;
    await supabase.from('user_badges').delete().eq('badge_id', id);
    await supabase.from('badges').delete().eq('id', id);
    load();
  };

  const handleAward = async () => {
    if (!awardForm.badgeId || !awardForm.username.trim()) return;
    setAwardMsg(null);
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .or(`username.eq.${awardForm.username.trim()},email.eq.${awardForm.username.trim()}`)
      .maybeSingle();
    if (!profile) { setAwardMsg('User not found.'); return; }
    const { error } = await supabase.from('user_badges').upsert({ user_id: profile.id, badge_id: awardForm.badgeId }, { onConflict: 'user_id,badge_id' });
    setAwardMsg(error ? `Error: ${error.message}` : 'Badge awarded!');
    setAwardForm(p => ({ ...p, username: '' }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Badge Management</h2>
        <p className="text-sm text-white/40">Create custom badges and award them to users. System badges (Admin, Moderator, Contributor) are managed automatically by user roles.</p>
      </div>

      {/* Existing Badges */}
      <Card className="bg-white/5 border border-white/10 p-6">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-[0.04em] mb-4">All Badges</h3>
        {loading ? (
          <p className="text-white/40 text-sm">Loading…</p>
        ) : (
          <div className="space-y-3">
            {badges.map(badge => (
              <div key={badge.id} className="flex items-center justify-between gap-4 bg-white/5 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: badge.color + '33', color: badge.color }}
                  >
                    <span>{badge.emoji}</span>
                    <span>{badge.name}</span>
                  </span>
                  {badge.is_system && (
                    <span className="text-xs text-white/30 italic">system</span>
                  )}
                  {badge.description && (
                    <span className="text-xs text-white/40">{badge.description}</span>
                  )}
                </div>
                {!badge.is_system && (
                  <button
                    onClick={() => handleDelete(badge.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Badge */}
      <Card className="bg-white/5 border border-white/10 p-6">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-[0.04em] mb-4">Create New Badge</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Badge Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Early Adopter"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Emoji</label>
            <input
              value={form.emoji}
              onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))}
              maxLength={4}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Description</label>
            <input
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
              />
              <span className="text-sm text-white/50">{form.color}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          {form.name && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: form.color + '33', color: form.color }}
            >
              <span>{form.emoji}</span>
              <span>{form.name}</span>
            </span>
          )}
          <button
            onClick={handleCreate}
            disabled={saving || !form.name.trim()}
            className="ml-auto px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-brand-500/80 transition-colors"
          >
            {saving ? 'Creating…' : 'Create Badge'}
          </button>
        </div>
      </Card>

      {/* Award Badge */}
      <Card className="bg-white/5 border border-white/10 p-6">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-[0.04em] mb-4">Award Badge to User</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/50 mb-1">Badge</label>
            <select
              value={awardForm.badgeId}
              onChange={e => setAwardForm(p => ({ ...p, badgeId: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40"
            >
              <option value="">Select a badge…</option>
              {badges.filter(b => !b.is_system).map(b => (
                <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Username or Email</label>
            <input
              value={awardForm.username}
              onChange={e => setAwardForm(p => ({ ...p, username: e.target.value }))}
              placeholder="username or email"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
            />
          </div>
        </div>
        {awardMsg && (
          <p className={`mt-2 text-sm ${awardMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{awardMsg}</p>
        )}
        <button
          onClick={handleAward}
          disabled={!awardForm.badgeId || !awardForm.username.trim()}
          className="mt-4 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-brand-500/80 transition-colors"
        >
          Award Badge
        </button>
      </Card>
    </div>
  );
}
export default BadgesAdminTab;
