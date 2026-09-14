import { ToolError, type McpContext } from './context';
import type { JsonSchema } from './schema';

/**
 * What a tool needs from the token:
 *   read   any token
 *   write  write or admin tokens (project roles are checked separately)
 *   admin  admin tokens held by a platform admin
 *
 * Tools a caller cannot use are left out of tools/list entirely, so Claude
 * never plans around a tool that will refuse it.
 */
export type ToolAccess = 'read' | 'write' | 'admin';

export interface ToolDef<A = Record<string, unknown>> {
  name: string;
  title: string;
  description: string;
  input: JsonSchema;
  access: ToolAccess;
  /** Deletes or overwrites data. Surfaced to clients as destructiveHint. */
  destructive?: boolean;
  run(args: A, ctx: McpContext): Promise<unknown>;
}

/** Identity function that keeps each tool's argument type next to its schema. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tool<A = any>(def: ToolDef<A>): ToolDef<A> {
  return def;
}

/**
 * A tool result that is mostly prose — a script, an export. Returned as a
 * plain text block rather than a JSON-escaped string, so screenplay line
 * breaks reach the model intact.
 */
export class TextResult {
  constructor(public readonly text: string, public readonly meta?: Record<string, unknown>) {}
}

export function text(body: string, meta?: Record<string, unknown>): TextResult {
  return new TextResult(body, meta);
}

/** Drops null, undefined, empty strings, empty arrays and empty objects to keep results short. */
export function compact<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}

/** Throws the database error as a readable tool error. */
export function must<T = unknown>(result: { data: unknown; error: { message: string; details?: string | null; hint?: string | null } | null }, what: string): T {
  if (result.error) {
    const extra = [result.error.details, result.error.hint].filter(Boolean).join(' ');
    throw new ToolError(`${what} failed: ${result.error.message}${extra ? ` (${extra})` : ''}`);
  }
  return result.data as T;
}
