import { ToolError, type McpContext } from './context';
import { validate } from './schema';
import { scopeAllows } from './tokens';
import { TextResult, type ToolDef } from './tool';
import { TOOLS, TOOLS_BY_NAME } from './tools';

/**
 * A stateless Model Context Protocol server.
 *
 * Implements the JSON-RPC methods of the MCP Streamable HTTP transport that a
 * tools-only server needs: initialize, ping, tools/list and tools/call. Every
 * request is answered with a single JSON response — no sessions and no SSE
 * streams — which is what lets it run as an ordinary serverless route.
 *
 * Kept free of Next.js so it can be tested by calling handleMessage directly.
 */

export const SERVER_INFO = { name: 'screenplay-studio', title: 'Screenplay Studio', version: '1.0.0' };

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export const INSTRUCTIONS = `Screenplay Studio is a screenwriting and film pre-production app. These tools act as the signed-in user, inside the projects they belong to.

How to work:
- Start with list_projects, then get_project for an overview (scripts, team, and a count of every kind of record).
- Scripts: read_script (fountain to read, elements for ids, outline for structure), write_script to add or rewrite Fountain text, edit_script for precise changes by element id, find_replace for renames. Rewrites and replacements save a restorable draft first.
- Everything else in a project — characters, locations, scenes, shots, schedule, budget, ideas, mind map, mood board, documents, notes, cast, gear, and more — goes through list_records / create_records / update_records / delete_records. Call describe_kinds to see the kinds and their fields.
- Planning: get_beat_sheet / update_beat_sheet, get_arc_map / update_arc_map, sync_scenes to create breakdown rows from scene headings, search_project to find anything.
- Batch: create_records takes many rows at once. Link records by id (shots.scene_id, scenes.cast_ids, schedule.scene_ids).
- Deleting is permanent. Only delete, remove members, message the team or moderate users when the user has asked for it.`;

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: { code: number; message: string; data?: unknown } };

export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export function rpcError(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/** The caller can use a tool if their token scope covers it (and, for admin tools, they are an admin). */
export function toolVisible(tool: ToolDef, ctx: Pick<McpContext, 'scope' | 'isPlatformAdmin'>): boolean {
  if (tool.access === 'admin') return ctx.isPlatformAdmin && ctx.scope === 'admin';
  return scopeAllows(ctx.scope, tool.access);
}

export function listTools(ctx: Pick<McpContext, 'scope' | 'isPlatformAdmin'>) {
  return TOOLS.filter((t) => toolVisible(t, ctx)).map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.input,
    annotations: {
      title: t.title,
      readOnlyHint: t.access === 'read' && t.name !== 'find_replace',
      destructiveHint: Boolean(t.destructive),
      idempotentHint: t.access === 'read',
      openWorldHint: false,
    },
  }));
}

function toolResult(output: unknown) {
  if (output instanceof TextResult) {
    const content = [];
    if (output.meta) content.push({ type: 'text', text: JSON.stringify(output.meta) });
    content.push({ type: 'text', text: output.text });
    return { content };
  }
  return { content: [{ type: 'text', text: JSON.stringify(output ?? { ok: true }) }] };
}

function toolError(message: string) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export async function callTool(name: string, args: unknown, ctx: McpContext) {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool || !toolVisible(tool, ctx)) {
    return toolError(tool ? `The "${name}" tool needs a ${tool.access} token.` : `Unknown tool "${name}".`);
  }

  const input = args ?? {};
  const problems = validate(tool.input, input);
  if (problems.length) return toolError(`Invalid arguments for ${name}:\n- ${problems.join('\n- ')}`);

  try {
    return toolResult(await tool.run(input as Record<string, unknown>, ctx));
  } catch (err) {
    if (err instanceof ToolError) return toolError(err.message);
    console.error(`[mcp] ${name} failed`, err);
    return toolError(`${name} failed unexpectedly. The error has been logged.`);
  }
}

/** Handles one JSON-RPC message. Returns null for notifications, which get no reply. */
export async function handleMessage(message: unknown, ctx: McpContext): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return rpcError(null, RPC.INVALID_REQUEST, 'Expected a JSON-RPC request object');
  }
  const req = message as JsonRpcRequest;
  const isNotification = req.id === undefined;
  if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return isNotification ? null : rpcError(req.id ?? null, RPC.INVALID_REQUEST, 'Invalid JSON-RPC request');
  }
  if (isNotification) return null;
  const id = req.id as JsonRpcId;
  const params = req.params ?? {};

  switch (req.method) {
    case 'initialize': {
      const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : LATEST_PROTOCOL_VERSION;
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: listTools(ctx) } };
    case 'tools/call': {
      if (typeof params.name !== 'string') return rpcError(id, RPC.INVALID_PARAMS, 'tools/call needs a tool name');
      return { jsonrpc: '2.0', id, result: await callTool(params.name, params.arguments, ctx) };
    }
    // Some clients probe these even when the capability is not advertised.
    case 'resources/list':
      return { jsonrpc: '2.0', id, result: { resources: [] } };
    case 'resources/templates/list':
      return { jsonrpc: '2.0', id, result: { resourceTemplates: [] } };
    case 'prompts/list':
      return { jsonrpc: '2.0', id, result: { prompts: [] } };
    default:
      return rpcError(id, RPC.METHOD_NOT_FOUND, `Method not found: ${req.method}`);
  }
}
