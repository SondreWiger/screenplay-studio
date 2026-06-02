'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Shortcut = { id: string; type: 'script' | 'document'; title: string };

interface ShortcutPickerProps {
  projectId: string;
  userId: string | undefined;
  shortcuts: Shortcut[];
  onToggle: (item: Shortcut) => void;
  onClose: () => void;
  anchorEl: HTMLButtonElement | null;
}

export function ShortcutPicker({ projectId, userId, shortcuts, onToggle, onClose, anchorEl }: ShortcutPickerProps) {
  const [items, setItems] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    }
  }, [anchorEl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [sRes, dRes] = await Promise.all([
        supabase.from('scripts').select('id,title').eq('project_id', projectId).order('title'),
        supabase.from('project_documents').select('id,title').eq('project_id', projectId).order('title'),
      ]);
      if (cancelled) return;
      const scripts: Shortcut[] = (sRes.data ?? []).map((s: { id: string; title: string }) => ({ id: s.id, type: 'script', title: s.title }));
      const docs: Shortcut[] = (dRes.data ?? []).map((d: { id: string; title: string }) => ({ id: d.id, type: 'document', title: d.title }));
      setItems([...scripts, ...docs]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (!pos) return null;

  const q = query.toLowerCase();
  const filtered = query ? items.filter(i => i.title.toLowerCase().includes(q)) : items;
  const scriptItems = filtered.filter(i => i.type === 'script');
  const docItems = filtered.filter(i => i.type === 'document');

  const renderItem = (item: Shortcut) => {
    const pinned = shortcuts.some(s => s.id === item.id);
    return (
      <button
        key={item.id}
        onClick={() => onToggle(item)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors hover:bg-surface-700/60 group/pi"
      >
        <svg className="w-3.5 h-3.5 shrink-0 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.type === 'script'
            ? 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
            : 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2'
          } />
        </svg>
        <span className={cn('truncate flex-1', pinned ? 'text-white' : 'text-surface-300 group-hover/pi:text-white')}>{item.title}</span>
        <span className={cn('w-4 h-4 shrink-0 flex items-center justify-center rounded-full border transition-all',
          pinned ? 'bg-[#FF5F1F] border-[#FF5F1F]' : 'border-surface-600 group-hover/pi:border-surface-400'
        )}>
          {pinned && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      </button>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999]" onClick={onClose}>
      <div
        className="fixed w-80 rounded-xl bg-surface-800 border border-surface-700 shadow-2xl overflow-hidden"
        style={{ top: Math.min(pos.top, window.innerHeight - 380), left: Math.min(pos.left, window.innerWidth - 330) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-surface-700">
          <p className="text-xs font-semibold text-white">Pin to Quick Access</p>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-2 py-1.5 border-b border-surface-700/60">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scripts & documents…"
            className="w-full bg-surface-900/60 rounded-lg px-3 py-1.5 text-sm text-white placeholder-surface-500 outline-none border border-surface-700 focus:border-[#FF5F1F]/50"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {loading && <p className="text-center text-surface-500 py-8 text-xs">Loading…</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-surface-500 py-8 text-xs">No scripts or documents found</p>
          )}
          {!loading && scriptItems.length > 0 && (
            <>
              <p className="px-2.5 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-surface-600">Scripts</p>
              {scriptItems.map(renderItem)}
            </>
          )}
          {!loading && docItems.length > 0 && (
            <>
              <p className="px-2.5 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-surface-600">Documents</p>
              {docItems.map(renderItem)}
            </>
          )}
        </div>
        {shortcuts.length > 0 && (
          <div className="border-t border-surface-700/60 px-3 py-2 text-[10px] text-surface-500">
            {shortcuts.length} pinned · click any item to toggle
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
