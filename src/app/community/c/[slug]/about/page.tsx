'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSubCommunity } from '@/lib/SubCommunityContext';
import type { SubCommunityRule, SubCommunityMember } from '@/lib/types';

export default function CommunityAboutPage() {
  const { community } = useSubCommunity();
  const [rules, setRules]   = useState<SubCommunityRule[]>([]);
  const [staff, setStaff]   = useState<SubCommunityMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const sb = createClient();
      const [{ data: r }, { data: s }] = await Promise.all([
        sb.from('sub_community_rules').select('*').eq('community_id', community.id).order('sort_order'),
        sb.from('sub_community_members')
          .select('*, user:user_id(id,full_name,avatar_url)')
          .eq('community_id', community.id)
          .in('role', ['admin','moderator']),
      ]);
      setRules(r ?? []);
      setStaff(s ?? []);
      setLoading(false);
    };
    load();
  }, [community.id]);

  const accent = community.accent_color ?? '#FF5F1F';

  if (loading) return (
    <div className="flex justify-center py-12">
      <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex gap-6">
      {/* Main */}
      <div className="flex-1 space-y-6">
        {community.long_description && (
          <section>
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">About</p>
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{community.long_description}</p>
          </section>
        )}

        {/* Rules */}
        <section>
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-3">Community Rules</p>
          {rules.length === 0 ? (
            <p className="text-sm text-white/30 italic">No rules posted yet.</p>
          ) : (
            <ol className="space-y-2">
              {rules.map((rule, i) => (
                <li key={rule.id} className="flex gap-3 rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-xs font-bold rounded-md"
                    style={{ background: accent + '33', color: accent }}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{rule.title}</p>
                    {rule.description && (
                      <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{rule.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Meta */}
        <section className="text-xs text-white/30 space-y-1">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2">Info</p>
          <p>Visibility: <span className="text-white/50 capitalize">{community.visibility}</span></p>
          <p>Posting: <span className="text-white/50">{community.posting_mode?.replace(/_/g,' ')}</span></p>
          <p>Created: <span className="text-white/50">{community.created_at ? new Date(community.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</span></p>
        </section>
      </div>

      {/* Sidebar — Staff */}
      <aside className="w-52 flex-shrink-0">
        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-3">Staff</p>
        <div className="space-y-2">
          {staff.length === 0 ? (
            <p className="text-xs text-white/30">No staff listed.</p>
          ) : (
            staff.map(m => {
              const u = (m as any).user;
              return (
                <div key={m.id} className="flex items-center gap-2.5 rounded-xl p-2"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {u?.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                        style={{ background: accent + '33', color: accent }}>
                        {u?.full_name?.[0] ?? '?'}
                      </div>
                  }
                  <div>
                    <p className="text-xs font-medium leading-tight">{u?.full_name ?? 'User'}</p>
                    <p className="text-[10px] text-white/40 capitalize">{m.role}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
