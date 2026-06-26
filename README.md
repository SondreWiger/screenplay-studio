# Screenplay Studio

**Write. Plan. Produce.**

Free, open-source screenwriting and film pre-production software. A professional script editor combined with a full production planning suite — all in one web application. No paywalls, no credit card, no limits.

> Developed and maintained by [Northem Development](https://northem.no) · Oslo, Norway

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)

---

## Features

### ✍️ Writing
- **Script Editor** — Fountain-compatible with auto-formatting, character autocomplete, inline comments, real-time collaboration, and version history
- **Arc Planner** — Plot character arcs across the full length of the script
- **Beat Sheet** — Structure mapping (Save the Cat, Syd Field, or freestyle)
- **Corkboard** — Drag-and-drop scene cards with colour grouping
- **Mind Map** — Visual idea mapping and scene relationships
- **Episodes** — Multi-episode support for TV and serial formats
- **Treatment** — Prose treatment editor alongside the script

### 🎬 Production Planning
- **Scene Breakdown** — Auto-extract props, costumes, SFX, stunts, and VFX per scene
- **Shot List + Storyboard** — Build shot lists with lens, type, and movement notes
- **Production Schedule** — Calendar scheduling with call times and locations
- **Budget Tracking** — Line-item budget with estimated vs. actual spend
- **Call Sheets** — Day-of production call sheets
- **Safety Plan** — On-set safety documentation

### 👥 Team & Collaboration
- **Real-time Presence** — See who is editing what, live
- **Team Roles** — Granular permissions per crew member
- **Chat** — Project-level team chat
- **Casting** — Character casting notes and actor management
- **Submission Tracker** — Log agents, festivals, and production companies

### 📺 Broadcast & TV
- **Rundown** — Live production rundown editor
- **Prompter** — Full-screen teleprompter
- **Vision Mixer** — Multi-source broadcast monitoring
- **Wire Desk** — News assignment editor

### 🎙️ Audio Drama
- **Sound Design** — Cue sheet and sound design notes
- **Voice Cast** — Character to actor mapping
- **Cues** — BBC Radio, US Radio, and podcast format support

### 🎥 Content Creator
- **Thumbnail Planner** — Thumbnail concepts and A/B variants
- **SEO** — Metadata and keyword planning per episode
- **B-Roll Planner** — Coverage shot planning
- **Sponsorship** — Sponsor mention tracking and deliverables

### 🌐 Community
- Screenplay challenges with voting
- Public script sharing and feedback
- Community forum and real-time chat
- XP, levels, badges, and streak gamification

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| State management | Zustand 5 |
| Database & Auth | Supabase (Postgres + Auth + Storage + Realtime) |
| Email | Resend |
| Animation | Framer Motion |
| Desktop | Electron 33 |
| Testing | Vitest + Testing Library |

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **npm** 10+
- A **Supabase** project — [create one free](https://supabase.com/dashboard) (the free tier is enough for local development)

### 1. Clone and install

```bash
git clone https://github.com/SondreWiger/screenplay-studio.git
cd screenplay-studio
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in at minimum:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Get these from your Supabase project → **Settings → API**.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Self-Hosting

### Option A — Vercel (recommended, free tier works)

1. Fork this repository
2. Import the fork into [Vercel](https://vercel.com)
3. Add environment variables in **Vercel Dashboard → Settings → Environment Variables**
4. Deploy

### Option B — Docker

```bash
docker-compose up --build
```

The app runs on port `3000` by default. Set all environment variables in `docker-compose.yml` or a `.env` file in the root.

### Option C — Any Node.js host

```bash
npm run build
npm start
```

Requires Node.js 20+ and the environment variables listed in `.env.local.example`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your deployed URL (e.g. `https://yourapp.vercel.app`) |
| `RESEND_API_KEY` | Recommended | Transactional email via [Resend](https://resend.com) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional | Web push notifications |
| `VAPID_PRIVATE_KEY` | Optional | Web push notifications |
| `VAPID_SUBJECT` | Optional | `mailto:` address for push auth |
| `PUSH_API_SECRET` | Optional | Secret for push delivery from DB triggers |
| `PAYPAL_CLIENT_ID` | Optional | PayPal creator billing |
| `PAYPAL_CLIENT_SECRET` | Optional | PayPal creator billing |
| `CRON_SECRET` | Optional | Auth token for Vercel cron jobs |
| `KILLSWITCH_SECRET` | Optional | Emergency open-source shutdown key |

See `.env.local.example` for all variables with descriptions.

---

## Project Structure

```
src/
├── app/                      # Next.js App Router pages & API routes
│   ├── page.tsx              # Public landing page
│   ├── dashboard/            # User dashboard
│   ├── projects/[id]/        # Per-project tools (80+ pages)
│   │   ├── script/           # Script editor
│   │   ├── breakdown/        # Scene breakdown
│   │   ├── shots/            # Shot list
│   │   ├── schedule/         # Production schedule
│   │   ├── budget/           # Budget tracker
│   │   └── ...
│   ├── community/            # Community hub
│   ├── admin/                # Admin panel
│   ├── auth/                 # Auth pages
│   ├── settings/             # User settings
│   └── api/                  # API routes
├── components/               # Shared UI components
│   ├── ui/                   # Base component library
│   │   ├── Button, Input, Modal, Toast …
│   │   └── CommandPalette
│   ├── sidebar/              # Project sidebar
│   ├── ThemeEditor.tsx       # Live theme customiser
│   ├── FocusTimer.tsx        # Pomodoro timer
│   ├── WritingGoalWidget.tsx # Daily word goal tracker
│   ├── ScriptStatsPanel.tsx  # Live script statistics
│   └── …
├── hooks/                    # Custom React hooks
│   ├── useAuth.ts
│   ├── useRealtime.ts
│   └── …
├── lib/                      # Core utilities
│   ├── supabase/             # Supabase client helpers
│   ├── stores.ts             # Zustand global state
│   ├── mailer.ts             # Email (Resend)
│   ├── rate-limit.ts         # API rate limiting
│   ├── security.ts           # XSS / content protection
│   ├── theme.ts              # Theme engine
│   └── types/                # TypeScript types
└── middleware.ts             # Session refresh (public paths skipped)
```

---

## Desktop App (Electron)

Screenplay Studio ships as a cross-platform desktop app built with Electron.

```bash
# Development
npm run electron:dev

# Build for your platform
npm run electron:build:mac    # macOS
npm run electron:build:win    # Windows
npm run electron:build:linux  # Linux
npm run electron:build:all    # All platforms
```

Pre-built binaries are available on the [releases page](https://screenplaystudio.fun/download).

---

## Contributing

All contributions welcome — bug reports, features, translations, and documentation.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution guide, code style, and how to open a pull request.

---

## License

[MIT](LICENSE) — fork it, run it, ship it, share it freely.

---

> Built by one developer at Northem Development in Oslo, Norway.  
> If this is useful to you, consider [supporting on Ko-fi](https://ko-fi.com/northemdevelopment). ♥
