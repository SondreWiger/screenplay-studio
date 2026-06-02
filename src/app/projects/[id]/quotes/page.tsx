'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button, Input, SearchInput, EmptyState, LoadingSpinner, toast, Select, Textarea } from '@/components/ui';
import { QuoteCard } from '@/components/quotes/QuoteCard';
import { QuoteForm } from '@/components/quotes/QuoteForm';
import { createClient } from '@/lib/supabase/client';
import type { Quote, QuoteInsert } from '@/lib/types';

export default function ProjectQuotesPage({ params }: { params: { id: string } }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'said_by' | 'said_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupFilter, setGroupFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('project_id', params.id);
      params.set('sort', sortBy);
      params.set('order', sortOrder);
      if (search) params.set('q', search);
      if (groupFilter) params.set('group_name', groupFilter);

      const res = await fetch(`/api/quotes?${params.toString()}`);
      const json = await res.json();
      if (json.data) setQuotes(json.data);
    } catch {
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [params.id, sortBy, sortOrder, search, groupFilter]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const groups = [...new Set(quotes.map(q => q.group_name).filter(Boolean) as string[])];

  const handleSubmit = async (data: QuoteInsert) => {
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, project_id: params.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Quote added!');
      setShowForm(false);
      fetchQuotes();
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

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Set Quotes</h1>
          <p className="text-sm text-surface-400 mt-1">Fun quotes from set, saved forever</p>
        </div>
        <Button variant="primary" onClick={() => { setEditingQuote(null); setShowForm(true); }}>
          + Add Quote
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="flex-1 min-w-[140px]">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search quotes..."
          />
        </div>

        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-lg px-2.5 py-1.5 text-xs text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        >
          <option value="">All groups</option>
          {groups.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleSort('created_at')}
            className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-colors ${
              sortBy === 'created_at' ? 'bg-brand-500/15 text-brand-400' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/80'
            }`}
          >
            Date{sortBy === 'created_at' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
          </button>
          <button
            onClick={() => toggleSort('said_by')}
            className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-colors ${
              sortBy === 'said_by' ? 'bg-brand-500/15 text-brand-400' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/80'
            }`}
          >
            Person{sortBy === 'said_by' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
          </button>
        </div>
      </div>

      {/* Form */}
      {(showForm || editingQuote) && (
        <div className="bg-surface-900/80 border border-surface-800/60 rounded-xl p-4 mb-4">
          <h3 className="text-xs font-semibold text-surface-400 mb-3">
            {editingQuote ? 'Edit Quote' : 'New Quote'}
          </h3>
          <QuoteForm
            initial={editingQuote}
            groups={groups}
            onSubmit={editingQuote ? handleEdit : handleSubmit}
            onCancel={() => { setShowForm(false); setEditingQuote(null); }}
          />
        </div>
      )}

      {/* Count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
          {loading ? 'Loading...' : `${quotes.length} quote${quotes.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : quotes.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            }
            title="No set quotes yet"
            description="Capture memorable moments from set to look back on forever"
            action={
              <Button variant="primary" size="sm" onClick={() => { setEditingQuote(null); setShowForm(true); }}>
                Add your first set quote
              </Button>
            }
          />
        ) : (
          quotes.map(quote => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              isOwner={userId === quote.created_by}
              onEdit={(q) => { setEditingQuote(q); setShowForm(false); }}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
