'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useNotificationStore, useAuthStore } from '@/lib/stores';
import { createClient } from '@/lib/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { Notification, NotificationType, CompanyRole } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

// ============================================================
// ICON MAP
// ============================================================

const TYPE_ICON: Record<NotificationType, { emoji: string; color: string }> = {
  community_comment: { emoji: '💬', color: 'bg-blue-500/20' },
  community_reply: { emoji: '↩️', color: 'bg-blue-500/20' },
  community_upvote: { emoji: '❤️', color: 'bg-pink-500/20' },
  project_invitation: { emoji: '📁', color: 'bg-green-500/20' },
  project_comment: { emoji: '📝', color: 'bg-indigo-500/20' },
  company_invitation: { emoji: '🏢', color: 'bg-yellow-500/20' },
  company_blog_comment: { emoji: '📰', color: 'bg-teal-500/20' },
  task_assigned: { emoji: '✅', color: 'bg-orange-500/20' },
  schedule_created: { emoji: '📅', color: 'bg-red-500/20' },
  schedule_reminder: { emoji: '⏰', color: 'bg-amber-500/20' },
  production_submitted: { emoji: '🎬', color: 'bg-purple-500/20' },
  production_approved: { emoji: '🎉', color: 'bg-green-500/20' },
  production_rejected: { emoji: '❌', color: 'bg-red-500/20' },
  chat_mention: { emoji: '💬', color: 'bg-cyan-500/20' },
  direct_message: { emoji: '💬', color: 'blue' },
  general: { emoji: '🔔', color: 'bg-surface-700' },
};

// ============================================================
// NOTIFICATION BELL — top-bar icon with badge
// ============================================================

export function NotificationBell() {
  const { unreadCount } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-surface-400 hover:text-white hover:bg-white/5 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-bold px-1 shadow-lg shadow-brand-500/30">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationsDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}

// ============================================================
// DROPDOWN PANEL — shown when bell is clicked
// ============================================================

function NotificationsDropdown({ onClose }: { onClose: () => void }) {
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const { user } = useAuthStore();
  const push = usePushNotifications(user?.id || undefined);
  const latest = notifications.slice(0, 20);

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-96 max-h-[75vh] flex flex-col rounded-xl border border-surface-700 bg-surface-900 shadow-2xl animate-slide-up overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <h3 className="text-sm font-semibold text-white">Notifications</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllAsRead}
            className="text-[11px] text-surface-400 hover:text-white transition-colors"
          >
            Mark all read
          </button>
          <Link
            href="/notifications"
            onClick={onClose}
            className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors"
          >
            View all
          </Link>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {latest.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="text-3xl mb-2">🔔</span>
            <p className="text-sm text-surface-400">No notifications yet</p>
          </div>
        ) : (
          latest.map((n) => (
            <NotificationRow key={n.id} notification={n} onNavigate={onClose} />
          ))
        )}
      </div>

      {notifications.length > 20 && (
        <div className="border-t border-surface-800 px-4 py-2">
          <Link
            href="/notifications"
            onClick={onClose}
            className="block text-center text-xs text-brand-400 hover:text-brand-300"
          >
            See all {notifications.length} notifications
          </Link>
        </div>
      )}

      {/* Push notifications toggle */}
      {push.isSupported && (
        <div className="border-t border-surface-800 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {push.isSubscribed ? '🔔' : '🔕'}
              </span>
              <span className="text-[11px] text-surface-400">
                Device notifications
              </span>
            </div>
            <button
              onClick={push.isSubscribed ? push.unsubscribe : push.subscribe}
              disabled={push.loading}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                push.isSubscribed ? 'bg-brand-500' : 'bg-surface-700'
              } ${push.loading ? 'opacity-50' : ''}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                push.isSubscribed ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>
          {push.permission === 'denied' && (
            <p className="text-[10px] text-red-400 mt-1">
              Notifications blocked — enable in browser settings
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SINGLE NOTIFICATION ROW
// ============================================================

export function NotificationRow({
  notification: n,
  onNavigate,
  showDate = false,
}: {
  notification: Notification;
  onNavigate?: () => void;
  showDate?: boolean;
}) {
  const { markAsRead, deleteNotification } = useNotificationStore();
  const icon = TYPE_ICON[n.type] || TYPE_ICON.general;
  const isActionable = n.type === 'company_invitation' && !n.acted_on;

  const handleClick = () => {
    if (!n.read) markAsRead(n.id);
    onNavigate?.();
  };

  return (
    <div
      className={`relative flex gap-3 px-4 py-3 transition-colors group ${
        !n.read ? 'bg-brand-500/5' : ''
      } hover:bg-white/[0.03]`}
    >
      {/* Unread dot */}
      {!n.read && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-500" />
      )}

      {/* Icon */}
      <div className={`w-9 h-9 rounded-lg ${icon.color} flex items-center justify-center shrink-0 text-sm`}>
        {n.actor?.avatar_url ? (
          <img src={n.actor.avatar_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
        ) : (
          icon.emoji
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {n.link && !isActionable ? (
          <Link href={n.link} onClick={handleClick} className="block">
            <p className="text-[13px] text-white leading-snug line-clamp-2">{n.title}</p>
            {n.body && (
              <p className="text-[11px] text-surface-400 mt-0.5 line-clamp-1">{n.body}</p>
            )}
          </Link>
        ) : (
          <>
            <p className="text-[13px] text-white leading-snug line-clamp-2">{n.title}</p>
            {n.body && (
              <p className="text-[11px] text-surface-400 mt-0.5 line-clamp-1">{n.body}</p>
            )}
          </>
        )}

        {/* Actionable: company invitation */}
        {isActionable && (
          <CompanyInviteActions notification={n} />
        )}

        <p className="text-[10px] text-surface-500 mt-1">
          {showDate ? new Date(n.created_at).toLocaleDateString() + ' · ' : ''}
          {timeAgo(n.created_at)}
        </p>
      </div>

      {/* Delete */}
      <button
        onClick={() => deleteNotification(n.id)}
        className="opacity-0 group-hover:opacity-100 shrink-0 self-start mt-1 p-1 rounded text-surface-500 hover:text-red-400 transition-all"
        title="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ============================================================
// COMPANY INVITE ACTIONS — Accept / Decline right in the notification
// ============================================================

function CompanyInviteActions({ notification }: { notification: Notification }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { fetchNotifications } = useNotificationStore();
  const supabase = createClient();

  const meta = notification.metadata as {
    company_id?: string;
    company_name?: string;
    invitation_id?: string;
    role?: CompanyRole;
    token?: string;
  };

  const accept = async () => {
    if (!meta.invitation_id || !meta.company_id) return;
    setLoading(true);

    // Use SECURITY DEFINER RPC — this bypasses RLS so the user
    // can actually be inserted into company_members
    const { data, error } = await supabase.rpc('accept_company_invitation', {
      p_invitation_id: meta.invitation_id,
    });

    if (error) {
      console.error('Accept invitation error:', error);
      alert('Failed to accept invitation: ' + error.message);
      setLoading(false);
      return;
    }

    // Mark notification as acted on
    await supabase
      .from('notifications')
      .update({ acted_on: true, read: true })
      .eq('id', notification.id);

    setDone(true);
    setLoading(false);
    fetchNotifications();

    // Redirect to company page
    window.location.href = '/company';
  };

  const decline = async () => {
    if (!meta.invitation_id) return;
    setLoading(true);

    await supabase
      .from('company_invitations')
      .delete()
      .eq('id', meta.invitation_id);

    await supabase
      .from('notifications')
      .update({ acted_on: true, read: true })
      .eq('id', notification.id);

    setDone(true);
    setLoading(false);
    fetchNotifications();
  };

  if (done) {
    return (
      <p className="text-[11px] text-surface-400 mt-1.5 italic">
        Response recorded
      </p>
    );
  }

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={accept}
        disabled={loading}
        className="px-3 py-1 rounded-md text-[11px] font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {loading ? '...' : 'Accept'}
      </button>
      <button
        onClick={decline}
        disabled={loading}
        className="px-3 py-1 rounded-md text-[11px] font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 disabled:opacity-50 transition-colors"
      >
        Decline
      </button>
    </div>
  );
}
