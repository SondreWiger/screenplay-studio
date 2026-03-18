'use client';

/**
 * CollaboratorPicker
 * Search for users and build a list of collaborators.
 * Usage:
 *   <CollaboratorPicker
 *     collaborators={collabs}
 *     onChange={setCollabs}
 *     excludeIds={[currentUserId]}
 *   />
 */

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

type CollabProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;

interface Props {
  collaborators: CollabProfile[];
  onChange: (collaborators: CollabProfile[]) => void;
  excludeIds?: string[];
  maxCollaborators?: number;
}

export function CollaboratorPicker({
  collaborators,
  onChange,
  excludeIds = [],
  maxCollaborators = 10,
}: Props) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<CollabProfile[]>([]);
  const [searching, setSearching]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function search(q: string) {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(6);
    setSearching(false);
    // filter already added + excluded
    const ids = new Set([...excludeIds, ...collaborators.map((c) => c.id)]);
    setResults((data || []).filter((p) => !ids.has(p.id)));
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 200);
  }

  function addCollaborator(p: CollabProfile) {
    if (collaborators.length >= maxCollaborators) return;
    onChange([...collaborators, p]);
    setResults((r) => r.filter((x) => x.id !== p.id));
    setQuery('');
  }

  function removeCollaborator(id: string) {
    onChange(collaborators.filter((c) => c.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Added collaborators */}
      {collaborators.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {collaborators.map((c) => {
            const handle = c.username || c.display_name || c.id;
            return (
              <div
                key={c.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/70"
              >
                {c.avatar_url ? (
                  <img src={c.avatar_url} className="w-4 h-4 rounded-full" alt="" />
                ) : (
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white"
                    style={{ background: '#FF5F1F' }}
                  >
                    {handle[0]?.toUpperCase()}
                  </div>
                )}
                <span>{c.display_name || c.username}</span>
                <button
                  type="button"
                  onClick={() => removeCollaborator(c.id)}
                  className="text-white/30 hover:text-white/80 transition-colors ml-0.5"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder="Search for collaborators…"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF5F1F]/50 transition-colors"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">…</div>
        )}

        {/* Results dropdown */}
        {results.length > 0 && (
          <div
            className="absolute left-0 top-full mt-1 w-full z-50 rounded-xl border border-white/10 shadow-2xl overflow-hidden"
            style={{ background: '#0e0e12' }}
          >
            {results.map((p) => {
              const handle = p.username || p.display_name || p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); addCollaborator(p); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                >
                  {p.avatar_url ? (
                    <img src={p.avatar_url} className="w-6 h-6 rounded-full shrink-0" alt="" />
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
                      {p.display_name || p.username}
                    </p>
                    {p.username && (
                      <p className="text-[10px] text-white/40 font-mono truncate">@{p.username}</p>
                    )}
                  </div>
                  <span className="ml-auto text-[10px] text-[#FF5F1F] shrink-0">+ Add</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {collaborators.length >= maxCollaborators && (
        <p className="text-[10px] text-white/30 font-mono">
          Max {maxCollaborators} collaborators reached.
        </p>
      )}
    </div>
  );
}
