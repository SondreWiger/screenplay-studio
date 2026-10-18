# Releasing the apps

| Store | Devices | Project | Bundle / package id |
| --- | --- | --- | --- |
| App Store | iPhone, iPad, Mac (Mac Catalyst) — one record, universal purchase | `mobile/` (SwiftUI) | `no.northem.screenplaystudio` |
| Google Play | Android phones, tablets, foldables, Chromebooks | `android/` (Jetpack Compose) | `no.northem.screenplaystudio` |

Both talk to the same Supabase project as the website, with the public anon key only.
Listing copy, privacy answers and review notes are in [`listing.md`](listing.md).

## 0. Once: the reviewer account

Both stores sign in to review the app. Create the account and its demo project:

```bash
REVIEW_PASSWORD='choose-one' node --env-file=.env.local scripts/seed-review-account.mjs
```

It's idempotent and dates the schedule relative to today, so **re-run it right before each
submission** — the reviewer then sees "Next up · Today" instead of last month's shoot day.
Paste the printed email/password into both consoles (see `listing.md` → App Review notes).

## 1. App Store (iPhone, iPad, Mac)

**Once, in App Store Connect**
1. Apps → + → New App: platforms **iOS** and **macOS**, bundle id `no.northem.screenplaystudio`,
   SKU `screenplaystudio`, primary language English. Because the Mac build is Catalyst with the
   same bundle id, both platforms share one record (universal purchase).
2. Fill in the listing from `listing.md`: name, subtitle, description, keywords, promo text,
   support/marketing/privacy URLs, category Productivity / Entertainment, age rating 4+.
3. App Privacy → answers from `listing.md` → Privacy answers.
4. App Review Information → demo account + notes from `listing.md`.
5. In the Apple Developer portal, the App ID needs no extra capabilities (keychain sharing
   is automatic). Xcode's automatic signing creates the Mac Catalyst profile on first archive.

**Each release**
1. Bump `MARKETING_VERSION` (e.g. 1.0 → 1.1) and `CURRENT_PROJECT_VERSION` (build, always
   increasing) in the target's build settings. Keep the same numbers in
   `android/app/build.gradle.kts` (`versionName` / `versionCode`).
2. iOS/iPadOS: Xcode → scheme ScreenplayStudio → destination **Any iOS Device (arm64)** →
   Product → Archive → Distribute App → App Store Connect.
3. Mac: destination **Any Mac (Mac Catalyst)** → Product → Archive → Distribute App → App
   Store Connect. (Uses `ScreenplayStudio.Mac.entitlements`: App Sandbox, network client,
   audio input for the slate's timecode reader.)
4. In App Store Connect, add both builds to the iOS and macOS versions, attach screenshots,
   submit for review.

**Screenshots required**
- iPhone 6.9" (1320 × 2868) — `store/app-store/iphone-6.9/`
- iPad 13" (2064 × 2752) — `store/app-store/ipad-13/`
- Mac (2880 × 1800 or 1440 × 900) — not generated yet; capture from the Mac build with
  `-ss-demo` (see `mobile/README.md` → Demo mode) at a 1440 × 900 window.

Regenerate the iPhone/iPad ones from the simulator in demo mode:
`xcrun simctl launch booted no.northem.screenplaystudio -ss-demo -ss-route hub` then
`xcrun simctl io booted screenshot file.png`.

## 2. Google Play (Android phones and tablets)

**Once**
1. Create the upload key (keep the .jks and passwords somewhere safe — a password manager,
   not the repo):
   ```bash
   keytool -genkeypair -v -keystore ~/keys/screenplaystudio-upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
   ```
2. Create `android/keystore.properties` (git-ignored):
   ```properties
   storeFile=/Users/you/keys/screenplaystudio-upload.jks
   storePassword=…
   keyAlias=upload
   keyPassword=…
   ```
3. Play Console → Create app: name Screenplay Studio, app, free. Turn on **Play App
   Signing** when you upload the first bundle (Google holds the app signing key; yours is
   only the upload key).
4. App content: privacy policy URL, **App access** (demo account + notes), Ads: none,
   Content rating questionnaire, Target audience 18+ (or 13+), Data safety (from
   `listing.md`), account deletion URL `https://screenplaystudio.fun/settings/security`.
5. Store listing: copy from `listing.md`, icon `google-play/icon-512.png`, feature graphic
   `google-play/feature-graphic-1024x500.png`, screenshots from `google-play/screenshots/`.
6. New personal developer accounts must run a **closed test with at least 12 testers for 14
   days** before production access is granted. Start that track as soon as the first build
   is up.

**Each release**
```bash
cd android
./gradlew :app:bundleRelease        # → app/build/outputs/bundle/release/app-release.aab
```
Upload the .aab to the testing track (internal → closed → production).

**Screenshots** — rendered from the real UI with demo data, no emulator needed:
```bash
cd android && ./gradlew :app:recordRoborazziDebug
```
Output lands in `android/app/build/outputs/roborazzi/` (phone 1233 × 2466, tablet 1920 × 1200).

## 3. Before every submission

- [ ] `scripts/seed-review-account.mjs` re-run (fresh "today" schedule)
- [ ] Version and build numbers bumped on both platforms, matching
- [ ] Signed in with the review account on a real device: projects, editor, scenes, shots,
      schedule, slate all load
- [ ] Delete account tested with a throwaway account (both stores check for it)
- [ ] `PrivacyInfo.xcprivacy` and the Data safety form still match what the app sends
