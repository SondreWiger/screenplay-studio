'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProjectStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import type { ProjectShareLink } from '@/lib/types';

// ── Constants ────────────────────────────────────────────────

const PERM_ITEMS: { key: keyof PermMap; label: string; icon: string }[] = [
  { key: 'can_view_script',     label: 'Script',      icon: '📄' },
  { key: 'can_view_characters', label: 'Characters',  icon: '👤' },
  { key: 'can_view_scenes',     label: 'Scenes',      icon: '🎬' },
  { key: 'can_view_schedule',   label: 'Schedule',    icon: '📅' },
  { key: 'can_view_documents',  label: 'Documents',   icon: '📁' },
  { key: 'can_view_notes',      label: 'View notes',  icon: '📝' },
  { key: 'can_edit_notes',      label: 'Write notes', icon: '✏️'  },
];

type PermMap = Pick<
  ProjectShareLink,
  | 'can_view_script'
  | 'can_view_characters'
  | 'can_view_scenes'
  | 'can_view_schedule'
  | 'can_view_documents'
  | 'can_view_notes'
  | 'can_edit_notes'
>;

interface LinkForm {
  name: string;
  perms: PermMap;
  is_invite: boolean;
  invite_role: 'viewer' | 'commenter' | 'editor';
  expires_at: string;
}

const BLANK_FORM: LinkForm = {
  name: '',
  perms: {
    can_view_script: false,
    can_view_characters: false,
    can_view_scenes: false,
    can_view_schedule: false,
    can_view_documents: false,
    can_view_notes: false,
    can_edit_notes: false,
  },
  is_invite: false,
  invite_role: 'viewer',
  expires_at: '',
};

// ── Helpers ──────────────────────────────────────────────────

function getOrigin() {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://screenplaystudio.fun';
}

function friendlyDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Main page ────────────────────────────────────────────────

export default function SharePage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const { user } = useAuth();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));

  const [links, setLinks]                   = useState<ProjectShareLink[]>([]);
  const [loading, setLoading]               = useState(true);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [form, setForm]                     = useState<LinkForm>(BLANK_FORM);
  const [saving, setSaving]                 = useState(false);
  const [formError, setFormError]           = useState<string | null>(null);
  const [copiedId, setCopiedId]             = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [pageError, setPageError]           = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────

  const loadLinks = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('project_share_links')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) setPageError('Failed to load share links.');
    else setLinks((data ?? []) as ProjectShareLink[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  // ── Actions ───────────────────────────────────────────────

  async function createLink() {
    if (!form.name.trim()) { setFormError('Give this link a name.'); return; }
    const anyPerm = Object.values(form.perms).some(Boolean);
    if (!anyPerm && !form.is_invite) {
      setFormError('Enable at least one content section, or turn on Invite link.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.from('project_share_links').insert({
      project_id: projectId,
      created_by: user?.id,
      name: form.name.trim(),
      ...form.perms,
      is_invite: form.is_invite,
      invite_role: form.invite_role,
      is_active: true,
      ...(form.expires_at ? { expires_at: new Date(form.expires_at).toISOString() } : {}),
    });
    if (error) { setFormError(error.message); setSaving(false); return; }
    setDrawerOpen(false);
    setForm(BLANK_FORM);
    await loadLinks();
    setSaving(false);
  }

  async function copyLink(token: string, id: string) {
    await navigator.clipboard.writeText(`${getOrigin()}/share/${token}`).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  }

  async function regenerate(id: string) {
    setRegeneratingId(id);
    const supabase = createClient();
    const { error } = await supabase.rpc('regenerate_share_link_token', { link_id: id });
    if (error) setPageError('Could not regenerate: ' + error.message);
    else await loadLinks();
    setRegeneratingId(null);
  }

  async function deactivate(id: string) {
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from('project_share_links').update({ is_active: false }).eq('id', id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
    setDeletingId(null);
  }

  // ── Render ────────────────────────────────────────────────

  const activeLinks   = links.filter((l) => l.is_active);
  const inactiveLinks = links.filter((l) => !l.is_active);

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight">Share</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Shareable links for{' '}
            <span className="text-gray-400">{project?.title ?? 'this project'}</span>
          </p>
        </div>
        <button
          onClick={() => { setDrawerOpen(true); setForm(BLANK_FORM); setFormError(null); }}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New link
        </button>
      </div>

      {/* Page-level error */}
      {pageError && (
        <div className="mx-6 mt-3 flex-shrink-0 text-xs text-red-400 bg-red-500/10 border border-red-500/15 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
          <span>{pageError}</span>
          <button
            onClick={() => setPageError(null)}
            className="text-red-400/60 hover:text-red-400 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Link list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="w-5 h-5 border-2 border-white/15 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : activeLinks.length === 0 ? (
          <EmptyState onNew={() => { setDrawerOpen(true); setForm(BLANK_FORM); }} />
        ) : (
          activeLinks.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              copied={copiedId === link.id}
              regenerating={regeneratingId === link.id}
              deleting={deletingId === link.id}
              onCopy={() => copyLink(link.token, link.id)}
              onRegenerate={() => regenerate(link.id)}
              onDelete={() => deactivate(link.id)}
            />
          ))
        )}

        {inactiveLinks.length > 0 && !loading && (
          <details className="mt-5 group">
            <summary className="list-none flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 cursor-pointer transition-colors select-none w-fit">
              <svg
                className="w-3 h-3 transition-transform group-open:rotate-90"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {inactiveLinks.length} deactivated link{inactiveLinks.length !== 1 ? 's' : ''}
            </summary>
            <div className="mt-2 space-y-1.5 opacity-40 pointer-events-none">
              {inactiveLinks.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  copied={false}
                  regenerating={false}
                  deleting={false}
                  onCopy={() => {}}
                  onRegenerate={() => {}}
                  onDelete={() => {}}
                  inactive
                />
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Slide-in create drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-[#111113] border-l border-white/10 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <h2 className="text-sm font-semibold text-white">New share link</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/8 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <Field label="Link name">
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Director cut, Client draft…"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && createLink()}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/70 focus:bg-white/8 transition-colors"
                />
              </Field>

              <Field label="What can they see?">
                <div className="grid grid-cols-2 gap-1.5">
                  {PERM_ITEMS.map(({ key, label, icon }) => {
                    const checked = form.perms[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, perms: { ...f.perms, [key]: !f.perms[key] } }))
                        }
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors',
                          checked
                            ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                            : 'bg-white/4 border-white/8 text-gray-400 hover:text-gray-200 hover:border-white/15',
                        )}
                      >
                        <span className="text-base leading-none">{icon}</span>
                        <span className="text-xs font-medium">{label}</span>
                        {checked && (
                          <svg
                            className="w-3 h-3 ml-auto text-indigo-400 flex-shrink-0"
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="border-t border-white/[0.06]" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-200 font-medium">Invite link</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Recipient signs in or creates an account and automatically joins the project
                  </p>
                </div>
                <Toggle
                  checked={form.is_invite}
                  onChange={(v) => setForm((f) => ({ ...f, is_invite: v }))}
                />
              </div>

              {form.is_invite && (
                <Field label="Join as">
                  <div className="flex gap-2">
                    {(['viewer', 'commenter', 'editor'] as const).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, invite_role: role }))}
                        className={cn(
                          'flex-1 py-2 rounded-lg border text-xs font-medium capitalize transition-colors',
                          form.invite_role === role
                            ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                            : 'bg-white/4 border-white/8 text-gray-400 hover:text-gray-200 hover:border-white/15',
                        )}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              <Field
                label={
                  <>
                    Expires{' '}
                    <span className="text-gray-600 font-normal">— optional</span>
                  </>
                }
              >
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/70 transition-colors [color-scheme:dark]"
                />
              </Field>

              {formError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/15 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}
            </div>

            <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-5 py-4 border-t border-white/[0.08]">
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-xs text-gray-500 hover:text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createLink}
                disabled={saving || !form.name.trim()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {saving && (
                  <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {saving ? 'Creating…' : 'Create link'}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center pt-16 pb-8 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
        <svg
          className="w-7 h-7 text-gray-500"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}
        >
          <path
            strokeLinecap="round" strokeLinejoin="round"
            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-300">No share links yet</p>
      <p className="text-xs text-gray-600 mt-1.5 max-w-[240px] leading-relaxed">
        Create a link to share scripts, characters, or other content — no login needed for recipients.
      </p>
      <button
        onClick={onNew}
        className="mt-5 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Create first link
      </button>

      <div className="mt-10 w-full max-w-sm text-left space-y-3">
        <p className="text-[11px] text-gray-600 uppercase tracking-widest font-semibold px-1">
          How it works
        </p>
        {[
          { icon: '🔗', text: 'Create a named link with per-section permissions' },
          { icon: '📤', text: 'Share the URL — no account needed to view' },
          { icon: '👥', text: 'Invite links auto-add the recipient to your project' },
        ].map(({ icon, text }) => (
          <div
            key={text}
            className="flex items-start gap-3 bg-white/[0.03] border border-white/[0.05] rounded-xl px-3.5 py-3"
          >
            <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
            <p className="text-xs text-gray-400 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LinkRowProps {
  link: ProjectShareLink;
  copied: boolean;
  regenerating: boolean;
  deleting: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  inactive?: boolean;
}

function LinkRow({
  link, copied, regenerating, deleting,
  onCopy, onRegenerate, onDelete, inactive = false,
}: LinkRowProps) {
  const origin    = getOrigin();
  const url       = `${origin}/share/${link.token}`;
  const perms     = PERM_ITEMS.filter(({ key }) => link[key as keyof ProjectShareLink]);
  const expired   = link.expires_at ? new Date(link.expires_at) < new Date() : false;
  const expiresAt = link.expires_at ? friendlyDate(link.expires_at) : null;

  return (
    <div className={cn(
      'group rounded-xl border transition-colors',
      inactive
        ? 'bg-white/[0.02] border-white/[0.04]'
        : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10',
    )}>
      {/* Top row */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
        {/* Type icon */}
        <div className={cn(
          'w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5',
          link.is_invite ? 'bg-emerald-500/15' : 'bg-indigo-500/15',
        )}>
          {link.is_invite ? (
            <svg
              className="w-4 h-4 text-emerald-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3M13.5 19.5l-.75-1.5M5.625 19.5l.75-1.5M9 4.5l1.5 6h3l1.5 6M9 4.5L7.5 10.5h9" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-indigo-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.81 15.312a4.5 4.5 0 01-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
            </svg>
          )}
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">{link.name}</span>
            {link.is_invite && (
              <span className="inline-flex items-center text-[10px] font-semibold text-emerald-400 bg-emerald-500/12 border border-emerald-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                Invite · {link.invite_role}
              </span>
            )}
            {expired && (
              <span className="inline-flex items-center text-[10px] font-semibold text-red-400 bg-red-500/12 border border-red-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                Expired
              </span>
            )}
          </div>

          <div className="mt-0.5">
            <span className="text-[11px] text-gray-600 font-mono truncate block">
              {url.replace(/^https?:\/\//, '')}
            </span>
          </div>
        </div>

        {/* Action icons (fade in on hover) */}
        {!inactive && (
          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
            <ActionBtn
              onClick={onCopy}
              title={copied ? 'Copied!' : 'Copy link'}
              active={copied}
              activeClass="text-emerald-400"
            >
              {copied
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              }
            </ActionBtn>
            <ActionBtn
              onClick={onRegenerate}
              title="Regenerate token — old link stops working"
              disabled={regenerating}
              spin={regenerating}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </ActionBtn>
            <ActionBtn
              onClick={onDelete}
              title="Deactivate link"
              disabled={deleting}
              spin={deleting}
              hoverClass="hover:text-red-400 hover:bg-red-500/10"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </ActionBtn>
          </div>
        )}
      </div>

      {/* Bottom row — permission pills + stats */}
      <div className="flex items-center justify-between px-4 pb-3 gap-3">
        <div className="flex flex-wrap gap-1">
          {perms.length === 0 ? (
            <span className="text-[11px] text-gray-600 italic">No content access</span>
          ) : (
            perms.map(({ label, icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full"
              >
                <span className="text-[10px]">{icon}</span>
                {label}
              </span>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 text-[11px] text-gray-600">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {link.view_count}
          </span>
          {expiresAt && (
            <span className={expired ? 'text-red-500/70' : ''}>
              {expired ? 'Expired' : 'Expires'} {expiresAt}
            </span>
          )}
        </div>
      </div>

      {/* Expandable copy bar — shown on hover */}
      {!inactive && (
        <div className="max-h-0 overflow-hidden group-hover:max-h-12 border-t border-transparent group-hover:border-white/[0.04] transition-all duration-150">
          <div className="flex items-center gap-2 mx-4 my-2 bg-white/[0.03] rounded-lg px-3 py-1.5">
            <span className="text-[11px] font-mono text-gray-500 truncate flex-1">{url}</span>
            <button
              onClick={onCopy}
              className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded transition-colors flex-shrink-0',
                copied ? 'text-emerald-400' : 'text-gray-400 hover:text-white',
              )}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tiny UI atoms ─────────────────────────────────────────────

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none mt-0.5',
        checked ? 'bg-indigo-600' : 'bg-white/20',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

interface ActionBtnProps {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  spin?: boolean;
  active?: boolean;
  activeClass?: string;
  hoverClass?: string;
  children: React.ReactNode;
}

function ActionBtn({
  onClick, title, disabled, spin, active,
  activeClass = 'text-white',
  hoverClass  = 'hover:text-white hover:bg-white/10',
  children,
}: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        active ? activeClass : 'text-gray-500',
        !active && hoverClass,
      )}
    >
      <svg
        className={cn('w-3.5 h-3.5', spin && 'animate-spin')}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        {children}
      </svg>
    </button>
  );
}
