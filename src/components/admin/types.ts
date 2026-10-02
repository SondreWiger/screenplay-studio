/** Shared types and role helpers for the admin panel. */

export const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';
export const isStaff = (role?: string) => role === 'moderator' || role === 'admin';
export const isFullAdmin = (id?: string, role?: string) => id === ADMIN_UID || role === 'admin';

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  is_pro: boolean;
  pro_since: string | null;
  created_at: string;
  updated_at: string;
  projectCount?: number;
  moderation_flags?: number;
  moderation_status?: string;
}

export interface ContributorRow {
  id: string;
  user_id: string;
  github_handle: string | null;
  bio: string | null;
  cached_name: string | null;
  cached_avatar_url: string | null;
  contribution_areas: string[];
  is_featured: boolean;
  added_at: string;
  added_by: string | null;
}

export interface ProjectWithCounts {
  id: string;
  title: string;
  logline: string | null;
  script_type: string | null;
  format: string;
  status: string;
  created_at: string;
  updated_at: string;
  project_members: {
    role?: string;
    user_id?: string;
    profile?: { id: string; display_name: string | null; email: string; avatar_url: string | null } | null;
  }[];
  scripts: { count: number }[];
}

export interface ProjectStatsDetail {
  scripts: number;
  elements: number;
  words: number;
  characters: number;
  locations: number;
  scenes: number;
  shots: number;
  ideas: number;
  budgetItems: number;
  totalBudget: number;
  scheduleEvents: number;
  scriptList: { id: string; title: string; version: string }[];
}

export interface PendingLanguage {
  id: string;
  code: string;
  name: string;
  native_name: string;
  status: string;
  added_by: string;
  added_by_profile: { display_name: string | null; email: string } | null;
}

export interface PendingProduction {
  id: string;
  title: string;
  status: string;
  created_at: string;
  thumbnail_url: string | null;
  description: string | null;
  url: string | null;
  submitter: { full_name: string | null; avatar_url: string | null; email: string } | null;
  post: { title: string; slug: string } | null;
  owner: { full_name: string | null; avatar_url: string | null } | null;
}

export interface PayoutPreviewItem {
  id: string;
  signups_count: number;
  proportion: number;
  amount: number;
  creator: {
    ref_code: string;
    profile: { full_name: string | null; username: string | null } | null;
  } | null;
}
