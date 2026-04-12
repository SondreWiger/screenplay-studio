import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { spawn, ChildProcess } from 'child_process';

/**
 * POST /api/broadcast/relay
 * Start or stop an ffmpeg relay from an ingest stream to an output destination.
 *
 * Body: { action: 'start' | 'stop', outputId: string, projectId: string }
 *
 * When starting, finds the first live ingest for the project and relays
 * its HLS output to the RTMP destination defined in the output record.
 */

// Track active relay processes by output ID
const activeRelays = new Map<string, ChildProcess>();

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, outputId, projectId } = body;

  if (!action || !outputId || !projectId) {
    return NextResponse.json({ error: 'action, outputId, and projectId required' }, { status: 400 });
  }

  if (action === 'stop') {
    const proc = activeRelays.get(outputId);
    if (proc) {
      proc.kill('SIGTERM');
      activeRelays.delete(outputId);
    }
    // Update DB status
    await supabase
      .from('broadcast_stream_outputs')
      .update({ status: 'idle', started_at: null })
      .eq('id', outputId);

    await supabase.from('broadcast_as_run_log').insert({
      project_id: projectId,
      event_type: 'segment_end',
      title: 'OUTPUT STOPPED',
      is_automatic: false,
    });

    return NextResponse.json({ success: true, status: 'stopped' });
  }

  if (action === 'start') {
    // Kill existing relay for this output if any
    const existing = activeRelays.get(outputId);
    if (existing) {
      existing.kill('SIGTERM');
      activeRelays.delete(outputId);
    }

    // Get the output destination
    const { data: output, error: outErr } = await supabase
      .from('broadcast_stream_outputs')
      .select('*')
      .eq('id', outputId)
      .single();

    if (outErr || !output) {
      return NextResponse.json({ error: 'Output not found' }, { status: 404 });
    }

    if (!output.rtmp_url || !output.stream_key) {
      return NextResponse.json({ error: 'Output missing RTMP URL or stream key' }, { status: 400 });
    }

    // Find the first live ingest for this project
    const { data: ingests } = await supabase
      .from('broadcast_stream_ingests')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'live')
      .limit(1);

    // Build the HLS source URL from the ingest
    const mediaHost = process.env.MEDIA_SERVER_HOST || 'localhost';
    const mediaPort = process.env.MEDIA_HTTP_PORT || '8888';
    let sourceUrl: string;

    if (ingests && ingests.length > 0) {
      const ingest = ingests[0];
      sourceUrl = `http://${mediaHost}:${mediaPort}/live/${projectId}/${ingest.stream_key}/index.m3u8`;
    } else {
      // No live ingest — update output status to error
      await supabase
        .from('broadcast_stream_outputs')
        .update({ status: 'error', error_message: 'No live ingest stream found. Start streaming from OBS first.' })
        .eq('id', outputId);

      return NextResponse.json({
        error: 'No live ingest stream found. Start streaming from OBS first.',
      }, { status: 400 });
    }

    const destUrl = `${output.rtmp_url}/${output.stream_key}`;

    // Start ffmpeg relay
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    const args = [
      '-re',
      '-i', sourceUrl,
      '-c', 'copy',          // passthrough — no re-encoding
      '-f', 'flv',
      '-flvflags', 'no_duration_filesize',
      destUrl,
    ];

    try {
      const proc = spawn(ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      activeRelays.set(outputId, proc);

      // Update DB
      await supabase
        .from('broadcast_stream_outputs')
        .update({
          status: 'live',
          started_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', outputId);

      await supabase.from('broadcast_as_run_log').insert({
        project_id: projectId,
        event_type: 'segment_start',
        title: `OUTPUT STARTED: ${output.name} (${output.platform})`,
        is_automatic: false,
      });

      // Handle process exit
      proc.on('exit', async (code) => {
        activeRelays.delete(outputId);
        await supabase
          .from('broadcast_stream_outputs')
          .update({
            status: code === 0 ? 'idle' : 'error',
            error_message: code !== 0 ? `ffmpeg exited with code ${code}` : null,
          })
          .eq('id', outputId);
      });

      proc.on('error', async (err) => {
        activeRelays.delete(outputId);
        await supabase
          .from('broadcast_stream_outputs')
          .update({
            status: 'error',
            error_message: `ffmpeg error: ${err.message}`,
          })
          .eq('id', outputId);
      });

      return NextResponse.json({
        success: true,
        status: 'live',
        source: sourceUrl,
        destination: output.platform,
      });
    } catch (err: any) {
      await supabase
        .from('broadcast_stream_outputs')
        .update({
          status: 'error',
          error_message: `Failed to start ffmpeg: ${err.message}`,
        })
        .eq('id', outputId);

      return NextResponse.json({ error: `Failed to start relay: ${err.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid action. Use start or stop.' }, { status: 400 });
}

/**
 * GET /api/broadcast/relay?outputId=xxx
 * Check if a relay is active for a given output.
 */
export async function GET(req: NextRequest) {
  const outputId = req.nextUrl.searchParams.get('outputId');
  if (!outputId) return NextResponse.json({ error: 'outputId required' }, { status: 400 });

  const isActive = activeRelays.has(outputId);
  return NextResponse.json({ active: isActive });
}
