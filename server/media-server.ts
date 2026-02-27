/**
 * ════════════════════════════════════════════════════════════
 * Broadcast Media Server — RTMP ingest + HTTP-FLV + HLS output
 * ════════════════════════════════════════════════════════════
 *
 * This runs alongside Next.js as a separate process.
 * OBS / Wirecast / vMix / hardware encoders connect via RTMP.
 *
 * Start: npx ts-node --project tsconfig.server.json server/media-server.ts
 *   OR:  node server/media-server.js  (after build)
 *   OR:  npm run media-server
 *
 * Architecture:
 *   OBS  ──RTMP──►  Media Server (port 1935)  ──HLS──►  Browser
 *                        │
 *                   Auth callback to Supabase
 *                   (validates stream keys)
 *
 * RTMP URL:  rtmp://<your-host>/live
 * Stream Key: <project_id>/<stream_key>
 *
 * HLS output: http://<your-host>:8888/live/<project_id>/<stream_key>/index.m3u8
 * HTTP-FLV:   http://<your-host>:8888/live/<project_id>/<stream_key>.flv
 */

// @ts-nocheck — node-media-server types are incomplete
const NodeMediaServer = require('node-media-server');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');

// ─── Config ────────────────────────────────────────────────

const RTMP_PORT = parseInt(process.env.RTMP_PORT || '1935');
const HTTP_PORT = parseInt(process.env.MEDIA_HTTP_PORT || '8888');
const MEDIA_ROOT = process.env.MEDIA_ROOT || './media';

// Supabase admin client for stream key validation + status updates
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Copy from .env.local and set them as environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── NMS Config ────────────────────────────────────────────

const config = {
  logType: 3, // 0=none, 1=err, 2=warn, 3=log, 4=debug
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: HTTP_PORT,
    mediaroot: MEDIA_ROOT,
    allow_origin: '*',
  },
  // HLS transmuxing — creates .m3u8 + .ts segments for browser playback
  trans: {
    ffmpeg: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=6:hls_flags=delete_segments]',
        hlsKeep: false,
        // Also create a low-quality preview stream
        // dash: true,
        // dashFlags: '[f=dash:window_size=3:extra_window_size=5]',
      },
    ],
  },
};

const nms = new NodeMediaServer(config);

// ─── Stream Validation ─────────────────────────────────────

/**
 * Parse the RTMP stream path into project_id and stream_key.
 * Expected format: /live/<project_id>/<stream_key>
 */
function parseStreamPath(path: string): { projectId: string; streamKey: string } | null {
  // /live/project-uuid/stream-key
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 3 || parts[0] !== 'live') return null;
  return { projectId: parts[1], streamKey: parts[2] };
}

/**
 * Validate a stream key against the broadcast_stream_ingests table in Supabase.
 * Returns the ingest record if valid, null otherwise.
 */
async function validateStreamKey(projectId: string, streamKey: string) {
  try {
    const { data, error } = await supabase
      .from('broadcast_stream_ingests')
      .select('*')
      .eq('project_id', projectId)
      .eq('stream_key', streamKey)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;
    return data;
  } catch (err) {
    console.error('[AUTH] Supabase query failed:', err);
    return null;
  }
}

/**
 * Update the ingest status in Supabase.
 */
async function updateIngestStatus(
  projectId: string,
  streamKey: string,
  status: 'live' | 'idle' | 'error',
  meta?: Record<string, any>
) {
  try {
    const updateData: any = { status };
    if (status === 'live') {
      updateData.connected_at = new Date().toISOString();
      if (meta) {
        if (meta.video) {
          updateData.video_codec = meta.video.codec;
          updateData.width = meta.video.width;
          updateData.height = meta.video.height;
          updateData.fps = meta.video.fps;
        }
        if (meta.audio) {
          updateData.audio_codec = meta.audio.codec;
          updateData.audio_sample_rate = meta.audio.sampleRate;
          updateData.audio_channels = meta.audio.channels;
        }
      }
    } else if (status === 'idle') {
      updateData.disconnected_at = new Date().toISOString();
    }

    await supabase
      .from('broadcast_stream_ingests')
      .update(updateData)
      .eq('project_id', projectId)
      .eq('stream_key', streamKey);
  } catch (err) {
    console.error('[STATUS] Failed to update:', err);
  }
}

/**
 * Register the stream as a broadcast source automatically.
 */
async function autoRegisterSource(projectId: string, ingest: any) {
  if (!ingest.auto_source) return;

  // Check if a source already exists for this ingest
  const { data: existing } = await supabase
    .from('broadcast_sources')
    .select('id')
    .eq('project_id', projectId)
    .eq('connection_url', `ingest:${ingest.id}`)
    .single();

  if (existing) return; // Already registered

  await supabase.from('broadcast_sources').insert({
    project_id: projectId,
    name: ingest.name,
    short_name: ingest.name.substring(0, 6).toUpperCase(),
    source_type: 'camera',
    protocol: ingest.protocol || 'rtmp',
    connection_url: `ingest:${ingest.id}`,
    is_active: true,
    is_primary: false,
  });

  console.log(`[AUTO-SOURCE] Registered "${ingest.name}" as broadcast source`);
}

// ─── Event Handlers ────────────────────────────────────────

nms.on('prePublish', async (id: string, StreamPath: string, args: any) => {
  console.log(`[RTMP] prePublish id=${id} path=${StreamPath}`);

  const parsed = parseStreamPath(StreamPath);
  if (!parsed) {
    console.log(`[RTMP] ❌ Invalid path format: ${StreamPath}`);
    const session = nms.getSession(id);
    if (session) session.reject();
    return;
  }

  const ingest = await validateStreamKey(parsed.projectId, parsed.streamKey);
  if (!ingest) {
    console.log(`[RTMP] ❌ Invalid stream key for project ${parsed.projectId}`);
    const session = nms.getSession(id);
    if (session) session.reject();
    return;
  }

  console.log(`[RTMP] ✅ Authenticated: "${ingest.name}" (${parsed.projectId})`);
});

nms.on('postPublish', async (id: string, StreamPath: string, args: any) => {
  console.log(`[RTMP] postPublish — stream is live: ${StreamPath}`);

  const parsed = parseStreamPath(StreamPath);
  if (!parsed) return;

  // Get stream metadata
  const session = nms.getSession(id);
  const meta: any = {};
  if (session && session.publishStreamInfo) {
    meta.video = {
      codec: session.publishStreamInfo.video?.codec,
      width: session.publishStreamInfo.video?.width,
      height: session.publishStreamInfo.video?.height,
      fps: session.publishStreamInfo.video?.fps,
    };
    meta.audio = {
      codec: session.publishStreamInfo.audio?.codec,
      sampleRate: session.publishStreamInfo.audio?.sampleRate,
      channels: session.publishStreamInfo.audio?.channels,
    };
  }

  await updateIngestStatus(parsed.projectId, parsed.streamKey, 'live', meta);

  // Auto-register as broadcast source
  const ingest = await validateStreamKey(parsed.projectId, parsed.streamKey);
  if (ingest) await autoRegisterSource(parsed.projectId, ingest);
});

nms.on('donePublish', async (id: string, StreamPath: string, args: any) => {
  console.log(`[RTMP] donePublish — stream ended: ${StreamPath}`);

  const parsed = parseStreamPath(StreamPath);
  if (!parsed) return;

  await updateIngestStatus(parsed.projectId, parsed.streamKey, 'idle');
});

nms.on('prePlay', (id: string, StreamPath: string, args: any) => {
  console.log(`[PLAY] prePlay id=${id} path=${StreamPath}`);
  // Allow all viewers for now — could add auth here
});

nms.on('donePlay', (id: string, StreamPath: string, args: any) => {
  console.log(`[PLAY] donePlay id=${id} path=${StreamPath}`);
});

// ─── Start ─────────────────────────────────────────────────

console.log('');
console.log('═══════════════════════════════════════════════');
console.log('  Screenplay Studio — Media Server');
console.log('═══════════════════════════════════════════════');
console.log('');
console.log(`  RTMP Ingest:   rtmp://localhost:${RTMP_PORT}/live`);
console.log(`  HTTP (HLS/FLV): http://localhost:${HTTP_PORT}`);
console.log('');
console.log('  OBS Studio Settings:');
console.log('  ┌─────────────────────────────────────────┐');
console.log(`  │ Service:    Custom                       │`);
console.log(`  │ Server:     rtmp://localhost:${RTMP_PORT}/live   │`);
console.log(`  │ Stream Key: <project_id>/<stream_key>    │`);
console.log('  └─────────────────────────────────────────┘');
console.log('');
console.log('  Stream key format: {project_id}/{stream_key}');
console.log('  Get your stream key from the Stream Ingest page.');
console.log('');

nms.run();

// Health check endpoint on the HTTP port
// (node-media-server already serves HLS/FLV on HTTP_PORT)
// We'll add a simple JSON status endpoint via /api/streams
const statusInterval = setInterval(async () => {
  // Periodically report active sessions
  const sessions = nms.getSession ? nms.getSession() : {};
  const activeCount = Object.keys(sessions || {}).length;
  if (activeCount > 0) {
    console.log(`[HEALTH] Active sessions: ${activeCount}`);
  }
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SHUTDOWN] Stopping media server...');
  clearInterval(statusInterval);
  nms.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[SHUTDOWN] Stopping media server...');
  clearInterval(statusInterval);
  nms.stop();
  process.exit(0);
});
