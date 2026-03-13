-- ============================================================
--  BLOG POST: Idea Boards Launch
--  Run in: Supabase Dashboard > SQL Editor
-- ============================================================

INSERT INTO blog_posts (
  slug,
  title,
  excerpt,
  cover_image_url,
  sections,
  tags,
  status,
  published_at,
  author_id,
  allow_comments
)
VALUES (
  'idea-boards-your-brain-has-a-new-home',

  'Idea Boards: Your Brain Has a New Home (And It Has Folders)',

  'We built a place to dump every half-baked idea, midnight thought, and unhinged creative tangent you''ve ever had. It''s called Idea Boards. It has progress bars. It has folders. It has bold text. You''re welcome.',

  NULL,

  $sections$
[
  {
    "order": 1,
    "heading": "The Problem: Your Ideas Live Everywhere and Die Nowhere",
    "body": "You know the drill. Great idea hits at 2am. You write it in your phone notes app. Then you email it to yourself. Then you forget which email client. Then you find it six months later sandwiched between a grocery list and a screenshot of someone's tweet about screenwriting.\n\nWe've all been there. It's a disaster. Your best ideas are scattered across seventeen apps, three notebooks, two sticky notes on your monitor, and one voice memo you'll never transcribe.\n\nSo we built Idea Boards. A single place, inside the platform you're already using, where ideas can actually live and be found again."
  },
  {
    "order": 2,
    "heading": "What Even Is an Idea Board",
    "body": "An Idea Board is basically a document that doesn't judge you. You pick an emoji (🎬, 🧠, 🔥 — whatever matches your vibe), a colour, and a name. Then you start adding blocks.\n\nBlocks are the things that make up a board. Here's what you've got:\n\n— Heading: Big bold text. For when you have a Section Title and you want everyone (including future you) to know it's A Section Title.\n— Text: Just words. Prose. Rambling. Thoughts. The good stuff.\n— Checklist: A to-do item with a checkbox. Satisfying to tick. Unsatisfying when you have thirty of them.\n— Divider: A horizontal line to separate your chaos into smaller, more dignified chaos.\n— Project Link: Pin a project right inside the board. Because sometimes an idea is literally 'go work on this thing.'\n\nBoards are outside of projects — they're yours globally, not tied to any one film or series. Though you CAN link a board to a project if you want to keep that rope tight."
  },
  {
    "order": 3,
    "heading": "Typing Actually Works Like You'd Expect (Miracle, We Know)",
    "body": "Here's what the typing experience looks like now:\n\nYou press Enter at the end of a heading → you get a text block. Sensible.\nYou press Enter on a checklist item → you get another checklist item. Also sensible.\nYou press Enter on an empty checklist → you escape to a text block. EXTREMELY sensible. Double-enter gets you out of list mode like every other editor that isn't a nightmare.\nYou press Backspace on an empty block → it deletes itself. No orphan empty blocks sitting there mocking you.\nYou press Tab → the block cycles type. Heading becomes text, text becomes checklist, checklist becomes heading. Keep pressing until you get what you want.\n\nThis is not revolutionary. This is just how it should've always worked. But it didn't. Now it does. We're proud of ourselves for this one."
  },
  {
    "order": 4,
    "heading": "Bold, Italic, Underline — Yes, Finally",
    "body": "You can format text now. We know. About time.\n\nCmd+B (or Ctrl+B on Windows, you heathens): Bold. For emphasis.\nCmd+I: Italic. For when something is important but also a bit shy about it.\nCmd+U: Underline. For people who specifically hate italic.\n\nThere's also a little B / I / U button row that appears on the right side of a block while you're typing in it. Same thing, clickable. The formatting is stored as actual HTML so when the page reloads, your bold text is still bold. Radical concept, we know.\n\nThis uses the browser's built-in execCommand under the hood, which sounds janky but is actually what Google Docs and Notion do too. So we're in decent company."
  },
  {
    "order": 5,
    "heading": "The Progress Bar Divider (This One's Actually Cool)",
    "body": "Okay, so. If you set up a board like this:\n\n— Divider\n— Heading (e.g. 'Pre-Production Tasks')\n— Checklist item\n— Checklist item\n— Checklist item\n\nThe divider turns into a progress bar. Automatically. No button to click, no toggle to find. It just detects the pattern and goes green.\n\nAs you tick things off, the bar fills up. All done? The whole thing goes a satisfying solid green with a '100%' label that practically claps for you.\n\nThis means you can use a board as a full project checklist system. Multiple sections, each with their own divider-as-progress-bar. It looks tidy. It feels good. People who like productivity systems are going to lose their minds over this.\n\nPeople who just want to write screenplay notes will also benefit from having visual feedback on their todo lists. Everyone wins."
  },
  {
    "order": 6,
    "heading": "Folders: Boards Inside Boards, Forever",
    "body": "Here's where it gets unhinged in a good way.\n\nBoards can have sub-boards. Sub-boards can have sub-boards. There is no enforced limit. You can nest an idea inside an idea inside an idea inside an idea until the heat death of the universe.\n\nThe top-level boards list only shows your root boards. But inside any board, there's a Sub-boards section at the top. Hit '+ New' and you create a child board that lives inside that parent. Navigate into it. Create sub-sub-boards. Come back up using the breadcrumb trail at the top of the page.\n\nWhy? Because ideas don't live in flat lists. A 'Characters' board might contain a board per character. That board might contain a board of reference images, and another of dialogue notes, and another of backstory beats. That's three levels deep and it still makes total sense.\n\nSub-boards respect the same access control as their root — if someone has access to the parent, they can see the children. You don't have to invite people to every nested board individually."
  },
  {
    "order": 7,
    "heading": "Sharing, Members, Roles",
    "body": "Boards aren't solitary confinement. You can invite people.\n\nClick the members button (top right of any board). Type an email. Assign them 'editor' (they can add and edit blocks) or 'viewer' (they can read, but the blocks are read-only for them). Hit Add.\n\nOwners can remove members. Members can see who else is on the board. Viewers can see everything and touch nothing. Very clean, very professional, very unlike your actual Notion workspace.\n\nThe whole thing is backed by row-level security on the database, which means even if someone guessed a board's UUID, they'd get a 403 unless they're actually invited. Security is not an afterthought here."
  },
  {
    "order": 8,
    "heading": "Go Use It. Seriously.",
    "body": "Idea Boards are in the nav bar now. Click 'Ideas'. Make a board. Dump everything. Make a sub-board. Make another one inside that. Use dividers with checklists and watch the little green bar fill up and feel disproportionately good about it.\n\nThe whole point of this feature is that there's no wrong way to use it. It's a giant open-ended dumping ground for the part of your brain that never totally shuts up.\n\nLink boards to projects when ideas solidify into actual work. Keep separate boards for characters, locations, visual references, half-baked plot theories, names you like the sound of, scenes you cut but still love, dialogue that has nowhere to go yet.\n\nYour brain is a mess. That's fine. At least now the mess has structure."
  }
]
$sections$,

  ARRAY['ideas', 'productivity', 'new feature', 'writing', 'organisation'],

  'published',
  now(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77',
  true
);


-- ── Changelog entries for 2.8.0 ──────────────────────────────
-- Idea Boards release already created in migration_idea_boards.sql
-- These entries cover the editing UX + folder features built on top.

INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Infinite nested sub-boards (folders)',
  'Any idea board can now contain sub-boards, which can contain further sub-boards with no depth limit. Navigate the hierarchy via breadcrumb. Sub-boards inherit access from their root board.',
  'feature',
  'documents',
  true,
  20
FROM changelog_releases WHERE version = '2.8.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.8.0' AND ce.title = 'Infinite nested sub-boards (folders)'
);

INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Keyboard-driven block editing',
  'Enter creates a new block below (heading → text, checklist → checklist, empty checklist → text). Tab cycles the current block type. Backspace on an empty block deletes it. Focus moves automatically.',
  'improvement',
  'documents',
  true,
  30
FROM changelog_releases WHERE version = '2.8.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.8.0' AND ce.title = 'Keyboard-driven block editing'
);

INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Rich text formatting in idea blocks',
  'Bold (⌘B), italic (⌘I), and underline (⌘U) formatting in text, heading, and checklist blocks. A B/I/U toolbar appears while editing. Formatting is persisted as HTML.',
  'feature',
  'documents',
  true,
  40
FROM changelog_releases WHERE version = '2.8.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.8.0' AND ce.title = 'Rich text formatting in idea blocks'
);

INSERT INTO changelog_entries (release_id, title, description, entry_type, area, is_public, sort_order)
SELECT id,
  'Checklist progress bar on dividers',
  'A divider placed above a heading followed by checklist items automatically becomes a progress bar, filling green as items are ticked off. Reaches 100% solid green when the section is complete.',
  'feature',
  'documents',
  true,
  50
FROM changelog_releases WHERE version = '2.8.0'
AND NOT EXISTS (
  SELECT 1 FROM changelog_entries ce JOIN changelog_releases cr ON cr.id = ce.release_id
  WHERE cr.version = '2.8.0' AND ce.title = 'Checklist progress bar on dividers'
);
