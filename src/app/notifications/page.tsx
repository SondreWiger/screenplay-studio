'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationStore } from '@/lib/stores';
import { NotificationRow } from '@/components/notifications/NotificationBell';
import { LoadingPage } from '@/components/ui';
import { ShellActions } from '@/components/shell/ShellActions';
import { ActionButton, AdminPage, EmptyState, PageHeader, Reveal, StatGrid, dailySpark } from '@/components/kit';
import { motion } from 'framer-motion';
import { Bell, BellOff, CheckCheck, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/components/TranslationProvider';
import type { NotificationType } from '@/lib/types';

const FILTER_OPTIONS: { key: 'all' | NotificationType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mention', label: 'Mentions' },
  { key: 'direct_message', label: 'Messages' },
  { key: 'community_comment', label: 'Comments' },
  { key: 'community_reply', label: 'Replies' },
  { key: 'community_upvote', label: 'Likes' },
  { key: 'collaborator_added', label: 'Collaborations' },
  { key: 'blog_comment', label: 'Blog' },
  { key: 'feedback_update', label: 'Feedback' },
  { key: 'project_invitation', label: 'Project Invites' },
  { key: 'company_invitation', label: 'Company Invites' },
  { key: 'project_comment', label: 'Project Comments' },
  { key: 'task_assigned', label: 'Tasks' },
  { key: 'ticket_reply', label: 'Support' },
];

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const { notifications, loading, markAllAsRead, fetchNotifications } = useNotificationStore();
  const [filter, setFilter] = useState<'all' | NotificationType>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth/login'); return; }
    fetchNotifications();
  }, [user, authLoading, fetchNotifications, router]);

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

  const weekAgo = Date.now() - 7 * 864e5;
  const counts = {
    total: notifications.length,
    unread: notifications.filter((n) => !n.read).length,
    today: notifications.filter((n) => isToday(n.created_at)).length,
    week: notifications.filter((n) => new Date(n.created_at).getTime() >= weekAgo).length,
  };
  const typeCounts = new Map<string, number>();
  notifications.forEach((n) => typeCounts.set(n.type, (typeCounts.get(n.type) ?? 0) + 1));
  // Only offer filters that match something (plus All and the active one)
  const filters = FILTER_OPTIONS.filter((o) => o.key === 'all' || o.key === filter || typeCounts.has(o.key));

  return (
    <div className="min-h-screen bg-surface-950">
      <ShellActions>
        <Link href="/settings?tab=notifications" className="inline-flex items-center gap-1.5 rounded-xl border border-surface-800 px-3 py-1.5 text-xs font-semibold text-surface-300 transition-colors hover:text-white">
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Settings</span>
        </Link>
      </ShellActions>

      <AdminPage className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PageHeader
          icon={<Bell className="h-5 w-5" />}
          title="Notifications"
          description={counts.unread > 0 ? `${counts.unread} unread of ${counts.total}` : 'You\'re all caught up'}
          actions={counts.unread > 0 && (
            <ActionButton variant="primary" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={markAllAsRead}>
              {t('notifications.mark_all_read')}
            </ActionButton>
          )}
        />

        <StatGrid
          cols={4}
          items={[
            { label: 'Unread', value: counts.unread, tone: 'brand', onClick: () => setShowUnreadOnly(!showUnreadOnly), active: showUnreadOnly, hint: 'Show unread only' },
            { label: 'Today', value: counts.today, tone: 'blue' },
            { label: 'This week', value: counts.week, tone: 'green', spark: dailySpark(notifications, (n) => n.created_at, 14) },
            { label: 'All time', value: counts.total, tone: 'neutral' },
          ]}
        />

        <Reveal className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {filters.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={cn(
                'relative shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                filter === opt.key ? 'text-white' : 'text-surface-400 hover:text-white',
              )}
            >
              {filter === opt.key && <motion.span layoutId="notif-filter" className="absolute inset-0 rounded-lg bg-brand-600/20 ring-1 ring-brand-500/40" />}
              <span className="relative">
                {opt.label}
                {opt.key !== 'all' && typeCounts.get(opt.key) ? <span className="ml-1.5 text-surface-500">{typeCounts.get(opt.key)}</span> : null}
              </span>
            </button>
          ))}
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={cn(
              'ml-auto shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
              showUnreadOnly ? 'border-brand-500/40 bg-brand-600/20 text-white' : 'border-surface-800 text-surface-400 hover:text-white',
            )}
          >
            Unread only
          </button>
        </Reveal>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<BellOff className="h-8 w-8" />}
            title={notifications.length === 0 ? t('notifications.no_notifications') : 'No matching notifications'}
            description={notifications.length === 0
              ? "When someone comments on your posts, likes your scripts, or invites you to a project, you'll see it here."
              : 'Try adjusting your filters to see more.'}
          />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <Reveal key={group.label}>
                <h3 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">
                  {group.label} <span className="text-surface-700">· {group.items.length}</span>
                </h3>
                <div className="divide-y divide-surface-800 overflow-hidden rounded-2xl border border-surface-800 bg-surface-900/60">
                  {group.items.map((n) => (
                    <NotificationRow key={n.id} notification={n} showDate={group.label === 'Earlier'} />
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </AdminPage>
    </div>
  );
}
