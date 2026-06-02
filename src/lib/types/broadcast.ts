// ════════════════════════════════════════════════════════════
// BROADCAST ENVIRONMENT — Production-Grade Types
// NRCS · Rundowns · Wire · Sources · Graphics · As-Run
// ════════════════════════════════════════════════════════════

// ─── Story ─────────────────────────────────────────────────

export type BroadcastStoryStatus =
  | 'draft' | 'working' | 'ready' | 'approved'
  | 'on_air' | 'killed' | 'archived';

export type BroadcastStoryType =
  | 'reader' | 'vo' | 'sot' | 'vosot' | 'pkg'
  | 'live' | 'interview' | 'donut'
  | 'break' | 'tease' | 'cold_open' | 'kicker' | 'other';

export interface BroadcastStory {
  id: string;
  project_id: string;
  slug: string;
  title: string;
  body: Record<string, unknown> | null;         // TipTap/ProseMirror JSON
  script_text: string | null;                     // Plain text for prompter
  status: BroadcastStoryStatus;
  story_type: BroadcastStoryType;
  priority: number;                                // 0–5 (0=routine, 5=flash)
  assigned_to: string | null;
  source: string | null;                           // 'staff', 'wire:ap', ...
  wire_story_id: string | null;
  estimated_duration: number | null;               // seconds
  embargo_until: string | null;
  version: number;
  locked_by: string | null;
  locked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BroadcastStoryVersion {
  id: string;
  story_id: string;
  version: number;
  body: Record<string, unknown> | null;
  script_text: string | null;
  changed_by: string | null;
  change_note: string | null;
  created_at: string;
}

// Story status display helpers
export const BROADCAST_STORY_STATUS_OPTIONS: { value: BroadcastStoryStatus; label: string; color: string }[] = [
  { value: 'draft',    label: 'Draft',    color: 'bg-surface-600' },
  { value: 'working',  label: 'Working',  color: 'bg-blue-600' },
  { value: 'ready',    label: 'Ready',    color: 'bg-cyan-600' },
  { value: 'approved', label: 'Approved', color: 'bg-green-600' },
  { value: 'on_air',   label: 'On Air',   color: 'bg-red-600' },
  { value: 'killed',   label: 'Killed',   color: 'bg-surface-800' },
  { value: 'archived', label: 'Archived', color: 'bg-surface-700' },
];

export const BROADCAST_STORY_TYPES: { value: BroadcastStoryType; label: string; abbr: string }[] = [
  { value: 'reader',    label: 'Reader',         abbr: 'RDR' },
  { value: 'vo',        label: 'Voice Over',     abbr: 'VO' },
  { value: 'sot',       label: 'Sound on Tape',  abbr: 'SOT' },
  { value: 'vosot',     label: 'VO/SOT',         abbr: 'VOSOT' },
  { value: 'pkg',       label: 'Package',        abbr: 'PKG' },
  { value: 'live',      label: 'Live',           abbr: 'LIVE' },
  { value: 'interview', label: 'Interview',      abbr: 'INT' },
  { value: 'donut',     label: 'Donut',          abbr: 'DNT' },
  { value: 'break',     label: 'Break',          abbr: 'BRK' },
  { value: 'tease',     label: 'Tease',          abbr: 'TSE' },
  { value: 'cold_open', label: 'Cold Open',      abbr: 'COLD' },
  { value: 'kicker',    label: 'Kicker',         abbr: 'KCK' },
  { value: 'other',     label: 'Other',          abbr: 'OTH' },
];

// ─── Rundown ───────────────────────────────────────────────

export type BroadcastRundownStatus =
  | 'planning' | 'rehearsal' | 'pre_show' | 'live' | 'completed' | 'archived';

export interface BroadcastRundown {
  id: string;
  project_id: string;
  title: string;
  show_date: string;                               // DATE as string
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: BroadcastRundownStatus;
  template_id: string | null;
  is_template: boolean;
  locked: boolean;
  locked_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const BROADCAST_RUNDOWN_STATUS_OPTIONS: { value: BroadcastRundownStatus; label: string; color: string }[] = [
  { value: 'planning',  label: 'Planning',  color: 'bg-surface-600' },
  { value: 'rehearsal', label: 'Rehearsal', color: 'bg-yellow-600' },
  { value: 'pre_show',  label: 'Pre-Show',  color: 'bg-amber-600' },
  { value: 'live',      label: 'LIVE',      color: 'bg-red-600' },
  { value: 'completed', label: 'Completed', color: 'bg-green-700' },
  { value: 'archived',  label: 'Archived',  color: 'bg-surface-700' },
];

// ─── Rundown Item ──────────────────────────────────────────

export type BroadcastRundownItemType =
  | 'anchor_read' | 'vo' | 'sot' | 'vosot' | 'pkg' | 'live_shot'
  | 'interview' | 'donut' | 'cold_open' | 'tease' | 'kicker'
  | 'break' | 'bumper' | 'commercial' | 'promo' | 'title_sequence'
  | 'weather' | 'sports_desk' | 'other';

export type BroadcastRundownItemStatus =
  | 'pending' | 'standby' | 'on_air' | 'done' | 'killed' | 'skipped';

export interface BroadcastRundownItem {
  id: string;
  rundown_id: string;
  story_id: string | null;
  sort_order: number;
  page_number: string | null;
  segment_slug: string | null;
  title: string;
  item_type: BroadcastRundownItemType;

  // Timing
  planned_duration: number;                        // seconds
  actual_duration: number | null;
  back_time: string | null;
  back_time_target: string | null;

  // Flags
  is_float: boolean;
  is_break: boolean;
  status: BroadcastRundownItemStatus;

  // Technical
  camera: string | null;
  audio_source: string | null;
  audio_notes: string | null;
  video_source: string | null;
  graphics_id: string | null;
  graphics_notes: string | null;
  prompter_text: string | null;

  // Talent
  presenter: string | null;
  reporter: string | null;

  // Notes
  director_notes: string | null;
  technical_notes: string | null;
  production_notes: string | null;

  // Media
  media_id: string | null;
  media_in_point: string | null;
  media_out_point: string | null;
  media_duration: number | null;

  // Display
  color: string | null;

  // Live timestamps
  on_air_at: string | null;
  off_air_at: string | null;

  created_at: string;
  updated_at: string;
}

export const BROADCAST_ITEM_TYPES: { value: BroadcastRundownItemType; label: string; abbr: string; color: string }[] = [
  { value: 'anchor_read',    label: 'Anchor Read',     abbr: 'RDR',   color: '#3b82f6' },
  { value: 'vo',             label: 'Voice Over',      abbr: 'VO',    color: '#06b6d4' },
  { value: 'sot',            label: 'Sound on Tape',   abbr: 'SOT',   color: '#8b5cf6' },
  { value: 'vosot',          label: 'VO/SOT',          abbr: 'VOSOT', color: '#6366f1' },
  { value: 'pkg',            label: 'Package',         abbr: 'PKG',   color: '#10b981' },
  { value: 'live_shot',      label: 'Live Shot',       abbr: 'LIVE',  color: '#ef4444' },
  { value: 'interview',      label: 'Interview',       abbr: 'INT',   color: '#f59e0b' },
  { value: 'donut',          label: 'Donut',           abbr: 'DNT',   color: '#a855f7' },
  { value: 'cold_open',      label: 'Cold Open',       abbr: 'COLD',  color: '#ec4899' },
  { value: 'tease',          label: 'Tease',           abbr: 'TSE',   color: '#f97316' },
  { value: 'kicker',         label: 'Kicker',          abbr: 'KCK',   color: '#84cc16' },
  { value: 'break',          label: 'Break',           abbr: 'BRK',   color: '#78716c' },
  { value: 'bumper',         label: 'Bumper',          abbr: 'BMP',   color: '#a8a29e' },
  { value: 'commercial',     label: 'Commercial',      abbr: 'COM',   color: '#fbbf24' },
  { value: 'promo',          label: 'Promo',           abbr: 'PRM',   color: '#fb923c' },
  { value: 'title_sequence', label: 'Title Sequence',  abbr: 'TTL',   color: '#14b8a6' },
  { value: 'weather',        label: 'Weather',         abbr: 'WX',    color: '#38bdf8' },
  { value: 'sports_desk',    label: 'Sports Desk',     abbr: 'SPT',   color: '#22c55e' },
  { value: 'other',          label: 'Other',           abbr: 'OTH',   color: '#94a3b8' },
];

export const BROADCAST_ITEM_STATUS_OPTIONS: { value: BroadcastRundownItemStatus; label: string }[] = [
  { value: 'pending',  label: 'Pending' },
  { value: 'standby',  label: 'Standby' },
  { value: 'on_air',   label: 'On Air' },
  { value: 'done',     label: 'Done' },
  { value: 'killed',   label: 'Killed' },
  { value: 'skipped',  label: 'Skipped' },
];

// ─── Wire Feeds ────────────────────────────────────────────

export type BroadcastWireFeedType = 'rss' | 'atom' | 'json_api';

export interface BroadcastWireFeed {
  id: string;
  project_id: string;
  name: string;
  feed_url: string;
  feed_type: BroadcastWireFeedType;
  category: string | null;
  is_active: boolean;
  poll_interval_seconds: number;
  last_polled_at: string | null;
  last_error: string | null;
  stories_ingested: number;
  created_at: string;
  updated_at: string;
}

export type BroadcastWirePriority = 'flash' | 'bulletin' | 'urgent' | 'routine' | 'deferred';

export interface BroadcastWireStory {
  id: string;
  feed_id: string;
  project_id: string;
  external_id: string;
  headline: string;
  summary: string | null;
  body: string | null;
  source_name: string | null;
  category: string | null;
  priority: BroadcastWirePriority;
  published_at: string | null;
  ingested_at: string;
  is_used: boolean;
  used_in_story_id: string | null;
}

export const BROADCAST_WIRE_PRIORITY_OPTIONS: { value: BroadcastWirePriority; label: string; color: string }[] = [
  { value: 'flash',    label: 'FLASH',    color: 'bg-red-600' },
  { value: 'bulletin', label: 'Bulletin', color: 'bg-orange-600' },
  { value: 'urgent',   label: 'Urgent',   color: 'bg-amber-600' },
  { value: 'routine',  label: 'Routine',  color: 'bg-surface-600' },
  { value: 'deferred', label: 'Deferred', color: 'bg-surface-700' },
];

// ─── Sources ───────────────────────────────────────────────

export type BroadcastSourceType =
  | 'camera' | 'robocam' | 'jib' | 'crane'
  | 'vtr' | 'video_server' | 'clip_player'
  | 'live_feed' | 'satellite' | 'remote'
  | 'graphics' | 'cg'
  | 'audio_only' | 'telephone' | 'skype'
  | 'ndi' | 'srt' | 'web_feed'
  | 'other';

export type BroadcastSourceProtocol =
  | 'sdi' | 'ndi' | 'srt' | 'hls' | 'rtmp' | 'rtsp' | 'webrtc' | 'nmos';

export type BroadcastTallyState = 'off' | 'preview' | 'program';

export interface BroadcastSource {
  id: string;
  project_id: string;
  name: string;
  short_name: string | null;
  source_type: BroadcastSourceType;
  protocol: BroadcastSourceProtocol | null;
  connection_url: string | null;
  ndi_source_name: string | null;
  srt_passphrase: string | null;
  nmos_node_id: string | null;
  nmos_sender_id: string | null;
  is_active: boolean;
  is_primary: boolean;
  tally_state: BroadcastTallyState;
  thumbnail_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ─── MOS Devices ───────────────────────────────────────────

export type BroadcastMosDeviceType =
  | 'graphics' | 'video_server' | 'prompter' | 'audio' | 'playout' | 'router' | 'other';

export type BroadcastMosConnectionStatus =
  | 'connected' | 'disconnected' | 'error' | 'timeout';

export interface BroadcastMosDevice {
  id: string;
  project_id: string;
  name: string;
  mos_id: string;
  ncs_id: string | null;
  device_type: BroadcastMosDeviceType;
  host: string;
  upper_port: number;
  lower_port: number;
  is_active: boolean;
  connection_status: BroadcastMosConnectionStatus;
  last_heartbeat: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Graphics / CG ────────────────────────────────────────

export type BroadcastGraphicsTemplateType =
  | 'lower_third' | 'full_screen' | 'ots' | 'locator' | 'ticker'
  | 'scorebug' | 'name_super' | 'title_card' | 'logo_bug' | 'strap'
  | 'clock' | 'breaking' | 'other';

export interface BroadcastGraphicsTemplateField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'color' | 'image' | 'boolean';
  default_value?: string;
}

export interface BroadcastGraphicsTemplate {
  id: string;
  project_id: string;
  name: string;
  template_type: BroadcastGraphicsTemplateType;
  fields: BroadcastGraphicsTemplateField[];
  cg_server: string | null;
  cg_channel: number | null;
  cg_layer: number | null;
  cg_template_path: string | null;
  preview_bg_color: string;
  sort_order: number;
  created_at: string;
}

export type BroadcastGraphicsCueStatus = 'ready' | 'standby' | 'on_air' | 'done';

export interface BroadcastGraphicsCue {
  id: string;
  project_id: string;
  rundown_id: string | null;
  rundown_item_id: string | null;
  template_id: string | null;
  sort_order: number;
  title: string;
  cue_type: string;
  field_values: Record<string, string>;
  duration_seconds: number;
  auto_next: boolean;
  status: BroadcastGraphicsCueStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── As-Run Log ────────────────────────────────────────────

export type BroadcastAsRunEventType =
  | 'segment_start' | 'segment_end'
  | 'break_start' | 'break_end'
  | 'graphic_on' | 'graphic_off'
  | 'source_switch'
  | 'override' | 'manual_note' | 'error'
  | 'show_start' | 'show_end';

export interface BroadcastAsRunLogEntry {
  id: string;
  project_id: string;
  rundown_id: string | null;
  rundown_item_id: string | null;
  event_type: BroadcastAsRunEventType;
  title: string;
  planned_time: string | null;
  actual_time: string;
  planned_duration: number | null;
  actual_duration: number | null;
  deviation_seconds: number;
  source: string | null;
  operator: string | null;
  notes: string | null;
  is_automatic: boolean;
  created_at: string;
}

// ─── Timing Marks ──────────────────────────────────────────

export type BroadcastTimingMarkType =
  | 'item_start' | 'item_end' | 'show_start' | 'show_end' | 'marker';

export interface BroadcastTimingMark {
  id: string;
  project_id: string;
  rundown_id: string;
  rundown_item_id: string | null;
  mark_type: BroadcastTimingMarkType;
  wall_time: string;
  show_elapsed_seconds: number | null;
  operator_id: string | null;
  notes: string | null;
  created_at: string;
}

// ─── Timing Engine Helpers (client-side) ───────────────────

/** Format seconds → "MM:SS" or "H:MM:SS" */
export function formatBroadcastDuration(seconds: number): string {
  if (seconds < 0) return '-' + formatBroadcastDuration(Math.abs(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Format ISO timestamp → "HH:MM:SS" in local time */
export function formatBroadcastTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/** Calculate cumulative durations for rundown items (forward timing) */
export function calculateCumulativeTiming(items: BroadcastRundownItem[]): Map<string, { cumulative: number; backTime: Date | null }> {
  const result = new Map<string, { cumulative: number; backTime: Date | null }>();
  let cumulative = 0;
  for (const item of items) {
    if (item.status === 'killed' || item.status === 'skipped') continue;
    cumulative += item.planned_duration;
    result.set(item.id, { cumulative, backTime: null });
  }
  return result;
}

/** Calculate back-times from scheduled end (working backwards) */
export function calculateBackTimes(
  items: BroadcastRundownItem[],
  scheduledEnd: Date
): Map<string, Date> {
  const result = new Map<string, Date>();
  const active = items.filter(i => i.status !== 'killed' && i.status !== 'skipped');
  let cursor = scheduledEnd.getTime();
  for (let i = active.length - 1; i >= 0; i--) {
    cursor -= active[i].planned_duration * 1000;
    result.set(active[i].id, new Date(cursor));
  }
  return result;
}

// ─── Stream Ingest ─────────────────────────────────────────

export type BroadcastIngestProtocol = 'rtmp' | 'srt' | 'whip' | 'rtsp' | 'ndi' | 'hls_pull';
export type BroadcastIngestStatus = 'idle' | 'connecting' | 'live' | 'error' | 'stopped';

export interface BroadcastStreamIngest {
  id: string;
  project_id: string;
  name: string;
  label: string | null;
  protocol: BroadcastIngestProtocol;
  ingest_url: string;
  stream_key: string;
  pull_url: string | null;
  status: BroadcastIngestStatus;
  video_codec: string | null;
  audio_codec: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  bitrate_kbps: number | null;
  last_keyframe_at: string | null;
  dropped_frames: number;
  uptime_seconds: number;
  auto_source: boolean;
  linked_source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const BROADCAST_INGEST_PROTOCOL_OPTIONS: { value: BroadcastIngestProtocol; label: string; description: string }[] = [
  { value: 'rtmp',     label: 'RTMP',     description: 'Standard broadcast protocol — works with OBS, Wirecast, vMix' },
  { value: 'srt',      label: 'SRT',      description: 'Secure Reliable Transport — low latency, firewall-friendly' },
  { value: 'whip',     label: 'WHIP',     description: 'WebRTC HTTP Ingest — browser-native ultra-low latency' },
  { value: 'rtsp',     label: 'RTSP',     description: 'Real Time Streaming Protocol — IP cameras, encoders' },
  { value: 'ndi',      label: 'NDI',      description: 'Network Device Interface — LAN-based production' },
  { value: 'hls_pull', label: 'HLS Pull',  description: 'Pull an HLS stream from a remote URL' },
];

// ─── Stream Output ─────────────────────────────────────────

export type BroadcastOutputPlatform =
  | 'youtube' | 'twitch' | 'facebook' | 'tiktok' | 'instagram'
  | 'x_twitter' | 'linkedin' | 'custom' | 'srt_push' | 'ndi_out';
export type BroadcastOutputStatus = 'idle' | 'starting' | 'live' | 'error' | 'stopping' | 'stopped';

export interface BroadcastStreamOutput {
  id: string;
  project_id: string;
  name: string;
  platform: BroadcastOutputPlatform;
  rtmp_url: string | null;
  stream_key: string | null;
  srt_url: string | null;
  video_bitrate_kbps: number;
  audio_bitrate_kbps: number;
  resolution: string;
  fps: number;
  status: BroadcastOutputStatus;
  error_message: string | null;
  started_at: string | null;
  uptime_seconds: number;
  bytes_sent: number;
  is_primary: boolean;
  auto_start: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const BROADCAST_OUTPUT_PLATFORMS: { value: BroadcastOutputPlatform; label: string; icon: string; color: string }[] = [
  { value: 'youtube',    label: 'YouTube',        icon: '▶',  color: '#ff0000' },
  { value: 'twitch',     label: 'Twitch',         icon: '◆',  color: '#9146ff' },
  { value: 'facebook',   label: 'Facebook Live',  icon: 'f',  color: '#1877f2' },
  { value: 'tiktok',     label: 'TikTok Live',    icon: '♪',  color: '#010101' },
  { value: 'instagram',  label: 'Instagram Live', icon: '◎',  color: '#e4405f' },
  { value: 'x_twitter',  label: 'X / Twitter',    icon: '𝕏',  color: '#000000' },
  { value: 'linkedin',   label: 'LinkedIn Live',  icon: 'in', color: '#0a66c2' },
  { value: 'custom',     label: 'Custom RTMP',    icon: '⚡', color: '#6366f1' },
  { value: 'srt_push',   label: 'SRT Push',       icon: '🔒', color: '#06b6d4' },
  { value: 'ndi_out',    label: 'NDI Output',     icon: '📡', color: '#22c55e' },
];

// ─── Switcher State ────────────────────────────────────────

export type BroadcastTransitionType =
  | 'cut' | 'mix' | 'dip' | 'wipe_h' | 'wipe_v' | 'wipe_circle' | 'stinger' | 'fade';

export type BroadcastUSKType = 'luma' | 'chroma' | 'pattern';

export type BroadcastPiPPosition =
  | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'custom';

export interface BroadcastSwitcherState {
  id: string;
  project_id: string;
  program_source_id: string | null;
  preview_source_id: string | null;
  transition_type: BroadcastTransitionType;
  transition_duration_ms: number;
  auto_transition: boolean;
  dsk_1_source_id: string | null;
  dsk_1_on_air: boolean;
  dsk_2_source_id: string | null;
  dsk_2_on_air: boolean;
  usk_1_type: BroadcastUSKType | null;
  usk_1_source_id: string | null;
  usk_1_on_air: boolean;
  audio_follow_video: boolean;
  ftb_active: boolean;
  pip_enabled: boolean;
  pip_source_id: string | null;
  pip_position: BroadcastPiPPosition | null;
  pip_size: number;
  last_take_at: string | null;
  operator_id: string | null;
  updated_at: string;
}

export const BROADCAST_TRANSITION_TYPES: { value: BroadcastTransitionType; label: string; icon: string }[] = [
  { value: 'cut',          label: 'CUT',           icon: '⚡' },
  { value: 'mix',          label: 'MIX / Dissolve', icon: '🔄' },
  { value: 'dip',          label: 'DIP to Black',  icon: '⬛' },
  { value: 'wipe_h',       label: 'Wipe H',        icon: '↔' },
  { value: 'wipe_v',       label: 'Wipe V',        icon: '↕' },
  { value: 'wipe_circle',  label: 'Circle Wipe',   icon: '◯' },
  { value: 'stinger',      label: 'Stinger',       icon: '✦' },
  { value: 'fade',         label: 'Fade',          icon: '🌑' },
];

// ─── Comms / Intercom ──────────────────────────────────────

export type BroadcastCommsChannelType =
  | 'party_line' | 'ifb' | 'program_audio' | 'iso' | 'playout' | 'stage_manager';

export interface BroadcastCommsChannelMember {
  user_id: string;
  role: 'talk_listen' | 'listen_only' | 'talk_only';
  name?: string;
}

export interface BroadcastCommsChannel {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  channel_type: BroadcastCommsChannelType;
  color: string;
  is_active: boolean;
  members: BroadcastCommsChannelMember[];
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const BROADCAST_COMMS_CHANNEL_TYPES: { value: BroadcastCommsChannelType; label: string; description: string }[] = [
  { value: 'party_line',    label: 'Party Line',     description: 'Open channel — everyone hears everyone' },
  { value: 'ifb',           label: 'IFB',            description: 'Interruptible Fold-Back — director to talent' },
  { value: 'program_audio', label: 'Program Audio',  description: 'Listen-only program output mix' },
  { value: 'iso',           label: 'ISO',            description: 'Isolated point-to-point channel' },
  { value: 'playout',       label: 'Playout',        description: 'Playout/MCR coordination' },
  { value: 'stage_manager', label: 'Stage Manager',  description: 'Floor/stage management channel' },
];

// ─── Playout / Master Control ──────────────────────────────

export type BroadcastPlayoutItemType =
  | 'clip' | 'live' | 'graphics' | 'break' | 'bug'
  | 'emergency' | 'black' | 'slate' | 'countdown' | 'still';

export type BroadcastPlayoutItemStatus =
  | 'queued' | 'cued' | 'playing' | 'done' | 'skipped';

export interface BroadcastPlayoutItem {
  id: string;
  project_id: string;
  sort_order: number;
  title: string;
  item_type: BroadcastPlayoutItemType;
  media_url: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  in_point_ms: number;
  out_point_ms: number | null;
  transition_type: string | null;
  transition_duration_ms: number;
  auto_next: boolean;
  status: BroadcastPlayoutItemStatus;
  source_id: string | null;
  loop: boolean;
  played_at: string | null;
  created_at: string;
  updated_at: string;
}

export const BROADCAST_PLAYOUT_ITEM_TYPES: { value: BroadcastPlayoutItemType; label: string; color: string }[] = [
  { value: 'clip',       label: 'Clip',       color: '#3b82f6' },
  { value: 'live',       label: 'Live',       color: '#ef4444' },
  { value: 'graphics',   label: 'Graphics',   color: '#8b5cf6' },
  { value: 'break',      label: 'Break',      color: '#78716c' },
  { value: 'bug',        label: 'Bug/Logo',   color: '#f59e0b' },
  { value: 'emergency',  label: 'Emergency',  color: '#dc2626' },
  { value: 'black',      label: 'Black',      color: '#18181b' },
  { value: 'slate',      label: 'Slate',      color: '#6b7280' },
  { value: 'countdown',  label: 'Countdown',  color: '#06b6d4' },
  { value: 'still',      label: 'Still Image', color: '#10b981' },
];
