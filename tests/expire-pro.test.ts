import { describe, it, expect, vi, beforeEach } from 'vitest';

const DAY = 86_400_000;
let due: { id: string; user_id: string; payment_method: string; current_period_end: string }[] = [];
let stillLive: { user_id: string }[] = [];
const expiredIds: string[][] = [];
const downgraded: string[][] = [];
const notified: { user_id: string; title: string }[][] = [];

function subscriptions() {
  let mode: 'due' | 'live' = 'due';
  const q: Record<string, unknown> = {
    select: (cols: string) => { mode = cols === 'user_id' ? 'live' : 'due'; return q; },
    eq: () => q, lt: () => q, gt: () => q, in: () => q,
    limit: async () => ({ data: due, error: null }),
    update: () => ({ in: async (_c: string, ids: string[]) => { expiredIds.push(ids); return { error: null }; } }),
    then: (res: (v: unknown) => unknown) => Promise.resolve({ data: mode === 'live' ? stillLive : due, error: null }).then(res),
  };
  return q;
}

vi.mock('@/lib/cron-auth', () => ({ rejectUnlessCron: () => null }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({
    from: (t: string) => {
      if (t === 'subscriptions') return subscriptions();
      if (t === 'profiles') return { update: () => ({ in: async (_c: string, ids: string[]) => { downgraded.push(ids); return { error: null }; } }) };
      if (t === 'notifications') return { insert: async (rows: { user_id: string; title: string }[]) => { notified.push(rows); return { error: null }; } };
      throw new Error(`unexpected table ${t}`);
    },
  }),
}));

import { GET } from '@/app/api/cron/expire-pro/route';

const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

beforeEach(() => {
  due = []; stillLive = [];
  expiredIds.length = 0; downgraded.length = 0; notified.length = 0;
});

describe('expire-pro cron', () => {
  it('ends gifts and donations as soon as they run out', async () => {
    due = [
      { id: 's1', user_id: 'gifted', payment_method: 'gift', current_period_end: ago(0.1) },
      { id: 's2', user_id: 'donor', payment_method: 'kofi', current_period_end: ago(0.1) },
    ];
    const res = await (await GET(new Request('http://x'))).json();
    expect(res).toEqual({ expired: 2, downgraded: 2 });
    expect(downgraded[0].sort()).toEqual(['donor', 'gifted']);
    expect(notified[0].map((n) => n.title).sort()).toEqual(['Your gifted Pro has ended', 'Your supporter Pro has ended']);
  });

  it('gives paid plans a grace period before ending them', async () => {
    due = [
      { id: 's1', user_id: 'just-lapsed', payment_method: 'paypal', current_period_end: ago(1) },
      { id: 's2', user_id: 'long-lapsed', payment_method: 'paypal', current_period_end: ago(5) },
    ];
    const res = await (await GET(new Request('http://x'))).json();
    expect(res).toEqual({ expired: 1, downgraded: 1 });
    expect(downgraded[0]).toEqual(['long-lapsed']);
  });

  it('never touches dev bypass grants', async () => {
    due = [{ id: 's1', user_id: 'dev', payment_method: 'dev_bypass', current_period_end: ago(30) }];
    const res = await (await GET(new Request('http://x'))).json();
    expect(res).toEqual({ expired: 0, downgraded: 0 });
    expect(downgraded).toHaveLength(0);
  });

  it('keeps Pro when another subscription is still live', async () => {
    due = [{ id: 's1', user_id: 'both', payment_method: 'gift', current_period_end: ago(0.1) }];
    stillLive = [{ user_id: 'both' }];
    const res = await (await GET(new Request('http://x'))).json();
    expect(res).toEqual({ expired: 1, downgraded: 0 });
    expect(expiredIds[0]).toEqual(['s1']);
    expect(downgraded).toHaveLength(0);
  });
});
