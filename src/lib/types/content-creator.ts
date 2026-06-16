import type { ScriptElementType, RevisionColor, ProjectType, ScriptType } from './base';

// Project Documents & Folders

export type DocumentType = 'plain_text' | 'notes' | 'outline' | 'treatment' | 'research';

export interface DashboardFolder {
  id: string;
  user_id: string;
  name: string;
  color: string;
  emoji: string | null;
  sort_order: number;
  is_collapsed: boolean;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFolder {
  id: string;
  project_id: string;
  parent_folder_id: string | null;
  name: string;
  color: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  children?: ProjectFolder[];
  documents?: ProjectDocument[];
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  folder_id: string | null;
  title: string;
  doc_type: DocumentType;
  content: string;
  word_count: number;
  is_pinned: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
  created_by: string | null;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  plain_text: 'Plain Text',
  notes: 'Notes',
  outline: 'Outline',
  treatment: 'Treatment',
  research: 'Research',
};

export const DOCUMENT_TYPE_ICONS: Record<DocumentType, string> = {
  plain_text: 'DOC',
  notes: 'NOTE',
  outline: 'BRIEF',
  treatment: 'REF',
  research: 'RES',
};

export const ELEMENT_LABELS: Record<ScriptElementType, string> = {
  scene_heading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
  shot: 'Shot',
  note: 'Note',
  page_break: 'Page Break',
  title_page: 'Title Page',
  centered: 'Centered',
  lyrics: 'Lyrics',
  synopsis: 'Synopsis',
  section: 'Section',
  act: 'Act',
  sequence: 'Sequence',
  sequence_end: 'End Sequence',
  // YouTube/Content Creator elements
  hook: 'Hook',
  talking_point: 'Talking Point',
  broll_note: 'B-Roll Note',
  cta: 'CTA',
  sponsor_read: 'Sponsor Read',
  chapter_marker: 'Chapter',
  // Audio Drama elements
  sfx_cue: 'SFX Cue',
  music_cue: 'Music Cue',
  ambience_cue: 'Ambience Cue',
  act_break: 'Act Break',
  announcer: 'Announcer',
  sound_cue: 'Sound Cue',
  // Musical Theatre / Stage Play elements
  song_title: 'Song',
  lyric: 'Lyric',
  dance_direction: 'Dance Direction',
  musical_cue: 'Musical Cue',
  lighting_cue: 'Lighting Cue',
  set_direction: 'Set Direction',
};

export const ELEMENT_SHORTCUTS: Record<string, ScriptElementType> = {
  '.': 'scene_heading',
  '!': 'action',
  '@': 'character',
  '~': 'lyrics',
  '>': 'transition',
  '=': 'synopsis',
  '#': 'section',
};

export const REVISION_COLOR_HEX: Record<RevisionColor, string> = {
  white: '#ffffff',
  blue: '#cce5ff',
  pink: '#f8d7da',
  yellow: '#fff3cd',
  green: '#d4edda',
  goldenrod: '#ffeeba',
  buff: '#f5e6cc',
  salmon: '#f5c6cb',
  cherry: '#f1aeb5',
  tan: '#d2b48c',
};

// Moderation & Support Types

import type { Profile, TicketCategory, TicketStatus, TicketPriority } from './base';

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  reported_content_type: string | null;
  reported_content_id: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  is_staff: boolean;
  created_at: string;
  profile?: Profile;
}

export interface ModAction {
  id: string;
  mod_user_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  ticket_id: string | null;
  created_at: string;
  profile?: Profile;
}

export const TICKET_CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: 'general', label: 'General Support' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'abuse', label: 'Report Abuse' },
  { value: 'content_report', label: 'Content Report' },
  { value: 'feature_request', label: 'Feature Request' },
];

export const GENRE_OPTIONS = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'Film Noir', 'History',
  'Horror', 'Musical', 'Mystery', 'Romance', 'Sci-Fi', 'Sport',
  'Thriller', 'War', 'Western',
];

// Location markers for the map
export type MarkerType = 'location' | 'bus_stop' | 'train_station' | 'parking' | 'base_camp' | 'custom';

export interface LocationMarker {
  id: string;
  project_id: string;
  location_id: string | null; // Deprecated, use location_ids
  location_ids: string[]; // Multiple locations per marker
  name: string;
  description: string | null;
  marker_type: MarkerType;
  lat: number;
  lng: number;
  color: string;
  icon: string | null;
  tags: string[];
  created_at: string;
}

export type RouteType = 'bus' | 'train' | 'walking' | 'driving' | 'custom';

export interface LocationRoute {
  id: string;
  project_id: string;
  name: string;
  route_type: RouteType;
  color: string;
  coordinates: { lat: number; lng: number }[];
  notes: string | null;
  created_at: string;
}

export const FORMAT_OPTIONS = [
  { value: 'feature', label: 'Feature Film' },
  { value: 'short', label: 'Short Film' },
  { value: 'series', label: 'TV Series' },
  { value: 'pilot', label: 'TV Pilot' },
  { value: 'webseries', label: 'Web Series' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'music_video', label: 'Music Video' },
];

export const SCRIPT_TYPE_OPTIONS: { value: ScriptType; label: string; description: string; icon: string }[] = [
  { value: 'screenplay', label: 'Screenplay', description: 'Standard film/TV screenplay format', icon: 'film' },
  { value: 'stageplay', label: 'Stage Play', description: 'Theatre script formatting', icon: 'theater' },
  { value: 'episodic', label: 'Episodic Series', description: 'Multi-episode TV/web series', icon: 'tv' },
  { value: 'sketch', label: 'Sketch / Short', description: 'Comedy sketches and short-form content', icon: 'scissors' },
  { value: 'comic', label: 'Comic / Graphic Novel', description: 'Panel-based visual storytelling', icon: 'book' },
  { value: 'podcast', label: 'Podcast & Audio Drama', description: 'Scripted radio plays, audio dramas & podcasts — BBC, US Radio, STARC formats', icon: 'headphones' },
  { value: 'youtube', label: 'YouTube Video', description: 'Long-form video content with hooks & CTAs', icon: 'play' },
  { value: 'tiktok', label: 'TikTok / Reels / Shorts', description: 'Short-form vertical video content', icon: 'phone' },
];

// Audio-drama-specific format options shown in step 1 when podcast/audio drama type is selected
export const AUDIO_DRAMA_FORMAT_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'bbc_radio',      label: 'BBC Scene Format',  description: 'British radio drama — scene headings, stage directions, character cues' },
  { value: 'us_radio',       label: 'US Radio Format',   description: 'American radio drama — acts, announcer lines, sound cue sheets' },
  { value: 'starc_standard', label: 'STARC Standard',    description: 'Full STARC format — inline SFX: / MUSIC: / AMBIENCE: cue lines' },
  { value: 'podcast_simple', label: 'Simple Podcast',    description: 'Basic script or outline for talk-show / interview / solo podcast' },
];

export const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string; description: string; icon: string }[] = [
  { value: 'film', label: 'Film / TV', description: 'Traditional film, TV, or web series production', icon: 'film' },
  { value: 'youtube', label: 'YouTube', description: 'Long-form YouTube videos and series', icon: 'play' },
  { value: 'tiktok', label: 'TikTok / Shorts', description: 'Short-form vertical video content', icon: 'phone' },
  { value: 'podcast', label: 'Podcast', description: 'Audio podcasts and video podcasts', icon: 'mic' },
  { value: 'documentary', label: 'Documentary', description: 'Documentary films and series', icon: 'camera' },
  { value: 'educational', label: 'Course / Tutorial', description: 'Educational content and online courses', icon: 'book' },
  { value: 'livestream', label: 'Livestream', description: 'Live streaming content planning', icon: 'radio' },
  { value: 'tv_production', label: 'TV Production', description: 'Professional broadcast & studio production', icon: 'broadcast' },
  { value: 'stage_play',    label: 'Stage Play',    description: 'Theatre productions, musicals and stage shows', icon: 'theater' },
];

// Content Creator Types

import type { SponsorSegmentType, ContentHookType, BrollStatus, VideoVisibility } from './base';

export interface Thumbnail {
  id: string;
  project_id: string;
  title: string;
  image_url: string | null;
  is_primary: boolean;
  text_overlay: string | null;
  font_style: string | null;
  color_scheme: string[];
  notes: string | null;
  a_b_test_group: string | null;
  click_rate: number | null;
  impressions: number;
  clicks: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SponsorSegment {
  id: string;
  project_id: string;
  sponsor_name: string;
  segment_type: SponsorSegmentType;
  start_time: number | null;
  end_time: number | null;
  script_text: string | null;
  talking_points: string[];
  cta_link: string | null;
  promo_code: string | null;
  payment_amount: number | null;
  payment_status: 'pending' | 'invoiced' | 'paid';
  due_date: string | null;
  notes: string | null;
  is_disclosed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VideoChapter {
  id: string;
  project_id: string;
  title: string;
  timestamp: number;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VideoSEO {
  id: string;
  project_id: string;
  video_title: string | null;
  video_description: string | null;
  tags: string[];
  category: string | null;
  default_language: string;
  target_keywords: string[];
  hashtags: string[];
  end_screen_elements: { type: string; position: string; video_id?: string }[];
  cards: { timestamp: number; type: string; video_id?: string; url?: string }[];
  publish_date: string | null;
  visibility: VideoVisibility;
  made_for_kids: boolean;
  age_restricted: boolean;
  created_at: string;
  updated_at: string;
}

export interface UploadChecklistItem {
  id: string;
  project_id: string;
  item_text: string;
  is_completed: boolean;
  category: 'general' | 'video' | 'audio' | 'seo' | 'legal' | 'promotion';
  is_default: boolean;
  sort_order: number;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrollItem {
  id: string;
  project_id: string;
  scene_id: string | null;
  description: string;
  source: 'film' | 'stock' | 'archive' | 'screen_recording' | 'animation' | null;
  source_url: string | null;
  duration_seconds: number | null;
  timestamp_start: number | null;
  timestamp_end: number | null;
  status: BrollStatus;
  notes: string | null;
  tags: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContentHook {
  id: string;
  project_id: string;
  hook_type: ContentHookType;
  content: string;
  duration_seconds: number | null;
  timestamp: number | null;
  notes: string | null;
  is_template: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Default upload checklist items for content creators
export const DEFAULT_UPLOAD_CHECKLIST: { text: string; category: string }[] = [
  { text: 'Video exported in correct resolution', category: 'video' },
  { text: 'Audio levels normalized', category: 'audio' },
  { text: 'Background music licensed', category: 'legal' },
  { text: 'Sponsor disclosure added', category: 'legal' },
  { text: 'Title optimized for search', category: 'seo' },
  { text: 'Description written with links', category: 'seo' },
  { text: 'Tags added', category: 'seo' },
  { text: 'Thumbnail uploaded', category: 'general' },
  { text: 'End screen added', category: 'video' },
  { text: 'Cards placed at key moments', category: 'video' },
  { text: 'Chapters/timestamps created', category: 'seo' },
  { text: 'Captions/subtitles uploaded', category: 'video' },
  { text: 'Schedule publish time set', category: 'general' },
  { text: 'Community post ready', category: 'promotion' },
  { text: 'Social media posts scheduled', category: 'promotion' },
];
