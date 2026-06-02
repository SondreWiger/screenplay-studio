'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Input, SearchInput, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { QuoteCard } from './QuoteCard';
import { QuoteForm } from './QuoteForm';
import { GroupManager } from './GroupManager';
import { createClient } from '@/lib/supabase/client';
import type { Quote, QuoteInsert, QuoteGroup } from '@/lib/types';

interface QuotePanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;
}

type SortField = 'created_at' | 'said_by' | 'said_at' | 'group_name';
type SortOrder = 'asc' | 'desc';

export function QuotePanel({ isOpen, onClose, projectId }: QuotePanelProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [groupFilter, setGroupFilter] = useState('');
  const [groupIdFilter, setGroupIdFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sharedGroups, setSharedGroups] = useState<QuoteGroup[]>([]);
  const [showGroupManager, setShowGroupManager] = useState(false);

  const supabase = createClient();

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (projectId) params.set('project_id', projectId);
      params.set('sort', sortBy);
      params.set('order', sortOrder);
      if (search) params.set('q', search);
      if (groupFilter) params.set('group_name', groupFilter);
      if (groupIdFilter) params.set('group_id', groupIdFilter);

      const res = await fetch(`/api/quotes?${params.toString()}`);
      const json = await res.json();
      if (json.data) setQuotes(json.data);
    } catch {
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [projectId, sortBy, sortOrder, search, groupFilter, groupIdFilter]);

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
    if (!isOpen) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    fetchQuotes();
    fetchGroups();
  }, [isOpen, fetchQuotes, fetchGroups]);

  // Debounce search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const groups = [...new Set(quotes.map(q => q.group_name).filter(Boolean) as string[])];
  const totalCount = quotes.length;

  const handleSubmit = async (data: QuoteInsert) => {
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, project_id: projectId || null }),
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

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleGroupChange = () => {
    fetchGroups();
    fetchQuotes();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={projectId ? 'Set Quotes' : 'Quotes'} size="lg">
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[140px]">
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
              // Check if it's a shared group ID (uuid format)
              if (val && val.includes('-')) {
                setGroupIdFilter(val);
                setGroupFilter('');
              } else {
                setGroupFilter(val);
                setGroupIdFilter('');
              }
            }}
            className="bg-surface-800 border border-surface-700 rounded-lg px-2.5 py-1.5 text-xs text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            <option value="">All</option>
            {sharedGroups.map(g => (
              <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
            ))}
            {sharedGroups.length > 0 && groups.length > 0 && <option disabled>──────────</option>}
            {groups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleSort('created_at')}
              className={cn(
                'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-colors',
                sortBy === 'created_at' ? 'bg-brand-500/15 text-brand-400' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/80'
              )}
            >
              Date
              {sortBy === 'created_at' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
            </button>
            <button
              onClick={() => toggleSort('said_by')}
              className={cn(
                'px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-colors',
                sortBy === 'said_by' ? 'bg-brand-500/15 text-brand-400' : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/80'
              )}
            >
              Person
              {sortBy === 'said_by' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
            </button>
          </div>

          <Button variant="ghost" size="sm" onClick={() => setShowGroupManager(true)} title="Manage shared groups">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </Button>

          <Button variant="primary" size="sm" onClick={() => { setEditingQuote(null); setShowForm(true); }}>
            + Add Quote
          </Button>
        </div>

        {/* Form */}
        {(showForm || editingQuote) && (
          <div className="bg-surface-900/80 border border-surface-800/60 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-surface-400 mb-3">
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

        {/* Header with count */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
            {loading ? 'Loading...' : `${totalCount} quote${totalCount !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* List */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 -mr-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : quotes.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              }
              title="No quotes yet"
              description={search || groupFilter || groupIdFilter ? 'Try a different search or filter' : 'Add your first quote to get started'}
              action={
                !search && !groupFilter && !groupIdFilter ? (
                  <Button variant="primary" size="sm" onClick={() => { setEditingQuote(null); setShowForm(true); }}>
                    Add your first quote
                  </Button>
                ) : undefined
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

      {/* Group Manager */}
      <GroupManager
        isOpen={showGroupManager}
        onClose={() => setShowGroupManager(false)}
        onGroupChange={handleGroupChange}
      />
    </Modal>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
