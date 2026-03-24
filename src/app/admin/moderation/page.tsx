'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Badge, Card, Modal, Textarea, Avatar, toast } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';
const isFullAdmin = (id?: string, role?: string) => id === ADMIN_UID || role === 'admin';

type SubTab = 'flags' | 'all-projects' | 'evidence';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/40',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  low: 'bg-surface-700/50 text-surface-300 border-surface-600',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  reviewing: 'bg-sky-500/20 text-sky-400',
  confirmed: 'bg-red-500/20 text-red-400',
  false_positive: 'bg-green-500/20 text-green-400',
  actioned: 'bg-purple-500/20 text-purple-400',
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  script_element: 'Script',
  idea: 'Idea',
  document: 'Document',
  scene: 'Scene',
  character: 'Character',
  channel_message: 'Project Chat',
  direct_message: 'Direct Message',
  project: 'Project',
  comment: 'Comment',
};

interface ContentFlag {
  id: string;
  content_type: string;
  content_id: string;
  project_id: string | null;
  flagged_user_id: string;
  flag_reason: string;
  matched_terms: string[];
  content_snippet: string;
  severity: string;
  status: string;
  reviewed_by: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  action_taken: string | null;
  detected_at: string;
  flagged_user?: {
    email: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    username: string | null;
  };
}

interface Evidence {
  id: string;
  flag_id: string;
  content_type: string;
  content_id: string;
  full_content: string;
  content_metadata: Record<string, unknown>;
  author_id: string;
  author_email: string | null;
  author_name: string | null;
  captured_by: string;
  captured_at: string;
  content_hash: string;
}

export default function ModerationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [subTab, setSubTab] = useState<SubTab>('flags');
  const [flags, setFlags] = useState<ContentFlag[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanResults, setScanResults] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [projectSearch, setProjectSearch] = useState('');

  // Action modals
  const [dmModal, setDmModal] = useState<{ userId: string; userName: string } | null>(null);
  const [dmMessage, setDmMessage] = useState('');
  const [actionModal, setActionModal] = useState<{ flag: ContentFlag; action: string } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionDays, setActionDays] = useState(30);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isFullAdmin(user.id, user.role)) {
      router.replace('/dashboard');
      return;
    }
    loadFlags();
    loadAllProjects();
  }, [user, authLoading]);

  const getAuthHeaders = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    };
  }, []);

  const loadFlags = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/moderation/scan', { headers });
      const data = await res.json();
      setFlags(data.flags || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Error loading flags:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEvidence = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('moderation_evidence')
        .select('*')
        .order('captured_at', { ascending: false })
        .limit(200);
      setEvidence(data || []);
    } catch (err) {
      console.error('Error loading evidence:', err);
    }
  };

  const loadAllProjects = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('projects')
        .select('id, title, logline, status, format, created_by, created_at, updated_at, poster_url, project_members(count), scripts(count), owner:profiles!created_by(email, full_name, display_name, avatar_url, username, moderation_status, moderation_flags)')
        .order('updated_at', { ascending: false });
      setAllProjects(data || []);
    } catch (err) {
      console.error('Error loading all projects:', err);
    }
  };

  const runScan = async () => {
    setScanning(true);
    setScanResults(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/moderation/scan', {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      setScanResults(data);
      toast.success(`Scan complete: ${data.new_flags} new flags found`);
      await loadFlags();
    } catch (err) {
      console.error('Scan error:', err);
      toast.error('Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleAction = async (action: string, params: Record<string, unknown>) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/moderation/actions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, ...params }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success('Action completed');
        await loadFlags();
      }
    } catch (err) {
      toast.error('Action failed');
    }
  };

  const handleDmUser = async () => {
    if (!dmModal || !dmMessage.trim()) return;
    await handleAction('dm_user', {
      user_id: dmModal.userId,
      message: dmMessage.trim(),
    });
    setDmModal(null);
    setDmMessage('');
  };

  const handleModAction = async () => {
    if (!actionModal || !actionNotes.trim()) return;
    const { flag, action } = actionModal;

    if (action === 'warn') {
      await handleAction('warn_user', {
        user_id: flag.flagged_user_id,
        reason: actionNotes.trim(),
        flag_id: flag.id,
      });
    } else if (action === 'suspend') {
      await handleAction('suspend_user', {
        user_id: flag.flagged_user_id,
        reason: actionNotes.trim(),
        duration_days: actionDays,
        flag_id: flag.id,
      });
    } else if (action === 'ban') {
      await handleAction('ban_user', {
        user_id: flag.flagged_user_id,
        reason: actionNotes.trim(),
        flag_id: flag.id,
      });
    } else if (action === 'delete') {
      await handleAction('delete_content', {
        flag_id: flag.id,
        content_type: flag.content_type,
        content_id: flag.content_id,
      });
    } else if (action === 'dismiss') {
      await handleAction('update_flag', {
        flag_id: flag.id,
        status: 'false_positive',
        review_notes: actionNotes.trim(),
      });
    }

    setActionModal(null);
    setActionNotes('');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isFullAdmin(user.id, user.role)) return null;

  const pendingFlags = flags.filter(f => f.status === 'pending');
  const criticalFlags = flags.filter(f => f.severity === 'critical' && f.status === 'pending');

  const filteredProjects = allProjects.filter(p =>
    !projectSearch || (p.title + ' ' + (p.owner?.email || '') + ' ' + (p.owner?.full_name || '')).toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      {/* Header */}
      <div className="border-b border-surface-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-surface-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-black flex items-center gap-2">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Content Moderation
              </h1>
              <p className="text-xs text-surface-500">Child safety, content scanning & evidence preservation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {criticalFlags.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold animate-pulse">
                {criticalFlags.length} CRITICAL
              </span>
            )}
            <Button
              variant="primary"
              onClick={runScan}
              disabled={scanning}
              className="text-sm"
            >
              {scanning ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Scanning…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Scan Platform
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Scan Results Banner */}
      {scanResults && (
        <div className="bg-surface-900 border-b border-surface-800 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <span className="text-surface-400">Last scan:</span>
              {Object.entries(scanResults.scanned || {}).map(([key, val]) => (
                <span key={key} className="text-surface-300">
                  <span className="text-surface-500">{key.replace(/_/g, ' ')}:</span> {String(val)}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className={cn(
                'font-bold',
                (scanResults.new_flags || 0) > 0 ? 'text-red-400' : 'text-green-400'
              )}>
                {scanResults.new_flags || 0} new flags
              </span>
              <button
                onClick={() => setScanResults(null)}
                className="text-surface-500 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div className="border-b border-surface-800 px-6 py-3 bg-surface-900/50">
          <div className="max-w-7xl mx-auto flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-surface-400">Pending:</span>
              <span className="font-bold text-amber-400">{stats.by_status?.pending || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-surface-400">Critical:</span>
              <span className="font-bold text-red-400">{stats.by_severity?.critical || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-surface-400">Actioned:</span>
              <span className="font-bold text-purple-400">{stats.by_status?.actioned || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-surface-400">False Positives:</span>
              <span className="font-bold text-green-400">{stats.by_status?.false_positive || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="border-b border-surface-800 px-6">
        <div className="max-w-7xl mx-auto flex gap-6">
          {[
            { key: 'flags' as SubTab, label: 'Content Flags', count: pendingFlags.length },
            { key: 'all-projects' as SubTab, label: 'All Projects', count: allProjects.length },
            { key: 'evidence' as SubTab, label: 'Evidence Vault', count: evidence.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setSubTab(tab.key);
                if (tab.key === 'evidence' && evidence.length === 0) loadEvidence();
              }}
              className={cn(
                'py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                subTab === tab.key
                  ? 'border-[#FF5F1F] text-white'
                  : 'border-transparent text-surface-400 hover:text-white'
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-bold',
                  tab.key === 'flags' && pendingFlags.length > 0
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-surface-800 text-surface-400'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ── FLAGS TAB ──────────────────────────────────────── */}
        {subTab === 'flags' && (
          <div className="space-y-4">
            {flags.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-16 h-16 text-green-500/50 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-surface-300 mb-1">No flags detected</h3>
                <p className="text-sm text-surface-500">Click &quot;Scan Platform&quot; to run a content scan</p>
              </div>
            ) : (
              flags.map(flag => (
                <div
                  key={flag.id}
                  className={cn(
                    'rounded-xl border p-5',
                    flag.severity === 'critical'
                      ? 'border-red-500/40 bg-red-500/5'
                      : 'border-surface-800 bg-surface-900/50'
                  )}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-bold uppercase border', SEVERITY_COLORS[flag.severity])}>
                        {flag.severity}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[flag.status])}>
                        {flag.status}
                      </span>
                      <span className="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded">
                        {CONTENT_TYPE_LABELS[flag.content_type] || flag.content_type}
                      </span>
                      <span className="text-xs text-surface-500">{timeAgo(flag.detected_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-surface-600 font-mono">{flag.id.slice(0, 8)}</span>
                    </div>
                  </div>

                  {/* Matched terms */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {flag.matched_terms.map((term, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-xs font-mono border border-red-500/20">
                        {term}
                      </span>
                    ))}
                  </div>

                  {/* Content snippet */}
                  <div className="bg-surface-950 rounded-lg p-3 mb-3 border border-surface-800">
                    <p className="text-sm text-surface-300 font-mono whitespace-pre-wrap break-words">
                      {flag.content_snippet}
                    </p>
                  </div>

                  {/* User info + Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {flag.flagged_user && (
                        <>
                          <Avatar
                            src={flag.flagged_user.avatar_url || undefined}
                            name={flag.flagged_user.display_name || flag.flagged_user.email}
                            size="sm"
                          />
                          <div>
                            <p className="text-sm font-medium text-white">
                              {flag.flagged_user.display_name || flag.flagged_user.full_name || 'Unknown'}
                            </p>
                            <p className="text-xs text-surface-500">{flag.flagged_user.email}</p>
                          </div>
                          {flag.flagged_user.username && (
                            <Link href={`/profile/${flag.flagged_user.username}`} className="text-xs text-[#FF5F1F] hover:underline">
                              @{flag.flagged_user.username}
                            </Link>
                          )}
                        </>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {flag.status === 'pending' && (
                        <>
                          {/* DM User */}
                          <Button
                            variant="ghost"
                            onClick={() => setDmModal({
                              userId: flag.flagged_user_id,
                              userName: flag.flagged_user?.display_name || flag.flagged_user?.full_name || 'User',
                            })}
                            className="text-xs"
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            DM
                          </Button>

                          {/* Preserve Evidence */}
                          <Button
                            variant="ghost"
                            onClick={() => handleAction('preserve_evidence', {
                              flag_id: flag.id,
                              content_type: flag.content_type,
                              content_id: flag.content_id,
                              full_content: flag.content_snippet,
                              author_id: flag.flagged_user_id,
                            }).then(() => toast.success('Evidence preserved'))}
                            className="text-xs"
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                            Preserve
                          </Button>

                          {/* Delete Content */}
                          <Button
                            variant="ghost"
                            onClick={() => setActionModal({ flag, action: 'delete' })}
                            className="text-xs text-amber-400"
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </Button>

                          {/* Warn */}
                          <Button
                            variant="ghost"
                            onClick={() => setActionModal({ flag, action: 'warn' })}
                            className="text-xs text-amber-400"
                          >
                            Warn
                          </Button>

                          {/* Suspend */}
                          <Button
                            variant="ghost"
                            onClick={() => setActionModal({ flag, action: 'suspend' })}
                            className="text-xs text-orange-400"
                          >
                            Suspend
                          </Button>

                          {/* Ban */}
                          <Button
                            variant="ghost"
                            onClick={() => setActionModal({ flag, action: 'ban' })}
                            className="text-xs text-red-400"
                          >
                            Ban
                          </Button>

                          {/* Dismiss (false positive) */}
                          <Button
                            variant="ghost"
                            onClick={() => setActionModal({ flag, action: 'dismiss' })}
                            className="text-xs text-surface-400"
                          >
                            Dismiss
                          </Button>
                        </>
                      )}

                      {flag.status !== 'pending' && flag.action_taken && (
                        <span className="text-xs text-surface-500">
                          Action: {flag.action_taken.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Review notes */}
                  {flag.review_notes && (
                    <div className="mt-3 pt-3 border-t border-surface-800">
                      <p className="text-xs text-surface-500">
                        <span className="font-medium">Review notes:</span> {flag.review_notes}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── ALL PROJECTS TAB ───────────────────────────────── */}
        {subTab === 'all-projects' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">All Platform Projects</h2>
                <p className="text-xs text-surface-500">{allProjects.length} projects — read-only admin view</p>
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search projects, owners..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder:text-surface-500 outline-none focus:border-[#FF5F1F] w-72"
                />
              </div>
            </div>

            <div className="space-y-2">
              {filteredProjects.map(p => {
                const owner = p.owner;
                const hasModFlags = owner?.moderation_flags > 0;
                const isFlaggedUser = owner?.moderation_status && owner.moderation_status !== 'clean';

                return (
                  <div
                    key={p.id}
                    className={cn(
                      'rounded-xl border px-5 py-4 flex items-center gap-4',
                      hasModFlags
                        ? 'border-red-500/30 bg-red-500/5'
                        : 'border-surface-800 bg-surface-900/50'
                    )}
                  >
                    {/* Project icon */}
                    <div className="w-10 h-10 rounded-lg bg-[#E54E15] flex items-center justify-center text-sm font-bold text-white shrink-0">
                      {p.title?.[0] || '?'}
                    </div>

                    {/* Project info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{p.title}</p>
                        <Badge variant="default" size="sm">{(p.status || '').replace(/_/g, ' ')}</Badge>
                        {p.format && (
                          <span className="text-[10px] text-surface-500 bg-surface-800 px-1.5 py-0.5 rounded">{p.format}</span>
                        )}
                      </div>
                      <p className="text-xs text-surface-500 truncate">{p.logline || 'No logline'}</p>
                    </div>

                    {/* Owner */}
                    <div className="flex items-center gap-2 shrink-0">
                      {owner?.avatar_url ? (
                        <img src={owner.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-surface-700 flex items-center justify-center text-[10px] text-surface-400">
                          {(owner?.display_name || owner?.email)?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-xs text-surface-300">
                          {owner?.display_name || owner?.full_name || 'Unknown'}
                        </p>
                        <p className="text-[10px] text-surface-500">{owner?.email}</p>
                      </div>
                      {/* Moderation warning */}
                      {isFlaggedUser && (
                        <span className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold" title={`Status: ${owner.moderation_status} | ${owner.moderation_flags} flag(s)`}>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          {owner.moderation_status}
                        </span>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setDmModal({
                          userId: p.created_by,
                          userName: owner?.display_name || owner?.full_name || 'Owner',
                        })}
                        className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-800 transition-colors"
                        title="DM Owner"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      </button>
                    </div>

                    {/* Timestamp */}
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-surface-500">{timeAgo(p.updated_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── EVIDENCE VAULT TAB ─────────────────────────────── */}
        {subTab === 'evidence' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-white">Evidence Vault</h2>
              <p className="text-xs text-surface-500">Tamper-proof snapshots — cannot be edited or deleted</p>
            </div>

            {evidence.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-12 h-12 text-surface-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <p className="text-sm text-surface-500">No preserved evidence yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {evidence.map(ev => (
                  <div key={ev.id} className="rounded-xl border border-surface-800 bg-surface-900/50 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-medium">
                          {CONTENT_TYPE_LABELS[ev.content_type] || ev.content_type}
                        </span>
                        <span className="text-xs text-surface-500">{timeAgo(ev.captured_at)}</span>
                      </div>
                      <span className="text-[10px] text-surface-600 font-mono" title="SHA-256 integrity hash">
                        Hash: {ev.content_hash.slice(0, 16)}…
                      </span>
                    </div>
                    <div className="bg-surface-950 rounded-lg p-3 mb-3 border border-surface-800">
                      <p className="text-sm text-surface-300 font-mono whitespace-pre-wrap break-words">
                        {ev.full_content}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-surface-500">
                      <span>Author: <strong className="text-surface-300">{ev.author_name || 'Unknown'}</strong> ({ev.author_email})</span>
                      <span>Author ID: <span className="font-mono">{ev.author_id.slice(0, 8)}</span></span>
                      <span>Flag: <span className="font-mono">{ev.flag_id.slice(0, 8)}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── DM MODAL ─────────────────────────────────────────── */}
      {dmModal && (
        <Modal isOpen onClose={() => { setDmModal(null); setDmMessage(''); }}>
          <div className="p-6 max-w-lg">
            <h3 className="text-lg font-bold text-white mb-1">Message {dmModal.userName}</h3>
            <p className="text-xs text-surface-500 mb-4">This will create or use an existing DM conversation</p>
            <Textarea
              value={dmMessage}
              onChange={(e) => setDmMessage(e.target.value)}
              placeholder="Write your message..."
              rows={4}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setDmModal(null); setDmMessage(''); }}>Cancel</Button>
              <Button variant="primary" onClick={handleDmUser} disabled={!dmMessage.trim()}>Send Message</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── ACTION MODAL ─────────────────────────────────────── */}
      {actionModal && (
        <Modal isOpen onClose={() => { setActionModal(null); setActionNotes(''); }}>
          <div className="p-6 max-w-lg">
            <h3 className="text-lg font-bold text-white mb-1">
              {actionModal.action === 'warn' && 'Warn User'}
              {actionModal.action === 'suspend' && 'Suspend User'}
              {actionModal.action === 'ban' && 'Ban User Permanently'}
              {actionModal.action === 'delete' && 'Delete Flagged Content'}
              {actionModal.action === 'dismiss' && 'Dismiss as False Positive'}
            </h3>
            <p className="text-xs text-surface-500 mb-1">
              {actionModal.action === 'ban' && 'This removes all project memberships and blocks the user permanently.'}
              {actionModal.action === 'delete' && 'Content will be permanently removed (messages soft-deleted).'}
              {actionModal.action === 'dismiss' && 'Mark this flag as a false positive. No action will be taken against the user.'}
            </p>
            <p className="text-xs text-surface-400 mb-4 flex items-center gap-2">
              <span className="font-mono bg-surface-800 px-1.5 py-0.5 rounded">{actionModal.flag.content_type}</span>
              User: <strong>{actionModal.flag.flagged_user?.display_name || actionModal.flag.flagged_user?.email || 'Unknown'}</strong>
            </p>

            {actionModal.action === 'suspend' && (
              <div className="mb-3">
                <label className="text-xs text-surface-400 mb-1 block">Duration (days)</label>
                <input
                  type="number"
                  value={actionDays}
                  onChange={(e) => setActionDays(parseInt(e.target.value) || 30)}
                  min={1}
                  max={365}
                  className="w-32 px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white outline-none focus:border-[#FF5F1F]"
                />
              </div>
            )}

            <Textarea
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder={
                actionModal.action === 'dismiss'
                  ? 'Why is this a false positive?'
                  : 'Reason for this action...'
              }
              rows={3}
              className="mb-4"
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setActionModal(null); setActionNotes(''); }}>Cancel</Button>
              <Button
                variant={actionModal.action === 'ban' || actionModal.action === 'delete' ? 'danger' : 'primary'}
                onClick={handleModAction}
                disabled={!actionNotes.trim()}
              >
                {actionModal.action === 'warn' && 'Send Warning'}
                {actionModal.action === 'suspend' && `Suspend for ${actionDays} days`}
                {actionModal.action === 'ban' && 'Permanently Ban'}
                {actionModal.action === 'delete' && 'Delete Content'}
                {actionModal.action === 'dismiss' && 'Mark as False Positive'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
