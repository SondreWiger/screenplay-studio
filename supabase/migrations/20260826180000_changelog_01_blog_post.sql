-- Blog Post: Changelog 01 - The Pro Tools & Mobile Update
-- Inserts the release notes into the blog_posts table

INSERT INTO blog_posts (
  slug, 
  title, 
  excerpt, 
  cover_image_url,
  tags,
  status,
  published_at,
  allow_comments,
  sections
)
VALUES (
  'changelog-01-pro-tools-and-mobile',
  'Changelog 01: The "Pro Tools & Mobile" Update! 🚀',
  'Welcome to the biggest update to Screenplay Studio yet! We''ve been hard at work making the app faster, more secure, and way more powerful. Oh, and we built an entire iPhone app. No big deal. 😉',
  'https://images.unsplash.com/photo-1512402170329-37330fae3b3a?auto=format&fit=crop&q=80&w=1200&h=600', -- Cinematic placeholder image
  ARRAY['changelog', 'update', 'mobile', 'pro-tools'],
  'published',
  NOW(),
  true,
  $$[
  {
    "order": 1,
    "heading": "📱 The All-New Native iPhone App",
    "body": "That's right! Screenplay Studio is now available natively on iOS. It's lightning-fast, offline-first, and designed specifically for your phone.\n- **Offline First**: Write in the desert. Write in a cave. Your scripts sync up automatically the second you get signal.\n- **Live Collaboration**: Watch your co-writers' edits appear in real time.\n- **Digital Clapperboard**: A fully working digital slate right in your pocket. Snap it, log it, and it syncs straight to your shot list!\n- **Mobile-Perfect Typing**: Screenplay indents that actually fit on your screen, with a custom quick-action bar for switching between Dialogue, Action, and Character cues instantly."
  },
  {
    "order": 2,
    "heading": "🛠️ The Pro Tools Suite",
    "body": "We completely ripped out the old \"Studio\" sidebar and replaced it with a massive, beautifully organized **Pro Tools Hub**.\n- **37 Production Tools**: Everything from Budgeting and Dailies to Unions, Guilds, and Catering.\n- **Color-Coded & Clean**: Tools are now categorized into ledgers, boards, checklists, and cards, making it instantly clear what you're working on.\n- **Interconnected**: Tag a real character in the casting tool. Link a catering log to a real shoot day. Your data is now smart and connected across the entire project!\n- **Lightning Fast Search**: Finding a tool is now as simple as opening the Command Palette and typing its name."
  },
  {
    "order": 3,
    "heading": "📇 The People Directory",
    "body": "Projects end. People don't. Introducing the **People Directory**—your personal, private, cross-project address book!\n- **Track Cast & Crew**: Keep contact info, day rates, and agency details in one place.\n- **Rate Your Crew**: Leave private 1-5 star ratings and notes so you always remember who to hire again.\n- **Import from Projects**: Instantly pull contacts from your existing shoots to build your directory fast."
  },
  {
    "order": 4,
    "heading": "🎨 A Cleaner, More Professional Design",
    "body": "We heard you: the intense \"cyberpunk neon glow\" was a bit much for a daily writing tool.\n- **Sleek & Professional**: We removed the intense neon halos and aggressive bold text, replacing them with clean shadows, refined typography, and better contrast.\n- **Easier on the Eyes**: Fonts are slightly larger and much more legible, meaning less eye strain during those 3 AM writing sessions."
  },
  {
    "order": 5,
    "heading": "🐛 Bug Fixes & Under-the-Hood Magic",
    "body": "- **Security First**: We locked down theme publishing and commenting, ensuring no one can spoof authorship.\n- **Google Auth**: Fixed an issue where signing in with Google sent you into the void. It now correctly lands you in the app!\n- **Mobile Web Fixes**: If you use the website on your phone, everything is much smoother. Inputs no longer aggressively zoom in, buttons are easier to tap, and script margins finally fit your screen perfectly.\n- **Desktop Icons**: The Windows and Mac desktop apps now feature beautifully rounded, transparent icons, and we've added full support for Linux icons too!\n- **Speed & Stability**: We obliterated a bunch of crashes, squashed race conditions that occurred when switching projects quickly, and drastically improved the stability of our authentication flow.\n\n---\n**Developers (Action Required)**: If you are running the project locally, please make sure to run the two new Supabase migrations (`20260826140000_pro_tool_suite.sql` and `20260826160000_people_directory.sql`) so your database is up to date for the new tools!\n\nHappy Writing! 🎬"
  }
]$$::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  sections = EXCLUDED.sections,
  updated_at = NOW();
