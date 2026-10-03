import type { ReactNode } from 'react';
import {
  Bell, BookOpen, Building2, CreditCard, Download, FileText, FlaskConical, GraduationCap, Heart, LayoutDashboard,
  LifeBuoy, Lightbulb, MessageSquare, MessagesSquare, Megaphone, Newspaper, Palette, PenTool, Quote, Scale, ScrollText,
  Settings, Shield, Sparkles, Target, Trophy, Users, UsersRound, Wrench, Languages,
} from 'lucide-react';

export interface ShellNavItem {
  label: string;
  href: string;
  icon: ReactNode;
  /** Extra path prefixes that count as this item being active. */
  match?: string[];
  /** Only exact `href` (and `match`) are active — not every child path. */
  exact?: boolean;
  /** Key into the badge counts the shell passes in. */
  badge?: 'messages' | 'notifications';
}

export interface ShellNavSection {
  id: string;
  label: string;
  items: ShellNavItem[];
}

export interface ShellNavContext {
  signedIn: boolean;
  isElectron: boolean;
  community: boolean;
  messages: boolean;
  companies: boolean;
  hasCompany: boolean;
  accountability: boolean;
  staff: boolean;
  isAdmin: boolean;
  username: string | null;
}

const ic = 'h-[18px] w-[18px]';

/**
 * One navigation for every app area outside a project: dashboard, community,
 * settings, learning, help. Sections and items drop out when they don't apply
 * (signed out, Electron offline, feature off).
 */
export function buildShellNav(ctx: ShellNavContext): ShellNavSection[] {
  const sections: ShellNavSection[] = [];

  if (ctx.signedIn) {
    sections.push({
      id: 'workspace',
      label: 'Workspace',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className={ic} /> },
        { label: 'Idea Boards', href: '/idea-boards', icon: <Lightbulb className={ic} /> },
        ...(ctx.messages ? [{ label: 'Messages', href: '/messages', icon: <MessageSquare className={ic} />, badge: 'messages' as const }] : []),
        { label: 'Notifications', href: '/notifications', icon: <Bell className={ic} />, badge: 'notifications' as const },
        ...(ctx.accountability ? [{ label: 'Accountability', href: '/accountability', icon: <Target className={ic} /> }] : []),
      ],
    });
  }

  if (ctx.community && !ctx.isElectron) {
    sections.push({
      id: 'community',
      label: 'Community',
      items: [
        { label: 'Feed', href: '/community', icon: <Newspaper className={ic} />, exact: true, match: ['/community/post', '/community/share'] },
        { label: 'Communities', href: '/community/c', icon: <UsersRound className={ic} /> },
        { label: 'Showcase', href: '/community/showcase', icon: <Sparkles className={ic} /> },
        { label: 'Challenges', href: '/community/challenges', icon: <Trophy className={ic} /> },
        { label: 'Courses', href: '/community/courses', icon: <GraduationCap className={ic} /> },
        { label: 'Free Scripts', href: '/community/free-scripts', icon: <FileText className={ic} /> },
        { label: 'Chat', href: '/community/chat', icon: <MessagesSquare className={ic} /> },
        { label: 'People', href: '/people', icon: <Users className={ic} />, match: ['/u/'] },
        { label: 'Quotes', href: '/quotes', icon: <Quote className={ic} /> },
      ],
    });
  } else if (ctx.signedIn) {
    sections[0]?.items.push(
      { label: 'People', href: '/people', icon: <Users className={ic} />, match: ['/u/'] },
      { label: 'Quotes', href: '/quotes', icon: <Quote className={ic} /> },
    );
  }

  sections.push({
    id: 'learn',
    label: 'Learn & make',
    items: [
      { label: 'Learn', href: '/learn', icon: <BookOpen className={ic} />, match: ['/tutorials'] },
      { label: 'Writer Tools', href: '/tools', icon: <Wrench className={ic} /> },
      { label: 'Color Scripts', href: '/colors', icon: <Palette className={ic} /> },
      ...(!ctx.isElectron ? [
        { label: 'Blog', href: '/blog', icon: <PenTool className={ic} /> },
        { label: 'Changelog', href: '/changelog', icon: <ScrollText className={ic} /> },
      ] : []),
    ],
  });

  sections.push({
    id: 'help',
    label: 'Help',
    items: [
      { label: 'Feedback', href: '/feedback', icon: <Megaphone className={ic} /> },
      { label: 'Support', href: '/support', icon: <LifeBuoy className={ic} /> },
      { label: 'Testimonials', href: '/testimonials', icon: <Heart className={ic} /> },
      { label: 'Translations', href: '/translations', icon: <Languages className={ic} /> },
      { label: 'Legal', href: '/legal', icon: <Scale className={ic} /> },
      ...(!ctx.isElectron ? [{ label: 'Desktop App', href: '/download', icon: <Download className={ic} /> }] : []),
    ],
  });

  if (ctx.signedIn) {
    sections.push({
      id: 'account',
      label: 'Account',
      items: [
        { label: 'Settings', href: '/settings', icon: <Settings className={ic} />, exact: true, match: ['/settings/security', '/settings/mcp', '/settings/creator'] },
        { label: 'Pro & Billing', href: '/pro', icon: <CreditCard className={ic} />, match: ['/settings/billing', '/claim-pro'] },
        ...(ctx.companies && ctx.hasCompany ? [{ label: 'Company', href: '/company', icon: <Building2 className={ic} /> }] : []),
        ...(ctx.staff ? [{ label: ctx.isAdmin ? 'Admin' : 'Mod Panel', href: '/admin', icon: <Shield className={ic} /> }] : []),
        ...(ctx.isAdmin ? [{ label: 'Dev Portal', href: '/dev/features', icon: <FlaskConical className={ic} /> }] : []),
      ],
    });
  }

  return sections.filter((s) => s.items.length > 0);
}

export function isNavItemActive(item: ShellNavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  if (item.match?.some((m) => pathname.startsWith(m))) return true;
  if (item.exact) return false;
  return pathname.startsWith(item.href + '/');
}
