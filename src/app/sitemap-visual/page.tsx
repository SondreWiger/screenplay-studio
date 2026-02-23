'use client';

import Link from 'next/link';

interface SitemapNode {
  label: string;
  href?: string;
  description?: string;
  badge?: 'pro' | 'auth' | 'public' | 'admin' | 'dynamic';
  children?: SitemapNode[];
}

const siteStructure: SitemapNode[] = [
  {
    label: 'Home',
    href: '/',
    description: 'Landing page',
    badge: 'public',
    children: [
      { label: 'Pro', href: '/pro', description: 'Upgrade & pricing', badge: 'public' },
      { label: 'Blog', href: '/blog', description: 'Articles & guides', badge: 'public', children: [
        { label: 'Post', href: '/blog/[slug]', description: 'Individual blog post', badge: 'dynamic' },
      ]},
      { label: 'Support', href: '/support', description: 'Help & contact', badge: 'public' },
    ],
  },
  {
    label: 'Auth',
    description: 'Authentication',
    badge: 'public',
    children: [
      { label: 'Login', href: '/auth/login', badge: 'public' },
      { label: 'Register', href: '/auth/register', badge: 'public' },
      { label: 'Forgot Password', href: '/auth/forgot-password', badge: 'public' },
    ],
  },
  {
    label: 'Dashboard',
    href: '/dashboard',
    description: 'Your projects & activity',
    badge: 'auth',
  },
  {
    label: 'Onboarding',
    href: '/onboarding',
    description: 'New user setup wizard',
    badge: 'auth',
  },
  {
    label: 'Projects',
    description: 'Project workspace',
    badge: 'auth',
    children: [
      { label: 'Overview', href: '/projects/[id]', description: 'Project dashboard', badge: 'auth' },
      {
        label: 'Writing',
        description: 'Core screenwriting tools',
        children: [
          { label: 'Script Editor', href: '/projects/[id]/script', description: 'Write & format your screenplay' },
          { label: 'Scenes', href: '/projects/[id]/scenes', description: 'Scene breakdown & management' },
          { label: 'Characters', href: '/projects/[id]/characters', description: 'Character profiles & arcs' },
          { label: 'Locations', href: '/projects/[id]/locations', description: 'Location scouting & maps' },
          { label: 'Ideas', href: '/projects/[id]/ideas', description: 'Brainstorm & notes' },
          { label: 'Documents', href: '/projects/[id]/documents', description: 'Supporting documents' },
        ],
      },
      {
        label: 'Creative',
        description: 'Visual & creative tools',
        children: [
          { label: 'Mind Map', href: '/projects/[id]/mindmap', description: 'Visual brainstorming' },
          { label: 'Mood Board', href: '/projects/[id]/moodboard', description: 'Visual references & inspiration' },
          { label: 'Storyboard', href: '/projects/[id]/storyboard', description: 'Scene-by-scene visuals' },
          { label: 'Thumbnails', href: '/projects/[id]/thumbnails', description: 'Thumbnail generation' },
        ],
      },
      {
        label: 'Production',
        description: 'Pre-production planning',
        children: [
          { label: 'Shot List', href: '/projects/[id]/shots', description: 'Camera shots & angles' },
          { label: 'Schedule', href: '/projects/[id]/schedule', description: 'Shooting schedule' },
          { label: 'Budget', href: '/projects/[id]/budget', description: 'Budget tracking' },
          { label: 'B-Roll', href: '/projects/[id]/broll', description: 'B-roll planning' },
          { label: 'On Set', href: '/projects/[id]/onset', description: 'On-set tools' },
          { label: 'Checklist', href: '/projects/[id]/checklist', description: 'Production checklists' },
        ],
      },
      {
        label: 'Collaboration',
        description: 'Team & review tools',
        children: [
          { label: 'Team', href: '/projects/[id]/team', description: 'Team members & roles' },
          { label: 'Chat', href: '/projects/[id]/chat', description: 'Project chat' },
          { label: 'Comments', href: '/projects/[id]/comments', description: 'Script comments & feedback' },
        ],
      },
      {
        label: 'Pro Tools',
        description: 'Premium features',
        badge: 'pro',
        children: [
          { label: 'Script Analysis', href: '/projects/[id]/ai-analysis', description: 'AI-powered script feedback', badge: 'pro' },
          { label: 'Analytics', href: '/projects/[id]/analytics', description: 'Project metrics & stats', badge: 'pro' },
          { label: 'Export', href: '/projects/[id]/export', description: 'PDF, DOCX, FDX export', badge: 'pro' },
          { label: 'Share Portal', href: '/projects/[id]/share', description: 'External sharing links', badge: 'pro' },
          { label: 'Casting', href: '/projects/[id]/casting', description: 'Casting management', badge: 'pro' },
          { label: 'Client Review', href: '/projects/[id]/review', description: 'Client feedback portal', badge: 'pro' },
          { label: 'Revisions', href: '/projects/[id]/revisions', description: 'Version comparison & tracking', badge: 'pro' },
          { label: 'Reports', href: '/projects/[id]/reports', description: 'Production reports', badge: 'pro' },
          { label: 'Custom Branding', href: '/projects/[id]/branding', description: 'Brand kit & watermarks', badge: 'pro' },
          { label: 'SEO', href: '/projects/[id]/seo', description: 'Public page SEO settings', badge: 'pro' },
          { label: 'Sponsors', href: '/projects/[id]/sponsors', description: 'Sponsor integrations', badge: 'pro' },
        ],
      },
      {
        label: 'Project Meta',
        children: [
          { label: 'Showcase', href: '/projects/[id]/showcase', description: 'Public showcase settings' },
          { label: 'Versions', href: '/projects/[id]/versions', description: 'Script version history' },
          { label: 'Settings', href: '/projects/[id]/settings', description: 'Project settings & preferences' },
        ],
      },
    ],
  },
  {
    label: 'Community',
    href: '/community',
    description: 'Public community hub',
    badge: 'public',
    children: [
      { label: 'Showcase', href: '/community/showcase', description: 'Featured projects', badge: 'public', children: [
        { label: 'Project', href: '/community/showcase/[id]', description: 'Project detail page', badge: 'dynamic', children: [
          { label: 'Script', href: '/community/showcase/[id]/script', badge: 'dynamic' },
          { label: 'Mood Board', href: '/community/showcase/[id]/moodboard', badge: 'dynamic' },
          { label: 'Mind Map', href: '/community/showcase/[id]/mindmap', badge: 'dynamic' },
        ]},
      ]},
      { label: 'Free Scripts', href: '/community/free-scripts', description: 'Open-source screenplays', badge: 'public' },
      { label: 'Challenges', href: '/community/challenges', description: 'Writing challenges', badge: 'public', children: [
        { label: 'Challenge', href: '/community/challenges/[id]', badge: 'dynamic' },
      ]},
      { label: 'Share', href: '/community/share', description: 'Share for feedback', badge: 'public' },
      { label: 'Chat', href: '/community/chat', description: 'Community chat', badge: 'auth' },
      { label: 'Post', href: '/community/post/[slug]', description: 'Community post', badge: 'dynamic' },
    ],
  },
  {
    label: 'Company',
    href: '/company',
    description: 'Company workspace',
    badge: 'auth',
    children: [
      { label: 'Company Page', href: '/company/[slug]', description: 'Public company profile', badge: 'dynamic', children: [
        { label: 'Blog', href: '/company/[slug]/blog', description: 'Company blog', badge: 'dynamic', children: [
          { label: 'Post', href: '/company/[slug]/blog/[postSlug]', badge: 'dynamic' },
        ]},
      ]},
      { label: 'Invite', href: '/company/invite/[token]', description: 'Team invitation link', badge: 'dynamic' },
    ],
  },
  {
    label: 'User',
    description: 'User account',
    badge: 'auth',
    children: [
      { label: 'Profile', href: '/u/[username]', description: 'Public profile page', badge: 'dynamic' },
      { label: 'Settings', href: '/settings', description: 'Account settings', badge: 'auth' },
      { label: 'Messages', href: '/messages', description: 'Direct messages', badge: 'auth' },
      { label: 'Notifications', href: '/notifications', description: 'Activity notifications', badge: 'auth' },
    ],
  },
  {
    label: 'Legal',
    href: '/legal',
    description: 'Legal & policies',
    badge: 'public',
    children: [
      { label: 'Terms of Service', href: '/legal/terms', badge: 'public' },
      { label: 'Privacy Policy', href: '/legal/privacy', badge: 'public' },
      { label: 'Cookies', href: '/legal/cookies', badge: 'public' },
      { label: 'DMCA', href: '/legal/dmca', badge: 'public' },
      { label: 'Acceptable Use', href: '/legal/acceptable-use', badge: 'public' },
      { label: 'Data Processing', href: '/legal/data-processing', badge: 'public' },
      { label: 'Content Policy', href: '/legal/content-policy', badge: 'public' },
      { label: 'Security', href: '/legal/security', badge: 'public' },
      { label: 'Community Guidelines', href: '/legal/community-guidelines', badge: 'public' },
      { label: 'Legal Blog', href: '/legal/blog', description: 'Policy updates', badge: 'public', children: [
        { label: 'Post', href: '/legal/blog/[slug]', badge: 'dynamic' },
      ]},
    ],
  },
  {
    label: 'Shared Content',
    description: 'External share viewer',
    children: [
      { label: 'Share Viewer', href: '/share/[token]', description: 'View shared content', badge: 'public' },
      { label: 'Casting Form', href: '/casting/[token]', description: 'Public casting application', badge: 'public' },
      { label: 'Short Links', href: '/p/[slug]', description: 'Short project links', badge: 'public' },
    ],
  },
  {
    label: 'Admin',
    href: '/admin',
    description: 'Platform administration',
    badge: 'admin',
    children: [
      { label: 'Security', href: '/admin/security', badge: 'admin' },
      { label: 'Legal', href: '/admin/legal', badge: 'admin' },
    ],
  },
];

const badgeColors: Record<string, { bg: string; text: string; label: string }> = {
  public: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Public' },
  auth: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Auth' },
  pro: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Pro' },
  admin: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Admin' },
  dynamic: { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'Dynamic' },
};

function Badge({ type }: { type: string }) {
  const style = badgeColors[type];
  if (!style) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function SitemapTree({ nodes, depth = 0 }: { nodes: SitemapNode[]; depth?: number }) {
  return (
    <ul className={depth === 0 ? 'space-y-4' : 'space-y-1 mt-1'}>
      {nodes.map((node, i) => (
        <li key={i} className={depth > 0 ? 'relative pl-5' : ''}>
          {depth > 0 && (
            <div className="absolute left-0 top-0 bottom-0 w-px bg-surface-700" />
          )}
          {depth > 0 && (
            <div className="absolute left-0 top-3 w-3 h-px bg-surface-700" />
          )}
          <div className={`flex items-start gap-2 py-1.5 px-3 rounded-lg ${depth === 0 ? 'bg-surface-900 border border-surface-800' : 'hover:bg-surface-800/50'} transition-colors`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {node.href ? (
                  <span className="text-sm font-medium text-white">{node.label}</span>
                ) : (
                  <span className="text-sm font-medium text-surface-300">{node.label}</span>
                )}
                {node.badge && <Badge type={node.badge} />}
                {node.href && (
                  <code className="text-[11px] text-surface-500 font-mono">{node.href}</code>
                )}
              </div>
              {node.description && (
                <p className="text-xs text-surface-500 mt-0.5">{node.description}</p>
              )}
            </div>
          </div>
          {node.children && node.children.length > 0 && (
            <SitemapTree nodes={node.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

function countPages(nodes: SitemapNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + (n.children ? countPages(n.children) : 0), 0);
}

export default function VisualSitemapPage() {
  const total = countPages(siteStructure);

  return (
    <div className="min-h-screen bg-surface-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-sm text-surface-400 hover:text-white transition-colors mb-4 inline-block">&larr; Back to home</Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Sitemap</h1>
          <p className="text-surface-400 mt-2">Complete map of all {total} pages on Screenplay Studio.</p>
          <div className="flex flex-wrap gap-3 mt-4">
            {Object.entries(badgeColors).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${val.bg} border border-current ${val.text}`} />
                <span className="text-xs text-surface-400">{val.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-white px-3 py-1.5 rounded-lg bg-surface-900 border border-surface-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              sitemap.xml
            </a>
            <a
              href="/api/rss"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-white px-3 py-1.5 rounded-lg bg-surface-900 border border-surface-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
              RSS Feed
            </a>
          </div>
        </div>

        <SitemapTree nodes={siteStructure} />

        <div className="mt-12 pt-6 border-t border-surface-800 text-center">
          <p className="text-xs text-surface-600">Screenplay Studio &mdash; Open-source screenwriting suite</p>
        </div>
      </div>
    </div>
  );
}
