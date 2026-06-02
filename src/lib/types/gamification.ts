import type { Profile, CommunityPostStatus, ChallengeType, ChallengeDifficulty, ProductionStatus } from './base';
import type { SubCommunity } from './community';

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
  status: CommunityPostStatus;
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
  /** Subcommunity this post belongs to, if any. */
  sub_community_id?: string | null;
  /** Moderation status inside a subcommunity (default 'approved'). */
  mod_status?: 'approved' | 'pending' | 'rejected';
  sub_community?: SubCommunity;
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
