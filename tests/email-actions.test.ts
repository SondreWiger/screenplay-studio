import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────
let currentUser: { id: string } | null = null;
/** Per-table rows: `one` answers maybeSingle(), `many` answers awaited lists. */
let tables: Record<string, { one?: unknown; many?: unknown[] }> = {};
let rpcResult: unknown = null;
let authUser: { created_at: string; user_metadata: Record<string, unknown> } | null = null;
const updateUserById = vi.fn();

function builder(table: string) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit']) b[m] = () => b;
  b.maybeSingle = async () => ({ data: tables[table]?.one ?? null, error: null });
  b.single = b.maybeSingle;
  b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: tables[table]?.many ?? [], error: null }).then(res);
  return b;
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: currentUser } }) } }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({
    from: (t: string) => builder(t),
    rpc: async () => ({ data: rpcResult, error: null }),
    auth: { admin: { getUserById: async () => ({ data: { user: authUser } }), updateUserById } },
  }),
}));
vi.mock('@/lib/private-profile', () => ({
  findUserByEmail: async () => (tables.__found?.one ?? null),
  getEmailsByIds: async (_db: unknown, ids: string[]) => new Map(ids.map((id) => [id, `${id}@example.com`])),
}));
const sent: { to: { email: string }; body?: string; heading?: string }[] = [];
vi.mock('@/lib/mailer', () => {
  const ok = async (arg: unknown) => { sent.push(arg as never); return { success: true }; };
  return {
    sendNotificationEmail: ok,
    sendWelcomeEmail: async (to: { email: string }) => ok({ to }),
    sendProjectInviteEmail: async (to: { email: string }) => ok({ to }),
    sendTicketReplyEmail: async (to: { email: string }) => ok({ to }),
  };
});

import {
  sendCommentEmailAction, sendProjectInviteEmailAction, sendTicketReplyEmailAction, sendWelcomeEmailAction,
} from '@/lib/email-actions';

beforeEach(() => {
  currentUser = null;
  tables = {};
  rpcResult = null;
  authUser = null;
  sent.length = 0;
  updateUserById.mockReset();
});

describe('sendCommentEmailAction', () => {
  it('refuses callers who are not signed in', async () => {
    expect(await sendCommentEmailAction('c1')).toMatchObject({ success: false, error: 'Unauthorized' });
    expect(sent).toHaveLength(0);
  });

  it("refuses to send for someone else's comment", async () => {
    currentUser = { id: 'mallory' };
    tables.comments = { one: { id: 'c1', project_id: 'p1', content: 'hi', created_by: 'alice', created_at: new Date().toISOString() } };
    expect(await sendCommentEmailAction('c1')).toMatchObject({ success: false, error: 'Forbidden' });
    expect(sent).toHaveLength(0);
  });

  it('refuses old comments so they cannot be replayed', async () => {
    currentUser = { id: 'alice' };
    tables.comments = { one: { id: 'c1', project_id: 'p1', content: 'hi', created_by: 'alice', created_at: new Date(Date.now() - 3_600_000).toISOString() } };
    expect(await sendCommentEmailAction('c1')).toMatchObject({ success: false });
  });

  it('emails members with the saved comment, escaped', async () => {
    currentUser = { id: 'alice-c' };
    tables.comments = { one: { id: 'c2', project_id: 'p2', content: '<img src=x onerror=alert(1)>', comment_type: 'note', created_by: 'alice-c', created_at: new Date().toISOString() } };
    tables.projects = { one: { title: 'Film' } };
    tables.profiles = { one: { display_name: 'Alice' }, many: [{ id: 'bob', display_name: 'Bob' }] };
    tables.project_members = { many: [{ user_id: 'bob' }] };
    const r = await sendCommentEmailAction('c2');
    expect(r).toMatchObject({ success: true, sent: 1 });
    expect(sent[0].to.email).toBe('bob@example.com');
    expect(sent[0].body).toContain('&lt;img');
    expect(sent[0].body).not.toContain('<img');
  });
});

describe('sendProjectInviteEmailAction', () => {
  it('refuses people who cannot manage the project', async () => {
    currentUser = { id: 'mallory-i' };
    rpcResult = false;
    tables.project_members = { one: { user_id: 'bob' } };
    tables.projects = { one: { title: 'Film' } };
    expect(await sendProjectInviteEmailAction('p1', 'bob')).toMatchObject({ success: false, error: 'Forbidden' });
    expect(sent).toHaveLength(0);
  });

  it('only emails people who are members of the project', async () => {
    currentUser = { id: 'owner-i' };
    rpcResult = true;
    tables.projects = { one: { title: 'Film' } };
    expect(await sendProjectInviteEmailAction('p1', 'stranger')).toMatchObject({ success: false });
    tables.project_members = { one: { user_id: 'bob' } };
    expect(await sendProjectInviteEmailAction('p1', 'bob')).toMatchObject({ success: true });
    expect(sent[0].to.email).toBe('bob@example.com');
  });
});

describe('sendTicketReplyEmailAction', () => {
  it('is for staff only', async () => {
    currentUser = { id: 'writer' };
    tables.profiles = { one: { role: 'writer' } };
    tables.support_tickets = { one: { id: 't1', subject: 'Help', user_id: 'bob' } };
    expect(await sendTicketReplyEmailAction('t1')).toMatchObject({ success: false, error: 'Forbidden' });
    tables.profiles = { one: { role: 'moderator' } };
    expect(await sendTicketReplyEmailAction('t1')).toMatchObject({ success: true });
    expect(sent[0].to.email).toBe('bob@example.com');
  });
});

describe('sendWelcomeEmailAction', () => {
  it('only welcomes brand-new accounts, once', async () => {
    tables.__found = { one: { id: 'new-user', display_name: 'Nia' } };
    authUser = { created_at: new Date().toISOString(), user_metadata: {} };
    expect(await sendWelcomeEmailAction('nia@example.com', 'Nia')).toMatchObject({ success: true });
    expect(updateUserById).toHaveBeenCalledOnce();

    authUser = { created_at: new Date().toISOString(), user_metadata: { welcome_email_sent_at: 'x' } };
    // Different address so the in-memory limit doesn't mask the metadata check
    expect(await sendWelcomeEmailAction('nia2@example.com', 'Nia')).toMatchObject({ success: false, error: 'Welcome already sent' });
  });

  it('refuses old accounts and unknown addresses', async () => {
    authUser = { created_at: new Date(Date.now() - 86_400_000).toISOString(), user_metadata: {} };
    tables.__found = { one: { id: 'old-user' } };
    expect(await sendWelcomeEmailAction('old@example.com', 'X')).toMatchObject({ success: false });
    tables.__found = {};
    expect(await sendWelcomeEmailAction('nobody@example.com', 'X')).toMatchObject({ success: false, error: 'Unknown account' });
    expect(sent).toHaveLength(0);
  });
});
