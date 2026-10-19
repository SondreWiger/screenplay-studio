# Screenplay Studio for iPhone, iPad and Mac

A native SwiftUI app for the writing and production tools people actually need
away from a desk: the script, the scene breakdown, the shot list, the schedule
and the cast. One universal app — a tab bar on iPhone, a sidebar and a full
paper page on iPad.

Same Supabase backend as the web app — one account, one set of data, no export
or import step.

```
mobile/
├── ScreenplayStudio.xcodeproj      Xcode project (no CocoaPods, no SPM packages)
└── ScreenplayStudio/
    ├── App/                        Entry point, auth store, tab shell, router
    ├── Core/
    │   ├── Models/                 Types mirroring the Postgres schema
    │   ├── Networking/             Hand-rolled Supabase client (auth + PostgREST)
    │   ├── Services/               Per-table read/write operations
    │   ├── Offline/                Disk cache, network monitor, write queue
    │   ├── AppSettings.swift       User preferences
    │   ├── Haptics.swift           Centralised haptic feedback
    │   └── DemoData.swift          DEBUG-only sample data
    ├── Design/                     Theme tokens and shared components
    ├── Features/                   One folder per screen area
    └── Resources/                  Assets and Secrets.plist
```

## Running it

```bash
open mobile/ScreenplayStudio.xcodeproj
```

Pick an iPhone or iPad simulator and press ⌘R. The Supabase connection is already
bundled, so it goes straight to the sign-in screen — use the same account as the
website.

From the command line:

```bash
xcodebuild -project mobile/ScreenplayStudio.xcodeproj -scheme ScreenplayStudio -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17' build
```

Requires Xcode 16 or newer (the project uses synchronized folder groups) and
targets iOS / iPadOS 17.0 and up. One target ships to iPhone, iPad and — through
Mac Catalyst — the Mac, under the same bundle id (one App Store record, universal
purchase). Every iPad orientation is supported so it works in Split View and Slide
Over. For the Mac, pick the **My Mac (Mac Catalyst)** destination. Release steps
are in `store/README.md`; the Android app lives in `android/`.

## What's in it

| Screen | What it does |
| --- | --- |
| **Projects** | Every project, searchable, filtered by status. Create, restatus, delete. |
| **Project hub** | Counts, shoot progress, next scheduled event, and the way into each tool. |
| **Script editor** | Element-based screenplay editing with correct formatting, autosave, character autocomplete, scene jump and statistics. |
| **Scenes** | The breakdown list — day/night, page eighths, cast, completion. |
| **Scene detail** | Every breakdown category editable in place, plus department notes. |
| **Shot list** | Grouped by scene, with a one-tap take counter for use while rolling. |
| **Schedule** | An agenda of shoot days, call times and locations. |
| **Characters** | Cast list with leads and casting. |
| **Slate** | A timecode clapperboard for sound sync. Each clap logs a take against the shot and fills in the camera and sound reports. |
| **Today** | What's on today across every active project. |
| **Settings** | Appearance (light / dark / system, ten accent colours), writing options, project-tool layout, sync, account. |

Tools that stayed on the web — budget, call sheets, storyboards, rundowns,
prompter, the broadcast and audio-drama suites — are the ones that genuinely
need a large screen. Settings links out to them.

## iPad

At regular width the shell switches from tabs to a `NavigationSplitView`
(`App/MainTabView.swift`): Projects and Today, your pinned projects, recent
projects and Settings in the sidebar, the selected one beside it. Resize the
window into a narrow Split View and it becomes the iPhone tab layout without
losing your place — `Router.adoptLayout` carries the open project across.

* **The script on paper.** The editor sets about 60 Courier characters per
  line at real screenplay margins on a sheet of paper, the way the page will
  print, instead of the compressed phone margins (Settings → Writing → Paper
  page turns it off).
* **Readable columns.** Card lists cap at 820pt and centre, so nothing stretches
  across a 13-inch screen. Projects and the project hub's tools lay out as grids.
* **Pointer.** Cards lift under the trackpad pointer.
* **Hardware keyboard.** Hold ⌘ for the full list:

  | Keys | Does |
  | --- | --- |
  | ⌘N | New project |
  | ⌘1 / ⌘2 / ⌘, | Projects / Today / Settings |
  | ⌘E | Open the project's script (from the project hub) |
  | Tab / ⇧Tab | Next / previous element type, like Final Draft |
  | ⌥⌘1 … ⌥⌘8 | Scene heading, action, character, dialogue, parenthetical, transition, shot, note |
  | ⌘S | Save now |
  | ⌘J | Jump to scene |
  | Esc | Put the keyboard away |
  | Space | Slate: mark, then cut |
  | ⌘B | Slate: show the full-screen board |

## Make it yours

Everything here is in Settings and stored per device (`Core/AppSettings.swift`):

* **Appearance** — Light, Dark or System, and one of ten accent colours. Every
  colour in `Design/Theme.swift` is dynamic, with a light-mode shade dark
  enough for 4.5:1 text contrast. Changing the accent rebuilds the view tree
  (`.id(settings.accent)` in `ScreenplayStudioApp`); navigation lives in the
  app-owned `Router`, so you stay where you were.
* **Writing** — text size, line spacing, paper page, focus mode (dims every
  line but the current one), typewriter scrolling, scene numbers, the element
  bar, and keep-screen-awake.
* **Project tools** — reorder or hide the tools on a project's home screen
  (also from Edit on the hub).
* **Open to** — Projects, Today, or straight back into the last project.
* **Pinned projects** — long-press a project to pin it to the top of the list
  and the iPad sidebar.

## Slate

`Features/Slate/` is a timecode slate a camera assistant can actually use on set.

* **What's being slated.** Point the board at a shot or a scene from the shot
  list (or "Slate this shot" / "Slate this scene" from those screens, or the
  shoot-day card on Today), or type a scene and setup in. Scene number,
  INT/EXT, DAY/NIGHT, lens and the next take number are filled in from the
  breakdown, and the take count carries on where the log left off.
* **Mark → Cut → rate.** Mark claps the sticks; Cut ends the take with its
  length; Circle / Good / NG rates it and moves to the next take. "Shot done"
  ticks the shot off and moves to the next one, and marks the scene shot when
  its last shot is done. Tail slates (the board goes upside down) and MOS,
  wild and pickup takes are supported. Space marks and cuts from a keyboard.
* **Sync.** On the clap the screen flashes white for one displayed frame and a
  1 kHz beep plays on that same frame. The flash is committed from a
  `CADisplayLink` callback; the beep is scheduled with `AVAudioPlayerNode` at
  that frame's presentation time less the output latency. A per-device offset
  (Board & sync › Beep offset, with a test clap) absorbs the rest. The board's
  timecode freezes on the sync frame for a moment so the camera records it.
* **Timecode.** The clock is a frame count anchored to `mach_continuous_time`,
  which keeps running through sleep. 23.976, 24, 25, 29.97 DF/ND, 30, 48, 50,
  59.94 DF/ND and 60 fps. Jam it to time of day, by hand (with ±1 frame
  nudges), or from a recorder's **LTC** on the audio input — the decoder reads
  four consecutive frames, checks the rate matches, and jams to the frame.
  **Timecode out** sends LTC from the headphone output, phase-locked to the
  board's clock, for a camera's audio input.
* **Full-screen board.** Turn an iPhone sideways (or Show board, ⌘B) for a
  black board at full brightness with LED digits; tap anywhere on it to mark.
* **The log.** Takes are kept in Application Support (not the cache), by day,
  with search, swipe to circle / NG / delete, editing and CSV export.
* **Reports.** Each take is written into the project's `camera_reports` rows —
  one per roll per day, camera and sound — with its timecode, so the web
  app's Camera & Sound Reports fill themselves in. Entries carry a `slate_id`;
  a sync rewrites only those, leaving rows typed on the web alone. Offline,
  reports queue and send when the connection is back.

`LTC.swift` and `Timecode.swift` are ports of `mobile/reference/*.ts`, which
`tests/slate-timecode.test.ts` checks: drop-frame labels for every frame of an
hour at every rate, LTC parity and sync word, and encode → decode at 44.1 and
48 kHz with timing to within two samples, through inverted polarity, low
level, noise and dropouts.

## Also

* **Home-screen quick actions** — press and hold the icon for *Continue
  "<last project>"*, *Today* and *New Project* (`App/QuickActions.swift`).
* **Share as Fountain** — the editor's ⋯ menu exports the script as a
  `.fountain` file for AirDrop, Files, Mail or Final Draft.
* **Account deletion** — Settings → Delete Account calls
  `POST /api/user/delete-account` with the session's bearer token, as App Store
  Review requires.
* **Privacy manifest** — `Resources/PrivacyInfo.xcprivacy` declares no tracking,
  the account data collected, and the UserDefaults / file-timestamp API reasons.

## Live updates

Changes made anywhere — the web app, another phone, a collaborator — arrive
without a refresh. `Core/Networking/RealtimeClient.swift` speaks the Phoenix
channel protocol directly over `URLSessionWebSocketTask`: one socket, many
topics, 25-second heartbeats, and reconnection with exponential backoff.

Screens subscribe with an `AsyncStream` inside `.task`, so the subscription
tears itself down when the screen goes away and there is no unsubscribe to
forget.

Four tables are already in the `supabase_realtime` publication and work
immediately: **script_elements, scenes, shots, production_schedule**.

`projects`, `characters` and `locations` are **not** published yet. The app
already subscribes to them; run this once to switch them on:

```sql
-- supabase/migration_realtime_mobile.sql
```

In the editor the merge rule is deliberately narrow: a remote change is never
applied to the element holding the caret, or to one with an unsent local edit.
Those are the only two cases where the local copy is more current than the
server's, and overwriting either would delete something just typed.

## Configuration

`Resources/Secrets.plist` holds the Supabase URL and **anon key**. That key is
public by design: it is row-level-security scoped and the website already ships
it to every browser, so bundling it in the app grants nothing extra.

**Never put the `service_role` key in this app.** It bypasses RLS completely,
and anything inside an `.ipa` can be extracted from it in seconds. Service-role
work belongs behind a server route.

If `Secrets.plist` is missing, the app shows a connection screen instead and
stores what you enter in `UserDefaults` — which is how you'd point a build at a
staging project without rebuilding.

## Architecture notes

**No third-party dependencies.** `Core/Networking` implements the slice of
GoTrue and PostgREST the app uses, over `URLSession` — about 700 lines. That
keeps the binary small, the launch fast, and the build reproducible without a
package registry.

**Offline is the default assumption, not an error state.** Every list screen
paints from a disk cache first and refreshes behind it, so a cold launch in a
basement location still shows last night's schedule. Writes made without signal
go into a durable FIFO queue (`Core/Offline/SyncQueue.swift`) and replay in
order when connectivity returns — inserts before the patches that edit them.

**Optimistic mutations with rollback.** Ticking a shot, confirming a day or
marking a scene shot updates the array immediately and reverts if the server
rejects it. A change that didn't happen must never look like it did.

**The editor is a stack of typed elements, not one text field.** That is what
makes real screenplay formatting possible: each element knows its own margins,
casing, and what Return should create next — mirroring `getNextElementType` in
`src/app/projects/[id]/script/page.tsx` so a script flows the same way on both
platforms. `ScreenplayTextView` wraps `UITextView` for the three behaviours
SwiftUI won't give you: Return creating the next element, backspace-at-zero
merging upward, and self-sizing inside a scroll view.

## iPad and Mac

- **Sidebar instead of a tab bar** (`MainTabView`, iOS 18+): on a regular-width window the
  three tabs become a collapsible sidebar; a phone keeps the tab bar.
- **Mac window**: 900 × 640 minimum, unified title bar, File > New and Format menus
  removed, Help links to the website and support (`MacWindow` in `DeviceControls.swift`,
  `.commands` in `ScreenplayStudioApp`).
- **Sandbox**: `ScreenplayStudio.Mac.entitlements` — App Sandbox, outbound network, audio
  input (the slate's LTC reader). Used only for the Catalyst SDK.
- **Icons**: the Mac sizes in `AppIcon.appiconset` use the macOS rounded-square shape and
  are generated from `AppIcon.png` by `store/tools/make-store-art.swift`.

## Phone-specific decisions

(On iPad the editor uses real margins on a paper page instead — see above.)

- **Margins are compressed to 55%.** Full screenplay margins put a character cue
  two-thirds across a 390pt screen and squeeze dialogue into a column three
  words wide. The compression keeps the shape of the page while leaving it
  readable, matching what the web app does at its mobile breakpoint.
- **The element bar above the keyboard.** On a laptop you change element type
  with Tab. There is no Tab key on an iPhone, so without a persistent switcher
  in thumb reach, writing formatted pages on a phone isn't realistic.
- **The schedule is an agenda, not a month grid.** A month grid gives each day
  about 50pt — enough for a dot, not a call time.
- **A "+1 take" button sized for cold hands.** It's the one thing anyone does
  with a shot list while the camera is rolling.
- **Autosave widens to 3s on cellular or Low Data Mode**, and nothing in the
  typing path ever waits on the network.
- Every interactive control is at least 44×44pt, all text scales with Dynamic
  Type through to the accessibility sizes, and controls carry VoiceOver labels,
  hints and selected-state traits.

## When something doesn't sync

**Settings → Diagnostics** shows the project host, whether a session exists and
whether its token is valid, connectivity, queued writes, and a rolling log of
every request with its outcome. "Run a live fetch" hits each table with the
current session and reports per-table results.

This exists because an empty list has several causes that look identical from
the outside: zero rows returned, a row-level-security rejection, a decode
failure, or a request that never went out. The log names which.

Two robustness measures back it up:

* **Unknown enum values decode to nil instead of throwing** (`Lenient`). The
  live database has drifted a long way from `supabase/FULL.sql` — `projects`
  alone carries 60+ columns that schema doesn't mention. Without this, one row
  with a status added after the app shipped would blank an entire screen, and
  it would look exactly like a sync failure.
* **A row that still fails to decode is skipped, not fatal.** `execute` retries
  the array element by element and keeps what it can, recording how many it
  dropped.

## Demo mode

`DemoData.swift` is compiled only in DEBUG. Launch with `-ss-demo` for a
populated app with no backend, and add `-ss-route <screen>` to open straight
onto one:

```bash
xcrun simctl launch booted no.northem.screenplaystudio -ss-demo -ss-route editor
```

Routes: `hub`, `editor`, `editor-typing`, `scenes`, `shots`, `schedule`,
`characters`, `today`, `settings`.

It hooks in at the transport layer and honours query filters, so the real
decoding, caching and error paths all still run — it's a check on the app, not a
mock of it.
