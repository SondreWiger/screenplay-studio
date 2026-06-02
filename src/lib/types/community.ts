import type { Profile, ProductionStatus, ScriptElement } from './base';

// ============================================================
// Sub-Communities
// ============================================================

export type SubCommunityVisibility = 'public' | 'restricted' | 'private';
export type SubCommunityPostingMode = 'open' | 'require_approval' | 'apply_to_post';
export type SubCommunityMemberRole = 'member' | 'moderator' | 'admin' | 'banned' | 'pending_approval';

export interface SubCommunity {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  long_description: string | null;
  icon: string;
  banner_url: string | null;
  accent_color: string;
  accent_color2: string;
  font_style: 'default' | 'serif' | 'mono' | 'rounded';
  visibility: SubCommunityVisibility;
  posting_mode: SubCommunityPostingMode;
  automod_enabled: boolean;
  automod_sensitivity: 'low' | 'medium' | 'high';
  member_count: number;
  post_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Discord integration */
  discord_invite_url: string | null;
  discord_server_id: string | null;
  /** Chat mode: 'chat' = built-in channels, 'discord_only' = redirect to Discord */
  chat_mode: 'chat' | 'discord_only';
  /** Current user's membership record, if fetched. */
  my_membership?: SubCommunityMember | null;
}

export type CommunityChannelType = 'text' | 'announcement' | 'readonly';

export interface CommunityChannel {
  id: string;
  community_id: string;
  name: string;
  description: string | null;
  type: CommunityChannelType;
  position: number;
  created_at: string;
}

export interface CommunityMessage {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  edited_at: string | null;
  is_deleted: boolean;
  created_at: string;
  author?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
  } | null;
}

export interface SubCommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  role: SubCommunityMemberRole;
  can_post: boolean;
  joined_at: string;
  user?: Profile;
}

export interface SubCommunityRule {
  id: string;
  community_id: string;
  sort_order: number;
  title: string;
  description: string | null;
  created_at: string;
}

export interface SubCommunityContest {
  id: string;
  community_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  rules_markdown: string | null;
  prize: string | null;
  banner_url: string | null;
  starts_at: string;
  ends_at: string;
  voting_ends_at: string | null;
  status: 'upcoming' | 'active' | 'voting' | 'completed' | 'cancelled';
  max_entries_per_user: number;
  submission_count: number;
  vote_count: number;
  created_at: string;
  updated_at: string;
  creator?: Profile;
}

export interface SubCommunityContestEntry {
  id: string;
  contest_id: string;
  user_id: string;
  post_id: string | null;
  title: string | null;
  body: string | null;
  vote_count: number;
  created_at: string;
  user?: Profile;
  has_voted?: boolean;
}

export interface AutomodFlag {
  id: string;
  content_type: 'post' | 'comment' | 'script';
  content_id: string;
  community_id: string | null;
  flagged_by: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  auto_actioned: boolean;
  resolved: boolean;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
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
