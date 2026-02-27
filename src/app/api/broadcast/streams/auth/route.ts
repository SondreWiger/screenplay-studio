import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * POST /api/broadcast/streams/auth
 * Validates an RTMP stream key. Called by the media server on prePublish.
 *
 * Body: { streamPath: "/live/<project_id>/<stream_key>" }
 *       OR: { projectId, streamKey }
 *
 * Returns 200 + ingest data if valid, 403 if invalid.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  let projectId: string;
  let streamKey: string;

  if (body.streamPath) {
    // Parse RTMP-style path: /live/<project_id>/<stream_key>
    const parts = body.streamPath.split('/').filter(Boolean);
    if (parts.length < 3 || parts[0] !== 'live') {
      return NextResponse.json({ error: 'Invalid stream path' }, { status: 403 });
    }
    projectId = parts[1];
    streamKey = parts[2];
  } else {
    projectId = body.projectId;
    streamKey = body.streamKey;
  }

  if (!projectId || !streamKey) {
    return NextResponse.json({ error: 'Missing projectId or streamKey' }, { status: 400 });
  }

  // Use admin client to bypass RLS
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('broadcast_stream_ingests')
    .select('*')
    .eq('project_id', projectId)
    .eq('stream_key', streamKey)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Invalid stream key' }, { status: 403 });
  }

  return NextResponse.json({
    valid: true,
    ingest: {
      id: data.id,
      name: data.name,
      protocol: data.protocol,
      auto_source: data.auto_source,
    },
  });
}

/**
 * GET /api/broadcast/streams/auth?projectId=xxx&streamKey=yyy
 * Quick validation for GET-based health checks.
 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  const streamKey = req.nextUrl.searchParams.get('streamKey');

  if (!projectId || !streamKey) {
    return NextResponse.json({ error: 'Missing projectId or streamKey' }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data } = await supabase
    .from('broadcast_stream_ingests')
    .select('id, name, status')
    .eq('project_id', projectId)
    .eq('stream_key', streamKey)
    .eq('is_active', true)
    .single();

  if (!data) {
    return NextResponse.json({ valid: false }, { status: 403 });
  }

  return NextResponse.json({ valid: true, status: data.status });
}
