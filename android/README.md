# Screenplay Studio for Android

A native Jetpack Compose app for phones, tablets, foldables and Chromebooks — the
Android twin of the SwiftUI app in `mobile/`. Same Supabase backend, same account,
same screens, same design tokens.

```
android/app/src/main/java/no/northem/screenplaystudio/
├── data/        Models, enums, Supabase (auth + PostgREST over OkHttp), repository,
│                Keystore-encrypted session, debug demo data
└── ui/
    ├── theme/       Design tokens mirrored from globals.css and Theme.swift
    ├── components/  Cards, chips, empty/error/skeleton states
    ├── AppRoot.kt   Auth gate + adaptive shell (bottom bar on phones, rail on tablets)
    └── auth, projects, hub, editor, scenes, shots, schedule, characters, slate, settings
```

## Running it

Needs JDK 17 and the Android SDK (platform 37). With Android Studio, open `android/` and
press Run. From the command line:

```bash
cd android
./gradlew :app:assembleDebug          # debug APK
./gradlew :app:bundleRelease          # Play bundle (signed if keystore.properties exists)
./gradlew :app:recordRoborazziDebug   # screenshots of every screen, phone + tablet
```

Debug builds install as `no.northem.screenplaystudio.debug`, side by side with the store
build.

## Demo mode

Debug builds only. Start with canned data and no backend — the same projects as the iOS
demo:

```bash
adb shell am start -n no.northem.screenplaystudio.debug/no.northem.screenplaystudio.MainActivity \
  --ez ss-demo true --es ss-route editor
```

Routes: `hub`, `editor`, `scenes`, `shots`, `schedule`, `characters`, `slate`, `today`,
`settings`. The screenshot tests use the same mode.

## Design decisions

- **No Supabase SDK.** `data/Supabase.kt` implements the slice of GoTrue and PostgREST the
  app uses, like the iOS app does. Small APK (≈5 MB release), identical behaviour.
- **Lenient decoding.** Enum-like columns stay strings and resolve to defaults, and a row
  that fails to decode is skipped, not fatal — one odd row must never blank a screen.
- **Cache first.** Lists paint from the last good response on disk, then refresh.
- **Optimistic writes with rollback.** Ticking a shot or confirming a day updates at once
  and reverts if the server says no.
- **The editor is a list of typed elements**, with Return creating the next type
  (`getNextElementType` on the web) and Backspace at the start of a line merging upward.
  Soft keyboards don't report Backspace on an empty field, so each line carries an
  invisible zero-width sentinel; deleting it is the signal.
- **Margins compress to 55% on phones**, full screenplay margins on tablets.
- **Adaptive by window size**, not device: bottom bar → navigation rail, scenes become
  list + detail side by side from 840dp.

## Not on Android yet (compared with iOS)

Documents, gear checkout, live realtime updates (Android refreshes on open and on pull),
the offline write queue, and LTC timecode input on the slate. These are the next things
to port.
