'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fillEmails } from '@/lib/private-profile';
import { Button, toast } from '@/components/ui';
import type { PendingLanguage } from '../types';

export function TranslationsAdminTab() {
  const [languages, setLanguages] = useState<{ id: string; code: string; name: string; native_name: string; status: string; added_by: string }[]>([]);
  const [pendingLanguages, setPendingLanguages] = useState<PendingLanguage[]>([]);
  const [stats, setStats] = useState({ total_keys: 0, total_suggestions: 0, total_votes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = createClient();

    const { data: langs } = await supabase
      .from('translation_languages')
      .select('*')
      .order('name');

    setLanguages(langs || []);

    const { data: pending } = await supabase
      .from('translation_languages')
      .select('*, added_by_profile:profiles!added_by(id, display_name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    await fillEmails(supabase, (pending || []).map((l: { added_by_profile?: { id?: string; email?: string | null } | null }) => l.added_by_profile));
    setPendingLanguages(pending || []);

    const [keysRes, suggestionsRes, votesRes] = await Promise.all([
      supabase.from('translation_keys').select('*', { count: 'exact', head: true }),
      supabase.from('translation_suggestions').select('*', { count: 'exact', head: true }),
      supabase.from('translation_votes').select('*', { count: 'exact', head: true }),
    ]);

    setStats({
      total_keys: keysRes.count || 0,
      total_suggestions: suggestionsRes.count || 0,
      total_votes: votesRes.count || 0,
    });

    setLoading(false);
  };

  const approveLanguage = async (id: string) => {
    const supabase = createClient();
    await supabase.from('translation_languages').update({ status: 'approved' }).eq('id', id);
    toast.success('Language approved');
    loadData();
  };

  const rejectLanguage = async (id: string) => {
    const supabase = createClient();
    await supabase.from('translation_languages').update({ status: 'rejected' }).eq('id', id);
    toast.success('Language rejected');
    loadData();
  };

  const deleteSuggestion = async (id: string) => {
    const supabase = createClient();
    await supabase.from('translation_suggestions').delete().eq('id', id);
    toast.success('Suggestion deleted');
    loadData();
  };

  if (loading) return <div className="text-center py-16 text-surface-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Translator Hub</h2>
        <p className="text-sm text-surface-400">Manage languages, review pending requests, and moderate suggestions.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Languages', value: languages.filter(l => l.status === 'approved').length },
          { label: 'Keys', value: stats.total_keys },
          { label: 'Suggestions', value: stats.total_suggestions },
          { label: 'Votes', value: stats.total_votes },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-surface-800 bg-surface-900/50 p-4">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending language requests */}
      {pendingLanguages.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-3">Pending Language Requests ({pendingLanguages.length})</h3>
          <div className="space-y-2">
            {pendingLanguages.map((lang) => (
              <div key={lang.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-900/50 border border-surface-800">
                <div>
                  <p className="text-sm font-medium text-white">{lang.name} <span className="text-surface-500">({lang.native_name})</span></p>
                  <p className="text-[11px] text-surface-500">Code: {lang.code} — Requested by {lang.added_by_profile?.display_name || lang.added_by_profile?.email || 'Unknown'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveLanguage(lang.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">Approve</button>
                  <button onClick={() => rejectLanguage(lang.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All languages */}
      <div className="rounded-lg border border-surface-800 bg-surface-900/50 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">All Languages</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800">
                <th className="text-left py-2 text-xs font-medium text-surface-500">Language</th>
                <th className="text-left py-2 text-xs font-medium text-surface-500">Code</th>
                <th className="text-left py-2 text-xs font-medium text-surface-500">Status</th>
                <th className="text-left py-2 text-xs font-medium text-surface-500">Added By</th>
              </tr>
            </thead>
            <tbody>
              {languages.map((lang) => (
                <tr key={lang.id} className="border-b border-surface-800/50">
                  <td className="py-2 text-white">{lang.name} <span className="text-surface-500">({lang.native_name})</span></td>
                  <td className="py-2 font-mono text-surface-400">{lang.code}</td>
                  <td className="py-2">
                    <span className={`text-[11px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      lang.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      lang.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>{lang.status}</span>
                  </td>
                  <td className="py-2 text-surface-400 text-xs">{lang.added_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick links */}
      <div className="flex gap-3">
        <Link href="/translations">
          <Button size="sm" variant="secondary">Open Translator Hub</Button>
        </Link>
        <Link href="/legal/translation-guidelines">
          <Button size="sm" variant="ghost">View Guidelines</Button>
        </Link>
      </div>
    </div>
  );
}

/** A big KPI card */
export default TranslationsAdminTab;
