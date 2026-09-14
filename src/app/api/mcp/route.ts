import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/mcp/context';
import { handleMessage, rpcError, RPC, type JsonRpcResponse } from '@/lib/mcp/server';
import { tokenFromHeader } from '@/lib/mcp/tokens';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * The MCP endpoint: https://<site>/api/mcp
 *
 * Streamable HTTP, stateless. Clients POST JSON-RPC and get JSON back.
 * Authenticated with a personal access token from Settings → Claude & MCP:
 *
 *   Authorization: Bearer sps_...
 *
 * The middleware skips this path (see PUBLIC_PREFIXES) because MCP clients
 * have no cookies and often send short user agents; auth and rate limiting
 * happen here instead.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const REQUESTS_PER_MINUTE = 240;

function unauthorized(status: number, message: string, siteUrl: string) {
  return NextResponse.json(rpcError(null, RPC.INVALID_REQUEST, message), {
    status,
    headers: status === 401
      ? { 'WWW-Authenticate': `Bearer realm="Screenplay Studio", error="invalid_token", error_description="${message}. Create a token at ${siteUrl}/settings/mcp"` }
      : {},
  });
}

export async function POST(req: Request) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');

  const token = tokenFromHeader(req.headers.get('authorization'));
  if (!token) return unauthorized(401, 'Missing access token', siteUrl);

  const auth = await authenticate(token, { ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? '', siteUrl });
  if (!auth.ok) return unauthorized(auth.status, auth.message, siteUrl);

  const limit = checkRateLimit(`mcp:${auth.ctx.tokenId}`, REQUESTS_PER_MINUTE);
  if (!limit.allowed) {
    return NextResponse.json(rpcError(null, RPC.INTERNAL_ERROR, `Rate limit exceeded, retry in ${limit.retryAfter}s`), {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfter) },
    });
  }

  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json(rpcError(null, RPC.INVALID_REQUEST, 'Request body too large'), { status: 413 });
  }

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return NextResponse.json(rpcError(null, RPC.INVALID_REQUEST, 'Request body too large'), { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(rpcError(null, RPC.PARSE_ERROR, 'Body is not valid JSON'), { status: 400 });
  }

  // Older protocol versions allow batching several messages in one array.
  if (Array.isArray(body)) {
    if (body.length === 0) return NextResponse.json(rpcError(null, RPC.INVALID_REQUEST, 'Empty batch'), { status: 400 });
    const replies: JsonRpcResponse[] = [];
    for (const message of body) {
      const reply = await handleMessage(message, auth.ctx);
      if (reply) replies.push(reply);
    }
    return replies.length ? NextResponse.json(replies) : new NextResponse(null, { status: 202 });
  }

  const reply = await handleMessage(body, auth.ctx);
  return reply ? NextResponse.json(reply) : new NextResponse(null, { status: 202 });
}

/** No server-initiated stream: this server never sends requests to the client. */
export function GET() {
  return new NextResponse('Screenplay Studio MCP endpoint. POST JSON-RPC with an access token.', {
    status: 405,
    headers: { Allow: 'POST' },
  });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}
