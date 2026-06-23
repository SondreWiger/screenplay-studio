'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, LoadingPage, toast } from '@/components/ui';

interface TranslationKey {
  id: string;
  key: string;
  source_text: string;
  context: string | null;
  section: string;
  suggestions: Suggestion[];
  winner: Suggestion | null;
}

interface Suggestion {
  id: string;
  key_id: string;
  language: string;
  translated_text: string;
  user_id: string;
  status: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  net_votes: number;
  user_vote: 'up' | 'down' | null;
  profiles?: { display_name: string; avatar_url: string };
}

export default function LanguageTranslationPage() {
  const params = useParams();
  const langCode = params.lang as string;
  const { user } = useAuth();
  const [keys, setKeys] = useState<TranslationKey[]>([]);
  const [languageName, setLanguageName] = useState('');
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [filter, setFilter] = useState<'all' | 'untranslated' | 'most-voted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const { data: agreement } = await supabase
      .from('translation_agreements')
      .select('id')
      .eq('user_id', user!.id)
      .single();

    setAgreed(!!agreement);

    const { data: lang } = await supabase
      .from('translation_languages')
      .select('name')
      .eq('code', langCode)
      .single();

    if (lang) setLanguageName(lang.name);

    const res = await fetch(`/api/translations/keys?lang=${langCode}`);
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys || []);
    }

    setLoading(false);
  }, [langCode, user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const submitSuggestion = async (keyId: string) => {
    if (!editText.trim()) return;
    setSubmitting(true);

    const res = await fetch('/api/translations/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key_id: keyId,
        language: langCode,
        translated_text: editText.trim(),
      }),
    });

    if (res.ok) {
      toast.success('Translation submitted!');
      setEditingKey(null);
      setEditText('');
      fetchData();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to submit');
    }

    setSubmitting(false);
  };

  const vote = async (suggestionId: string, voteType: 'up' | 'down') => {
    const res = await fetch('/api/translations/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestion_id: suggestionId, vote: voteType }),
    });

    if (res.ok) {
      fetchData();
    }
  };

  const sections = Array.from(new Set(keys.map(k => k.section)));
  const filteredKeys = keys.filter(k => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!k.key.toLowerCase().includes(q) && !k.source_text.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filter === 'untranslated') return !k.winner;
    if (filter === 'most-voted') return k.suggestions.length > 0;
    return true;
  });

  const translatedCount = keys.filter(k => k.winner).length;
  const totalCount = keys.length;
  const progressPercent = totalCount ? Math.round((translatedCount / totalCount) * 100) : 0;

  if (loading) return <LoadingPage />;

  return (
    <div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-surface-500 mb-6">
          <Link href="/translations" className="hover:text-white transition-colors">Translator Hub</Link>
          <span>/</span>
          <span className="text-white">{languageName || langCode}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">
            {languageName} <span className="text-surface-500">({langCode})</span>
          </h1>
          <p className="text-surface-400 mt-2">
            Suggest translations, vote on the best ones, and help translate Screenplay Studio.
          </p>
        </div>

        {/* Progress */}
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-surface-300">
              <span className="font-semibold text-white">{translatedCount}</span> of {totalCount} keys translated
            </p>
            <p className="text-sm font-semibold text-brand-500">{progressPercent}%</p>
          </div>
          <div className="w-full h-2 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-600 to-brand-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </Card>

        {!agreed && (
          <Card className="p-5 mb-6 border-brand-500/20 bg-brand-500/5">
            <p className="text-sm text-surface-300">
              You must <Link href="/translations" className="text-brand-500 hover:underline">agree to the translation guidelines</Link> before contributing.
            </p>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex gap-2">
            {(['all', 'untranslated', 'most-voted'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-brand-500/10 border border-brand-500/40 text-brand-500'
                    : 'bg-surface-800/50 border border-surface-700/50 text-surface-400 hover:border-surface-600'
                }`}
              >
                {f === 'all' ? 'All' : f === 'untranslated' ? 'Untranslated' : 'Has Suggestions'}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-surface-900/80 border border-surface-700/80 text-sm text-white placeholder:text-surface-600 focus:border-brand-500/70 focus:outline-none"
          />
        </div>

        {/* Keys by section */}
        {sections.map(section => {
          const sectionKeys = filteredKeys.filter(k => k.section === section);
          if (sectionKeys.length === 0) return null;

          return (
            <div key={section} className="mb-8">
              <h2 className="text-sm font-mono uppercase tracking-wider text-surface-500 mb-3 capitalize">{section}</h2>
              <div className="space-y-3">
                {sectionKeys.map(k => (
                  <Card key={k.id} className="p-5">
                    {/* Key header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-surface-500 truncate">{k.key}</p>
                        <p className="text-sm text-white mt-1">{k.source_text}</p>
                        {k.context && (
                          <p className="text-xs text-surface-500 mt-1 italic">{k.context}</p>
                        )}
                      </div>
                      {k.winner && (
                        <div className="text-right shrink-0">
                          <p className="text-xs text-green-400 font-medium">Winning</p>
                          <p className="text-sm text-white mt-0.5">{k.winner.translated_text}</p>
                          <p className="text-[10px] text-surface-500 mt-0.5">
                            {k.winner.upvotes} up / {k.winner.downvotes} down
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Other suggestions */}
                    {k.suggestions.length > 0 && (
                      <div className="space-y-2 mt-3 pt-3 border-t border-surface-800/60">
                        {k.suggestions.map((s, i) => (
                          <div key={s.id} className={`flex items-center gap-3 p-2 rounded-lg ${i === 0 && s.net_votes > 0 ? 'bg-green-500/5 border border-green-500/10' : 'bg-surface-800/30'}`}>
                            {/* Vote buttons */}
                            <div className="flex flex-col items-center gap-0.5">
                              <button
                                onClick={() => vote(s.id, 'up')}
                                disabled={!agreed}
                                className={`p-1 rounded transition-colors ${s.user_vote === 'up' ? 'text-green-400 bg-green-500/10' : 'text-surface-500 hover:text-green-400'}`}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                              </button>
                              <span className={`text-xs font-mono ${s.net_votes > 0 ? 'text-green-400' : s.net_votes < 0 ? 'text-red-400' : 'text-surface-500'}`}>
                                {s.net_votes}
                              </span>
                              <button
                                onClick={() => vote(s.id, 'down')}
                                disabled={!agreed}
                                className={`p-1 rounded transition-colors ${s.user_vote === 'down' ? 'text-red-400 bg-red-500/10' : 'text-surface-500 hover:text-red-400'}`}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </button>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white">{s.translated_text}</p>
                              <p className="text-[10px] text-surface-500 mt-0.5">
                                by {s.profiles?.display_name || 'Anonymous'}
                              </p>
                            </div>
                            {i === 0 && s.net_votes > 0 && (
                              <span className="text-[10px] font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded">WINNING</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Suggest translation */}
                    {agreed && (() => {
                      const userSuggestion = k.suggestions.find(s => s.user_id === user?.id);
                      if (userSuggestion) {
                        return (
                          <div className="mt-3 pt-3 border-t border-surface-800/60">
                            <p className="text-xs text-surface-500">
                              Your suggestion: <span className="text-white">{userSuggestion.translated_text}</span>
                              <span className="ml-2 text-[10px] font-mono text-surface-600">
                                {userSuggestion.net_votes > 0 ? '+' : ''}{userSuggestion.net_votes} votes
                              </span>
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div className="mt-3 pt-3 border-t border-surface-800/60">
                          {editingKey === k.id ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && submitSuggestion(k.id)}
                                placeholder="Enter your translation..."
                                className="flex-1 px-3 py-2 rounded-lg bg-surface-900/80 border border-surface-700/80 text-sm text-white placeholder:text-surface-600 focus:border-brand-500/70 focus:outline-none"
                                autoFocus
                              />
                              <Button size="sm" onClick={() => submitSuggestion(k.id)} loading={submitting} disabled={!editText.trim()}>
                                Submit
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingKey(null); setEditText(''); }}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingKey(k.id); setEditText(k.winner?.translated_text || ''); }}
                              className="text-xs text-brand-500 hover:text-brand-500/80 transition-colors font-medium"
                            >
                              + Suggest Translation
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </Card>
                ))}
              </div>
            </div>
          );
        })}

        {filteredKeys.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-surface-400">
              {searchQuery ? 'No keys match your search.' : 'No keys in this filter.'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
