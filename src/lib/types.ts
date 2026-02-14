// ============================================================
// Screenplay Studio - TypeScript Types
// ============================================================

export type UserRole = 'owner' | 'admin' | 'writer' | 'editor' | 'viewer';
export type ProjectStatus = 'development' | 'pre_production' | 'production' | 'post_production' | 'completed' | 'archived';
export type ScriptElementType =
  | 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical'
  | 'transition' | 'shot' | 'note' | 'page_break' | 'title_page'
  | 'centered' | 'lyrics' | 'synopsis' | 'section';
export type SceneTime = 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'MORNING' | 'AFTERNOON' | 'EVENING' | 'CONTINUOUS' | 'LATER' | 'MOMENTS_LATER';
export type SceneLocationType = 'INT' | 'EXT' | 'INT_EXT' | 'EXT_INT';
export type RevisionColor = 'white' | 'blue' | 'pink' | 'yellow' | 'green' | 'goldenrod' | 'buff' | 'salmon' | 'cherry' | 'tan';
export type IdeaStatus = 'spark' | 'developing' | 'ready' | 'used' | 'discarded';
export type IdeaCategory = 'plot' | 'character' | 'dialogue' | 'visual' | 'sound' | 'location' | 'prop' | 'costume' | 'effect' | 'theme' | 'other';
export type ScheduleEventType = 'shooting' | 'rehearsal' | 'location_scout' | 'meeting' | 'setup' | 'wrap' | 'travel' | 'break' | 'other';
export type ShotType =
  | 'wide' | 'full' | 'medium_wide' | 'medium' | 'medium_close' | 'close_up'
  | 'extreme_close' | 'over_shoulder' | 'two_shot' | 'pov' | 'aerial'
  | 'insert' | 'cutaway' | 'establishing' | 'tracking' | 'dolly'
  | 'crane' | 'steadicam' | 'handheld' | 'static' | 'dutch_angle';
export type ShotMovement =
  | 'static' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down'
  | 'dolly_in' | 'dolly_out' | 'truck_left' | 'truck_right'
  | 'crane_up' | 'crane_down' | 'zoom_in' | 'zoom_out'
  | 'follow' | 'orbit' | 'whip_pan' | 'rack_focus';
export type BudgetCategory =
  | 'above_the_line' | 'below_the_line' | 'production' | 'post_production'
  | 'talent' | 'locations' | 'equipment' | 'props_costumes' | 'catering'
  | 'transportation' | 'insurance' | 'marketing' | 'contingency' | 'other';
export type CommentType = 'note' | 'suggestion' | 'issue' | 'resolved';

// ============================================================
// Database Row Types
// ============================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string;
  logline: string | null;
  synopsis: string | null;
  genre: string[];
  format: string;
  target_length_minutes: number | null;
  status: ProjectStatus;
  poster_url: string | null;
  cover_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: UserRole;
  department: string | null;
  job_title: string | null;
  invited_by: string | null;
  joined_at: string;
  profile?: Profile;
}

export interface Script {
  id: string;
  project_id: string;
  title: string;
  version: number;
  revision_color: RevisionColor;
  is_active: boolean;
  locked: boolean;
  locked_by: string | null;
  title_page_data: TitlePageData;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TitlePageData {
  title?: string;
  credit?: string;
  author?: string;
  source?: string;
  draft_date?: string;
  contact?: string;
  copyright?: string;
  notes?: string;
}

export interface ScriptElement {
  id: string;
  script_id: string;
  element_type: ScriptElementType;
  content: string;
  sort_order: number;
  scene_number: string | null;
  revision_color: RevisionColor;
  is_revised: boolean;
  is_omitted: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: string;
  project_id: string;
  name: string;
  full_name: string | null;
  age: string | null;
  gender: string | null;
  description: string | null;
  backstory: string | null;
  motivation: string | null;
  arc: string | null;
  relationships: CharacterRelationship[];
  appearance: string | null;
  personality_traits: string[];
  quirks: string | null;
  voice_notes: string | null;
  avatar_url: string | null;
  color: string;
  is_main: boolean;
  first_appearance: string | null;
  cast_actor: string | null;
  cast_notes: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharacterRelationship {
  character_id: string;
  relationship: string;
  description?: string;
}

export interface Location {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  address: string | null;
  gps_coordinates: { x: number; y: number } | null;
  location_type: SceneLocationType;
  photos: string[];
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  availability_notes: string | null;
  permits_required: boolean;
  permit_notes: string | null;
  parking_info: string | null;
  power_available: boolean;
  sound_notes: string | null;
  lighting_notes: string | null;
  cost_per_day: number | null;
  is_confirmed: boolean;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  script_id: string | null;
  scene_number: string | null;
  scene_heading: string | null;
  location_type: SceneLocationType;
  location_name: string | null;
  time_of_day: SceneTime;
  synopsis: string | null;
  page_count: number;
  estimated_duration_minutes: number | null;
  shooting_duration_minutes: number | null;
  location_id: string | null;
  cast_ids: string[];
  extras_count: number;
  props: string[];
  costumes: string[];
  makeup_notes: string | null;
  special_effects: string[];
  stunts: string | null;
  vehicles: string[];
  animals: string[];
  sound_notes: string | null;
  music_cues: string[];
  vfx_notes: string | null;
  mood: string | null;
  weather_required: string | null;
  special_equipment: string[];
  notes: string | null;
  is_completed: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  location?: Location;
}

export interface Shot {
  id: string;
  project_id: string;
  scene_id: string | null;
  shot_number: string | null;
  shot_type: ShotType;
  shot_movement: ShotMovement;
  lens: string | null;
  description: string | null;
  dialogue_ref: string | null;
  duration_seconds: number | null;
  camera_notes: string | null;
  lighting_notes: string | null;
  sound_notes: string | null;
  vfx_required: boolean;
  vfx_notes: string | null;
  storyboard_url: string | null;
  reference_urls: string[];
  is_completed: boolean;
  takes_needed: number;
  takes_completed: number;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleEvent {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  event_type: ScheduleEventType;
  start_time: string;
  end_time: string;
  all_day: boolean;
  scene_ids: string[];
  location_id: string | null;
  assigned_to: string[];
  call_time: string | null;
  wrap_time: string | null;
  notes: string | null;
  color: string;
  is_confirmed: boolean;
  weather_backup_plan: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Idea {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  category: IdeaCategory;
  status: IdeaStatus;
  priority: number;
  tags: string[];
  references: string[];
  attachments: string[];
  color: string;
  column_order: number;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface BudgetItem {
  id: string;
  project_id: string;
  category: BudgetCategory;
  subcategory: string | null;
  description: string;
  estimated_amount: number;
  actual_amount: number;
  quantity: number;
  unit_cost: number | null;
  vendor: string | null;
  invoice_ref: string | null;
  is_paid: boolean;
  due_date: string | null;
  notes: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  parent_id: string | null;
  content: string;
  comment_type: CommentType;
  is_resolved: boolean;
  resolved_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  replies?: Comment[];
}

export interface Revision {
  id: string;
  script_id: string;
  version: number;
  revision_color: RevisionColor;
  notes: string | null;
  snapshot: ScriptElement[] | null;
  created_by: string;
  created_at: string;
  profile?: Profile;
}

export interface UserPresence {
  id: string;
  user_id: string;
  project_id: string;
  current_page: string | null;
  current_element_id: string | null;
  cursor_position: number | null;
  is_online: boolean;
  last_seen: string;
  profile?: Profile;
}

// ============================================================
// UI Types
// ============================================================

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

export interface ProjectWithMembers extends Project {
  members: ProjectMember[];
  scripts?: Script[];
}

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

export const GENRE_OPTIONS = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'Film Noir', 'History',
  'Horror', 'Musical', 'Mystery', 'Romance', 'Sci-Fi', 'Sport',
  'Thriller', 'War', 'Western',
];

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
