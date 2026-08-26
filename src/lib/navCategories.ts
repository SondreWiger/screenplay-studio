export type NavItem = {
  label: string; href: string; icon: string;
  always?: boolean; production?: boolean; collab?: boolean;
  contentCreator?: boolean; filmOnly?: boolean; pro?: boolean;
};
export type NavCategory = { id?: string; category: string; items: NavItem[] };

/** The shape `getNavCategories` needs to pick a nav for a project. */
export type ProjectNavFlags = {
  isTvProduction: boolean;
  isAudioDrama: boolean;
  isStagePlay: boolean;
  isContentCreator: boolean;
  isEpisodic: boolean;
  isViewer: boolean;
};

const CREATOR_PROJECT_TYPES = ['youtube', 'tiktok', 'podcast', 'educational', 'livestream'];
const CREATOR_SCRIPT_TYPES = ['youtube', 'tiktok'];

/**
 * Derive the nav flags from a project. Kept here so the sidebar, the command
 * palette and anything else that needs a project's tool list agree.
 */
export function getProjectNavFlags(
  project: { project_type?: string | null; script_type?: string | null } | null | undefined,
  isViewer = false,
): ProjectNavFlags {
  const projectType = project?.project_type || '';
  const scriptType = project?.script_type || '';
  return {
    isContentCreator: CREATOR_PROJECT_TYPES.includes(projectType) || CREATOR_SCRIPT_TYPES.includes(scriptType),
    isTvProduction: projectType === 'tv_production',
    isAudioDrama: projectType === 'audio_drama' || scriptType === 'audio_drama',
    isStagePlay: projectType === 'stage_play' || scriptType === 'stageplay',
    isEpisodic: scriptType === 'episodic',
    isViewer,
  };
}

export function getNavCategories(
  projectId: string,
  options: {
    isTvProduction: boolean;
    isAudioDrama: boolean;
    isStagePlay: boolean;
    isContentCreator: boolean;
    isEpisodic: boolean;
    isViewer: boolean;
  }
): NavCategory[] {
  const { isTvProduction, isAudioDrama, isStagePlay, isContentCreator, isEpisodic, isViewer } = options;
  const p = `/projects/${projectId}`;

  if (isTvProduction) return tvNav(p);
  if (isAudioDrama) return audioDramaNav(p);
  if (isStagePlay) return stagePlayNav(p, isViewer);
  if (isContentCreator) return contentCreatorNav(p);
  return filmNav(p, isEpisodic, isViewer);
}

function filmNav(p: string, isEpisodic: boolean, isViewer: boolean): NavCategory[] {
  return [
    { category: '', items: [{ label: 'Overview', href: p, icon: 'overview', always: true }] },
    {
      category: 'Write',
      items: [
        ...(isEpisodic ? [{ label: 'Episodes', href: `${p}/episodes`, icon: 'episodes', always: true }] : []),
        { label: 'Script', href: `${p}/script`, icon: 'script', always: true },
        { label: 'Arc Planner', href: `${p}/arc-planner`, icon: 'arc-planner', always: true },
        { label: 'Beat Sheet', href: `${p}/beat-sheet`, icon: 'beat-sheet', always: true },
        { label: 'Notes Rounds', href: `${p}/notes-rounds`, icon: 'notes-rounds', always: true },
        { label: 'Ideas', href: `${p}/ideas`, icon: 'ideas', always: true },
        { label: 'Worldbuilding', href: `${p}/worldbuilding`, icon: 'worldbuilding', always: true },
        { label: 'Documents', href: `${p}/documents`, icon: 'documents', always: true },
      ],
    },
    {
      id: 'plan', category: 'Plan',
      items: [
        { label: 'Characters', href: `${p}/characters`, icon: 'characters', always: true },
        { label: 'Locations', href: `${p}/locations`, icon: 'locations', production: true },
        { label: 'One-liner', href: `${p}/one-liner`, icon: 'one-liner', always: true },
        { label: 'Scenes', href: `${p}/scenes`, icon: 'scenes', production: true },
        { label: 'Schedule', href: `${p}/schedule`, icon: 'schedule', production: true },
        { label: 'Budget', href: `${p}/budget`, icon: 'budget', production: true },
        { label: 'Breakdown', href: `${p}/breakdown`, icon: 'breakdown', production: true },
        { label: 'Auto-Breakdown', href: `${p}/auto-breakdown`, icon: 'auto-breakdown', always: true },
        { label: 'Call Sheet', href: `${p}/call-sheet`, icon: 'call-sheet', production: true },
      ],
    },
    {
      id: 'on-set', category: 'On Set',
      items: [
        { label: 'War Room', href: `${p}/production-overview`, icon: 'production-overview', production: true },
        { label: 'On Set', href: `${p}/onset`, icon: 'onset', production: true },
        { label: 'Day Pack', href: `${p}/schedule-pack`, icon: 'schedule-pack', production: true },
        { label: 'Continuity', href: `${p}/continuity`, icon: 'continuity', production: true },
        { label: 'Day Out of Days', href: `${p}/dood`, icon: 'dood', production: true },
        { label: 'Table Read', href: `${p}/table-read`, icon: 'table-read', production: true },
        { label: 'Camera Reports', href: `${p}/camera-reports`, icon: 'camera-reports', production: true },
        { label: 'Safety Plan', href: `${p}/safety-plan`, icon: 'safety-plan', production: true },
      ],
    },
    {
      category: 'Creative',
      items: [
        { label: 'Corkboard', href: `${p}/corkboard`, icon: 'corkboard', production: true },
        { label: 'Shot List', href: `${p}/shots`, icon: 'shots', always: true },
        { label: 'Mood Board', href: `${p}/moodboard`, icon: 'moodboard', always: true },
        { label: 'Pitch Deck', href: `${p}/pitch-deck`, icon: 'pitch-deck', always: true },
        { label: 'Storyboard', href: `${p}/storyboard`, icon: 'storyboard', always: true },
        { label: 'Mind Map', href: `${p}/mindmap`, icon: 'mindmap', always: true },
        { label: 'Set Quotes', href: `${p}/quotes`, icon: 'quotes', always: true },
      ],
    },
    {
      category: 'Team',
      items: [
        { label: 'Crew View', href: `${p}/crew`, icon: 'crew', always: true },
        { label: 'Gear', href: `${p}/gear`, icon: 'gear', production: true },
        { label: 'Chat', href: `${p}/chat`, icon: 'chat', collab: true },
        { label: 'Comments', href: `${p}/comments`, icon: 'comments', collab: true },
        { label: 'Team', href: `${p}/team`, icon: 'team', collab: true },
        { label: 'Casting', href: `${p}/casting`, icon: 'casting', always: true },
        { label: 'Actors', href: `${p}/actors`, icon: 'actors', always: true },
      ],
    },
    {
      category: 'Finish',
      items: [
        { label: 'Export', href: `${p}/export`, icon: 'export', always: true },
        { label: 'Export DOCX', href: `${p}/export-docx`, icon: 'docx', always: true },
        { label: 'Share', href: `${p}/share`, icon: 'share', always: true },
        { label: 'Submissions', href: `${p}/submissions`, icon: 'submissions', always: true },
        { label: 'Press Kit', href: `${p}/press-kit`, icon: 'presskit', always: true },
        { label: 'Custom Branding', href: `${p}/branding`, icon: 'branding', always: true },
        { label: 'Invoice', href: `${p}/invoice`, icon: 'invoice', always: true },
        { label: 'Analytics', href: `${p}/analytics`, icon: 'analytics', always: true },
        { label: 'Reports', href: `${p}/reports`, icon: 'reports', always: true },
        { label: 'Treatment', href: `${p}/treatment`, icon: 'treatment', always: true },
        { label: 'Script Coverage', href: `${p}/coverage`, icon: 'coverage', always: true },
        { label: 'Script Analysis', href: `${p}/ai-analysis`, icon: 'ai', always: true },
        { label: 'Compare Versions', href: `${p}/compare`, icon: 'compare', always: true },
        { label: 'Revisions', href: `${p}/revisions`, icon: 'revisions', always: true },
      ],
    },
    {
      category: 'Pro Tools',
      items: [
        { label: 'Portfolio', href: `${p}/pro/portfolio`, icon: 'portfolio', pro: true },
        { label: 'Production Accounting', href: `${p}/pro/accounting`, icon: 'accounting', pro: true },
        { label: 'Rights & Clearances', href: `${p}/pro/rights`, icon: 'rights', pro: true },
        { label: 'Distribution Pipeline', href: `${p}/pro/distribution`, icon: 'distribution', pro: true },
        { label: 'Crew Portal', href: `${p}/pro/crew-portal`, icon: 'crew-portal', pro: true },
        { label: 'Departments', href: `${p}/pro/departments`, icon: 'departments', pro: true },
        { label: 'Insurance & Compliance', href: `${p}/pro/compliance`, icon: 'compliance', pro: true },
        { label: 'Script Supervising', href: `${p}/pro/script-supervising`, icon: 'script-supervising', pro: true },
        { label: 'VFX Tracking', href: `${p}/pro/vfx-tracking`, icon: 'vfx-tracking', pro: true },
        { label: 'Music & Sound', href: `${p}/pro/music-sound`, icon: 'music-sound', pro: true },
        { label: 'Talent Management', href: `${p}/pro/talent`, icon: 'talent', pro: true },
        { label: 'Location Scouting', href: `${p}/pro/locations`, icon: 'scouting', pro: true },
        { label: 'Vendor Management', href: `${p}/pro/vendors`, icon: 'vendors', pro: true },
        { label: 'Stunts & Safety', href: `${p}/pro/safety`, icon: 'stunts', pro: true },
        { label: 'Greenlight & Financing', href: `${p}/pro/greenlight`, icon: 'greenlight', pro: true },
        { label: 'Festival Strategy', href: `${p}/pro/festival`, icon: 'festival', pro: true },
        { label: 'Tax Incentives', href: `${p}/pro/tax-incentives`, icon: 'tax-incentives', pro: true },
        { label: 'Multi-Language', href: `${p}/pro/multilang`, icon: 'multilang', pro: true },
        { label: 'Broadcast Compliance', href: `${p}/pro/broadcast-compliance`, icon: 'broadcast-compliance', pro: true },
        { label: 'Archival', href: `${p}/pro/archival`, icon: 'archival', pro: true },
        { label: 'Post-Production', href: `${p}/pro/post-production`, icon: 'post-production', pro: true },
        { label: 'Marketing & PR', href: `${p}/pro/marketing`, icon: 'marketing', pro: true },
        { label: 'Legal & Contracts', href: `${p}/pro/legal`, icon: 'legal', pro: true },
        { label: 'Crowdfunding', href: `${p}/pro/crowdfunding`, icon: 'crowdfunding', pro: true },
        { label: 'Box Office & Revenue', href: `${p}/pro/box-office`, icon: 'box-office', pro: true },
        { label: 'Travel & Accommodations', href: `${p}/pro/travel`, icon: 'travel', pro: true },
        { label: 'Catering & Craft Services', href: `${p}/pro/catering`, icon: 'catering', pro: true },
        { label: 'Sustainability', href: `${p}/pro/sustainability`, icon: 'sustainability', pro: true },
        { label: 'Extras / Background Casting', href: `${p}/pro/extras`, icon: 'extras', pro: true },
        { label: 'Equipment Rentals', href: `${p}/pro/equipment`, icon: 'equipment', pro: true },
        { label: 'Wrap & Completion', href: `${p}/pro/wrap`, icon: 'wrap', pro: true },
        { label: 'Production Newsletter', href: `${p}/pro/newsletter`, icon: 'newsletter', pro: true },
        { label: 'Dailies', href: `${p}/pro/dailies`, icon: 'dailies', pro: true },
        { label: 'Delivery Checklist', href: `${p}/pro/deliverables`, icon: 'deliverables', pro: true },
        { label: 'Unions & Guilds', href: `${p}/pro/unions`, icon: 'unions', pro: true },
        { label: 'Residuals & Royalties', href: `${p}/pro/residuals`, icon: 'residuals', pro: true },
        { label: 'Test Screenings', href: `${p}/pro/screenings`, icon: 'screenings', pro: true },
      ],
    },
    ...(!isViewer ? [{ category: '', items: [
      { label: 'Showcase', href: `${p}/showcase`, icon: 'showcase', always: true },
      { label: 'Settings', href: `${p}/settings`, icon: 'settings', always: true },
    ] }] : []),
  ];
}

function tvNav(p: string): NavCategory[] {
  return [
    { category: '', items: [{ label: 'Overview', href: p, icon: 'overview', always: true }] },
    {
      category: 'Pre-Production',
      items: [
        { label: 'Wire Desk', href: `${p}/wire-desk`, icon: 'wiredesk', always: true },
        { label: 'Editorial Board', href: `${p}/editorial`, icon: 'editorial', always: true },
        { label: 'Stories', href: `${p}/stories`, icon: 'stories', always: true },
        { label: 'Contacts', href: `${p}/contacts`, icon: 'contacts', always: true },
        { label: 'Schedule', href: `${p}/schedule`, icon: 'schedule', always: true },
        { label: 'Checklist', href: `${p}/checklist`, icon: 'checklist', always: true },
        { label: 'Documents', href: `${p}/documents`, icon: 'documents', always: true },
      ],
    },
    {
      category: 'Scripting',
      items: [
        { label: 'Script Editor', href: `${p}/script`, icon: 'script', always: true },
        { label: 'Prompter', href: `${p}/prompter`, icon: 'prompter', always: true },
        { label: 'Graphics / CG', href: `${p}/graphics`, icon: 'graphics', always: true },
      ],
    },
    {
      category: 'On Air',
      items: [
        { label: 'Rundown', href: `${p}/rundown`, icon: 'rundown', always: true },
        { label: 'Vision Mixer', href: `${p}/vision-mixer`, icon: 'visionmixer', always: true },
        { label: 'Master Control', href: `${p}/master-control`, icon: 'mastercontrol', always: true },
        { label: 'Sources', href: `${p}/sources`, icon: 'sources', always: true },
      ],
    },
    {
      category: 'Distribution',
      items: [
        { label: 'Stream Ingest', href: `${p}/stream-ingest`, icon: 'streamingest', always: true },
        { label: 'Output', href: `${p}/output`, icon: 'output', always: true },
      ],
    },
    {
      category: 'Monitoring',
      items: [
        { label: 'Multiviewer', href: `${p}/multiviewer`, icon: 'multiviewer', always: true },
        { label: 'As-Run Log', href: `${p}/as-run`, icon: 'asrun', always: true },
      ],
    },
    {
      category: 'Infrastructure',
      items: [
        { label: 'Comms', href: `${p}/comms`, icon: 'comms', always: true },
        { label: 'MOS Devices', href: `${p}/mos-devices`, icon: 'mosdevices', always: true },
      ],
    },
    {
      category: 'Collaboration',
      items: [
        { label: 'Chat', href: `${p}/chat`, icon: 'chat', collab: true },
        { label: 'Team', href: `${p}/team`, icon: 'team', collab: true },
        { label: 'Set Quotes', href: `${p}/quotes`, icon: 'quotes', always: true },
      ],
    },
  ];
}

function audioDramaNav(p: string): NavCategory[] {
  return [
    { category: '', items: [{ label: 'Overview', href: p, icon: 'overview', always: true }] },
    {
      category: 'Writing',
      items: [
        { label: 'Episodes', href: `${p}/episodes`, icon: 'episodes', always: true },
        { label: 'Script', href: `${p}/script`, icon: 'script', always: true },
        { label: 'Arc Planner', href: `${p}/arc-planner`, icon: 'arc-planner', always: true },
        { label: 'Documents', href: `${p}/documents`, icon: 'documents', always: true },
        { label: 'Ideas', href: `${p}/ideas`, icon: 'ideas', always: true },
        { label: 'Worldbuilding', href: `${p}/worldbuilding`, icon: 'worldbuilding', always: true },
      ],
    },
    {
      category: 'Cast & World',
      items: [
        { label: 'Voice Cast', href: `${p}/voice-cast`, icon: 'voice-cast', always: true },
        { label: 'Characters', href: `${p}/characters`, icon: 'characters', always: true },
        { label: 'Locations', href: `${p}/locations`, icon: 'locations', always: true },
        { label: 'Mind Map', href: `${p}/mindmap`, icon: 'mindmap', always: true },
        { label: 'Mood Board', href: `${p}/moodboard`, icon: 'moodboard', always: true },
      ],
    },
    {
      category: 'Sound',
      items: [
        { label: 'Sound Design', href: `${p}/sound-design`, icon: 'sound-design', always: true },
        { label: 'Scenes', href: `${p}/scenes`, icon: 'scenes', production: true },
        { label: 'Schedule', href: `${p}/schedule`, icon: 'schedule', production: true },
      ],
    },
    {
      category: 'Collaboration',
      items: [
        { label: 'Chat', href: `${p}/chat`, icon: 'chat', collab: true },
        { label: 'Comments', href: `${p}/comments`, icon: 'comments', collab: true },
        { label: 'Team', href: `${p}/team`, icon: 'team', collab: true },
        { label: 'Crew View', href: `${p}/crew`, icon: 'crew', always: true },
        { label: 'Set Quotes', href: `${p}/quotes`, icon: 'quotes', always: true },
      ],
    },
    {
      category: 'Finish',
      items: [
        { label: 'Share', href: `${p}/share`, icon: 'share', always: true },
        { label: 'Export', href: `${p}/export`, icon: 'export', always: true },
        { label: 'Script Analysis', href: `${p}/ai-analysis`, icon: 'ai', always: true },
        { label: 'Revisions', href: `${p}/revisions`, icon: 'revisions', always: true },
        { label: 'Casting', href: `${p}/casting`, icon: 'casting', always: true },
        { label: 'Actors', href: `${p}/actors`, icon: 'actors', always: true },
        { label: 'Press Kit', href: `${p}/press-kit`, icon: 'presskit', always: true },
      ],
    },
    {
      category: 'Pro Tools',
      items: [
        { label: 'Portfolio', href: `${p}/pro/portfolio`, icon: 'portfolio', pro: true },
        { label: 'Production Accounting', href: `${p}/pro/accounting`, icon: 'accounting', pro: true },
        { label: 'Rights & Clearances', href: `${p}/pro/rights`, icon: 'rights', pro: true },
        { label: 'Distribution Pipeline', href: `${p}/pro/distribution`, icon: 'distribution', pro: true },
        { label: 'Crew Portal', href: `${p}/pro/crew-portal`, icon: 'crew-portal', pro: true },
        { label: 'Departments', href: `${p}/pro/departments`, icon: 'departments', pro: true },
        { label: 'Insurance & Compliance', href: `${p}/pro/compliance`, icon: 'compliance', pro: true },
        { label: 'Script Supervising', href: `${p}/pro/script-supervising`, icon: 'script-supervising', pro: true },
        { label: 'VFX Tracking', href: `${p}/pro/vfx-tracking`, icon: 'vfx-tracking', pro: true },
        { label: 'Music & Sound', href: `${p}/pro/music-sound`, icon: 'music-sound', pro: true },
        { label: 'Talent Management', href: `${p}/pro/talent`, icon: 'talent', pro: true },
        { label: 'Location Scouting', href: `${p}/pro/locations`, icon: 'scouting', pro: true },
        { label: 'Vendor Management', href: `${p}/pro/vendors`, icon: 'vendors', pro: true },
        { label: 'Stunts & Safety', href: `${p}/pro/safety`, icon: 'stunts', pro: true },
        { label: 'Greenlight & Financing', href: `${p}/pro/greenlight`, icon: 'greenlight', pro: true },
        { label: 'Festival Strategy', href: `${p}/pro/festival`, icon: 'festival', pro: true },
        { label: 'Tax Incentives', href: `${p}/pro/tax-incentives`, icon: 'tax-incentives', pro: true },
        { label: 'Multi-Language', href: `${p}/pro/multilang`, icon: 'multilang', pro: true },
        { label: 'Broadcast Compliance', href: `${p}/pro/broadcast-compliance`, icon: 'broadcast-compliance', pro: true },
        { label: 'Archival', href: `${p}/pro/archival`, icon: 'archival', pro: true },
        { label: 'Post-Production', href: `${p}/pro/post-production`, icon: 'post-production', pro: true },
        { label: 'Marketing & PR', href: `${p}/pro/marketing`, icon: 'marketing', pro: true },
        { label: 'Legal & Contracts', href: `${p}/pro/legal`, icon: 'legal', pro: true },
        { label: 'Crowdfunding', href: `${p}/pro/crowdfunding`, icon: 'crowdfunding', pro: true },
        { label: 'Box Office & Revenue', href: `${p}/pro/box-office`, icon: 'box-office', pro: true },
        { label: 'Travel & Accommodations', href: `${p}/pro/travel`, icon: 'travel', pro: true },
        { label: 'Catering & Craft Services', href: `${p}/pro/catering`, icon: 'catering', pro: true },
        { label: 'Sustainability', href: `${p}/pro/sustainability`, icon: 'sustainability', pro: true },
        { label: 'Extras / Background Casting', href: `${p}/pro/extras`, icon: 'extras', pro: true },
        { label: 'Equipment Rentals', href: `${p}/pro/equipment`, icon: 'equipment', pro: true },
        { label: 'Wrap & Completion', href: `${p}/pro/wrap`, icon: 'wrap', pro: true },
        { label: 'Production Newsletter', href: `${p}/pro/newsletter`, icon: 'newsletter', pro: true },
        { label: 'Dailies', href: `${p}/pro/dailies`, icon: 'dailies', pro: true },
        { label: 'Delivery Checklist', href: `${p}/pro/deliverables`, icon: 'deliverables', pro: true },
        { label: 'Unions & Guilds', href: `${p}/pro/unions`, icon: 'unions', pro: true },
        { label: 'Residuals & Royalties', href: `${p}/pro/residuals`, icon: 'residuals', pro: true },
        { label: 'Test Screenings', href: `${p}/pro/screenings`, icon: 'screenings', pro: true },
      ],
    },
  ];
}

function stagePlayNav(p: string, isViewer: boolean): NavCategory[] {
  return [
    { category: '', items: [{ label: 'Overview', href: p, icon: 'overview', always: true }] },
    {
      category: 'Writing',
      items: [
        { label: 'Arc Planner', href: `${p}/arc-planner`, icon: 'arc-planner', always: true },
        { label: 'Script', href: `${p}/script`, icon: 'script', always: true },
        { label: 'Notes Rounds', href: `${p}/notes-rounds`, icon: 'notes-rounds', always: true },
        { label: 'Documents', href: `${p}/documents`, icon: 'documents', always: true },
        { label: 'Ideas', href: `${p}/ideas`, icon: 'ideas', always: true },
        { label: 'Worldbuilding', href: `${p}/worldbuilding`, icon: 'worldbuilding', always: true },
      ],
    },
    {
      category: 'Company',
      items: [
        { label: 'Ensemble', href: `${p}/ensemble`, icon: 'cast', always: true },
        { label: 'Characters', href: `${p}/characters`, icon: 'characters', always: true },
        { label: 'Production Team', href: `${p}/production-team`, icon: 'team', always: true },
        { label: 'Mood Board', href: `${p}/moodboard`, icon: 'moodboard', always: true },
      ],
    },
    {
      category: 'Production',
      items: [
        { label: 'One-liner', href: `${p}/one-liner`, icon: 'one-liner', always: true },
        { label: 'Cue Sheet', href: `${p}/cues`, icon: 'checklist', always: true },
        { label: 'Scenes', href: `${p}/scenes`, icon: 'scenes', production: true },
        { label: 'Schedule', href: `${p}/schedule`, icon: 'schedule', production: true },
        { label: 'Budget', href: `${p}/budget`, icon: 'budget', production: true },
      ],
    },
    {
      category: 'Collaboration',
      items: [
        { label: 'Chat', href: `${p}/chat`, icon: 'chat', collab: true },
        { label: 'Comments', href: `${p}/comments`, icon: 'comments', collab: true },
        { label: 'Team', href: `${p}/team`, icon: 'team', collab: true },
        { label: 'Crew View', href: `${p}/crew`, icon: 'crew', always: true },
        { label: 'Set Quotes', href: `${p}/quotes`, icon: 'quotes', always: true },
      ],
    },
    {
      category: 'Finish',
      items: [
        { label: 'Share', href: `${p}/share`, icon: 'share', always: true },
        { label: 'Export', href: `${p}/export`, icon: 'export', always: true },
        { label: 'Script Analysis', href: `${p}/ai-analysis`, icon: 'ai', always: true },
        { label: 'Revisions', href: `${p}/revisions`, icon: 'revisions', always: true },
        { label: 'Casting', href: `${p}/casting`, icon: 'casting', always: true },
        { label: 'Actors', href: `${p}/actors`, icon: 'actors', always: true },
        { label: 'Press Kit', href: `${p}/press-kit`, icon: 'presskit', always: true },
      ],
    },
    {
      category: 'Pro Tools',
      items: [
        { label: 'Portfolio', href: `${p}/pro/portfolio`, icon: 'portfolio', pro: true },
        { label: 'Production Accounting', href: `${p}/pro/accounting`, icon: 'accounting', pro: true },
        { label: 'Rights & Clearances', href: `${p}/pro/rights`, icon: 'rights', pro: true },
        { label: 'Distribution Pipeline', href: `${p}/pro/distribution`, icon: 'distribution', pro: true },
        { label: 'Crew Portal', href: `${p}/pro/crew-portal`, icon: 'crew-portal', pro: true },
        { label: 'Departments', href: `${p}/pro/departments`, icon: 'departments', pro: true },
        { label: 'Insurance & Compliance', href: `${p}/pro/compliance`, icon: 'compliance', pro: true },
        { label: 'Script Supervising', href: `${p}/pro/script-supervising`, icon: 'script-supervising', pro: true },
        { label: 'VFX Tracking', href: `${p}/pro/vfx-tracking`, icon: 'vfx-tracking', pro: true },
        { label: 'Music & Sound', href: `${p}/pro/music-sound`, icon: 'music-sound', pro: true },
        { label: 'Talent Management', href: `${p}/pro/talent`, icon: 'talent', pro: true },
        { label: 'Location Scouting', href: `${p}/pro/locations`, icon: 'scouting', pro: true },
        { label: 'Vendor Management', href: `${p}/pro/vendors`, icon: 'vendors', pro: true },
        { label: 'Stunts & Safety', href: `${p}/pro/safety`, icon: 'stunts', pro: true },
        { label: 'Greenlight & Financing', href: `${p}/pro/greenlight`, icon: 'greenlight', pro: true },
        { label: 'Festival Strategy', href: `${p}/pro/festival`, icon: 'festival', pro: true },
        { label: 'Tax Incentives', href: `${p}/pro/tax-incentives`, icon: 'tax-incentives', pro: true },
        { label: 'Multi-Language', href: `${p}/pro/multilang`, icon: 'multilang', pro: true },
        { label: 'Broadcast Compliance', href: `${p}/pro/broadcast-compliance`, icon: 'broadcast-compliance', pro: true },
        { label: 'Archival', href: `${p}/pro/archival`, icon: 'archival', pro: true },
        { label: 'Post-Production', href: `${p}/pro/post-production`, icon: 'post-production', pro: true },
        { label: 'Marketing & PR', href: `${p}/pro/marketing`, icon: 'marketing', pro: true },
        { label: 'Legal & Contracts', href: `${p}/pro/legal`, icon: 'legal', pro: true },
        { label: 'Crowdfunding', href: `${p}/pro/crowdfunding`, icon: 'crowdfunding', pro: true },
        { label: 'Box Office & Revenue', href: `${p}/pro/box-office`, icon: 'box-office', pro: true },
        { label: 'Travel & Accommodations', href: `${p}/pro/travel`, icon: 'travel', pro: true },
        { label: 'Catering & Craft Services', href: `${p}/pro/catering`, icon: 'catering', pro: true },
        { label: 'Sustainability', href: `${p}/pro/sustainability`, icon: 'sustainability', pro: true },
        { label: 'Extras / Background Casting', href: `${p}/pro/extras`, icon: 'extras', pro: true },
        { label: 'Equipment Rentals', href: `${p}/pro/equipment`, icon: 'equipment', pro: true },
        { label: 'Wrap & Completion', href: `${p}/pro/wrap`, icon: 'wrap', pro: true },
        { label: 'Production Newsletter', href: `${p}/pro/newsletter`, icon: 'newsletter', pro: true },
        { label: 'Dailies', href: `${p}/pro/dailies`, icon: 'dailies', pro: true },
        { label: 'Delivery Checklist', href: `${p}/pro/deliverables`, icon: 'deliverables', pro: true },
        { label: 'Unions & Guilds', href: `${p}/pro/unions`, icon: 'unions', pro: true },
        { label: 'Residuals & Royalties', href: `${p}/pro/residuals`, icon: 'residuals', pro: true },
        { label: 'Test Screenings', href: `${p}/pro/screenings`, icon: 'screenings', pro: true },
      ],
    },
    ...(!isViewer ? [{ category: '', items: [
      { label: 'Showcase', href: `${p}/showcase`, icon: 'showcase', always: true },
      { label: 'Settings', href: `${p}/settings`, icon: 'settings', always: true },
    ] }] : []),
  ];
}

function contentCreatorNav(p: string): NavCategory[] {
  return [
    { category: '', items: [{ label: 'Overview', href: p, icon: 'overview', always: true }] },
    {
      category: 'Script',
      items: [
        { label: 'Script', href: `${p}/script`, icon: 'script', always: true },
        { label: 'Ideas', href: `${p}/ideas`, icon: 'ideas', always: true },
        { label: 'Worldbuilding', href: `${p}/worldbuilding`, icon: 'worldbuilding', always: true },
        { label: 'Documents', href: `${p}/documents`, icon: 'documents', always: true },
      ],
    },
    {
      category: 'Video',
      items: [
        { label: 'Thumbnails', href: `${p}/thumbnails`, icon: 'thumbnails', always: true },
        { label: 'B-Roll', href: `${p}/broll`, icon: 'shots', always: true },
        { label: 'Storyboard', href: `${p}/storyboard`, icon: 'storyboard', always: true },
        { label: 'Mood Board', href: `${p}/moodboard`, icon: 'moodboard', always: true },
        { label: 'Mind Map', href: `${p}/mindmap`, icon: 'mindmap', always: true },
        { label: 'Shot List', href: `${p}/shots`, icon: 'shots', always: true },
      ],
    },
    {
      category: 'Publish',
      items: [
        { label: 'SEO & Metadata', href: `${p}/seo`, icon: 'seo', always: true },
        { label: 'Sponsors', href: `${p}/sponsors`, icon: 'sponsors', always: true },
        { label: 'Checklist', href: `${p}/checklist`, icon: 'checklist', always: true },
        { label: 'Schedule', href: `${p}/schedule`, icon: 'schedule', production: true },
      ],
    },
    {
      category: 'Collaboration',
      items: [
        { label: 'Chat', href: `${p}/chat`, icon: 'chat', collab: true },
        { label: 'Comments', href: `${p}/comments`, icon: 'comments', collab: true },
        { label: 'Team', href: `${p}/team`, icon: 'team', collab: true },
        { label: 'Set Quotes', href: `${p}/quotes`, icon: 'quotes', always: true },
      ],
    },
    {
      category: 'Finish',
      items: [
        { label: 'Share', href: `${p}/share`, icon: 'share', always: true },
        { label: 'Analytics', href: `${p}/analytics`, icon: 'analytics', always: true },
        { label: 'Revisions', href: `${p}/revisions`, icon: 'revisions', always: true },
        { label: 'Export', href: `${p}/export`, icon: 'export', always: true },
        { label: 'Script Analysis', href: `${p}/ai-analysis`, icon: 'ai', always: true },
        { label: 'Brand Kit', href: `${p}/branding`, icon: 'branding', always: true },
        { label: 'Casting', href: `${p}/casting`, icon: 'casting', always: true },
        { label: 'Actors', href: `${p}/actors`, icon: 'actors', always: true },
      ],
    },
    {
      category: 'Pro Tools',
      items: [
        { label: 'Portfolio', href: `${p}/pro/portfolio`, icon: 'portfolio', pro: true },
        { label: 'Production Accounting', href: `${p}/pro/accounting`, icon: 'accounting', pro: true },
        { label: 'Rights & Clearances', href: `${p}/pro/rights`, icon: 'rights', pro: true },
        { label: 'Distribution Pipeline', href: `${p}/pro/distribution`, icon: 'distribution', pro: true },
        { label: 'Crew Portal', href: `${p}/pro/crew-portal`, icon: 'crew-portal', pro: true },
        { label: 'Departments', href: `${p}/pro/departments`, icon: 'departments', pro: true },
        { label: 'Insurance & Compliance', href: `${p}/pro/compliance`, icon: 'compliance', pro: true },
        { label: 'Script Supervising', href: `${p}/pro/script-supervising`, icon: 'script-supervising', pro: true },
        { label: 'VFX Tracking', href: `${p}/pro/vfx-tracking`, icon: 'vfx-tracking', pro: true },
        { label: 'Music & Sound', href: `${p}/pro/music-sound`, icon: 'music-sound', pro: true },
        { label: 'Talent Management', href: `${p}/pro/talent`, icon: 'talent', pro: true },
        { label: 'Location Scouting', href: `${p}/pro/locations`, icon: 'scouting', pro: true },
        { label: 'Vendor Management', href: `${p}/pro/vendors`, icon: 'vendors', pro: true },
        { label: 'Stunts & Safety', href: `${p}/pro/safety`, icon: 'stunts', pro: true },
        { label: 'Greenlight & Financing', href: `${p}/pro/greenlight`, icon: 'greenlight', pro: true },
        { label: 'Festival Strategy', href: `${p}/pro/festival`, icon: 'festival', pro: true },
        { label: 'Tax Incentives', href: `${p}/pro/tax-incentives`, icon: 'tax-incentives', pro: true },
        { label: 'Multi-Language', href: `${p}/pro/multilang`, icon: 'multilang', pro: true },
        { label: 'Broadcast Compliance', href: `${p}/pro/broadcast-compliance`, icon: 'broadcast-compliance', pro: true },
        { label: 'Archival', href: `${p}/pro/archival`, icon: 'archival', pro: true },
        { label: 'Post-Production', href: `${p}/pro/post-production`, icon: 'post-production', pro: true },
        { label: 'Marketing & PR', href: `${p}/pro/marketing`, icon: 'marketing', pro: true },
        { label: 'Legal & Contracts', href: `${p}/pro/legal`, icon: 'legal', pro: true },
        { label: 'Crowdfunding', href: `${p}/pro/crowdfunding`, icon: 'crowdfunding', pro: true },
        { label: 'Box Office & Revenue', href: `${p}/pro/box-office`, icon: 'box-office', pro: true },
        { label: 'Travel & Accommodations', href: `${p}/pro/travel`, icon: 'travel', pro: true },
        { label: 'Catering & Craft Services', href: `${p}/pro/catering`, icon: 'catering', pro: true },
        { label: 'Sustainability', href: `${p}/pro/sustainability`, icon: 'sustainability', pro: true },
        { label: 'Extras / Background Casting', href: `${p}/pro/extras`, icon: 'extras', pro: true },
        { label: 'Equipment Rentals', href: `${p}/pro/equipment`, icon: 'equipment', pro: true },
        { label: 'Wrap & Completion', href: `${p}/pro/wrap`, icon: 'wrap', pro: true },
        { label: 'Production Newsletter', href: `${p}/pro/newsletter`, icon: 'newsletter', pro: true },
        { label: 'Dailies', href: `${p}/pro/dailies`, icon: 'dailies', pro: true },
        { label: 'Delivery Checklist', href: `${p}/pro/deliverables`, icon: 'deliverables', pro: true },
        { label: 'Unions & Guilds', href: `${p}/pro/unions`, icon: 'unions', pro: true },
        { label: 'Residuals & Royalties', href: `${p}/pro/residuals`, icon: 'residuals', pro: true },
        { label: 'Test Screenings', href: `${p}/pro/screenings`, icon: 'screenings', pro: true },
      ],
    },
  ];
}
