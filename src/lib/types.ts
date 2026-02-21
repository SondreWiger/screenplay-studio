// ============================================================
// Screenplay Studio - TypeScript Types
// ============================================================

export type UserRole = 'owner' | 'admin' | 'writer' | 'editor' | 'viewer';
export type ProjectStatus = 'development' | 'pre_production' | 'production' | 'post_production' | 'completed' | 'archived';
export type ScriptElementType =
  | 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical'
  | 'transition' | 'shot' | 'note' | 'page_break' | 'title_page'
  | 'centered' | 'lyrics' | 'synopsis' | 'section'
  // YouTube/Content Creator elements
  | 'hook' | 'talking_point' | 'broll_note' | 'cta' | 'sponsor_read' | 'chapter_marker';
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
export type ScriptType = 'screenplay' | 'stageplay' | 'episodic' | 'sketch' | 'comic' | 'podcast' | 'youtube' | 'tiktok';
export type ProjectType = 'film' | 'youtube' | 'tiktok' | 'podcast' | 'documentary' | 'educational' | 'livestream';
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
}

export interface Project {
  id: string;
  title: string;
  logline: string | null;
  synopsis: string | null;
  genre: string[];
  format: string;
  script_type: ScriptType;
  project_type: ProjectType;
  content_metadata: Record<string, any>;
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

export interface ProjectMember {
  id: string;
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
  comment_type: 'comment' | 'suggestion';
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
  prize_data: any;
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
  snapshot: any; // JSONB snapshot of elements
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
  plain_text: '📄',
  notes: '📝',
  outline: '📋',
  treatment: '📑',
  research: '🔍',
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
  // YouTube/Content Creator elements
  hook: 'Hook',
  talking_point: 'Talking Point',
  broll_note: 'B-Roll Note',
  cta: 'CTA',
  sponsor_read: 'Sponsor Read',
  chapter_marker: 'Chapter',
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
  { value: 'screenplay', label: 'Screenplay', description: 'Standard film/TV screenplay format', icon: '🎬' },
  { value: 'stageplay', label: 'Stage Play', description: 'Theatre script formatting', icon: '🎭' },
  { value: 'episodic', label: 'Episodic Series', description: 'Multi-episode TV/web series', icon: '📺' },
  { value: 'sketch', label: 'Sketch / Short', description: 'Comedy sketches and short-form content', icon: '😄' },
  { value: 'comic', label: 'Comic / Graphic Novel', description: 'Panel-based visual storytelling', icon: '📖' },
  { value: 'podcast', label: 'Podcast / Audio Drama', description: 'Audio-first scripted content', icon: '🎙️' },
  { value: 'youtube', label: 'YouTube Video', description: 'Long-form video content with hooks & CTAs', icon: '▶️' },
  { value: 'tiktok', label: 'TikTok / Reels / Shorts', description: 'Short-form vertical video content', icon: '📱' },
];

export const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string; description: string; icon: string }[] = [
  { value: 'film', label: 'Film / TV', description: 'Traditional film, TV, or web series production', icon: '🎬' },
  { value: 'youtube', label: 'YouTube', description: 'Long-form YouTube videos and series', icon: '▶️' },
  { value: 'tiktok', label: 'TikTok / Shorts', description: 'Short-form vertical video content', icon: '📱' },
  { value: 'podcast', label: 'Podcast', description: 'Audio podcasts and video podcasts', icon: '🎙️' },
  { value: 'documentary', label: 'Documentary', description: 'Documentary films and series', icon: '🎥' },
  { value: 'educational', label: 'Course / Tutorial', description: 'Educational content and online courses', icon: '📚' },
  { value: 'livestream', label: 'Livestream', description: 'Live streaming content planning', icon: '🔴' },
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
