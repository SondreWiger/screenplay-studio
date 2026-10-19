import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cinderra (cinderra.fun) runs Screenplay Studio's visual tools: mind maps,
 * mood boards, idea boards and company boards are Cinderra boards shown in an
 * iframe, with Screenplay Studio's own theme.
 *
 * Screenplay Studio decides who may open which board. Cinderra makes and signs
 * in the accounts: one per SPS user, plus one per project or company that owns
 * that workspace's boards, so a board survives the person who made it leaving.
 * Every open asks Cinderra for a fresh one-time embed URL with the role worked
 * out here.
 *
 * Server-only. Reads CINDERRA_PARTNER_SECRET.
 */

export type CinderraScope = 'project' | 'company' | 'user';
export type CinderraTool = 'mindmap' | 'moodboard' | 'ideas' | 'board';
export type CinderraKind = 'freeform' | 'kanban' | 'mindmap';
export type CinderraRole = 'editor' | 'commenter' | 'viewer';

export const CINDERRA_KINDS: CinderraKind[] = ['freeform', 'kanban', 'mindmap'];
export const CINDERRA_TOOLS: CinderraTool[] = ['mindmap', 'moodboard', 'ideas', 'board'];

export function cinderraUrl() {
  return (process.env.CINDERRA_URL || 'https://cinderra.fun').replace(/\/$/, '');
}

export function cinderraConfigured() {
  return Boolean(process.env.CINDERRA_PARTNER_SECRET);
}

export class CinderraError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const secret = process.env.CINDERRA_PARTNER_SECRET;
  if (!secret) throw new CinderraError('Cinderra is not configured', 503);

  let res: Response;
  try {
    res = await fetch(`${cinderraUrl()}/api/partner/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secret}`,
        'X-Partner': 'sps',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new CinderraError('Could not reach Cinderra', 502);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new CinderraError(json?.error || `Cinderra answered ${res.status}`, res.status === 404 ? 404 : 502);
  return json as T;
}

export interface CinderraBoardRef {
  id: string;
  title: string;
  icon: string | null;
  view_mode: string | null;
  updated_at: string;
}

/** The workspace account that owns a scope's boards. */
export function workspaceOwner(scope: CinderraScope, scopeId: string, name: string) {
  return scope === 'user'
    ? { external_id: scopeId, name, kind: 'person' as const }
    : { external_id: `${scope}:${scopeId}`, name, kind: 'workspace' as const };
}

export function createCinderraBoard(input: {
  owner: { external_id: string; name: string; kind: 'person' | 'workspace' };
  title: string;
  kind: CinderraKind;
  icon?: string;
  ref?: string;
}) {
  return call<{ board: CinderraBoardRef; created: boolean }>('POST', '/boards', input);
}

export function renameCinderraBoard(boardId: string, patch: { title?: string; icon?: string }) {
  return call<{ board: CinderraBoardRef }>('PATCH', `/boards/${boardId}`, patch);
}

export function deleteCinderraBoard(boardId: string) {
  return call<{ deleted: boolean }>('DELETE', `/boards/${boardId}`);
}

export function cinderraBoardTitles(ids: string[]) {
  if (ids.length === 0) return Promise.resolve({ boards: [] as CinderraBoardRef[] });
  return call<{ boards: CinderraBoardRef[] }>('GET', `/boards?ids=${ids.join(',')}`);
}

export function cinderraEmbedUrl(input: {
  boardId: string;
  user: { id: string; name: string; avatarUrl?: string | null };
  role: CinderraRole;
  origin?: string;
}) {
  return call<{ url: string; role: string }>('POST', '/embed', {
    board_id: input.boardId,
    user: {
      external_id: input.user.id,
      name: input.user.name,
      ...(input.user.avatarUrl ? { avatar_url: input.user.avatarUrl } : {}),
    },
    role: input.role,
    origin: input.origin,
  });
}

// ---------------------------------------------------------------------------
// "Log in with Screenplay Studio" on Cinderra
// ---------------------------------------------------------------------------

/** Where Cinderra may send the browser back to after sign-in. */
export function isCinderraCallback(redirectUri: string) {
  try {
    const u = new URL(redirectUri);
    const allowed = [cinderraUrl(), ...(process.env.CINDERRA_ORIGINS || '').split(',')]
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean);
    return allowed.includes(u.origin) && u.pathname === '/auth/partner/sps/callback';
  } catch {
    return false;
  }
}

/**
 * A two-minute signed statement of who is signing in to Cinderra, bound to the
 * `state` Cinderra issued. Mirrors verifyAssertion() in Cinderra's
 * src/lib/partner.js: the key is derived from the shared secret, so the API
 * secret itself never signs anything a browser carries.
 */
export function signCinderraAssertion(input: {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  state: string;
}) {
  const secret = process.env.CINDERRA_PARTNER_SECRET;
  if (!secret) throw new CinderraError('Cinderra is not configured', 503);
  const key = crypto.createHmac('sha256', secret).update('cinderra-sso-v1').digest();
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({
    iss: 'sps',
    aud: 'cinderra',
    sub: input.userId,
    name: input.name,
    ...(input.avatarUrl && /^https:\/\//.test(input.avatarUrl) ? { avatar_url: input.avatarUrl } : {}),
    state: input.state,
    iat: now,
    exp: now + 120,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${sig}`;
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

export interface ScopeAccess {
  /** null when the user may not see this scope at all. */
  role: CinderraRole | null;
  /** May create, rename and delete boards in this scope. */
  canManage: boolean;
  /** Name of the workspace account that owns the scope's boards. */
  ownerName: string;
}

/**
 * What `userId` may do with the boards of a project, company or personal
 * space. Uses the service-role client: callers have already authenticated.
 */
export async function scopeAccess(
  admin: SupabaseClient,
  userId: string,
  scope: CinderraScope,
  scopeId: string,
): Promise<ScopeAccess> {
  const none: ScopeAccess = { role: null, canManage: false, ownerName: '' };

  if (scope === 'user') {
    return scopeId === userId ? { role: 'editor', canManage: true, ownerName: 'Personal' } : none;
  }

  if (scope === 'project') {
    const [{ data: project }, { data: member }] = await Promise.all([
      admin.from('projects').select('id, title, created_by').eq('id', scopeId).maybeSingle(),
      admin.from('project_members').select('role').eq('project_id', scopeId).eq('user_id', userId).maybeSingle(),
    ]);
    if (!project) return none;
    const ownerName = `${project.title || 'Project'} · Screenplay Studio`;
    if (project.created_by === userId) return { role: 'editor', canManage: true, ownerName };
    if (!member) return none;
    const r = member.role as string;
    if (r === 'viewer') return { role: 'viewer', canManage: false, ownerName };
    return { role: 'editor', canManage: true, ownerName };
  }

  const [{ data: company }, { data: member }] = await Promise.all([
    admin.from('companies').select('id, name, owner_id').eq('id', scopeId).maybeSingle(),
    admin.from('company_members').select('role').eq('company_id', scopeId).eq('user_id', userId).maybeSingle(),
  ]);
  if (!company) return none;
  const ownerName = `${company.name || 'Company'} · Screenplay Studio`;
  if (company.owner_id === userId) return { role: 'editor', canManage: true, ownerName };
  if (!member) return none;
  const r = member.role as string;
  if (r === 'viewer') return { role: 'viewer', canManage: false, ownerName };
  return { role: 'editor', canManage: r === 'owner' || r === 'admin' || r === 'manager', ownerName };
}
