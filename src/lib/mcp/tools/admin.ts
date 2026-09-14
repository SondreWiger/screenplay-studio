import { moderateUser, type ModerationAction } from '@/lib/moderation';
import { ToolError } from '../context';
import { cleanRecord, type RecordKind } from '../kinds';
import { s } from '../schema';
import { compact, must, tool } from '../tool';

/**
 * Platform administration. Every tool here is `access: 'admin'`, so it is
 * only listed for, and only runs for, platform admins holding an admin token.
 * Site content (feedback, tickets, changelog, blog, flags, settings, badges,
 * challenges) is edited with the generic record tools and the admin kinds.
 */

const PROFILE_ADMIN_FIELDS: RecordKind = {
  table: 'profiles', group: 'admin', scope: 'platform', title: 'display_name', about: 'A user profile.',
  fields: {
    role: 'writer|moderator|admin', is_pro: 'bool', pro_since: 'datetime', insider_tier: 'alpha|beta', verified: 'bool',
    storage_limit_bytes: 'int', display_name: 'text', username: 'text', headline: 'text', bio: 'text', moderation_notes: 'text',
  },
};

const USER_SUMMARY = 'id, email, display_name, username, role, is_pro, pro_since, moderation_status, created_at, country';

export const adminTools = [
  tool<Record<string, never>>({
    name: 'admin_stats',
    title: 'Platform stats',
    access: 'admin',
    description: 'Platform totals: users, Pro users, projects, scripts, open tickets, and sign-ups over the last 7 and 30 days.',
    input: s.object({}),
    async run(_args, ctx) {
      ctx.requirePlatformAdmin();
      const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
      const [summary, week, month, feedback] = await Promise.all([
        ctx.db.from('admin_platform_summary').select('*').maybeSingle(),
        ctx.db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since(7)),
        ctx.db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since(30)),
        ctx.db.from('feedback_items').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      return compact({ ...(summary.data ?? {}), signups_7d: week.count, signups_30d: month.count, open_feedback: feedback.count });
    },
  }),

  tool<{ query?: string; role?: string; is_pro?: boolean; moderation_status?: string; limit?: number }>({
    name: 'admin_find_users',
    title: 'Find users',
    access: 'admin',
    description: 'Search accounts by email, name or username, optionally filtered by role, Pro status or moderation status.',
    input: s.object({
      query: s.string('Email, display name or username fragment'),
      role: s.enum(['writer', 'moderator', 'admin']),
      is_pro: s.boolean(),
      moderation_status: s.enum(['clean', 'warned', 'suspended', 'banned']),
      limit: s.integer('Default 25', { minimum: 1, maximum: 200 }),
    }),
    async run(args, ctx) {
      ctx.requirePlatformAdmin();
      let query = ctx.db.from('profiles').select(USER_SUMMARY).order('created_at', { ascending: false }).limit(args.limit ?? 25);
      if (args.query) {
        const term = args.query.replace(/[,()*%\\]/g, ' ').trim();
        query = query.or(`email.ilike.%${term}%,display_name.ilike.%${term}%,username.ilike.%${term}%,full_name.ilike.%${term}%`);
      }
      if (args.role) query = query.eq('role', args.role);
      if (args.is_pro !== undefined) query = query.eq('is_pro', args.is_pro);
      if (args.moderation_status) query = query.eq('moderation_status', args.moderation_status);
      return (must(await query, 'Searching users') as Record<string, unknown>[]).map((u) => compact(u));
    },
  }),

  tool<{ user_id: string }>({
    name: 'admin_get_user',
    title: 'User details',
    access: 'admin',
    description: 'Everything about one account: profile, projects, subscriptions, donations, moderation history, support tickets and recent logins.',
    input: s.object({ user_id: s.id('User id') }, ['user_id']),
    async run(args, ctx) {
      ctx.requirePlatformAdmin();
      const id = args.user_id;
      const [profile, projects, subscriptions, donations, bans, tickets, logins, gamification] = await Promise.all([
        ctx.db.from('profiles').select('*').eq('id', id).maybeSingle(),
        ctx.db.from('project_members').select('role, project:projects(id, title, status, updated_at)').eq('user_id', id),
        ctx.db.from('subscriptions').select('plan, status, billing_cycle, price_cents, current_period_end, cancel_at_period_end').eq('user_id', id),
        ctx.db.from('donations').select('amount_cents, status, pro_months_granted, created_at').eq('user_id', id),
        ctx.db.from('user_bans').select('ban_type, reason, is_active, expires_at, created_at').eq('user_id', id).order('created_at', { ascending: false }),
        ctx.db.from('support_tickets').select('id, subject, status, priority, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
        ctx.db.from('login_history').select('method, success, login_at').eq('user_id', id).order('login_at', { ascending: false }).limit(10),
        ctx.db.from('user_gamification').select('xp_total, level, login_streak').eq('user_id', id).maybeSingle(),
      ]);
      if (!profile.data) throw new ToolError(`User ${id} not found`);
      const { last_known_ip: _ip, social_links: _links, sidebar_tabs: _tabs, script_display_settings: _sds, ...rest } = profile.data as Record<string, unknown>;
      return compact({
        profile: compact(rest),
        projects: projects.data,
        subscriptions: subscriptions.data,
        donations: donations.data,
        moderation: bans.data,
        tickets: tickets.data,
        recent_logins: logins.data,
        gamification: gamification.data,
      });
    },
  }),

  tool<{ user_id: string; changes: Record<string, unknown> }>({
    name: 'admin_update_user',
    title: 'Update user',
    access: 'admin',
    description: `Change account fields: ${Object.keys(PROFILE_ADMIN_FIELDS.fields).join(', ')}. Use admin_moderate_user for warnings, suspensions and bans.`,
    input: s.object({ user_id: s.id('User id'), changes: s.record('Fields to change') }, ['user_id', 'changes']),
    async run(args, ctx) {
      ctx.requirePlatformAdmin();
      const { values, errors } = cleanRecord(PROFILE_ADMIN_FIELDS, args.changes, 'update');
      if (errors.length) throw new ToolError(errors.join('; '));
      if (values.is_pro === true && values.pro_since === undefined) values.pro_since = new Date().toISOString();
      const row = must(await ctx.db.from('profiles').update({ ...values, updated_at: new Date().toISOString() }).eq('id', args.user_id).select(USER_SUMMARY).maybeSingle(), 'Updating user');
      if (!row) throw new ToolError(`User ${args.user_id} not found`);
      await ctx.audit('admin_update_user', 'user', args.user_id, { changes: values });
      return compact(row as Record<string, unknown>);
    },
  }),

  tool<{ user_id: string; action: ModerationAction; reason?: string; duration_days?: number; flag_id?: string }>({
    name: 'admin_moderate_user',
    title: 'Moderate user',
    access: 'admin',
    destructive: true,
    description:
      'Warn, suspend (temporary), ban (permanent; also IP-bans and removes all project memberships), unban or unsuspend an account. The user gets a system message. Confirm with the admin before banning.',
    input: s.object({
      user_id: s.id('User id'),
      action: s.enum(['warn', 'suspend', 'ban', 'unban', 'unsuspend']),
      reason: s.string('Shown to the user. Required for warn, suspend and ban.'),
      duration_days: s.integer('Suspension length (default 30)', { minimum: 1 }),
      flag_id: s.id('Automod flag this acts on, if any'),
    }, ['user_id', 'action']),
    async run(args, ctx) {
      ctx.requirePlatformAdmin();
      if (args.user_id === ctx.user.id) throw new ToolError('You cannot moderate your own account.');
      const result = await moderateUser(ctx.db, ctx.user.id, args.action, {
        userId: args.user_id, reason: args.reason, durationDays: args.duration_days, flagId: args.flag_id,
      });
      if (!result.ok) throw new ToolError(result.error);
      return { done: args.action, user_id: args.user_id };
    },
  }),

  tool<{ ticket_id: string; content: string; status?: string }>({
    name: 'admin_reply_ticket',
    title: 'Reply to support ticket',
    access: 'admin',
    description: 'Reply to a support ticket as staff (the user is notified), optionally changing its status. Read the thread first with list_records kind "ticket_messages" filter { ticket_id }.',
    input: s.object({
      ticket_id: s.id('Ticket id'),
      content: s.string('Reply text', { minLength: 1 }),
      status: s.enum(['open', 'in_progress', 'resolved', 'closed']),
    }, ['ticket_id', 'content']),
    async run(args, ctx) {
      ctx.requirePlatformAdmin();
      const ticket = must(await ctx.db.from('support_tickets').select('id, user_id, subject').eq('id', args.ticket_id).maybeSingle(), 'Loading ticket') as { id: string; user_id: string; subject: string } | null;
      if (!ticket) throw new ToolError(`Ticket ${args.ticket_id} not found`);

      const message = must(await ctx.db.from('ticket_messages').insert({ ticket_id: ticket.id, user_id: ctx.user.id, content: args.content, is_staff: true }).select('id, created_at').single(), 'Posting reply');
      await ctx.db.from('support_tickets').update({ updated_at: new Date().toISOString(), ...(args.status ? { status: args.status } : {}) }).eq('id', ticket.id);
      if (ticket.user_id !== ctx.user.id) {
        await ctx.db.from('notifications').insert({
          user_id: ticket.user_id,
          type: 'ticket_reply',
          title: 'New reply on your support ticket',
          body: `Staff replied to "${ticket.subject}"`,
          link: `/support?ticket=${ticket.id}`,
          actor_id: ctx.user.id,
          entity_type: 'support_ticket',
          entity_id: ticket.id,
        });
      }
      await ctx.audit('admin_reply_ticket', 'support_ticket', ticket.id, { status: args.status });
      return { replied: true, ...(message as object), status: args.status };
    },
  }),

  tool<{ user_ids?: string[]; all_pro?: boolean; title: string; body?: string; link?: string }>({
    name: 'admin_notify',
    title: 'Send notification',
    access: 'admin',
    description: 'Send an in-app notification to specific users, or to every Pro subscriber. Confirm the wording with the admin before sending.',
    input: s.object({
      user_ids: s.array(s.id('User id'), 'Recipients', { maxItems: 1000 }),
      all_pro: s.boolean('Send to every Pro user instead of user_ids'),
      title: s.string('Notification title', { minLength: 1 }),
      body: s.string(),
      link: s.string('Relative link, e.g. /changelog'),
    }, ['title']),
    async run(args, ctx) {
      ctx.requirePlatformAdmin();
      let recipients = args.user_ids ?? [];
      if (args.all_pro) {
        recipients = (must(await ctx.db.from('profiles').select('id').eq('is_pro', true), 'Loading Pro users') as { id: string }[]).map((p) => p.id);
      }
      if (recipients.length === 0) throw new ToolError('No recipients: pass user_ids or all_pro: true');
      const rows = recipients.map((id) => ({ user_id: id, type: 'general', title: args.title, body: args.body ?? null, link: args.link ?? null, actor_id: ctx.user.id }));
      for (let i = 0; i < rows.length; i += 500) must(await ctx.db.from('notifications').insert(rows.slice(i, i + 500)), 'Sending notifications');
      await ctx.audit('admin_notify', 'notification', null, { recipients: recipients.length, title: args.title });
      return { sent: recipients.length };
    },
  }),
];
