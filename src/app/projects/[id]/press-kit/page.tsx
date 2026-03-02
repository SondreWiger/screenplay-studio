'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { toast } from 'sonner';

export default function PressKitSettingsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const currentUserRole =
    members.find((m) => m.user_id === user?.id)?.role ||
    (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole === 'owner' || currentUserRole === 'admin';

  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [tagline, setTagline] = useState('');
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Derived public URL
  const publicUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/press/${params.id}`
      : `/press/${params.id}`;

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('projects')
        .select('press_kit_enabled, press_kit_password, press_kit_tagline, press_kit_contact')
        .eq('id', params.id)
        .maybeSingle();
      if (data) {
        setEnabled(data.press_kit_enabled ?? false);
        setPassword(data.press_kit_password ?? '');
        setTagline(data.press_kit_tagline ?? '');
        setContact(data.press_kit_contact ?? '');
      }
      setLoading(false);
    };
    load();
  }, [params.id]);

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('projects')
      .update({
        press_kit_enabled: enabled,
        press_kit_password: password.trim() || null,
        press_kit_tagline: tagline.trim() || null,
        press_kit_contact: contact.trim() || null,
      })
      .eq('id', params.id);
    setSaving(false);
    if (error) {
      toast.error('Failed to save press kit settings.');
    } else {
      toast.success('Press kit settings saved.');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#FF5F1F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Press Kit</h1>
          <p className="text-surface-400 text-sm mt-1">
            Share a public-facing press kit for journalists, festivals, and industry contacts.
          </p>
        </div>

        {/* Enable toggle */}
        <div className="rounded-2xl border border-surface-800 bg-surface-900/40 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Enable Press Kit</p>
              <p className="text-sm text-surface-400 mt-0.5">
                Make a public page accessible via the link below.
              </p>
            </div>
            <button
              onClick={() => canEdit && setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors duration-200 focus:outline-none ${
                enabled
                  ? 'bg-[#FF5F1F] border-[#FF5F1F]'
                  : 'bg-surface-700 border-surface-700'
              } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-pressed={enabled}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${
                  enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Public link */}
          {enabled && (
            <div className="mt-4 flex items-center gap-2">
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-[#FF5F1F] underline underline-offset-2 truncate hover:text-orange-300 transition-colors"
              >
                {publicUrl}
              </a>
              <button
                onClick={handleCopy}
                className="shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-surface-700 text-surface-300 hover:text-white hover:border-surface-500 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-surface-700 text-surface-300 hover:text-white hover:border-surface-500 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Preview
              </a>
            </div>
          )}
        </div>

        {/* Settings fields */}
        <div className="space-y-5">
          {/* Tagline */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Tagline
              <span className="text-surface-600 font-normal ml-1.5">optional</span>
            </label>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              disabled={!canEdit}
              placeholder="A short, punchy tagline shown beneath the title"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-900 border border-surface-700 text-white placeholder-surface-600 text-sm outline-none focus:border-[#FF5F1F] focus:ring-1 focus:ring-[#FF5F1F]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Press contact */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Press Contact Email
              <span className="text-surface-600 font-normal ml-1.5">optional</span>
            </label>
            <input
              type="email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              disabled={!canEdit}
              placeholder="press@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-900 border border-surface-700 text-white placeholder-surface-600 text-sm outline-none focus:border-[#FF5F1F] focus:ring-1 focus:ring-[#FF5F1F]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-surface-600 mt-1.5">Shown as a clickable &quot;Contact Press Team&quot; button on the public page.</p>
          </div>

          {/* Password protection */}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Password Protection
              <span className="text-surface-600 font-normal ml-1.5">optional</span>
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!canEdit}
              placeholder="Leave blank for public access"
              autoComplete="off"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-900 border border-surface-700 text-white placeholder-surface-600 text-sm outline-none focus:border-[#FF5F1F] focus:ring-1 focus:ring-[#FF5F1F]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-surface-600 mt-1.5">Visitors will be asked to enter this password before viewing the press kit.</p>
          </div>
        </div>

        {/* What&apos;s included */}
        <div className="rounded-2xl border border-surface-800 bg-surface-900/20 p-5">
          <p className="text-sm font-semibold text-surface-300 mb-3">What&apos;s included on the public page</p>
          <ul className="space-y-1.5 text-sm text-surface-500">
            {[
              'Project title, format & genre tags',
              'Cover / poster image',
              'Logline & synopsis (from project settings)',
              'Key creatives (from production team)',
              'Custom tagline & press contact (set above)',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <svg className="w-4 h-4 text-[#FF5F1F] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs text-surface-600 mt-3">
            Edit your logline, synopsis and images in{' '}
            <a href={`/projects/${params.id}/settings`} className="text-[#FF5F1F] hover:underline">
              Project Settings
            </a>
            .
          </p>
        </div>

        {/* Save */}
        {canEdit && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#FF5F1F] text-white font-semibold text-sm hover:bg-orange-500 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        )}

        {!canEdit && (
          <p className="text-center text-sm text-surface-600">Only owners and admins can edit press kit settings.</p>
        )}
      </div>
    </div>
  );
}
