'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Badge, Modal, Input, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type {
  BroadcastWireFeed, BroadcastWireStory, BroadcastWireFeedType, BroadcastWirePriority,
} from '@/lib/types';
import { BROADCAST_WIRE_PRIORITY_OPTIONS } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Wire Desk — Real wire feed ingestion, management, and browse
// ────────────────────────────────────────────────────────────

export default function WireDeskPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const projectId = params.id;

  // ─── State ─────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [feeds, setFeeds] = useState<BroadcastWireFeed[]>([]);
  const [wireStories, setWireStories] = useState<BroadcastWireStory[]>([]);
  const [selectedStory, setSelectedStory] = useState<BroadcastWireStory | null>(null);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [showManageFeeds, setShowManageFeeds] = useState(false);
  const [pollingFeedId, setPollingFeedId] = useState<string | null>(null);

  // Filters
  const [filter, setFilter] = useState({
    feed_id: 'all',
    priority: 'all' as BroadcastWirePriority | 'all',
    search: '',
    unused_only: false,
  });

  // New feed form
  const [newFeed, setNewFeed] = useState({
    name: '', feed_url: '', feed_type: 'rss' as BroadcastWireFeedType,
    category: '', poll_interval_seconds: 300,
  });

  // ─── Data Fetching ─────────────────────────────────────

  const fetchFeeds = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('broadcast_wire_feeds')
      .select('*')
      .eq('project_id', projectId)
      .order('name');
    setFeeds(data || []);
  }, [projectId]);

  const fetchWireStories = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from('broadcast_wire_stories')
      .select('*')
      .eq('project_id', projectId)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(200);

    const { data } = await query;
    setWireStories(data || []);
  }, [projectId]);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchFeeds(), fetchWireStories()]);
      setLoading(false);
    })();
  }, [fetchFeeds, fetchWireStories]);

  // Realtime for wire stories
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`wire-${projectId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'broadcast_wire_stories', filter: `project_id=eq.${projectId}` },
        () => fetchWireStories()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, fetchWireStories]);

  // ─── Feed Management ───────────────────────────────────

  const handleAddFeed = async () => {
    if (!newFeed.name || !newFeed.feed_url) { toast.error('Name and URL are required'); return; }
    const supabase = createClient();
    const { error } = await supabase
      .from('broadcast_wire_feeds')
      .insert({
        project_id: projectId,
        name: newFeed.name,
        feed_url: newFeed.feed_url,
        feed_type: newFeed.feed_type,
        category: newFeed.category || null,
        poll_interval_seconds: newFeed.poll_interval_seconds,
      });

    if (error) { toast.error(error.message); return; }
    toast.success('Feed added');
    setShowAddFeed(false);
    setNewFeed({ name: '', feed_url: '', feed_type: 'rss', category: '', poll_interval_seconds: 300 });
    fetchFeeds();
  };

  const handleDeleteFeed = async (feedId: string) => {
    const supabase = createClient();
    await supabase.from('broadcast_wire_feeds').delete().eq('id', feedId);
    toast.success('Feed deleted');
    fetchFeeds();
  };

  const handleToggleFeed = async (feedId: string, active: boolean) => {
    const supabase = createClient();
    await supabase.from('broadcast_wire_feeds').update({ is_active: active }).eq('id', feedId);
    fetchFeeds();
  };

  // ─── Poll a Feed (calls our real API route) ────────────

  const handlePollFeed = async (feedId: string) => {
    setPollingFeedId(feedId);
    try {
      const res = await fetch('/api/broadcast/wire-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_id: feedId, project_id: projectId }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(`Poll failed: ${result.error}`);
        return;
      }

      if (result.ingested > 0) {
        toast.success(`Ingested ${result.ingested} new stories (${result.duplicates_skipped} dupes skipped)`);
      } else {
        toast(`No new stories (${result.duplicates_skipped} already ingested)`);
      }

      await Promise.all([fetchFeeds(), fetchWireStories()]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Poll failed';
      toast.error(msg);
    } finally {
      setPollingFeedId(null);
    }
  };

  const handlePollAll = async () => {
    const activeFeeds = feeds.filter(f => f.is_active);
    if (activeFeeds.length === 0) { toast('No active feeds'); return; }

    toast(`Polling ${activeFeeds.length} feeds...`);
    for (const feed of activeFeeds) {
      await handlePollFeed(feed.id);
    }
  };

  // ─── Pull to Story ─────────────────────────────────────

  const handlePullToStory = async (wireStory: BroadcastWireStory) => {
    const supabase = createClient();

    // Create a broadcast story from the wire story
    const slug = wireStory.headline
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join('-')
      .toUpperCase();

    const { data: newStory, error } = await supabase
      .from('broadcast_stories')
      .insert({
        project_id: projectId,
        title: wireStory.headline,
        slug,
        script_text: wireStory.body || wireStory.summary || '',
        story_type: 'reader' as const,
        priority: wireStory.priority === 'flash' ? 5
          : wireStory.priority === 'bulletin' ? 4
          : wireStory.priority === 'urgent' ? 3 : 0,
        source: `wire:${wireStory.source_name || 'unknown'}`,
        wire_story_id: wireStory.id,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) { toast.error(error.message); return; }

    // Mark the wire story as used
    await supabase
      .from('broadcast_wire_stories')
      .update({ is_used: true, used_in_story_id: newStory?.id })
      .eq('id', wireStory.id);

    toast.success(`Story created: ${slug}`);
    fetchWireStories();
  };

  // ─── Filtered Stories ──────────────────────────────────

  const filteredStories = wireStories.filter(s => {
    if (filter.feed_id !== 'all' && s.feed_id !== filter.feed_id) return false;
    if (filter.priority !== 'all' && s.priority !== filter.priority) return false;
    if (filter.unused_only && s.is_used) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return s.headline.toLowerCase().includes(q) || (s.summary || '').toLowerCase().includes(q);
    }
    return true;
  });

  // ─── Render ────────────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-screen bg-surface-950">
      {/* ── Wire Story List ──────────────────────────── */}
      <div className={cn('flex flex-col', selectedStory ? 'w-1/2' : 'flex-1')}>
        {/* Header bar */}
        <div className="p-3 border-b border-surface-800 space-y-2 bg-surface-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-white">Wire Desk</h2>
              <span className="text-xs text-surface-500">{filteredStories.length} stories</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowManageFeeds(true)}>
                Manage Feeds ({feeds.length})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddFeed(true)}>
                + Add Feed
              </Button>
              <Button
                size="sm"
                onClick={handlePollAll}
                disabled={pollingFeedId !== null}
              >
                {pollingFeedId ? 'Polling...' : '↻ Poll All'}
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search wire..."
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
              className="flex-1 bg-surface-800 text-white border border-surface-700 rounded px-2 py-1 text-xs placeholder-surface-500"
            />
            <select
              value={filter.feed_id}
              onChange={(e) => setFilter(prev => ({ ...prev, feed_id: e.target.value }))}
              className="bg-surface-800 text-white border border-surface-700 rounded px-2 py-1 text-xs"
            >
              <option value="all">All Feeds</option>
              {feeds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select
              value={filter.priority}
              onChange={(e) => setFilter(prev => ({ ...prev, priority: e.target.value as BroadcastWirePriority | 'all' }))}
              className="bg-surface-800 text-white border border-surface-700 rounded px-2 py-1 text-xs"
            >
              <option value="all">All Priority</option>
              {BROADCAST_WIRE_PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <label className="flex items-center gap-1 text-[10px] text-surface-400">
              <input
                type="checkbox"
                checked={filter.unused_only}
                onChange={(e) => setFilter(prev => ({ ...prev, unused_only: e.target.checked }))}
                className="rounded bg-surface-800 border-surface-600"
              />
              Unused
            </label>
          </div>
        </div>

        {/* Story list */}
        <div className="flex-1 overflow-y-auto">
          {filteredStories.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState
                title="No Wire Stories"
                description={feeds.length === 0
                  ? "Add a wire feed to start ingesting stories."
                  : "No stories match your filters. Try polling your feeds."
                }
                action={feeds.length === 0
                  ? <Button onClick={() => setShowAddFeed(true)}>Add Wire Feed</Button>
                  : <Button onClick={handlePollAll}>Poll Feeds Now</Button>
                }
              />
            </div>
          ) : (
            filteredStories.map(story => {
              const feedName = feeds.find(f => f.id === story.feed_id)?.name || 'Unknown';
              const priorityOpt = BROADCAST_WIRE_PRIORITY_OPTIONS.find(p => p.value === story.priority);
              const isSelected = selectedStory?.id === story.id;

              return (
                <button
                  key={story.id}
                  onClick={() => setSelectedStory(story)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-b border-surface-800/50 transition-colors',
                    isSelected ? 'bg-surface-800' : 'hover:bg-surface-800/40',
                    story.is_used && 'opacity-50',
                    story.priority === 'flash' && !isSelected && 'bg-red-950/20 border-l-2 border-l-red-500',
                    story.priority === 'bulletin' && !isSelected && 'bg-orange-950/10 border-l-2 border-l-orange-500',
                    story.priority === 'urgent' && !isSelected && 'border-l-2 border-l-amber-500',
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('text-[9px] font-bold px-1 py-0 rounded text-white', priorityOpt?.color || 'bg-surface-700')}>
                      {priorityOpt?.label || story.priority}
                    </span>
                    <span className="text-[10px] text-surface-500">{feedName}</span>
                    {story.category && <span className="text-[10px] text-surface-600">· {story.category}</span>}
                    {story.is_used && <span className="text-[9px] text-green-500 font-bold">USED</span>}
                    <span className="text-[10px] text-surface-600 ml-auto">
                      {story.published_at
                        ? new Date(story.published_at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </div>
                  <div className="text-sm text-surface-200 font-medium leading-tight">{story.headline}</div>
                  {story.summary && (
                    <div className="text-xs text-surface-500 mt-0.5 line-clamp-2">{story.summary}</div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Story Detail Panel ───────────────────────── */}
      {selectedStory && (
        <div className="w-1/2 border-l border-surface-800 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-surface-800 bg-surface-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded text-white',
                BROADCAST_WIRE_PRIORITY_OPTIONS.find(p => p.value === selectedStory.priority)?.color
              )}>
                {selectedStory.priority.toUpperCase()}
              </span>
              <span className="text-xs text-surface-500">{feeds.find(f => f.id === selectedStory.feed_id)?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {!selectedStory.is_used && (
                <Button size="sm" onClick={() => handlePullToStory(selectedStory)}>
                  Pull to Story
                </Button>
              )}
              {selectedStory.is_used && (
                <span className="text-xs text-green-400 font-bold">Already pulled to story</span>
              )}
              <button
                onClick={() => setSelectedStory(null)}
                className="p-1 text-surface-500 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <h2 className="text-lg font-bold text-white mb-2">{selectedStory.headline}</h2>
            <div className="flex gap-3 text-xs text-surface-500 mb-4">
              {selectedStory.source_name && <span>Source: {selectedStory.source_name}</span>}
              {selectedStory.category && <span>Category: {selectedStory.category}</span>}
              {selectedStory.published_at && (
                <span>Published: {new Date(selectedStory.published_at).toLocaleString('nb-NO')}</span>
              )}
              <span>Ingested: {new Date(selectedStory.ingested_at).toLocaleString('nb-NO')}</span>
            </div>

            {selectedStory.summary && (
              <div className="mb-4 p-3 bg-surface-900 border border-surface-800 rounded-lg">
                <div className="text-[10px] font-bold text-surface-500 uppercase mb-1">Summary</div>
                <p className="text-sm text-surface-300 leading-relaxed">{selectedStory.summary}</p>
              </div>
            )}

            {selectedStory.body && (
              <div className="prose prose-invert prose-sm max-w-none">
                <div className="text-[10px] font-bold text-surface-500 uppercase mb-1">Full Text</div>
                <div
                  className="text-sm text-surface-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: selectedStory.body }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Feed Modal ───────────────────────────── */}
      <Modal isOpen={showAddFeed} onClose={() => setShowAddFeed(false)} title="Add Wire Feed">
        <div className="space-y-4">
          <Input
            label="Feed Name"
            value={newFeed.name}
            onChange={(e) => setNewFeed(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. NTB Nyheter, AP World, Reuters Sports"
          />
          <Input
            label="Feed URL"
            value={newFeed.feed_url}
            onChange={(e) => setNewFeed(prev => ({ ...prev, feed_url: e.target.value }))}
            placeholder="https://feeds.example.com/rss.xml"
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Type</label>
              <select
                value={newFeed.feed_type}
                onChange={(e) => setNewFeed(prev => ({ ...prev, feed_type: e.target.value as BroadcastWireFeedType }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="rss">RSS</option>
                <option value="atom">Atom</option>
                <option value="json_api">JSON API</option>
              </select>
            </div>
            <Input
              label="Category"
              value={newFeed.category}
              onChange={(e) => setNewFeed(prev => ({ ...prev, category: e.target.value }))}
              placeholder="world, sport..."
            />
            <div>
              <label className="text-xs font-medium text-surface-400 block mb-1">Poll Interval</label>
              <select
                value={newFeed.poll_interval_seconds}
                onChange={(e) => setNewFeed(prev => ({ ...prev, poll_interval_seconds: Number(e.target.value) }))}
                className="w-full bg-surface-800 text-white border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value={60}>1 min</option>
                <option value={120}>2 min</option>
                <option value={300}>5 min</option>
                <option value={600}>10 min</option>
                <option value={1800}>30 min</option>
                <option value={3600}>1 hour</option>
              </select>
            </div>
          </div>
          <div className="bg-surface-800 rounded-lg p-3 text-xs text-surface-400">
            <strong className="text-surface-300">Supported feeds:</strong> Any standard RSS 2.0 or Atom feed.
            For example:
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              <li>NTB: <code className="text-surface-300">https://www.ntb.no/rss</code></li>
              <li>NRK: <code className="text-surface-300">https://www.nrk.no/toppsaker.rss</code></li>
              <li>AP: <code className="text-surface-300">https://rsshub.app/apnews/topics/apf-topnews</code></li>
              <li>Reuters: <code className="text-surface-300">https://rsshub.app/reuters/world</code></li>
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddFeed(false)}>Cancel</Button>
            <Button onClick={handleAddFeed}>Add Feed</Button>
          </div>
        </div>
      </Modal>

      {/* ── Manage Feeds Modal ───────────────────────── */}
      <Modal isOpen={showManageFeeds} onClose={() => setShowManageFeeds(false)} title="Manage Wire Feeds">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {feeds.length === 0 ? (
            <p className="text-sm text-surface-500 text-center py-4">No feeds configured.</p>
          ) : (
            feeds.map(feed => (
              <div
                key={feed.id}
                className="flex items-center gap-3 p-3 bg-surface-800 rounded-lg"
              >
                <div className={cn('w-2 h-2 rounded-full shrink-0', feed.is_active ? 'bg-green-500' : 'bg-surface-600')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{feed.name}</span>
                    {feed.category && <span className="text-[10px] text-surface-500">{feed.category}</span>}
                  </div>
                  <div className="text-[10px] text-surface-500 truncate">{feed.feed_url}</div>
                  <div className="flex gap-3 mt-1 text-[10px] text-surface-400">
                    <span>{feed.stories_ingested} ingested</span>
                    <span>Poll: {feed.poll_interval_seconds}s</span>
                    {feed.last_polled_at && (
                      <span>Last: {new Date(feed.last_polled_at).toLocaleTimeString('nb-NO')}</span>
                    )}
                    {feed.last_error && (
                      <span className="text-red-400 truncate max-w-[200px]">Error: {feed.last_error}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePollFeed(feed.id)}
                    disabled={pollingFeedId === feed.id}
                  >
                    {pollingFeedId === feed.id ? '...' : '↻'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleFeed(feed.id, !feed.is_active)}
                  >
                    {feed.is_active ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400"
                    onClick={() => handleDeleteFeed(feed.id)}
                  >
                    ×
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end pt-3">
          <Button variant="ghost" onClick={() => setShowManageFeeds(false)}>Close</Button>
        </div>
      </Modal>
    </div>
  );
}
