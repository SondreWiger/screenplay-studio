'use client';

import { useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { cn } from '@/lib/utils';

// ── Complete feature catalogue ─────────────────────────────────────────────

type Category =
  | 'Writing'
  | 'Story'
  | 'Characters'
  | 'Production'
  | 'Broadcast'
  | 'Collaboration'
  | 'Community'
  | 'Analytics'
  | 'Platform';

interface Feature {
  id: string;
  icon: string;
  name: string;
  tagline: string;
  category: Category;
  description: string;
  bullets?: string[];
  pro?: boolean;
  new?: boolean;
}


const FEATURES: Feature[] = [
  // ── Writing ──────────────────────────────────────────────────
  {
    id: 'script-editor',
    icon: '✍️',
    name: 'Script Editor',
    tagline: 'Professional Fountain editor',
    category: 'Writing',
    description: 'A full-featured script editor with live Fountain syntax formatting, auto-complete, scene numbering, and keyboard-first navigation. Exports to industry-standard formats.',
    bullets: ['Live Fountain rendering', 'Scene number management', 'Keyboard shortcuts', 'PDF export'],
  },
  {
    id: 'scene-management',
    icon: '🎬',
    name: 'Scene Management',
    tagline: 'Organize your scenes visually',
    category: 'Writing',
    description: 'View, reorder, and manage every scene in your script. Each scene shows character and location tags for quick navigation.',
    bullets: ['Drag-to-reorder', 'Filter by character', 'Scene tags', 'Quick preview'],
  },
  {
    id: 'revisions',
    icon: '📝',
    name: 'Revisions',
    tagline: 'Track every draft',
    category: 'Writing',
    description: 'Named revision drafts let you preserve every version of your script. Compare diffs across drafts and restore any version.',
    bullets: ['Named drafts', 'Version diff', 'Restore any version', 'Industry colors'],
  },
  {
    id: 'export',
    icon: '📤',
    name: 'Export',
    tagline: 'PDF, FDX, Fountain & more',
    category: 'Writing',
    description: 'Export your script to PDF (industry formatted), Final Draft FDX, plain Fountain, or Word DOCX. Full title page control included.',
    bullets: ['Industry PDF formatting', 'Final Draft FDX', 'Fountain plain text', 'Custom title page'],
  },
  {
    id: 'title-page',
    icon: '🗒️',
    name: 'Title Page Designer',
    tagline: 'Branded first impressions',
    category: 'Writing',
    description: 'Design a fully branded title page with your project logo, company logo, writer credits, contact block, and revision label.',
    bullets: ['Custom logos', 'Writer credits', 'Contact block', 'Revision label'],
  },
  {
    id: 'table-read',
    icon: '🎙️',
    name: 'Table Read',
    tagline: 'Virtual read-through mode',
    category: 'Writing',
    description: 'Run a virtual table read by assigning characters to participants. The reader view highlights the active speaker and auto-scrolls.',
    bullets: ['Role assignments', 'Auto-scroll', 'Speaker highlighting', 'Shared session'],
  },
  {
    id: 'coverage',
    icon: '📋',
    name: 'Script Coverage',
    tagline: 'Structured analysis reports',
    category: 'Writing',
    description: 'Write and store structured coverage reports for any script. Rate act structure, dialogue, character, and commercial viability.',
    bullets: ['Structured scoring', 'Rating categories', 'PDF export', 'Private notes'],
  },
  {
    id: 'script-lock',
    icon: '🔒',
    name: 'Scene Locking',
    tagline: 'Freeze scenes from edits',
    category: 'Writing',
    description: 'Lock individual scenes to prevent accidental edits during production. Locked scenes display a clear visual indicator.',
    bullets: ['Per-scene locking', 'Admin-only unlock', 'Visual indicators', 'Audit trail'],
  },
  // ── Story ──────────────────────────────────────────────────
  {
    id: 'beat-sheet',
    icon: '🥁',
    name: 'Beat Sheet',
    tagline: 'Classic story structure tools',
    category: 'Story',
    description: 'Build beat sheets based on popular story structures — Save the Cat, Three-Act, Hero\'s Journey, and more. Drag beats to reorder.',
    bullets: ['Multiple structures', 'Draggable beats', 'Story notes', 'Act markers'],
  },
  {
    id: 'arc-planner',
    icon: '🌈',
    name: 'Arc Planner',
    tagline: 'Multi-episode arc mapping',
    category: 'Story',
    description: 'Map character and story arcs across episodes in a visual timeline. Connect beats to scenes and track thematic throughlines.',
    bullets: ['Episode timeline', 'Character arcs', 'Thematic connections', 'Visual grid'],
    pro: true,
  },
  {
    id: 'treatment',
    icon: '📄',
    name: 'Treatment Builder',
    tagline: 'From idea to sell document',
    category: 'Story',
    description: 'Build a professional treatment document with logline, synopsis, character bios, and format notes. Export to PDF or share online.',
    bullets: ['Logline builder', 'Full synopsis', 'Character bios', 'PDF export'],
  },
  {
    id: 'corkboard',
    icon: '📌',
    name: 'Corkboard',
    tagline: 'Visual scene cards',
    category: 'Story',
    description: 'See your script as scene cards on a corkboard. Drag to reorder, add color labels, and write synopses per card.',
    bullets: ['Scene card view', 'Drag reorder', 'Color labels', 'Synopsis notes'],
  },
  {
    id: 'mindmap',
    icon: '🕸️',
    name: 'Mind Map',
    tagline: 'Branching story exploration',
    category: 'Story',
    description: 'Explore story ideas in a free-form mind map. Create themes, subplots, and character connections with visual nodes.',
    bullets: ['Free-form nodes', 'Color grouping', 'Subplots', 'Export as image'],
  },
  {
    id: 'moodboard',
    icon: '🎨',
    name: 'Mood Board',
    tagline: 'Visual tone & reference',
    category: 'Story',
    description: 'Collect visual references, color palettes, and tone images on a shareable mood board for each project.',
    bullets: ['Image collection', 'Color palettes', 'Shareable link', 'Tags'],
  },
  {
    id: 'ideas',
    icon: '💡',
    name: 'Ideas Board',
    tagline: 'Capture everything',
    category: 'Story',
    description: 'A fast-capture idea board for jotting down story ideas, dialogue snippets, and research notes. Never lose a thought.',
    bullets: ['Quick capture', 'Rich text', 'Categories', 'Search'],
  },
  {
    id: 'one-liner',
    icon: '📊',
    name: 'One-Liner',
    tagline: 'Auto-generated breakdown',
    category: 'Story',
    description: 'Generate a one-liner breakdown from your script automatically — lists every scene with location, day/night, and cast.',
    bullets: ['Auto-generated', 'PDF export', 'Filterable', 'Scene notes'],
  },
  // ── Characters ──────────────────────────────────────────────
  {
    id: 'character-profiles',
    icon: '🧑‍🎨',
    name: 'Character Profiles',
    tagline: 'Deep character development',
    category: 'Characters',
    description: 'Full character profile sheets with photo, biography, backstory, arc, and psychological notes. Link characters to scenes.',
    bullets: ['Photo gallery', 'Arc tracking', 'Scene links', 'Custom fields'],
  },
  {
    id: 'casting',
    icon: '🎭',
    name: 'Casting',
    tagline: 'Cast and track actors',
    category: 'Characters',
    description: 'Assign real actors to characters, track audition status, and manage callbacks. Full casting workflow in one place.',
    bullets: ['Actor database', 'Audition status', 'Callbacks', 'Photo management'],
  },
  {
    id: 'voice-cast',
    icon: '🎤',
    name: 'Voice Cast',
    tagline: 'Voice acting management',
    category: 'Characters',
    description: 'Manage voice acting cast separately from on-screen talent. Includes recording notes and studio session scheduling.',
    bullets: ['Separate from cast', 'Recording notes', 'Session scheduling', 'Delivery tracking'],
  },
  {
    id: 'ensemble',
    icon: '👥',
    name: 'Ensemble View',
    tagline: 'The full cast at a glance',
    category: 'Characters',
    description: 'See every character and their actor assignment in a visual grid. Filter by episode, day, or scene.',
    bullets: ['Visual grid', 'Episode filter', 'Scene presence', 'Quick edit'],
  },
  {
    id: 'visual-references',
    icon: '🖼️',
    name: 'Visual References',
    tagline: 'Character look boards',
    category: 'Characters',
    description: 'Build visual look-books for each character — costume references, hair, make-up, and on-screen style guides.',
    bullets: ['Look-book builder', 'Costume refs', 'Shareable', 'Notes per image'],
    new: true,
  },
  // ── Production ──────────────────────────────────────────────
  {
    id: 'breakdown',
    icon: '📑',
    name: 'Scene Breakdown',
    tagline: 'Every element, every scene',
    category: 'Production',
    description: 'Full production breakdown sheets per scene — cast, extras, props, wardrobe, vehicles, special FX, and custom categories.',
    bullets: ['Standard Elements', 'Custom categories', 'Day/night tracking', 'PDF export'],
  },
  {
    id: 'schedule',
    icon: '📅',
    name: 'Shoot Schedule',
    tagline: 'Day-by-day planning',
    category: 'Production',
    description: 'Drag scene strips onto shooting days, set wrap times, and export a full shooting schedule as a PDF.',
    bullets: ['Drag strips', 'Wrap times', 'PDF export', 'Calendar view'],
  },
  {
    id: 'call-sheet',
    icon: '📞',
    name: 'Call Sheets',
    tagline: 'Professional daily call sheets',
    category: 'Production',
    description: 'Generate professional call sheets with individual call times, map links, weather, and crew contact details. Send via email.',
    bullets: ['Individual call times', 'Map integration', 'Weather block', 'Email distribution'],
  },
  {
    id: 'budget',
    icon: '💰',
    name: 'Budget Tracker',
    tagline: 'Complete production budgeting',
    category: 'Production',
    description: 'Track above-the-line and below-the-line costs with departmental categories, actuals vs estimated, and variance flagging.',
    bullets: ['Dept. categories', 'ATL / BTL split', 'Variances', 'Summary PDF'],
    pro: true,
  },
  {
    id: 'shot-list',
    icon: '🎯',
    name: 'Shot List',
    tagline: 'Every shot, planned',
    category: 'Production',
    description: 'Build a full shot list with shot type, lens, movement, and notes. Link shots to scenes and storyboard frames.',
    bullets: ['Shot types', 'Lens notes', 'Camera movement', 'Scene links'],
  },
  {
    id: 'storyboard',
    icon: '🎞️',
    name: 'Storyboard',
    tagline: 'Visualize before you shoot',
    category: 'Production',
    description: 'Draw storyboard panels with a built-in drawing canvas, or upload images. Sequence panels per scene.',
    bullets: ['Drawing canvas', 'Image upload', 'Panel sequencing', 'PDF export'],
  },
  {
    id: 'locations',
    icon: '📍',
    name: 'Locations Database',
    tagline: 'Every location, tracked',
    category: 'Production',
    description: 'Full location profiles with address, photos, permit status, notes, and nearest hospital. Link to scenes.',
    bullets: ['Photo gallery', 'Permit tracking', 'Safety notes', 'Scene links'],
  },
  {
    id: 'gear',
    icon: '🎛️',
    name: 'Gear Management',
    tagline: 'Equipment tracking',
    category: 'Production',
    description: 'Inventory your production equipment by department. Track quantities, serial numbers, and assignment to shooting days.',
    bullets: ['Dept. categories', 'Serial numbers', 'Day assignment', 'PDF list'],
  },
  {
    id: 'crew',
    icon: '🧑‍🔧',
    name: 'Crew Management',
    tagline: 'Full roster control',
    category: 'Production',
    description: 'Manage your full crew roster with department, role, contact info, and daily rates. Integrates with call sheets.',
    bullets: ['Dept. grouping', 'Daily rates', 'Contact info', 'Call sheet sync'],
  },
  {
    id: 'dood',
    icon: '📆',
    name: 'DOOD',
    tagline: 'Day-out-of-days report',
    category: 'Production',
    description: 'Auto-generated day-out-of-days grid from your schedule. Shows which cast are working on each shooting day.',
    bullets: ['Auto-generated', 'Cast grid', 'Start/finish flags', 'PDF export'],
  },
  {
    id: 'safety-plan',
    icon: '🦺',
    name: 'Safety Plan',
    tagline: 'On-set safety management',
    category: 'Production',
    description: 'Document safety protocols, emergency contacts, hospital routes, and hazard assessments for every shooting day.',
    bullets: ['Hazard assessment', 'Emergency contacts', 'Hospital routing', 'PDF report'],
  },
  {
    id: 'checklist',
    icon: '✅',
    name: 'Production Checklist',
    tagline: 'Nothing slips through',
    category: 'Production',
    description: 'Customizable checklist templates for pre-production milestones. Assign tasks to team members and track completion.',
    bullets: ['Custom templates', 'Task assignment', 'Progress tracking', 'Due dates'],
  },
  {
    id: 'press-kit',
    icon: '🗂️',
    name: 'Press Kit',
    tagline: 'Ready-to-share media kit',
    category: 'Production',
    description: 'Auto-generate a polished press kit from your project data — synopsis, bios, photography, and technical specs.',
    bullets: ['Auto-generated', 'Photo management', 'Technical specs', 'Shareable link'],
  },
  // ── Broadcast ──────────────────────────────────────────────
  {
    id: 'rundown',
    icon: '📻',
    name: 'Rundown Editor',
    tagline: 'Live broadcast planning',
    category: 'Broadcast',
    description: 'Build and run live broadcast rundowns with segment timing, presenter assignments, and real-time clock.',
    bullets: ['Segment timing', 'Live clock', 'Cue integration', 'PDF print'],
  },
  {
    id: 'teleprompter',
    icon: '📺',
    name: 'Teleprompter',
    tagline: 'Integrated presenter scroll',
    category: 'Broadcast',
    description: 'Full-screen teleprompter mode with variable speed, font size, and mirroring. Works on any device.',
    bullets: ['Variable speed', 'Mirror mode', 'Font scale', 'Remote control'],
  },
  {
    id: 'graphics',
    icon: '🖥️',
    name: 'Graphics Manager',
    tagline: 'CG / lower thirds control',
    category: 'Broadcast',
    description: 'Manage on-screen graphics, lower thirds, and full-screen bumpers. Preview before taking to air.',
    bullets: ['Lower thirds', 'Full-screen CG', 'Preview pane', 'Template system'],
    pro: true,
  },
  {
    id: 'as-run',
    icon: '📋',
    name: 'As-Run Log',
    tagline: 'Post-broadcast record',
    category: 'Broadcast',
    description: 'Log what actually aired — actual times, substitutions, and edits vs the planned rundown. Exportable compliance report.',
    bullets: ['Timing actuals', 'Substitution notes', 'Compliance PDF', 'Compare to plan'],
  },
  {
    id: 'vision-mixer',
    icon: '🎚️',
    name: 'Vision Mixer Control',
    tagline: 'Switcher integration',
    category: 'Broadcast',
    description: 'Real-time vision mixer control panel with source routing, transition types, and take cues from the rundown.',
    bullets: ['Source routing', 'Transitions', 'Rundown cues', 'Tally indicators'],
    pro: true,
  },
  {
    id: 'comms',
    icon: '🎧',
    name: 'Intercom',
    tagline: 'Production talkback',
    category: 'Broadcast',
    description: 'Browser-based production intercom with channel groups, private lines, and programme feed monitoring.',
    bullets: ['Channel groups', 'Private lines', 'Programme feed', 'WebRTC'],
    pro: true,
  },
  {
    id: 'multiviewer',
    icon: '🖼️',
    name: 'Multiviewer',
    tagline: 'All sources on one screen',
    category: 'Broadcast',
    description: 'Configurable grid multiviewer showing all input sources simultaneously. Labels, UMDs, and audio meters included.',
    bullets: ['Configurable grid', 'UMD labels', 'Audio meters', 'Fullscreen'],
    pro: true,
  },
  {
    id: 'wire-desk',
    icon: '📡',
    name: 'Wire Desk',
    tagline: 'Automated news wire',
    category: 'Broadcast',
    description: 'Ingest RSS and wire feeds directly into your project. Stories populate your rundown in one click.',
    bullets: ['RSS ingest', 'Auto-populate', 'Story tagging', 'Archive'],
    pro: true,
  },
  // ── Collaboration ──────────────────────────────────────────────
  {
    id: 'realtime-collab',
    icon: '⚡',
    name: 'Live Collaboration',
    tagline: 'Write together in real time',
    category: 'Collaboration',
    description: 'Multiple writers on the same script simultaneously. Cursor presence, conflict resolution, and live sync — zero lag.',
    bullets: ['Multi-cursor', 'Conflict-free', 'Presence avatars', 'Zero lag'],
    pro: true,
  },
  {
    id: 'project-team',
    icon: '👔',
    name: 'Team & Roles',
    tagline: 'Granular access control',
    category: 'Collaboration',
    description: 'Five permission tiers: Owner, Admin, Writer, Editor, and Viewer. Invite collaborators by email or share link.',
    bullets: ['5 role tiers', 'Invite by email', 'Share links', 'Per-page access'],
  },
  {
    id: 'project-chat',
    icon: '💬',
    name: 'Project Chat',
    tagline: 'Team chat inside every project',
    category: 'Collaboration',
    description: 'A dedicated chat channel per project. No need for external tools — keep production communication in context.',
    bullets: ['Per-project', 'Real-time', 'File sharing', 'Persistent history'],
  },
  {
    id: 'messages',
    icon: '✉️',
    name: 'Direct Messages',
    tagline: 'Platform-wide DMs',
    category: 'Collaboration',
    description: 'Private 1-to-1 and group direct messages between any platform users. Persistent, searchable history.',
    bullets: ['1-to-1 DMs', 'Group threads', 'Searchable', 'Read receipts'],
  },
  {
    id: 'company',
    icon: '🏢',
    name: 'Company Profiles',
    tagline: 'Studio & production company hub',
    category: 'Collaboration',
    description: 'Create a company profile page for your studio with branding, a team directory, portfolio of projects, and blog.',
    bullets: ['Branding', 'Team directory', 'Portfolio', 'Company blog'],
  },
  {
    id: 'comments',
    icon: '💭',
    name: 'Inline Comments',
    tagline: 'Script and document notes',
    category: 'Collaboration',
    description: 'Leave inline comments on specific script lines or document paragraphs. Thread replies and resolve when done.',
    bullets: ['Inline anchoring', 'Threaded replies', 'Resolve flow', 'Notification on reply'],
  },
  // ── Community ──────────────────────────────────────────────
  {
    id: 'community-forum',
    icon: '🌐',
    name: 'Community Forum',
    tagline: 'Writers helping writers',
    category: 'Community',
    description: 'The public community hub — post questions, share work, get feedback, and connect with writers around the world.',
    bullets: ['Categorised posts', 'Upvotes', 'Rich text', 'Mentions'],
  },
  {
    id: 'showcase',
    icon: '🏆',
    name: 'Script Showcase',
    tagline: 'Publish your work to the world',
    category: 'Community',
    description: 'Make your project public on the Showcase — full details, cast list, credits, moodboard, and community reviews.',
    bullets: ['Public page', 'Reviews', 'Cast & credits', 'Moodboard'],
  },
  {
    id: 'free-scripts',
    icon: '📚',
    name: 'Free Scripts Library',
    tagline: 'Share and download scripts',
    category: 'Community',
    description: 'A library of scripts shared for free by the community — download, learn from them, and contribute your own.',
    bullets: ['Free download', 'Author credits', 'Genres', 'Community ratings'],
  },
  {
    id: 'challenges',
    icon: '⚔️',
    name: 'Writing Challenges',
    tagline: 'Themed competition events',
    category: 'Community',
    description: 'Regular themed writing challenges with rules, deadlines, and judging. Win badges and XP, and get your work seen.',
    bullets: ['Themed prompts', 'Deadlines', 'Judging', 'XP prizes'],
  },
  {
    id: 'accountability',
    icon: '🤝',
    name: 'Accountability Groups',
    tagline: 'Write more, together',
    category: 'Community',
    description: 'Join small accountability groups with a writing goal, progress tracking, and weekly check-ins. Keep each other on track.',
    bullets: ['Goal setting', 'Progress check-ins', 'Group feed', 'Weekly streaks'],
  },
  {
    id: 'blog',
    icon: '✏️',
    name: 'Blog Platform',
    tagline: 'Publish long-form content',
    category: 'Community',
    description: 'Full blog platform for companies and power users. Publish articles, tutorials, and behind-the-scenes content.',
    bullets: ['Rich text editor', 'Cover images', 'SEO metadata', 'Comments'],
  },
  // ── Analytics ──────────────────────────────────────────────
  {
    id: 'analytics',
    icon: '📈',
    name: 'Project Analytics',
    tagline: 'Data on your entire project',
    category: 'Analytics',
    description: 'Detailed analytics per project — writing velocity, scene length distribution, character page presence, and team activity.',
    bullets: ['Writing velocity', 'Scene distribution', 'Team activity', 'Word trends'],
    pro: true,
  },
  {
    id: 'ai-analysis',
    icon: '🤖',
    name: 'AI Script Analysis',
    tagline: 'Automated script notes',
    category: 'Analytics',
    description: 'AI-powered script analysis that identifies pacing issues, character arc gaps, and dialogue imbalances.',
    bullets: ['Pacing analysis', 'Arc detection', 'Dialogue stats', 'Actionable notes'],
    pro: true,
    new: true,
  },
  {
    id: 'notes-rounds',
    icon: '🗒️',
    name: 'Notes & Rounds',
    tagline: 'Track every round of feedback',
    category: 'Analytics',
    description: 'Structured notes rounds per draft. Record who gave notes, on which pages, and mark as addressed.',
    bullets: ['Per-draft rounds', 'Page references', 'Address tracking', 'Collaborator notes'],
  },
  // ── Platform ──────────────────────────────────────────────
  {
    id: 'xp-gamification',
    icon: '🎮',
    name: 'XP & Gamification',
    tagline: 'Level up as you write',
    category: 'Platform',
    description: 'Earn XP for writing, collaborating, and engaging with the community. Level up and unlock badges as you go.',
    bullets: ['XP for actions', 'Levels', 'Leaderboard', 'Daily streaks'],
  },
  {
    id: 'badges',
    icon: '🥇',
    name: 'Badges & Achievements',
    tagline: 'Milestones worth celebrating',
    category: 'Platform',
    description: 'Over 50 unique badges earned by hitting milestones — first script, first collaboration, challenge winner, and more.',
    bullets: ['50+ badges', 'Visible on profile', 'Rare badges', 'Badge notifications'],
  },
  {
    id: 'command-palette',
    icon: '⌨️',
    name: 'Command Palette',
    tagline: 'Keyboard-first navigation',
    category: 'Platform',
    description: 'A powerful command palette (⌘K) for instant navigation, search, and action execution across the entire platform.',
    bullets: ['⌘K shortcut', 'Global search', 'Action commands', 'Recent items'],
  },
  {
    id: 'pwa',
    icon: '📱',
    name: 'PWA / App',
    tagline: 'Install as a native-like app',
    category: 'Platform',
    description: 'Install Screenplay Studio as a PWA on desktop or mobile. Works offline for script reading and note-taking.',
    bullets: ['Install on any OS', 'Offline reading', 'Push notifications', 'Home screen icon'],
  },
  {
    id: 'notifications',
    icon: '🔔',
    name: 'Real-time Notifications',
    tagline: 'Never miss something important',
    category: 'Platform',
    description: 'Real-time notifications for comments, mentions, invites, and community interactions. Browser push support.',
    bullets: ['In-app bell', 'Push notifications', 'Email fallback', 'Notification centre'],
  },
  {
    id: 'feedback',
    icon: '💌',
    name: 'Feedback Board',
    tagline: 'Shape the product',
    category: 'Platform',
    description: 'A public feedback board for feature requests and bug reports. Vote on requests, follow updates, and see what\'s shipping next.',
    bullets: ['Feature requests', 'Bug reports', 'Voting', 'Status updates'],
  },
  {
    id: 'changelog',
    icon: '🚀',
    name: 'Changelog',
    tagline: 'What\'s new, always',
    category: 'Platform',
    description: 'A public changelog with every release, categorised improvements, and a version history going back to launch.',
    bullets: ['Every release', 'Categories', 'Version archive', 'RSS feed'],
  },
  {
    id: 'dark-mode',
    icon: '🌙',
    name: 'Dark UI',
    tagline: 'Built for long writing sessions',
    category: 'Platform',
    description: 'The entire platform is designed in a carefully crafted dark theme that reduces eye strain for long writing sessions.',
    bullets: ['True dark mode', 'Low eye strain', 'Consistent design', 'Customisable accents'],
  },
  {
    id: 'pro',
    icon: '⭐',
    name: 'Pro Subscription',
    tagline: 'Power up your workflow',
    category: 'Platform',
    description: 'The Pro tier unlocks unlimited projects, real-time collaboration, advanced analytics, broadcast tools, and priority support.',
    bullets: ['Unlimited projects', 'All features', 'Priority support', 'Early access'],
    pro: true,
  },
];

const ALL_CATEGORIES = ['All', ...Array.from(new Set(FEATURES.map(f => f.category)))] as (Category | 'All')[];

// ── Feature card ───────────────────────────────────────────────────────────
function FeatureCard({ feature, expanded, onExpand }: { feature: Feature; expanded: boolean; onExpand: (id: string | null) => void }) {
  return (
    <motion.div
      layout
      layoutId={`card-${feature.id}`}
      style={{
        gridColumn: expanded ? 'span 2' : 'span 1',
        gridRow: expanded ? 'span 2' : 'span 1',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
      onMouseEnter={() => onExpand(feature.id)}
      onMouseLeave={() => onExpand(null)}
      className={cn('group relative cursor-default overflow-hidden', expanded ? 'z-10' : 'z-0')}
      transition={{ layout: { type: 'spring', stiffness: 380, damping: 35 } }}
    >
      {/* Orange left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-200 z-10"
        style={{ background: '#FF5F1F' }}
      />

      {/* Badges */}
      <div className="absolute top-2.5 right-2.5 flex gap-1 z-10">
        {feature.new && (
          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 border border-white/[0.08] text-white/30">New</span>
        )}
        {feature.pro && (
          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 border border-white/[0.08] text-white/30">Pro</span>
        )}
      </div>

      {/* Content */}
      <div className={cn('p-5 h-full flex flex-col transition-colors duration-150', expanded ? 'bg-white/[0.025]' : 'group-hover:bg-white/[0.018]')}>
        <div className="mb-auto">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-white/50 group-hover:text-white transition-colors duration-150 leading-tight">{feature.name}</p>
          <p className="text-[11px] text-white/22 mt-0.5 leading-snug group-hover:text-white/40 transition-colors duration-150">{feature.tagline}</p>
        </div>

        {/* Expanded content */}
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.08, duration: 0.2 }}
            className="mt-3 space-y-2"
          >
            <p className="text-[11px] text-white/40 leading-relaxed">{feature.description}</p>
            {feature.bullets && (
              <ul className="space-y-1">
                {feature.bullets.map(b => (
                  <li key={b} className="flex items-center gap-1.5 text-[10px] text-white/30">
                    <div className="w-0.5 h-0.5 bg-white/30 rounded-full shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}

        {/* Category label */}
        <div className="mt-3">
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/15">{feature.category}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function DevFeaturesPage() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');

  const filtered = activeCategory === 'All'
    ? FEATURES
    : FEATURES.filter(f => f.category === activeCategory);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">What Screenplay Studio does</h1>
        <p className="text-white/40 text-base max-w-xl">
          Every feature, every tool — from the script editor to live broadcast. Hover any card to learn more.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5 mb-8 items-center">
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition-all border',
              activeCategory === cat
                ? 'border-white/20 text-white bg-white/[0.06]'
                : 'border-white/[0.07] text-white/30 hover:text-white/60 hover:border-white/15'
            )}
          >
            {cat}
          </button>
        ))}
        <span className="ml-auto text-[10px] font-mono text-white/20">{filtered.length} features</span>
      </div>

      {/* Grid */}
      <LayoutGroup>
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gridAutoRows: '160px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {filtered.map(f => (
            <FeatureCard
              key={f.id}
              feature={f}
              expanded={hoveredId === f.id}
              onExpand={setHoveredId}
            />
          ))}
        </div>
      </LayoutGroup>

      <div className="mt-12 pt-6 border-t border-white/[0.06] flex items-center gap-6">
        <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest">{FEATURES.length} features · hover to expand</p>
      </div>
    </div>
  );
}
