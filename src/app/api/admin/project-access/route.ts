import { NextRequest, NextResponse } from 'next/server';
import {
  requestAdminProjectAccessAction,
  respondToAdminAccessAction,
  getPendingAccessRequestsForProjectAction,
  checkAdminAccessStatusAction,
} from '@/lib/admin-access-actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'request') {
      const { projectId, reasonType, customReason, standardReason } = body;
      if (!projectId) {
        return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
      }

      const res = await requestAdminProjectAccessAction({
        projectId,
        reasonType: reasonType || 'standard',
        customReason,
        standardReason,
      });

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json(res);
    }

    if (action === 'respond') {
      const { projectId, requestId, responseAction, note } = body;
      if (!projectId || !requestId || !responseAction) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const res = await respondToAdminAccessAction({
        projectId,
        requestId,
        action: responseAction,
        note,
      });

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const mode = searchParams.get('mode') || 'status';

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    if (mode === 'pending') {
      const requests = await getPendingAccessRequestsForProjectAction(projectId);
      return NextResponse.json({ requests });
    }

    const status = await checkAdminAccessStatusAction(projectId);
    return NextResponse.json(status);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
