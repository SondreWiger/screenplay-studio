-- ============================================================
-- Poll: "How does Screenplay Studio really feel?"
-- A deep perception survey: who uses the app, how, how well it works,
-- how it feels, and what people think it is.
--
-- 36 questions in 6 parts. Every required question is a tap (yes/no,
-- single/multi select, ranking); all free-text questions are optional so
-- the survey stays finishable while still inviting depth.
--
-- Inserted as status 'review' with every question approved and
-- is_global = true. Open /admin/polls, check it, press Publish — that
-- notifies every user and turns on the popup. (Publishing straight from
-- SQL would skip the notifications.)
-- ============================================================

DO $$
DECLARE
  v_admin uuid;
  v_poll  uuid;
BEGIN
  SELECT id INTO v_admin FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'No admin profile found to own the poll';
  END IF;

  INSERT INTO poll_sessions (title, preface, status, created_by, is_global)
  VALUES (
    'How does Screenplay Studio really feel?',
    $preface$We build Screenplay Studio for you, and we want to know what it is actually like to use it — the good, the annoying, and everything in between.

This is a longer one than usual: 36 questions in six short parts. Most are a single tap. The written questions are optional, but they are where we learn the most, so a sentence or two there goes a long way.

Your progress is saved if you need to step away. Everything is read by a person on the team.$preface$,
    'review',
    v_admin,
    true
  )
  RETURNING id INTO v_poll;

  INSERT INTO poll_questions (session_id, sort_order, question_text, question_type, options, is_required, is_approved)
  SELECT v_poll, q.ord, q.txt, q.typ::poll_question_type, q.opts::jsonb, q.req, true
  FROM (VALUES
    -- ── Part 1 · You and your work ───────────────────────────────
    (1,  'Part 1 · You — Which best describes you?', 'single_select',
         '["Screenwriter","Director","Producer","Writer-director / hyphenate","Student","Novelist or prose writer","Podcast, video or broadcast creator","Crew / production department","Hobbyist writing for fun","Something else"]', true),
    (2,  'How long have you been writing or making stories, in any tool?', 'single_select',
         '["Just starting","Less than a year","1–3 years","3–10 years","More than 10 years"]', true),
    (3,  'How long have you been using Screenplay Studio?', 'single_select',
         '["Less than a week","A few weeks","1–6 months","6–12 months","More than a year"]', true),
    (4,  'What are you working on in Screenplay Studio right now?', 'multi_select',
         '["Feature film","Short film","TV / series","Stage play","Podcast or audio drama","YouTube / online video","Novel or prose","Broadcast / live show","School or course work","Nothing active right now"]', true),
    (5,  'Do you mostly work alone or with others?', 'single_select',
         '["Always alone","Mostly alone, sometimes share","About half and half","Mostly with a team","Always with a team"]', true),

    -- ── Part 2 · How you use it ──────────────────────────────────
    (6,  'Part 2 · Your habits — How often do you open Screenplay Studio?', 'single_select',
         '["Every day","A few times a week","About once a week","A few times a month","Rarely — I keep meaning to"]', true),
    (7,  'Where do you use it?', 'multi_select',
         '["Browser on a computer","Mac / desktop app","iPhone","iPad","Android phone or tablet","Offline, then sync later"]', true),
    (8,  'Which parts of the app have you actually used?', 'multi_select',
         '["Script editor","Beat sheet","Arc map","Characters","Locations","Scene breakdown","Shot list / storyboards","Schedule & call sheets","Budget","Gear","Mood board / mind map / ideas","Documents & notes","Team collaboration & comments","Coverage, notes & submissions","Community / sharing","AI / Claude tools","Novel tools","Rundown / broadcast tools"]', true),
    (9,  'Rank what you spend the most time doing in the app (top = most).', 'ranking',
         '["Writing the script","Planning story (beats, arcs, characters)","Breaking down & planning production","Collaborating with others","Organising ideas & research","Exploring the community"]', true),
    (10, 'What other tools do you still use alongside it for the same work?', 'multi_select',
         '["Final Draft","WriterDuet","Celtx","Fade In","Highland","Arc Studio","Google Docs / Word","Notion / Obsidian","StudioBinder","Spreadsheets","Pen and paper","None — it''s all here"]', true),
    (11, 'What do you still have to leave Screenplay Studio to do? What pulls you out?', 'long_text', NULL, false),

    -- ── Part 3 · How it works ────────────────────────────────────
    (12, 'Part 3 · How it works — How easy was it to get started?', 'single_select',
         '["Instantly clear","Easy after a few minutes","Took some figuring out","Confusing for a while","I still don''t fully get it"]', true),
    (13, 'When you look for a feature, how often do you find it where you expect?', 'single_select',
         '["Almost always","Usually","About half the time","Rarely","I''ve given up looking"]', true),
    (14, 'How fast does the app feel day to day?', 'single_select',
         '["Fast — never think about it","Fine","Sometimes sluggish","Often slow","Slow enough to hurt my work"]', true),
    (15, 'Have you ever lost work, or worried that you had?', 'single_select',
         '["Never","Worried, but it was fine","Lost a little","Lost something important"]', true),
    (16, 'How often do you run into bugs or things that behave strangely?', 'single_select',
         '["Never","Once in a while","Every few sessions","Most sessions"]', true),
    (17, 'Which of these have bothered you?', 'multi_select',
         '["Formatting does something I didn''t want","Hard to find things","Too many features / cluttered","Slow loading","Sync or offline problems","Collaboration conflicts","Mobile experience","Export / import problems","Notifications","Pricing or limits","Nothing has bothered me"]', true),
    (18, 'Describe the last time the app got in your way. What were you trying to do, and what happened?', 'long_text', NULL, false),

    -- ── Part 4 · How it feels ────────────────────────────────────
    (19, 'Part 4 · How it feels — Pick the words that fit how using Screenplay Studio feels.', 'multi_select',
         '["Calm","Focused","Inspiring","Professional","Playful","Powerful","Overwhelming","Cluttered","Frustrating","Clunky","Fresh","Like home"]', true),
    (20, 'When you open the app to write, what is your honest first feeling?', 'single_select',
         '["Excited to get going","Ready, neutral","A bit of friction before I settle in","Reluctant","I don''t open it to write"]', true),
    (21, 'Does the app help you get into a creative flow?', 'single_select',
         '["Yes, it pulls me in","Somewhat","It stays out of the way, which is fine","It interrupts my flow","Not at all"]', true),
    (22, 'How do you feel about how it looks?', 'single_select',
         '["Love it","Like it","Neutral","Not my taste","It distracts me"]', true),
    (23, 'Do you trust Screenplay Studio with work that matters to you?', 'single_select',
         '["Completely","Mostly — I keep a backup","Only for drafts and experiments","Not yet"]', true),
    (24, 'Is there a moment where the app made you genuinely happy or impressed? What was it?', 'long_text', NULL, false),

    -- ── Part 5 · What it is to you ───────────────────────────────
    (25, 'Part 5 · What it is — In a few words, how would you describe Screenplay Studio to a friend?', 'short_text', NULL, false),
    (26, 'What do you see it as, mainly?', 'single_select',
         '["A screenwriting app","A full pre-production suite","A planning / story development tool","A collaboration space for a team","A creative community","All-in-one, but unclear what it''s best at"]', true),
    (27, 'How would you feel if you could no longer use Screenplay Studio?', 'single_select',
         '["Very disappointed","Somewhat disappointed","Not disappointed — I''d use something else"]', true),
    (28, 'How likely are you to recommend it to another writer or filmmaker? (0 = not at all, 10 = absolutely)', 'single_select',
         '["0","1","2","3","4","5","6","7","8","9","10"]', true),
    (29, 'What is the main reason for that score?', 'long_text', NULL, false),
    (30, 'Compared to the other tools you''ve used, Screenplay Studio is…', 'single_select',
         '["Clearly better","Better in some ways, worse in others","About the same","Worse","I haven''t used other tools"]', true),
    (31, 'Rank what matters most to you in a tool like this (top = most).', 'ranking',
         '["Writing experience","Reliability & never losing work","Speed","Production planning features","Collaboration","Price","Works on all my devices","Looks and feels good"]', true),

    -- ── Part 6 · Where it should go ──────────────────────────────
    (32, 'Part 6 · What next — Is there something you expected the app to do that it doesn''t?', 'yes_no', NULL, true),
    (33, 'If yes — what was it?', 'short_text', NULL, false),
    (34, 'If you could change one thing tomorrow, what would it be?', 'long_text', NULL, false),
    (35, 'Would you be open to a short call or follow-up message about your answers?', 'yes_no', NULL, true),
    (36, 'Anything else you want us to know — however small, blunt or strange?', 'long_text', NULL, false)
  ) AS q(ord, txt, typ, opts, req);

  RAISE NOTICE 'Created poll % with 36 questions — review and publish it at /admin/polls/%', v_poll, v_poll;
END $$;
