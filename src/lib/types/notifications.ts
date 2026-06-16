import type { Profile, Project, ProjectMember, Script } from './base';
import type { Character } from './development';

// Notification Types

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
  | 'general'
  | 'mention'
  | 'blog_comment'
  | 'feedback_update'
  | 'collaborator_added'
  | 'poll_published';

// Poll / Survey Types

export type PollStatus = 'draft' | 'review' | 'published' | 'closed';
export type PollQuestionType = 'yes_no' | 'single_select' | 'multi_select' | 'ranking' | 'short_text' | 'long_text';

export interface PollSession {
  id: string;
  title: string;
  preface: string | null;
  status: PollStatus;
  created_by: string;
  published_at: string | null;
  closed_at: string | null;
  response_count: number;
  created_at: string;
  updated_at: string;
  // joined
  questions?: PollQuestion[];
}

export interface PollQuestion {
  id: string;
  session_id: string;
  sort_order: number;
  question_text: string;
  question_type: PollQuestionType;
  options: string[] | null;
  is_required: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface PollResponse {
  id: string;
  session_id: string;
  user_id: string;
  completed_at: string;
  xp_awarded: number;
}

export interface PollAnswer {
  id: string;
  response_id: string;
  session_id: string;
  question_id: string;
  user_id: string;
  answer_text: string | null;
  answer_json: unknown | null;
  created_at: string;
}

// Mind Map Types

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

// Direct Message Types

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

// Project Channel Types

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

// Mood Board Types

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

// UI Types

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
