# Screenplay Studio MCP server

Screenplay Studio exposes a [Model Context Protocol](https://modelcontextprotocol.io) server so Claude and other AI clients can work inside a user's projects: write and revise scripts, develop stories, break scripts down, plan shoots, run budgets, manage teams and, for admins, run the platform.

- Endpoint: `https://<your-site>/api/mcp` (Streamable HTTP, stateless JSON)
- Auth: `Authorization: Bearer sps_…` personal access token
- Tokens: **Settings → Claude & MCP** (`/settings/mcp`)
- Skill for Claude: [`public/mcp/SKILL.md`](../public/mcp/SKILL.md), served at `/mcp/SKILL.md`

## Setup

1. Apply the migration `supabase/migrations/20260914120000_mcp_tokens.sql`.
2. Open **Settings → Claude & MCP**, create a token, and copy the snippet for your client.

**Claude Code**

```bash
claude mcp add --transport http screenplay-studio https://<your-site>/api/mcp --header "Authorization: Bearer sps_..."
```

Install the skill:

```bash
mkdir -p ~/.claude/skills/screenplay-studio && curl -fsSL https://<your-site>/mcp/SKILL.md -o ~/.claude/skills/screenplay-studio/SKILL.md
```

**Claude Desktop** (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "screenplay-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<your-site>/api/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer sps_..." }
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`)

```json
{ "mcpServers": { "screenplay-studio": { "url": "https://<your-site>/api/mcp", "headers": { "Authorization": "Bearer sps_..." } } } }
```

Try it by hand:

```bash
curl -s https://<your-site>/api/mcp -H "Authorization: Bearer sps_..." -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Tools

| Area | Tools |
| --- | --- |
| Account & projects | `whoami`, `list_projects`, `get_project`, `create_project`, `update_project`, `delete_project` |
| Scripts | `list_scripts`, `create_script`, `update_script`, `delete_script`, `read_script`, `write_script`, `edit_script`, `find_replace`, `script_stats`, `export_script`, `save_draft`, `list_drafts`, `restore_draft` |
| Planning | `get_beat_sheet`, `update_beat_sheet`, `get_arc_map`, `update_arc_map`, `sync_scenes`, `search_project` |
| Records (every other table) | `describe_kinds`, `list_records`, `get_record`, `create_records`, `update_records`, `delete_records` |
| Team | `list_members`, `add_member`, `update_member`, `remove_member`, `read_messages`, `send_message` |
| Platform admin | `admin_stats`, `admin_find_users`, `admin_get_user`, `admin_update_user`, `admin_moderate_user`, `admin_reply_ticket`, `admin_notify` |

`tools/list` only returns what the caller can use: read tokens see read tools, and admin tools appear only for platform admins holding an admin token.

## Access model

Requests run with the service role (there is no Supabase session to carry RLS), so `src/lib/mcp/context.ts` enforces the same rules as `has_project_access` / `has_project_write_access`:

| Level | Who |
| --- | --- |
| read | any project member, the creator, or a platform admin |
| write | owner, admin, writer, editor — with a `write` or `admin` token |
| manage | owner or admin (team, share links, channels, project settings, script deletion) |
| own | the project owner (project deletion) |

Other safeguards:

- Tokens are 256-bit random, stored only as SHA-256 hashes, can expire, and can be revoked. At most 20 active per user.
- MCP access follows `PRO_LIMITS.*.api_access` (Pro, plus platform admins). Banned and suspended accounts are refused.
- Clients can only write the columns listed per kind; ownership columns (`project_id`, `created_by`, …) are set by the server.
- Rewrites, find & replace, and draft restores snapshot the script as a draft first. Delete tools require the exact title.
- Every write is logged to `audit_log` as `mcp.<tool>` with the token id. Rate limit: 240 requests/minute per token.
- `/api/mcp` bypasses the page middleware (cookies, bot filter); the route authenticates and rate-limits itself.

## Code map

```
src/app/api/mcp/route.ts          HTTP transport: auth, rate limit, JSON-RPC dispatch
src/app/api/mcp/tokens/route.ts   create / list / revoke tokens (cookie session)
src/app/settings/mcp/page.tsx     token UI and client setup snippets
src/lib/mcp/server.ts             initialize, tools/list, tools/call, instructions
src/lib/mcp/context.ts            token → user, project access checks, audit
src/lib/mcp/kinds.ts              registry of record kinds and their writable fields
src/lib/mcp/schema.ts             JSON Schema builders + argument validation
src/lib/mcp/script-ops.ts         pure script logic: ordering, renumbering, find/replace, outline, stats
src/lib/mcp/tools/*.ts            the tools
public/mcp/SKILL.md               the Claude skill
```

## Adding to it

**A new table** is usually one entry in `KINDS` (`src/lib/mcp/kinds.ts`): table, scope, group, a one-line `about`, and the writable `fields`. The record tools, `describe_kinds` and `search_project` pick it up. Add the kind to the skill; `tests/mcp.test.ts` fails if the skill misses one.

**A new tool** goes in the matching `src/lib/mcp/tools/*.ts` file using `tool({...})`: give it an input schema (arguments are validated against it), an `access` level, `destructive: true` if it deletes or overwrites, and call `ctx.requireProject` / `ctx.requireScript` / `ctx.requirePlatformAdmin` before touching data. Mention it in the skill.
