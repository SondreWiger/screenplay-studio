-- Blog post: We're here for Story Architect users
-- Run this in Supabase SQL Editor
--
-- Context: Story Architect (STARC) shut down their cloud servers on June 2, 2026
-- without warning. We cracked the .starc format and built direct import support.

INSERT INTO blog_posts (
  slug,
  title,
  excerpt,
  sections,
  tags,
  status,
  published_at,
  allow_comments,
  view_count
) VALUES (
  'starc-users-welcome',
  'To every Story Architect user left in the dark: we got you.',
  'On June 2, 2026, STARC''s cloud went dark with zero notice. We cracked the .starc format, built direct import, and we''re filing EU consumer protection complaints.',
  '[
    {
      "heading": "What happened",
      "body": "On the evening of June 2, 2026, Story Architect''s servers — hosted at nLighten data centers in Amsterdam and Berlin — were shut down without warning. One of the intermediary companies in the chain between the data center and STARC as end customers was suspected of illegal activity.<br><br>The result: thousands of writers woke up to find their cloud-synced projects inaccessible. No export window. No warning email. No migration guide. Just... gone.<br><br>If you paid for a Pro or Team subscription that included cloud sync, your projects were stored in STARC''s proprietary .starc format on those servers. And now those servers are offline.",
      "order": 1
    },
    {
      "heading": "We cracked .starc",
      "body": "Here''s the good news: .starc files aren''t proprietary at all. They''re SQLite3 databases with a renamed extension. That''s it. The same open database format used by thousands of applications, just with .starc instead of .sqlite or .db.<br><br>We reverse-engineered the full schema from STARC''s open-source codebase (GPL-3.0, available on GitHub). The database stores everything in a simple documents table — project structure, screenplay text, characters, locations, world-building notes — all as content blobs with type codes.<br><br>The screenplay content is stored as XML-like markup: custom tags like ''scene-heading'', ''character'', ''dialogue'', ''action'' wrapping your actual text. Not encrypted. Not obfuscated. Just tags and text.<br><br>This means we can read your .starc files directly. No export step needed. No round-tripping through the defunct STARC desktop app. Just drop the file and go.",
      "order": 2
    },
    {
      "heading": "Direct .starc import — now live",
      "body": "The bulk import tool at **/dashboard/import** now accepts three formats:<br><br>**- .fdx** (Final Draft) — the industry standard<br>**- .fountain** / **.txt** — the open plain-text format<br>**- .starc** (Story Architect) — direct, no export needed<br><br>Here''s how it works:<br><br>1. Go to your Screenplay Studio dashboard and click **Import**<br>2. Drop your .starc files (or .fdx / .fountain files) — you can do multiple at once<br>3. For each file, we extract: scripts, scene headings, action, character names, dialogue, parentheticals, transitions, scene numbers, characters, and locations<br>4. Choose the script type for each project (screenplay, stage play, episodic, etc.)<br>5. Click **Create Projects** and you''re done<br><br>Everything transfers: your scene structure, character dialogue, transitions, even title page metadata (author, draft date, contact). The import runs entirely in your browser — your file data is never uploaded to any server before you explicitly create the projects.<br><br>Available to all users. Free tier included. No paywall for getting your work back.",
      "order": 3
    },
    {
      "heading": "How we built the import (security note)",
      "body": "Since .starc files are SQLite databases, we needed a way to read them in the browser. We use sql.js — SQLite compiled to WebAssembly — which runs in a sandboxed environment with no filesystem access.<br><br>Every security measure we could think of, we implemented:<br><br>**File header validation** — We verify the SQLite magic bytes (\"SQLite format 3\\0\") before even attempting to open the file. Corrupted or tampered files are rejected immediately.<br><br>**Parameterized queries only** — Every database query uses bind parameters. No string interpolation. No dynamic SQL construction from file content. This eliminates SQL injection vectors entirely.<br><br>**Content sanitization** — All text extracted from .starc files is stripped of HTML/XML tags, then capped at 100,000 characters per field. This prevents both XSS payloads and payload-bomb attacks via oversized content.<br><br>**Document type whitelist** — Only known STARC document type codes are processed. Unknown types are ignored. This prevents unexpected data from being treated as executable content.<br><br>**Element count limits** — A maximum of 50,000 script elements per import prevents memory exhaustion attacks via adversarially crafted files.<br><br>**No code execution** — The parser only extracts plain text. No eval. No dynamic imports from file content. No rendering of HTML from the file. Your .starc data becomes plain text elements and nothing else.<br><br>**Browser-side processing** — The entire parsing happens in your browser via WASM. Your .starc file data is not sent to any server during the parsing phase. Only the extracted text is sent to Supabase when you click \"Create Projects.\"<br><br>We took this seriously because .starc files are, by definition, user-uploaded files from an untrusted source (even if that source is you). Every input is treated as hostile until proven otherwise.",
      "order": 4
    },
    {
      "heading": "Filing a formal complaint to EU consumer protection",
      "body": "This situation isn''t just inconvenient — it''s a consumer rights issue.<br><br>STARC charged users for cloud subscriptions. Those users paid for a service that included data storage and synchronization. That service was terminated without notice, without providing users a reasonable window to export their data, and without any migration path.<br><br>We are in the process of filing formal complaints with:<br><br>**- The European Consumer Centre (ECC-Net)** — for cross-border consumer protection violations<br>**- The Dutch Authority for Consumers and Markets (ACM)** — as STARC''s servers were hosted in the Netherlands<br>**- The German Federal Network Agency (Bundesnetzagentur)** — as secondary jurisdiction for the Berlin data center<br><br>If you''re an EU citizen who lost paid data in the STARC shutdown, we encourage you to file your own complaint through the ECC-Net portal at [ecc-net.europa.eu](https://ecc-net.europa.eu). The more complaints filed, the stronger the case.<br><br>We are not doing this to score points against a competitor. We are doing this because writers paid for a service, that service was taken away without notice, and that''s not acceptable — regardless of which company is involved.",
      "order": 5
    },
    {
      "heading": "What you can do right now",
      "body": "1. **If you have .starc backup files:** Drop them directly into /dashboard/import. We read them natively — no export step needed. Each .starc file becomes a full project with scripts, characters, and locations.<br><br>2. **If you still have STARC desktop access:** You can also export as FDX or Fountain and import those. But with our direct .starc support, you don''t need to bother.<br><br>3. **If you lost paid data:** File a complaint with your local European Consumer Centre. Document what you paid for, when you last had access, and when the service was terminated<br><br>4. **If you want to start fresh:** Screenplay Studio is free to use. Create an account, start writing. No credit card, no paywall for core features<br><br>We''re also setting up a dedicated migration support channel. If you hit any issues importing your work, reach out and we''ll help you through it personally.",
      "order": 6
    },
    {
      "heading": "We''re not going anywhere",
      "body": "Screenplay Studio is open-source, backed by a real company (Northem), and built with the conviction that writers deserve tools that respect their work.<br><br>We won''t shut down your access without warning. We won''t lock your work in a proprietary format with no export path. We won''t charge you for cloud storage and then lose it overnight.<br><br>Your stories belong to you. Always.<br><br>Welcome aboard.",
      "order": 7
    }
  ]'::jsonb,
  ARRAY['story architect', 'starc', 'migration', 'import', 'sqlite', 'eu consumer protection', 'open source', 'security'],
  'published',
  NOW(),
  true,
  0
);
