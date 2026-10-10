import { NextRequest, NextResponse } from 'next/server';
import {
  requestAdminProjectAccessAction,
  respondToAdminAccessAction,
  getPendingAccessRequestsForProjectAction,
  checkAdminAccessStatusAction,
} from '@/lib/admin-access-actions';

function extractAuthToken(req: NextRequest): string | undefined {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const authToken = extractAuthToken(req);

    if (action === 'request') {
      const { projectId, reasonType, customReason, standardReason } = body;
      if (!projectId) {
        return NextResponse.json({ success: false, error: 'Missing projectId' }, { status: 400 });
      }

      const res = await requestAdminProjectAccessAction({
        projectId,
        reasonType: reasonType || 'standard',
        customReason,
        standardReason,
        authToken,
      });

      if (!res?.success) {
        return NextResponse.json({ success: false, error: res?.error || 'Failed to request access' }, { status: 400 });
      }
      return NextResponse.json(res);
    }

    if (action === 'respond') {
      const { projectId, requestId, responseAction, note } = body;
      if (!projectId || !requestId || !responseAction) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }

      const res = await respondToAdminAccessAction({
        projectId,
        requestId,
        action: responseAction,
        note,
        authToken,
      });

      if (!res?.success) {
        return NextResponse.json({ success: false, error: res?.error || 'Failed to update access request' }, { status: 400 });
      }
      return NextResponse.json(res);
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const mode = searchParams.get('mode') || 'status';
    const authToken = extractAuthToken(req);

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    if (mode === 'pending') {
      const requests = await getPendingAccessRequestsForProjectAction(projectId, authToken);
      return NextResponse.json({ requests });
    }

    const status = await checkAdminAccessStatusAction(projectId, authToken);
    return NextResponse.json(status);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
