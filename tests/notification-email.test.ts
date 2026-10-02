import { describe, it, expect, vi, beforeEach } from 'vitest';

const sent: { to: { email: string }; subject: string; body: string }[] = [];
let sendResult: { success: boolean; error?: string; messageId?: string } = { success: true, messageId: 'm1' };

vi.mock('@/lib/mailer', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mailer')>('@/lib/mailer');
  return {
    ...actual,
    sendNotificationEmail: vi.fn(async (opts: { to: { email: string }; subject: string; body: string }) => {
      sent.push(opts);
      return sendResult;
    }),
  };
});

import {
  deliverNotificationEmail, wantsEmail, notificationBodyHtml, EMAIL_PREF_BY_TYPE, type NotificationRecord,
} from '@/lib/notification-email';

// Minimal stand-in for the Supabase query builder: enough for the calls
// deliverNotificationEmail makes, backed by in-memory tables.
type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>) {
  const get = (row: Row, path: string) => {
    const [col, key] = path.split('->>');
    const v = row[col];
    return key ? (v as Row | null)?.[key] ?? null : v;
  };
  const query = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let patch: Row | null = null;
    const rows = () => (tables[table] || []).filter((r) => filters.every((f) => f(r)));
    const b = {
      select: () => b,
      update: (p: Row) => { patch = p; return b; },
      eq: (c: string, v: unknown) => { filters.push((r) => get(r, c) === v); return b; },
      neq: (c: string, v: unknown) => { filters.push((r) => get(r, c) !== v); return b; },
      is: (c: string, v: unknown) => { filters.push((r) => (get(r, c) ?? null) === v); return b; },
      ilike: (c: string, v: string) => { filters.push((r) => String(get(r, c)).toLowerCase() === v.toLowerCase()); return b; },
      gte: (c: string, v: string) => { filters.push((r) => String(get(r, c)) >= v); return b; },
      limit: () => b,
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve: (v: { data: Row[]; error: null }) => void) => {
        const matched = rows();
        if (patch) matched.forEach((r) => Object.assign(r, patch));
        resolve({ data: matched, error: null });
      },
    };
    return b;
  };
  return { from: query, auth: { admin: { getUserById: async () => ({ data: { user: null } }) } } } as never;
}

function notification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: 'n1', user_id: 'u1', type: 'direct_message', title: 'Ada sent you a message', body: 'Hi <b>there</b>',
    link: '/messages?convo=c1', actor_id: 'u2', entity_id: 'c1', metadata: null,
    created_at: new Date().toISOString(), ...overrides,
  };
}

beforeEach(() => { sent.length = 0; sendResult = { success: true, messageId: 'm1' }; });

describe('preferences', () => {
  it('maps every emailed type to a setting', () => {
    expect(EMAIL_PREF_BY_TYPE.project_invitation).toBe('email_project_invites');
    expect(EMAIL_PREF_BY_TYPE.direct_message).toBe('email_direct_messages');
    expect(EMAIL_PREF_BY_TYPE.ticket_reply).toBe('email_ticket_replies');
    expect(EMAIL_PREF_BY_TYPE.mention).toBe('email_mentions');
    expect(EMAIL_PREF_BY_TYPE.community_upvote).toBeUndefined();
  });

  it('uses the column defaults when a value is missing', () => {
    expect(wantsEmail('email_mentions', null)).toBe(true);
    expect(wantsEmail('email_mentions', { email_mentions: null })).toBe(true);
    expect(wantsEmail('email_mentions', { email_mentions: false })).toBe(false);
  });

  it('escapes user text in the email body', () => {
    expect(notificationBodyHtml('a <script>x</script>\nb')).toBe('a &lt;script&gt;x&lt;/script&gt;<br>b');
  });
});

describe('deliverNotificationEmail', () => {
  const base = () => ({
    notifications: [notification() as unknown as Row],
    profiles: [{ id: 'u1', display_name: 'Bo', email_direct_messages: true }],
    profile_contact: [{ id: 'u1', email: 'bo@example.com' }],
  });

  it('sends to the recipient and records it', async () => {
    const tables = base();
    const outcome = await deliverNotificationEmail(fakeDb(tables), notification());
    expect(outcome).toBe('sent');
    expect(sent[0].to.email).toBe('bo@example.com');
    expect(sent[0].body).toBe('Hi &lt;b&gt;there&lt;/b&gt;');
    expect((tables.notifications[0].metadata as Row).email_status).toBe('sent');
  });

  it('respects the recipient turning the email off', async () => {
    const tables = base();
    tables.profiles[0].email_direct_messages = false;
    expect(await deliverNotificationEmail(fakeDb(tables), notification())).toBe('opted_out');
    expect(sent).toHaveLength(0);
  });

  it('never emails the same notification twice', async () => {
    const tables = base();
    await deliverNotificationEmail(fakeDb(tables), notification());
    expect(await deliverNotificationEmail(fakeDb(tables), notification())).toBe('already_handled');
    expect(sent).toHaveLength(1);
  });

  it('sends one email per conversation within the cooldown', async () => {
    const tables = base();
    tables.notifications.push({ ...notification({ id: 'n0' }), metadata: { email_status: 'sent' } } as unknown as Row);
    expect(await deliverNotificationEmail(fakeDb(tables), notification())).toBe('cooldown');
    expect(sent).toHaveLength(0);
  });

  it('skips types that never send email', async () => {
    const tables = base();
    expect(await deliverNotificationEmail(fakeDb(tables), notification({ type: 'community_upvote' }))).toBe('type_not_emailed');
  });

  it('records the provider error when sending fails', async () => {
    const tables = base();
    sendResult = { success: false, error: 'domain not verified' };
    expect(await deliverNotificationEmail(fakeDb(tables), notification())).toBe('failed');
    expect((tables.notifications[0].metadata as Row).email_error).toBe('domain not verified');
  });
});
