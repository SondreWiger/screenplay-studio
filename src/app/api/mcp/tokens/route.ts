import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { canUseMcp } from '@/lib/mcp/context';
import { generateToken, type TokenScope } from '@/lib/mcp/tokens';

/**
 * Personal access tokens for the MCP endpoint, managed from Settings.
 *
 * Minting happens here, with the service role, after checking the signed-in
 * session — the mcp_tokens table has no insert policy, so a browser cannot
 * create a token for itself or anyone else. The plaintext token is returned
 * exactly once, from POST.
 */

const MAX_ACTIVE_TOKENS = 20;
const TOKEN_COLUMNS = 'id, name, token_prefix, scope, last_used_at, expires_at, revoked_at, created_at';

async function signedIn() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin.from('profiles').select('id, role, is_pro, moderation_status').eq('id', user.id).maybeSingle();
  if (!profile) return null;
  return { admin, profile, isPlatformAdmin: profile.role === 'admin' || profile.id === (process.env.ADMIN_UID || process.env.NEXT_PUBLIC_ADMIN_UID) };
}

export async function GET() {
  const session = await signedIn();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await session.admin
    .from('mcp_tokens')
    .select(TOKEN_COLUMNS)
    .eq('user_id', session.profile.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    tokens: data,
    eligible: canUseMcp(session.profile),
    can_create_admin: session.isPlatformAdmin,
  });
}

export async function POST(req: Request) {
  const session = await signedIn();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.profile.moderation_status === 'banned' || session.profile.moderation_status === 'suspended') {
    return NextResponse.json({ error: 'Account restricted' }, { status: 403 });
  }
  if (!canUseMcp(session.profile)) {
    return NextResponse.json({ error: 'MCP access is part of Screenplay Studio Pro' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { name?: unknown; scope?: unknown; expires_in_days?: unknown };
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const scope = body.scope as TokenScope;
  const days = body.expires_in_days === null || body.expires_in_days === undefined ? null : Number(body.expires_in_days);

  if (!name) return NextResponse.json({ error: 'Give the token a name' }, { status: 400 });
  if (!['read', 'write', 'admin'].includes(scope)) return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
  if (scope === 'admin' && !session.isPlatformAdmin) return NextResponse.json({ error: 'Only platform admins can create admin tokens' }, { status: 403 });
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) return NextResponse.json({ error: 'Invalid expiry' }, { status: 400 });

  const { count } = await session.admin
    .from('mcp_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.profile.id)
    .is('revoked_at', null);
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS) {
    return NextResponse.json({ error: `You can have at most ${MAX_ACTIVE_TOKENS} tokens. Revoke one first.` }, { status: 400 });
  }

  const { token, hash, prefix } = generateToken();
  const { data, error } = await session.admin
    .from('mcp_tokens')
    .insert({
      user_id: session.profile.id,
      name,
      scope,
      token_hash: hash,
      token_prefix: prefix,
      expires_at: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
    })
    .select(TOKEN_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await session.admin.from('audit_log').insert({
    user_id: session.profile.id,
    action: 'mcp_token_created',
    entity_type: 'mcp_token',
    entity_id: data.id,
    metadata: { name, scope, expires_at: data.expires_at },
  });

  return NextResponse.json({ token: data, secret: token });
}

export async function DELETE(req: Request) {
  const session = await signedIn();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { data, error } = await session.admin
    .from('mcp_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', session.profile.id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Token not found' }, { status: 404 });

  await session.admin.from('audit_log').insert({
    user_id: session.profile.id,
    action: 'mcp_token_revoked',
    entity_type: 'mcp_token',
    entity_id: id,
  });

  return NextResponse.json({ revoked: true });
}
