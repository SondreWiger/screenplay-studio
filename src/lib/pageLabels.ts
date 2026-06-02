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
};

export function getPageSection(pathname: string, projectId: string): string {
  const prefix = `/projects/${projectId}/`;
  if (!pathname.startsWith(prefix)) return 'overview';
  const rest = pathname.slice(prefix.length).split('?')[0].split('#')[0];
  const first = rest.split('/')[0];
  return first || 'overview';
}
