import { NextResponse } from 'next/server';
import {
  CINDERRA_KINDS, CINDERRA_TOOLS, cinderraBoardTitles, cinderraConfigured, cinderraUrl,
  createCinderraBoard, scopeAccess, workspaceOwner,
  type CinderraKind, type CinderraScope, type CinderraTool,
} from '@/lib/cinderra';
import { currentUser, errorResponse, isUuid } from '../shared';

const SCOPES: CinderraScope[] = ['project', 'company', 'user'];

const DEFAULT_TITLES: Record<CinderraTool, string> = {
  mindmap: 'Mind map',
  moodboard: 'Mood board',
  ideas: 'Idea board',
  board: 'Untitled board',
};

const TOOL_ICONS: Record<CinderraTool, string> = {
  mindmap: '🧠',
  moodboard: '🎨',
  ideas: '💡',
  board: '📋',
};

/**
 * GET /api/cinderra/boards?scope=project&scopeId=…&tool=mindmap
 *
 * The boards for one tool in one project, company or personal space, plus
 * what the caller may do there. Titles are refreshed from Cinderra, since a
 * board can be renamed from inside the embed.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const scope = params.get('scope') as CinderraScope;
  const scopeId = params.get('scopeId');
  const tool = params.get('tool') as CinderraTool | null;
  if (!SCOPES.includes(scope) || !isUuid(scopeId)) {
    return NextResponse.json({ error: 'Bad scope' }, { status: 400 });
  }
  if (tool && !CINDERRA_TOOLS.includes(tool)) {
    return NextResponse.json({ error: 'Bad tool' }, { status: 400 });
  }

  const me = await currentUser();
  if ('error' in me) return me.error;

  const access = await scopeAccess(me.admin, me.user.id, scope, scopeId);
  if (!access.role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Not connected yet: say so, and let the page fall back to the old tool,
  // before touching cinderra_boards (whose migration may not have run).
  if (!cinderraConfigured()) {
    return NextResponse.json({
      configured: false,
      cinderraUrl: cinderraUrl(),
      access: { role: access.role, canCreate: false, canManage: access.canManage },
      userId: me.user.id,
      boards: [],
    });
  }

  let query = me.admin
    .from('cinderra_boards')
    .select('id, scope, scope_id, tool, cinderra_board_id, title, kind, icon, created_by, created_at, updated_at')
    .eq('scope', scope)
    .eq('scope_id', scopeId)
    .order('created_at', { ascending: true });
  if (tool) query = query.eq('tool', tool);

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let boards = rows ?? [];
  if (cinderraConfigured() && boards.length > 0) {
    try {
      const { boards: live } = await cinderraBoardTitles(boards.map((b) => b.cinderra_board_id));
      const byId = new Map(live.map((b) => [b.id, b]));
      const changed = boards.filter((b) => {
        const l = byId.get(b.cinderra_board_id);
        return l && (l.title !== b.title || (l.icon ?? null) !== (b.icon ?? null));
      });
      await Promise.all(changed.map((b) => {
        const l = byId.get(b.cinderra_board_id)!;
        return me.admin.from('cinderra_boards')
          .update({ title: l.title, icon: l.icon, updated_at: l.updated_at })
          .eq('id', b.id);
      }));
      boards = boards.map((b) => {
        const l = byId.get(b.cinderra_board_id);
        return l ? { ...b, title: l.title, icon: l.icon, updated_at: l.updated_at } : b;
      });
    } catch {
      // Cinderra unreachable: show what we last knew.
    }
  }

  return NextResponse.json({
    configured: cinderraConfigured(),
    cinderraUrl: cinderraUrl(),
    access: { role: access.role, canCreate: access.role !== 'viewer', canManage: access.canManage },
    userId: me.user.id,
    boards,
  });
}

/**
 * POST /api/cinderra/boards  { scope, scopeId, tool, title?, kind? }
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const scope = body?.scope as CinderraScope;
  const scopeId = body?.scopeId;
  const tool = (body?.tool || 'board') as CinderraTool;
  const kind = (body?.kind || (tool === 'mindmap' ? 'mindmap' : 'freeform')) as CinderraKind;
  if (!SCOPES.includes(scope) || !isUuid(scopeId)) return NextResponse.json({ error: 'Bad scope' }, { status: 400 });
  if (!CINDERRA_TOOLS.includes(tool)) return NextResponse.json({ error: 'Bad tool' }, { status: 400 });
  if (!CINDERRA_KINDS.includes(kind)) return NextResponse.json({ error: 'Bad kind' }, { status: 400 });

  const me = await currentUser();
  if ('error' in me) return me.error;

  const access = await scopeAccess(me.admin, me.user.id, scope, scopeId);
  if (!access.role) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (access.role === 'viewer') return NextResponse.json({ error: 'You can view these boards but not add to them' }, { status: 403 });

  const title = (typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : DEFAULT_TITLES[tool]).slice(0, 200);

  try {
    const ownerName = scope === 'user' ? me.name : access.ownerName;
    const { board } = await createCinderraBoard({
      owner: workspaceOwner(scope, scopeId, ownerName),
      title,
      kind,
      icon: TOOL_ICONS[tool],
    });

    const { data: row, error } = await me.admin
      .from('cinderra_boards')
      .insert({
        scope, scope_id: scopeId, tool, kind,
        cinderra_board_id: board.id,
        title: board.title,
        icon: board.icon,
        created_by: me.user.id,
      })
      .select('id, scope, scope_id, tool, cinderra_board_id, title, kind, icon, created_by, created_at, updated_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ board: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'Could not create the board');
  }
}
