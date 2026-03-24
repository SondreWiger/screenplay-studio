import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tutorials — Screenplay Studio',
  description: 'Learn how to use every feature in Screenplay Studio — from writing your first script to managing a full production.',
};

const ORANGE = '#FF5F1F';

function Rule() {
  return (
    <div className="max-w-screen-lg mx-auto px-6">
      <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/25 font-mono">
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-4 h-px shrink-0" style={{ background: ORANGE }} />
      <Label>{children}</Label>
    </div>
  );
}

/* ────────────────────────────────────────────────── */
/*  Feature tutorial cards                            */
/* ────────────────────────────────────────────────── */

interface Step {
  title: string;
  description: string;
}

interface TutorialSection {
  id: string;
  eyebrow: string;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  steps: Step[];
  tips?: string[];
  path?: string;
}

const TUTORIALS: TutorialSection[] = [
  {
    id: 'getting-started',
    eyebrow: 'Start Here',
    icon: '🚀',
    title: 'Getting Started',
    subtitle: 'Create your account and your first project in under a minute.',
    description: 'Screenplay Studio organises everything inside projects. Each project contains your script, characters, scenes, shots, budget, schedule — everything for one production.',
    steps: [
      { title: 'Create your account', description: 'Click "Start Free" on the homepage. Sign up with email or sign in with Google. No credit card needed, ever.' },
      { title: 'Create a new project', description: 'From the dashboard, click "+ New Project". Give it a name, pick your format (film, TV, stage, podcast, etc.), and you\'re in.' },
      { title: 'Explore the sidebar', description: 'Every tool lives in the left sidebar: Script, Characters, Scenes, Shots, Locations, Schedule, Budget, and more. Click any section to get started.' },
      { title: 'Invite your team', description: 'Open Project Settings → Team. Add collaborators by email and assign roles (Writer, Director, Producer, Crew). Everyone works in the same workspace.' },
    ],
    tips: ['You can create unlimited projects on the free plan.', 'Use the command palette (Ctrl/Cmd + K) to quickly jump between sections.'],
    path: '/dashboard',
  },
  {
    id: 'script-editor',
    eyebrow: 'Writing',
    icon: '✍️',
    title: 'The Script Editor',
    subtitle: 'Write with professional formatting — automatically.',
    description: 'The editor uses Courier Prime and formats your screenplay to industry standards. Scene headings, action lines, dialogue, parentheticals, and transitions — all handled for you.',
    steps: [
      { title: 'Open the Script tab', description: 'Navigate to your project and click "Script" in the sidebar. Your script opens in a full-screen editor.' },
      { title: 'Write naturally', description: 'Type your scene heading (INT./EXT.), press Enter for action, type a character name in CAPS for dialogue. The editor auto-detects element types.' },
      { title: 'Use keyboard shortcuts', description: 'Tab to cycle between element types (action → character → dialogue → parenthetical). Enter twice for a new scene heading.' },
      { title: 'Manage revisions', description: 'Every save creates a revision point. Open the revision history to compare drafts, restore earlier versions, or track changes over time.' },
    ],
    tips: ['The editor supports 7 script formats: Film, TV, Audio Drama, Stage, Podcast, Content, and Broadcast.', 'Export to PDF at any time with proper industry formatting.'],
  },
  {
    id: 'characters',
    eyebrow: 'Development',
    icon: '🎭',
    title: 'Character Bible',
    subtitle: 'Build deep, rich character profiles with everything you need.',
    description: 'The character bible stores backstory, personality, voice, relationships, visual references, and casting notes. Every character is linked back to the scenes they appear in.',
    steps: [
      { title: 'Add a character', description: 'Go to Characters in the sidebar. Click "+ Add Character". Fill in their name, description, and role in the story.' },
      { title: 'Build their profile', description: 'Add backstory, personality traits, speech patterns, goals, and flaws. Use the visual reference section to attach mood boards or casting inspiration.' },
      { title: 'Map relationships', description: 'Link characters together: ally, rival, mentor, love interest. See the web of relationships at a glance.' },
      { title: 'Track their arc', description: 'Use the Arc Planner to visualise how each character changes from the first scene to the last.' },
    ],
  },
  {
    id: 'corkboard',
    eyebrow: 'Story Structure',
    icon: '🗂️',
    title: 'Corkboard & Beat Sheet',
    subtitle: 'Organise your story visually with drag-and-drop cards.',
    description: 'The corkboard lets you move scenes around like Post-its on a wall. Colour-code by act or storyline. The beat sheet maps your script to proven story structures.',
    steps: [
      { title: 'Open the Corkboard', description: 'Navigate to Corkboard in the sidebar. Each scene appears as a card with its heading, summary, and colour tag.' },
      { title: 'Drag to rearrange', description: 'Click and drag cards to restructure your story. Changes sync to the actual script order.' },
      { title: 'Colour-code your acts', description: 'Assign colours to cards by act, storyline, or subplot. Immediately see the visual rhythm of your script.' },
      { title: 'Use the Beat Sheet', description: 'Switch to Beat Sheet view to map scenes against structures like Save the Cat, Syd Field, or the Hero\'s Journey.' },
    ],
    tips: ['The corkboard is perfect for finding structural problems — if one colour dominates, your subplot might be missing.'],
  },
  {
    id: 'breakdown',
    eyebrow: 'Pre-Production',
    icon: '🎬',
    title: 'Scene Breakdown',
    subtitle: 'Extract every production element from every scene.',
    description: 'The breakdown automatically identifies elements from your script: props, costumes, vehicles, SFX, VFX, stunts, makeup, livestock — everything your AD needs in one sheet.',
    steps: [
      { title: 'Go to Scene Breakdown', description: 'Click "Scenes" in the sidebar. Each scene from your script is listed with its heading, page count, and extracted elements.' },
      { title: 'Tag elements', description: 'Click on a scene to open the breakdown sheet. Tag elements by category: Props, Wardrobe, SFX, VFX, Stunts, Vehicles, etc.' },
      { title: 'Add production notes', description: 'Each scene can have notes for specific departments — camera, sound, art, stunts.' },
      { title: 'Generate breakdown reports', description: 'Export breakdown sheets per scene or per department. Perfect for production meetings.' },
    ],
  },
  {
    id: 'shots',
    eyebrow: 'Pre-Production',
    icon: '📸',
    title: 'Shot List & Storyboard',
    subtitle: 'Plan every shot with camera, lens, and movement notes.',
    description: 'Create shot lists linked to specific scenes. Specify camera type, lens, angle, movement, and lighting. Attach reference images to build a visual storyboard.',
    steps: [
      { title: 'Create shots for a scene', description: 'Open a scene and click "Add Shot". Each shot gets a number, type (wide, medium, close-up, etc.), and description.' },
      { title: 'Add technical details', description: 'Specify camera movement (dolly, pan, tilt, steadicam), lens (mm), and lighting setup for each shot.' },
      { title: 'Attach reference images', description: 'Upload or link reference images to each shot. Build a visual storyboard your DP and director can review before set.' },
      { title: 'Reorder and group', description: 'Drag shots to reorder. Group by scene or by setup for an efficient shooting plan.' },
    ],
  },
  {
    id: 'schedule',
    eyebrow: 'Production',
    icon: '📅',
    title: 'Production Schedule',
    subtitle: 'Calendar-based scheduling with call times and locations.',
    description: 'Drag scenes into shooting days. Set call times, wrap times, locations, and notes. Generate call sheets for the crew.',
    steps: [
      { title: 'Open the Schedule', description: 'Click "Schedule" in the sidebar. The calendar view shows your shooting days.' },
      { title: 'Add shooting days', description: 'Click on a date to create a shooting day. Set call time, location, and any day-level notes.' },
      { title: 'Assign scenes to days', description: 'Drag scenes from the unscheduled list into shooting days. See estimated page count and setup time per day.' },
      { title: 'Generate call sheets', description: 'Each shooting day can produce a call sheet with scene list, call times, locations, and department notes.' },
    ],
  },
  {
    id: 'budget',
    eyebrow: 'Production',
    icon: '💰',
    title: 'Budget Tracking',
    subtitle: 'Estimated vs. actual spend — no more spreadsheet chaos.',
    description: 'Set up budget categories, add line items, track estimated cost versus actual spend. Add vendors and receipts. See your burn rate at a glance.',
    steps: [
      { title: 'Set your total budget', description: 'Open Budget in the sidebar. Set your overall budget and start adding categories (Cast, Crew, Locations, Equipment, Post, etc.).' },
      { title: 'Add line items', description: 'Within each category, add specific costs: "Camera rental — 5 days", "Lead actor fee", "Location permit".' },
      { title: 'Track actual spend', description: 'As you pay invoices, update the actual column. See at a glance where you\'re over or under budget.' },
      { title: 'Vendor management', description: 'Link vendors to line items. Keep contact info, invoices, and notes in one place.' },
    ],
  },
  {
    id: 'locations',
    eyebrow: 'Production',
    icon: '📍',
    title: 'Locations',
    subtitle: 'Manage all your filming locations with map integration.',
    description: 'Add locations with addresses, photos, access notes, and permit status. See all locations on an interactive map. Link locations to scenes.',
    steps: [
      { title: 'Add a location', description: 'Go to Locations in the sidebar. Click "+ Add Location". Enter name, address, and any scouting notes.' },
      { title: 'Add details', description: 'Upload scout photos, note parking availability, power access, noise levels, and permit requirements.' },
      { title: 'View on the map', description: 'All locations appear on an interactive map. Plan your shooting route and minimise travel between locations.' },
      { title: 'Link to scenes', description: 'Each location links to the scenes that use it. See exactly how many scenes are at each location.' },
    ],
  },
  {
    id: 'collaboration',
    eyebrow: 'Teamwork',
    icon: '👥',
    title: 'Real-Time Collaboration',
    subtitle: 'Work together — like Google Docs, but for production.',
    description: 'Multiple team members can work in the same project simultaneously. See who\'s online, what they\'re working on, and get instant updates via push notifications.',
    steps: [
      { title: 'Invite team members', description: 'Go to Project Settings → Team. Add people by email. Assign roles: Owner, Writer, Director, Producer, Crew.' },
      { title: 'Work simultaneously', description: 'Everyone sees changes in real-time. The editor shows who\'s online and what they\'re editing.' },
      { title: 'Use project chat', description: 'Each project has built-in chat channels. Create channels for departments (#camera, #art, #production) or use #general.' },
      { title: 'Get notified', description: 'Push notifications alert you when someone makes changes, sends a message, or mentions you in chat.' },
    ],
    tips: ['Roles control access: Writers can edit scripts, Crew can only view scripts but can update their department tools.'],
  },
  {
    id: 'community',
    eyebrow: 'Connect',
    icon: '🌐',
    title: 'Community & Social',
    subtitle: 'Share work, get feedback, and find collaborators.',
    description: 'Screenplay Studio has a built-in community. Share scripts, join sub-communities, take on writing challenges, and connect with other filmmakers through DMs and chat.',
    steps: [
      { title: 'Visit the Community', description: 'Click "Community" in the top navigation. Browse the feed to see shared scripts, discussions, and challenges.' },
      { title: 'Join sub-communities', description: 'Find communities for your genre or format — horror, sci-fi, documentary, shorts. Post, comment, and connect.' },
      { title: 'Share your work', description: 'Click "Share Script" to post your work for feedback. Control visibility and who can comment.' },
      { title: 'Direct messages', description: 'DM any user directly. Start group conversations for your team. All messages are real-time with read receipts.' },
    ],
    path: '/community',
  },
  {
    id: 'submissions',
    eyebrow: 'Distribution',
    icon: '🎯',
    title: 'Submission Tracker',
    subtitle: 'Keep track of every festival, agent, and manager submission.',
    description: 'Log submissions to film festivals, agencies, management companies, and production companies. Track status, deadlines, and responses in one place.',
    steps: [
      { title: 'Add a submission', description: 'Go to Submissions in the sidebar. Click "+ Add Submission". Enter the target (festival, agent, company), date, and status.' },
      { title: 'Track status', description: 'Update each submission as it progresses: Submitted → Under Review → Accepted / Rejected / No Response.' },
      { title: 'Set deadlines', description: 'Add deadline dates and get reminders before they pass. Never miss a festival deadline again.' },
      { title: 'Analyse results', description: 'See your submission history at a glance: acceptance rate, response times, and which targets are worth pursuing.' },
    ],
  },
  {
    id: 'export',
    eyebrow: 'Output',
    icon: '📄',
    title: 'Export & PDF',
    subtitle: 'Industry-standard PDF exports, ready for submission.',
    description: 'Export your screenplay as a properly formatted PDF that meets industry standards. Also export breakdown sheets, call sheets, and budget reports.',
    steps: [
      { title: 'Export your script', description: 'Open your script and click the Export button. Choose PDF format. The output uses Courier 12pt with correct margins and page breaks.' },
      { title: 'Export production docs', description: 'Export breakdown sheets, shot lists, and call sheets as PDF. Each document follows industry formatting conventions.' },
      { title: 'Custom branding (Pro)', description: 'Pro users can add a custom logo and production company name to exported documents.' },
    ],
    tips: ['PDF exports follow standard US Letter formatting with 1" margins, ready for contest and agent submissions.'],
  },
  {
    id: 'gamification',
    eyebrow: 'Motivation',
    icon: '🏆',
    title: 'XP, Levels & Challenges',
    subtitle: 'Stay motivated with writing streaks and community challenges.',
    description: 'Earn XP for writing, completing drafts, giving feedback, and participating in the community. Level up, unlock badges, and compete in timed writing challenges.',
    steps: [
      { title: 'Write to earn XP', description: 'Every word you write earns experience points. Completing scenes, drafts, and revisions gives bonus XP.' },
      { title: 'Track your level', description: 'Your level and XP bar appear in your community profile. See how you compare to other writers on the platform.' },
      { title: 'Join challenges', description: 'Participate in timed writing challenges — write 5 pages in 30 minutes, complete a short in a weekend, etc.' },
      { title: 'Earn badges', description: 'Hit milestones to unlock badges: First Script, Prolific Writer, Community Helper, and more.' },
    ],
    path: '/community/challenges',
  },
];

/* ────────────────────────────────────────────────── */
/*  Page                                              */
/* ────────────────────────────────────────────────── */

export default function TutorialsPage() {
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#070710', color: '#fff' }}>
      {/* dot-grid texture */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          opacity: 0.032,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top bar */}
      <div className="relative z-10 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-screen-lg mx-auto px-6 h-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center shrink-0" style={{ background: ORANGE }}>
              <span className="font-black text-white text-xs" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <span className="text-xs font-black text-white uppercase tracking-tight hidden sm:inline">Screenplay Studio</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/" className="text-xs text-white/35 hover:text-white/70 transition-colors">Home</Link>
            <Link href="/about" className="text-xs text-white/35 hover:text-white/70 transition-colors">About</Link>
            <Link href="/blog" className="text-xs text-white/35 hover:text-white/70 transition-colors">Blog</Link>
            <Link href="/dashboard" className="text-xs px-3 py-1.5 font-semibold transition-colors" style={{ background: ORANGE, color: '#fff' }}>
              Open App
            </Link>
          </div>
        </div>
      </div>

      <main className="relative z-10">
        {/* ── Hero ────────────────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 pt-20 pb-10">
          <Eyebrow>Tutorials</Eyebrow>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6"
            style={{ letterSpacing: '-0.04em', lineHeight: 1.05 }}
          >
            LEARN EVERY TOOL.<br />
            <span style={{ color: ORANGE }}>SHIP YOUR PROJECT.</span>
          </h1>
          <p className="text-base sm:text-lg text-white/45 max-w-2xl leading-relaxed">
            Visual, step-by-step guides for every feature in Screenplay Studio.
            From your first FADE IN to final export — everything you need to know.
          </p>
        </section>

        {/* ── Quick Jump Nav ─────────────────────────────── */}
        <section className="max-w-screen-lg mx-auto px-6 pb-12">
          <div className="flex flex-wrap gap-2">
            {TUTORIALS.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.title}
              </a>
            ))}
          </div>
        </section>

        <Rule />

        {/* ── Tutorial Sections ──────────────────────────── */}
        {TUTORIALS.map((tutorial, sectionIdx) => (
          <div key={tutorial.id}>
            <section id={tutorial.id} className="max-w-screen-lg mx-auto px-6 py-16 scroll-mt-16">
              <Eyebrow>{tutorial.eyebrow}</Eyebrow>

              <div className="flex items-start gap-4 mb-6">
                <span className="text-3xl">{tutorial.icon}</span>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mb-2" style={{ letterSpacing: '-0.03em' }}>
                    {tutorial.title}
                  </h2>
                  <p className="text-sm sm:text-base text-white/50">{tutorial.subtitle}</p>
                </div>
              </div>

              <p className="text-sm sm:text-base text-white/40 leading-relaxed mb-10 max-w-3xl">
                {tutorial.description}
              </p>

              {/* Steps grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {tutorial.steps.map((step, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-5 relative overflow-hidden group"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {/* Step number accent */}
                    <div
                      className="absolute top-0 left-0 w-1 h-full"
                      style={{ background: ORANGE, opacity: 0.6 }}
                    />
                    <div className="flex items-start gap-3 pl-3">
                      <span
                        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                        style={{ background: `${ORANGE}20`, color: ORANGE }}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-white mb-1">{step.title}</h3>
                        <p className="text-xs sm:text-sm text-white/45 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tips */}
              {tutorial.tips && tutorial.tips.length > 0 && (
                <div
                  className="rounded-xl p-4 flex items-start gap-3"
                  style={{ background: `${ORANGE}08`, border: `1px solid ${ORANGE}20` }}
                >
                  <span className="text-lg shrink-0">💡</span>
                  <div className="space-y-1">
                    {tutorial.tips.map((tip, i) => (
                      <p key={i} className="text-xs sm:text-sm text-white/50 leading-relaxed">{tip}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Link to feature */}
              {tutorial.path && (
                <div className="mt-6">
                  <Link
                    href={tutorial.path}
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition-colors"
                    style={{ color: ORANGE }}
                  >
                    Try it now
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              )}
            </section>

            {sectionIdx < TUTORIALS.length - 1 && <Rule />}
          </div>
        ))}

        {/* ── Keyboard Shortcuts ─────────────────────────── */}
        <Rule />
        <section className="max-w-screen-lg mx-auto px-6 py-16">
          <Eyebrow>Reference</Eyebrow>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-8" style={{ letterSpacing: '-0.03em' }}>
            Keyboard Shortcuts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { keys: 'Ctrl/Cmd + K', action: 'Command palette' },
              { keys: 'Tab', action: 'Cycle element type' },
              { keys: 'Enter × 2', action: 'New scene heading' },
              { keys: 'Ctrl/Cmd + S', action: 'Save draft' },
              { keys: 'Ctrl/Cmd + B', action: 'Bold text' },
              { keys: 'Ctrl/Cmd + I', action: 'Italic text' },
              { keys: 'Ctrl/Cmd + U', action: 'Underline text' },
              { keys: 'Ctrl/Cmd + Z', action: 'Undo' },
              { keys: 'Ctrl/Cmd + Shift + Z', action: 'Redo' },
            ].map(({ keys, action }) => (
              <div
                key={keys}
                className="flex items-center justify-between gap-4 rounded-lg px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span className="text-xs text-white/50">{action}</span>
                <kbd
                  className="text-[10px] font-mono px-2 py-1 rounded shrink-0"
                  style={{ background: 'rgba(255,255,255,0.08)', color: ORANGE }}
                >
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────── */}
        <Rule />
        <section className="max-w-screen-lg mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4" style={{ letterSpacing: '-0.03em' }}>
            Ready to start?
          </h2>
          <p className="text-sm sm:text-base text-white/40 mb-8 max-w-lg mx-auto">
            Everything above is included in the free plan. No trial, no time limit. Jump in and start writing.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 font-bold text-white text-sm transition-colors rounded-lg"
            style={{ background: ORANGE }}
          >
            Open Screenplay Studio
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </section>

        {/* Footer breathing room */}
        <div className="h-16" />
      </main>
    </div>
  );
}
