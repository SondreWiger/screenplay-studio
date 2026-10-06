'use client';

import type { ComponentType, ReactNode } from 'react';
import {
  Activity, Award, BarChart3, Cpu, Flag, FolderKanban, GraduationCap, Languages, LayoutDashboard, Mail, MessageSquareText,
  MessagesSquare, Network, Newspaper, Scale, ScrollText, ShieldAlert, ShieldCheck, Star, Ticket, ToggleRight, Users, Zap,
} from 'lucide-react';

export type AdminTab =
  | 'overview' | 'users' | 'engagement' | 'projects' | 'mindmap' | 'system' | 'blog' | 'community' | 'tickets'
  | 'contributors' | 'badges' | 'courses' | 'creators' | 'translations';

type Loader = () => Promise<{ default: ComponentType }>;

/** Code-split loaders: each tab's code (and data) loads only when opened. */
export const TAB_LOADERS: Record<AdminTab, Loader> = {
  overview: () => import('./tabs/OverviewTab'),
  users: () => import('./tabs/UsersTab'),
  engagement: () => import('./tabs/EngagementTab'),
  projects: () => import('./tabs/ProjectsTab'),
  mindmap: () => import('./tabs/ProjectsTab').then((m) => ({ default: m.MindmapPanel })),
  system: () => import('./tabs/SystemTab'),
  blog: () => import('./tabs/BlogTab'),
  community: () => import('./tabs/CommunityTab'),
  tickets: () => import('./tabs/TicketsTab'),
  contributors: () => import('./tabs/ContributorsTab'),
  badges: () => import('./tabs/BadgesTab'),
  courses: () => import('./tabs/CoursesTab'),
  creators: () => import('./tabs/CreatorsTab'),
  translations: () => import('./tabs/TranslationsTab'),
};

/** Warm a tab's chunk (e.g. on nav hover) so opening it is instant. */
export function preloadTab(tab: AdminTab) {
  TAB_LOADERS[tab]().catch(() => { /* will retry on open */ });
}

/** Tabs moderators may use; everything else needs a full admin. */
export const MOD_TABS: AdminTab[] = ['tickets', 'community'];

export function isAdminTab(v: string | null): v is AdminTab {
  return !!v && v in TAB_LOADERS;
}

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  /** Set for tabs rendered inside /admin. */
  tab?: AdminTab;
  /** Visible to moderators (default: full admins only). */
  mod?: boolean;
}

const ic = 'h-[18px] w-[18px]';

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Insights',
    items: [
      { label: 'Overview', href: '/admin', tab: 'overview', icon: <LayoutDashboard className={ic} /> },
      { label: 'Users', href: '/admin?tab=users', tab: 'users', icon: <Users className={ic} /> },
      { label: 'Engagement', href: '/admin?tab=engagement', tab: 'engagement', icon: <Activity className={ic} /> },
      { label: 'Projects', href: '/admin?tab=projects', tab: 'projects', icon: <FolderKanban className={ic} /> },
      { label: 'Mind Map', href: '/admin?tab=mindmap', tab: 'mindmap', icon: <Network className={ic} /> },
    ],
  },
  {
    label: 'Support & community',
    items: [
      { label: 'Tickets', href: '/admin?tab=tickets', tab: 'tickets', icon: <Ticket className={ic} />, mod: true },
      { label: 'Community', href: '/admin?tab=community', tab: 'community', icon: <MessagesSquare className={ic} />, mod: true },
      { label: 'Feedback', href: '/admin/feedback', icon: <MessageSquareText className={ic} /> },
      { label: 'Polls', href: '/admin/polls', icon: <BarChart3 className={ic} /> },
      { label: 'Email', href: '/admin/email', icon: <Mail className={ic} /> },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'Blog', href: '/admin?tab=blog', tab: 'blog', icon: <Newspaper className={ic} /> },
      { label: 'Changelog', href: '/admin/changelog', icon: <ScrollText className={ic} /> },
      { label: 'Legal Blog', href: '/admin/legal', icon: <Scale className={ic} />, mod: true },
      { label: 'Courses', href: '/admin?tab=courses', tab: 'courses', icon: <GraduationCap className={ic} /> },
      { label: 'Badges', href: '/admin?tab=badges', tab: 'badges', icon: <Award className={ic} /> },
      { label: 'Translations', href: '/admin?tab=translations', tab: 'translations', icon: <Languages className={ic} /> },
    ],
  },
  {
    label: 'Programs',
    items: [
      { label: 'Contributors', href: '/admin?tab=contributors', tab: 'contributors', icon: <Star className={ic} /> },
      { label: 'Creators', href: '/admin?tab=creators', tab: 'creators', icon: <Zap className={ic} /> },
    ],
  },
  {
    label: 'Trust & platform',
    items: [
      { label: 'Moderation', href: '/admin/moderation', icon: <ShieldAlert className={ic} /> },
      { label: 'Reports', href: '/admin/reports', icon: <Flag className={ic} />, mod: true },
      { label: 'Security', href: '/admin/security', icon: <ShieldCheck className={ic} /> },
      { label: 'Feature Flags', href: '/admin/features', icon: <ToggleRight className={ic} /> },
      { label: 'System', href: '/admin?tab=system', tab: 'system', icon: <Cpu className={ic} /> },
    ],
  },
];
