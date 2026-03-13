'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { Button, Input, Modal, LoadingPage, toast, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────

type Board = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  emoji: string;
  color: string;
  is_archived: boolean;
  parent_id: string | null;
  member_count: number;
  owner_name: string | null;
  linked_project_id: string | null;
  linked_project_title: string | null;
  linked_project_color: string | null;
  created_at: string;
  updated_at: string;
};

type Project = {
  id: string;
  title: string;
};

const BOARD_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4',
  '#FF5F1F', '#84cc16',
];
const BOARD_EMOJIS = ['💡', '🎬', '📝', '🎭', '🌟', '🔥', '🎯', '🧠', '✨', '🎨', '📖', '🚀'];

// ── Page ─────────────────────────────────────────────────────

export default function IdeaBoardsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [boards, setBoards] = useState<Board[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // New board form
  const [newTitle, setNewTitle] = useState('');
  const [newEmoji, setNewEmoji] = useState('💡');
  const [newColor, setNewColor] = useState('#6366f1');
  const [newDescription, setNewDescription] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchBoards = useCallback(async () => {
    if (!user?.id) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('idea_boards_with_meta')
      .select('*')
      .is('parent_id', null)
      .order('updated_at', { ascending: false });
    if (error) { console.error(error); toast.error('Failed to load boards'); return; }
    setBoards((data ?? []) as Board[]);
  }, [user?.id]);

  const fetchProjects = useCallback(async () => {
    if (!user?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('projects')
      .select('id, title')
      .order('title');
    setProjects((data ?? []) as Project[]);
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && user) {
      Promise.all([fetchBoards(), fetchProjects()]).finally(() => setLoading(false));
    } else if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [authLoading, user, fetchBoards, fetchProjects, router]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !user?.id) return;
    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('idea_boards')
      .insert({
        owner_id: user.id,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        emoji: newEmoji,
        color: newColor,
        linked_project_id: newProjectId || null,
      })
      .select('id')
      .single();
    setCreating(false);
    if (error) { toast.error('Failed to create board'); return; }
    toast.success('Board created!');
    setShowCreate(false);
    resetForm();
    router.push(`/idea-boards/${data.id}`);
  };

  const resetForm = () => {
    setNewTitle('');
    setNewEmoji('💡');
    setNewColor('#6366f1');
    setNewDescription('');
    setNewProjectId('');
  };

  const handleArchive = async (board: Board) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('idea_boards')
      .update({ is_archived: !board.is_archived })
      .eq('id', board.id);
    if (error) { toast.error('Failed to update board'); return; }
    toast.success(board.is_archived ? 'Board restored' : 'Board archived');
    fetchBoards();
  };

  if (authLoading || loading) return <LoadingPage />;

  const visibleBoards = boards.filter(b => b.is_archived === showArchived);
  const myBoards = visibleBoards.filter(b => b.owner_id === user?.id);
  const sharedBoards = visibleBoards.filter(b => b.owner_id !== user?.id);

  return (
    <div className="min-h-screen" style={{ background: '#070710' }}>
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Idea Boards</h1>
            <p className="text-sm text-surface-400 mt-1">
              Capture ideas, collaborate, link to projects — no pressure, just notes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived(v => !v)}
              className={cn(
                'px-3 py-2 text-xs font-mono uppercase tracking-widest transition-all rounded-lg border',
                showArchived
                  ? 'border-surface-600 text-white bg-surface-800'
                  : 'border-surface-700 text-surface-500 hover:text-white hover:border-surface-600'
              )}
            >
              {showArchived ? 'Active boards' : 'Archived'}
            </button>
            <Button onClick={() => setShowCreate(true)} style={{ background: '#FF5F1F' }}>
              + New board
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {visibleBoards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-6xl mb-4">💡</div>
            <h2 className="text-lg font-bold text-white mb-2">
              {showArchived ? 'No archived boards' : 'No boards yet'}
            </h2>
            <p className="text-sm text-surface-400 mb-6 max-w-xs">
              {showArchived
                ? 'Archived boards will appear here.'
                : 'Create your first board to start capturing ideas, notes, and links.'}
            </p>
            {!showArchived && (
              <Button onClick={() => setShowCreate(true)} style={{ background: '#FF5F1F' }}>
                Create first board
              </Button>
            )}
          </div>
        )}

        {/* My boards */}
        {myBoards.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-4">
              My boards
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myBoards.map(board => (
                <BoardCard
                  key={board.id}
                  board={board}
                  isOwner
                  onArchive={() => handleArchive(board)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Shared with me */}
        {sharedBoards.length > 0 && (
          <section>
            <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-4">
              Shared with me
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedBoards.map(board => (
                <BoardCard key={board.id} board={board} isOwner={false} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Create board modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); resetForm(); }}
        title="New idea board"
        size="md"
      >
        <div className="space-y-4">
          {/* Emoji + title row */}
          <div className="flex gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl cursor-default shrink-0"
                style={{ background: newColor + '22', border: `2px solid ${newColor}40` }}>
                {newEmoji}
              </div>
            </div>
            <Input
              label="Board name"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="My ideas…"
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          {/* Emoji picker */}
          <div>
            <p className="text-xs text-surface-500 mb-2">Emoji</p>
            <div className="flex flex-wrap gap-2">
              {BOARD_EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setNewEmoji(e)}
                  className={cn(
                    'w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all',
                    newEmoji === e
                      ? 'bg-surface-700 ring-2 ring-white/30 scale-110'
                      : 'bg-surface-800 hover:bg-surface-700'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <p className="text-xs text-surface-500 mb-2">Color</p>
            <div className="flex flex-wrap gap-2">
              {BOARD_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-full transition-all',
                    newColor === c ? 'ring-2 ring-offset-2 ring-offset-surface-900 ring-white scale-110' : 'hover:scale-105'
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-surface-500 block mb-1">Description (optional)</label>
            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="What's this board for?"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-surface-800 border border-surface-700 rounded-lg text-white placeholder-surface-500 focus:outline-none focus:border-surface-500 resize-none"
            />
          </div>

          {/* Link to project */}
          {projects.length > 0 && (
            <div>
              <label className="text-xs text-surface-500 block mb-1">Link to project (optional)</label>
              <select
                value={newProjectId}
                onChange={e => setNewProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface-800 border border-surface-700 rounded-lg text-white focus:outline-none focus:border-surface-500"
              >
                <option value="">No project link</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setShowCreate(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || creating}
              style={{ background: '#FF5F1F' }}
            >
              {creating ? 'Creating…' : 'Create board'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Board card ───────────────────────────────────────────────

function BoardCard({
  board,
  isOwner,
  onArchive,
}: {
  board: Board;
  isOwner: boolean;
  onArchive?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group relative">
      <Link
        href={`/idea-boards/${board.id}`}
        className="block rounded-2xl border border-surface-800 hover:border-surface-700 transition-all duration-200 overflow-hidden"
        style={{ background: '#0d0d1a' }}
      >
        {/* Color bar */}
        <div className="h-1.5 w-full" style={{ background: board.color }} />

        <div className="p-4">
          {/* Emoji + title */}
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl shrink-0">{board.emoji}</span>
            <div className="min-w-0">
              <h3 className="font-bold text-white truncate leading-tight">{board.title}</h3>
              {board.description && (
                <p className="text-xs text-surface-400 mt-0.5 line-clamp-2 leading-relaxed">
                  {board.description}
                </p>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {board.member_count > 1 && (
                <span className="text-[10px] font-mono text-surface-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {board.member_count}
                </span>
              )}
              {board.linked_project_title && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    background: (board.linked_project_color || '#6366f1') + '22',
                    color: board.linked_project_color || '#6366f1',
                  }}
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  {board.linked_project_title}
                </span>
              )}
            </div>
            <span className="text-[10px] text-surface-600">
              {new Date(board.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>
      </Link>

      {/* Owner-only context menu */}
      {isOwner && onArchive && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              onClick={e => { e.preventDefault(); setMenuOpen(v => !v); }}
              className="p-1.5 rounded-lg bg-surface-900/80 hover:bg-surface-800 border border-surface-700 text-surface-400 hover:text-white transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-surface-900 border border-surface-700 rounded-xl shadow-xl py-1.5 min-w-[130px]">
                  <button
                    onClick={e => { e.preventDefault(); setMenuOpen(false); onArchive(); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800 hover:text-white transition-colors"
                  >
                    {board.is_archived ? 'Restore board' : 'Archive board'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
