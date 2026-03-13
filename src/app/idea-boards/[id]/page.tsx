'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/AppHeader';
import { Button, Input, Modal, LoadingPage, toast } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────

type NodeType = 'heading' | 'text' | 'checklist' | 'divider' | 'project_link';

type IdeaNode = {
  id: string;
  board_id: string;
  type: NodeType;
  content: Record<string, unknown>;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Board = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  emoji: string;
  color: string;
  is_archived: boolean;
  linked_project_id: string | null;
  linked_project_title?: string | null;
  linked_project_color?: string | null;
  parent_id: string | null;
  root_board_id: string | null;
};

type ChildBoard = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  description: string | null;
};

type Member = {
  id: string;
  user_id: string;
  role: 'editor' | 'viewer';
  profiles: { full_name: string | null; avatar_url: string | null; email?: string } | null;
};

type Project = { id: string; title: string };

// ── Constants ────────────────────────────────────────────────

const BOARD_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#FF5F1F', '#84cc16',
];
const BOARD_EMOJIS = ['💡', '🎬', '📝', '🎭', '🌟', '🔥', '🎯', '🧠', '✨', '🎨', '📖', '🚀'];

// ── Helpers ──────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function getNodeText(node: IdeaNode): string {
  if (node.type === 'divider') return '';
  if (node.type === 'project_link') return (node.content.project_title as string) || '';
  return (node.content.text as string) || '';
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Page ─────────────────────────────────────────────────────

export default function BoardPage({ params }: { params: { id: string } }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const boardId = params.id;

  const [board, setBoard] = useState<Board | null>(null);
  const [nodes, setNodes] = useState<IdeaNode[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isEditor, setIsEditor] = useState(false);

  // UI state
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  // Invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);

  // Settings draft
  const [settingsEmoji, setSettingsEmoji] = useState('💡');
  const [settingsColor, setSettingsColor] = useState('#6366f1');
  const [settingsDesc, setSettingsDesc] = useState('');
  const [settingsProjectId, setSettingsProjectId] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Project link picker (for project_link nodes)
  const [projectPickerNodeId, setProjectPickerNodeId] = useState<string | null>(null);

  // Focus control: after addNode, focus the new node's editor
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  // Nesting / folder
  const [childBoards, setChildBoards] = useState<ChildBoard[]>([]);
  const [parentBoard, setParentBoard] = useState<{ id: string; title: string; emoji: string } | null>(null);
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [subTitle, setSubTitle] = useState('');
  const [subEmoji, setSubEmoji] = useState('💡');
  const [subColor, setSubColor] = useState('#6366f1');
  const [creatingSubBoard, setCreatingSubBoard] = useState(false);

  const fetchBoard = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('idea_boards_with_meta')
      .select('*')
      .eq('id', boardId)
      .single();
    if (error || !data) { router.push('/idea-boards'); return; }
    setBoard(data as Board);
    setTitleDraft(data.title);
    setSettingsEmoji(data.emoji || '💡');
    setSettingsColor(data.color || '#6366f1');
    setSettingsDesc(data.description || '');
    setSettingsProjectId(data.linked_project_id || '');
  }, [boardId, router]);

  const fetchNodes = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('idea_nodes')
      .select('*')
      .eq('board_id', boardId)
      .order('sort_order');
    setNodes((data ?? []) as IdeaNode[]);
  }, [boardId]);

  const fetchMembers = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('idea_board_members')
      .select('*, profiles(full_name, avatar_url)')
      .eq('board_id', boardId);
    setMembers((data ?? []) as Member[]);
  }, [boardId]);

  const fetchProjects = useCallback(async () => {
    if (!user?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('projects')
      .select('id, title')
      .order('title');
    setProjects((data ?? []) as Project[]);
  }, [user?.id]);

  const fetchChildBoards = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('idea_boards')
      .select('id, title, emoji, color, description')
      .eq('parent_id', boardId)
      .order('created_at');
    setChildBoards((data ?? []) as ChildBoard[]);
  }, [boardId]);

  const fetchParentBoard = useCallback(async (parentId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('idea_boards')
      .select('id, title, emoji')
      .eq('id', parentId)
      .single();
    if (data) setParentBoard(data as { id: string; title: string; emoji: string });
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!authLoading && user) {
      Promise.all([fetchBoard(), fetchNodes(), fetchMembers(), fetchProjects(), fetchChildBoards()])
        .finally(() => setLoading(false));
    }
  }, [authLoading, user, fetchBoard, fetchNodes, fetchMembers, fetchProjects, fetchChildBoards, router]);

  // Fetch parent board info for breadcrumb once board is loaded
  useEffect(() => {
    if (board?.parent_id) fetchParentBoard(board.parent_id);
  }, [board?.parent_id, fetchParentBoard]);

  // Determine roles
  useEffect(() => {
    if (!board || !user) return;
    const mine = board.owner_id === user.id;
    setIsOwner(mine);
    const mem = members.find(m => m.user_id === user.id);
    setIsEditor(mine || mem?.role === 'editor');
  }, [board, user, members]);

  // ── Node CRUD ─────────────────────────────────────────────

  const addNode = async (type: NodeType, afterIndex?: number) => {
    if (!isEditor || !user) return;
    const supabase = createClient();
    const sortedNodes = [...nodes].sort((a, b) => a.sort_order - b.sort_order);
    const insertAfter = afterIndex !== undefined ? sortedNodes[afterIndex] : sortedNodes[sortedNodes.length - 1];
    const nextNode = afterIndex !== undefined ? sortedNodes[afterIndex + 1] : undefined;

    let newSortOrder: number;
    if (!insertAfter) {
      newSortOrder = 1000;
    } else if (nextNode) {
      newSortOrder = (insertAfter.sort_order + nextNode.sort_order) / 2;
    } else {
      newSortOrder = insertAfter.sort_order + 1000;
    }

    const defaultContent: Record<string, unknown> =
      type === 'checklist' ? { text: '', checked: false }
      : type === 'divider' ? {}
      : type === 'project_link' ? { project_id: null, project_title: '' }
      : { text: '' };

    const { data, error } = await supabase
      .from('idea_nodes')
      .insert({ board_id: boardId, type, content: defaultContent, sort_order: newSortOrder, created_by: user.id })
      .select()
      .single();
    if (error) { toast.error('Failed to add node'); return; }
    setNodes(prev => [...prev, data as IdeaNode].sort((a, b) => a.sort_order - b.sort_order));
    setPendingFocusId((data as IdeaNode).id);

    // Open project picker for project_link nodes
    if (type === 'project_link') setProjectPickerNodeId((data as IdeaNode).id);
  };

  const updateNodeContent = async (nodeId: string, content: Record<string, unknown>) => {
    const supabase = createClient();
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, content } : n));
    await supabase.from('idea_nodes').update({ content }).eq('id', nodeId);
  };

  const deleteNode = async (nodeId: string) => {
    const supabase = createClient();
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    await supabase.from('idea_nodes').delete().eq('id', nodeId);
  };

  const moveNode = async (nodeId: string, direction: 'up' | 'down') => {
    const sorted = [...nodes].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(n => n.id === nodeId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];
    const supabase = createClient();
    await Promise.all([
      supabase.from('idea_nodes').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('idea_nodes').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    setNodes(prev => prev.map(n => {
      if (n.id === a.id) return { ...n, sort_order: b.sort_order };
      if (n.id === b.id) return { ...n, sort_order: a.sort_order };
      return n;
    }).sort((x, y) => x.sort_order - y.sort_order));
  };

  // ── Board mutation ────────────────────────────────────────

  const saveTitle = async () => {
    if (!board || !titleDraft.trim()) return;
    setEditingTitle(false);
    if (titleDraft.trim() === board.title) return;
    const supabase = createClient();
    const { error } = await supabase.from('idea_boards').update({ title: titleDraft.trim() }).eq('id', boardId);
    if (error) { toast.error('Failed to save title'); return; }
    setBoard(b => b ? { ...b, title: titleDraft.trim() } : b);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    const supabase = createClient();
    const { error } = await supabase.from('idea_boards').update({
      emoji: settingsEmoji,
      color: settingsColor,
      description: settingsDesc.trim() || null,
      linked_project_id: settingsProjectId || null,
    }).eq('id', boardId);
    setSavingSettings(false);
    if (error) { toast.error('Failed to save settings'); return; }
    toast.success('Board updated');
    setShowSettings(false);
    fetchBoard();
  };

  // ── Invite ────────────────────────────────────────────────

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const supabase = createClient();
    // Look up user by email via profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', inviteEmail.trim().toLowerCase())
      .single();
    if (!profile) { toast.error('No user found with that email'); setInviting(false); return; }
    const { error } = await supabase.from('idea_board_members').insert({
      board_id: boardId,
      user_id: profile.id,
      role: inviteRole,
      invited_by: user?.id,
    });
    setInviting(false);
    if (error?.code === '23505') { toast.error('Already a member'); return; }
    if (error) { toast.error('Failed to add member'); return; }
    toast.success('Member added!');
    setInviteEmail('');
    fetchMembers();
  };

  const changeNodeType = async (nodeId: string, newType: NodeType) => {
    const existing = nodes.find(n => n.id === nodeId);
    if (!existing) return;
    const html = (existing.content.html as string) ?? escapeHtml((existing.content.text as string) ?? '');
    const text = (existing.content.text as string) ?? '';
    const newContent: Record<string, unknown> =
      newType === 'checklist' ? { html, text, checked: false }
      : newType === 'divider' ? {}
      : newType === 'project_link' ? { project_id: null, project_title: '' }
      : { html, text };
    const supabase = createClient();
    await supabase.from('idea_nodes').update({ type: newType, content: newContent }).eq('id', nodeId);
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, type: newType, content: newContent } : n));
    setPendingFocusId(nodeId);
  };

  const removeMember = async (memberId: string) => {
    const supabase = createClient();
    await supabase.from('idea_board_members').delete().eq('id', memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
    toast.success('Member removed');
  };

  const createSubBoard = async () => {
    if (!subTitle.trim() || !user?.id || !board) return;
    setCreatingSubBoard(true);
    const supabase = createClient();
    const rootId = board.root_board_id ?? board.id;
    const { data, error } = await supabase
      .from('idea_boards')
      .insert({
        owner_id: user.id,
        title: subTitle.trim(),
        emoji: subEmoji,
        color: subColor,
        parent_id: boardId,
        root_board_id: rootId,
      })
      .select('id')
      .single();
    setCreatingSubBoard(false);
    if (error) { toast.error('Failed to create sub-board'); return; }
    toast.success('Sub-board created!');
    setShowCreateSub(false);
    setSubTitle('');
    setSubEmoji('💡');
    setSubColor('#6366f1');
    router.push(`/idea-boards/${data.id}`);
  };

  if (authLoading || loading) return <LoadingPage />;
  if (!board) return null;

  const sortedNodes = [...nodes].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="min-h-screen" style={{ background: '#070710' }}>
      <AppHeader
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMembers(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-400 hover:text-white border border-surface-700 hover:border-surface-600 rounded-lg transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {members.length + 1}
            </button>
            {isOwner && (
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-surface-400 hover:text-white border border-surface-700 hover:border-surface-600 rounded-lg transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </button>
            )}
          </div>
        }
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-surface-500 mb-8 flex-wrap">
          <Link href="/idea-boards" className="hover:text-white transition-colors">All boards</Link>
          {parentBoard && (
            <>
              <span className="text-surface-700">/</span>
              <Link
                href={`/idea-boards/${parentBoard.id}`}
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                <span>{parentBoard.emoji}</span>
                <span>{parentBoard.title}</span>
              </Link>
            </>
          )}
          <span className="text-surface-700">/</span>
          <span className="text-surface-400">{board.title}</span>
        </div>

        {/* Board header */}
        <div className="mb-8">
          {/* Color bar */}
          <div className="w-12 h-1 rounded-full mb-4" style={{ background: board.color }} />

          <div className="flex items-start gap-3">
            <span className="text-4xl leading-none mt-0.5">{board.emoji}</span>
            <div className="flex-1 min-w-0">
              {editingTitle && isOwner ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(board.title); } }}
                  className="w-full text-3xl font-black text-white bg-transparent border-b border-surface-600 focus:outline-none focus:border-white pb-1"
                />
              ) : (
                <h1
                  className={cn('text-3xl font-black text-white leading-tight', isOwner && 'cursor-text hover:text-white/80 transition-colors')}
                  onClick={() => isOwner && setEditingTitle(true)}
                  title={isOwner ? 'Click to rename' : undefined}
                >
                  {board.title}
                </h1>
              )}
              {board.description && (
                <p className="text-sm text-surface-400 mt-1">{board.description}</p>
              )}
              {board.linked_project_title && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      background: (board.linked_project_color || '#6366f1') + '22',
                      color: board.linked_project_color || '#6366f1',
                    }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    {board.linked_project_title}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sub-boards (folders) ── */}
        {(childBoards.length > 0 || isEditor) && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-surface-600">
                Sub-boards{childBoards.length > 0 ? ` · ${childBoards.length}` : ''}
              </p>
              {isEditor && (
                <button
                  onClick={() => setShowCreateSub(true)}
                  className="text-[10px] font-mono uppercase tracking-widest text-surface-600 hover:text-white border border-surface-800 hover:border-surface-600 px-2 py-1 rounded-lg transition-all"
                >
                  + New
                </button>
              )}
            </div>
            {childBoards.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {childBoards.map(child => (
                  <Link
                    key={child.id}
                    href={`/idea-boards/${child.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-surface-800 hover:border-surface-700 transition-all"
                    style={{ background: '#0d0d1a' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
                      style={{ background: child.color + '22' }}
                    >
                      {child.emoji}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{child.title}</p>
                      {child.description && (
                        <p className="text-[11px] text-surface-500 truncate mt-0.5">{child.description}</p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-surface-700 shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
            {childBoards.length === 0 && (
              <p className="text-[11px] text-surface-700 italic">No sub-boards yet. Create one to organise ideas into folders.</p>
            )}
          </div>
        )}

        {/* ── Nodes ── */}
        <div className="space-y-1.5">
          {sortedNodes.map((node, idx) => (
            <NodeBlock
              key={node.id}
              node={node}
              idx={idx}
              total={sortedNodes.length}
              allNodes={sortedNodes}
              isEditor={isEditor}
              projects={projects}
              onUpdateContent={updateNodeContent}
              onDelete={deleteNode}
              onMove={moveNode}
              onAddAfter={(type) => addNode(type, idx)}
              onChangeType={changeNodeType}
              focusNodeId={pendingFocusId}
              onClearFocus={() => setPendingFocusId(null)}
              projectPickerNodeId={projectPickerNodeId}
              setProjectPickerNodeId={setProjectPickerNodeId}
            />
          ))}
        </div>

        {/* ── Add node toolbar ── */}
        {isEditor && (
          <div className="mt-6 pt-4 border-t border-surface-800">
            <p className="text-[10px] font-mono uppercase tracking-widest text-surface-600 mb-3">Add block</p>
            <div className="flex flex-wrap gap-2">
              {[
                { type: 'heading' as NodeType, icon: 'H', label: 'Heading' },
                { type: 'text' as NodeType, icon: '¶', label: 'Text' },
                { type: 'checklist' as NodeType, icon: '☑', label: 'Checklist' },
                { type: 'divider' as NodeType, icon: '—', label: 'Divider' },
                { type: 'project_link' as NodeType, icon: '⎇', label: 'Project link' },
              ].map(({ type, icon, label }) => (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-surface-400 hover:text-white bg-surface-900 hover:bg-surface-800 border border-surface-700 hover:border-surface-600 rounded-lg transition-all"
                >
                  <span className="font-mono text-surface-500">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {sortedNodes.length === 0 && isEditor && (
          <div className="py-16 text-center border border-dashed border-surface-800 rounded-2xl">
            <div className="text-4xl mb-3">✏️</div>
            <p className="text-surface-400 text-sm mb-1">Start typing your ideas</p>
            <p className="text-surface-600 text-xs">Use the blocks above to add headings, notes, checklists, and more</p>
          </div>
        )}
        {sortedNodes.length === 0 && !isEditor && (
          <div className="py-16 text-center">
            <p className="text-surface-500 text-sm">This board is empty.</p>
          </div>
        )}
      </main>

      {/* ── Members modal ── */}
      <Modal isOpen={showMembers} onClose={() => setShowMembers(false)} title="Board members" size="md">
        <div className="space-y-4">
          {/* Owner */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-2">Owner</p>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-surface-900">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: board.color }}>
                {board.owner_id === user?.id ? (user?.full_name?.[0] || 'Y') : '?'}
              </div>
              <span className="text-sm text-white">
                {board.owner_id === user?.id ? (user?.full_name || 'You') : 'Board owner'}
              </span>
              <span className="ml-auto text-[10px] text-surface-500 font-mono">owner</span>
            </div>
          </div>

          {/* Other members */}
          {members.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-2">Members</p>
              <div className="space-y-1">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface-900">
                    <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {m.profiles?.full_name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{m.profiles?.full_name || 'Unknown'}</p>
                    </div>
                    <span className="text-[10px] text-surface-500 font-mono shrink-0">{m.role}</span>
                    {isOwner && (
                      <button
                        onClick={() => removeMember(m.id)}
                        className="p-1 text-surface-600 hover:text-red-400 transition-colors shrink-0"
                        title="Remove member"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite form */}
          {isOwner && (
            <div className="pt-2 border-t border-surface-800">
              <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-3">Invite someone</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  className="flex-1"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'editor' | 'viewer')}
                  className="px-2 py-2 text-xs bg-surface-800 border border-surface-700 rounded-lg text-white focus:outline-none"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || inviting}
                  style={{ background: '#FF5F1F' }}
                >
                  {inviting ? '…' : 'Add'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Settings modal ── */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Board settings" size="md">
        <div className="space-y-4">
          {/* Emoji */}
          <div>
            <p className="text-xs text-surface-500 mb-2">Emoji</p>
            <div className="flex flex-wrap gap-2">
              {BOARD_EMOJIS.map(e => (
                <button key={e} onClick={() => setSettingsEmoji(e)}
                  className={cn('w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all',
                    settingsEmoji === e ? 'bg-surface-700 ring-2 ring-white/30 scale-110' : 'bg-surface-800 hover:bg-surface-700')}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          {/* Color */}
          <div>
            <p className="text-xs text-surface-500 mb-2">Color</p>
            <div className="flex flex-wrap gap-2">
              {BOARD_COLORS.map(c => (
                <button key={c} onClick={() => setSettingsColor(c)}
                  className={cn('w-7 h-7 rounded-full transition-all',
                    settingsColor === c ? 'ring-2 ring-offset-2 ring-offset-surface-900 ring-white scale-110' : 'hover:scale-105')}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          {/* Description */}
          <div>
            <label className="text-xs text-surface-500 block mb-1">Description</label>
            <textarea value={settingsDesc} onChange={e => setSettingsDesc(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm bg-surface-800 border border-surface-700 rounded-lg text-white placeholder-surface-500 focus:outline-none focus:border-surface-500 resize-none" />
          </div>
          {/* Link project */}
          {projects.length > 0 && (
            <div>
              <label className="text-xs text-surface-500 block mb-1">Link to project</label>
              <select value={settingsProjectId} onChange={e => setSettingsProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface-800 border border-surface-700 rounded-lg text-white focus:outline-none focus:border-surface-500">
                <option value="">No project link</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={saveSettings} disabled={savingSettings} style={{ background: '#FF5F1F' }}>
              {savingSettings ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Create sub-board modal ── */}
      <Modal isOpen={showCreateSub} onClose={() => setShowCreateSub(false)} title="New sub-board" size="md">
        <div className="space-y-4">
          <p className="text-xs text-surface-500">Sub-boards live inside this board and can nest infinitely — use them like folders for ideas.</p>
          {/* Emoji + title */}
          <div className="flex gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: subColor + '22', border: `2px solid ${subColor}40` }}
            >
              {subEmoji}
            </div>
            <Input
              label="Board name"
              value={subTitle}
              onChange={e => setSubTitle(e.target.value)}
              placeholder="My ideas…"
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && createSubBoard()}
              autoFocus
            />
          </div>
          {/* Emoji picker */}
          <div>
            <p className="text-xs text-surface-500 mb-2">Emoji</p>
            <div className="flex flex-wrap gap-2">
              {BOARD_EMOJIS.map(e => (
                <button key={e} onClick={() => setSubEmoji(e)}
                  className={cn('w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all',
                    subEmoji === e ? 'bg-surface-700 ring-2 ring-white/30 scale-110' : 'bg-surface-800 hover:bg-surface-700')}>
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
                <button key={c} onClick={() => setSubColor(c)}
                  className={cn('w-7 h-7 rounded-full transition-all',
                    subColor === c ? 'ring-2 ring-offset-2 ring-offset-surface-900 ring-white scale-110' : 'hover:scale-105')}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowCreateSub(false)}>Cancel</Button>
            <Button onClick={createSubBoard} disabled={!subTitle.trim() || creatingSubBoard} style={{ background: '#FF5F1F' }}>
              {creatingSubBoard ? 'Creating…' : 'Create sub-board'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Node block component ─────────────────────────────────────

function NodeBlock({
  node, idx, total, allNodes, isEditor, projects,
  onUpdateContent, onDelete, onMove, onAddAfter,
  onChangeType, focusNodeId, onClearFocus,
  projectPickerNodeId, setProjectPickerNodeId,
}: {
  node: IdeaNode;
  idx: number;
  total: number;
  allNodes: IdeaNode[];
  isEditor: boolean;
  projects: Project[];
  onUpdateContent: (id: string, content: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
  onAddAfter: (type: NodeType) => void;
  onChangeType: (id: string, type: NodeType) => void;
  focusNodeId: string | null;
  onClearFocus: () => void;
  projectPickerNodeId: string | null;
  setProjectPickerNodeId: (id: string | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the current HTML independently of node.content (avoids stale closure)
  const htmlRef = useRef(
    (node.content.html as string) ?? escapeHtml((node.content.text as string) ?? '')
  );

  // (Re-)initialise contentEditable whenever node type changes (new DOM element mounted)
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = htmlRef.current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.type]);

  // Focus when parent requests it (after addNode or changeNodeType)
  useEffect(() => {
    if (focusNodeId !== node.id || !editorRef.current) return;
    editorRef.current.focus();
    try {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch {/* ignore */}
    onClearFocus();
  }, [focusNodeId, node.id, onClearFocus]);

  const scheduleSave = (html: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const text = editorRef.current?.innerText ?? '';
      const extras = node.type === 'checklist' ? { checked: node.content.checked ?? false } : {};
      onUpdateContent(node.id, { html, text, ...extras });
    }, 600);
  };

  const handleInput = () => {
    const html = editorRef.current?.innerHTML ?? '';
    htmlRef.current = html;
    scheduleSave(html);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isEditor) return;

    // Enter → add node below
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (node.type === 'checklist') {
        const text = (editorRef.current?.innerText ?? '').trim();
        onAddAfter(text ? 'checklist' : 'text');
      } else if (node.type === 'heading') {
        onAddAfter('text');
      } else {
        onAddAfter('text');
      }
      return;
    }

    // Backspace on empty node → delete it
    if (e.key === 'Backspace' && (editorRef.current?.innerText ?? '').trim() === '') {
      e.preventDefault();
      onDelete(node.id);
      return;
    }

    // Tab → cycle type: heading → text → checklist → heading
    if (e.key === 'Tab') {
      e.preventDefault();
      const html = editorRef.current?.innerHTML ?? '';
      const text = editorRef.current?.innerText ?? '';
      htmlRef.current = html;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const extras = node.type === 'checklist' ? { checked: node.content.checked ?? false } : {};
      onUpdateContent(node.id, { html, text, ...extras });
      const cycle: Partial<Record<NodeType, NodeType>> = { heading: 'text', text: 'checklist', checklist: 'heading' };
      const next = cycle[node.type];
      if (next) onChangeType(node.id, next);
      return;
    }

    // Formatting shortcuts
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'b') { e.preventDefault(); document.execCommand('bold', false); return; }
      if (e.key === 'i') { e.preventDefault(); document.execCommand('italic', false); return; }
      if (e.key === 'u') { e.preventDefault(); document.execCommand('underline', false); return; }
    }
  };

  // ── Divider ──────────────────────────────────────────────

  if (node.type === 'divider') {
    // If next node is a heading followed by checklists, show a progress bar
    let pct: number | null = null;
    if (allNodes[idx + 1]?.type === 'heading') {
      const checklists: IdeaNode[] = [];
      for (let i = idx + 2; i < allNodes.length; i++) {
        if (allNodes[i].type === 'checklist') checklists.push(allNodes[i]);
        else break;
      }
      if (checklists.length > 0) {
        const done = checklists.filter(n => n.content.checked).length;
        pct = Math.round((done / checklists.length) * 100);
      }
    }

    return (
      <div
        className="relative group/node flex items-center gap-2 py-2"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {pct === null ? (
          <div className="flex-1 h-px bg-surface-800" />
        ) : (
          <div className="flex-1 h-1 rounded-full bg-surface-800 overflow-hidden" title={`${pct}% complete`}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? '#10b981' : 'linear-gradient(90deg, #10b981, #34d399)',
              }}
            />
          </div>
        )}
        {pct !== null && (
          <span
            className="text-[10px] font-mono tabular-nums shrink-0"
            style={{ color: pct === 100 ? '#10b981' : '#4b5563' }}
          >
            {pct}%
          </span>
        )}
        {isEditor && hovered && (
          <NodeControls idx={idx} total={total} nodeId={node.id} onMove={onMove} onDelete={onDelete} onAddAfter={onAddAfter} addMenuOpen={addMenuOpen} setAddMenuOpen={setAddMenuOpen} />
        )}
      </div>
    );
  }

  // ── Project link ─────────────────────────────────────────

  if (node.type === 'project_link') {
    const hasPick = node.content.project_id || projectPickerNodeId === node.id;
    return (
      <div
        className="group/node relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {projectPickerNodeId === node.id ? (
          <div className="rounded-xl border border-surface-700 bg-surface-900 p-3">
            <p className="text-xs text-surface-400 mb-2">Pick a project to link</p>
            <div className="space-y-1">
              {projects.map(p => (
                <button key={p.id}
                  onClick={() => { onUpdateContent(node.id, { project_id: p.id, project_title: p.title }); setProjectPickerNodeId(null); }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-800 transition-colors"
                >
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#6366f1' }} />
                  <span className="text-sm text-white">{p.title}</span>
                </button>
              ))}
              {projects.length === 0 && <p className="text-xs text-surface-500 px-2">No projects found.</p>}
            </div>
            <button onClick={() => setProjectPickerNodeId(null)} className="mt-2 text-xs text-surface-500 hover:text-white transition-colors">Cancel</button>
          </div>
        ) : (
          <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
            node.content.project_id ? 'border-surface-700 bg-surface-900 hover:border-surface-600' : 'border-dashed border-surface-700 bg-surface-900/50')}>
            {node.content.project_id ? (
              <>
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: '#6366f1' }} />
                <Link href={`/projects/${node.content.project_id}`} className="text-sm font-medium text-white hover:underline flex-1 truncate">
                  {node.content.project_title as string}
                </Link>
                {isEditor && (
                  <button onClick={() => setProjectPickerNodeId(node.id)} className="text-xs text-surface-500 hover:text-white transition-colors shrink-0">Change</button>
                )}
              </>
            ) : (
              <button onClick={() => isEditor && setProjectPickerNodeId(node.id)} className="text-sm text-surface-500 hover:text-surface-300 transition-colors">
                + Link a project
              </button>
            )}
          </div>
        )}
        {isEditor && hovered && !hasPick && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <NodeControls idx={idx} total={total} nodeId={node.id} onMove={onMove} onDelete={onDelete} onAddAfter={onAddAfter} addMenuOpen={addMenuOpen} setAddMenuOpen={setAddMenuOpen} />
          </div>
        )}
        {isEditor && hovered && !!node.content.project_id && (
          <div className="absolute right-16 top-1/2 -translate-y-1/2">
            <NodeControls idx={idx} total={total} nodeId={node.id} onMove={onMove} onDelete={onDelete} onAddAfter={onAddAfter} addMenuOpen={addMenuOpen} setAddMenuOpen={setAddMenuOpen} />
          </div>
        )}
      </div>
    );
  }

  // ── Checklist ────────────────────────────────────────────

  if (node.type === 'checklist') {
    return (
      <div
        className="group/node relative flex items-start gap-3 px-1 py-0.5 rounded-lg hover:bg-surface-900/40 transition-colors"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          onClick={() => isEditor && onUpdateContent(node.id, { ...node.content, html: htmlRef.current, text: editorRef.current?.innerText ?? '', checked: !node.content.checked })}
          className={cn('mt-2 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all',
            (node.content.checked as boolean) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-surface-600 hover:border-surface-400')}
        >
          {(node.content.checked as boolean) && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div
          ref={editorRef}
          contentEditable={isEditor}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          data-placeholder="To-do item…"
          className={cn(
            'flex-1 mt-1.5 text-sm bg-transparent text-white focus:outline-none leading-relaxed min-h-[24px]',
            (node.content.checked as boolean) && 'line-through text-surface-500'
          )}
        />
        {isEditor && isFocused && (
          <FormatBar />
        )}
        {isEditor && hovered && (
          <div className="shrink-0 mt-1">
            <NodeControls idx={idx} total={total} nodeId={node.id} onMove={onMove} onDelete={onDelete} onAddAfter={onAddAfter} addMenuOpen={addMenuOpen} setAddMenuOpen={setAddMenuOpen} />
          </div>
        )}
      </div>
    );
  }

  // ── Heading / Text ───────────────────────────────────────

  const isHeading = node.type === 'heading';

  return (
    <div
      className="group/node relative flex items-start gap-2 px-1 py-0.5 rounded-lg hover:bg-surface-900/40 transition-colors"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={editorRef}
        contentEditable={isEditor}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        data-placeholder={isHeading ? 'Heading…' : 'Start typing…'}
        className={cn(
          'flex-1 bg-transparent text-white focus:outline-none leading-relaxed w-full min-h-[24px]',
          isHeading ? 'text-xl font-bold mt-0.5 min-h-[32px]' : 'text-sm mt-1.5'
        )}
      />
      {isEditor && isFocused && <FormatBar />}
      {isEditor && hovered && (
        <div className="shrink-0 mt-1">
          <NodeControls idx={idx} total={total} nodeId={node.id} onMove={onMove} onDelete={onDelete} onAddAfter={onAddAfter} addMenuOpen={addMenuOpen} setAddMenuOpen={setAddMenuOpen} />
        </div>
      )}
    </div>
  );
}

// ── Format bar ───────────────────────────────────────────────

function FormatBar() {
  const fmt = (cmd: string) => { document.execCommand(cmd, false); };
  return (
    <div className="flex items-center gap-0.5 shrink-0 mt-1">
      <button onMouseDown={e => { e.preventDefault(); fmt('bold'); }}
        className="w-6 h-6 flex items-center justify-center text-xs font-bold text-surface-500 hover:text-white hover:bg-surface-800 rounded transition-colors"
        title="Bold (⌘B)">
        B
      </button>
      <button onMouseDown={e => { e.preventDefault(); fmt('italic'); }}
        className="w-6 h-6 flex items-center justify-center text-xs italic text-surface-500 hover:text-white hover:bg-surface-800 rounded transition-colors"
        title="Italic (⌘I)">
        I
      </button>
      <button onMouseDown={e => { e.preventDefault(); fmt('underline'); }}
        className="w-6 h-6 flex items-center justify-center text-xs underline text-surface-500 hover:text-white hover:bg-surface-800 rounded transition-colors"
        title="Underline (⌘U)">
        U
      </button>
    </div>
  );
}

// ── Node controls ────────────────────────────────────────────

function NodeControls({
  idx, total, nodeId, onMove, onDelete, onAddAfter, addMenuOpen, setAddMenuOpen,
}: {
  idx: number;
  total: number;
  nodeId: string;
  onMove: (id: string, dir: 'up' | 'down') => void;
  onDelete: (id: string) => void;
  onAddAfter: (type: NodeType) => void;
  addMenuOpen: boolean;
  setAddMenuOpen: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {idx > 0 && (
        <button
          onClick={() => onMove(nodeId, 'up')}
          className="p-1 text-surface-600 hover:text-white rounded transition-colors"
          title="Move up"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
      {idx < total - 1 && (
        <button
          onClick={() => onMove(nodeId, 'down')}
          className="p-1 text-surface-600 hover:text-white rounded transition-colors"
          title="Move down"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Insert block after */}
      <div className="relative">
        <button
          onClick={() => setAddMenuOpen(!addMenuOpen)}
          className="p-1 text-surface-600 hover:text-white rounded transition-colors"
          title="Insert block below"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        {addMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-surface-900 border border-surface-700 rounded-xl shadow-xl py-1.5 min-w-[130px]">
              <p className="px-3 py-1 text-[10px] text-surface-600 uppercase tracking-wider">Insert below</p>
              {(['heading', 'text', 'checklist', 'divider', 'project_link'] as NodeType[]).map(t => (
                <button
                  key={t}
                  onClick={() => { onAddAfter(t); setAddMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800 hover:text-white transition-colors capitalize"
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => onDelete(nodeId)}
        className="p-1 text-surface-600 hover:text-red-400 rounded transition-colors"
        title="Delete block"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
