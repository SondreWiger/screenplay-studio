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
export type BlogPostStatus = 'draft' | 'published' | 'archived';
export type CommunityPostStatus = 'draft' | 'published' | 'archived';
export type ChallengeType = 'weekly' | 'custom';
export type ChallengePhase = 'upcoming' | 'submissions' | 'voting' | 'reveal_pending' | 'completed';
export type ChallengeDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type ProductionStatus = 'pending' | 'approved' | 'rejected';
export type UsageIntent = 'writer' | 'producer' | 'both' | 'student';
export type ScriptType = 'screenplay' | 'stageplay' | 'episodic' | 'sketch' | 'comic' | 'podcast';
export type CompanyRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
export type CompanyPlan = 'free' | 'pro' | 'enterprise';

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
  // Onboarding & preferences
  onboarding_completed: boolean;
  usage_intent: UsageIntent;
  show_community: boolean;
  show_production_tools: boolean;
  show_collaboration: boolean;
  preferred_script_type: ScriptType;
  theme_preference: string;
  company_id: string | null;
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
  script_type: ScriptType;
  target_length_minutes: number | null;
  status: ProjectStatus;
  poster_url: string | null;
  cover_url: string | null;
  episode_count: number | null;
  season_number: number | null;
  company_id: string | null;
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
// Festival Submissions
// ============================================================

export type FestivalSubmissionStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'withdrawn';

export interface Festival {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  logo_url: string | null;
  deadline: string | null;
  location: string | null;
  categories: string[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FestivalSubmission {
  id: string;
  festival_id: string;
  project_id: string;
  user_id: string;
  script_snapshot: any;
  title: string;
  logline: string | null;
  genre: string | null;
  format: string | null;
  script_type: string;
  page_count: number;
  word_count: number;
  status: FestivalSubmissionStatus;
  submitted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  festival?: Festival;
  project?: Project;
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
  | 'festival_deadline'
  | 'chat_mention'
  | 'general';

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

export const SCRIPT_TYPE_OPTIONS: { value: ScriptType; label: string; description: string; icon: string }[] = [
  { value: 'screenplay', label: 'Screenplay', description: 'Standard film/TV screenplay format', icon: '🎬' },
  { value: 'stageplay', label: 'Stage Play', description: 'Theatre script formatting', icon: '🎭' },
  { value: 'episodic', label: 'Episodic Series', description: 'Multi-episode TV/web series', icon: '📺' },
  { value: 'sketch', label: 'Sketch / Short', description: 'Comedy sketches and short-form content', icon: '😄' },
  { value: 'comic', label: 'Comic / Graphic Novel', description: 'Panel-based visual storytelling', icon: '📖' },
  { value: 'podcast', label: 'Podcast / Audio Drama', description: 'Audio-first scripted content', icon: '🎙️' },
];
