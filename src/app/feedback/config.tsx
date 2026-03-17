import {
  Bug, Lightbulb, MessageSquare, CircleDot, Hammer, XCircle,
  BookMarked, CheckCircle2, AlertTriangle, Tag, Star,
} from 'lucide-react';

export type FeedbackStatus = 'open' | 'in_progress' | 'planned' | 'resolved' | 'wont_fix' | 'intended' | 'duplicate' | 'pending_review';
export type FeedbackType   = 'bug_report' | 'feature_request' | 'testimonial' | 'other';
export type FeedbackSort   = 'votes' | 'newest' | 'updated' | 'comments';

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  title: string;
  body: string;
  status: FeedbackStatus;
  priority: string;
  vote_count: number;
  comment_count: number;
  tags: string[];
  user_id: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_META: Record<FeedbackStatus, { label: string; color: string; icon: React.ElementType }> = {
  open:           { label: 'Open',           color: '#3b82f6', icon: CircleDot      },
  in_progress:    { label: 'In Progress',    color: '#f59e0b', icon: Hammer         },
  planned:        { label: 'Planned',        color: '#8b5cf6', icon: BookMarked     },
  resolved:       { label: 'Resolved',       color: '#22c55e', icon: CheckCircle2   },
  wont_fix:       { label: "Won't Fix",      color: '#6b7280', icon: XCircle        },
  intended:       { label: 'Intended',       color: '#6b7280', icon: BookMarked     },
  duplicate:      { label: 'Duplicate',      color: '#6b7280', icon: Tag            },
  pending_review: { label: 'Under Review',   color: '#f97316', icon: AlertTriangle  },
};

export const TYPE_META: Record<FeedbackType, { label: string; icon: React.ElementType; color: string }> = {
  bug_report:      { label: 'Bug',     icon: Bug,           color: '#ef4444' },
  feature_request: { label: 'Feature', icon: Lightbulb,     color: '#f59e0b' },
  testimonial:     { label: 'Review',  icon: Star,          color: '#8b5cf6' },
  other:           { label: 'Other',   icon: MessageSquare, color: '#6b7280' },
};
