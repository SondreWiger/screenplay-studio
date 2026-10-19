import { NextResponse } from 'next/server';
import { cinderraEmbedUrl, scopeAccess, type CinderraScope } from '@/lib/cinderra';
import { currentUser, errorResponse, isUuid } from '../shared';

/**
 * POST /api/cinderra/embed  { id }
 *
 * A one-time URL that opens the board in an iframe, signed in to Cinderra as
 * the caller, with the role their project or company membership gives them.
 * Asked for on every mount: the URL's sign-in token works once.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!isUuid(body?.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const me = await currentUser();
  if ('error' in me) return me.error;

  const { data: row } = await me.admin
    .from('cinderra_boards')
    .select('id, scope, scope_id, cinderra_board_id')
    .eq('id', body.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await scopeAccess(me.admin, me.user.id, row.scope as CinderraScope, row.scope_id);
  if (!access.role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const origin = req.headers.get('origin') || new URL(req.url).origin;

  try {
    const { url, role } = await cinderraEmbedUrl({
      boardId: row.cinderra_board_id,
      user: { id: me.user.id, name: me.name, avatarUrl: me.avatarUrl },
      role: access.role,
      origin,
    });
    return NextResponse.json({ url, role });
  } catch (err) {
    return errorResponse(err, 'Could not open the board');
  }
}
