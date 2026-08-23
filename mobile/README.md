# Screenplay Studio for iPhone

A native SwiftUI app for the writing and production tools people actually need
away from a desk: the script, the scene breakdown, the shot list, the schedule
and the cast.

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

Pick an iPhone simulator and press ⌘R. The Supabase connection is already
bundled, so it goes straight to the sign-in screen — use the same account as the
website.

From the command line:

```bash
xcodebuild -project mobile/ScreenplayStudio.xcodeproj -scheme ScreenplayStudio -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17' build
```

Requires Xcode 16 or newer (the project uses synchronized folder groups) and
targets iOS 17.0 and up. iPhone only.

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
| **Today** | What's on today across every active project. |

Tools that stayed on the web — budget, call sheets, storyboards, rundowns,
prompter, the broadcast and audio-drama suites — are the ones that genuinely
need a large screen. Settings links out to them.

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

## Phone-specific decisions

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
