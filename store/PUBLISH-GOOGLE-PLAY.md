# Publishing on Google Play (Android phones and tablets)

This takes the Android app in `android/` from this repo to Google Play. One app bundle
(`.aab`) serves phones, tablets, foldables and Chromebooks; Play sends each device only
the parts it needs.

| | |
| --- | --- |
| Package name | `no.northem.screenplaystudio` (can never be changed after the first upload) |
| Build | `android/` — Jetpack Compose, `compileSdk 37`, `targetSdk 36`, `minSdk 26` (Android 8.0+) |
| Listing copy, Data safety answers, review notes | [`listing.md`](listing.md) |
| Icon, feature graphic, screenshots | [`google-play/`](google-play/) |

**Allow about 3 weeks for the first launch.** That's not the build: new *personal* developer
accounts must run a closed test with at least 12 testers for 14 days before Google lets the
app go to production. Start that test as early as possible. (Organisation accounts skip this
step.)

---

## Before you start

- [ ] **Play Console developer account** — done ✓. Make sure identity verification is
      finished (Play Console → Account details); uploads are blocked until it is.
- [ ] **JDK 17 and the Android SDK** on the machine that builds. On this Mac:
      `JAVA_HOME=/opt/homebrew/opt/openjdk@17`, SDK in `~/Library/Android/sdk`
      (`android/local.properties` points at it). Or just open `android/` in Android Studio.
- [ ] The **reviewer account** exists with fresh demo data:
      ```bash
      REVIEW_PASSWORD='pick-a-password' node --env-file=.env.local scripts/seed-review-account.mjs
      ```
      Same account as the App Store uses. Re-run it before every submission so the demo
      schedule is dated around today.

---

## Step 1 — Create the upload key (first time only — keep it forever)

Play uses two keys. Google holds the **app signing key** (Play App Signing, Step 5). You hold
the **upload key**, which proves an upload came from you. If you lose it, Google can reset it,
but it takes days — so back it up.

```bash
mkdir -p ~/keys
keytool -genkeypair -v \
  -keystore ~/keys/screenplaystudio-upload.jks \
  -alias upload -keyalg RSA -keysize 4096 -validity 10000
```

It asks for a password and your name/organisation. Store the `.jks` file **and** the password
in your password manager. Never commit it.

Then create `android/keystore.properties` (already git-ignored):

```properties
storeFile=/Users/sondre/keys/screenplaystudio-upload.jks
storePassword=the-password
keyAlias=upload
keyPassword=the-password
```

`android/app/build.gradle.kts` reads this file and signs release builds with it. Without the
file, release builds come out unsigned, which Play rejects.

## Step 2 — Set the version

In `android/app/build.gradle.kts`:

```kotlin
versionCode = 1        // must go up by at least 1 on every upload, forever
versionName = "1.0"    // what users see
```

Use the same numbers as the iOS app (`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`).

## Step 3 — Build the app bundle

```bash
cd android
./gradlew :app:bundleRelease
```

The output is `android/app/build/outputs/bundle/release/app-release.aab` (≈5 MB). Release builds are
minified with R8; the shrinker rules for the JSON models are in `app/proguard-rules.pro`.

Before uploading, check the debug build works on a real phone if you have one:
```bash
./gradlew :app:installDebug   # with the phone plugged in and USB debugging on
```
(The debug build installs as `no.northem.screenplaystudio.debug`, alongside the store version.)

## Step 4 — Create the app in Play Console (first time only)

[play.google.com/console](https://play.google.com/console) → **Create app**:

- App name: `Screenplay Studio`
- Default language: English (United Kingdom or United States)
- App or game: **App** · Free or paid: **Free** (cannot change from free to paid later)
- Tick the declarations (Developer Programme Policies, US export laws) → Create.

## Step 5 — Upload the first build to internal testing

1. **Test and release → Testing → Internal testing → Create new release.**
2. Play asks about **Play App Signing** → accept "Let Google manage and protect your app
   signing key". This is the recommended, default setup.
3. Upload `app-release.aab`. Release name defaults to the version — fine.
4. Release notes: copy "What's new" from `listing.md`.
5. **Testers** tab → create an email list with yourself → Save → **Start rollout to internal
   testing**.
6. Open the opt-in link from the Testers tab on your Android phone, install from Play, sign
   in with the review account, and click through every screen.

Internal testing has no review and is live within minutes. Use it for every build before it
goes further.

## Step 6 — App content (the policy forms)

Play Console → **Policy and programmes → App content**. Every item must be done before any
non-internal release. Answers:

| Form | Answer |
| --- | --- |
| **Privacy policy** | `https://screenplaystudio.fun/legal/privacy` |
| **App access** | "All or some functionality is restricted" → add instructions: name `Demo account`, username `appreview@screenplaystudio.fun`, password from the seed script, plus the notes from `listing.md` → App Review notes |
| **Ads** | No, the app does not contain ads |
| **Content rating** | Start questionnaire → category **Utility, Productivity, Communication or Other** → answer No to violence, sexuality, language, drugs, gambling. Users *can* share content with each other (shared projects) → Yes, but no open chat with strangers. Expect *Everyone* / PEGI 3 |
| **Target audience** | 18 and over (or 13+). Not "designed for children" |
| **Data safety** | See below |
| **Government apps** | No |
| **Financial features** | None |
| **Health** | None |
| **News app** | No |
| **Account deletion** | Users can create an account → deletion URL `https://screenplaystudio.fun/settings/security`, and in-app: Settings → Delete account |

**Data safety** (from `listing.md` → Privacy answers):
- Does the app collect or share user data? **Yes**
- Encrypted in transit? **Yes** · Can users request deletion? **Yes**
- Data types collected (not shared):
  - Personal info → **Email address** (required), **Name** (optional), **User IDs** (required)
  - App activity → **Other user-generated content** (required)
  - Purpose for all: **App functionality** and **Account management**. Not used for ads or analytics.
- Nothing is shared with third parties — Supabase hosts the data on our behalf, which Play
  doesn't count as sharing.

## Step 7 — Store listing

**Grow users → Store presence → Main store listing:**

| Field | Source |
| --- | --- |
| App name | `Screenplay Studio` |
| Short description (80) | `listing.md` → Google Play short description |
| Full description (4000) | `listing.md` → Description |
| App icon (512 × 512) | `store/google-play/icon-512.png` |
| Feature graphic (1024 × 500) | `store/google-play/feature-graphic-1024x500.png` |
| Phone screenshots (2–8) | `store/google-play/screenshots/phone/` (1233 × 2466) |
| 7-inch and 10-inch tablet screenshots | `store/google-play/screenshots/tablet/` (1920 × 1200) — upload the same set to both |
| Chromebook screenshots (optional) | the tablet set works |

**Store settings**: category **Productivity**, tags (e.g. "Writing", "Video production"),
contact email `support@screenplaystudio.fun`, website `https://screenplaystudio.fun`.

Tablet screenshots matter: without them Play doesn't feature the app on tablets.

**Regenerating screenshots** after UI changes (no emulator needed — renders the real screens
with demo data):
```bash
cd android && ./gradlew :app:recordRoborazziDebug
# → app/build/outputs/roborazzi/phone-*.png and tablet-*.png
```

## Step 8 — Closed test (12 testers × 14 days)

Required for new personal accounts before production access.

1. **Testing → Closed testing → Create track** (or use the default "Alpha").
2. Countries: all you plan to launch in.
3. **Testers**: an email list (or a Google Group) with **at least 12 people** who will actually
   install it. Friends, crew, collaborators — anyone with an Android phone.
4. Create a release → **Add from library** → pick the build already in internal testing →
   Review → **Start rollout to Closed testing**. This first closed release goes through review
   (usually a few days).
5. Send testers the opt-in link. They must **opt in and keep the app installed for 14 days**.
   Ask them to open it a few times; Google looks at engagement.
6. After 14 days: **Dashboard → Apply for production**. Google asks a few questions about the
   test (how testers were recruited, what feedback you got, what you changed). Answer
   concretely. Approval usually takes up to a week.

## Step 9 — Production release

1. **Test and release → Production → Create new release** → add the build (or upload a newer
   one) → release notes.
2. Countries/regions: pick them under Production → Countries/regions.
3. **Staged rollout**: start at e.g. 20%, then raise it from the release page once nothing
   breaks. You can halt a rollout at any time.
4. **Review release → Start rollout to Production.** Review takes from hours to a few days;
   you'll get an email.

Use **Publishing overview → Managed publishing** if you want to approve the exact go-live
moment (e.g. to launch together with the App Store).

---

## Updating the app later

1. Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle.kts`.
2. `./gradlew :app:bundleRelease`
3. Upload to **internal testing**, check it on a phone.
4. **Promote** the release to production (Internal testing → the release → Promote release →
   Production), add release notes, staged rollout.

## Things that commonly get an app rejected

| Policy | What they check | Status |
| --- | --- | --- |
| App access | Reviewer can sign in and see content | Seed script + App access form |
| Account deletion | In-app **and** a web URL | Settings → Delete account; `/settings/security` |
| Data safety accuracy | Form matches what the app sends | Answers in `listing.md` |
| Target API level | New apps/updates target a recent Android | `targetSdk 36` |
| Broken functionality | App crashes or shows empty screens | Test via internal track first |
| Minimum functionality / webview | Not just a website wrapper | Native Compose app, offline cache |

If something is rejected, Play Console → **Policy status** explains why; fix it, upload a new
build (new `versionCode`) or update the form, and resubmit.

## Notes for this project

- The Android app has so far only been verified by building and by rendering every screen
  with demo data. **Test the internal-track build on a real device against the live backend
  before the closed test** — especially the realtime updates and offline queue.
- Keep `android/keystore.properties` and the `.jks` out of git (both are ignored).
