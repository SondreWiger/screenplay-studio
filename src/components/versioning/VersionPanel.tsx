'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { VersionConfig } from '@/lib/versioning';

const PALETTE = [
  'bg-violet-400', 'bg-sky-400', 'bg-emerald-400', 'bg-amber-400',
  'bg-rose-400',   'bg-fuchsia-400', 'bg-cyan-400', 'bg-orange-400',
  'bg-lime-400',   'bg-pink-400',
];

function dotColor(name: string, all: string[]): string {
  const idx = all.indexOf(name);
  return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
}

type DisplayItem =
  | { kind: 'group'; prefix: string; baseVersion: string | null; children: string[] }
  | { kind: 'version'; name: string };

function buildTree(versions: string[]): DisplayItem[] {
  const childrenOf = new Map<string, string[]>();
  for (const v of versions) {
    const slash = v.indexOf('/');
    if (slash > 0) {
      const p = v.slice(0, slash).trim();
      if (!childrenOf.has(p)) childrenOf.set(p, []);
      childrenOf.get(p)!.push(v);
    }
  }
  const allChildren = new Set(Array.from(childrenOf.values()).flat());
  const renderedGroups = new Set<string>();
  const result: DisplayItem[] = [];
  for (const v of versions) {
    if (allChildren.has(v)) continue;
    if (childrenOf.has(v)) {
      if (!renderedGroups.has(v)) {
        result.push({ kind: 'group', prefix: v, baseVersion: v, children: childrenOf.get(v)! });
        renderedGroups.add(v);
      }
    } else {
      result.push({ kind: 'version', name: v });
    }
  }
  for (const [prefix, children] of Array.from(childrenOf)) {
    if (!renderedGroups.has(prefix)) {
      result.push({ kind: 'group', prefix, baseVersion: null, children });
    }
  }
  return result;
}

function Toggle({ checked, onChange, small }: { checked: boolean; onChange: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        'relative shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none',
        small ? 'inline-flex h-3.5 w-6' : 'inline-flex h-4 w-7',
        checked ? 'bg-[#FF5F1F]' : 'bg-surface-600',
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block rounded-full bg-white shadow transition-transform',
        small ? 'h-2.5 w-2.5 mt-0.5' : 'h-3 w-3 mt-0.5',
        checked ? (small ? 'translate-x-3' : 'translate-x-3.5') : 'translate-x-0.5',
      )} />
    </button>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('w-3 h-3 shrink-0 text-surface-500 transition-transform duration-150', open ? 'rotate-90' : '')}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

interface VersionRowProps {
  name: string;
  displayName: string;
  allVersions: string[];
  config: VersionConfig;
  selectedCount: number;
  isTaggedOnAll: boolean;
  onToggle: () => void;
  onTag?: () => void;
  onUntag?: () => void;
  onDelete?: () => void;
  indent?: boolean;
  mode: 'script' | 'document';
  onInsertSyntax?: () => void;
}

function VersionRow({
  name, displayName, allVersions, config, selectedCount, isTaggedOnAll,
  onToggle, onTag, onUntag, onDelete, indent, mode, onInsertSyntax,
}: VersionRowProps) {
  const enabled = !config.disabled.includes(name);
  const [confirming, setConfirming] = useState(false);

  const handleDelete = () => {
    if (!confirming) { setConfirming(true); return; }
    onDelete?.();
    setConfirming(false);
  };

  return (
    <div className={cn(
      'group/row flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors',
      enabled ? 'hover:bg-surface-800/60' : 'opacity-50 hover:opacity-70 hover:bg-surface-800/40',
      indent ? 'ml-5' : '',
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor(name, allVersions))} />
      <span className={cn(
        'flex-1 text-[11px] font-medium truncate',
        enabled ? 'text-surface-200' : 'text-surface-500',
      )}>
        {displayName}
      </span>

      {mode === 'script' && selectedCount > 0 && (onTag || onUntag) && (
        <button
          onClick={() => isTaggedOnAll ? onUntag?.() : onTag?.()}
          className={cn(
            'shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide transition-colors',
            isTaggedOnAll
              ? 'bg-[#FF5F1F]/20 text-[#FF5F1F] hover:bg-[#FF5F1F]/30'
              : 'bg-surface-700/60 text-surface-400 hover:bg-surface-700 hover:text-white',
          )}
        >
          {isTaggedOnAll ? '\u2713 tagged' : `+ ${selectedCount}`}
        </button>
      )}

      {mode === 'document' && onInsertSyntax && (
        <button onClick={onInsertSyntax} title="Wrap selection with this version"
          className="shrink-0 opacity-0 group-hover/row:opacity-100 text-surface-500 hover:text-white transition-all">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {onDelete && (
        <button
          onClick={handleDelete}
          onBlur={() => setConfirming(false)}
          title={confirming ? 'Click again to confirm' : `Delete "${displayName}"`}
          className={cn(
            'shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-all',
            confirming
              ? 'opacity-100 bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'opacity-0 group-hover/row:opacity-100 text-surface-600 hover:text-red-400',
          )}
        >
          <TrashIcon />
          {confirming && <span className="font-semibold">sure?</span>}
        </button>
      )}

      <Toggle checked={enabled} onChange={onToggle} small />
    </div>
  );
}

export interface VersionPanelProps {
  versions: string[];
  config: VersionConfig;
  onChange: (config: VersionConfig) => void;
  onClose: () => void;
  selectedCount?: number;
  selectedVersions?: string[];
  onTagSelected?: (version: string) => void;
  onUntagSelected?: (version: string) => void;
  onCreateVersion?: (name: string) => void;
  onDeleteVersion?: (name: string) => void;
  onInsertVersionSyntax?: (version: string) => void;
  mode: 'script' | 'document';
}

export function VersionPanel({
  versions,
  config,
  onChange,
  onClose,
  selectedCount = 0,
  selectedVersions = [],
  onTagSelected,
  onUntagSelected,
  onCreateVersion,
  onDeleteVersion,
  onInsertVersionSyntax,
  mode,
}: VersionPanelProps) {
  const [newName, setNewName] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = (name: string) => {
    const next = config.disabled.includes(name)
      ? config.disabled.filter((d) => d !== name)
      : [...config.disabled, name];
    onChange({ ...config, disabled: next });
  };

  const toggleGroup = (allInGroup: string[]) => {
    const allEnabled = allInGroup.every((n) => !config.disabled.includes(n));
    const next = allEnabled
      ? [...config.disabled, ...allInGroup.filter((n) => !config.disabled.includes(n))]
      : config.disabled.filter((n) => !allInGroup.includes(n));
    onChange({ ...config, disabled: next });
  };

  const toggleExpand = (prefix: string) => {
    setExpandedGroups((prev) => {
      const s = new Set(prev);
      s.has(prefix) ? s.delete(prefix) : s.add(prefix);
      return s;
    });
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    setNewName('');
    if (mode === 'script') onCreateVersion?.(name);
    else onInsertVersionSyntax?.(name);
  };

  const tree = buildTree(versions);

  return (
    <div className="flex flex-col h-full bg-surface-950 border-l border-surface-800">

      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-surface-800">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-[#FF5F1F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span className="text-[11px] font-semibold text-white tracking-wide">Versions</span>
          {versions.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-surface-800 text-surface-500 text-[9px] font-mono tabular-nums">
              {versions.length}
            </span>
          )}
        </div>
        <button onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-surface-500 hover:text-white hover:bg-surface-800 transition-colors">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Selection status */}
      {mode === 'script' && (
        <div className={cn(
          'px-3.5 py-2 border-b border-surface-800/60 transition-colors',
          selectedCount > 0 ? 'bg-[#FF5F1F]/5' : '',
        )}>
          {selectedCount > 0 ? (
            <span className="text-[11px] text-[#FF5F1F] font-medium">
              {selectedCount} element{selectedCount !== 1 ? 's' : ''} selected
            </span>
          ) : (
            <span className="text-[11px] text-surface-600">\u2318+click elements, then tag below</span>
          )}
        </div>
      )}

      {/* Version list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2.5 py-10 px-4 text-center">
            <svg className="w-7 h-7 text-surface-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-[11px] text-surface-500">No versions yet.</p>
            {mode === 'script' && (
              <p className="text-[10px] text-surface-700 leading-relaxed">
                Use <span className="font-mono text-surface-600">Group/Name</span> to nest versions inside groups.
              </p>
            )}
          </div>
        ) : (
          <div className="px-2 py-2 space-y-0.5">
            {versions.length > 1 && (
              <div className="flex items-center gap-2 px-2 pb-2 border-b border-surface-800/40 mb-1">
                <button onClick={() => onChange({ ...config, disabled: [] })}
                  className="text-[10px] text-surface-600 hover:text-surface-300 transition-colors">show all</button>
                <span className="text-surface-800">·</span>
                <button onClick={() => onChange({ ...config, disabled: [...versions] })}
                  className="text-[10px] text-surface-600 hover:text-surface-300 transition-colors">hide all</button>
                {config.disabled.length > 0 && (
                  <span className="ml-auto text-[10px] text-surface-700 tabular-nums">{config.disabled.length} hidden</span>
                )}
              </div>
            )}

            {tree.map((item) => {
              if (item.kind === 'version') {
                return (
                  <VersionRow
                    key={item.name}
                    name={item.name}
                    displayName={item.name}
                    allVersions={versions}
                    config={config}
                    selectedCount={selectedCount}
                    isTaggedOnAll={selectedVersions.includes(item.name)}
                    onToggle={() => toggle(item.name)}
                    onTag={onTagSelected ? () => onTagSelected(item.name) : undefined}
                    onUntag={onUntagSelected ? () => onUntagSelected(item.name) : undefined}
                    onDelete={onDeleteVersion ? () => onDeleteVersion(item.name) : undefined}
                    mode={mode}
                    onInsertSyntax={onInsertVersionSyntax ? () => onInsertVersionSyntax(item.name) : undefined}
                  />
                );
              }

              const { prefix, baseVersion, children } = item;
              const isOpen = expandedGroups.has(prefix);
              const allInGroup = baseVersion ? [baseVersion, ...children] : children;
              const groupAllEnabled = allInGroup.every((n) => !config.disabled.includes(n));

              return (
                <div key={prefix} className="space-y-0.5">
                  <div className="group/gh flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-surface-800/40 transition-colors">
                    <button onClick={() => toggleExpand(prefix)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                      <ChevronIcon open={isOpen} />
                      <span className={cn(
                        'text-[11px] font-semibold truncate',
                        groupAllEnabled ? 'text-surface-300' : 'text-surface-600',
                      )}>
                        {prefix}
                      </span>
                      <span className="text-[9px] text-surface-700 shrink-0 tabular-nums font-mono">{allInGroup.length}</span>
                    </button>
                    <Toggle checked={groupAllEnabled} onChange={() => toggleGroup(allInGroup)} small />
                  </div>

                  {isOpen && (
                    <div className="space-y-0.5">
                      {baseVersion && (
                        <VersionRow
                          name={baseVersion}
                          displayName="(base)"
                          allVersions={versions}
                          config={config}
                          selectedCount={selectedCount}
                          isTaggedOnAll={selectedVersions.includes(baseVersion)}
                          onToggle={() => toggle(baseVersion)}
                          onTag={onTagSelected ? () => onTagSelected(baseVersion) : undefined}
                          onUntag={onUntagSelected ? () => onUntagSelected(baseVersion) : undefined}
                          onDelete={onDeleteVersion ? () => onDeleteVersion(baseVersion) : undefined}
                          indent
                          mode={mode}
                          onInsertSyntax={onInsertVersionSyntax ? () => onInsertVersionSyntax(baseVersion) : undefined}
                        />
                      )}
                      {children.map((child) => (
                        <VersionRow
                          key={child}
                          name={child}
                          displayName={child.slice(prefix.length + 1)}
                          allVersions={versions}
                          config={config}
                          selectedCount={selectedCount}
                          isTaggedOnAll={selectedVersions.includes(child)}
                          onToggle={() => toggle(child)}
                          onTag={onTagSelected ? () => onTagSelected(child) : undefined}
                          onUntag={onUntagSelected ? () => onUntagSelected(child) : undefined}
                          onDelete={onDeleteVersion ? () => onDeleteVersion(child) : undefined}
                          indent
                          mode={mode}
                          onInsertSyntax={onInsertVersionSyntax ? () => onInsertVersionSyntax(child) : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Insert */}
      <div className="border-t border-surface-800 px-3 py-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleCreate(); }
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            placeholder={mode === 'script' ? 'New version (use / to nest)' : 'version name\u2026'}
            className="flex-1 min-w-0 bg-surface-800 border border-surface-700/80 rounded-md text-[11px] text-white placeholder:text-surface-600 px-2.5 py-1.5 outline-none focus:border-[#FF5F1F]/40 transition-colors"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="shrink-0 px-2.5 py-1.5 rounded-md bg-[#FF5F1F] hover:bg-[#FF5F1F]/90 text-white text-[10px] font-semibold disabled:opacity-30 transition-colors"
          >
            {mode === 'script' ? 'Add' : 'Insert'}
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="border-t border-surface-800 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-surface-400">Faded instead of hidden</p>
            <p className="text-[10px] text-surface-700 mt-0.5">Show disabled as low opacity</p>
          </div>
          <Toggle checked={config.showFaded} onChange={() => onChange({ ...config, showFaded: !config.showFaded })} />
        </div>
      </div>

    </div>
  );
}
