// ============================================================
// Screenplay Studio - TypeScript Types
// ============================================================

export type UserRole = 'owner' | 'admin' | 'writer' | 'editor' | 'viewer';
export type ProjectStatus = 'development' | 'pre_production' | 'production' | 'post_production' | 'completed' | 'archived';
export type ScriptElementType =
  | 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical'
  | 'transition' | 'shot' | 'note' | 'page_break' | 'title_page'
  | 'centered' | 'lyrics' | 'synopsis' | 'section'
  // Act heading — used in Screenplays and Stage Plays
  | 'act'
  // YouTube/Content Creator elements
  | 'hook' | 'talking_point' | 'broll_note' | 'cta' | 'sponsor_read' | 'chapter_marker'
  // Audio Drama elements (BBC Scene, US Radio, STARC Standard)
  | 'sfx_cue' | 'music_cue' | 'ambience_cue' | 'act_break' | 'announcer' | 'sound_cue'
  // Musical Theatre / Stage Play elements
  | 'song_title' | 'lyric' | 'dance_direction' | 'musical_cue' | 'lighting_cue' | 'set_direction';
export type SceneTime = string; // Accepts any time-of-day value from scripts (DAY, NIGHT, MAGIC HOUR, etc.)
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
export type BlogPostStatus = 'draft' | 'published' | 'archived';
export type CommunityPostStatus = 'draft' | 'published' | 'archived';
export type ChallengeType = 'weekly' | 'custom';
export type ChallengePhase = 'upcoming' | 'submissions' | 'voting' | 'reveal_pending' | 'completed';
export type ChallengeDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type ProductionStatus = 'pending' | 'approved' | 'rejected';
export type UsageIntent = 'writer' | 'producer' | 'both' | 'student' | 'content_creator';
export type ScriptType = 'screenplay' | 'stageplay' | 'episodic' | 'sketch' | 'comic' | 'podcast' | 'audio_drama' | 'youtube' | 'tiktok';
export type ProjectType = 'film' | 'youtube' | 'tiktok' | 'podcast' | 'audio_drama' | 'documentary' | 'educational' | 'livestream' | 'tv_production' | 'stage_play';
export type SponsorSegmentType = 'pre_roll' | 'mid_roll' | 'post_roll' | 'integration';
export type ContentHookType = 'opening_hook' | 'intro' | 'cta' | 'outro' | 'transition';
export type BrollStatus = 'needed' | 'found' | 'filmed' | 'edited';
export type VideoVisibility = 'public' | 'unlisted' | 'private' | 'scheduled';
export type CompanyRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
export type CompanyPlan = 'free' | 'pro' | 'enterprise';
export type SystemRole = 'writer' | 'moderator' | 'admin';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'general' | 'bug' | 'abuse' | 'content_report' | 'feature_request';

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'no', label: 'Norwegian' },
  { value: 'sv', label: 'Swedish' },
  { value: 'da', label: 'Danish' },
  { value: 'fi', label: 'Finnish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ar', label: 'Arabic' },
  { value: 'other', label: 'Other' },
];

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
  role: SystemRole;
  // Onboarding & preferences
  onboarding_completed: boolean;
  usage_intent: UsageIntent;
  show_community: boolean;
  show_production_tools: boolean;
  show_collaboration: boolean;
  preferred_script_type: ScriptType;
  theme_preference: string;
  company_id: string | null;
  is_pro: boolean;
  pro_since: string | null;
  created_at: string;
  updated_at: string;
  // Profile customisation
  username: string | null;
  headline: string | null;
  location: string | null;
  website: string | null;
  banner_url: string | null;
  social_links: Record<string, string>;
  featured_project_ids: string[];
  profile_theme: string;
  show_email: boolean;
  show_projects: boolean;
  show_activity: boolean;
  allow_dms: boolean;
  profile_views: number;
  // Client customisation
  accent_color?: string | null;
  sidebar_tabs?: Record<string, boolean> | null;
  // Storage
  storage_used_bytes?: number;
  storage_limit_bytes?: number;
  // Insider program
  insider_tier?: 'alpha' | 'beta' | null;
  // Badge display slots
  selected_badge_id?: string | null;
  selected_badge2_id?: string | null;
}

// ── Gamification ─────────────────────────────────────────────

export type XPEventType =
  | 'words_written'
  | 'community_post'
  | 'community_comment'
  | 'community_like_received'
  | 'community_challenge_submit'
  | 'project_created'
  | 'daily_login'
  | 'login_streak_bonus'
  | 'profile_complete'
  | 'lesson_complete'
  | 'course_complete'
  | 'quiz_perfect_score';

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  is_system: boolean;
  system_role: 'admin' | 'moderator' | 'contributor' | null;
  created_by: string | null;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_by: string | null;
  awarded_at: string;
  display_slot: 1 | 2 | null;
  // Joined
  badge?: Badge;
}

export interface UserGamification {
  user_id: string;
  xp_total: number;
  level: number;
  gamification_enabled: boolean | null;
  popup_shown: boolean;
  last_login_date: string | null;
  login_streak: number;
  session_started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface XPEvent {
  id: string;
  user_id: string;
  event_type: XPEventType;
  xp_base: number;
  multiplier: number;
  xp_awarded: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Pro Subscription Types ──────────────────────────────────
export type SubscriptionPlan = 'pro' | 'project_pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trialing';
export type BillingCycle = 'yearly' | 'monthly' | 'one_time';

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  price_cents: number;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  paypal_customer_id: string | null;
  paypal_subscription_id: string | null;
  payment_method: string;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
  updated_at: string;
}

export interface TeamLicense {
  id: string;
  purchaser_id: string;
  company_id: string | null;
  recipient_id: string | null;
  recipient_email: string | null;
  status: 'pending' | 'active' | 'revoked' | 'expired';
  plan: SubscriptionPlan;
  price_cents: number;
  subscription_id: string | null;
  redeemed_at: string | null;
  expires_at: string;
  created_at: string;
  // Joined fields
  recipient?: Profile;
  purchaser?: Profile;
}

export interface ScriptVersion {
  id: string;
  script_id: string;
  project_id: string;
  user_id: string;
  version_number: number;
  title: string | null;
  content: ScriptElement[] | null;
  word_count: number;
  page_count: number;
  change_summary: string | null;
  is_auto_save: boolean;
  created_at: string;
  // Joined
  user?: Profile;
}

export interface ExternalShare {
  id: string;
  project_id: string;
  created_by: string;
  share_type: 'script' | 'storyboard' | 'moodboard' | 'full';
  access_token: string;
  title: string | null;
  password_hash: string | null;
  allow_comments: boolean;
  allow_download: boolean;
  watermark_text: string | null;
  expires_at: string | null;
  max_views: number | null;
  view_count: number;
  is_active: boolean;
  branding: { logo_url?: string; company_name?: string; color?: string; license?: string };
  content_snapshot: {
    project?: { title?: string; logline?: string; genre?: string[]; format?: string; cover_url?: string };
    scripts?: { title?: string; content?: ScriptElement[] | null; updated_at?: string }[];
  } | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewSession {
  id: string;
  share_id: string;
  project_id: string;
  reviewer_name: string;
  reviewer_email: string | null;
  reviewer_token: string;
  status: 'pending' | 'in_progress' | 'submitted';
  overall_rating: number | null;
  overall_notes: string | null;
  created_at: string;
  submitted_at: string | null;
  annotations?: ReviewAnnotation[];
}

export interface ReviewAnnotation {
  id: string;
  session_id: string;
  element_type: string | null;
  element_index: number | null;
  content: string;
  annotation_type: 'note' | 'approval' | 'revision_request' | 'question';
  resolved: boolean;
  created_at: string;
}

export interface ProjectAnalyticsEvent {
  id: string;
  project_id: string;
  user_id: string | null;
  event_type: string;
  event_data: Record<string, string | number | boolean | null>;
  page: string | null;
  word_count_delta: number;
  created_at: string;
}

// Pro feature limits
export const PRO_LIMITS = {
  free: {
    storage_bytes: 50 * 1024 * 1024 * 1024,       // 50 GB — generous free tier
    max_team_size: Infinity,                       // No limits — DaVinci model
    max_projects: Infinity,                        // No limits — DaVinci model
    max_export_formats: ['pdf', 'fdx', 'json'],
    version_history: false,
    external_shares: false,
    client_review: false,
    analytics_dashboard: false,
    custom_branding: false,
    priority_support: false,
    api_access: false,
    advanced_scheduling: false,
    watermarked_exports: false,
    bulk_export: false,
    advanced_exports: false,
  },
  pro: {
    storage_bytes: 200 * 1024 * 1024 * 1024,      // 200 GB
    max_team_size: Infinity,
    max_projects: Infinity,
    max_export_formats: ['pdf', 'fdx', 'json', 'html', 'docx', 'fountain'],
    version_history: true,
    external_shares: true,
    client_review: true,
    analytics_dashboard: true,
    custom_branding: true,
    priority_support: true,
    api_access: true,
    advanced_scheduling: true,
    watermarked_exports: true,
    bulk_export: true,
    advanced_exports: true,
  },
} as const;

export const PRO_PRICING = {
  yearly: { amount: 200, currency: 'USD', per_month: 16.67 },
  team_yearly: { amount: 160, currency: 'USD', per_month: 13.33, discount: 20 },
  project_lifetime: { amount: 100, currency: 'USD' },
} as const;

export interface Project {
  id: string;
  title: string;
  logline: string | null;
  synopsis: string | null;
  genre: string[];
  format: string;
  script_type: ScriptType;
  project_type: ProjectType;
  content_metadata: Record<string, string | number | boolean | null>;
  target_length_minutes: number | null;
  status: ProjectStatus;
  poster_url: string | null;
  cover_url: string | null;
  episode_count: number | null;
  season_number: number | null;
  company_id: string | null;
  wrap_url: string | null;
  is_showcased: boolean;
  showcase_description: string | null;
  showcase_script: boolean;
  showcase_mindmap: boolean;
  showcase_moodboard: boolean;
  set_photos: string[];
  external_links: Record<string, string>;
  language: string | null;
  production_trivia: { title: string; content: string }[];
  created_by: string;
  created_at: string;
  updated_at: string;
  accent_color?: string | null;
  sidebar_tabs?: Record<string, boolean> | null;
  custom_branding?: {
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string;
    company_name?: string;
    watermark?: string;
    watermark_opacity?: number;
    cover_title?: string;
    cover_subtitle?: string;
    font_family?: string;
    header_template?: string;
    color?: string;
  } | null;
  pro_enabled?: boolean;
  max_team_size?: number;
  folder_id?: string | null;
  press_kit_enabled?: boolean;
  press_kit_password?: string | null;
  press_kit_tagline?: string | null;
  press_kit_contact?: string | null;
}

export type ProductionRole = 'director' | 'producer' | 'dp' | 'ad' | 'pa' | 'gaffer' | 'grip' | 'sound_mixer' | 'boom_op' | 'art_director' | 'wardrobe' | 'makeup' | 'editor' | 'vfx' | 'colorist' | 'composer' | 'actor' | 'extra' | 'script_supervisor' | 'stunt_coordinator' | 'location_manager' | 'craft_services' | 'other' | '';

export const PRODUCTION_ROLES: { value: ProductionRole; label: string }[] = [
  { value: 'director', label: 'Director' },
  { value: 'producer', label: 'Producer' },
  { value: 'dp', label: 'DP / Cinematographer' },
  { value: 'ad', label: '1st AD' },
  { value: 'pa', label: 'PA' },
  { value: 'gaffer', label: 'Gaffer' },
  { value: 'grip', label: 'Grip' },
  { value: 'sound_mixer', label: 'Sound Mixer' },
  { value: 'boom_op', label: 'Boom Operator' },
  { value: 'art_director', label: 'Art Director' },
  { value: 'wardrobe', label: 'Wardrobe' },
  { value: 'makeup', label: 'Makeup / Hair' },
  { value: 'editor', label: 'Editor' },
  { value: 'vfx', label: 'VFX Artist' },
  { value: 'colorist', label: 'Colorist' },
  { value: 'composer', label: 'Composer' },
  { value: 'actor', label: 'Actor / Talent' },
  { value: 'extra', label: 'Extra / Background' },
  { value: 'script_supervisor', label: 'Script Supervisor' },
  { value: 'stunt_coordinator', label: 'Stunt Coordinator' },
  { value: 'location_manager', label: 'Location Manager' },
  { value: 'craft_services', label: 'Craft Services' },
  { value: 'other', label: 'Other' },
];

export interface DocumentComment {
  id: string;
  document_id: string;
  project_id: string;
  author_id: string;
  content: string;
  char_offset: number | null;
  line_index: number | null;
  selected_text: string | null;
  is_resolved: boolean;
  mentions: string[];
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  // joined
  author?: { display_name?: string | null; avatar_url?: string | null; email?: string | null };
}

export interface ProjectMember {  id: string;
  project_id: string;
  user_id: string;
  role: UserRole;
  production_role: ProductionRole;
  character_name: string | null;
  department: string | null;
  job_title: string | null;
  invited_by: string | null;
  joined_at: string;
  profile?: Profile;
}

export interface ExternalCredit {
  id: string;
  project_id: string;
  name: string;
  production_role: string;
  character_name: string | null;
  external_url: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface ShowcaseComment {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  profile?: Profile;
}

export interface ShowcaseReview {
  id: string;
  project_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
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
  scene_status: 'first_draft' | 'revised' | 'locked' | 'cut' | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Development Tools Types
// ============================================================

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

// ============================================================
// Blog Types
// ============================================================

export interface BlogPostSection {
  heading: string;
  body: string;
  order: number;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  sections: BlogPostSection[];
  tags: string[];
  status: BlogPostStatus;
  published_at: string | null;
  author_id: string | null;
  allow_comments: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface BlogComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string | null;
  content: string;
  is_pinned: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  author?: Profile;
  replies?: BlogComment[];
}

// ============================================================
// Community Types
// ============================================================

export interface CommunityCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
}

export interface CommunityPost {
  id: string;
  slug: string;
  author_id: string;
  title: string;
  description: string | null;
  script_content: string | null;
  project_id: string | null;
  cover_image_url: string | null;
  allow_comments: boolean;
  allow_suggestions: boolean;
  allow_edits: boolean;
  allow_distros: boolean;
  allow_free_use: boolean;
  copyright_disclaimer_accepted: boolean;
  status: CommunityPostStatus;
  view_count: number;
  upvote_count: number;
  comment_count: number;
  distro_count: number;
  language: string | null;
  /** Public URL of an uploaded source file (PDF, FDX, Fountain, TXT). */
  attached_file_url: string | null;
  /** Extension / format of the attached file: 'pdf' | 'fdx' | 'fountain' | 'txt' */
  attached_file_type: string | null;
  created_at: string;
  updated_at: string;
  author?: Profile;
  categories?: CommunityCategory[];
}

export interface CommunityComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  comment_type: 'comment' | 'suggestion' | 'annotation';
  /** For annotations: element/paragraph index (as string). Null for regular comments. */
  line_ref: string | null;
  is_pinned: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  author?: Profile;
  replies?: CommunityComment[];
}

export interface CommunityDistro {
  id: string;
  original_post_id: string;
  author_id: string;
  title: string;
  description: string | null;
  script_content: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface ChallengeTheme {
  id: string;
  title: string;
  description: string;
  genre_hint: string | null;
  constraints: string | null;
  difficulty: ChallengeDifficulty;
  used_count: number;
  is_active: boolean;
  created_at: string;
}

export interface CommunityChallenge {
  id: string;
  title: string;
  description: string;
  theme_id: string | null;
  challenge_type: ChallengeType;
  starts_at: string;
  submissions_close_at: string;
  voting_close_at: string;
  reveal_at: string;
  prize_title: string | null;
  prize_description: string | null;
  prize_data: Record<string, unknown> | null;
  created_by: string | null;
  week_number: number | null;
  year: number | null;
  submission_count: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  theme?: ChallengeTheme;
}

export interface ChallengeSubmission {
  id: string;
  challenge_id: string;
  author_id: string;
  title: string;
  description: string | null;
  script_content: string | null;
  project_id: string | null;
  vote_count: number;
  placement: number | null;
  prize_awarded: boolean;
  submitted_at: string;
  author?: Profile;
  has_voted?: boolean;
}

export interface ScriptProduction {
  id: string;
  post_id: string;
  submitter_id: string;
  title: string;
  description: string | null;
  url: string | null;
  thumbnail_url: string | null;
  status: ProductionStatus;
  created_at: string;
  updated_at: string;
  submitter?: Profile;
  share_url?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

// ============================================================
// Chat Forum
// ============================================================

export interface ChatChannel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  is_default: boolean;
  is_locked: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  reply_to_id: string | null;
  is_pinned: boolean;
  is_deleted: boolean;
  edited_at: string | null;
  created_at: string;
  author?: Profile;
  reply_to?: ChatMessage;
}

// ============================================================
// Script Drafts
// ============================================================

export interface ScriptDraft {
  id: string;
  script_id: string;
  draft_number: number;
  draft_name: string | null;
  color: string;
  notes: string | null;
  snapshot: ScriptElement[] | null; // JSONB snapshot of elements
  element_count: number;
  page_count: number;
  word_count: number;
  is_current: boolean;
  created_by: string | null;
  created_at: string;
}

// ============================================================
// Company Types
// ============================================================

export interface Company {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  brand_color: string;
  tagline: string | null;
  public_page_enabled: boolean;
  show_team_on_public: boolean;
  show_projects_on_public: boolean;
  allow_script_reading: boolean;
  custom_domain: string | null;
  plan: CompanyPlan;
  max_members: number;
  max_projects: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  job_title: string | null;
  department: string | null;
  bio: string | null;
  is_public: boolean;
  invited_by: string | null;
  joined_at: string;
  profile?: Profile;
}

export interface CompanyTeam {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  can_create_projects: boolean;
  can_edit_scripts: boolean;
  can_manage_production: boolean;
  can_view_budget: boolean;
  can_manage_budget: boolean;
  can_invite_members: boolean;
  can_publish_community: boolean;
  can_manage_company: boolean;
  created_at: string;
  updated_at: string;
  members?: CompanyTeamMember[];
}

export interface CompanyTeamMember {
  team_id: string;
  member_id: string;
  role: string;
  joined_at: string;
  member?: CompanyMember;
}

export interface CompanyInvitation {
  id: string;
  company_id: string;
  email: string;
  role: CompanyRole;
  team_ids: string[];
  invited_by: string;
  token: string;
  accepted: boolean;
  expires_at: string;
  created_at: string;
}

export interface CompanyActivityLog {
  id: string;
  company_id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  profile?: Profile;
}

export type CompanyBlogPostStatus = 'draft' | 'published' | 'archived';

export interface CompanyBlogPost {
  id: string;
  company_id: string;
  author_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  tags: string[];
  status: CompanyBlogPostStatus;
  published_at: string | null;
  pinned: boolean;
  allow_comments: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface CompanyBlogComment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

// ============================================================
// Notification Types
// ============================================================

export type NotificationType =
  | 'community_comment'
  | 'community_reply'
  | 'community_upvote'
  | 'project_invitation'
  | 'project_comment'
  | 'company_invitation'
  | 'company_blog_comment'
  | 'task_assigned'
  | 'schedule_created'
  | 'schedule_reminder'
  | 'production_submitted'
  | 'production_approved'
  | 'production_rejected'
  | 'chat_mention'
  | 'direct_message'
  | 'ticket_reply'
  | 'general';

// ============================================================
// Mind Map Types
// ============================================================

export type MindMapNodeShape = 'rounded' | 'circle' | 'diamond' | 'rectangle';
export type MindMapEdgeStyle = 'solid' | 'dashed' | 'dotted';
export type MindMapArrowType = 'none' | 'forward' | 'backward' | 'both';
export type MindMapNodeType = 'character' | 'group' | 'note';

export interface MindMapNode {
  id: string;
  project_id: string;
  character_id: string | null;
  label: string;
  node_type: MindMapNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  shape: MindMapNodeShape;
  font_size: number;
  image_url: string | null;
  notes: string | null;
  group_id: string | null;
  is_locked: boolean;
  z_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  character?: Character;
}

export interface MindMapEdge {
  id: string;
  project_id: string;
  source_node_id: string;
  target_node_id: string;
  label: string | null;
  color: string;
  line_style: MindMapEdgeStyle;
  thickness: number;
  arrow_type: MindMapArrowType;
  animated: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Direct Message Types
// ============================================================

export type ConversationType = 'direct' | 'group';
export type MessageType = 'text' | 'image' | 'file' | 'system';

export interface Conversation {
  id: string;
  conversation_type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  members?: ConversationMember[];
  last_message?: DirectMessage;
  unread_count?: number;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  last_read_at: string;
  is_muted: boolean;
  joined_at: string;
  profile?: Profile;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  file_url: string | null;
  file_name: string | null;
  reply_to_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  edited_at: string | null;
  created_at: string;
  sender?: Profile;
  reply_to?: DirectMessage;
}

// ============================================================
// Project Channel Types
// ============================================================

export interface ProjectChannel {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'system' | 'image' | 'file';
  file_url: string | null;
  file_name: string | null;
  reply_to_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  edited_at: string | null;
  created_at: string;
  sender?: Profile;
}

// ============================================================
// Mood Board Types
// ============================================================

export type MoodBoardItemType = 'image' | 'text' | 'color' | 'link' | 'note';
export type MoodBoardSection = 'general' | 'characters' | 'locations' | 'atmosphere' | 'costumes' | 'props';

export interface MoodBoardItem {
  id: string;
  project_id: string;
  item_type: MoodBoardItemType;
  title: string | null;
  content: string | null;
  image_url: string | null;
  link_url: string | null;
  color: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  opacity: number;
  tags: string[];
  board_section: MoodBoardSection;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MoodBoardConnection {
  id: string;
  project_id: string;
  source_item_id: string;
  target_item_id: string;
  label: string | null;
  color: string;
  line_style: 'solid' | 'dashed' | 'dotted';
  created_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  acted_on: boolean;
  created_at: string;
  actor?: Profile;
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

// ============================================================
// Project Documents & Folders
// ============================================================

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

// ============================================================
// Moderation & Support Types
// ============================================================

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

// ============================================================
// Content Creator Types
// ============================================================

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

// ============================================================
// Stage Play / Theatre Production Types
// ============================================================

export type StageCueType = 'lighting' | 'sound' | 'music' | 'follow_spot' | 'special_effect' | 'automation' | 'video';
export type StageEnsembleGroup = 'Principal' | 'Ensemble' | 'Understudy' | 'Dance Captain' | 'Swing' | 'Alternate' | 'Other';
export type StageProductionDepartment = 'Direction' | 'Stage Management' | 'Lighting' | 'Sound' | 'Musical Direction' | 'Choreography' | 'Design' | 'Technical' | 'Marketing' | 'Other';

export interface StageCue {
  id: string;
  project_id: string;
  cue_type: StageCueType;
  cue_number: string;
  description: string | null;
  act_number: number | null;
  scene_ref: string | null;
  script_element_id: string | null;
  timing_note: string | null;
  duration_note: string | null;
  operator: string | null;
  notes: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StageEnsembleMember {
  id: string;
  project_id: string;
  actor_name: string;
  actor_user_id: string | null;
  character_name: string | null;
  ensemble_group: StageEnsembleGroup;
  vocal_range: string | null;
  dance_skills: string[] | null;
  availability: string | null;
  contact_email: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StageProductionTeamMember {
  id: string;
  project_id: string;
  user_id: string | null;
  name: string;
  role: string;
  department: StageProductionDepartment;
  contact_email: string | null;
  phone: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const STAGE_CUE_TYPE_CONFIG: Record<StageCueType, { label: string; color: string; abbrev: string }> = {
  lighting:       { label: 'Lighting',       color: '#f59e0b', abbrev: 'LX' },
  sound:          { label: 'Sound',          color: '#3b82f6', abbrev: 'SQ' },
  music:          { label: 'Music',          color: '#8b5cf6', abbrev: 'MQ' },
  follow_spot:    { label: 'Follow Spot',    color: '#ec4899', abbrev: 'FS' },
  special_effect: { label: 'Special FX',     color: '#ef4444', abbrev: 'FX' },
  automation:     { label: 'Automation',     color: '#14b8a6', abbrev: 'AQ' },
  video:          { label: 'Video',          color: '#6366f1', abbrev: 'VQ' },
};

export const STAGE_ENSEMBLE_GROUPS: StageEnsembleGroup[] = [
  'Principal', 'Ensemble', 'Understudy', 'Dance Captain', 'Swing', 'Alternate', 'Other',
];

export const STAGE_DEPARTMENTS: StageProductionDepartment[] = [
  'Direction', 'Stage Management', 'Lighting', 'Sound',
  'Musical Direction', 'Choreography', 'Design', 'Technical', 'Marketing', 'Other',
];

// ─────────────────────────────────────────────────────────────────────────────
// Shoot Days
// ─────────────────────────────────────────────────────────────────────────────
export type ShootDayStatus = 'planned' | 'confirmed' | 'completed' | 'cancelled';

export interface ShootDay {
  id: string;
  project_id: string;
  day_number: number;
  shoot_date: string | null;
  title: string | null;
  call_time: string | null;
  wrap_time: string | null;
  location: string | null;
  notes: string | null;
  status: ShootDayStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShootDayScene {
  id: string;
  shoot_day_id: string;
  project_id: string;
  scene_element_id: string | null;
  scene_heading: string;
  scene_number: string | null;
  script_id: string | null;
  estimated_pages: number | null;
  sort_order: number;
  notes: string | null;
}

export interface ShootDayCast {
  id: string;
  shoot_day_id: string;
  project_id: string;
  character_name: string;
  actor_name: string | null;
  call_time: string | null;
  on_set_time: string | null;
  makeup_call: string | null;
  notes: string | null;
  sort_order: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shoot Gear
// ─────────────────────────────────────────────────────────────────────────────
export type GearOwnership = 'owned' | 'rented' | 'provided' | 'tbc';
export type GearStatus = 'confirmed' | 'pending' | 'cancelled';
export type GearCategory =
  | 'Camera' | 'Lenses' | 'Lighting' | 'Grip' | 'Sound'
  | 'Art Dept' | 'Costume' | 'Hair & Makeup' | 'Locations'
  | 'Transport' | 'Post / DIT' | 'Other';

export const GEAR_CATEGORIES: GearCategory[] = [
  'Camera', 'Lenses', 'Lighting', 'Grip', 'Sound',
  'Art Dept', 'Costume', 'Hair & Makeup', 'Locations',
  'Transport', 'Post / DIT', 'Other',
];

export interface ShootGear {
  id: string;
  project_id: string;
  name: string;
  category: GearCategory;
  quantity: number;
  unit: string;
  ownership: GearOwnership;
  vendor: string | null;
  daily_rate: number | null;
  total_cost: number | null;
  shoot_day_id: string | null;
  notes: string | null;
  status: GearStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar Layout Customisation
// ─────────────────────────────────────────────────────────────────────────────
export interface SidebarNavItem {
  icon: string;
  label: string;        // overrideable display name
  hidden?: boolean;
}

export interface SidebarSection {
  id: string;           // stable key, e.g. "writing"
  label: string;        // overrideable section header
  collapsed?: boolean;
  items: SidebarNavItem[];
}

export interface SidebarLayout {
  sections: SidebarSection[];
  /** Timestamp of last save, used for conflict detection */
  savedAt?: string;
}

export interface SidebarLayoutRow {
  id: string;
  user_id: string | null;
  project_id: string | null;
  layout: SidebarLayout;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Community Courses
// ─────────────────────────────────────────────────────────────────────────────

export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type CourseType = 'system' | 'user';
export type CourseStatus = 'draft' | 'published' | 'archived';
export type LessonType = 'text' | 'video' | 'quiz' | 'script_editor' | 'arc_editor' | 'example';

export interface Course {
  id: string;
  title: string;
  description: string | null;
  short_desc: string | null;
  type: CourseType;
  creator_id: string | null;
  thumbnail_url: string | null;
  difficulty: CourseDifficulty;
  tags: string[];
  status: CourseStatus;
  xp_reward: number;
  estimated_minutes: number;
  enrollment_count: number;
  completion_count: number;
  rating_sum: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
  // joined
  creator?: Profile;
}

export interface CourseSection {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
  // joined
  lessons?: CourseLesson[];
}

// Lesson content types
export interface LessonContentText       { markdown: string }
export interface LessonContentVideo      { embed_url: string; provider: 'youtube' | 'vimeo' | 'direct'; duration_seconds?: number; caption?: string }
export interface QuizOption              { id: string; text: string; is_correct: boolean }
export interface QuizQuestion            { id: string; text: string; explanation?: string; options: QuizOption[] }
export interface LessonContentQuiz       { questions: QuizQuestion[] }
export interface LessonContentScriptEditor {
  instructions: string;
  initial_content: string;
  locked: boolean;
  expected_keywords?: string[];
  hint?: string;
}
export interface LessonContentArcEditor  { instructions: string; arc_data: Record<string, unknown> | null; locked: boolean }
export interface LessonContentExample    { content: string; language: string; annotations?: { line: number; note: string }[]; description?: string }

export type LessonContent =
  | LessonContentText
  | LessonContentVideo
  | LessonContentQuiz
  | LessonContentScriptEditor
  | LessonContentArcEditor
  | LessonContentExample;

export interface CourseLesson {
  id: string;
  course_id: string;
  section_id: string | null;
  title: string;
  order_index: number;
  lesson_type: LessonType;
  content: LessonContent;
  xp_reward: number;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  completed_at: string | null;
  last_accessed_at: string;
  progress_percent: number;
  rating: number | null;
}

export interface CourseLessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string;
  completed_at: string;
  score: number | null;
  attempts: number;
  answer_data: Record<string, string> | null;
}

