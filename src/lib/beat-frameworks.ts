/**
 * Story structure frameworks for the Beat Sheet.
 *
 * Shared by the Beat Sheet page and the MCP server, so a beat Claude fills in
 * over MCP lands on the same beat id the page renders.
 *
 * Saved beat sheets live in projects.content_metadata.beat_sheets.{scope},
 * where scope is 'project', 'ep_{scriptId}' or 'season_{n}'.
 */

export type FrameworkKey = 'save_the_cat' | 'three_act' | 'hero_journey' | 'seven_point' | 'story_circle' | 'freytag' | 'kishotenketsu' | `custom_${string}`;

export interface Beat {
  id: string;
  label: string;
  description: string;
  pageHint: string;
  pagePercent: number;
  color: string;
  notes: string;
  scenes: string[];
}

export interface BeatSheetData {
  framework: FrameworkKey;
  totalPages: number;
  beats: Record<string, { notes: string; scenes: string[]; customPage?: number; linkedSceneIds?: string[]; completed?: boolean }>;
}

export const SAVE_THE_CAT: Beat[] = [
  { id: 'opening_image',   label: 'Opening Image',      description: 'A snapshot of the hero\'s flawed world before the journey begins.',                        pageHint: 'p. 1',      pagePercent: 1,   color: '#6366f1', notes: '', scenes: [] },
  { id: 'theme_stated',    label: 'Theme Stated',       description: 'Someone (not the hero) hints at what the story is about — the lesson to be learned.',       pageHint: 'p. 5',      pagePercent: 4,   color: '#8b5cf6', notes: '', scenes: [] },
  { id: 'setup',           label: 'Set-Up',             description: 'Introduce the hero\'s world, supporting characters, and hint at all six things that need fixing.',   pageHint: 'p. 1–10',  pagePercent: 6,   color: '#a78bfa', notes: '', scenes: [] },
  { id: 'catalyst',        label: 'Catalyst',           description: 'A life-changing event that disrupts the hero\'s world and forces a decision.',             pageHint: 'p. 12',     pagePercent: 10,  color: '#ec4899', notes: '', scenes: [] },
  { id: 'debate',          label: 'Debate',             description: 'The hero wrestles with the choice: should they cross into Act Two?',                      pageHint: 'p. 12–25', pagePercent: 16,  color: '#f97316', notes: '', scenes: [] },
  { id: 'break_into_two',  label: 'Break Into Two',     description: 'The hero makes a choice and steps into Act Two — an upside-down version of their world.', pageHint: 'p. 25',     pagePercent: 21,  color: '#eab308', notes: '', scenes: [] },
  { id: 'b_story',         label: 'B Story',            description: 'A new subplot (often love interest) that carries the theme. The "helper" who teaches the hero.', pageHint: 'p. 30',     pagePercent: 25,  color: '#22c55e', notes: '', scenes: [] },
  { id: 'fun_and_games',   label: 'Fun & Games',        description: 'The promise of the premise. The hero tries and fails, learns the new world rules.',       pageHint: 'p. 30–55', pagePercent: 38,  color: '#10b981', notes: '', scenes: [] },
  { id: 'midpoint',        label: 'Midpoint',           description: 'A false victory or defeat. Stakes are raised. Hero\'s goal shifts from want to need.',    pageHint: 'p. 55',     pagePercent: 50,  color: '#14b8a6', notes: '', scenes: [] },
  { id: 'bad_guys_close',  label: 'Bad Guys Close In',  description: 'The opposition regroups. Internal doubts surface. The hero\'s team starts to fall apart.',  pageHint: 'p. 55–75', pagePercent: 62,  color: '#3b82f6', notes: '', scenes: [] },
  { id: 'all_is_lost',     label: 'All Is Lost',        description: 'The worst moment. The hero loses everything. Often features a "whiff of death".',          pageHint: 'p. 75',     pagePercent: 75,  color: '#ef4444', notes: '', scenes: [] },
  { id: 'dark_night',      label: 'Dark Night of the Soul', description: 'The hero wallows in hopelessness. The old world solution won\'t work here.',         pageHint: 'p. 75–85', pagePercent: 79,  color: '#dc2626', notes: '', scenes: [] },
  { id: 'break_into_three',label: 'Break Into Three',   description: 'A synthesis of Act One and Two. The hero discovers the solution using both worlds.',       pageHint: 'p. 85',     pagePercent: 83,  color: '#9333ea', notes: '', scenes: [] },
  { id: 'finale',          label: 'Finale',             description: 'Hero storms the castle using new skills. The bad guys are defeated for good.',            pageHint: 'p. 85–110',pagePercent: 91,  color: '#7c3aed', notes: '', scenes: [] },
  { id: 'final_image',     label: 'Final Image',        description: 'Mirror of the opening image. Shows how much the hero has changed.',                       pageHint: 'p. 110',    pagePercent: 99,  color: '#6d28d9', notes: '', scenes: [] },
];

export const THREE_ACT: Beat[] = [
  { id: 'act1_setup',      label: 'Act 1 — Set-Up',         description: 'Establish world, characters, stakes. End with inciting incident or turning point.',    pageHint: 'p. 1–25',   pagePercent: 12,  color: '#6366f1', notes: '', scenes: [] },
  { id: 'inciting',        label: 'Inciting Incident',      description: 'The event that kicks off the main conflict and locks the hero into the journey.',       pageHint: 'p. 12',     pagePercent: 10,  color: '#ec4899', notes: '', scenes: [] },
  { id: 'act1_break',      label: 'Act 1 Break',            description: 'Point of no return. Hero crosses into Act 2.',                                         pageHint: 'p. 25',     pagePercent: 21,  color: '#f97316', notes: '', scenes: [] },
  { id: 'act2a',           label: 'Act 2A — Rising Action',  description: 'Hero pursues goal. Obstacles escalate. Allies and enemies defined.',                   pageHint: 'p. 25–60', pagePercent: 37,  color: '#22c55e', notes: '', scenes: [] },
  { id: 'midpoint2',       label: 'Midpoint',               description: 'Major shift — up or down. Stakes double.',                                             pageHint: 'p. 55–60', pagePercent: 50,  color: '#14b8a6', notes: '', scenes: [] },
  { id: 'act2b',           label: 'Act 2B — Complications', description: 'Hero\'s situation deteriorates. Major reversal or revelation.',                         pageHint: 'p. 60–85', pagePercent: 65,  color: '#3b82f6', notes: '', scenes: [] },
  { id: 'climax_lead',     label: 'Act 2 Break / Low Point', description: 'Darkest moment. Everything is lost. Hero must change to survive.',                    pageHint: 'p. 85',     pagePercent: 75,  color: '#ef4444', notes: '', scenes: [] },
  { id: 'act3',            label: 'Act 3 — Resolution',     description: 'Final confrontation. Hero uses new understanding to overcome antagonist.',              pageHint: 'p. 85–110',pagePercent: 88,  color: '#9333ea', notes: '', scenes: [] },
  { id: 'resolution',      label: 'Resolution / Denouement','description': 'New equilibrium. Show the aftermath and changed world.',                              pageHint: 'p. 110',    pagePercent: 98,  color: '#7c3aed', notes: '', scenes: [] },
];

export const HERO_JOURNEY: Beat[] = [
  { id: 'ordinary_world',  label: 'Ordinary World',         description: 'Hero\'s everyday life before the adventure.',                                          pageHint: 'p. 1–10',  pagePercent: 5,   color: '#6366f1', notes: '', scenes: [] },
  { id: 'call_adventure',  label: 'Call to Adventure',      description: 'Problem or challenge presented to the hero.',                                          pageHint: 'p. 10–15', pagePercent: 12,  color: '#8b5cf6', notes: '', scenes: [] },
  { id: 'refusal',         label: 'Refusal of the Call',    description: 'Hero\'s hesitation or initial resistance.',                                             pageHint: 'p. 15–20', pagePercent: 17,  color: '#a78bfa', notes: '', scenes: [] },
  { id: 'mentor',          label: 'Meeting the Mentor',     description: 'Hero gains guidance, tools, or confidence from a wise figure.',                         pageHint: 'p. 20–25', pagePercent: 21,  color: '#ec4899', notes: '', scenes: [] },
  { id: 'threshold',       label: 'Crossing the Threshold', description: 'Hero leaves the ordinary world and enters the special world.',                          pageHint: 'p. 25',     pagePercent: 25,  color: '#f97316', notes: '', scenes: [] },
  { id: 'tests',           label: 'Tests, Allies, Enemies', description: 'Hero learns the rules of the special world. Gains companions, faces threats.',           pageHint: 'p. 25–55', pagePercent: 38,  color: '#22c55e', notes: '', scenes: [] },
  { id: 'innermost_cave',  label: 'Approach the Inmost Cave','description': 'Hero approaches the central ordeal location, preparing for the big challenge.',      pageHint: 'p. 55',     pagePercent: 50,  color: '#14b8a6', notes: '', scenes: [] },
  { id: 'ordeal',          label: 'The Ordeal',             description: 'The central crisis. Hero faces death (literal or metaphorical) and is transformed.',    pageHint: 'p. 60–70', pagePercent: 60,  color: '#ef4444', notes: '', scenes: [] },
  { id: 'reward',          label: 'The Reward',             description: 'Hero seizes the sword — achieves the goal or claim the prize.',                         pageHint: 'p. 70–80', pagePercent: 72,  color: '#3b82f6', notes: '', scenes: [] },
  { id: 'road_back',       label: 'The Road Back',          description: 'Hero begins the journey home. Chased or pursued; final choices made.',                  pageHint: 'p. 80–90', pagePercent: 82,  color: '#f97316', notes: '', scenes: [] },
  { id: 'resurrection',    label: 'Resurrection',           description: 'Climactic final test. Hero is reborn / transformed. Final confrontation.',               pageHint: 'p. 90–105',pagePercent: 90,  color: '#dc2626', notes: '', scenes: [] },
  { id: 'return_elixir',   label: 'Return with the Elixir', description: 'Hero returns transformed, with knowledge or treasure to share with ordinary world.',    pageHint: 'p. 105–110',pagePercent: 98, color: '#7c3aed', notes: '', scenes: [] },
];

// Structures common in prose fiction. Hints are percentages, since a novel's
// length is counted in words rather than screenplay pages.
export const SEVEN_POINT: Beat[] = [
  { id: 'sp_hook',        label: 'Hook',              description: 'The starting state: the protagonist before the story changes them — often the opposite of the resolution.', pageHint: '0–5%',   pagePercent: 2,  color: '#6366f1', notes: '', scenes: [] },
  { id: 'sp_turn1',       label: 'Plot Turn 1',       description: 'The call to adventure: something new enters and sets the story moving.',                                  pageHint: '~15%',   pagePercent: 15, color: '#ec4899', notes: '', scenes: [] },
  { id: 'sp_pinch1',      label: 'Pinch 1',           description: 'Pressure applied: the antagonist shows its strength and forces the protagonist to act.',                  pageHint: '~35%',   pagePercent: 35, color: '#f97316', notes: '', scenes: [] },
  { id: 'sp_midpoint',    label: 'Midpoint',          description: 'The protagonist moves from reacting to acting — they decide to take the fight to the problem.',           pageHint: '50%',    pagePercent: 50, color: '#14b8a6', notes: '', scenes: [] },
  { id: 'sp_pinch2',      label: 'Pinch 2',           description: 'More pressure: the plan fails, allies fall away, the jaws of defeat close.',                              pageHint: '~65%',   pagePercent: 65, color: '#ef4444', notes: '', scenes: [] },
  { id: 'sp_turn2',       label: 'Plot Turn 2',       description: 'The final piece: the protagonist gets what they need to win.',                                           pageHint: '~85%',   pagePercent: 85, color: '#9333ea', notes: '', scenes: [] },
  { id: 'sp_resolution',  label: 'Resolution',        description: 'The climax and new state: everything the story has built pays off.',                                     pageHint: '90–100%', pagePercent: 96, color: '#7c3aed', notes: '', scenes: [] },
];

export const STORY_CIRCLE: Beat[] = [
  { id: 'sc_you',     label: '1. You',     description: 'A character in a zone of comfort.',              pageHint: '0–12%',   pagePercent: 6,  color: '#6366f1', notes: '', scenes: [] },
  { id: 'sc_need',    label: '2. Need',    description: 'But they want something.',                       pageHint: '12–25%',  pagePercent: 18, color: '#8b5cf6', notes: '', scenes: [] },
  { id: 'sc_go',      label: '3. Go',      description: 'They enter an unfamiliar situation.',            pageHint: '25–37%',  pagePercent: 31, color: '#ec4899', notes: '', scenes: [] },
  { id: 'sc_search',  label: '4. Search',  description: 'Adapt to it.',                                   pageHint: '37–50%',  pagePercent: 43, color: '#f97316', notes: '', scenes: [] },
  { id: 'sc_find',    label: '5. Find',    description: 'Get what they wanted.',                          pageHint: '50–62%',  pagePercent: 56, color: '#14b8a6', notes: '', scenes: [] },
  { id: 'sc_take',    label: '6. Take',    description: 'Pay a heavy price for it.',                      pageHint: '62–75%',  pagePercent: 68, color: '#ef4444', notes: '', scenes: [] },
  { id: 'sc_return',  label: '7. Return',  description: 'Return to their familiar situation.',            pageHint: '75–87%',  pagePercent: 81, color: '#3b82f6', notes: '', scenes: [] },
  { id: 'sc_change',  label: '8. Change',  description: 'Having changed.',                                pageHint: '87–100%', pagePercent: 94, color: '#7c3aed', notes: '', scenes: [] },
];

export const FREYTAG: Beat[] = [
  { id: 'fr_exposition',  label: 'Exposition',      description: 'Setting, characters and the situation before conflict.',          pageHint: '0–12%',   pagePercent: 6,  color: '#6366f1', notes: '', scenes: [] },
  { id: 'fr_inciting',    label: 'Inciting Moment', description: 'The event that begins the conflict.',                            pageHint: '~12%',    pagePercent: 12, color: '#ec4899', notes: '', scenes: [] },
  { id: 'fr_rising',      label: 'Rising Action',   description: 'Complications build; tension and stakes climb.',                 pageHint: '12–50%',  pagePercent: 30, color: '#f97316', notes: '', scenes: [] },
  { id: 'fr_climax',      label: 'Climax',          description: 'The turning point: the peak of tension, after which fortunes reverse.', pageHint: '~50–60%', pagePercent: 55, color: '#ef4444', notes: '', scenes: [] },
  { id: 'fr_falling',     label: 'Falling Action',  description: 'Consequences of the climax unwind; a last moment of suspense.',    pageHint: '60–88%',  pagePercent: 74, color: '#3b82f6', notes: '', scenes: [] },
  { id: 'fr_denouement',  label: 'Dénouement',      description: 'Conflict resolved; a new normal, or catastrophe in a tragedy.',     pageHint: '88–100%', pagePercent: 94, color: '#7c3aed', notes: '', scenes: [] },
];

export const KISHOTENKETSU: Beat[] = [
  { id: 'ki_ki',      label: 'Ki — Introduction', description: 'Characters and setting are introduced.',                                     pageHint: '0–25%',   pagePercent: 12, color: '#6366f1', notes: '', scenes: [] },
  { id: 'ki_sho',     label: 'Shō — Development', description: 'The situation deepens; we follow the characters without major conflict.',   pageHint: '25–50%',  pagePercent: 37, color: '#14b8a6', notes: '', scenes: [] },
  { id: 'ki_ten',     label: 'Ten — Twist',       description: 'An unexpected turn that recasts what came before.',                        pageHint: '50–75%',  pagePercent: 62, color: '#ec4899', notes: '', scenes: [] },
  { id: 'ki_ketsu',   label: 'Ketsu — Reconciliation', description: 'The parts come together; the twist and the setup make a new whole.',   pageHint: '75–100%', pagePercent: 88, color: '#7c3aed', notes: '', scenes: [] },
];

export const BUILTIN_FRAMEWORKS: Record<string, { label: string; beats: Beat[] }> = {
  save_the_cat:  { label: 'Save the Cat',     beats: SAVE_THE_CAT },
  three_act:     { label: 'Three-Act',        beats: THREE_ACT },
  hero_journey:  { label: "Hero's Journey",   beats: HERO_JOURNEY },
  seven_point:   { label: 'Seven-Point',      beats: SEVEN_POINT },
  story_circle:  { label: 'Story Circle',     beats: STORY_CIRCLE },
  freytag:       { label: "Freytag's Pyramid", beats: FREYTAG },
  kishotenketsu: { label: 'Kishōtenketsu',    beats: KISHOTENKETSU },
};
