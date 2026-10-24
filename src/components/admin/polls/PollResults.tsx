'use client';

/**
 * Admin poll results: an overview (funnel, time spent, drop-off, sources),
 * per-question breakdowns that link through to who picked what, and a
 * people view with every respondent's answers, email and time spent.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Copy, Download, Filter, Mail, RefreshCw, Search, Users, X } from 'lucide-react';
import { timeAgo, formatDate } from '@/lib/utils';
import type { QuestionResult } from '@/components/PollResultChart';
import type { PollQuestion } from '@/lib/types';
import {
  formatDuration, respondentsToCSV,
  type Dropout, type PollAnalytics, type Respondent,
} from '@/lib/polls/analytics';
import {
  ActionButton, BarList, Dialog, EmptyState, Funnel, Panel, Pill, SERIES, Segmented, StatGrid, Toolbar, TrendPanel, type Tone,
} from '@/components/admin/kit';
import { CATEGORICAL } from '@/components/admin/charts';

export interface PollResultsData {
  results: QuestionResult[];
  respondents: Respondent[];
  dropouts: Dropout[];
  analytics: PollAnalytics;
}

type View = 'overview' | 'questions' | 'people';
type PeopleTab = 'finished' | 'unfinished';
type PeopleSort = 'newest' | 'oldest' | 'fastest' | 'slowest';

/** "Who picked X on question Y" — set from the Questions view, shown as a chip in People */
interface AnswerFilter { questionId: string; label: string }

const SOURCE_LABEL: Record<string, string> = {
  popup: 'Pop-up', link: 'Direct link', notification: 'Notification', email: 'Email', unknown: 'Before tracking',
};
const SOURCE_TONE: Record<string, Tone> = { popup: 'brand', link: 'blue', notification: 'violet', email: 'aqua' };

function answerMatches(r: Respondent, f: AnswerFilter): boolean {
  const a = r.answers[f.questionId];
  if (!a) return false;
  if (a.list) return a.list.includes(f.label);
  return (a.text ?? '').toLowerCase() === f.label.toLowerCase();
}

function answerToString(a: Respondent['answers'][string] | undefined): string {
  if (!a) return '';
  return a.list ? a.list.join(', ') : a.text ?? '';
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return url
    ? <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" loading="lazy" />
    : (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-800 text-xs font-semibold text-surface-300">
        {name.trim().charAt(0).toUpperCase() || '?'}
      </span>
    );
}

export function PollResults({ title, questions, data, onRefresh, refreshing, actions }: {
  title: string;
  questions: PollQuestion[];
  data: PollResultsData;
  onRefresh: () => void;
  refreshing: boolean;
  actions?: ReactNode;
}) {
  const [view, setView] = useState<View>('overview');
  const [filter, setFilter] = useState<AnswerFilter | null>(null);
  const [open, setOpen] = useState<Respondent | null>(null);

  const qIndex = useMemo(() => new Map(questions.map((q, i) => [q.id, i])), [questions]);
  const timing = useMemo(() => new Map(data.analytics.question_times.map((t) => [t.question_id, t])), [data.analytics]);

  const showWho = (questionId: string, label: string) => {
    setFilter({ questionId, label });
    setView('people');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          id="poll-results-view"
          value={view}
          onChange={setView}
          options={[
            { key: 'overview', label: 'Overview' },
            { key: 'questions', label: `Questions · ${questions.length}` },
            { key: 'people', label: `People · ${data.respondents.length}` },
          ]}
        />
        <div className="flex items-center gap-2">
          {actions}
          <ActionButton variant="ghost" icon={<RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />} onClick={onRefresh} disabled={refreshing}>
            Refresh
          </ActionButton>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
          {view === 'overview' && <Overview data={data} questions={questions} />}
          {view === 'questions' && (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.results.map((r) => (
                <QuestionCard
                  key={r.question_id}
                  index={qIndex.get(r.question_id) ?? 0}
                  result={r}
                  timing={timing.get(r.question_id)}
                  respondents={data.respondents}
                  onShowWho={(label) => showWho(r.question_id, label)}
                  onOpenPerson={setOpen}
                />
              ))}
            </div>
          )}
          {view === 'people' && (
            <People
              title={title}
              data={data}
              questions={questions}
              filter={filter}
              clearFilter={() => setFilter(null)}
              onOpen={setOpen}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <PersonDialog person={open} questions={questions} onClose={() => setOpen(null)} />
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────

function Overview({ data, questions }: { data: PollResultsData; questions: PollQuestion[] }) {
  const a = data.analytics;
  const completion = a.views > 0 ? Math.round((a.completed / a.views) * 100) : null;
  const stepLabel = (step: number) => step === 0
    ? 'Intro — never started'
    : `Q${step} · ${questions[step - 1]?.question_text ?? 'Removed question'}`;

  const timePerQuestion = questions
    .map((q, i) => ({ label: `Q${i + 1} · ${q.question_text}`, count: a.question_times.find((t) => t.question_id === q.id)?.median_ms ?? 0 }))
    .filter((x) => x.count > 0);

  return (
    <div className="space-y-5">
      <StatGrid
        cols={4}
        items={[
          { label: 'Responses', value: a.completed, tone: 'blue' },
          {
            label: 'Completion rate', value: completion ?? 0, tone: 'green',
            format: (n) => (completion == null ? '—' : `${Math.round(n)}%`),
            hint: `${a.completed} of ${a.views} who saw it`,
          },
          {
            label: 'Median time spent', value: a.median_ms ?? 0, tone: 'brand',
            format: (n) => (a.median_ms == null ? '—' : formatDuration(n)),
            hint: a.timed_responses ? `Avg ${formatDuration(a.avg_ms)} · 90% under ${formatDuration(a.p90_ms)}` : 'Timed from the next response on',
          },
          {
            label: "Didn't finish", value: data.dropouts.length, tone: 'amber',
            hint: a.dismissed ? `${a.dismissed} closed it with “Maybe later”` : undefined,
          },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title="Funnel" subtitle="Everyone the poll was shown to" className="lg:col-span-2">
          <Funnel
            steps={[
              { label: 'Saw it', value: a.views },
              { label: 'Started answering', value: a.started },
              { label: 'Finished', value: a.completed },
            ]}
          />
          {a.tracked_since && (
            <p className="mt-4 text-[11px] text-surface-500">Views tracked since {formatDate(a.tracked_since)}; earlier responses count as seen and started.</p>
          )}
        </Panel>
        <TrendPanel
          id="poll-responses"
          className="lg:col-span-3"
          title="Responses over time"
          subtitle="When people finished the poll"
          sources={[
            { key: 'finished', label: 'Finished', rows: data.respondents, time: (r: Respondent) => r.completed_at },
            { key: 'shown', label: 'First shown', color: SERIES.violet, rows: data.dropouts, time: (d: Dropout) => d.first_shown_at },
          ]}
          defaultRange="30d"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Time per question" subtitle="Median time spent on each" className="lg:col-span-2">
          <BarList
            items={timePerQuestion}
            color={SERIES.orange}
            format={(n) => formatDuration(n)}
            empty="No timings yet — they’re recorded from the next response on"
            labelFormat={(l) => <span className="normal-case">{l}</span>}
          />
        </Panel>
        <Panel title="Came from" subtitle="Where finished responses started">
          <BarList
            items={a.by_source.map((s) => ({ label: SOURCE_LABEL[s.label] ?? s.label, count: s.count }))}
            color={SERIES.violet}
            empty="No responses yet"
            labelFormat={(l) => <span className="normal-case">{l}</span>}
          />
        </Panel>
      </div>

      <Panel title="Where people stopped" subtitle="The last step reached by people who didn't finish">
        <BarList
          items={a.dropoff.map((d) => ({ label: stepLabel(d.step), count: d.count }))}
          color={SERIES.red}
          empty="Nobody has dropped out"
          labelFormat={(l) => <span className="normal-case">{l}</span>}
        />
      </Panel>
    </div>
  );
}

// ── Questions ────────────────────────────────────────────────────────

function QuestionCard({ index, result, timing, respondents, onShowWho, onOpenPerson }: {
  index: number;
  result: QuestionResult;
  timing?: PollAnalytics['question_times'][number];
  respondents: Respondent[];
  onShowWho: (label: string) => void;
  onOpenPerson: (r: Respondent) => void;
}) {
  const { question_type: type, total_answers: total } = result;
  const isText = type === 'short_text' || type === 'long_text';
  const isChoice = type === 'yes_no' || type === 'single_select' || type === 'multi_select';
  const textRows = isText
    ? respondents
      .map((r) => ({ r, text: r.answers[result.question_id]?.text?.trim() ?? '' }))
      .filter((x) => x.text)
    : [];
  const [allText, setAllText] = useState(false);
  const max = Math.max(1, ...result.option_counts.map((o) => o.count));

  return (
    <Panel
      title={<span className="flex gap-2"><span className="text-surface-500">Q{index + 1}</span><span>{result.question_text}</span></span>}
      subtitle={
        <span className="flex flex-wrap gap-x-3">
          <span>{total} answer{total !== 1 ? 's' : ''}</span>
          {timing && timing.skipped > 0 && <span>{timing.skipped} skipped</span>}
          {timing?.median_ms != null && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />median {formatDuration(timing.median_ms)}</span>}
        </span>
      }
    >
      {total === 0 && <p className="text-sm italic text-surface-500">No answers yet</p>}

      {isChoice && total > 0 && (
        <ul className="space-y-2.5">
          {result.option_counts.map((o, i) => {
            const pct = Math.round((o.count / total) * 100);
            return (
              <li key={o.label}>
                <button
                  onClick={() => onShowWho(type === 'yes_no' ? o.label.toLowerCase() : o.label)}
                  disabled={o.count === 0}
                  className="group block w-full text-left disabled:cursor-default"
                  title={o.count ? `See who answered “${o.label}”` : undefined}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-surface-200 group-enabled:group-hover:text-white">{o.label}</span>
                    <span className="shrink-0 text-xs tabular-nums text-surface-400">
                      {o.count} · {pct}%
                      {o.count > 0 && <Users className="ml-1.5 inline h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-800">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: CATEGORICAL[i % CATEGORICAL.length] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((o.count / max) * 100)}%` }}
                      transition={{ duration: 0.5, delay: i * 0.04 }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {type === 'ranking' && total > 0 && (
        <ol className="space-y-2">
          {result.ranking_scores.map((r, i) => (
            <li key={r.label} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-sm font-bold text-brand-400">#{i + 1}</span>
              <span className="flex-1 truncate text-sm text-surface-200">{r.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-surface-400">avg {r.avg_rank.toFixed(1)}</span>
            </li>
          ))}
          <p className="pt-1 text-[11px] text-surface-500">Average rank — lower means more preferred.</p>
        </ol>
      )}

      {isText && textRows.length > 0 && (
        <div className="space-y-2">
          {(allText ? textRows : textRows.slice(0, 6)).map(({ r, text }) => (
            <button
              key={r.response_id}
              onClick={() => onOpenPerson(r)}
              className="block w-full rounded-xl border border-surface-800 bg-surface-950/40 px-3 py-2 text-left transition-colors hover:border-surface-700"
            >
              <p className="whitespace-pre-wrap text-sm text-surface-200">{text}</p>
              <p className="mt-1 text-[11px] text-surface-500">{r.name}{r.email ? ` · ${r.email}` : ''}</p>
            </button>
          ))}
          {textRows.length > 6 && !allText && (
            <button onClick={() => setAllText(true)} className="text-xs font-semibold text-brand-400 hover:text-brand-300">
              Show all {textRows.length}
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}

// ── People ───────────────────────────────────────────────────────────

function People({ title, data, questions, filter, clearFilter, onOpen }: {
  title: string;
  data: PollResultsData;
  questions: PollQuestion[];
  filter: AnswerFilter | null;
  clearFilter: () => void;
  onOpen: (r: Respondent) => void;
}) {
  const [tab, setTab] = useState<PeopleTab>('finished');
  const [sort, setSort] = useState<PeopleSort>('newest');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const q = query.trim().toLowerCase();
  const finished = useMemo(() => {
    const rows = data.respondents.filter((r) => {
      if (filter && !answerMatches(r, filter)) return false;
      if (!q) return true;
      return `${r.name} ${r.username ?? ''} ${r.email ?? ''}`.toLowerCase().includes(q)
        || Object.values(r.answers).some((a) => answerToString(a).toLowerCase().includes(q));
    });
    const dur = (r: Respondent) => r.duration_ms ?? null;
    return [...rows].sort((a, b) => {
      if (sort === 'oldest') return a.completed_at.localeCompare(b.completed_at);
      if (sort === 'fastest' || sort === 'slowest') {
        const x = dur(a), y = dur(b);
        if (x == null) return 1;
        if (y == null) return -1;
        return sort === 'fastest' ? x - y : y - x;
      }
      return b.completed_at.localeCompare(a.completed_at);
    });
  }, [data.respondents, filter, q, sort]);

  const unfinished = useMemo(() => data.dropouts.filter((d) =>
    !q || `${d.name} ${d.username ?? ''} ${d.email ?? ''}`.toLowerCase().includes(q)), [data.dropouts, q]);

  const filterQuestion = filter ? questions.findIndex((x) => x.id === filter.questionId) : -1;
  const emails = (tab === 'finished' ? finished : unfinished).map((r) => r.email).filter((e): e is string => !!e);

  const copyEmails = () => {
    navigator.clipboard?.writeText(emails.join(', ')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'poll';

  return (
    <div className="space-y-4">
      <Toolbar>
        <Segmented
          id="poll-people-tab"
          value={tab}
          onChange={setTab}
          options={[
            { key: 'finished', label: `Finished · ${data.respondents.length}` },
            { key: 'unfinished', label: `Didn't finish · ${data.dropouts.length}` },
          ]}
        />
        <label className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-surface-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'finished' ? 'Search name, email or answer…' : 'Search name or email…'}
            className="w-full rounded-xl border border-surface-800 bg-surface-900/60 py-2 pl-8 pr-3 text-sm text-white placeholder:text-surface-500 focus:border-brand-500/50 focus:outline-none"
          />
        </label>
        {tab === 'finished' && (
          <Segmented
            id="poll-people-sort"
            size="sm"
            value={sort}
            onChange={setSort}
            options={[
              { key: 'newest', label: 'Newest' },
              { key: 'oldest', label: 'Oldest' },
              { key: 'fastest', label: 'Fastest' },
              { key: 'slowest', label: 'Slowest' },
            ]}
          />
        )}
        <ActionButton variant="ghost" icon={<Mail className="h-3.5 w-3.5" />} onClick={copyEmails} disabled={emails.length === 0} title="Copy the email addresses in this list">
          {copied ? 'Copied' : `Copy ${emails.length} email${emails.length !== 1 ? 's' : ''}`}
        </ActionButton>
        {tab === 'finished' && (
          <ActionButton
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => download(`${slug}-responses.csv`, respondentsToCSV(questions, finished), 'text/csv;charset=utf-8')}
            disabled={finished.length === 0}
          >
            CSV
          </ActionButton>
        )}
      </Toolbar>

      {filter && tab === 'finished' && (
        <div className="flex items-center gap-2 text-xs text-surface-400">
          <Filter className="h-3.5 w-3.5" />
          Showing people who answered
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 font-semibold text-brand-200">
            Q{filterQuestion + 1}: {filter.label}
            <button onClick={clearFilter} aria-label="Clear filter" className="text-brand-300 hover:text-white"><X className="h-3 w-3" /></button>
          </span>
        </div>
      )}

      {tab === 'finished' ? (
        finished.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title={data.respondents.length ? 'Nobody matches' : 'No responses yet'} />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-surface-800">
            <table className="w-full text-sm">
              <thead className="bg-surface-900/80 text-left text-[11px] uppercase tracking-wide text-surface-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Person</th>
                  <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Email</th>
                  <th className="px-4 py-2.5 font-semibold">Finished</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Time spent</th>
                  <th className="hidden px-4 py-2.5 font-semibold lg:table-cell">From</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/70">
                {finished.map((r) => (
                  <tr key={r.response_id} onClick={() => onOpen(r)} className="cursor-pointer bg-surface-950/30 transition-colors hover:bg-surface-800/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} url={r.avatar_url} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">{r.name}</div>
                          {r.username && <div className="truncate text-[11px] text-surface-500">@{r.username}</div>}
                          <div className="truncate text-[11px] text-surface-500 md:hidden">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden max-w-[240px] truncate px-4 py-2.5 text-surface-300 md:table-cell">{r.email ?? <span className="text-surface-600">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-surface-300" title={formatDate(r.completed_at)}>{timeAgo(r.completed_at)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-surface-200">{formatDuration(r.duration_ms)}</td>
                    <td className="hidden px-4 py-2.5 lg:table-cell">
                      {r.source ? <Pill tone={SOURCE_TONE[r.source] ?? 'neutral'}>{SOURCE_LABEL[r.source] ?? r.source}</Pill> : <span className="text-surface-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : unfinished.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title={data.dropouts.length ? 'Nobody matches' : 'Everyone who opened it finished'} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-surface-800">
          <table className="w-full text-sm">
            <thead className="bg-surface-900/80 text-left text-[11px] uppercase tracking-wide text-surface-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Person</th>
                <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Email</th>
                <th className="px-4 py-2.5 font-semibold">Got to</th>
                <th className="px-4 py-2.5 text-right font-semibold">Time spent</th>
                <th className="hidden px-4 py-2.5 font-semibold lg:table-cell">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/70">
              {unfinished.map((d) => (
                <tr key={d.user_id} className="bg-surface-950/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={d.name} url={d.avatar_url} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-white">{d.name}</div>
                        <div className="truncate text-[11px] text-surface-500">
                          Shown {d.view_count}×{d.dismiss_count ? ` · closed ${d.dismiss_count}×` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden max-w-[240px] truncate px-4 py-2.5 text-surface-300 md:table-cell">{d.email ?? <span className="text-surface-600">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-surface-300">
                    {d.max_step === 0 ? 'Intro' : `Q${d.max_step} of ${questions.length}`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-surface-200">{formatDuration(d.active_ms)}</td>
                  <td className="hidden whitespace-nowrap px-4 py-2.5 text-surface-400 lg:table-cell" title={formatDate(d.last_seen_at)}>{timeAgo(d.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── One person's answers ─────────────────────────────────────────────

function PersonDialog({ person, questions, onClose }: { person: Respondent | null; questions: PollQuestion[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const p = person;
  return (
    <Dialog
      open={!!p}
      onClose={onClose}
      size="lg"
      title={p ? (
        <span className="flex items-center gap-3">
          <Avatar name={p.name} url={p.avatar_url} />
          <span className="min-w-0">
            <span className="block truncate">{p.name}</span>
            <span className="block truncate text-xs font-normal text-surface-500">
              {p.username ? `@${p.username}` : ''}{p.username && p.email ? ' · ' : ''}{p.email ?? ''}
            </span>
          </span>
        </span>
      ) : ''}
      footer={p && (
        <>
          {p.email && (
            <ActionButton
              variant="ghost"
              icon={<Copy className="h-3.5 w-3.5" />}
              onClick={() => navigator.clipboard?.writeText(p.email!).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
            >
              {copied ? 'Copied' : 'Copy email'}
            </ActionButton>
          )}
          {p.username && (
            <a href={`/u/${p.username}`} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-xl border border-surface-800 px-3 py-2 text-xs font-semibold text-surface-200 hover:border-surface-700 hover:text-white">
              View profile
            </a>
          )}
        </>
      )}
    >
      {p && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Finished', formatDate(p.completed_at)],
              ['Time spent', formatDuration(p.duration_ms)],
              ['Started', p.started_at ? timeAgo(p.started_at) : '—'],
              ['From', p.source ? (SOURCE_LABEL[p.source] ?? p.source) + (p.resumed ? ' · resumed' : '') : '—'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-surface-800 bg-surface-950/40 px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-surface-500">{k}</dt>
                <dd className="mt-0.5 text-sm text-white">{v}</dd>
              </div>
            ))}
          </dl>
          <ol className="space-y-3">
            {questions.map((q, i) => {
              const a = p.answers[q.id];
              const text = answerToString(a);
              return (
                <li key={q.id} className="rounded-xl border border-surface-800 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold text-surface-400"><span className="text-surface-500">Q{i + 1}</span> {q.question_text}</p>
                    {a?.time_ms != null && <span className="shrink-0 text-[11px] tabular-nums text-surface-500">{formatDuration(a.time_ms)}</span>}
                  </div>
                  {q.question_type === 'ranking' && a?.list ? (
                    <ol className="mt-1.5 space-y-0.5 text-sm text-white">
                      {a.list.map((x, n) => <li key={x}><span className="mr-2 text-brand-400">{n + 1}.</span>{x}</li>)}
                    </ol>
                  ) : (
                    <p className={`mt-1.5 whitespace-pre-wrap text-sm ${text ? 'text-white' : 'italic text-surface-600'}`}>
                      {text ? (q.question_type === 'yes_no' ? text.charAt(0).toUpperCase() + text.slice(1) : text) : 'Skipped'}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Dialog>
  );
}
