import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

export function generateSceneNumber(index: number): string {
  return String(index + 1);
}

export function estimatePageCount(content: string): number {
  // Industry standard: ~56 lines per page
  const lines = content.split('\n').length;
  return Math.max(0.125, Math.round((lines / 56) * 8) / 8);
}

export function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function randomColor(): string {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export const SCREENPLAY_FONT_SIZE = 12;
export const SCREENPLAY_LINE_HEIGHT = 1.5;
export const LINES_PER_PAGE = 56;

// Challenge phase computation
export function getChallengePhase(challenge: {
  starts_at: string;
  submissions_close_at: string;
  voting_close_at: string;
  reveal_at: string;
}): 'upcoming' | 'submissions' | 'voting' | 'reveal_pending' | 'completed' {
  const now = Date.now();
  if (now < new Date(challenge.starts_at).getTime()) return 'upcoming';
  if (now < new Date(challenge.submissions_close_at).getTime()) return 'submissions';
  if (now < new Date(challenge.voting_close_at).getTime()) return 'voting';
  if (now < new Date(challenge.reveal_at).getTime()) return 'reveal_pending';
  return 'completed';
}

export function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    upcoming: 'Starting Soon',
    submissions: 'Submissions Open',
    voting: 'Voting Open',
    reveal_pending: 'Results Pending',
    completed: 'Completed',
  };
  return labels[phase] || phase;
}

export function getPhaseColor(phase: string): string {
  const colors: Record<string, string> = {
    upcoming: 'text-blue-600 bg-blue-50',
    submissions: 'text-green-600 bg-green-50',
    voting: 'text-amber-600 bg-amber-50',
    reveal_pending: 'text-purple-600 bg-purple-50',
    completed: 'text-stone-600 bg-stone-100',
  };
  return colors[phase] || 'text-stone-600 bg-stone-100';
}

export function timeUntil(date: string | Date): string {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'now';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
