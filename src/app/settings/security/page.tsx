'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, LoadingPage } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';

// ============================================================
// Settings / Security — Login history, sessions, GDPR tools
// ============================================================

interface LoginEntry {
  id: string;
  ip_address: string;
  user_agent: string;
  method: string;
  success: boolean;
  login_at: string;
}

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface DeletionRequest {
  id: string;
  status: string;
  scheduled_for: string;
}

interface ConsentState {
  marketing_emails: boolean;
  analytics_tracking: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskIP(ip: string): string {
  if (!ip || ip === 'unknown') return 'Unknown';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***.`;
  // IPv6 — just show first half
  const v6 = ip.split(':');
  if (v6.length > 4) return v6.slice(0, 4).join(':') + ':****';
  return ip;
}

function parseUserAgent(ua: string): string {
  if (!ua || ua === 'unknown') return 'Unknown device';

  let browser = 'Unknown browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  let os = '';
  if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return os ? `${browser} on ${os}` : browser;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-400';
    case 'high': return 'text-orange-400';
    case 'medium': return 'text-yellow-400';
    default: return 'text-surface-400';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SecuritySettingsPage() {
  const { user, loading: authLoading } = useAuth();

  const [loginHistory, setLoginHistory] = useState<LoginEntry[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null);
  const [consent, setConsent] = useState<ConsentState>({ marketing_emails: false, analytics_tracking: false });

  const [loadingData, setLoadingData] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ---- Fetch all data ----
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);

    const supabase = createClient();

    const [loginRes, eventsRes, auditRes, deletionRes, consentRes] = await Promise.all([
      supabase
        .from('login_history')
        .select('*')
        .eq('user_id', user.id)
        .order('login_at', { ascending: false })
        .limit(20),
      supabase
        .from('security_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('audit_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('deletion_requests')
        .select('id, status, scheduled_for')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle(),
      supabase
        .from('consent_records')
        .select('consent_type, granted')
        .eq('user_id', user.id)
        .in('consent_type', ['marketing_emails', 'analytics_tracking'])
        .order('created_at', { ascending: false }),
    ]);

    setLoginHistory(loginRes.data || []);
    setSecurityEvents(eventsRes.data || []);
    setAuditLog(auditRes.data || []);
    setDeletionRequest(deletionRes.data || null);

    // Derive latest consent state per type
    const consentMap: Record<string, boolean> = {};
    (consentRes.data || []).forEach((r: { consent_type: string; granted: boolean }) => {
      if (!(r.consent_type in consentMap)) consentMap[r.consent_type] = r.granted;
    });
    setConsent({
      marketing_emails: consentMap['marketing_emails'] ?? false,
      analytics_tracking: consentMap['analytics_tracking'] ?? false,
    });

    setLoadingData(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // ---- Data Export ----
  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/user/data-export', { method: 'POST' });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screenplaystudio-data-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Data export downloaded successfully.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to export data. Please try again.' });
    } finally {
      setExporting(false);
    }
  };

  // ---- Delete Account ----
  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? You will have 30 days to cancel this request before your data is permanently removed.')) return;
    setDeletingAccount(true);
    setMessage(null);
    try {
      const res = await fetch('/api/user/delete-account', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMessage({ type: 'success', text: data.message });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to schedule deletion.' });
    } finally {
      setDeletingAccount(false);
    }
  };

  // ---- Cancel Deletion ----
  const handleCancelDeletion = async () => {
    setCancellingDeletion(true);
    setMessage(null);
    try {
      const res = await fetch('/api/user/delete-account', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMessage({ type: 'success', text: 'Account deletion cancelled.' });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to cancel deletion.' });
    } finally {
      setCancellingDeletion(false);
    }
  };

  // ---- Save Consent ----
  const handleSaveConsent = async () => {
    if (!user) return;
    setSavingConsent(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const records = [
        { user_id: user.id, consent_type: 'marketing_emails', granted: consent.marketing_emails },
        { user_id: user.id, consent_type: 'analytics_tracking', granted: consent.analytics_tracking },
      ];
      const { error } = await supabase.from('consent_records').insert(records);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Consent preferences saved.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save consent preferences.' });
    } finally {
      setSavingConsent(false);
    }
  };

  // ---- Loading / Auth guard ----
  if (authLoading) return <LoadingPage />;
  if (!user) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <p className="text-surface-400">Please sign in to access security settings.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-surface-400 mb-6">
          <Link href="/settings" className="hover:text-white transition">Settings</Link>
          <span>/</span>
          <span className="text-white">Security</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-8">Security &amp; Privacy</h1>

        {/* Status message */}
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-900/40 text-green-300 border border-green-800' : 'bg-red-900/40 text-red-300 border border-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Pending Deletion Warning */}
        {deletionRequest && (
          <div className="mb-6 px-4 py-4 rounded-lg bg-red-900/30 border border-red-800">
            <h3 className="text-red-300 font-semibold mb-1">Account Deletion Pending</h3>
            <p className="text-red-400 text-sm mb-3">
              Your account is scheduled for permanent deletion on{' '}
              <strong>{new Date(deletionRequest.scheduled_for).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.
              All your data will be permanently removed after this date.
            </p>
            <Button
              onClick={handleCancelDeletion}
              loading={cancellingDeletion}
              variant="outline"
              className="border-red-700 text-red-300 hover:bg-red-900/40"
            >
              Cancel Deletion
            </Button>
          </div>
        )}

        {loadingData ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-surface-600 border-t-white rounded-full" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* ============= Login History ============= */}
            <Card className="bg-surface-900 border-surface-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Login History</h2>
              <p className="text-surface-400 text-sm mb-4">Your last 20 sign-in events.</p>

              {loginHistory.length === 0 ? (
                <p className="text-surface-500 text-sm italic">No login history recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-surface-400 border-b border-surface-800">
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4">IP Address</th>
                        <th className="pb-2 pr-4">Device / Browser</th>
                        <th className="pb-2 pr-4">Method</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-800">
                      {loginHistory.map((entry) => (
                        <tr key={entry.id} className="text-surface-300">
                          <td className="py-2 pr-4 whitespace-nowrap">{formatDate(entry.login_at)}</td>
                          <td className="py-2 pr-4 font-mono text-xs">{maskIP(entry.ip_address)}</td>
                          <td className="py-2 pr-4">{parseUserAgent(entry.user_agent)}</td>
                          <td className="py-2 pr-4 capitalize">{entry.method.replace('_', ' ')}</td>
                          <td className="py-2">
                            {entry.success ? (
                              <span className="text-green-400">Success</span>
                            ) : (
                              <span className="text-red-400">Failed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ============= Active Session ============= */}
            <Card className="bg-surface-900 border-surface-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Active Session</h2>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <p className="text-surface-200 text-sm font-medium">Current Session</p>
                  <p className="text-surface-400 text-xs">
                    {parseUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : '')} — Signed in as {user.email}
                  </p>
                </div>
              </div>
            </Card>

            {/* ============= Security Events ============= */}
            <Card className="bg-surface-900 border-surface-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Security Events</h2>
              <p className="text-surface-400 text-sm mb-4">Suspicious activity alerts and security-related events.</p>

              {securityEvents.length === 0 ? (
                <p className="text-surface-500 text-sm italic">No security events — your account looks safe!</p>
              ) : (
                <div className="space-y-3">
                  {securityEvents.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-950 border border-surface-800">
                      <div className={`mt-0.5 text-xs font-bold uppercase ${severityColor(ev.severity)}`}>
                        {ev.severity}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-surface-200 text-sm font-medium capitalize">
                          {ev.event_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-surface-400 text-xs mt-0.5">{ev.description}</p>
                        <p className="text-surface-500 text-xs mt-1">{formatDate(ev.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* ============= Account Activity (Audit Log) ============= */}
            <Card className="bg-surface-900 border-surface-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Account Activity</h2>
              <p className="text-surface-400 text-sm mb-4">Recent actions on your account.</p>

              {auditLog.length === 0 ? (
                <p className="text-surface-500 text-sm italic">No activity recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between py-2 border-b border-surface-800 last:border-0">
                      <div>
                        <p className="text-surface-200 text-sm capitalize">
                          {entry.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-surface-500 text-xs">
                          {entry.entity_type} · {formatDate(entry.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* ============= Consent Management ============= */}
            <Card className="bg-surface-900 border-surface-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Consent Management</h2>
              <p className="text-surface-400 text-sm mb-4">Manage your data processing preferences. Changes are recorded for GDPR compliance.</p>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent.marketing_emails}
                    onChange={(e) => setConsent((prev) => ({ ...prev, marketing_emails: e.target.checked }))}
                    className="h-4 w-4 rounded border-surface-600 bg-surface-950 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <p className="text-surface-200 text-sm font-medium">Marketing Emails</p>
                    <p className="text-surface-500 text-xs">Receive product updates, tips, and promotional offers.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent.analytics_tracking}
                    onChange={(e) => setConsent((prev) => ({ ...prev, analytics_tracking: e.target.checked }))}
                    className="h-4 w-4 rounded border-surface-600 bg-surface-950 text-brand-500 focus:ring-brand-500"
                  />
                  <div>
                    <p className="text-surface-200 text-sm font-medium">Analytics Tracking</p>
                    <p className="text-surface-500 text-xs">Allow anonymous usage analytics to help us improve the product.</p>
                  </div>
                </label>

                <Button onClick={handleSaveConsent} loading={savingConsent}>
                  Save Preferences
                </Button>
              </div>
            </Card>

            {/* ============= Data & Account ============= */}
            <Card className="bg-surface-900 border-surface-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Data &amp; Account</h2>

              {/* Data Export */}
              <div className="mb-6 pb-6 border-b border-surface-800">
                <h3 className="text-surface-200 font-medium mb-1">Request Data Export</h3>
                <p className="text-surface-400 text-sm mb-3">
                  Download a complete copy of all your data in JSON format, including your profile, projects, scripts, comments, login history, and consent records.
                </p>
                <Button onClick={handleExport} loading={exporting} variant="outline">
                  Export My Data
                </Button>
              </div>

              {/* Delete Account */}
              <div>
                <h3 className="text-red-400 font-medium mb-1">Delete Account</h3>
                <p className="text-surface-400 text-sm mb-1">
                  Permanently delete your account and all associated data. This action has a <strong className="text-surface-200">30-day grace period</strong> — you can cancel the request at any time during that window.
                </p>
                <p className="text-surface-500 text-xs mb-3">
                  After the grace period, all your projects, scripts, comments, and personal data will be irreversibly removed.
                </p>
                {deletionRequest ? (
                  <p className="text-yellow-400 text-sm">
                    A deletion request is already pending (see above).
                  </p>
                ) : (
                  <Button
                    onClick={handleDeleteAccount}
                    loading={deletingAccount}
                    className="bg-red-900/60 hover:bg-red-900 text-red-200 border border-red-800"
                  >
                    Delete My Account
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
