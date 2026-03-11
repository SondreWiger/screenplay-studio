'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { UsageIntent } from '@/lib/types';

// ============================================================
// GuidedTour — persona-aware interactive walkthrough
//
// Shown after onboarding. Steps are tailored to the user's
// declared usage intent (writer, producer, content_creator, etc.)
//
// Each step: eyebrow  /  illustrated icon  /  title  /  description
//            numbered how-to tips  /  "Try it →" CTA
// ============================================================

interface TourStep {
  type?: 'info' | 'spotlight';
  targetId?: string;
  icon: React.ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  tips?: string[];
  primaryLabel: string;
  primaryHref?: string;
  accentColor?: string;
}

function buildSteps(intent: UsageIntent, projectId: string | null): TourStep[] {
  const link = (path: string) => projectId ? `/projects/${projectId}/${path}` : '/dashboard';

  const welcome: TourStep = {
    type: 'info',
    icon: <WelcomeIllustration />,
    title: 'Welcome to Screenplay Studio',
    description: "We've set up your workspace based on your answers. Here's a quick look at the features that matter most for YOUR workflow — tailored just for you.",
    primaryLabel: "Let's go →",
    accentColor: '#FF5F1F',
  };

  // ── WRITER ─────────────────────────────────────────────────────
  if (intent === 'writer') return [
    welcome,
    {
      type: 'info',
      eyebrow: 'Step 1 of 5  •  Writing',
      icon: <FeatureIcon color="#FF5F1F" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
      title: 'The Script Editor',
      description: 'Auto-formats to industry standard as you type — scene headings, action, dialogue, transitions — all handled automatically. Your work saves every keystroke.',
      tips: [
        'Tab / Shift+Tab cycles element types: Int/Ext → Action → Character → Dialogue',
        "Character names you've added autocomplete as you type",
        '⌘+K opens the scene jumper to navigate by number or heading',
        'Inline title page editing at the top — click any field to edit in place',
        'Page count and word count live in the toolbar',
      ],
      primaryLabel: 'Open the Script Editor →',
      primaryHref: link('script'),
      accentColor: '#FF5F1F',
    },
    {
      type: 'info',
      eyebrow: 'Step 2 of 5  •  Development',
      icon: <FeatureIcon color="#f59e0b" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
      title: 'Ideas Board — zero-friction capture',
      description: "Half-formed thoughts? That B-plot you can't shake? Drop them here. Ideas stay linked to your project and never disrupt your writing flow.",
      tips: [
        'Hit the + button (or press I from anywhere) to capture instantly',
        'Tag ideas by type: dialogue, visual, scene moment, theme, reference',
        'Drag ideas onto scenes or characters to link them',
        "Search your ideas when you're stuck — the answer is often already there",
      ],
      primaryLabel: 'See the Ideas Board →',
      primaryHref: link('ideas'),
      accentColor: '#f59e0b',
    },
    {
      type: 'info',
      eyebrow: 'Step 3 of 5  •  World Building',
      icon: <FeatureIcon color="#8b5cf6" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
      title: 'Characters & Locations',
      description: 'Build full character bibles — want, need, wound, arc, relationships. Every name in your script auto-links to their profile.',
      tips: [
        'Each character gets a personality profile, arc summary, and relationship map',
        'Character names in the script link directly to their profile page',
        'Locations can have photos, scout notes, and address for the call sheet',
        'The Mind Map shows all characters and their relationships visually',
      ],
      primaryLabel: 'Build your cast →',
      primaryHref: link('characters'),
      accentColor: '#8b5cf6',
    },
    {
      type: 'info',
      eyebrow: 'Step 4 of 5  •  Structure',
      icon: <FeatureIcon color="#10b981" d="M13 10V3L4 14h7v7l9-11h-7z" />,
      title: 'Arc Planner & Beat Sheet',
      description: "Plan your structure before writing — or use it as a diagnostic when you're stuck. Supports Three-act, Hero's Journey, Save the Cat, and custom.",
      tips: [
        'Arc Planner = story beats as visual blocks on a timeline. Drag to resize.',
        'Beat Sheet = the 15 key moments every great script should hit',
        'Load a known structure template and map your own story onto it',
        'Export your arc as a visual summary for pitch documents',
      ],
      primaryLabel: 'Open the Arc Planner →',
      primaryHref: link('arc-planner'),
      accentColor: '#10b981',
    },
    {
      type: 'info',
      eyebrow: 'Step 5 of 5  •  Submitting',
      icon: <FeatureIcon color="#3b82f6" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
      title: 'Submission Tracker',
      description: 'Track every agent query, producer meeting, and festival application in one place. Know exactly where your script stands at any moment.',
      tips: [
        'Log submissions: recipient, date, type, status, deadline, notes',
        'Status flow: Pending → Request → Offer → Accepted ✨ (or Passed / Withdrawn)',
        'Filter by status to see your full submission pipeline at a glance',
        'We celebrate with you when a submission goes Accepted 🎉',
      ],
      primaryLabel: "You're ready — start writing! →",
      primaryHref: projectId ? `/projects/${projectId}` : '/dashboard',
      accentColor: '#3b82f6',
    },
  ];

  // ── PRODUCER ───────────────────────────────────────────────────
  if (intent === 'producer') return [
    welcome,
    {
      type: 'info',
      eyebrow: 'Step 1 of 5  •  Breakdown',
      icon: <FeatureIcon color="#FF5F1F" d="M3 10h18M3 14h18M10 4v16M6 4v4M18 4v4" />,
      title: 'Production Breakdown',
      description: 'Tag every scene element — cast, extras, vehicles, props, VFX, stunts. Breakdown data feeds directly into your budget and schedule.',
      tips: [
        'Open any scene and add breakdown tags per element category',
        'Tagged elements automatically populate budget line items',
        'Run a breakdown report per department for prep meetings',
        'Mark scenes as locked once breakdowns are approved',
        'Filter by any element to see all scenes that require it',
      ],
      primaryLabel: 'Open the Breakdown →',
      primaryHref: link('breakdown'),
      accentColor: '#FF5F1F',
    },
    {
      type: 'info',
      eyebrow: 'Step 2 of 5  •  Scheduling',
      icon: <FeatureIcon color="#f59e0b" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
      title: 'Schedule & Day Out of Days',
      description: "Drag scenes onto shoot days. Conflict detection flags character clashes and location double-ups in real time.",
      tips: [
        'Unscheduled scenes live in the left column — drag into a shoot day',
        'Red conflict badges appear instantly when a character or location is double-booked',
        'Day Out of Days generates in one click from your schedule',
        'Export schedule to PDF for your AD and department heads',
        'Lock days to prevent accidental changes once approved',
      ],
      primaryLabel: 'Open the Schedule →',
      primaryHref: link('schedule'),
      accentColor: '#f59e0b',
    },
    {
      type: 'info',
      eyebrow: 'Step 3 of 5  •  Budget',
      icon: <FeatureIcon color="#10b981" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      title: 'Budget Tracker',
      description: 'Itemised budget by department. Track estimated vs actual. Set a cap and the system warns you when you approach it.',
      tips: [
        'Breakdown tags auto-populate budget line items — zero double entry',
        'Department totals roll up into a project total automatically',
        'Actual vs estimated columns for live spend tracking on set',
        'Export to PDF or spreadsheet for finance approval',
      ],
      primaryLabel: 'Open the Budget →',
      primaryHref: link('budget'),
      accentColor: '#10b981',
    },
    {
      type: 'info',
      eyebrow: 'Step 4 of 5  •  On Set',
      icon: <FeatureIcon color="#8b5cf6" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
      title: 'Call Sheets & Day Pack',
      description: 'One-click call sheet generation from your schedule — cast, crew, location, times, notes. The Day Pack bundles everything for a single shoot day.',
      tips: [
        'Call sheets pull cast and crew contacts from your Team page',
        'Customise sections: weather, map, parking, COVID/safety notes',
        'Share via link or PDF — recipients need no account to view',
        'Day Pack includes the call sheet, one-liner, safety plan, and notes',
      ],
      primaryLabel: 'Generate a Call Sheet →',
      primaryHref: link('call-sheet'),
      accentColor: '#8b5cf6',
    },
    {
      type: 'info',
      eyebrow: 'Step 5 of 5  •  Team',
      icon: <FeatureIcon color="#3b82f6" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
      title: 'Team, Crew & Roles',
      description: 'Invite collaborators by email. Granular roles control exactly what each person can see, edit, and do.',
      tips: [
        'Owner → Admin → Writer → Editor → Viewer — five permission tiers',
        "Viewers can read everything but change nothing — great for investors",
        "Real-time presence shows who's online and on which page right now",
        'Team chat is built in — no Slack needed for small crews',
      ],
      primaryLabel: "Let's build this production! →",
      primaryHref: projectId ? `/projects/${projectId}` : '/dashboard',
      accentColor: '#3b82f6',
    },
  ];

  // ── CONTENT CREATOR ────────────────────────────────────────────
  if (intent === 'content_creator') return [
    welcome,
    {
      type: 'info',
      eyebrow: 'Step 1 of 5  •  Writing',
      icon: <FeatureIcon color="#FF5F1F" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
      title: 'Script Editor for Video',
      description: "Write your videos in sections — hook, intro, main content, CTA, B-roll notes. Format for speaking, not stage directions.",
      tips: [
        'Use Scene Headings for video sections (HOOK, INTRO, MAIN CONTENT, CTA)',
        "Action lines = what's on screen; Dialogue = what you're saying",
        "Write B-roll notes in parentheticals inside your main narration",
        'Word/page count estimates your video length as you write',
      ],
      primaryLabel: 'Open the Script Editor →',
      primaryHref: link('script'),
      accentColor: '#FF5F1F',
    },
    {
      type: 'info',
      eyebrow: 'Step 2 of 5  •  Ideas',
      icon: <FeatureIcon color="#f59e0b" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
      title: 'Ideas Board — your content pipeline',
      description: 'Never lose a video idea again. Store concepts, reference videos, titles, hooks, thumbnail ideas — all searchable and tagable.',
      tips: [
        'Drop TikTok or YouTube URLs as inspiration references',
        'Tag by content type: tutorial, vlog, reaction, explainer, short',
        'Move ideas to "In Development" when you start scripting them',
        'Star your best ideas so they surface when you need them',
      ],
      primaryLabel: 'See your Ideas Board →',
      primaryHref: link('ideas'),
      accentColor: '#f59e0b',
    },
    {
      type: 'info',
      eyebrow: 'Step 3 of 5  •  Visual',
      icon: <FeatureIcon color="#8b5cf6" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
      title: 'Thumbnails & Storyboard',
      description: 'Plan your thumbnail concept before you film so your title, hook, and visual are all aligned.',
      tips: [
        'Upload inspiration screenshots to the Thumbnail board',
        'Note: text overlay concept, expression, colour scheme, focal point',
        'Plan it before filming so you capture the right shot on the day',
        'Link thumbnail concepts to specific script sections',
      ],
      primaryLabel: 'Plan your thumbnails →',
      primaryHref: link('thumbnails'),
      accentColor: '#8b5cf6',
    },
    {
      type: 'info',
      eyebrow: 'Step 4 of 5  •  Publishing',
      icon: <FeatureIcon color="#10b981" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
      title: 'SEO & Upload Checklist',
      description: "Write your title, description, tags, and chapters while the concept is fresh — before the editing rush. A checklist keeps every upload airtight.",
      tips: [
        "Draft the title and description here while you're writing the script",
        'Chapter timestamps map from your script section headings',
        'The checklist covers: script → film → edit → thumbnail → upload → promote',
        'Check steps in real time on upload day — nothing gets missed',
      ],
      primaryLabel: 'Open SEO & Metadata →',
      primaryHref: link('seo'),
      accentColor: '#10b981',
    },
    {
      type: 'info',
      eyebrow: 'Step 5 of 5  •  Growth',
      icon: <FeatureIcon color="#3b82f6" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
      title: 'Analytics & Sponsors',
      description: 'Track per-video performance and manage brand deals — without leaving your creative workspace.',
      tips: [
        'Analytics links to your published videos and tracks key metrics',
        'Sponsors page tracks deal terms, deliverables, and deadlines',
        'Link sponsor requirements to specific script sections',
        'Keep a record of rates and terms for future rate negotiations',
      ],
      primaryLabel: "Let's make great content! →",
      primaryHref: projectId ? `/projects/${projectId}` : '/dashboard',
      accentColor: '#3b82f6',
    },
  ];

  // ── STUDENT ────────────────────────────────────────────────────
  if (intent === 'student') return [
    welcome,
    {
      type: 'info',
      eyebrow: 'Step 1 of 5  •  Craft',
      icon: <FeatureIcon color="#FF5F1F" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
      title: 'Write like a pro from day one',
      description: 'Industry-standard formatting is built in — you cannot accidentally format incorrectly. The editor teaches correct spec format as you use it.',
      tips: [
        'Scene headings: INT. or EXT.  LOCATION — DAY or NIGHT',
        'Tab down the format chain: Heading → Action → Character → Dialogue',
        'Two Enters from a long dialogue block returns to Action',
        'Turn on "Formatting guide" in the toolbar for a reference while you learn',
        'Export to PDF anytime to see what your script looks like on the page',
      ],
      primaryLabel: 'Open the Script Editor →',
      primaryHref: link('script'),
      accentColor: '#FF5F1F',
    },
    {
      type: 'info',
      eyebrow: 'Step 2 of 5  •  Structure',
      icon: <FeatureIcon color="#10b981" d="M13 10V3L4 14h7v7l9-11h-7z" />,
      title: 'Learn structure by building it',
      description: "Story structure theory becomes tangible when you map your own script onto it. The Arc Planner makes abstract concepts visible.",
      tips: [
        "Start with Three-Act Structure — it's the foundation of almost everything",
        'Drag your own story beats onto the timeline to see where the pacing lands',
        'Compare your draft against a structure template to spot gaps',
        'The Beat Sheet (Save the Cat format) gives you the 15 moments to hit',
      ],
      primaryLabel: 'Open the Arc Planner →',
      primaryHref: link('arc-planner'),
      accentColor: '#10b981',
    },
    {
      type: 'info',
      eyebrow: 'Step 3 of 5  •  Characters',
      icon: <FeatureIcon color="#8b5cf6" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
      title: 'Write people, not placeholders',
      description: 'Great characters start with understanding who they are before the story begins. Build character bibles to make your writing deeper.',
      tips: [
        'Every character should have a WANT (external goal) and a NEED (internal truth)',
        'The Relationships tab maps how each character sees the others',
        'Character arcs show how they change from page 1 to the end',
        'Question: if your protagonist got what they WANTED, would they get what they NEED?',
      ],
      primaryLabel: 'Build your characters →',
      primaryHref: link('characters'),
      accentColor: '#8b5cf6',
    },
    {
      type: 'info',
      eyebrow: 'Step 4 of 5  •  Community',
      icon: <FeatureIcon color="#f59e0b" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />,
      title: 'Share and get better together',
      description: 'Share your work with the community for constructive feedback. Reading other scripts and giving notes is one of the fastest ways to improve.',
      tips: [
        'Showcase your project — choose what to make public (logline, treatment, script)',
        'Join a writing challenge — themed prompts with community feedback rounds',
        'Giving good notes to others sharpens your own analytical eye',
        'Your reputation and feedback history build over time',
      ],
      primaryLabel: 'See the community →',
      primaryHref: '/community',
      accentColor: '#f59e0b',
    },
    {
      type: 'info',
      eyebrow: 'Step 5 of 5  •  Habits',
      icon: <FeatureIcon color="#3b82f6" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
      title: 'Ideas Board + work tracking',
      description: "The best writers write consistently, not in bursts. The Ideas Board captures every thought. The work tracker rewards your sessions.",
      tips: [
        'Drop anything here: a line of dialogue, a visual, a reference, half an idea',
        'Rough fragments are fine — they grow into something eventually',
        "Look at your ideas board when you're stuck. The answer is usually already there.",
        'The work timer fires encouragement toasts at 1h, 2h, 3h milestones 🏆',
      ],
      primaryLabel: "You're set — start writing! →",
      primaryHref: projectId ? `/projects/${projectId}` : '/dashboard',
      accentColor: '#3b82f6',
    },
  ];

  // ── BOTH (Writer & Producer) ───────────────────────────────────
  return [
    welcome,
    {
      type: 'info',
      eyebrow: 'Step 1 of 5  •  Overview',
      icon: <FeatureIcon color="#FF5F1F" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />,
      title: 'From Script to Screen — the full pipeline',
      description: "You've got the complete toolkit. Development, writing, production planning, and delivery all live here — and every part connects back to your script.",
      tips: [
        'Sidebar organises tools by workflow phase: Write → Plan → On Set → Deliver',
        'Less-used tools land in "Other Tools" — pull them out when you need them',
        'The gear icon (bottom-left of sidebar) opens the Sidebar Customiser',
        'Pro features unlock: AI Analysis, Client Review, Advanced Export',
      ],
      primaryLabel: 'Open the script editor →',
      primaryHref: link('script'),
      accentColor: '#FF5F1F',
    },
    {
      type: 'info',
      eyebrow: 'Step 2 of 5  •  Development',
      icon: <FeatureIcon color="#10b981" d="M13 10V3L4 14h7v7l9-11h-7z" />,
      title: 'Development Tools',
      description: 'Arc Planner, Beat Sheet, Corkboard, Treatment, Notes Rounds — your whole development phase before production.',
      tips: [
        'Arc Planner: build your structure visually before writing a word',
        'Beat Sheet: map the 15 key story moments',
        'Notes Rounds: track each round of reader feedback with changes',
        'Treatment: auto-generates from your arc + scene list — great for pitches',
        'Corkboard: digital index cards for visual story arrangement',
      ],
      primaryLabel: 'Open the Arc Planner →',
      primaryHref: link('arc-planner'),
      accentColor: '#10b981',
    },
    {
      type: 'info',
      eyebrow: 'Step 3 of 5  •  Production',
      icon: <FeatureIcon color="#f59e0b" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
      title: 'Production Planning',
      description: 'Break down every scene, schedule shoot days, track budget, manage your crew. All connected directly to the script.',
      tips: [
        'The pipeline: Scenes → Breakdown → Schedule → Budget → Call Sheet',
        'Breakdown tags auto-populate budget line items (no double entry)',
        'Schedule conflict detection catches cast/location clashes instantly',
        'Day Pack bundles call sheet, one-liner, and safety plan for each shoot day',
      ],
      primaryLabel: 'Open the Schedule →',
      primaryHref: link('schedule'),
      accentColor: '#f59e0b',
    },
    {
      type: 'info',
      eyebrow: 'Step 4 of 5  •  Collaboration',
      icon: <FeatureIcon color="#8b5cf6" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
      title: 'Team & Collaboration',
      description: 'Invite collaborators with granular roles. Real-time presence. Built-in chat and comments.',
      tips: [
        'Five role tiers: Owner / Admin / Writer / Editor / Viewer',
        'Real-time presence shows who is on which page, live',
        'Built-in project chat — no external tools needed',
        'Client Review Portal (Pro) lets external stakeholders view without an account',
      ],
      primaryLabel: 'Invite your team →',
      primaryHref: link('team'),
      accentColor: '#8b5cf6',
    },
    {
      type: 'info',
      eyebrow: 'Step 5 of 5  •  Delivery',
      icon: <FeatureIcon color="#3b82f6" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
      title: 'Export & Deliver',
      description: "PDF, FDX, DOCX — plus a Share Portal, Press Kit, and Submission Tracker for getting your work out into the world.",
      tips: [
        'Advanced Export (Pro): PDF, FDX, DOCX, HTML in one click',
        'Share Portal: secure read-only link — no login needed for recipients',
        'Submission Tracker: logs every agent, producer, and festival approach',
        'Press Kit: formatted EPK generated from your project details automatically',
      ],
      primaryLabel: "Let's make something great! →",
      primaryHref: projectId ? `/projects/${projectId}` : '/dashboard',
      accentColor: '#3b82f6',
    },
  ];
}

// ── Illustration helpers ─────────────────────────────────────────────────────

function FeatureIcon({ color, d }: { color: string; d: string }) {
  return (
    <div
      className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
      style={{
        background: `linear-gradient(135deg, ${color}30, ${color}18)`,
        border: `1px solid ${color}40`,
        boxShadow: `0 0 40px ${color}1a`,
      }}
    >
      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      </svg>
    </div>
  );
}

function WelcomeIllustration() {
  return (
    <div className="relative w-24 h-24 mx-auto">
      <div className="absolute inset-0 rounded-full animate-ping opacity-15" style={{ background: '#FF5F1F' }} />
      <div
        className="relative w-24 h-24 rounded-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #FF5F1F, #E54E15)', boxShadow: '0 0 60px rgba(255,95,31,0.35)' }}
      >
        <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 12h6m-6 4h4" />
        </svg>
      </div>
    </div>
  );
}

// ── Spotlight overlay ────────────────────────────────────────────────────────

function SpotlightOverlay({ targetId, children }: { targetId: string; children: React.ReactNode }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour-id="${targetId}"]`);
      if (el) setRect(el.getBoundingClientRect());
      rafRef.current = requestAnimationFrame(measure);
    };
    rafRef.current = requestAnimationFrame(measure);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [targetId]);

  if (!rect) return <>{children}</>;

  const pad = 8;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;

  return (
    <>
      <svg
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 98, width: '100vw', height: '100vh' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={x} y={y} width={w} height={h} rx="10" fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask="url(#tour-mask)" />
        <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} rx="12" fill="none" stroke="#FF5F1F" strokeWidth="2" opacity="0.7" />
      </svg>
      {children}
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export interface GuidedTourProps {
  onComplete: () => void;
  usageIntent?: UsageIntent;
  projectId?: string | null;
}

export function GuidedTour({ onComplete, usageIntent = 'writer', projectId = null }: GuidedTourProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'exit' | 'enter'>('idle');

  const steps = buildSteps(usageIntent, projectId);
  const current = steps[Math.min(step, steps.length - 1)];

  const handleFinish = useCallback(() => {
    setPhase('exit');
    setTimeout(onComplete, 280);
  }, [onComplete]);

  const handlePrimary = useCallback(() => {
    if (current.primaryHref) {
      setPhase('exit');
      setTimeout(() => { onComplete(); router.push(current.primaryHref!); }, 250);
    } else if (step < steps.length - 1) {
      setPhase('enter');
      setTimeout(() => { setStep(s => s + 1); setPhase('idle'); }, 180);
    } else {
      handleFinish();
    }
  }, [current, step, steps.length, onComplete, router, handleFinish]);

  const handleBack = useCallback(() => {
    if (step === 0) return;
    setPhase('enter');
    setTimeout(() => { setStep(s => s - 1); setPhase('idle'); }, 180);
  }, [step]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleFinish();
      if (e.key === 'ArrowRight' && step < steps.length - 1 && !current.primaryHref) handlePrimary();
      if (e.key === 'ArrowLeft' && step > 0) handleBack();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, steps.length, current, handleFinish, handlePrimary, handleBack]);

  const isExiting = phase === 'exit';
  const isTransitioning = phase !== 'idle';
  const accent = current.accentColor ?? '#FF5F1F';

  const card = (
    <div
      className="fixed inset-0 z-[99] flex items-center justify-center"
      style={{ transition: 'opacity 0.28s', opacity: isExiting ? 0 : 1 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Card */}
      <div
        className={cn(
          'relative z-[101] w-full max-w-xl mx-4 bg-surface-900 border border-surface-700/60 rounded-2xl shadow-2xl overflow-hidden',
          'transition-all duration-[280ms]',
          isTransitioning ? 'scale-[0.96] opacity-0' : 'scale-100 opacity-100',
        )}
        style={{ boxShadow: `0 0 80px ${accent}1e` }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-surface-800/80">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%`, background: accent }}
          />
        </div>

        {/* Body */}
        <div className="px-8 pt-8 pb-5">
          {current.eyebrow && (
            <p className="text-[9px] font-black uppercase tracking-[0.22em] mb-5 text-center"
              style={{ color: accent }}>
              {current.eyebrow}
            </p>
          )}

          <div className="mb-6">{current.icon}</div>

          <h2 className="text-[1.3rem] font-black text-white mb-3 text-center leading-snug">
            {current.title}
          </h2>
          <p className="text-sm text-surface-400 leading-relaxed text-center max-w-[420px] mx-auto">
            {current.description}
          </p>

          {current.tips && current.tips.length > 0 && (
            <ul className="mt-6 space-y-2.5 text-left border-t border-surface-800 pt-5">
              {current.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-[13px] text-surface-300 leading-relaxed">
                  <span
                    className="mt-px w-5 h-5 min-w-[1.25rem] rounded-full flex items-center justify-center text-[9px] font-black"
                    style={{ background: `${accent}22`, color: accent }}
                  >
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-surface-800 px-6 py-4 flex items-center justify-between bg-surface-950/30">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => { setPhase('enter'); setTimeout(() => { setStep(i); setPhase('idle'); }, 180); }}
                className="rounded-full transition-all duration-300"
                style={{
                  height: '8px',
                  width: i === step ? '20px' : '8px',
                  background: i <= step ? accent : 'rgb(51 51 71)',
                  opacity: i < step ? 0.4 : 1,
                }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {step === 0 ? (
              <button
                onClick={handleFinish}
                className="text-xs text-surface-600 hover:text-surface-400 transition-colors"
              >
                Skip tour
              </button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleBack}>Back</Button>
            )}
            <button
              onClick={handlePrimary}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
              style={{ background: accent }}
            >
              {current.primaryHref
                ? current.primaryLabel
                : step < steps.length - 1
                  ? 'Next →'
                  : current.primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (current.type === 'spotlight' && current.targetId) {
    return <SpotlightOverlay targetId={current.targetId}>{card}</SpotlightOverlay>;
  }

  return card;
}
