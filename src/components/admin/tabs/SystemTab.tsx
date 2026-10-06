'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { ADMIN_UID } from '../types';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { invalidateAdminCache, useSiteSetting } from '../data';
import { Cpu } from 'lucide-react';
import { AdminPage, PageHeader, Pill, Reveal } from '../kit';

export function SystemTab({ rebootStatus, onSoftReboot, onClearPresence, onRefreshStats, siteVersion, onUpdateVersion, opensourceEnabled, onToggleOpensource, proGatingEnabled, onToggleProGating, creatorProgramEnabled, onToggleCreatorProgram, creatorPayoutEnabled, onToggleCreatorPayout }: {
  rebootStatus: string | null;
  onSoftReboot: () => void;
  onClearPresence: () => void;
  onRefreshStats: () => void;
  siteVersion: string;
  onUpdateVersion: (v: string) => void;
  opensourceEnabled: boolean;
  onToggleOpensource: (enabled: boolean) => void;
  proGatingEnabled: boolean;
  onToggleProGating: (enabled: boolean) => void;
  creatorProgramEnabled: boolean;
  onToggleCreatorProgram: (enabled: boolean) => void;
  creatorPayoutEnabled: boolean;
  onToggleCreatorPayout: (enabled: boolean) => void;
}) {
  const [editingVersion, setEditingVersion] = useState(false);
  const [versionDraft, setVersionDraft] = useState(siteVersion);

  return (
    <div>

      {/* Open Source toggle */}
      <div className="mb-6 rounded-xl border bg-surface-900/50 p-5 flex items-center justify-between"
        style={{ borderColor: opensourceEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: opensourceEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)' }}>
            <span className="text-xl">{opensourceEnabled ? '🔓' : '🔒'}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Open Source Mode
              <span className={`text-[11px] font-bold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded border ${
                opensourceEnabled
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  : 'text-white/45 border-white/10 bg-white/5'
              }`}>
                {opensourceEnabled ? 'ON' : 'OFF'}
              </span>
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {opensourceEnabled
                ? 'Shows /contribute page, open-source mentions in metadata, and contributor sections'
                : 'Hides /contribute, strips open-source from titles/embeds, hides contributor section in /about'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onToggleOpensource(!opensourceEnabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            opensourceEnabled ? 'bg-emerald-500' : 'bg-surface-700'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            opensourceEnabled ? 'translate-x-6' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Pro Gating toggle */}
      <div className="mb-6 rounded-xl border bg-surface-900/50 p-5 flex items-center justify-between"
        style={{ borderColor: proGatingEnabled ? 'rgba(255,255,255,0.1)' : 'rgba(255,95,31,0.4)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: proGatingEnabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,95,31,0.15)' }}>
            <span className="text-xl">{proGatingEnabled ? '🔐' : '🎁'}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Pro Feature Gating
              <span className={`text-[11px] font-bold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded border ${
                proGatingEnabled
                  ? 'text-white/45 border-white/10 bg-white/5'
                  : 'text-brand-500 border-brand-500/30 bg-brand-500/10'
              }`}>
                {proGatingEnabled ? 'ON' : 'ALL FREE'}
              </span>
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {proGatingEnabled
                ? 'Pro features only visible to paid subscribers. Normal billing applies.'
                : 'All Pro features are unlocked for every user — no subscription required.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onToggleProGating(!proGatingEnabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            proGatingEnabled ? 'bg-surface-700' : 'bg-brand-500'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            proGatingEnabled ? 'translate-x-0' : 'translate-x-6'
          }`} />
        </button>
      </div>

      {/* Creator Program toggle */}
      <div className="mb-6 rounded-xl border bg-surface-900/50 p-5 flex items-center justify-between"
        style={{ borderColor: creatorProgramEnabled ? 'rgba(255,95,31,0.3)' : 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: creatorProgramEnabled ? 'rgba(255,95,31,0.15)' : 'rgba(255,255,255,0.06)' }}>
            <svg className="w-5 h-5" style={{ color: creatorProgramEnabled ? '#FF5F1F' : 'rgba(255,255,255,0.3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Creator Affiliate Program
              <span className={`text-[11px] font-bold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded border ${
                creatorProgramEnabled
                  ? 'text-brand-500 border-brand-500/30 bg-brand-500/10'
                  : 'text-white/45 border-white/10 bg-white/5'
              }`}>
                {creatorProgramEnabled ? 'ON' : 'OFF'}
              </span>
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {creatorProgramEnabled
                ? 'Users can apply for creator profiles and generate referral links.'
                : 'Creator program is disabled. Settings page shows a coming-soon banner.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onToggleCreatorProgram(!creatorProgramEnabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            creatorProgramEnabled ? 'bg-brand-500' : 'bg-surface-700'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            creatorProgramEnabled ? 'translate-x-6' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Creator Payout toggle */}
      <div className="mb-6 rounded-xl border bg-surface-900/50 p-5 flex items-center justify-between"
        style={{ borderColor: creatorPayoutEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: creatorPayoutEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)' }}>
            <svg className="w-5 h-5" style={{ color: creatorPayoutEnabled ? '#10b981' : 'rgba(255,255,255,0.3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Creator Payouts
              <span className={`text-[11px] font-bold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded border ${
                creatorPayoutEnabled
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  : 'text-white/45 border-white/10 bg-white/5'
              }`}>
                {creatorPayoutEnabled ? 'ON' : 'OFF'}
              </span>
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {creatorPayoutEnabled
                ? 'Payout history is visible to creators. Admin can issue monthly payouts on the 12th.'
                : 'Payout UI is hidden from creators. Use this to pause payouts without disabling the program.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onToggleCreatorPayout(!creatorPayoutEnabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            creatorPayoutEnabled ? 'bg-emerald-500' : 'bg-surface-700'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
            creatorPayoutEnabled ? 'translate-x-6' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Version control */}
      <div className="mb-6 rounded-xl border border-surface-800 bg-surface-900/50 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Site Version</h3>
            <p className="text-xs text-surface-500">Displayed in all footers across the site</p>
          </div>
        </div>
        {editingVersion ? (
          <div className="flex items-center gap-2">
            <input
              value={versionDraft}
              onChange={(e) => setVersionDraft(e.target.value)}
              className="w-32 rounded-lg border border-surface-700 bg-surface-900 px-3 py-1.5 text-sm text-white font-mono focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="e.g. 1.2.0"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onUpdateVersion(versionDraft); setEditingVersion(false); }
                if (e.key === 'Escape') { setVersionDraft(siteVersion); setEditingVersion(false); }
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => { onUpdateVersion(versionDraft); setEditingVersion(false); }}>Save</Button>
            <Button variant="ghost" size="sm" onClick={() => { setVersionDraft(siteVersion); setEditingVersion(false); }}>Cancel</Button>
          </div>
        ) : (
          <button
            onClick={() => { setVersionDraft(siteVersion); setEditingVersion(true); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 transition-colors group"
          >
            <span className="text-sm font-mono text-brand-500">v{siteVersion || '—'}</span>
            <svg className="w-3.5 h-3.5 text-surface-500 group-hover:text-surface-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
        )}
      </div>

      {rebootStatus && (
        <div className="mb-6 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          {rebootStatus}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Soft Reboot */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Soft Reboot</h3>
              <p className="text-xs text-surface-500">Clear channels, presence, refresh session</p>
            </div>
          </div>
          <p className="text-xs text-surface-400 mb-4">
            Use when things feel slow or weird. This clears all realtime channels, deletes stale presence records,
            refreshes your auth session, and reloads the page.
          </p>
          <Button onClick={onSoftReboot} variant="ghost" className="w-full border border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
            Perform Soft Reboot
          </Button>
        </div>

        {/* Clear Presence */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Clear All Presence</h3>
              <p className="text-xs text-surface-500">Reset online user indicators</p>
            </div>
          </div>
          <p className="text-xs text-surface-400 mb-4">
            If you see ghost users showing as online, this clears all presence records.
            Users will re-appear as they navigate the app.
          </p>
          <Button onClick={onClearPresence} variant="ghost" className="w-full border border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
            Clear Presence Records
          </Button>
        </div>

        {/* Refresh Data */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Refresh Stats</h3>
              <p className="text-xs text-surface-500">Re-fetch all platform data</p>
            </div>
          </div>
          <p className="text-xs text-surface-400 mb-4">
            Reload all stats, users, and project data from the database.
          </p>
          <Button onClick={onRefreshStats} variant="ghost" className="w-full border border-green-500/30 text-green-400 hover:bg-green-500/10">
            Refresh All Data
          </Button>
        </div>

        {/* Info */}
        <div className="rounded-xl border border-surface-800 bg-surface-900/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-surface-700/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Platform Info</h3>
              <p className="text-xs text-surface-500">Runtime details</p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-surface-500">Framework</span>
              <span className="text-white">Next.js 14</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Backend</span>
              <span className="text-white">Supabase</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Realtime</span>
              <span className="text-white">Supabase Channels</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">State</span>
              <span className="text-white">Zustand</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Admin UUID</span>
              <span className="text-white font-mono text-[11px]">{ADMIN_UID.slice(0, 12)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Version</span>
              <span className="text-white font-mono">v{siteVersion || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SystemPanel() {
  const router = useRouter();
  const [rebootStatus, setRebootStatus] = useState<string | null>(null);
  const [siteVersion, setSiteVersion] = useSiteSetting('site_version', '');
  const [opensourceEnabled, setOpensourceEnabled] = useSiteSetting('opensource_enabled', false);
  const [proGatingEnabled, setProGatingEnabled] = useSiteSetting('pro_gating_enabled', false);
  const [creatorProgramEnabled, setCreatorProgramEnabled] = useSiteSetting('creator_program_enabled', false);
  const [creatorPayoutEnabled, setCreatorPayoutEnabled] = useSiteSetting('creator_payout_enabled', false);

  const clearPresence = () => createClient().from('user_presence').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');

  const handleSoftReboot = async () => {
    const supabase = createClient();
    setRebootStatus('Clearing realtime channels...');
    supabase.removeAllChannels();
    setRebootStatus('Clearing presence records...');
    await clearPresence();
    setRebootStatus('Refreshing auth session...');
    await supabase.auth.refreshSession();
    setRebootStatus('Reboot complete. Reloading page...');
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleClearPresence = async () => {
    await clearPresence();
    setRebootStatus('All presence records cleared.');
    setTimeout(() => setRebootStatus(null), 3000);
  };

  return (
    <AdminPage>
      <PageHeader
        icon={<Cpu className="h-5 w-5" />}
        title="System"
        description="Site settings, feature switches and maintenance tools."
        meta={siteVersion ? <Pill tone="brand">v{siteVersion}</Pill> : undefined}
      />
      <Reveal>
    <SystemTab
      rebootStatus={rebootStatus}
      onSoftReboot={handleSoftReboot}
      onClearPresence={handleClearPresence}
      onRefreshStats={() => { invalidateAdminCache(); router.push('/admin'); }}
      siteVersion={siteVersion}
      onUpdateVersion={setSiteVersion}
      opensourceEnabled={opensourceEnabled}
      onToggleOpensource={setOpensourceEnabled}
      proGatingEnabled={proGatingEnabled}
      onToggleProGating={setProGatingEnabled}
      creatorProgramEnabled={creatorProgramEnabled}
      onToggleCreatorProgram={setCreatorProgramEnabled}
      creatorPayoutEnabled={creatorPayoutEnabled}
      onToggleCreatorPayout={setCreatorPayoutEnabled}
    />
      </Reveal>
    </AdminPage>
  );
}
