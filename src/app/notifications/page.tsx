'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationStore } from '@/lib/stores';
import { NotificationRow } from '@/components/notifications/NotificationBell';
import { Button, Card, LoadingPage } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import type { NotificationType } from '@/lib/types';

const FILTER_OPTIONS: { key: 'all' | NotificationType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'community_comment', label: 'Comments' },
  { key: 'community_upvote', label: 'Likes' },
  { key: 'project_invitation', label: 'Project Invites' },
  { key: 'company_invitation', label: 'Company Invites' },
  { key: 'project_comment', label: 'Project Comments' },
  { key: 'task_assigned', label: 'Tasks' },
  { key: 'ticket_reply', label: 'Support' },
];

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { notifications, unreadCount, loading, markAllAsRead, fetchNotifications } = useNotificationStore();
  const [filter, setFilter] = useState<'all' | NotificationType>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth/login'); return; }
    fetchNotifications();
  }, [user, authLoading]);

  if (authLoading || (!user && loading)) return <LoadingPage />;

  let filtered = notifications;
  if (filter !== 'all') {
    filtered = filtered.filter((n) => n.type === filter);
  }
  if (showUnreadOnly) {
    filtered = filtered.filter((n) => !n.read);
  }

  // Group by date
  const groups: { label: string; items: typeof filtered }[] = [];
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = (d: string) => new Date(d).toDateString() === today.toDateString();
  const isYesterday = (d: string) => new Date(d).toDateString() === yesterday.toDateString();

  const todayItems = filtered.filter((n) => isToday(n.created_at));
  const yesterdayItems = filtered.filter((n) => isYesterday(n.created_at));
  const olderItems = filtered.filter((n) => !isToday(n.created_at) && !isYesterday(n.created_at));

  if (todayItems.length) groups.push({ label: 'Today', items: todayItems });
  if (yesterdayItems.length) groups.push({ label: 'Yesterday', items: yesterdayItems });
  if (olderItems.length) groups.push({ label: 'Earlier', items: olderItems });

  return (
    <div className="min-h-screen bg-surface-950">
      <AppHeader actions={unreadCount > 0 ? <Button variant="ghost" size="sm" onClick={markAllAsRead}>Mark all as read</Button> : undefined} />

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === opt.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <div className="ml-auto shrink-0">
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                showUnreadOnly
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
              }`}
            >
              Unread only
            </button>
          </div>
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">🔔</span>
            <h2 className="text-lg font-semibold text-white mb-1">
              {notifications.length === 0 ? 'No notifications yet' : 'No matching notifications'}
            </h2>
            <p className="text-sm text-surface-400 max-w-xs">
              {notifications.length === 0
                ? "When someone comments on your posts, likes your scripts, or invites you to a project, you'll see it here."
                : 'Try adjusting your filters to see more.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label}>
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 px-1">
                  {group.label}
                </h3>
                <Card className="divide-y divide-surface-800 overflow-hidden">
                  {group.items.map((n) => (
                    <NotificationRow key={n.id} notification={n} showDate={group.label === 'Earlier'} />
                  ))}
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
