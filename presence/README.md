# Screenplay Studio — PreMiD Presence

Displays your writing and production activity in Discord while you work in Screenplay Studio.

## What it shows

| Situation | Discord shows |
|---|---|
| Writing / editing | Project name (if opted in) + current tool |
| Idle 5+ min | "Taking a break" |
| Dashboard / browsing | "Browsing the dashboard" |
| Tab hidden | Idle |

## User setup (end users)

1. Install the [PreMiD desktop app](https://premid.app/downloads)
2. Install the [PreMiD browser extension](https://premid.app/downloads#extensions)
3. Once the presence is listed in PreMiD's store, search for **Screenplay Studio** and add it
4. In Screenplay Studio → **Settings → Preferences → Discord Presence**, configure:
   - Enable/disable presence
   - Whether to show project name *(off by default — must opt in)*
   - Whether to show the current tool

## Developer setup — building the presence

```bash
cd presence
npm install
npm run build        # compiles presence.ts → dist/presence.js
npm run watch        # watch mode
```

## Discord Application setup (for self-hosting or before official acceptance)

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → name it `Screenplay Studio`
3. Copy the **Application ID** — paste it as `CLIENT_ID` in `presence.ts` (line 22)
4. Go to **Rich Presence → Art Assets** and upload:
   - Key `ss-logo` — the Screenplay Studio logo (512×512 PNG minimum)
   - Key `writing` — a pencil or writing icon
   - Key `idle` — a sleep/moon icon

## Testing locally

1. Build the presence (`npm run build`)
2. In the PreMiD browser extension, enable **Developer Mode**
3. Load the `dist/` folder as a local presence
4. Open Screenplay Studio in your browser and navigate into a project — your Discord status should update within a few seconds

## Submitting to PreMiD's official store

1. Follow [PreMiD's submission guidelines](https://docs.premid.app/dev/presence/guidelines)
2. Replace `logo` and `thumbnail` URLs in `metadata.json` with hosted image URLs (Imgur, etc.)
3. Fill in your PreMiD user ID in the `author.id` field in `metadata.json`
4. Open a PR to [PreMiD/Presences](https://github.com/PreMiD/Presences) with the `presence/` folder contents following their directory structure

PreMiD will create the Discord Application and provide the `clientId` if the presence is accepted.

## Privacy

- Project name is **off by default** in both the extension settings and the in-app toggle
- Users must explicitly enable "Show project name" in Settings → Preferences to share it
- Presence can be disabled entirely at any time with no data stored externally

## How the app communicates with the presence

The app's `usePreMiD` hook (at `src/hooks/usePreMiD.ts`) writes a `window.__PREMID_DATA__` object:

```typescript
{
  state: "editing" | "viewing" | "idle",
  project: string | null,   // null if not consented
  tool: string | null,      // e.g. "Script Editor", "Corkboard"
  startTimestamp: number,   // Unix seconds
}
```

The presence reads this via `presence.getPageVariable("__PREMID_DATA__")` which PreMiD executes in page context via the browser extension.
