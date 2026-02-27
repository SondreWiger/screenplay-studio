import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * POST /api/broadcast/streams/status
 * Called by the media server to update stream status when a stream goes live, ends, or errors.
 *
 * Body: {
 *   projectId: string,
 *   streamKey: string,
 *   status: 'live' | 'idle' | 'error',
 *   meta?: { video?: {...}, audio?: {...} }
 * }
 */
export async function POST(req: NextRequest) {
  // Validate request — in production you'd add a shared secret here
  const authHeader = req.headers.get('x-media-server-key');
  const expectedKey = process.env.MEDIA_SERVER_SECRET || 'dev-media-key';
  if (authHeader !== expectedKey) {
    // Allow from localhost in development
    const forwarded = req.headers.get('x-forwarded-for') || '';
    const isLocal = forwarded.includes('127.0.0.1') || forwarded.includes('::1') || !authHeader;
    if (!isLocal && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const body = await req.json();
  const { projectId, streamKey, status, meta } = body;

  if (!projectId || !streamKey || !status) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const updateData: Record<string, any> = { status };

  if (status === 'live') {
    updateData.connected_at = new Date().toISOString();
    if (meta?.video) {
      if (meta.video.codec) updateData.video_codec = meta.video.codec;
      if (meta.video.width) updateData.width = meta.video.width;
      if (meta.video.height) updateData.height = meta.video.height;
      if (meta.video.fps) updateData.fps = meta.video.fps;
      if (meta.video.bitrate) updateData.bitrate_kbps = Math.round(meta.video.bitrate / 1000);
    }
    if (meta?.audio) {
      if (meta.audio.codec) updateData.audio_codec = meta.audio.codec;
      if (meta.audio.sampleRate) updateData.audio_sample_rate = meta.audio.sampleRate;
      if (meta.audio.channels) updateData.audio_channels = meta.audio.channels;
    }
  } else if (status === 'idle') {
    updateData.disconnected_at = new Date().toISOString();
  } else if (status === 'error') {
    updateData.disconnected_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('broadcast_stream_ingests')
    .update(updateData)
    .eq('project_id', projectId)
    .eq('stream_key', streamKey)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, stream: data });
}

/**
 * GET /api/broadcast/streams/status?projectId=xxx
 * Get all active streams and their statuses for a project.
 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('broadcast_stream_ingests')
    .select('id, name, status, protocol, video_codec, audio_codec, width, height, fps, bitrate_kbps, connected_at, uptime_seconds, dropped_frames')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    streams: data,
    liveCount: data?.filter(s => s.status === 'live').length || 0,
  });
}
