import type { Profile, CompanyPlan, CompanyRole, ScriptElement } from './base';

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
// Organization System Types
// ============================================================

export interface OrgChannel {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  channel_type: 'general' | 'project' | 'team' | 'announcement' | 'random';
  is_archived: boolean;
  is_default: boolean;
  project_id: string | null;
  team_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrgChannelMessage {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  reply_to_id: string | null;
  is_pinned: boolean;
  attachments: unknown[];
  reactions: Record<string, string[]>;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  author?: Profile;
  reply_to?: OrgChannelMessage;
}

export interface OrgChannelMember {
  channel_id: string;
  user_id: string;
  last_read_at: string;
  is_muted: boolean;
  joined_at: string;
  profile?: Profile;
}

export interface OrgAnnouncement {
  id: string;
  company_id: string;
  author_id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  is_pinned: boolean;
  expires_at: string | null;
  attachments: unknown[];
  created_at: string;
  updated_at: string;
  author?: Profile;
  read_count?: number;
}

export interface OrgPipelineStage {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

export type ScriptAssignmentType = 'write' | 'rewrite' | 'polish' | 'review' | 'notes';
export type ScriptAssignmentStatus = 'assigned' | 'in_progress' | 'submitted' | 'in_review' | 'revision_requested' | 'approved' | 'rejected';

export interface OrgScriptAssignment {
  id: string;
  company_id: string;
  project_id: string;
  script_id: string | null;
  assigned_to: string;
  assigned_by: string;
  title: string;
  description: string | null;
  assignment_type: ScriptAssignmentType;
  status: ScriptAssignmentStatus;
  deadline: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  revision_count: number;
  max_revisions: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile;
  assigner?: Profile;
  project?: { id: string; title: string };
}

export type ReviewNoteSeverity = 'suggestion' | 'important' | 'mandatory' | 'praise';
export type ReviewNoteStatus = 'open' | 'acknowledged' | 'addressed' | 'dismissed' | 'resolved';

export interface OrgReviewNote {
  id: string;
  company_id: string;
  project_id: string;
  script_id: string | null;
  author_id: string;
  note_type: 'general' | 'page' | 'line' | 'character' | 'structure' | 'dialogue' | 'action';
  content: string;
  page_number: number | null;
  element_index: number | null;
  element_id: string | null;
  severity: ReviewNoteSeverity;
  status: ReviewNoteStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface OrgResource {
  id: string;
  company_id: string;
  created_by: string;
  title: string;
  description: string | null;
  resource_type: 'template' | 'style_guide' | 'character_bible' | 'world_bible'
    | 'mood_board' | 'reference_image' | 'contract' | 'document' | 'other';
  category: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  thumbnail_url: string | null;
  tags: string[];
  is_pinned: boolean;
  access_level: 'company' | 'team' | 'project';
  team_id: string | null;
  project_id: string | null;
  version: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  creator?: Profile;
}

export interface OrgCalendarEvent {
  id: string;
  company_id: string;
  created_by: string;
  title: string;
  description: string | null;
  event_type: 'milestone' | 'deadline' | 'meeting' | 'table_read'
    | 'shoot_day' | 'review' | 'delivery' | 'other';
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  color: string;
  project_id: string | null;
  is_recurring: boolean;
  recurrence: unknown | null;
  location: string | null;
  attendees: string[];
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
  creator?: Profile;
  project?: { id: string; title: string };
}

export type PitchStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'greenlit' | 'shelved';

export interface OrgPitch {
  id: string;
  company_id: string;
  author_id: string;
  title: string;
  logline: string | null;
  synopsis: string | null;
  genre: string | null;
  format: string | null;
  target_audience: string | null;
  mood_keywords: string[];
  reference_urls: string[];
  cover_image_url: string | null;
  status: PitchStatus;
  reviewed_by: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  project_id: string | null;
  vote_count: number;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface OrgPitchComment {
  id: string;
  pitch_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: Profile;
}

export interface OrgPoll {
  id: string;
  company_id: string;
  created_by: string;
  question: string;
  description: string | null;
  poll_type: 'single' | 'multiple' | 'ranked';
  options: { label: string; votes?: number }[];
  is_anonymous: boolean;
  closes_at: string | null;
  is_closed: boolean;
  channel_id: string | null;
  project_id: string | null;
  created_at: string;
  creator?: Profile;
}

export interface OrgClass {
  id: string;
  company_id: string;
  instructor_id: string;
  name: string;
  description: string | null;
  join_code: string;
  semester: string | null;
  year: number | null;
  is_active: boolean;
  max_students: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  instructor?: Profile;
  student_count?: number;
}

export interface OrgClassAssignment {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  assignment_type: 'script' | 'scene' | 'outline' | 'treatment' | 'revision' | 'peer_review' | 'other';
  requirements: Record<string, unknown>;
  due_date: string | null;
  max_points: number;
  is_published: boolean;
  allow_late: boolean;
  peer_review_enabled: boolean;
  peer_reviews_required: number;
  created_at: string;
  updated_at: string;
  submission_count?: number;
}

export interface OrgClassSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  project_id: string | null;
  script_id: string | null;
  content: string | null;
  file_url: string | null;
  status: 'draft' | 'submitted' | 'graded' | 'returned' | 'resubmitted';
  grade: number | null;
  grade_letter: string | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
  submitted_at: string | null;
  is_late: boolean;
  created_at: string;
  updated_at: string;
  student?: Profile;
}

export interface OrgPeerReview {
  id: string;
  submission_id: string;
  reviewer_id: string;
  rating: number | null;
  strengths: string | null;
  weaknesses: string | null;
  suggestions: string | null;
  overall_comment: string | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
  reviewer?: Profile;
}
