# Screenplay Studio

**Write. Plan. Produce.**

Screenplay Studio is a free, open-source screenwriting and film pre-production suite. It combines a professional script editor with production planning tools — all in one web application.

> Developed by [Northem Development](https://northem.no) in Oslo, Norway.

## Features

- **Script Editor** — Fountain-compatible screenplay editor with auto-formatting, character autocomplete, version tracking, inline comments, and real-time collaboration presence
- **Production Planning** — Storyboard, shot lists, scheduling, budgeting, breakdowns, call sheets, and more
- **Character & Location Management** — Track characters, locations, props, and costumes
- **Export** — Fountain, FDX, PDF, DOCX, HTML, and plain text
- **Broadcast Tools** — Prompter, vision mixer, multiviewer, rundown, wire desk, MOS devices
- **Audio Drama Tools** — Sound design, voice cast, cues for BBC Radio, US Radio, and podcast formats
- **Content Creator Tools** — Thumbnails, SEO, sponsorship management, B-roll planning
- **Community** — Forums, challenges, courses, free scripts, real-time chat
- **Gamification** — XP, levels, badges, streaks, and rewards to keep you motivated
- **Collaboration** — Real-time presence, comments, team management, version history

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 3 |
| State | Zustand 5 |
| Backend | Supabase (Postgres, Auth, Storage, Realtime) |
| Animation | Framer Motion |
| Testing | Vitest + Testing Library |

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project (free tier works)

### Setup

```bash
git clone https://github.com/anomalyco/screenplay-studio.git
cd screenplay-studio
npm install
```

Copy the environment file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase URL and anon key from your project dashboard.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Testing

```bash
npm run test        # Run tests once
npm run test:watch  # Watch mode
```

### Linting

```bash
npm run lint
```

### Build

```bash
npm run build
npm start
```

## Environment Variables

See `.env.local.example` for all required variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web push public key |
| `VAPID_PRIVATE_KEY` | Web push private key |
| `PUSH_API_SECRET` | Secret for push API calls |
| `RESEND_API_KEY` | Transactional email via Resend |
| `PAYPAL_CLIENT_ID` | PayPal client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal client secret |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing page
│   ├── dashboard/          # Dashboard
│   ├── projects/[id]/      # Project pages (script, scenes, etc.)
│   ├── auth/               # Authentication pages
│   ├── settings/           # User settings
│   ├── community/          # Community hub
│   └── admin/              # Admin panel
├── components/             # Shared UI components
│   ├── ui/                 # Base UI kit
│   └── ...                 # Feature components
├── hooks/                  # Custom React hooks
├── lib/                    # Core logic & utilities
│   ├── supabase/           # Supabase client helpers
│   ├── stores.ts           # Zustand stores
│   └── types/              # TypeScript type definitions
└── middleware.ts           # Supabase session refresh
```

## License

MIT — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions welcome!
