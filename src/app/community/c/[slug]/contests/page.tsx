'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubCommunity } from '@/lib/SubCommunityContext';
import { Avatar, Button, Input, Modal, LoadingSpinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { SubCommunityContest, SubCommunityContestEntry } from '@/lib/types';

type ExtEntry = SubCommunityContestEntry & {
  user: { id: string; full_name: string | null; avatar_url: string | null } | null;
  has_voted: boolean;
};
type Phase = 'upcoming' | 'active' | 'voting' | 'completed' | 'cancelled';

function getPhase(c: SubCommunityContest): Phase {
  if (c.status === 'cancelled') return 'cancelled';
  const now = Date.now();
  if (new Date(c.starts_at).getTime() > now) return 'upcoming';
  if (new Date(c.ends_at).getTime() > now)   return 'active';
  if (c.voting_ends_at && new Date(c.voting_ends_at).getTime() > now) return 'voting';
  return 'completed';
}

const PHASE_STYLE: Record<Phase, string> = {
  upcoming:  'bg-blue-500/20 text-blue-400',
  active:    'bg-green-500/20 text-green-400',
  voting:    'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-white/10 text-white/40',
  cancelled: 'bg-red-500/15 text-red-500/70',
};
const PHASE_LABEL: Record<Phase, string> = {
  upcoming: 'Upcoming', active: 'Active', voting: 'Voting',
  completed: 'Completed', cancelled: 'Cancelled',
};
const MEDALS = ['🥇', '🥈', '🥉'];

export default function ContestsPage() {
  const { community, isMod } = useSubCommunity();
  const { user } = useAuth();
  const accent = community.accent_color ?? '#FF5F1F';

  const [contests,   setContests]   = useState<SubCommunityContest[]>([]);
  const [entriesMap, setEntriesMap] = useState<Record<string, ExtEntry[]>>({});
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [cTitle,   setCTitle]   = useState('');
  const [cDesc,    setCDesc]    = useState('');
  const [cRules,   setCRules]   = useState('');
  const [cPrize,   setCPrize]   = useState('');
  const [cStart,   setCStart]   = useState('');
  const [cEnd,     setCEnd]     = useState('');
  const [cVEnd,    setCVEnd]    = useState('');
  const [cMaxPer,  setCMaxPer]  = useState(1);
  const [creating, setCreating] = useState(false);
  const [createErr,setCreateErr]= useState('');

  // Enter form
  const [showEnter,  setShowEnter]  = useState<string | null>(null);
  const [entryTitle, setEntryTitle] = useState('');
  const [entryBody,  setEntryBody]  = useState('');
  const [entering,   setEntering]   = useState(false);
  const [enterErr,   setEnterErr]   = useState('');

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: cList } = await sb
      .from('sub_community_contests')
      .select('*, creator:created_by(id,full_name,avatar_url)')
      .eq('community_id', community.id)
      .order('created_at', { ascending: false });

    const list = (cList ?? []) as SubCommunityContest[];
    setContests(list);

    if (!list.length) { setLoading(false); return; }

    const allEntriesRes = await Promise.all(
      list.map(c => sb
        .from('sub_community_contest_entries')
        .select('id, contest_id, user_id, title, body, vote_count, created_at, user:user_id(id,full_name,avatar_url)')
        .eq('contest_id', c.id)
        .order('vote_count', { ascending: false })
      )
    );

    const allEntryRows: ExtEntry[] = allEntriesRes.flatMap(r => (r.data ?? []) as unknown as ExtEntry[]);
    const entryIds = allEntryRows.map(e => e.id);

    let votedIds = new Set<string>();
    if (entryIds.length && user) {
      const { data: voteRows } = await sb
        .from('sub_community_contest_votes')
        .select('entry_id')
        .eq('user_id', user.id)
        .in('entry_id', entryIds);
      votedIds = new Set((voteRows ?? []).map(v => v.entry_id));
    }

    const map: Record<string, ExtEntry[]> = {};
    for (const c of list) {
      map[c.id] = allEntryRows
        .filter(e => e.contest_id === c.id)
        .map(e => ({ ...e, has_voted: votedIds.has(e.id) }));
    }
    setEntriesMap(map);
    setLoading(false);
  }, [community.id, user]);

  useEffect(() => { load(); }, [load]);

  const createContest = async () => {
    setCreateErr('');
    if (!user || !cTitle.trim()) return;
    if (!cStart) { setCreateErr('Start date is required'); return; }
    if (!cEnd)   { setCreateErr('End date is required');   return; }
    setCreating(true);
    const { error } = await createClient().from('sub_community_contests').insert({
      community_id: community.id, created_by: user.id,
      title: cTitle.trim(), description: cDesc.trim() || null,
      rules_markdown: cRules.trim() || null, prize: cPrize.trim() || null,
      starts_at: new Date(cStart).toISOString(), ends_at: new Date(cEnd).toISOString(),
      voting_ends_at: cVEnd ? new Date(cVEnd).toISOString() : null,
      max_entries_per_user: cMaxPer,
    });
    setCreating(false);
    if (error) { setCreateErr(error.message); return; }
    setCTitle(''); setCDesc(''); setCRules(''); setCPrize('');
    setCStart(''); setCEnd(''); setCVEnd(''); setCMaxPer(1);
    setShowCreate(false); load();
  };

  const submitEntry = async () => {
    if (!user || !showEnter || !entryTitle.trim()) return;
    setEnterErr('');
    setEntering(true);
    const { error } = await createClient().from('sub_community_contest_entries').insert({
      contest_id: showEnter, user_id: user.id,
      title: entryTitle.trim(), body: entryBody.trim() || null,
    });
    setEntering(false);
    if (error) {
      setEnterErr(error.code === '23505' ? 'You have already entered this contest.' : error.message);
      return;
    }
    setEntryTitle(''); setEntryBody(''); setShowEnter(null); load();
  };

  const toggleVote = async (entry: ExtEntry) => {
    if (!user) return;
    const sb = createClient();
    if (entry.has_voted) {
      await sb.from('sub_community_contest_votes').delete().eq('entry_id', entry.id).eq('user_id', user.id);
      await sb.from('sub_community_contest_entries').update({ vote_count: Math.max(0, (entry.vote_count ?? 1) - 1) }).eq('id', entry.id);
    } else {
      await sb.from('sub_community_contest_votes').insert({ entry_id: entry.id, user_id: user.id });
      await sb.from('sub_community_contest_entries').update({ vote_count: (entry.vote_count ?? 0) + 1 }).eq('id', entry.id);
    }
    load();
  };

  const deleteContest = async (id: string) => {
    if (!confirm('Delete this contest and all entries?')) return;
    await createClient().from('sub_community_contests').delete().eq('id', id);
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold">Contests</h2>
          <p className="text-xs text-white/40 mt-0.5">Community writing challenges &amp; competitions</p>
        </div>
        {isMod && <Button onClick={() => setShowCreate(true)}>+ New Contest</Button>}
      </div>

      {contests.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-white/40 text-sm">No contests yet.{isMod ? ' Create the first one!' : ' Check back soon.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contests.map(contest => {
            const phase   = getPhase(contest);
            const entries = entriesMap[contest.id] ?? [];
            const top3    = entries.slice(0, 3);
            const isExp   = expanded === contest.id;
            const myEntry = user ? entries.find(e => e.user_id === user.id) : null;
            const canEnter = phase === 'active' && !!user && !myEntry;
            const canVote  = phase === 'voting'  && !!user;
            const display  = isExp ? entries : top3;

            return (
              <div key={contest.id} className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="p-4 pb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide', PHASE_STYLE[phase])}>
                          {PHASE_LABEL[phase]}
                        </span>
                        {contest.prize && <span className="text-[10px] text-amber-400/70">🏅 {contest.prize}</span>}
                        <span className="text-[10px] text-white/25">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
                      </div>
                      <h3 className="text-sm font-bold mb-1">{contest.title}</h3>
                      {contest.description && <p className="text-xs text-white/50 line-clamp-2">{contest.description}</p>}
                      <div className="flex gap-4 mt-1.5 text-[10px] text-white/25">
                        <span>Opens {new Date(contest.starts_at).toLocaleDateString()}</span>
                        <span>Closes {new Date(contest.ends_at).toLocaleDateString()}</span>
                        {contest.voting_ends_at && <span>Vote by {new Date(contest.voting_ends_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      {canEnter && (
                        <button onClick={() => { setShowEnter(contest.id); setEntryTitle(''); setEntryBody(''); setEnterErr(''); }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white hover:opacity-90 transition-opacity"
                          style={{ background: accent }}>
                          Enter →
                        </button>
                      )}
                      {myEntry && (
                        <span className="text-[10px] px-2 py-1 rounded-lg font-medium" style={{ background: accent + '22', color: accent }}>
                          ✓ Entered
                        </span>
                      )}
                      {isMod && (
                        <button onClick={() => deleteContest(contest.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors" title="Delete contest">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {entries.length > 0 && (
                  <div className="border-t border-white/5 px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        {phase === 'completed' ? 'Final Results' : phase === 'voting' ? 'Vote for your favourite' : 'Entries'}
                      </p>
                      {entries.length > 3 && (
                        <button onClick={() => setExpanded(isExp ? null : contest.id)}
                          className="text-[10px] text-white/40 hover:text-white/70">
                          {isExp ? 'Show less ↑' : `See all ${entries.length} ↓`}
                        </button>
                      )}
                    </div>
                    {display.map((entry, i) => (
                      <div key={entry.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                        style={{
                          background: entry.user_id === user?.id ? (accent + '11') : 'rgba(255,255,255,0.03)',
                          border: entry.user_id === user?.id ? `1px solid ${accent}30` : '1px solid transparent',
                        }}>
                        {phase !== 'active' && (
                          <span className="text-sm w-5 text-center shrink-0">
                            {i < 3 ? MEDALS[i] : `${i + 1}.`}
                          </span>
                        )}
                        <Avatar src={entry.user?.avatar_url} name={entry.user?.full_name ?? undefined} size="sm" className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white/90 truncate">{entry.title ?? 'Untitled entry'}</p>
                          <p className="text-[10px] text-white/30">{entry.user?.full_name ?? 'Anonymous'}</p>
                        </div>
                        <button
                          onClick={() => canVote && toggleVote(entry)}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-all shrink-0',
                            entry.has_voted ? 'font-semibold' : 'opacity-50',
                            canVote ? 'hover:opacity-80 cursor-pointer' : 'cursor-default',
                          )}
                          style={entry.has_voted ? { background: accent + '33', color: accent } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                          ▲ {entry.vote_count ?? 0}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {entries.length === 0 && phase === 'active' && (
                  <div className="border-t border-white/5 px-4 py-4 text-center">
                    <p className="text-xs text-white/30">No entries yet — be the first!</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create contest modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Contest">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Title <span className="text-red-400">*</span></label>
            <Input value={cTitle} onChange={e => setCTitle(e.target.value)} placeholder="e.g. 5-Page Screenplay Challenge" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Description</label>
            <textarea value={cDesc} onChange={e => setCDesc(e.target.value)} rows={2}
              placeholder="What is this contest about?"
              className="w-full px-3 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-sm text-white resize-none focus:outline-none placeholder-surface-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Rules (Markdown)</label>
            <textarea value={cRules} onChange={e => setCRules(e.target.value)} rows={3}
              placeholder="- Rule 1&#10;- Rule 2"
              className="w-full px-3 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-sm text-white font-mono resize-none focus:outline-none placeholder-surface-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Prize</label>
            <Input value={cPrize} onChange={e => setCPrize(e.target.value)} placeholder="e.g. 1-month Pro subscription" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[['Starts *', cStart, setCStart], ['Ends *', cEnd, setCEnd], ['Voting ends', cVEnd, setCVEnd]].map(([label, val, setter]) => (
              <div key={label as string}>
                <label className="block text-[11px] text-surface-400 mb-1">{label as string}</label>
                <input type="datetime-local" value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)}
                  className="w-full px-2 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs text-white focus:outline-none" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Max entries per user</label>
            <Input type="number" value={String(cMaxPer)} onChange={e => setCMaxPer(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          {createErr && <p className="text-xs text-red-400">{createErr}</p>}
          <div className="flex gap-2 pt-1">
            <Button onClick={createContest} disabled={!cTitle.trim() || creating} className="flex-1">
              {creating ? 'Creating…' : 'Create Contest'}
            </Button>
            <Button variant="secondary" onClick={() => { setShowCreate(false); setCreateErr(''); }}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Enter contest modal */}
      <Modal
        isOpen={!!showEnter}
        onClose={() => { setShowEnter(null); setEnterErr(''); }}
        title={`Enter: ${contests.find(c => c.id === showEnter)?.title ?? 'Contest'}`}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Entry Title <span className="text-red-400">*</span></label>
            <Input value={entryTitle} onChange={e => setEntryTitle(e.target.value)} placeholder="Title of your entry" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Content <span className="text-surface-500">(optional)</span></label>
            <textarea value={entryBody} onChange={e => setEntryBody(e.target.value)} rows={6}
              placeholder="Paste your screenplay pages, synopsis, or description…"
              className="w-full px-3 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-sm text-white resize-none focus:outline-none placeholder-surface-500" />
          </div>
          {enterErr && <p className="text-xs text-red-400">{enterErr}</p>}
          <div className="flex gap-2 pt-1">
            <Button onClick={submitEntry} disabled={!entryTitle.trim() || entering} className="flex-1">
              {entering ? 'Submitting…' : 'Submit Entry'}
            </Button>
            <Button variant="secondary" onClick={() => { setShowEnter(null); setEnterErr(''); }}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
