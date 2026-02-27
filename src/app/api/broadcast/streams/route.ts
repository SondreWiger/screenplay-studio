import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import crypto from 'crypto';

/**
 * GET /api/broadcast/streams?projectId=xxx
 * List all ingest streams for a project.
 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('broadcast_stream_ingests')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ streams: data });
}

/**
 * POST /api/broadcast/streams
 * Create a new ingest stream. Returns the stream with generated key.
 *
 * Body: { projectId, name, protocol? }
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { projectId, name, protocol = 'rtmp' } = body;

  if (!projectId || !name) {
    return NextResponse.json({ error: 'projectId and name required' }, { status: 400 });
  }

  // Generate stream key
  const streamKey = crypto.randomBytes(20).toString('hex');

  // Determine the ingest URL based on protocol
  const host = req.headers.get('host') || 'localhost';
  const hostname = host.split(':')[0];
  const rtmpPort = process.env.RTMP_PORT || '1935';
  const mediaHttpPort = process.env.MEDIA_HTTP_PORT || '8888';

  let ingestUrl: string;
  switch (protocol) {
    case 'rtmp':
      ingestUrl = `rtmp://${hostname}:${rtmpPort}/live`;
      break;
    case 'srt':
      ingestUrl = `srt://${hostname}:${rtmpPort}`;
      break;
    default:
      ingestUrl = `rtmp://${hostname}:${rtmpPort}/live`;
  }

  const { data, error } = await supabase
    .from('broadcast_stream_ingests')
    .insert({
      project_id: projectId,
      name,
      protocol,
      ingest_url: ingestUrl,
      stream_key: streamKey,
      auto_source: true,
      is_active: true,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add playback URLs to the response
  const playbackBase = `http://${hostname}:${mediaHttpPort}`;
  const streamPath = `${projectId}/${streamKey}`;

  return NextResponse.json({
    stream: data,
    connection: {
      rtmpServer: ingestUrl,
      streamKey: `${projectId}/${streamKey}`,
      fullRtmpUrl: `${ingestUrl}/${projectId}/${streamKey}`,
      hlsPlayback: `${playbackBase}/live/${streamPath}/index.m3u8`,
      httpFlvPlayback: `${playbackBase}/live/${streamPath}.flv`,
    },
  });
}

/**
 * DELETE /api/broadcast/streams?id=xxx
 * Delete an ingest stream.
 */
export async function DELETE(req: NextRequest) {
  const streamId = req.nextUrl.searchParams.get('id');
  if (!streamId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('broadcast_stream_ingests')
    .delete()
    .eq('id', streamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
