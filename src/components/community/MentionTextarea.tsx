'use client';

/**
 * MentionTextarea
 * A textarea that detects '@' and opens a user autocomplete dropdown.
 * Usage:
 *   <MentionTextarea
 *     value={text}
 *     onChange={(text, ids) => { setText(text); setMentionedIds(ids); }}
 *     placeholder="Add a comment…"
 *   />
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SuggestedUser {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  value: string;
  onChange: (text: string, mentionedUserIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  minRows?: number;
  className?: string;
}

/** Extract @username handles from a string */
export function parseMentionHandles(text: string): string[] {
  const matches = text.match(/@(\w+)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

export function MentionTextarea({
  value,
  onChange,
  placeholder = 'Write something… use @ to mention users',
  disabled = false,
  minRows = 3,
  className = '',
}: Props) {
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [caretIndex, setCaretIndex]     = useState(0);
  const [selectedIdx, setSelectedIdx]   = useState(0);
  const [resolvedIds, setResolvedIds]   = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-grow height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function getMentionAtCaret(text: string, caret: number) {
    const before = text.slice(0, caret);
    const match  = before.match(/@(\w*)$/);
    return match ? match[1] : null;
  }

  async function fetchSuggestions(query: string) {
    if (!query && query !== '') return;
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(6);
    setSuggestions(data || []);
    setSelectedIdx(0);
  }

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text  = e.target.value;
      const caret = e.target.selectionStart ?? text.length;
      setCaretIndex(caret);

      const q = getMentionAtCaret(text, caret);
      setMentionQuery(q);

      if (q !== null) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(q), 180);
      } else {
        setSuggestions([]);
      }

      // Compute resolved ids for mentions that exist
      const handles = parseMentionHandles(text);
      const ids = handles
        .map((h) => resolvedIds[h.toLowerCase()])
        .filter(Boolean) as string[];
      onChange(text, ids);
    },
    [onChange, resolvedIds]
  );

  function selectSuggestion(s: SuggestedUser) {
    const handle = s.username || s.display_name?.replace(/\s+/g, '') || s.id;
    // Replace the partial @query with @handle
    const before = value.slice(0, caretIndex).replace(/@(\w*)$/, `@${handle} `);
    const after  = value.slice(caretIndex);
    const newText = before + after;

    // Store the resolved id
    const newResolved = { ...resolvedIds, [handle.toLowerCase()]: s.id };
    setResolvedIds(newResolved);

    const handles = parseMentionHandles(newText);
    const ids = handles
      .map((h) => newResolved[h.toLowerCase()])
      .filter(Boolean) as string[];

    setSuggestions([]);
    setMentionQuery(null);
    onChange(newText, ids);

    // Re-focus textarea
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (suggestions[selectedIdx]) {
        e.preventDefault();
        selectSuggestion(suggestions[selectedIdx]);
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setMentionQuery(null);
    }
  }

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={minRows}
        className={[
          'w-full resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2.5',
          'text-sm text-white placeholder-white/30 leading-relaxed',
          'focus:outline-none focus:border-[#FF5F1F]/50 transition-colors',
          'overflow-hidden',
          className,
        ].join(' ')}
        style={{ minHeight: `${minRows * 1.6}rem` }}
      />

      {/* Autocomplete dropdown */}
      {suggestions.length > 0 && mentionQuery !== null && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full mt-1 w-64 z-50 rounded-xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ background: '#0e0e12' }}
        >
          {suggestions.map((s, i) => {
            const handle = s.username || s.display_name || s.id;
            const active = i === selectedIdx;
            return (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                className={[
                  'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                  active ? 'bg-white/8' : 'hover:bg-white/5',
                ].join(' ')}
              >
                {s.avatar_url ? (
                  <img src={s.avatar_url} className="w-6 h-6 rounded-full shrink-0" alt="" />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black text-white"
                    style={{ background: '#FF5F1F' }}
                  >
                    {handle[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[12px] text-white/80 truncate">
                    {s.display_name || s.username}
                  </p>
                  {s.username && (
                    <p className="text-[10px] text-white/40 font-mono truncate">@{s.username}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
