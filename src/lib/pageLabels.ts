export const PAGE_LABELS: Record<string, string> = {
  overview: 'Overview', script: 'Script Editor', documents: 'Documents',
  characters: 'Characters', locations: 'Locations', scenes: 'Scenes',
  episodes: 'Episodes',
  'arc-planner': 'Arc Planner',
  shots: 'Shot List', schedule: 'Schedule', ideas: 'Ideas',
  budget: 'Budget', team: 'Team', settings: 'Settings',
  mindmap: 'Mind Map', moodboard: 'Mood Board', messages: 'Messages', chat: 'Chat',
  storyboard: 'Storyboard', onset: 'On Set', comments: 'Comments',
  showcase: 'Showcase', share: 'Share', analytics: 'Analytics',
  export: 'Advanced Export', casting: 'Casting', actors: 'Actors', 'ai-analysis': 'Script Analysis',
  corkboard: 'Corkboard', 'beat-sheet': 'Beat Sheet', invoice: 'Invoice Generator',
  submissions: 'Submission Tracker', breakdown: 'Production Breakdown',
  continuity: 'Continuity Sheet', 'call-sheet': 'Call Sheet',
  dood: 'Day Out of Days', coverage: 'Script Coverage',
  'table-read': 'Table Read', 'camera-reports': 'Camera Reports',
  'safety-plan': 'Safety Plan', treatment: 'Treatment',
  'production-overview': 'Production Overview',
  quotes: 'Set Quotes',
  editorial: 'Editorial Board', contacts: 'Contacts', checklist: 'Pre-Show Checklist',
  gear: 'Gear', 'schedule-pack': 'Day Pack', 'one-liner': 'One-liner',
  rundown: 'Rundown', stories: 'Stories', 'wire-desk': 'Wire Desk',
  sources: 'Sources', graphics: 'Graphics / CG', prompter: 'Prompter',
  'as-run': 'As-Run Log', 'broadcast-settings': 'Broadcast Settings',
  'sound-design': 'Sound Design', 'voice-cast': 'Voice Cast',
  'vision-mixer': 'Vision Mixer', 'master-control': 'Master Control',
  'stream-ingest': 'Stream Ingest', output: 'Output / Restream',
  multiviewer: 'Multiviewer', comms: 'Comms / Intercom',
  'mos-devices': 'MOS Devices',
  ensemble: 'Ensemble',
  cues: 'Cue Sheet',
  'production-team': 'Production Team',
  rehearsal: 'Rehearsal',

  // Studio suite (see lib/studio/tools.ts) — 'locations' is already mapped above
  studio: 'Studio',
  portfolio: 'Portfolio',
  accounting: 'Production Accounting',
  rights: 'Rights & Clearances',
  distribution: 'Distribution Pipeline',
  'crew-portal': 'Crew Portal',
  departments: 'Departments',
  compliance: 'Insurance & Compliance',
  'script-supervising': 'Script Supervising',
  'vfx-tracking': 'VFX Tracking',
  'music-sound': 'Music & Sound',
  talent: 'Talent Management',
  vendors: 'Vendor Management',
  safety: 'Stunts & Safety',
  greenlight: 'Greenlight & Financing',
  festival: 'Festival Strategy',
  'tax-incentives': 'Tax Incentives',
  multilang: 'Localisation',
  'broadcast-compliance': 'Broadcast Compliance',
  archival: 'Archival',
  'post-production': 'Post-Production',
  marketing: 'Marketing & PR',
  legal: 'Legal & Contracts',
  crowdfunding: 'Crowdfunding',
  'box-office': 'Box Office & Revenue',
  travel: 'Travel & Accommodation',
  catering: 'Catering & Craft',
  sustainability: 'Sustainability',
  extras: 'Extras & Background',
  equipment: 'Equipment Rentals',
  wrap: 'Wrap & Completion',
  newsletter: 'Production Newsletter',
};

export function getPageSection(pathname: string, projectId: string): string {
  const prefix = `/projects/${projectId}/`;
  if (!pathname.startsWith(prefix)) return 'overview';
  const rest = pathname.slice(prefix.length).split('?')[0].split('#')[0];
  const first = rest.split('/')[0];
  return first || 'overview';
}

/**
 * Like getPageSection, but resolves Studio tools to their own slug so
 * `/projects/x/studio/rights` reads as "Rights & Clearances" rather than "Studio".
 */
export function getPageLabelKey(pathname: string, projectId: string): string {
  const section = getPageSection(pathname, projectId);
  if (section !== 'studio') return section;
  const prefix = `/projects/${projectId}/studio/`;
  if (!pathname.startsWith(prefix)) return section;
  const slug = pathname.slice(prefix.length).split('?')[0].split('#')[0].split('/')[0];
  return slug && PAGE_LABELS[slug] ? slug : section;
}
