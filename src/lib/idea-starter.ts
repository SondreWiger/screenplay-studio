/**
 * Idea Starter — turns a raw idea into a first plan, shaped by the project's
 * format. Every kit is plain data: a pitch builder, the questions that format
 * has to answer early, a starter structure and a handful of "what if" sparks.
 */

export type PitchField = { key: string; label: string; placeholder: string };
export type StarterQuestion = { key: string; q: string; hint: string };
export type StarterBeat = { title: string; prompt: string };

export type StarterKit = {
  id: string;
  name: string;
  tagline: string;
  /** What this format asks of an idea: length, shape, constraints. */
  formatNotes: string[];
  pitch: { label: string; template: string; fields: PitchField[] };
  questions: StarterQuestion[];
  structure: { label: string; beats: StarterBeat[] };
  sparks: string[];
};

const LOGLINE_FIELDS: PitchField[] = [
  { key: 'hero', label: 'Who', placeholder: 'a burned-out paramedic' },
  { key: 'incident', label: 'What happens', placeholder: 'a patient dies and wakes up again' },
  { key: 'goal', label: 'They must', placeholder: 'find out who keeps bringing people back' },
  { key: 'stakes', label: 'Or else', placeholder: 'the whole city stops being able to die' },
];

const KITS: Record<string, StarterKit> = {
  screenplay: {
    id: 'screenplay',
    name: 'Feature film',
    tagline: 'One story, one protagonist, about 90–120 pages.',
    formatNotes: [
      'Roughly one page per minute; most features land between 90 and 120 pages.',
      'Film is visual: think in what we see and hear, not what characters think.',
      'A clear protagonist with a want, a need and a ticking clock carries the whole thing.',
      'Budget is part of the idea. Count locations, crowds, effects and night shoots early.',
    ],
    pitch: {
      label: 'Logline',
      template: 'When {incident}, {hero} must {goal} before {stakes}.',
      fields: LOGLINE_FIELDS,
    },
    questions: [
      { key: 'want', q: 'What does your protagonist want, and what do they actually need?', hint: 'The gap between the two is usually the arc.' },
      { key: 'opponent', q: 'Who or what stands in the way?', hint: 'The strongest opponents want the same thing, or the opposite.' },
      { key: 'why_now', q: 'Why does this story start today and not a year ago?', hint: 'That is your inciting incident.' },
      { key: 'ending', q: 'How might it end?', hint: 'Knowing the last image makes the first one easier.' },
      { key: 'genre', q: 'What genre is it, and what does the audience expect from it?', hint: 'Then decide which expectation you will break.' },
      { key: 'theme', q: 'What is it really about underneath the plot?', hint: 'One word is enough: trust, grief, ambition…' },
    ],
    structure: {
      label: 'Three-act outline',
      beats: [
        { title: 'Opening image', prompt: 'The world and the protagonist before anything changes.' },
        { title: 'Inciting incident', prompt: 'The event that knocks life off balance (around page 10–12).' },
        { title: 'Break into Act Two', prompt: 'The choice that commits them to the journey (around page 25).' },
        { title: 'Midpoint', prompt: 'A false victory or false defeat that raises the stakes.' },
        { title: 'All is lost', prompt: 'The lowest point. What do they lose?' },
        { title: 'Climax', prompt: 'The final confrontation where want and need collide.' },
        { title: 'Final image', prompt: 'A mirror of the opening that shows what changed.' },
      ],
    },
    sparks: [
      'What if the protagonist is the cause of the problem without knowing it?',
      'What if the whole story had to happen in 24 hours?',
      'What if you told it from the antagonist’s point of view?',
      'What if the setting moved to the most unlikely place for this genre?',
      'What if the protagonist got what they want at the midpoint, and it ruins everything?',
      'What if the mentor character is lying?',
      'What if you cut it down to two locations?',
    ],
  },

  episodic: {
    id: 'episodic',
    name: 'TV series',
    tagline: 'A pilot plus an engine that can run for seasons.',
    formatNotes: [
      'A one-hour drama pilot is about 50–65 pages; a half-hour comedy around 25–35.',
      'The pilot sells the series engine: why this keeps producing stories every week.',
      'Plan in A, B and C stories, and plot act-outs that make people keep watching.',
      'An ensemble with conflicting goals is easier to sustain than one hero.',
    ],
    pitch: {
      label: 'Series logline',
      template: '{premise}. Every week, {engine}, while {season_arc}.',
      fields: [
        { key: 'premise', label: 'Premise', placeholder: 'A disgraced chef takes over a prison kitchen' },
        { key: 'engine', label: 'Every week', placeholder: 'a new inmate’s meal request uncovers a secret' },
        { key: 'season_arc', label: 'Season arc', placeholder: 'she plans the escape she was sent in to prevent' },
      ],
    },
    questions: [
      { key: 'engine', q: 'What generates a new story every episode?', hint: 'A case, a patient, a customer, a mission…' },
      { key: 'ensemble', q: 'Who is in the core ensemble, and how do they clash?', hint: 'Give each of them a different answer to the same question.' },
      { key: 'season', q: 'What is the season-one question?', hint: 'Something the finale answers.' },
      { key: 'world', q: 'Where do we spend most of our time?', hint: 'A standing set saves money and builds familiarity.' },
      { key: 'tone', q: 'Which shows does it sit next to, and how is it different?', hint: '“X meets Y” is fine for now.' },
    ],
    structure: {
      label: 'Pilot outline',
      beats: [
        { title: 'Teaser / cold open', prompt: 'A hook that shows the tone and the world in two to four pages.' },
        { title: 'Act One', prompt: 'Meet the lead and the status quo, then disrupt it.' },
        { title: 'Act Two', prompt: 'The engine kicks in: show what a typical episode looks like.' },
        { title: 'Act Three', prompt: 'Complications in the A and B stories collide.' },
        { title: 'Act Four', prompt: 'Resolve this episode’s story.' },
        { title: 'Tag', prompt: 'A final twist that opens the season arc.' },
      ],
    },
    sparks: [
      'What if every episode were told from a different character’s point of view?',
      'What if the pilot ends by killing off who we assumed was the lead?',
      'What if the series takes place over one single day, across the whole season?',
      'What if the workplace is about to close and every episode is a countdown?',
      'What if two characters share a secret the audience learns before them?',
    ],
  },

  stageplay: {
    id: 'stageplay',
    name: 'Stage play',
    tagline: 'Live bodies in one room, in real time.',
    formatNotes: [
      'Theatre lives on dialogue and presence. What can only happen live?',
      'Fewer sets and a small cast make it far easier to produce.',
      'One-acts run 10–60 minutes; full-length plays usually 90 minutes to two hours.',
      'Think about the audience relationship: fourth wall, direct address, participation.',
    ],
    pitch: {
      label: 'Pitch',
      template: 'In {setting}, {characters} {conflict}, until {turn}.',
      fields: [
        { key: 'setting', label: 'Where', placeholder: 'a shuttered village hall on election night' },
        { key: 'characters', label: 'Who', placeholder: 'three sisters who haven’t spoken in a decade' },
        { key: 'conflict', label: 'Conflict', placeholder: 'have to count the votes by hand' },
        { key: 'turn', label: 'Until', placeholder: 'one of them admits she rigged the last one' },
      ],
    },
    questions: [
      { key: 'room', q: 'What is the room, and why can’t they leave?', hint: 'A trapped setting creates pressure.' },
      { key: 'cast', q: 'How many actors, and could any double roles?', hint: 'Two to six is the sweet spot for new work.' },
      { key: 'live', q: 'What happens on stage that would be weaker on film?', hint: 'Time, transformation, direct address, the audience itself.' },
      { key: 'want', q: 'What does each character want from the others right now?', hint: 'Every scene is a negotiation.' },
      { key: 'staging', q: 'Any big theatrical image you want to build towards?', hint: 'A set reveal, a lighting change, a moment of silence.' },
    ],
    structure: {
      label: 'Act outline',
      beats: [
        { title: 'Lights up', prompt: 'Who is on stage, and what are they in the middle of?' },
        { title: 'Arrival / disruption', prompt: 'Someone enters or something is revealed.' },
        { title: 'Rising pressure', prompt: 'Alliances shift; the room gets smaller.' },
        { title: 'Interval turn', prompt: 'If two acts: the cliffhanger that brings people back.' },
        { title: 'Confrontation', prompt: 'The truth comes out.' },
        { title: 'Final tableau', prompt: 'The last image before blackout.' },
      ],
    },
    sparks: [
      'What if one character speaks only to the audience?',
      'What if the play happens in real time with no scene breaks?',
      'What if the set slowly falls apart during the show?',
      'What if one actor plays every man and another every woman?',
      'What if the audience is cast as a jury, congregation or crowd?',
    ],
  },

  sketch: {
    id: 'sketch',
    name: 'Comedy sketch',
    tagline: 'One funny idea, played and heightened.',
    formatNotes: [
      'Most sketches run two to five minutes, often three to six pages.',
      'Find the “game”: the one unusual thing, then repeat and escalate it.',
      'Establish the normal world fast so the unusual thing stands out.',
      'End on a button: a final twist or callback, not a fizzle.',
    ],
    pitch: {
      label: 'The game',
      template: 'In {normal}, {unusual}, and it keeps getting worse because {heighten}.',
      fields: [
        { key: 'normal', label: 'Normal world', placeholder: 'a job interview' },
        { key: 'unusual', label: 'Unusual thing', placeholder: 'the candidate answers every question with a pun' },
        { key: 'heighten', label: 'Heightening', placeholder: 'the interviewer starts to love it' },
      ],
    },
    questions: [
      { key: 'game', q: 'What is the single unusual thing?', hint: 'If you need two sentences, there may be two sketches.' },
      { key: 'straight', q: 'Who is the straight person reacting to it?', hint: 'The audience needs someone to share their surprise.' },
      { key: 'beats', q: 'List three escalations, each bigger than the last.', hint: 'Small, bigger, absurd.' },
      { key: 'button', q: 'How does it end?', hint: 'A reversal, a callback or the logical extreme.' },
    ],
    structure: {
      label: 'Sketch beats',
      beats: [
        { title: 'Base reality', prompt: 'Set up the normal situation in a few lines.' },
        { title: 'First unusual thing', prompt: 'Introduce the game.' },
        { title: 'Heighten #1', prompt: 'Do it again, bigger.' },
        { title: 'Heighten #2', prompt: 'Raise the stakes or add a new angle.' },
        { title: 'Peak', prompt: 'The most absurd version of the game.' },
        { title: 'Button', prompt: 'The final joke and out.' },
      ],
    },
    sparks: [
      'What if the straight person is secretly the strangest one?',
      'What if it’s played completely seriously, like a drama?',
      'What if it’s set in a historical period?',
      'What if the game flips halfway through?',
      'What if the button is a callback to the first line?',
    ],
  },

  comic: {
    id: 'comic',
    name: 'Comic / graphic novel',
    tagline: 'Story told in pages and panels.',
    formatNotes: [
      'Think in page turns: odd pages end on a hook, even pages reveal.',
      'Four to six panels a page is a common rhythm; splash pages are for big moments.',
      'Keep captions and balloons lean. The art carries the action.',
      'Single issues usually run 20–24 pages; graphic novels 100 pages and up.',
    ],
    pitch: {
      label: 'Pitch',
      template: 'When {incident}, {hero} must {goal} before {stakes}.',
      fields: LOGLINE_FIELDS,
    },
    questions: [
      { key: 'visual', q: 'What is the signature image of this comic?', hint: 'The cover you can already picture.' },
      { key: 'style', q: 'What art style fits it?', hint: 'Clean line, painterly, manga, noir black and white…' },
      { key: 'length', q: 'Is it a one-shot, a mini-series or ongoing?', hint: 'That decides the pacing.' },
      { key: 'world', q: 'What can only exist in drawings?', hint: 'Scale, impossible creatures, worlds no budget could afford.' },
      { key: 'hero', q: 'Who is your lead, and how do we recognise them in silhouette?', hint: 'Distinctive shapes read instantly.' },
    ],
    structure: {
      label: 'Issue plan',
      beats: [
        { title: 'Page 1 hook', prompt: 'An opening panel that grabs attention.' },
        { title: 'Pages 2–5', prompt: 'Set up the lead and their world.' },
        { title: 'First page-turn reveal', prompt: 'A surprise on an even page.' },
        { title: 'Middle pages', prompt: 'Complications and action set pieces.' },
        { title: 'Splash page', prompt: 'The single biggest image of the issue.' },
        { title: 'Final page', prompt: 'A cliffhanger that sells the next issue.' },
      ],
    },
    sparks: [
      'What if one whole page has no words at all?',
      'What if the panel layout changes as the hero loses control?',
      'What if the narrator is a background character?',
      'What if each chapter is drawn in a different style?',
      'What if the story runs backwards from the last page?',
    ],
  },

  podcast: {
    id: 'podcast',
    name: 'Podcast',
    tagline: 'A voice, a format and a reason to subscribe.',
    formatNotes: [
      'Listeners decide in the first 60 seconds. Lead with your best moment.',
      'A repeatable format (segments, a recurring question) makes episodes easier to make.',
      'Plan ad breaks and sponsor reads at natural pauses.',
      'Audio only: describe anything visual, and say who is talking.',
    ],
    pitch: {
      label: 'Show pitch',
      template: '{show} is a podcast where {host} {format} for {audience}.',
      fields: [
        { key: 'show', label: 'Show name', placeholder: 'Night Shift' },
        { key: 'host', label: 'Host(s)', placeholder: 'two ex-nurses' },
        { key: 'format', label: 'Format', placeholder: 'retell the strangest cases from their careers' },
        { key: 'audience', label: 'For', placeholder: 'true-crime fans who want something lighter' },
      ],
    },
    questions: [
      { key: 'audience', q: 'Who is listening, and when?', hint: 'Commute, gym and bedtime each want a different length.' },
      { key: 'format', q: 'Interview, conversation, narrative or panel?', hint: 'Pick one for the first season.' },
      { key: 'length', q: 'How long is an episode, and how often does one come out?', hint: 'Consistency beats length.' },
      { key: 'segments', q: 'What recurring segments could you have?', hint: 'Listener mail, a quick-fire round, a weekly pick.' },
      { key: 'episodes', q: 'List five episode ideas.', hint: 'If five come easily, the show has legs.' },
    ],
    structure: {
      label: 'Episode run-down',
      beats: [
        { title: 'Cold open', prompt: 'The best 30 seconds of the episode.' },
        { title: 'Intro & theme', prompt: 'Show name, hosts and today’s topic.' },
        { title: 'Segment 1', prompt: 'The main conversation or story.' },
        { title: 'Ad / sponsor break', prompt: 'Where it fits naturally.' },
        { title: 'Segment 2', prompt: 'A twist, a guest or a recurring bit.' },
        { title: 'Outro & call to action', prompt: 'Subscribe, review, next week’s tease.' },
      ],
    },
    sparks: [
      'What if every episode starts with a listener’s voicemail?',
      'What if each season covers only one topic in depth?',
      'What if the hosts swap roles every episode?',
      'What if you recorded on location instead of in a studio?',
      'What if there’s a running bet that pays off in the finale?',
    ],
  },

  audio_drama: {
    id: 'audio_drama',
    name: 'Audio drama',
    tagline: 'Cinema for the ears.',
    formatNotes: [
      'Everything must be heard: sound effects, voices and music carry the scene.',
      'Keep the cast small enough that listeners can tell voices apart.',
      'Found-footage framings (recordings, broadcasts, voicemails) explain why we can hear it.',
      'Episodes of 20–40 minutes are common; plan cliffhangers for each.',
    ],
    pitch: {
      label: 'Logline',
      template: 'When {incident}, {hero} must {goal} before {stakes}.',
      fields: LOGLINE_FIELDS,
    },
    questions: [
      { key: 'frame', q: 'Why are we hearing this? Is it a recording, a radio show, or just “there”?', hint: 'A frame device can be part of the mystery.' },
      { key: 'soundscape', q: 'What does the world sound like?', hint: 'Rain on metal, a crowded market, total silence.' },
      { key: 'voices', q: 'How will listeners tell the main characters apart?', hint: 'Age, accent, rhythm and how they talk.' },
      { key: 'episodes', q: 'How many episodes, and what is each one’s cliffhanger?', hint: 'Sketch the first three.' },
      { key: 'music', q: 'What role does music play?', hint: 'A theme, a diegetic song, a motif tied to a character.' },
    ],
    structure: {
      label: 'Episode one',
      beats: [
        { title: 'Sound-first opening', prompt: 'An unmistakable sound that sets the world.' },
        { title: 'Voice we follow', prompt: 'Introduce the lead through what they say and how.' },
        { title: 'Disturbance', prompt: 'Something heard that should not be there.' },
        { title: 'Investigation', prompt: 'Scenes that move between distinct soundscapes.' },
        { title: 'Reveal', prompt: 'A twist delivered through audio alone.' },
        { title: 'Cliffhanger', prompt: 'End the episode on a sound.' },
      ],
    },
    sparks: [
      'What if the narrator is unreliable and we only realise through background sound?',
      'What if one character never speaks, and is known only by sound?',
      'What if the episodes are recordings found out of order?',
      'What if silence itself is a threat in this world?',
      'What if the listener is addressed as a character?',
    ],
  },

  youtube: {
    id: 'youtube',
    name: 'YouTube video',
    tagline: 'Hook, payoff and a reason to watch to the end.',
    formatNotes: [
      'The title and thumbnail are part of the idea. If you can’t pitch it in a title, rework it.',
      'The first 15–30 seconds decide retention. Show the payoff early.',
      'Re-hook every minute or two with a new question or a change of scene.',
      'Plan B-roll and on-screen graphics while you write, not after.',
    ],
    pitch: {
      label: 'Title + promise',
      template: '{title}: {promise}, for {audience}.',
      fields: [
        { key: 'title', label: 'Working title', placeholder: 'I Lived Like a Medieval Peasant for a Week' },
        { key: 'promise', label: 'What viewers get', placeholder: 'what it actually felt like, hour by hour' },
        { key: 'audience', label: 'For', placeholder: 'history nerds who like a challenge video' },
      ],
    },
    questions: [
      { key: 'thumbnail', q: 'What is the thumbnail?', hint: 'One face, one object, one emotion.' },
      { key: 'hook', q: 'What happens in the first 10 seconds?', hint: 'Start in the middle, or with the result.' },
      { key: 'payoff', q: 'What is the payoff viewers stay for?', hint: 'Tease it in the intro and deliver it near the end.' },
      { key: 'length', q: 'How long should it be?', hint: 'Only as long as the payoff earns.' },
      { key: 'series', q: 'Could this become a series?', hint: 'Repeatable formats grow channels.' },
    ],
    structure: {
      label: 'Video script',
      beats: [
        { title: 'Hook (0–15s)', prompt: 'The most interesting moment or question first.' },
        { title: 'Intro', prompt: 'Why this video, why now, and what they will get.' },
        { title: 'Part 1', prompt: 'Set up the challenge or topic.' },
        { title: 'Re-hook', prompt: 'A twist or new question to hold attention.' },
        { title: 'Part 2', prompt: 'Escalate, or go deeper.' },
        { title: 'Payoff', prompt: 'Deliver what the title promised.' },
        { title: 'Call to action & end screen', prompt: 'Subscribe, comment prompt, next video.' },
      ],
    },
    sparks: [
      'What if you added a time limit or a budget limit?',
      'What if you compared the cheapest and most expensive version?',
      'What if you tested it for 30 days instead of once?',
      'What if a total beginner and an expert tried it side by side?',
      'What if the viewers pick the next step in the comments?',
    ],
  },

  tiktok: {
    id: 'tiktok',
    name: 'Short-form video',
    tagline: 'TikTok, Reels and Shorts: seconds, not minutes.',
    formatNotes: [
      'You have about one second to stop the scroll. Open on motion, a face or bold text.',
      'Most short videos land between 15 and 60 seconds.',
      'Design for sound-off: captions and on-screen text matter.',
      'A loop, where the end flows back into the start, boosts rewatches.',
    ],
    pitch: {
      label: 'Hook',
      template: '{hook} → {payoff}',
      fields: [
        { key: 'hook', label: 'Hook (first line / text)', placeholder: 'POV: you just found out your plant can hear you' },
        { key: 'payoff', label: 'Payoff', placeholder: 'it has been judging your singing for months' },
      ],
    },
    questions: [
      { key: 'first_frame', q: 'What is in the very first frame?', hint: 'No logos, no “hey guys”.' },
      { key: 'trend', q: 'Is there a trend, sound or format to ride?', hint: 'Or is this original audio?' },
      { key: 'text', q: 'What on-screen text carries it?', hint: 'Write it as if the sound is off.' },
      { key: 'loop', q: 'How could the end loop back to the start?', hint: 'Make the last line set up the first.' },
      { key: 'part2', q: 'Is there a “part 2” in it?', hint: 'Series keep people following.' },
    ],
    structure: {
      label: 'Shot list',
      beats: [
        { title: 'Hook (0–2s)', prompt: 'A visual or line that stops the scroll.' },
        { title: 'Setup (2–8s)', prompt: 'The context in one beat.' },
        { title: 'Build', prompt: 'One or two quick cuts that escalate.' },
        { title: 'Payoff', prompt: 'The punchline, reveal or result.' },
        { title: 'Loop / CTA', prompt: 'Back to the start, or “follow for part 2”.' },
      ],
    },
    sparks: [
      'What if it was a POV video?',
      'What if you told it in reverse, payoff first?',
      'What if it was a duet or stitch with your own older video?',
      'What if every cut was on the beat of a trending sound?',
      'What if it ends on a question for the comments?',
    ],
  },

  videogame: {
    id: 'videogame',
    name: 'Video game',
    tagline: 'A story the player takes part in.',
    formatNotes: [
      'Gameplay comes first: the story should give meaning to what the player does.',
      'Branching dialogue grows fast. Decide early how much choice really matters.',
      'Environmental storytelling (objects, notes, level design) does a lot of work.',
      'Barks and repeatable lines need many variations.',
    ],
    pitch: {
      label: 'Player fantasy',
      template: 'You are {role}, and you {verb} to {goal} in {world}.',
      fields: [
        { key: 'role', label: 'You are', placeholder: 'a lighthouse keeper' },
        { key: 'verb', label: 'Core action', placeholder: 'redirect ships with light and sound' },
        { key: 'goal', label: 'To', placeholder: 'keep a drowned town’s ghosts from reaching shore' },
        { key: 'world', label: 'In', placeholder: 'an island that resets every night' },
      ],
    },
    questions: [
      { key: 'loop', q: 'What does the player do minute to minute?', hint: 'The core loop.' },
      { key: 'fantasy', q: 'What fantasy does it fulfil?', hint: 'Being powerful, clever, brave, kind…' },
      { key: 'choice', q: 'Where do player choices change the story?', hint: 'Endings, relationships, the world itself.' },
      { key: 'genre', q: 'Which genre, and which games is it close to?', hint: 'Platformer, RPG, narrative adventure, roguelike…' },
      { key: 'scope', q: 'How long is a playthrough?', hint: 'A 2-hour indie and a 40-hour RPG are very different scripts.' },
    ],
    structure: {
      label: 'Narrative outline',
      beats: [
        { title: 'Tutorial / opening', prompt: 'Teach the core verb through a story moment.' },
        { title: 'Call to adventure', prompt: 'What sends the player into the world?' },
        { title: 'First area / chapter', prompt: 'A new mechanic and a new character.' },
        { title: 'Twist', prompt: 'Something that changes how the player sees the world.' },
        { title: 'Final area', prompt: 'Everything the player has learned, tested.' },
        { title: 'Ending(s)', prompt: 'One ending, or several shaped by choices?' },
      ],
    },
    sparks: [
      'What if the core mechanic is also the story’s central metaphor?',
      'What if the narrator reacts to how the player plays?',
      'What if dying is part of the story, not a failure?',
      'What if the villain is the player from a previous playthrough?',
      'What if there is no combat at all?',
    ],
  },

  novel: {
    id: 'novel',
    name: 'Novel / short story',
    tagline: 'Prose, voice and the inside of someone’s head.',
    formatNotes: [
      'Short stories run up to about 7,500 words; novels usually 70,000–100,000.',
      'Prose can go inside characters’ heads. Point of view is your biggest choice.',
      'Voice sells books: write a sample paragraph early to find it.',
      'Know your shelf: genre and comparable titles shape length and expectations.',
    ],
    pitch: {
      label: 'Back-cover hook',
      template: 'When {incident}, {hero} must {goal} before {stakes}.',
      fields: LOGLINE_FIELDS,
    },
    questions: [
      { key: 'pov', q: 'Whose point of view, and first or third person?', hint: 'Try the opening in both.' },
      { key: 'voice', q: 'What does the narrator sound like?', hint: 'Write one paragraph in that voice.' },
      { key: 'comps', q: 'Which two books sit next to yours on the shelf?', hint: 'Published in the last five years if you will query agents.' },
      { key: 'length', q: 'Short story, novella or novel?', hint: 'Let the idea pick the length.' },
      { key: 'theme', q: 'What question does the book ask?', hint: 'It doesn’t need an answer.' },
    ],
    structure: {
      label: 'Chapter outline',
      beats: [
        { title: 'Opening chapter', prompt: 'Voice, character and a question the reader wants answered.' },
        { title: 'Inciting incident', prompt: 'The moment the story truly begins.' },
        { title: 'Point of no return', prompt: 'About 25% in: no going back.' },
        { title: 'Midpoint', prompt: 'A revelation that changes the goal.' },
        { title: 'Crisis', prompt: 'About 75% in: the darkest moment.' },
        { title: 'Climax & resolution', prompt: 'The final choice, and life afterwards.' },
      ],
    },
    sparks: [
      'What if it was told in letters, messages or documents?',
      'What if the narrator is lying to the reader?',
      'What if there are two timelines that meet at the end?',
      'What if it was told in second person?',
      'What if the main character is the one everyone else thinks is the villain?',
    ],
  },

  documentary: {
    id: 'documentary',
    name: 'Documentary',
    tagline: 'A real story with a question at its heart.',
    formatNotes: [
      'Access is everything. Who will let you film, and what can you actually get?',
      'You plan a documentary, but write it in the edit. Stay open to what you find.',
      'A central question keeps it from becoming a list of facts.',
      'Archive, interviews, observational footage and re-enactment each cost different things.',
    ],
    pitch: {
      label: 'Pitch',
      template: '{subject}. The film asks {question}, following {access}.',
      fields: [
        { key: 'subject', label: 'Subject', placeholder: 'The last ferry crossing in a fjord about to get a bridge' },
        { key: 'question', label: 'Central question', placeholder: 'what a community loses when it gains a shortcut' },
        { key: 'access', label: 'Following', placeholder: 'the ferry’s captain in her final season' },
      ],
    },
    questions: [
      { key: 'access', q: 'Who have you got access to, and who do you still need?', hint: 'Contributors, locations, archives.' },
      { key: 'question', q: 'What is the central question?', hint: 'Not the topic, but what we want to find out.' },
      { key: 'why_now', q: 'Why now?', hint: 'An event, an anniversary, something about to change.' },
      { key: 'style', q: 'Observational, interview-led, essay or investigative?', hint: 'Name a documentary whose style you like.' },
      { key: 'ethics', q: 'Who could be harmed by this film, and how will you protect them?', hint: 'Consent, safety, fair representation.' },
    ],
    structure: {
      label: 'Sequences',
      beats: [
        { title: 'Opening sequence', prompt: 'An image or moment that poses the question.' },
        { title: 'Meet the subject', prompt: 'Who we follow, and what they want.' },
        { title: 'Context', prompt: 'The background viewers need, kept short.' },
        { title: 'Complication', prompt: 'Where things get harder or unclear.' },
        { title: 'Turning point', prompt: 'An event that changes things, often found while shooting.' },
        { title: 'Resolution', prompt: 'Where we leave the subject, and the question.' },
      ],
    },
    sparks: [
      'What if it was told only through archive footage?',
      'What if the filmmaker becomes part of the story?',
      'What if you followed the person on the other side of the issue?',
      'What if it was shot over one day, or over ten years?',
      'What if the subject films parts of it themselves?',
    ],
  },

  educational: {
    id: 'educational',
    name: 'Educational video',
    tagline: 'Help someone learn one thing well.',
    formatNotes: [
      'One clear learning goal per video. Split it if there are more.',
      'Start with why it matters to the viewer, then explain.',
      'Show, don’t just tell: examples, diagrams and demos.',
      'Finish by checking understanding: a recap, quiz or exercise.',
    ],
    pitch: {
      label: 'Learning goal',
      template: 'After watching, {audience} will be able to {goal}, using {method}.',
      fields: [
        { key: 'audience', label: 'Who', placeholder: 'first-year chemistry students' },
        { key: 'goal', label: 'Will be able to', placeholder: 'balance any chemical equation' },
        { key: 'method', label: 'Using', placeholder: 'a step-by-step method with three worked examples' },
      ],
    },
    questions: [
      { key: 'prior', q: 'What does the viewer already know?', hint: 'Start just past it.' },
      { key: 'misconception', q: 'What do people usually get wrong about this?', hint: 'Addressing it is often the best hook.' },
      { key: 'example', q: 'What is the clearest real-world example?', hint: 'Concrete beats abstract.' },
      { key: 'visuals', q: 'What needs a diagram, animation or demo?', hint: 'Plan graphics alongside the script.' },
      { key: 'check', q: 'How will viewers check they understood?', hint: 'A question, an exercise, a summary.' },
    ],
    structure: {
      label: 'Lesson outline',
      beats: [
        { title: 'Hook', prompt: 'A question, puzzle or surprising fact.' },
        { title: 'Why it matters', prompt: 'Connect it to the viewer’s life or goals.' },
        { title: 'Core explanation', prompt: 'The idea, in plain language.' },
        { title: 'Worked example', prompt: 'Walk through it step by step.' },
        { title: 'Common mistake', prompt: 'Show what goes wrong and why.' },
        { title: 'Recap & practice', prompt: 'Summarise and give them something to try.' },
      ],
    },
    sparks: [
      'What if you started with the wrong answer and fixed it together?',
      'What if you explained it at three levels: child, student, expert?',
      'What if the whole lesson was one real-world story?',
      'What if viewers had to predict the result before you show it?',
    ],
  },

  livestream: {
    id: 'livestream',
    name: 'Livestream',
    tagline: 'A live show with room for the audience.',
    formatNotes: [
      'Plan segments, but leave space for chat and the unexpected.',
      'Have a recurring structure so regulars know what to expect.',
      'Prepare fallback content in case something breaks.',
      'Make the start time and the reason to show up live clear.',
    ],
    pitch: {
      label: 'Show pitch',
      template: '{show}: a live show where {format}, every {when}.',
      fields: [
        { key: 'show', label: 'Show name', placeholder: 'Build Night' },
        { key: 'format', label: 'Format', placeholder: 'chat votes on what we build in two hours' },
        { key: 'when', label: 'Schedule', placeholder: 'Thursday at 20:00' },
      ],
    },
    questions: [
      { key: 'why_live', q: 'Why does this need to be live?', hint: 'Interaction, real time, events.' },
      { key: 'chat', q: 'How does chat take part?', hint: 'Polls, questions, challenges.' },
      { key: 'segments', q: 'What are the recurring segments?', hint: 'An opener, the main event, a closing ritual.' },
      { key: 'backup', q: 'What do you do if something fails?', hint: 'A backup segment, a pre-recorded clip.' },
    ],
    structure: {
      label: 'Run of show',
      beats: [
        { title: 'Pre-show', prompt: 'Countdown screen, music, waiting for people to join.' },
        { title: 'Welcome', prompt: 'Greet chat and set up today’s show.' },
        { title: 'Main segment', prompt: 'The core of the stream.' },
        { title: 'Interaction', prompt: 'Q&A, polls or challenges.' },
        { title: 'Wrap-up', prompt: 'Highlights, thanks and the next stream.' },
      ],
    },
    sparks: [
      'What if chat controlled a key decision?',
      'What if there was a timer or goal visible on screen?',
      'What if a guest joined by surprise?',
      'What if the show ran for an unusual length, like 24 hours?',
    ],
  },

  tv_production: {
    id: 'tv_production',
    name: 'Broadcast story',
    tagline: 'A story or segment for a live rundown.',
    formatNotes: [
      'Lead with the news: what happened, to whom, and why it matters now.',
      'Think in formats: reader, VO, VO/SOT, package or live hit.',
      'Check sources before air. Two independent confirmations for anything contested.',
      'Write for the ear: short sentences, active verbs, numbers rounded.',
    ],
    pitch: {
      label: 'Story line',
      template: '{what}. {why}. We have {elements}.',
      fields: [
        { key: 'what', label: 'What happened', placeholder: 'The town’s only maternity ward closes on Friday' },
        { key: 'why', label: 'Why it matters', placeholder: 'Expectant mothers now face a two-hour drive' },
        { key: 'elements', label: 'Elements', placeholder: 'an interview with a midwife and pictures from the ward' },
      ],
    },
    questions: [
      { key: 'angle', q: 'What is the angle, and what makes it new today?', hint: 'The latest development, not the background.' },
      { key: 'sources', q: 'Who are the sources, and are they confirmed?', hint: 'Note who said what and how you verified it.' },
      { key: 'format', q: 'Which format fits: reader, VO, VO/SOT, package or live?', hint: 'Depends on pictures and time.' },
      { key: 'visuals', q: 'What pictures and graphics do you have or need?', hint: 'Footage, maps, stills, lower thirds.' },
      { key: 'balance', q: 'Who should get a right of reply?', hint: 'Anyone criticised in the story.' },
    ],
    structure: {
      label: 'Segment',
      beats: [
        { title: 'Anchor intro', prompt: 'The headline in one or two sentences.' },
        { title: 'Opening pictures', prompt: 'The strongest image you have.' },
        { title: 'Key facts', prompt: 'What, who, where, when.' },
        { title: 'SOT / interview', prompt: 'The best soundbite.' },
        { title: 'Context', prompt: 'Why it matters, background in one line.' },
        { title: 'Tag / back to studio', prompt: 'What happens next.' },
      ],
    },
    sparks: [
      'What if you told it through one affected person?',
      'What if a graphic or map explained it better than words?',
      'What if you went live from the location?',
      'What if there’s a follow-up for tomorrow’s show?',
    ],
  },
};

/** Pick the kit for a project. Project type wins where it is more specific. */
export function kitFor(projectType?: string | null, scriptType?: string | null): StarterKit {
  const byProject: Record<string, string> = {
    tv_production: 'tv_production',
    documentary: 'documentary',
    educational: 'educational',
    livestream: 'livestream',
    novel: 'novel',
    podcast: 'podcast',
    audio_drama: 'audio_drama',
    stage_play: 'stageplay',
    videogame: 'videogame',
    youtube: 'youtube',
    tiktok: 'tiktok',
  };
  const id = byProject[projectType ?? ''] ?? scriptType ?? 'screenplay';
  return KITS[id] ?? KITS.screenplay;
}

export const ALL_KITS: StarterKit[] = Object.values(KITS);

/** Fill a pitch template; blank fields keep a readable [label] placeholder. */
export function buildPitch(kit: StarterKit, values: Record<string, string>): string {
  const labels = Object.fromEntries(kit.pitch.fields.map((f) => [f.key, f.label.toLowerCase()]));
  const text = kit.pitch.template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key]?.trim();
    return v ? v : `[${labels[key] ?? key}]`;
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function pitchIsComplete(kit: StarterKit, values: Record<string, string>): boolean {
  return kit.pitch.fields.every((f) => values[f.key]?.trim());
}

/**
 * Quick read of a raw idea: does it already name someone, a conflict and some
 * stakes? Heuristic only — it nudges, it doesn't grade.
 */
export function ideaChecks(text: string): { label: string; ok: boolean; tip: string }[] {
  const t = ` ${text.toLowerCase()} `;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const has = (re: RegExp) => re.test(t);
  return [
    {
      label: 'Someone to follow',
      ok: has(/\b(a|an|the|my|our|his|her|their|two|three)\s+\w+/) || /\b[A-Z][a-z]+\b/.test(text.slice(1)),
      tip: 'Name who the idea is about.',
    },
    {
      label: 'A want or goal',
      ok: has(/\b(wants?|must|needs?|tries|trying|tries to|has to|have to|sets out|decides?|plans?|goal|dreams?|hopes?|learn)\b/),
      tip: 'What are they trying to do?',
    },
    {
      label: 'Something in the way',
      ok: has(/\b(but|until|despite|although|while|against|unless|when|discovers?|finds out|threat|enemy|rival|secret|problem)\b/),
      tip: 'Add an obstacle, twist or opponent.',
    },
    {
      label: 'Stakes',
      ok: has(/\b(before|or else|otherwise|lose|loses|die|dies|death|forever|last|only|save|risk|destroy|ruin|never)\b/),
      tip: 'What happens if they fail?',
    },
    {
      label: 'Enough to work with',
      ok: words >= 12,
      tip: 'A sentence or two is plenty to start.',
    },
  ];
}

export type StarterDraft = {
  idea: string;
  pitch: Record<string, string>;
  answers: Record<string, string>;
  beats: Record<string, string>;
};

/** Plain-text version of the whole starter, for copying or saving as an idea. */
export function starterToText(kit: StarterKit, draft: StarterDraft): string {
  const lines: string[] = [];
  if (draft.idea.trim()) lines.push(draft.idea.trim(), '');
  if (kit.pitch.fields.some((f) => draft.pitch[f.key]?.trim())) {
    lines.push(`${kit.pitch.label}: ${buildPitch(kit, draft.pitch)}`, '');
  }
  const answered = kit.questions.filter((q) => draft.answers[q.key]?.trim());
  if (answered.length) {
    lines.push('Questions');
    for (const q of answered) lines.push(`- ${q.q}`, `  ${draft.answers[q.key].trim()}`);
    lines.push('');
  }
  const beats = kit.structure.beats.filter((b) => draft.beats[b.title]?.trim());
  if (beats.length) {
    lines.push(kit.structure.label);
    for (const b of beats) lines.push(`- ${b.title}: ${draft.beats[b.title].trim()}`);
  }
  return lines.join('\n').trim();
}

/** A short title for the idea card: the first sentence, capped. */
export function ideaTitle(text: string, max = 80): string {
  const first = text.trim().split(/(?<=[.!?])\s|\n/)[0] ?? '';
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}
