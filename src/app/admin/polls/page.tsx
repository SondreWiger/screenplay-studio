'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { BarChart3, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, timeAgo } from '@/lib/utils';
import type { PollSession } from '@/lib/types';
import {
  ActionButton, AdminPage, AnimatedItem, AnimatedList, BarList, Dialog, Dots, EmptyState, Field, PageHeader, Panel,
  Pill, SearchInput, Segmented, StatGrid, TabSkeleton, Toolbar, TrendPanel, fieldClass, type Tone,
} from '@/components/admin/kit';

const STATUS_TONE: Record<string, Tone> = { draft: 'neutral', review: 'amber', published: 'green', closed: 'violet' };
type Filter = 'all' | 'draft' | 'review' | 'published' | 'closed';
type Sort = 'newest' | 'responses';

export default function AdminPollsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<PollSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPreface, setNewPreface] = useState('');
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [query, setQuery] = useState('');

  const isAdmin = user && (user.id === 'f0e0c4a4-0833-4c64-b012-15829c087c77' || user.role === 'admin');

  useEffect(() => {
    if (!authLoading && !isAdmin) { router.push('/admin'); return; }
    if (!isAdmin) return;
    fetch('/api/admin/polls')
      .then((r) => r.json())
      .then((d) => { setSessions(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isAdmin, authLoading, router]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    const res = await fetch('/api/admin/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, preface: newPreface }),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) router.push(`/admin/polls/${data.id}`);
  };

  const counts = useMemo(() => {
    const c = { all: sessions.length, draft: 0, review: 0, published: 0, closed: 0, responses: 0 };
    sessions.forEach((s) => {
      if (s.status in c) c[s.status as Exclude<Filter, 'all'>]++;
      c.responses += s.response_count || 0;
    });
    return c;
  }, [sessions]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter((s) => filter === 'all' || s.status === filter)
      .filter((s) => !q || `${s.title} ${s.preface || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (sort === 'responses' ? (b.response_count || 0) - (a.response_count || 0) : b.created_at.localeCompare(a.created_at)));
  }, [sessions, filter, query, sort]);

  if (authLoading || loading) return <TabSkeleton />;

  const toggle = (f: Filter) => () => setFilter((cur) => (cur === f ? 'all' : f));
  const live = sessions.filter((s) => s.status === 'published' || s.status === 'closed');
  const avgResponses = live.length ? counts.responses / live.length : 0;

  return (
    <AdminPage>
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Polls"
        description="Ask the community, then read the results."
        actions={<ActionButton variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>New poll</ActionButton>}
      />

      <StatGrid
        cols={5}
        layoutGroup="polls"
        items={[
          { label: 'All polls', value: counts.all, tone: 'brand', onClick: () => setFilter('all'), active: filter === 'all' },
          { label: 'Published', value: counts.published, tone: 'green', onClick: toggle('published'), active: filter === 'published' },
          { label: 'In review', value: counts.review, tone: 'amber', onClick: toggle('review'), active: filter === 'review' },
          { label: 'Drafts', value: counts.draft, tone: 'neutral', onClick: toggle('draft'), active: filter === 'draft' },
          { label: 'Total responses', value: counts.responses, tone: 'blue', hint: `${avgResponses.toFixed(1)} per published poll` },
        ]}
      />

      {sessions.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-5">
          <TrendPanel
            id="polls"
            className="lg:col-span-3"
            title="Poll activity"
            subtitle="Polls created and published over time"
            sources={[
              { key: 'created', label: 'Created', rows: sessions, time: (s) => s.created_at },
              { key: 'published', label: 'Published', rows: sessions, time: (s) => s.published_at },
            ]}
            defaultRange="90d"
          />
          <Panel title="Most answered" subtitle="Responses per poll" className="lg:col-span-2">
            <BarList
              items={[...live].sort((a, b) => (b.response_count || 0) - (a.response_count || 0)).slice(0, 6).map((s) => ({ label: s.title, count: s.response_count || 0 }))}
              empty="No published polls yet"
              labelFormat={(l) => <span className="normal-case">{l}</span>}
            />
          </Panel>
        </div>
      )}

      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search polls…" />
        <Segmented id="polls-sort" value={sort} onChange={setSort} options={[{ key: 'newest', label: 'Newest' }, { key: 'responses', label: 'Most responses' }]} />
      </Toolbar>

      {visible.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title={sessions.length === 0 ? 'No polls yet' : 'No polls match'}
          description={sessions.length === 0 ? 'Create one to start collecting answers.' : 'Try a different search or filter.'}
          action={sessions.length === 0 ? <ActionButton variant="primary" onClick={() => setShowCreate(true)}>Create a poll</ActionButton> : undefined}
        />
      ) : (
        <AnimatedList className="grid gap-3 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {visible.map((s) => (
              <AnimatedItem key={s.id}>
                <Link
                  href={`/admin/polls/${s.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-surface-800 bg-surface-900/60 p-4 transition-all hover:-translate-y-0.5 hover:border-surface-700 hover:shadow-lg hover:shadow-black/30"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Pill tone={STATUS_TONE[s.status] ?? 'neutral'} dot>{s.status}</Pill>
                    {s.questions && <span className="text-[11px] text-surface-500">{s.questions.length} question{s.questions.length !== 1 ? 's' : ''}</span>}
                    <span className="ml-auto text-[11px] text-surface-600" title={formatDate(s.created_at)}>{timeAgo(s.created_at)}</span>
                  </div>
                  <h2 className="truncate font-semibold text-white transition-colors group-hover:text-brand-300">{s.title}</h2>
                  {s.preface && <p className="mt-1 line-clamp-2 text-sm text-surface-400">{s.preface}</p>}
                  {(s.status === 'published' || s.status === 'closed') && (
                    <div className="mt-auto flex items-baseline gap-1.5 pt-3">
                      <span className="text-xl font-bold tabular-nums text-white">{(s.response_count || 0).toLocaleString()}</span>
                      <span className="text-[11px] text-surface-500">responses</span>
                    </div>
                  )}
                </Link>
              </AnimatedItem>
            ))}
          </AnimatePresence>
        </AnimatedList>
      )}

      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New poll"
        description="You can add questions on the next screen."
        footer={
          <>
            <ActionButton variant="ghost" onClick={() => setShowCreate(false)}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
              {creating ? <>Creating <Dots /></> : 'Create & edit'}
            </ActionButton>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title">
            <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} placeholder="What should we work on next?" className={fieldClass} />
          </Field>
          <Field label="Preface" hint="(optional intro shown to users)">
            <textarea rows={3} value={newPreface} onChange={(e) => setNewPreface(e.target.value)} placeholder="We want to hear your thoughts on what to build next…" className={`${fieldClass} resize-none`} />
          </Field>
        </div>
      </Dialog>
    </AdminPage>
  );
}
