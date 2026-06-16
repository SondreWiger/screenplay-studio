// Screenplay Studio - TypeScript Types

export type UserRole = 'owner' | 'admin' | 'writer' | 'editor' | 'viewer';
export type ProjectStatus = 'development' | 'pre_production' | 'production' | 'post_production' | 'completed' | 'archived';
export type ScriptElementType =
  | 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical'
  | 'transition' | 'shot' | 'note' | 'page_break' | 'title_page'
  | 'centered' | 'lyrics' | 'synopsis' | 'section'
  // Act heading — used in Screenplays and Stage Plays
  | 'act'
  // Sequence — structural block with optional colour, shown in minimap
  | 'sequence' | 'sequence_end'
  // YouTube/Content Creator elements
  | 'hook' | 'talking_point' | 'broll_note' | 'cta' | 'sponsor_read' | 'chapter_marker'
  // Audio Drama elements (BBC Scene, US Radio, STARC Standard)
  | 'sfx_cue' | 'music_cue' | 'ambience_cue' | 'act_break' | 'announcer' | 'sound_cue'
  // Musical Theatre / Stage Play elements
  | 'song_title' | 'lyric' | 'dance_direction' | 'musical_cue' | 'lighting_cue' | 'set_direction'
  // Comic / Graphic Novel elements
  | 'comic_page' | 'comic_panel' | 'comic_panel_description' | 'comic_dialogue' | 'comic_sfx' | 'comic_caption';
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

// Database Row Types

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
  show_accountability?: boolean;
  preferred_script_type: ScriptType;
  theme_preference: string;
  company_id: string | null;
  is_pro: boolean;
  is_studio: boolean;
  studio_since: string | null;
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
  // Accountability & Work Tracking
  activity_color?: string | null;
  show_activity_grid?: 'private' | 'buddies' | 'public' | null;
  daily_goal_pages?: number | null;
  daily_goal_minutes?: number | null;
  // Moderation
  moderation_flags?: number;
  moderation_status?: string;
  moderation_notes?: string | null;
  last_flagged_at?: string | null;
}

// Work Tracking

export interface WorkLog {
  id: string;
  user_id: string;
  project_id: string | null;
  log_date: string; // ISO date string e.g. "2025-01-15"
  pages_written: number;
  scenes_created: number;
  words_written: number;
  session_minutes: number;
  manual_note: string | null;
  is_manual: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkLogInput {
  projectId?: string;
  pagesWritten?: number;
  scenesCreated?: number;
  wordsWritten?: number;
  sessionMinutes?: number;
  manualNote?: string;
  isManual?: boolean;
}

// Accountability Buddies

export interface AccountabilityBuddy {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  message: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  requester?: Pick<Profile, 'id' | 'display_name' | 'username' | 'avatar_url' | 'activity_color' | 'daily_goal_pages'>;
  addressee?: Pick<Profile, 'id' | 'display_name' | 'username' | 'avatar_url' | 'activity_color' | 'daily_goal_pages'>;
}

// Accountability Groups

export interface AccountabilityGroup {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  invite_code: string;
  is_public: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  member_count?: number;
  my_role?: 'owner' | 'admin' | 'member';
}

export interface AccountabilityGroupMember {
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profile?: Pick<Profile, 'id' | 'display_name' | 'username' | 'avatar_url' | 'activity_color' | 'daily_goal_pages'>;
}

export interface AccountabilityFeedPost {
  id: string;
  author_id: string;
  group_id: string | null;
  buddy_pair: string | null;
  work_log_id: string | null;
  content: string;
  post_type: 'message' | 'checkin' | 'nudge' | 'milestone';
  created_at: string;
  author?: Pick<Profile, 'id' | 'display_name' | 'username' | 'avatar_url'>;
}

// Gamification

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
  | 'quiz_perfect_score'
  | 'poll_complete';

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

// Pro Subscription Types
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

export interface ProjectShareLink {
  id: string;
  project_id: string;
  created_by: string;
  name: string;
  token: string;
  can_view_script: boolean;
  can_view_characters: boolean;
  can_view_scenes: boolean;
  can_view_schedule: boolean;
  can_view_documents: boolean;
  can_view_notes: boolean;
  can_edit_notes: boolean;
  is_invite: boolean;
  invite_role: 'viewer' | 'commenter' | 'editor';
  view_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
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
    max_export_formats: ['pdf', 'fdx', 'json', 'html', 'docx', 'fountain'],
    version_history: true,
    external_shares: true,
    client_review: true,
    analytics_dashboard: true,
    custom_branding: true,
    priority_support: false,
    api_access: false,
    advanced_scheduling: true,
    watermarked_exports: true,
    bulk_export: true,
    advanced_exports: true,
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
  studio: {
    storage_bytes: Infinity,                       // Unlimited
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
  studio_monthly: { amount: 50, currency: 'USD', per_month: 50 },
  studio_yearly: { amount: 480, currency: 'USD', per_month: 40 },
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
  page_size?: 'letter' | 'a4' | null;
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
  /**
   * Flexible per-script JSONB config. Known keys:
   *   version_config   – versioning snapshot data
   *   sort_order       – integer position in the episodes list
   *   episode_season   – season number this episode belongs to (number)
   *   episode_color    – hex accent colour for this episode, e.g. '#7c3aed'
   */
  metadata?: Record<string, unknown>;
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
  /** URL to the project / script logo (shown top-center on the title page) */
  project_logo_url?: string;
  /** Name of the production company (shown bottom-left) */
  company_name?: string;
  /** URL to the production company logo (shown bottom-left) */
  company_logo_url?: string;
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
