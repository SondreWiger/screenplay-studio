'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button, SearchInput, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { QuoteForm } from '@/components/quotes/QuoteForm';
import { GroupManager } from '@/components/quotes/GroupManager';
import { AppHeader } from '@/components/AppHeader';
import { createClient } from '@/lib/supabase/client';
import type { Quote, QuoteInsert, QuoteGroup } from '@/lib/types';

type SortField = 'created_at' | 'said_by';

function groupQuotesByTime(quotes: Quote[]): { label: string; quotes: Quote[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const thisWeekStart = new Date(today.getTime() - today.getDay() * 86400000);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const groups: { label: string; quotes: Quote[] }[] = [];

  const byDate: Record<string, Quote[]> = {};
  for (const q of quotes) {
    const d = q.created_at ? new Date(q.created_at) : now;
    const dateKey = d.toDateString();
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(q);
  }

  for (const [dateKey, qs] of Object.entries(byDate)) {
    const d = new Date(dateKey);
    let label: string;
    if (d.getTime() >= today.getTime()) label = 'Today';
    else if (d.getTime() >= yesterday.getTime()) label = 'Yesterday';
    else if (d.getTime() >= thisWeekStart.getTime()) label = 'Earlier This Week';
    else if (d.getTime() >= thisMonthStart.getTime()) label = 'Earlier This Month';
    else if (d.getTime() >= lastMonthStart.getTime()) label = 'Last Month';
    else label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    groups.push({ label, quotes: qs });
  }

  return groups;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupFilter, setGroupFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [quoteCount, setQuoteCount] = useState(0);
  const [sharedGroups, setSharedGroups] = useState<QuoteGroup[]>([]);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [groupIdFilter, setGroupIdFilter] = useState('');
  const timelineRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('sort', 'created_at');
      params.set('order', sortOrder);
      if (search) params.set('q', search);
      if (groupFilter) params.set('group_name', groupFilter);
      if (groupIdFilter) params.set('group_id', groupIdFilter);

      const res = await fetch(`/api/quotes?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setQuotes(json.data);
        setQuoteCount(json.data.length);
      }
    } catch {
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [sortOrder, search, groupFilter, groupIdFilter]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/quote-groups');
      const json = await res.json();
      if (json.data) setSharedGroups(json.data);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
    fetchGroups();
  }, [fetchQuotes, fetchGroups]);

  // Inject fade-in keyframes on mount to avoid hydration mismatch with <style jsx>
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `@keyframes fade-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const groups = Array.from(new Set(quotes.map(q => q.group_name).filter(Boolean) as string[]));;
  const timelineGroups = !search && !groupFilter && !groupIdFilter && sortOrder === 'desc'
    ? groupQuotesByTime(quotes)
    : [{ label: 'All Quotes', quotes }];

  const handleSubmit = async (data: QuoteInsert) => {
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Quote added!');
      setShowForm(false);
      setShowQuickForm(false);
      fetchQuotes();
      // Scroll to top of timeline to see the new quote
      timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to add quote');
    }
  };

  const handleEdit = async (data: QuoteInsert) => {
    if (!editingQuote) return;
    try {
      const res = await fetch(`/api/quotes/${editingQuote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Quote updated!');
      setEditingQuote(null);
      fetchQuotes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update quote');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Quote deleted');
      fetchQuotes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete quote');
    }
  };

  return (
    <>
      <AppHeader />
      <div className="min-h-screen" style={{ background: 'rgb(var(--surface-950))' }}>
        {/* Warm ambient gradient */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #FF5F1F 0%, transparent 70%)' }} />
          <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }} />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-brand-500/15 border border-amber-500/10 mb-4">
              <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              The Quote Wall
            </h1>
            <p className="text-sm text-surface-500 mt-2 max-w-md mx-auto">
              A cozy corner for the words that stuck with you
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap mb-8 justify-center">
            <div className="w-full max-w-xs">
              <SearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search quotes..."
              />
            </div>

            <select
              value={groupIdFilter || groupFilter}
              onChange={(e) => {
                const val = e.target.value;
                if (val && val.includes('-')) {
                  setGroupIdFilter(val);
                  setGroupFilter('');
                } else {
                  setGroupFilter(val);
                  setGroupIdFilter('');
                }
              }}
              className="bg-surface-900/80 border border-surface-800 rounded-lg px-3 py-2 text-xs text-surface-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-colors appearance-none cursor-pointer"
            >
              <option value="">All</option>
              {sharedGroups.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
              {sharedGroups.length > 0 && groups.length > 0 && <option disabled>──────────</option>}
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>

            <button
              onClick={() => setShowGroupManager(true)}
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg bg-surface-900/80 border border-surface-800 text-surface-400 hover:text-surface-200 hover:border-surface-700 transition-colors"
              title="Manage groups"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </button>

            <button
              onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg bg-surface-900/80 border border-surface-800 text-surface-400 hover:text-surface-200 hover:border-surface-700 transition-colors"
            >
              {sortOrder === 'desc' ? 'Newest first ↓' : 'Oldest first ↑'}
            </button>

            <Button variant="primary" size="sm" onClick={() => { setEditingQuote(null); setShowForm(true); setShowQuickForm(false); }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Quote
            </Button>
          </div>

          {/* Full form */}
          {(showForm || editingQuote) && (
            <div className="bg-gradient-to-br from-surface-900 to-surface-950 border border-surface-800 rounded-xl p-5 mb-8 shadow-lg shadow-black/20">
              <h3 className="text-xs font-semibold text-surface-400 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {editingQuote ? 'Edit Quote' : 'New Quote'}
              </h3>
              <QuoteForm
                initial={editingQuote}
                groups={groups}
                sharedGroups={sharedGroups}
                onSubmit={editingQuote ? handleEdit : handleSubmit}
                onCancel={() => { setShowForm(false); setEditingQuote(null); }}
              />
            </div>
          )}

          {/* Quick capture — always visible mini form */}
          {!showForm && !editingQuote && (
            <button
              onClick={() => setShowQuickForm(true)}
              className="w-full text-left bg-gradient-to-r from-surface-900/50 to-surface-950/50 border border-surface-800/60 border-dashed rounded-xl p-4 mb-8 text-surface-500 hover:text-surface-300 hover:border-surface-700/60 hover:from-surface-900/80 hover:to-surface-950/80 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-800/50 flex items-center justify-center group-hover:bg-amber-500/10 group-hover:text-amber-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-sm">Remember a quote...</span>
              </div>
            </button>
          )}

          {/* Quick form (inline expand) */}
          {showQuickForm && (
            <div className="bg-gradient-to-br from-surface-900 to-surface-950 border border-surface-800 rounded-xl p-5 mb-8 shadow-lg shadow-black/20 animate-fade-in">
              <h3 className="text-xs font-semibold text-surface-400 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Quick Capture
              </h3>
              <QuoteForm
                groups={groups}
                sharedGroups={sharedGroups}
                onSubmit={handleSubmit}
                onCancel={() => setShowQuickForm(false)}
              />
            </div>
          )}

          {/* Quote count */}
          {!loading && quoteCount > 0 && (
            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-surface-600 bg-surface-900/50 px-3 py-1.5 rounded-full border border-surface-800/50">
                <svg className="w-3 h-3 text-amber-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                {quoteCount} quote{quoteCount !== 1 ? 's' : ''} saved
              </span>
            </div>
          )}

          {/* Timeline */}
          <div ref={timelineRef}>
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <LoadingSpinner />
                  <p className="text-xs text-surface-600">Gathering quotes...</p>
                </div>
              </div>
            ) : quotes.length === 0 ? (
              <div className="py-16">
                <EmptyState
                  icon={
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/10 to-brand-500/10 border border-amber-500/10 flex items-center justify-center">
                      <svg className="w-7 h-7 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </div>
                  }
                  title="No quotes yet"
                  description="The wall is bare — add your first quote to warm the place up"
                  action={
                    <Button variant="primary" size="sm" onClick={() => { setEditingQuote(null); setShowForm(true); }}>
                      Add your first quote
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="space-y-10">
                {timelineGroups.map((group, gi) => (
                  <div key={gi}>
                    {/* Timeline group header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-500 to-brand-500 shadow-sm shadow-amber-500/20" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-surface-500">
                          {group.label}
                        </span>
                      </div>
                      <div className="flex-1 h-px bg-gradient-to-r from-surface-800/80 to-transparent" />
                    </div>

                    {/* Timeline items */}
                    <div className="space-y-3 pl-5 border-l-2 border-surface-800/50 ml-1">
                      {group.quotes.map((quote, qi) => (
                        <div key={quote.id} className="relative animate-fade-in" style={{ animationDelay: `${(qi % 5) * 60}ms` }}>
                          {/* Timeline dot */}
                          <div className="absolute -left-[23px] top-5 w-2.5 h-2.5 rounded-full bg-surface-900 border-2 border-surface-700" />

                          {/* Quote card with cozy styling */}
                          <div className="group relative bg-gradient-to-br from-surface-900/80 to-surface-950/80 border border-surface-800/50 rounded-xl p-5 hover:border-surface-700/70 hover:from-surface-900 hover:to-surface-950 transition-all duration-300 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5">
                            {/* Warm ambient glow per card */}
                            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500 pointer-events-none" style={{ background: 'radial-gradient(circle, #FF5F1F 0%, transparent 70%)' }} />

                            {/* Quote mark */}
                            <div className="text-3xl leading-none text-amber-500/15 select-none pointer-events-none font-serif mb-1">
                              &ldquo;
                            </div>

                            {/* Quote content */}
                            <p className="text-sm sm:text-base text-white/85 leading-relaxed italic mb-4 font-serif">
                              {quote.content}
                            </p>

                            {/* Attribution and meta */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-semibold text-amber-400 truncate">
                                  &mdash; {quote.said_by}
                                </span>
                              </div>

                              {userId === quote.created_by && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                                  <button
                                    onClick={() => { setEditingQuote(quote); setShowForm(true); setShowQuickForm(false); }}
                                    className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-800/80 transition-colors"
                                    title="Edit quote"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDelete(quote.id)}
                                    className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Delete quote"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Meta tags */}
                            {(quote.context || quote.location || quote.group_name || quote.group || quote.said_at) && (
                              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-surface-800/30">
                                {quote.group && (
                                  <span className="text-[9px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/8 text-amber-500/70 border border-amber-500/10 flex items-center gap-1">
                                    {quote.group.emoji} {quote.group.name}
                                  </span>
                                )}
                                {!quote.group && quote.group_name && (
                                  <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/8 text-amber-500/70 border border-amber-500/10">
                                    {quote.group_name}
                                  </span>
                                )}
                                {quote.context && (
                                  <span className="text-[10px] text-surface-500 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                    {quote.context}
                                  </span>
                                )}
                                {quote.location && (
                                  <span className="text-[10px] text-surface-500 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {quote.location}
                                  </span>
                                )}
                                {quote.said_at && (
                                  <span className="text-[10px] text-surface-600 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {new Date(quote.said_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            {!loading && quoteCount > 0 && (
              <div className="text-center mt-12 mb-8">
                <div className="inline-flex items-center gap-2 text-[10px] text-surface-700 bg-surface-900/50 px-4 py-2 rounded-full border border-surface-800/50">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  Keep filling the wall
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Group Manager */}
      <GroupManager
        isOpen={showGroupManager}
        onClose={() => setShowGroupManager(false)}
        onGroupChange={() => { fetchGroups(); fetchQuotes(); }}
      />
    </>
  );
}
