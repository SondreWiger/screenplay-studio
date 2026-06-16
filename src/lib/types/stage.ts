import type { Profile } from './base';

// Stage Play / Theatre Production Types

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

// Shoot Days
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

// Shoot Gear
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

// Sidebar Layout Customisation
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

// Community Courses

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

// Quotes

export interface Quote {
  id: string;
  content: string;
  said_by: string;
  said_at: string | null;
  context: string | null;
  location: string | null;
  group_name: string | null;
  project_id: string | null;
  group_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  group?: QuoteGroup | null;
}

export interface QuoteInsert {
  content: string;
  said_by: string;
  said_at?: string | null;
  context?: string | null;
  location?: string | null;
  group_name?: string | null;
  project_id?: string | null;
  group_id?: string | null;
}

export interface QuoteUpdate {
  content?: string;
  said_by?: string;
  said_at?: string | null;
  context?: string | null;
  location?: string | null;
  group_name?: string | null;
  group_id?: string | null;
}

// Quote Groups

export interface QuoteGroup {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: QuoteGroupMember[];
  quote_count?: number;
}

export interface QuoteGroupInsert {
  name: string;
  description?: string | null;
  emoji?: string;
}

export interface QuoteGroupUpdate {
  name?: string;
  description?: string | null;
  emoji?: string;
}

export interface QuoteGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profile?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}
