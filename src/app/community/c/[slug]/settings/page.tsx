'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubCommunity } from '@/lib/SubCommunityContext';
import type { SubCommunityRule, SubCommunityMember, AutomodFlag, CommunityPost } from '@/lib/types';
import { cn } from '@/lib/utils';

type Tab = 'appearance' | 'rules' | 'members' | 'automod' | 'pending';

const ICON_OPTIONS   = ['🎬','🎭','🎞️','📝','✍️','🌍','🦁','🚀','🎸','📚','🔮','🦋','⚡','🌊','🎨','🏆'];
const ACCENT_PRESETS = ['#FF5F1F','#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6'];

export default function SettingsPage() {
  const { community, isMod, refetch } = useSubCommunity();
  const { user }   = useAuth();
  const router     = useRouter();
  const accent     = community.accent_color ?? '#FF5F1F';

  const [tab, setTab] = useState<Tab>('appearance');

  // Redirect non-mods
  useEffect(() => { if (!isMod) router.replace(`/community/c/${community.slug}`); }, [isMod]);

  // Appearance state
  const [name,          setName]          = useState(community.name);
  const [desc,          setDesc]          = useState(community.description ?? '');
  const [longDesc,      setLongDesc]      = useState(community.long_description ?? '');
  const [icon,          setIcon]          = useState(community.icon ?? '🎬');
  const [accentColor,   setAccentColor]   = useState(accent);
  const [visibility,    setVisibility]    = useState(community.visibility ?? 'public');
  const [postingMode,   setPostingMode]   = useState(community.posting_mode ?? 'open');
  const [automodEnabled,setAutomodEnabled]= useState(community.automod_enabled ?? true);
  const [discordInviteUrl, setDiscordInviteUrl] = useState(community.discord_invite_url ?? '');
  const [discordServerId,  setDiscordServerId]  = useState(community.discord_server_id  ?? '');
  const [chatMode,      setChatMode]      = useState<'chat' | 'discord_only'>(community.chat_mode ?? 'chat');
  const [saving,        setSaving]        = useState(false);

  // Rules
  const [rules,    setRules]    = useState<SubCommunityRule[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc2, setNewDesc2] = useState('');

  // Members
  const [members, setMembers] = useState<SubCommunityMember[]>([]);
  const [memberQ, setMemberQ] = useState('');

  // Automod flags
  const [flags, setFlags] = useState<AutomodFlag[]>([]);

  // Pending posts
  const [pendingPosts, setPendingPosts] = useState<CommunityPost[]>([]);

  const loadAll = async () => {
    const sb = createClient();
    const [{ data: r }, { data: m }, { data: f }, { data: p }] = await Promise.all([
      sb.from('sub_community_rules').select('*').eq('community_id', community.id).order('sort_order'),
      sb.from('sub_community_members').select('*, user:user_id(id,full_name,avatar_url)').eq('community_id', community.id),
      sb.from('automod_flags').select('*').eq('community_id', community.id).eq('resolved', false).order('created_at', { ascending: false }),
      sb.from('community_posts').select('*, author:user_id(id,full_name)').eq('sub_community_id', community.id).eq('mod_status', 'pending'),
    ]);
    setRules(r ?? []);
    setMembers(m ?? []);
    setFlags(f ?? []);
    setPendingPosts(p ?? []);
  };

  useEffect(() => { if (isMod) loadAll(); }, [isMod, community.id]);

  const saveAppearance = async () => {
    setSaving(true);
    const sb = createClient();
    await sb.from('sub_communities').update({
      name: name.trim(), description: desc.trim() || null, long_description: longDesc.trim() || null,
      icon, accent_color: accentColor, accent_color2: accentColor,
      visibility, posting_mode: postingMode, automod_enabled: automodEnabled,
      discord_invite_url: discordInviteUrl.trim() || null,
      discord_server_id:  discordServerId.trim()  || null,
      chat_mode: chatMode,
    }).eq('id', community.id);
    setSaving(false);
    refetch();
  };

  const addRule = async () => {
    if (!newTitle.trim()) return;
    const sb = createClient();
    await sb.from('sub_community_rules').insert({
      community_id: community.id, title: newTitle.trim(),
      description: newDesc2.trim() || null, sort_order: rules.length,
    });
    setNewTitle(''); setNewDesc2('');
    loadAll();
  };

  const deleteRule = async (id: string) => {
    await createClient().from('sub_community_rules').delete().eq('id', id);
    loadAll();
  };

  const updateMemberRole = async (memberId: string, role: string) => {
    await createClient().from('sub_community_members').update({
      role, can_post: ['member','moderator','admin'].includes(role),
    }).eq('id', memberId);
    loadAll();
  };

  const resolveFlag = async (id: string) => {
    await createClient().from('automod_flags').update({ resolved: true, resolved_by: user?.id }).eq('id', id);
    loadAll();
  };

  const moderatePost = async (id: string, status: 'approved' | 'rejected') => {
    await createClient().from('community_posts').update({ mod_status: status }).eq('id', id);
    loadAll();
  };

  const filteredMembers = members.filter(m => {
    const u = (m as any).user;
    return !memberQ || u?.full_name?.toLowerCase().includes(memberQ.toLowerCase());
  });

  if (!isMod) return null;

  return (
    <div>
      {/* Tab nav */}
      <div className="flex gap-1 mb-6 p-0.5 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {(['appearance','rules','members','automod','pending'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-all',
              tab === t ? 'text-white' : 'text-white/40 hover:text-white/70')}
            style={tab === t ? { background: accentColor + '33', color: accentColor } : undefined}>
            {t}
            {t === 'pending' && pendingPosts.length > 0 && (
              <span className="ml-1 px-1 text-[9px] rounded-full bg-yellow-500/30 text-yellow-400">{pendingPosts.length}</span>
            )}
            {t === 'automod' && flags.length > 0 && (
              <span className="ml-1 px-1 text-[9px] rounded-full bg-red-500/30 text-red-400">{flags.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Appearance */}
      {tab === 'appearance' && (
        <div className="max-w-md space-y-5">
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-2">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map(i => (
                <button key={i} type="button" onClick={() => setIcon(i)}
                  className={cn('w-9 h-9 text-xl rounded-xl transition-all', icon === i ? 'ring-2 scale-110' : 'opacity-40 hover:opacity-70')}
                  style={{ background: icon === i ? accentColor + '33' : 'rgba(255,255,255,0.05)' }}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">Short Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} maxLength={500} className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">Long Description</label>
            <textarea value={longDesc} onChange={e => setLongDesc(e.target.value)} rows={4} className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none resize-none" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-2">Accent Colour</label>
            <div className="flex flex-wrap gap-2 items-center">
              {ACCENT_PRESETS.map(c => (
                <button key={c} type="button" onClick={() => setAccentColor(c)}
                  className={cn('w-7 h-7 rounded-full border-2 transition-all hover:scale-110', accentColor === c ? 'border-white scale-110' : 'border-transparent')}
                  style={{ background: c }} />
              ))}
              <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="w-7 h-7 rounded-full cursor-pointer border-0 bg-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">Visibility</label>
              <select value={visibility} onChange={e => setVisibility(e.target.value as any)}
                className="w-full px-3 py-2 text-sm text-white rounded-xl outline-none cursor-pointer" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <option value="public">Public</option>
                <option value="restricted">Restricted</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">Posting Mode</label>
              <select value={postingMode} onChange={e => setPostingMode(e.target.value as any)}
                className="w-full px-3 py-2 text-sm text-white rounded-xl outline-none cursor-pointer" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <option value="open">Open</option>
                <option value="require_approval">Require Approval</option>
                <option value="apply_to_post">Apply to Post</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setAutomodEnabled(v => !v)}
              className={cn('w-9 h-5 rounded-full relative transition-all', automodEnabled ? '' : 'bg-white/20')}
              style={automodEnabled ? { background: accentColor } : {}}>
              <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all', automodEnabled ? 'left-4' : 'left-0.5')} />
            </div>
            <span className="text-sm">Automod Enabled</span>
          </label>

          {/* Discord integration */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(88,101,242,0.08)', border: '1px solid rgba(88,101,242,0.2)' }}>
            <div className="flex items-center gap-2 mb-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.035.056a19.909 19.909 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span className="text-xs font-bold text-[#7289da] uppercase tracking-wider">Discord Integration</span>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">Invite URL <span className="normal-case text-white/25">(e.g. https://discord.gg/abc123)</span></label>
              <input
                value={discordInviteUrl}
                onChange={e => setDiscordInviteUrl(e.target.value)}
                placeholder="https://discord.gg/…"
                className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-1.5">Server ID <span className="normal-case text-white/25">(numeric guild ID for embed widget)</span></label>
              <input
                value={discordServerId}
                onChange={e => setDiscordServerId(e.target.value)}
                placeholder="e.g. 1234567890123456789"
                className="w-full px-3 py-2.5 text-sm text-white rounded-xl outline-none"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              />
              <p className="mt-1 text-[11px] text-white/25">Found in Discord Server Settings → Widget. Required for the live member count embed.</p>
            </div>
            {/* Chat mode */}
            <div className="pt-1 border-t border-white/10">
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest block mb-2">Chat Tab Behaviour</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setChatMode('chat')}
                  className={cn('flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-colors',
                    chatMode === 'chat' ? 'text-white border-transparent' : 'border-white/10 text-white/40 hover:text-white/70')}
                  style={chatMode === 'chat' ? { background: accentColor } : undefined}>
                  💬 Built-in chat
                </button>
                <button type="button" onClick={() => setChatMode('discord_only')}
                  className={cn('flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-colors',
                    chatMode === 'discord_only' ? 'text-white border-transparent' : 'border-white/10 text-white/40 hover:text-white/70')}
                  style={chatMode === 'discord_only' ? { background: '#5865F2' } : undefined}>
                  <svg className="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.035.056a19.909 19.909 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                  Discord only
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-white/25">
                {chatMode === 'discord_only'
                  ? 'The Chat tab will show a \"Join Discord\" card instead of built-in channels.'
                  : 'The Chat tab shows the built-in Discord-style channel chat.'}
              </p>
            </div>
          </div>
          <button onClick={saveAppearance} disabled={saving}
            className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-40 hover:opacity-90 transition"
            style={{ background: accentColor }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Rules */}
      {tab === 'rules' && (
        <div className="max-w-md space-y-4">
          {rules.map((rule, i) => (
            <div key={rule.id} className="flex items-start gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-xs font-bold w-5 text-white/40 pt-0.5">{i+1}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{rule.title}</p>
                {rule.description && <p className="text-xs text-white/40 mt-0.5">{rule.description}</p>}
              </div>
              <button onClick={() => deleteRule(rule.id)} className="text-white/20 hover:text-red-400 transition text-xs">✕</button>
            </div>
          ))}
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="New rule title *"
              className="w-full px-3 py-2 text-sm text-white placeholder:text-white/25 rounded-lg outline-none" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <input value={newDesc2} onChange={e => setNewDesc2(e.target.value)} placeholder="Description (optional)"
              className="w-full px-3 py-2 text-sm text-white placeholder:text-white/25 rounded-lg outline-none" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <button onClick={addRule} disabled={!newTitle.trim()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40 hover:opacity-90" style={{ background: accentColor }}>
              Add Rule
            </button>
          </div>
        </div>
      )}

      {/* Members */}
      {tab === 'members' && (
        <div className="space-y-3">
          <input value={memberQ} onChange={e => setMemberQ(e.target.value)} placeholder="Search members…"
            className="px-3 py-2 text-sm text-white placeholder:text-white/25 rounded-xl outline-none w-64" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="space-y-2">
            {filteredMembers.map(m => {
              const u = (m as any).user;
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {u?.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold" style={{ background: accentColor + '33', color: accentColor }}>{u?.full_name?.[0] ?? '?'}</div>
                  }
                  <p className="flex-1 text-sm">{u?.full_name ?? 'User'}</p>
                  <select value={m.role} onChange={e => updateMemberRole(m.id, e.target.value)}
                    className="text-xs px-2 py-1 rounded-lg outline-none cursor-pointer capitalize" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                    <option value="member">Member</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                    <option value="pending_approval">Pending</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Automod */}
      {tab === 'automod' && (
        <div className="space-y-3">
          {flags.length === 0 ? (
            <p className="text-sm text-white/40">No unresolved flags. ✅</p>
          ) : flags.map(f => (
            <div key={f.id} className="flex items-start gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded uppercase flex-shrink-0 mt-0.5',
                f.severity === 'critical' ? 'bg-red-600/30 text-red-300'
                : f.severity === 'high'   ? 'bg-red-500/20 text-red-400'
                : f.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400'
                                          : 'bg-white/10 text-white/40')}>
                {f.severity}
              </span>
              <div className="flex-1">
                <p className="text-xs text-white/70">{f.reason}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{f.content_type} · {new Date(f.created_at!).toLocaleString()}</p>
              </div>
              <button onClick={() => resolveFlag(f.id)} className="text-xs px-2 py-1 rounded-lg hover:opacity-80" style={{ background: accentColor + '33', color: accentColor }}>Resolve</button>
            </div>
          ))}
        </div>
      )}

      {/* Pending posts */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {pendingPosts.length === 0 ? (
            <p className="text-sm text-white/40">No pending posts.</p>
          ) : pendingPosts.map(p => (
            <div key={p.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-sm font-medium">{p.title}</p>
              {p.description && <p className="text-xs text-white/50 mt-1 line-clamp-2">{p.description}</p>}
              <p className="text-[10px] text-white/30 mt-1.5">by {(p as any).author?.full_name ?? 'Anonymous'} · {new Date(p.created_at!).toLocaleDateString()}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => moderatePost(p.id, 'approved')}
                  className="px-3 py-1 text-xs font-semibold rounded-lg" style={{ background: '#10b98133', color: '#10b981' }}>Approve</button>
                <button onClick={() => moderatePost(p.id, 'rejected')}
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-500/20 text-red-400">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
