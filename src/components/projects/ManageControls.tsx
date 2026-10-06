'use client';

/**
 * The "⋯" menu and the rename / delete dialogs used wherever projects and
 * scripts can be managed (dashboard, project overview, project settings,
 * script editor).
 */

import { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── "⋯" menu ────────────────────────────────────────────────────────────────

export interface MoreMenuItem {
  label: string;
  icon?: 'rename' | 'settings' | 'folder' | 'delete' | 'open';
  onSelect: () => void;
  danger?: boolean;
  /** Shown greyed out with this explanation instead of running. */
  disabledReason?: string;
}

const ICONS: Record<NonNullable<MoreMenuItem['icon']>, string> = {
  rename: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  folder: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  delete: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  open: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
};

export function MenuIcon({ name, className }: { name: NonNullable<MoreMenuItem['icon']>; className?: string }) {
  return (
    <svg className={cn('w-4 h-4 shrink-0', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={ICONS[name]} />
    </svg>
  );
}

/**
 * A "⋯" button that opens a small action menu. Always visible on touch
 * screens; on devices with a mouse it appears on hover of the nearest `group`
 * (or when focused / open) unless `alwaysVisible` is set.
 */
export function MoreMenu({
  items, label, align = 'right', alwaysVisible, className, buttonClassName, children,
}: {
  items: MoreMenuItem[];
  label: string;
  align?: 'left' | 'right';
  alwaysVisible?: boolean;
  className?: string;
  buttonClassName?: string;
  /** Extra content rendered under the items (e.g. a folder list). */
  children?: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div
      ref={rootRef}
      className={cn('relative', className)}
      // Cards sit inside links; keep clicks here from navigating
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'p-1.5 rounded-lg text-surface-300 hover:text-white bg-black/50 hover:bg-black/70 backdrop-blur-sm transition-all',
          !alwaysVisible && !open && '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100',
          buttonClassName,
        )}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full mt-1 z-50 min-w-[11rem] bg-surface-900 border border-surface-700 rounded-lg shadow-xl py-1 text-sm',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              aria-disabled={!!item.disabledReason}
              title={item.disabledReason}
              onClick={() => {
                if (item.disabledReason) return;
                close();
                item.onSelect();
              }}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors',
                item.disabledReason
                  ? 'text-surface-500 cursor-not-allowed'
                  : item.danger
                    ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                    : 'text-surface-200 hover:bg-surface-800 hover:text-white',
              )}
            >
              {item.icon && <MenuIcon name={item.icon} />}
              <span className="flex-1">
                {item.label}
                {item.disabledReason && <span className="block text-[11px] text-surface-500 leading-snug">{item.disabledReason}</span>}
              </span>
            </button>
          ))}
          {children?.(close)}
        </div>
      )}
    </div>
  );
}

// ── Rename ──────────────────────────────────────────────────────────────────

export function RenameDialog({
  isOpen, onClose, title, label, initialValue, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  label: string;
  initialValue: string;
  /** Resolve true to close the dialog. */
  onSave: (value: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValue(initialValue);
    // Modal focuses its container on open; move focus into the field after it
    const id = window.setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30);
    return () => window.clearTimeout(id);
  }, [isOpen, initialValue]);

  const trimmed = value.trim();
  const unchanged = trimmed === initialValue.trim();

  const submit = async () => {
    if (!trimmed || unchanged || saving) return;
    setSaving(true);
    const done = await onSave(trimmed);
    setSaving(false);
    if (done) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title={title} size="sm">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Input ref={inputRef} label={label} value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={!trimmed || unchanged}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Delete project ──────────────────────────────────────────────────────────

/** Asks the user to type the project name, since this deletes everything in it. */
export function DeleteProjectDialog({
  isOpen, onClose, projectTitle, onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectTitle: string;
  /** Resolve true to close the dialog. */
  onConfirm: () => Promise<boolean>;
}) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTyped('');
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  const matches = typed.trim().toLowerCase() === projectTitle.trim().toLowerCase();

  const submit = async () => {
    if (!matches || deleting) return;
    setDeleting(true);
    const done = await onConfirm();
    setDeleting(false);
    if (done) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !deleting && onClose()} title="Delete project" size="sm">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200">
          This permanently deletes <span className="font-semibold text-white">{projectTitle}</span> with all its
          scripts, characters, scenes and production data. It can&apos;t be undone.
        </div>
        <Input
          ref={inputRef}
          label={`Type “${projectTitle}” to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={projectTitle}
          autoComplete="off"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button type="submit" variant="danger" loading={deleting} disabled={!matches}>Delete project</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Delete script ───────────────────────────────────────────────────────────

export function DeleteScriptDialog({
  isOpen, onClose, scriptTitle, onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  scriptTitle: string;
  onConfirm: () => Promise<boolean>;
}) {
  const [deleting, setDeleting] = useState(false);
  const submit = async () => {
    setDeleting(true);
    const done = await onConfirm();
    setDeleting(false);
    if (done) onClose();
  };
  return (
    <Modal isOpen={isOpen} onClose={() => !deleting && onClose()} title="Delete script" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-surface-300">
          Delete <span className="font-semibold text-white">{scriptTitle}</span> and everything written in it?
          This can&apos;t be undone. The rest of the project is kept.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button type="button" variant="danger" loading={deleting} onClick={submit}>Delete script</Button>
        </div>
      </div>
    </Modal>
  );
}
