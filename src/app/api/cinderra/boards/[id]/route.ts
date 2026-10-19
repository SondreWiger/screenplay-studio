import { NextResponse } from 'next/server';
import { deleteCinderraBoard, renameCinderraBoard, scopeAccess, type CinderraScope } from '@/lib/cinderra';
import { currentUser, errorResponse, isUuid } from '../../shared';

async function load(id: string) {
  const me = await currentUser();
  if ('error' in me) return { error: me.error } as const;
  if (!isUuid(id)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;

  const { data: row } = await me.admin
    .from('cinderra_boards')
    .select('id, scope, scope_id, cinderra_board_id, created_by')
    .eq('id', id)
    .maybeSingle();
  if (!row) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;

  const access = await scopeAccess(me.admin, me.user.id, row.scope as CinderraScope, row.scope_id);
  if (!access.role) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  // Whoever made a board may always rename or delete it; otherwise it takes
  // a manager of the project or company.
  const mayChange = access.role !== 'viewer' && (access.canManage || row.created_by === me.user.id);
  return { me, row, mayChange } as const;
}

/** PATCH /api/cinderra/boards/:id  { title } */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await load(params.id);
  if ('error' in ctx) return ctx.error;
  if (!ctx.mayChange) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 200) : '';
  if (!title) return NextResponse.json({ error: 'A title is required' }, { status: 400 });

  try {
    const { board } = await renameCinderraBoard(ctx.row.cinderra_board_id, { title });
    const { data } = await ctx.me.admin
      .from('cinderra_boards')
      .update({ title: board.title, updated_at: new Date().toISOString() })
      .eq('id', ctx.row.id)
      .select()
      .single();
    return NextResponse.json({ board: data });
  } catch (err) {
    return errorResponse(err, 'Could not rename the board');
  }
}

/** DELETE /api/cinderra/boards/:id — the board, in Cinderra too. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await load(params.id);
  if ('error' in ctx) return ctx.error;
  if (!ctx.mayChange) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  try {
    await deleteCinderraBoard(ctx.row.cinderra_board_id);
  } catch (err) {
    return errorResponse(err, 'Could not delete the board');
  }
  await ctx.me.admin.from('cinderra_boards').delete().eq('id', ctx.row.id);
  return NextResponse.json({ deleted: true });
}
