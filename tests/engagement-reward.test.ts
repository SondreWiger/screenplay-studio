import { describe, it, expect, vi, beforeEach } from 'vitest';

let denied = false;
let profiles: Record<string, unknown>[] = [];
const inserts: Record<string, unknown[]> = {};
const emails: { to: { email: string }; heading: string; body: string }[] = [];

function q(table: string) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order']) b[m] = () => b;
  b.maybeSingle = async () => ({ data: table === 'badges' ? { id: 'b1', name: 'Writer', emoji: '✍️' } : null, error: null });
  b.single = async () => ({ data: { id: 'sub-1' }, error: null });
  b.insert = (row: unknown) => { (inserts[table] ??= []).push(row); return { select: () => ({ single: async () => ({ data: { id: 'sub-1' }, error: null }) }), then: (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r) }; };
  b.update = () => ({ eq: async () => ({ error: null }) });
  b.upsert = async (row: unknown) => { (inserts[table] ??= []).push(row); return { error: null }; };
  b.delete = () => b;
  b.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: table === 'profiles' ? profiles : [], error: null }).then(r);
  return b;
}

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) } }) }));
vi.mock('@/lib/require-admin', () => ({
  rejectUnlessAdmin: async () => (denied ? new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) : null),
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => ({ from: (t: string) => q(t) }) }));
vi.mock('@/lib/private-profile', () => ({ fillEmails: async (_db: unknown, rows: { id: string; email?: string }[]) => { rows.forEach((r) => { r.email = `${r.id}@example.com`; }); return rows; } }));
vi.mock('@/lib/email-sent-notice', () => ({ recordEmailSent: async () => {} }));
vi.mock('@/lib/mailer', () => ({ sendNotificationEmail: async (m: never) => { emails.push(m); return { success: true }; } }));

import { POST } from '@/app/api/admin/engagement/reward/route';

const req = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as never;
const message = { subject: 'Hi {name}', heading: 'Thanks {name}', body: 'You get {months} months', ctaLabel: '', ctaUrl: '' };

beforeEach(() => {
  denied = false;
  profiles = [];
  for (const k of Object.keys(inserts)) delete inserts[k];
  emails.length = 0;
  process.env.RESEND_API_KEY = 'test';
});

describe('POST /api/admin/engagement/reward', () => {
  it('refuses non-admins', async () => {
    denied = true;
    const res = await POST(req({ userIds: ['u1'], perk: { type: 'thanks' }, message, channels: { notification: true, email: false } }));
    expect(res.status).toBe(403);
  });

  it('validates the perk', async () => {
    const res = await POST(req({ userIds: ['u1'], perk: { type: 'pro', months: 7 }, message, channels: { notification: false, email: false } }));
    expect(res.status).toBe(400);
  });

  it('skips people who already have Pro and gifts the rest', async () => {
    profiles = [
      { id: 'has-pro', display_name: 'Kim', is_pro: true },
      { id: 'free', display_name: 'Sam', is_pro: false },
    ];
    const res = await POST(req({ userIds: ['has-pro', 'free'], perk: { type: 'pro', months: 3 }, message, channels: { notification: true, email: false } }));
    const json = await res.json();
    expect(json.rewarded).toBe(1);
    expect(json.skipped).toEqual([{ id: 'has-pro', name: 'Kim', reason: 'Already has Pro' }]);
    expect(inserts.subscriptions).toHaveLength(1);
    expect(inserts.subscriptions[0]).toMatchObject({ user_id: 'free', payment_method: 'gift', status: 'active' });
  });

  it('escapes names in the email HTML', async () => {
    profiles = [{ id: 'evil', display_name: '<script>x</script>', is_pro: false }];
    await POST(req({ userIds: ['evil'], perk: { type: 'thanks' }, message, channels: { notification: false, email: true } }));
    expect(emails).toHaveLength(1);
    expect(emails[0].heading).toContain('&lt;script&gt;');
    expect(emails[0].heading).not.toContain('<script>');
  });
});
