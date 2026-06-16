import type { Profile, ScriptElement, SceneLocationType, SceneTime, IdeaCategory, IdeaStatus, BudgetCategory, CommentType, ScheduleEventType, ShotType, ShotMovement, RevisionColor } from './base';

// Development Tools Types

export type SceneStatus = 'first_draft' | 'revised' | 'locked' | 'cut';
export type NotesRoundStatus = 'open' | 'in_progress' | 'closed';
export type NoteCategory = 'story' | 'character' | 'dialogue' | 'structure' | 'format' | 'general';
export type NoteStatus = 'open' | 'addressed' | 'deferred' | 'rejected';

export interface ScriptNotesRound {
  id: string;
  project_id: string;
  script_id: string | null;
  title: string;
  status: NotesRoundStatus;
  round_number: number;
  notes_from: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  notes?: ScriptNote[];
}

export interface ScriptNote {
  id: string;
  round_id: string;
  project_id: string;
  category: NoteCategory;
  content: string;
  scene_ref: string | null;
  page_ref: string | null;
  status: NoteStatus;
  assigned_to: string | null;
  created_by: string | null;
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
  /**
   * Narrative role/importance. One of:
   * 'protagonist' | 'antagonist' | 'main' | 'supporting' | 'minor' | 'ensemble'
   * null = not set (falls back to is_main for legacy records)
   */
  role: string | null;
  first_appearance: string | null;
  cast_actor: string | null;
  cast_notes: string | null;
  /** FK to cast_members.id — when set, that record's photo_url is used as the avatar. */
  cast_member_id: string | null;
  /** Link to a photo showing how the character should look (actor ref / design ref). */
  actor_photo_url: string | null;
  /** Inspiration board: images capturing the character's vibe. [{url, caption}] */
  inspo_images: Array<{ url: string; caption: string }>;
  /** Versioned production reference folders for makeup, costume, etc.
   *  [{id, name, type:'makeup'|'costume'|'other', images:[{url,caption}]}] */
  reference_folders: Array<{
    id: string;
    name: string;
    type: 'makeup' | 'costume' | 'other';
    images: Array<{ url: string; caption: string }>;
  }>;
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
  script_element_id: string | null;
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
  is_income: boolean;
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
