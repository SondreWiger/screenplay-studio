import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { PRO_LIMITS, type UserRole } from '@/lib/types';
import { hashToken, scopeAllows, type TokenScope } from './tokens';

/**
 * Who is calling, and what they may touch.
 *
 * The MCP route authenticates with a personal access token rather than a
 * Supabase session, so there is no JWT for row level security to read. Every
 * query therefore runs through the service role, and this file is where the
 * permissions RLS would have enforced are enforced instead. The rules mirror
 * the database helpers `has_project_access` / `has_project_write_access`:
 *
 *   read    any project member, the project creator, or a platform admin
 *   write   owner, admin, writer or editor — and a token scoped write+
 *   manage  owner or admin (team, share links, channels, project settings)
 *   own     the project owner (deleting the project)
 *
 * Nothing outside this file should decide access on its own.
 */

const ADMIN_UID = process.env.ADMIN_UID || process.env.NEXT_PUBLIC_ADMIN_UID || '';

export type AccessLevel = 'read' | 'write' | 'manage' | 'own';

/** An error whose message is safe and useful to show the client. */
export class ToolError extends Error {}

export interface McpUser {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  role: string | null;
  is_pro: boolean;
  moderation_status: string | null;
}

export interface ProjectAccess {
  project: { id: string; title: string; created_by: string; script_type: string | null; project_type: string | null; content_metadata: Record<string, unknown> | null };
  role: UserRole | null;
}

export interface McpContext {
  db: SupabaseClient;
  user: McpUser;
  scope: TokenScope;
  tokenId: string;
  isPlatformAdmin: boolean;
  siteUrl: string;
  requireScope(needed: TokenScope): void;
  requireProject(projectId: string, level: AccessLevel): Promise<ProjectAccess>;
  requireScript(scriptId: string, level: AccessLevel): Promise<ProjectAccess & { script: ScriptRow }>;
  requirePlatformAdmin(): void;
  audit(action: string, entityType: string, entityId: string | null, metadata?: Record<string, unknown>): Promise<void>;
}

export interface ScriptRow {
  id: string;
  project_id: string;
  title: string;
  locked: boolean | null;
  title_page_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  revision_color: string | null;
  updated_at: string;
}

const WRITE_ROLES: UserRole[] = ['owner', 'admin', 'writer', 'editor'];
const MANAGE_ROLES: UserRole[] = ['owner', 'admin'];

/** Pure role check, split out so it can be tested without a database. */
export function roleAllows(
  role: UserRole | null,
  level: AccessLevel,
  opts: { isCreator: boolean; isPlatformAdmin: boolean },
): boolean {
  const effective: UserRole | null = opts.isCreator ? 'owner' : role;
  switch (level) {
    case 'read': return effective !== null || opts.isPlatformAdmin;
    case 'write': return effective !== null && WRITE_ROLES.includes(effective);
    case 'manage': return effective !== null && MANAGE_ROLES.includes(effective);
    case 'own': return effective === 'owner';
  }
}

export function canUseMcp(profile: { id: string; is_pro: boolean | null; role: string | null }): boolean {
  if (profile.role === 'admin' || (ADMIN_UID && profile.id === ADMIN_UID)) return true;
  return PRO_LIMITS[profile.is_pro ? 'pro' : 'free'].api_access;
}

export type AuthResult =
  | { ok: true; ctx: McpContext }
  | { ok: false; status: number; message: string };

export async function authenticate(
  token: string,
  meta: { ip: string; userAgent: string; siteUrl: string },
): Promise<AuthResult> {
  const db = createAdminSupabaseClient();

  const { data: row, error } = await db
    .from('mcp_tokens')
    .select('id, user_id, scope, expires_at, revoked_at, last_used_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (error) return { ok: false, status: 500, message: 'Token lookup failed' };
  if (!row || row.revoked_at) return { ok: false, status: 401, message: 'Invalid or revoked token' };
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { ok: false, status: 401, message: 'Token has expired' };
  }

  const { data: profile } = await db
    .from('profiles')
    .select('id, email, display_name, username, role, is_pro, moderation_status')
    .eq('id', row.user_id)
    .maybeSingle();

  if (!profile) return { ok: false, status: 401, message: 'Account not found' };
  if (profile.moderation_status === 'banned' || profile.moderation_status === 'suspended') {
    return { ok: false, status: 403, message: `Account is ${profile.moderation_status}` };
  }
  if (!canUseMcp(profile)) {
    return { ok: false, status: 403, message: 'MCP access is part of Screenplay Studio Pro' };
  }

  // A write per request is wasteful; a minute of resolution is plenty.
  if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 60_000) {
    void db.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', row.id).then(() => {});
  }

  const isPlatformAdmin = profile.role === 'admin' || (!!ADMIN_UID && profile.id === ADMIN_UID);
  // An admin-scoped token held by someone who is no longer an admin is a write token.
  const scope: TokenScope = row.scope === 'admin' && !isPlatformAdmin ? 'write' : (row.scope as TokenScope);

  return { ok: true, ctx: buildContext(db, profile as McpUser, scope, row.id, isPlatformAdmin, meta) };
}

function buildContext(
  db: SupabaseClient,
  user: McpUser,
  scope: TokenScope,
  tokenId: string,
  isPlatformAdmin: boolean,
  meta: { ip: string; userAgent: string; siteUrl: string },
): McpContext {
  const roleCache = new Map<string, ProjectAccess>();

  const ctx: McpContext = {
    db,
    user,
    scope,
    tokenId,
    isPlatformAdmin,
    siteUrl: meta.siteUrl,

    requireScope(needed) {
      if (!scopeAllows(scope, needed)) {
        throw new ToolError(`This token is "${scope}" scoped; this action needs a "${needed}" token.`);
      }
    },

    requirePlatformAdmin() {
      if (!isPlatformAdmin) throw new ToolError('Platform administrators only.');
      ctx.requireScope('admin');
    },

    async requireProject(projectId, level) {
      if (level !== 'read') ctx.requireScope('write');

      let access = roleCache.get(projectId);
      if (!access) {
        const { data: project } = await db
          .from('projects')
          .select('id, title, created_by, script_type, project_type, content_metadata')
          .eq('id', projectId)
          .maybeSingle();
        if (!project) throw new ToolError(`Project ${projectId} not found`);

        const { data: member } = await db
          .from('project_members')
          .select('role')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();

        const role = project.created_by === user.id ? 'owner' : ((member?.role as UserRole) ?? null);
        access = { project, role };
        roleCache.set(projectId, access);
      }

      const allowed = roleAllows(access.role, level, {
        isCreator: access.project.created_by === user.id,
        isPlatformAdmin,
      });
      if (!allowed) {
        // Do not confirm a project exists to someone who cannot see it.
        if (!access.role && !isPlatformAdmin) throw new ToolError(`Project ${projectId} not found`);
        const need = { read: 'membership', write: 'an editing role', manage: 'owner or admin role', own: 'ownership' }[level];
        throw new ToolError(`You need ${need} on "${access.project.title}" to do that (your role: ${access.role ?? 'none'}).`);
      }
      return access;
    },

    async requireScript(scriptId, level) {
      const { data: script } = await db
        .from('scripts')
        .select('id, project_id, title, locked, title_page_data, metadata, revision_color, updated_at')
        .eq('id', scriptId)
        .maybeSingle();
      if (!script) throw new ToolError(`Script ${scriptId} not found`);
      const access = await ctx.requireProject(script.project_id, level);
      return { ...access, script: script as ScriptRow };
    },

    async audit(action, entityType, entityId, metadata = {}) {
      await db.from('audit_log').insert({
        user_id: user.id,
        action: `mcp.${action}`,
        entity_type: entityType,
        entity_id: entityId,
        ip_address: meta.ip,
        user_agent: meta.userAgent.slice(0, 500),
        metadata: { ...metadata, token_id: tokenId },
      });
    },
  };

  return ctx;
}
