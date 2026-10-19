'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Columns3, ExternalLink, History, LayoutGrid, Loader2, MoreHorizontal, Network, Pencil, Plus, Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Button, ConfirmDialog, Input, Modal, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { CinderraFrame } from './CinderraFrame';

/**
 * The visual tools — mind map, mood board, idea boards, company boards — as
 * Cinderra boards embedded with Screenplay Studio's theme.
 *
 * One component for all of them: a strip of board tabs, a "New" menu, and
 * the active board in a CinderraFrame. Which boards exist and who may change
 * them comes from /api/cinderra/boards, which checks project or company
 * membership; the boards themselves live in Cinderra.
 *
 * Until Cinderra is configured on the server (CINDERRA_PARTNER_SECRET), the
 * `fallback` is rendered instead, so a deploy that is ahead of its
 * environment keeps the old tool working rather than showing an error.
 */

export type CinderraScope = 'project' | 'company' | 'user';
export type CinderraTool = 'mindmap' | 'moodboard' | 'ideas' | 'board';
export type CinderraKind = 'freeform' | 'kanban' | 'mindmap';

export interface CinderraBoardRow {
  id: string;
  tool: CinderraTool;
  cinderra_board_id: string;
  title: string;
  kind: CinderraKind;
  icon: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ListResponse {
  configured: boolean;
  cinderraUrl: string;
  access: { role: string; canCreate: boolean; canManage: boolean };
  userId: string;
  boards: CinderraBoardRow[];
}

const KINDS: Record<CinderraKind, { label: string; blurb: string; icon: LucideIcon }> = {
  freeform: { label: 'Board', blurb: 'Notes, images, links and drawings, anywhere on an infinite canvas.', icon: LayoutGrid },
  mindmap: { label: 'Mind map', blurb: 'One idea in the middle, everything else branching off it.', icon: Network },
  kanban: { label: 'Kanban', blurb: 'Columns you drag cards between.', icon: Columns3 },
};

const storageKey = (scope: string, scopeId: string, tool: string) => `sps:cinderra:${scope}:${scopeId}:${tool}`;

function remember(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}
function recall(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function CinderraBoards({
  scope,
  scopeId,
  tool,
  label,
  icon: Icon,
  kinds = ['freeform', 'mindmap', 'kanban'],
  autoCreate = false,
  fallback,
  legacy,
  className,
  headerExtra,
}: {
  scope: CinderraScope;
  scopeId: string;
  tool: CinderraTool;
  /** What this tool is called: "Mind map", "Mood board", "Boards". */
  label: string;
  icon: LucideIcon;
  /** Kinds offered under "New". The first is the default. */
  kinds?: CinderraKind[];
  /** Make the first board on first visit instead of showing an empty state. */
  autoCreate?: boolean;
  /** Rendered instead when Cinderra is not configured on the server. */
  fallback?: ReactNode;
  /** A link to the previous version of this tool, whose data was not moved. */
  legacy?: { href?: string; onClick?: () => void; label: string };
  className?: string;
  headerExtra?: ReactNode;
}) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState<CinderraBoardRow | null>(null);
  const [renameText, setRenameText] = useState('');
  const [deleting, setDeleting] = useState<CinderraBoardRow | null>(null);
  const [busy, setBusy] = useState(false);
  const autoCreated = useRef(false);
  const key = storageKey(scope, scopeId, tool);

  const boards = useMemo(() => data?.boards ?? [], [data]);
  const active = boards.find((b) => b.id === activeId) ?? null;
  const canChange = (b: CinderraBoardRow | null) =>
    Boolean(b && data && data.access.canCreate && (data.access.canManage || b.created_by === data.userId));

  const select = useCallback((id: string) => {
    setActiveId(id);
    remember(key, id);
  }, [key]);

  const create = useCallback(async (kind: CinderraKind, title?: string) => {
    setCreating(true);
    setNewOpen(false);
    try {
      const res = await fetch('/api/cinderra/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, scopeId, tool, kind, title }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not create the board');
      const row = json.board as CinderraBoardRow;
      setData((d) => (d ? { ...d, boards: [...d.boards, row] } : d));
      select(row.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the board');
    } finally {
      setCreating(false);
    }
  }, [scope, scopeId, tool, select]);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch(`/api/cinderra/boards?scope=${scope}&scopeId=${scopeId}&tool=${tool}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not load boards');
      const list = json as ListResponse;
      setData(list);
      const saved = recall(key);
      const pick = list.boards.find((b) => b.id === saved) ?? list.boards[0];
      setActiveId(pick?.id ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load boards');
    }
  }, [scope, scopeId, tool, key]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoCreate || autoCreated.current || !data?.configured) return;
    if (data.boards.length === 0 && data.access.canCreate) {
      autoCreated.current = true;
      create(kinds[0], label);
    }
  }, [autoCreate, data, create, kinds, label]);

  const rename = async () => {
    if (!renaming || !renameText.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/cinderra/boards/${renaming.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: renameText.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { toast.error(json.error || 'Could not rename the board'); return; }
    setData((d) => d ? { ...d, boards: d.boards.map((b) => (b.id === renaming.id ? { ...b, title: json.board.title } : b)) } : d);
    setRenaming(null);
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    const res = await fetch(`/api/cinderra/boards/${deleting.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { toast.error(json.error || 'Could not delete the board'); return; }
    const rest = boards.filter((b) => b.id !== deleting.id);
    setData((d) => (d ? { ...d, boards: rest } : d));
    if (activeId === deleting.id) setActiveId(rest[0]?.id ?? null);
    setDeleting(null);
    toast.success('Board deleted');
  };

  // A rename made inside the frame. Shown at once; the server catches up the
  // next time the list loads.
  const onFrameTitle = useCallback((title: string) => {
    if (!activeId) return;
    setData((d) => d ? { ...d, boards: d.boards.map((b) => (b.id === activeId ? { ...b, title } : b)) } : d);
  }, [activeId]);

  // Close the menus on outside click.
  const menusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!newOpen && !menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menusRef.current?.contains(e.target as Node)) { setNewOpen(false); setMenuOpen(false); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [newOpen, menuOpen]);

  if (data && !data.configured && fallback) return <>{fallback}</>;

  const legacyLink = legacy && (
    legacy.href ? (
      <Link href={legacy.href} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-surface-400 hover:bg-surface-800 hover:text-white">
        <History className="h-3.5 w-3.5" /> <span className="hidden md:inline">{legacy.label}</span>
      </Link>
    ) : (
      <button type="button" onClick={legacy.onClick} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-surface-400 hover:bg-surface-800 hover:text-white">
        <History className="h-3.5 w-3.5" /> <span className="hidden md:inline">{legacy.label}</span>
      </button>
    )
  );

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-surface-950', className)}>
      <header className="flex items-center gap-2 border-b border-surface-800 bg-surface-950 px-3 py-2">
        <div className="flex shrink-0 items-center gap-2 pr-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
            <Icon className="h-4 w-4" />
          </span>
          <h1 className="hidden text-sm font-semibold text-white sm:block">{label}</h1>
        </div>

        {/* Board tabs scroll sideways rather than wrapping the header */}
        <nav aria-label={`${label} boards`} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {boards.length > 1 && boards.map((b) => {
            const KindIcon = KINDS[b.kind]?.icon ?? LayoutGrid;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => select(b.id)}
                aria-current={b.id === activeId ? 'page' : undefined}
                className={cn(
                  'inline-flex max-w-[14rem] shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  b.id === activeId
                    ? 'bg-surface-800 text-white ring-1 ring-inset ring-surface-700'
                    : 'text-surface-400 hover:bg-surface-900 hover:text-white',
                )}
              >
                <KindIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate">{b.title}</span>
              </button>
            );
          })}
          {boards.length === 1 && active && (
            <span className="truncate px-1 text-sm text-surface-300">{active.title}</span>
          )}
        </nav>

        <div ref={menusRef} className="relative flex shrink-0 items-center gap-1">
          {headerExtra}
          {legacyLink}

          {active && data && (
            <div className="relative">
              <button
                type="button"
                aria-label="Board options"
                aria-expanded={menuOpen}
                onClick={() => { setMenuOpen((o) => !o); setNewOpen(false); }}
                className="rounded-lg p-2 text-surface-400 hover:bg-surface-800 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-surface-800 bg-surface-900 p-1 shadow-2xl">
                  <a
                    role="menuitem"
                    href={`${data.cinderraUrl}/board/${active.cinderra_board_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-200 hover:bg-surface-800"
                    onClick={() => setMenuOpen(false)}
                  >
                    <ExternalLink className="h-4 w-4 text-surface-500" /> Open in Cinderra
                  </a>
                  {canChange(active) && (
                    <>
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => { setRenaming(active); setRenameText(active.title); setMenuOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-surface-200 hover:bg-surface-800"
                      >
                        <Pencil className="h-4 w-4 text-surface-500" /> Rename
                      </button>
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => { setDeleting(active); setMenuOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" /> Delete board
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {data?.access.canCreate && data.configured && (
            <div className="relative">
              <Button
                size="sm"
                onClick={() => (kinds.length > 1 ? (setNewOpen((o) => !o), setMenuOpen(false)) : create(kinds[0]))}
                disabled={creating}
                aria-expanded={kinds.length > 1 ? newOpen : undefined}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="hidden sm:inline">New</span>
              </Button>
              {newOpen && (
                <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl border border-surface-800 bg-surface-900 p-1 shadow-2xl">
                  {kinds.map((k) => {
                    const K = KINDS[k];
                    return (
                      <button
                        key={k}
                        role="menuitem"
                        type="button"
                        onClick={() => create(k, k === 'freeform' ? undefined : K.label)}
                        className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-800"
                      >
                        <K.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                        <span>
                          <span className="block text-sm font-medium text-white">{K.label}</span>
                          <span className="block text-xs text-surface-500">{K.blurb}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        {loadError ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div>
              <p className="text-sm font-semibold text-white">Couldn&apos;t load {label.toLowerCase()}</p>
              <p className="mt-1 text-sm text-surface-400">{loadError}</p>
              <Button size="sm" variant="secondary" className="mt-4" onClick={load}>Try again</Button>
            </div>
          </div>
        ) : !data || (creating && !active) ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-surface-400">
            <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
            <p className="text-sm">{creating ? `Setting up your ${label.toLowerCase()}…` : 'Loading…'}</p>
          </div>
        ) : !data.configured ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-sm">
              <p className="text-sm font-semibold text-white">Boards aren&apos;t switched on yet</p>
              <p className="mt-1 text-sm text-surface-400">An administrator needs to connect Cinderra to this Screenplay Studio server.</p>
            </div>
          </div>
        ) : active ? (
          <CinderraFrame key={active.id} boardRowId={active.id} title={active.title} onTitle={onFrameTitle} />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <div className="w-full max-w-lg text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-white">No {label.toLowerCase()} yet</h2>
              {data.access.canCreate ? (
                <>
                  <p className="mt-1 text-sm text-surface-400">Pick a starting point. You can add more boards any time.</p>
                  <div className="mt-6 grid gap-2 sm:grid-cols-3">
                    {kinds.map((k) => {
                      const K = KINDS[k];
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => create(k, k === 'freeform' ? undefined : K.label)}
                          className="flex flex-col items-start rounded-xl border border-surface-800 bg-surface-900 p-4 text-left transition-colors hover:border-brand-500/40 hover:bg-surface-800"
                        >
                          <K.icon className="h-5 w-5 text-brand-400" />
                          <span className="mt-2 block text-sm font-semibold text-white">{K.label}</span>
                          <span className="mt-0.5 block text-xs text-surface-500">{K.blurb}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="mt-1 text-sm text-surface-400">Nobody has made one here yet. You have view access, so ask an editor to start one.</p>
              )}
            </div>
          </div>
        )}
      </main>

      <Modal isOpen={Boolean(renaming)} onClose={() => setRenaming(null)} title="Rename board">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); rename(); }}>
          <Input label="Name" value={renameText} onChange={(e) => setRenameText(e.target.value)} autoFocus maxLength={200} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={!renameText.trim()}>Save</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={`Delete “${deleting?.title ?? ''}”?`}
        message="Everything on this board is deleted for everyone, in Screenplay Studio and in Cinderra. This can't be undone."
        confirmLabel="Delete board"
        variant="danger"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
