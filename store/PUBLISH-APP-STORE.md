# Publishing on the App Store (iPhone, iPad and Mac)

This takes Screenplay Studio from this repo to the App Store on iPhone, iPad and Mac.
One Xcode target (`mobile/ScreenplayStudio.xcodeproj`) builds all three. The Mac
version is Mac Catalyst and uses the same bundle id, so **one App Store record covers
all three platforms**, and a user who gets it on one device has it on the others.

| | |
| --- | --- |
| Bundle id | `no.northem.screenplaystudio` |
| Team | `VP78TJ39Z6` (set in the Xcode project) |
| Listing copy, privacy answers, review notes | [`listing.md`](listing.md) |
| Screenshots | [`app-store/`](app-store/) |

Expect about an hour for the first submission, and 15 minutes for each update after that.
Review usually takes 1–2 days.

---

## Before you start

- [ ] A paid **Apple Developer Program** membership on the team that owns `VP78TJ39Z6`,
      with the latest agreements accepted in App Store Connect → Business. Uploads are
      blocked until you accept them.
- [ ] **Xcode** signed in with that Apple ID: Xcode → Settings → Accounts.
- [ ] **Free apps agreement** active (Business → Agreements). You don't need banking or tax
      details unless you sell something.
- [ ] **EU trader status** declared under Business → Compliance. Apple asks this before an
      app can be sold in the EU. A company publishing an app is normally a "trader", which
      means your company name, address, phone and email are shown on the listing.
- [ ] The **reviewer account** exists and has fresh demo data:
      ```bash
      REVIEW_PASSWORD='pick-a-password' node --env-file=.env.local scripts/seed-review-account.mjs
      ```
      Run this again right before every submission. The demo schedule is dated relative to
      today, so a reviewer always sees something under "Today".

---

## Step 1 — Register the bundle id (first time only)

1. Go to [developer.apple.com/account](https://developer.apple.com/account) → Certificates,
   IDs & Profiles → Identifiers → **+** → App IDs → App.
2. Description: `Screenplay Studio`. Bundle ID (Explicit): `no.northem.screenplaystudio`.
3. Leave every capability off. The app needs none: keychain access works without one.
4. Register it.

You can skip this step: Xcode's automatic signing registers the id the first time you archive.

## Step 2 — Create the app record (first time only)

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → Apps → **+** → New App.
2. Platforms: tick **iOS** and **macOS**.
3. Name `Screenplay Studio`, primary language English (U.K. or U.S.), bundle id
   `no.northem.screenplaystudio`, SKU `screenplaystudio`, user access Full Access.
4. Create it. The record now has an iOS tab and a macOS tab that share one listing.

## Step 3 — Fill in the listing (first time, then edit as needed)

Copy every field from [`listing.md`](listing.md).

**App Information** (shared by both platforms)
- Subtitle: `Write, break down & shoot`
- Category: Productivity, secondary Entertainment
- Content rights: no third-party content
- Age rating: answer **None / No** to everything. There are no ads, no user-to-stranger
  chat and no web browsing. The result should be the lowest rating.
- License agreement: Apple's standard EULA is fine. If you prefer your own, paste in the
  terms from `https://screenplaystudio.fun/legal/terms`.

**Pricing and Availability**: Free, all countries (or pick the ones you want).

**App Privacy**
- Privacy policy URL: `https://screenplaystudio.fun/legal/privacy`
- Data collection: **Yes**, then answer as in `listing.md` → Privacy answers:
  - Contact Info → Email Address and Name: linked to the user, App Functionality, not
    used for tracking
  - Identifiers → User ID: same answers
  - User Content → Other User Content: same answers
- Nothing else is collected. These answers must match the privacy manifest at
  `mobile/ScreenplayStudio/Resources/PrivacyInfo.xcprivacy`.

**Version page** (iOS tab, then the same on the macOS tab)
- Promotional text, description, keywords, support URL
  (`https://screenplaystudio.fun/support`), marketing URL
- Screenshots (see Step 6)
- Copyright: `2026 Northem Development`
- **App Review Information**:
  - Sign-in required: **Yes**. Use `appreview@screenplaystudio.fun` with the password
    the seed script printed.
  - Contact: your name, phone and email
  - Notes: paste the block from `listing.md` → App Review notes

## Step 4 — Set the version and build number

In Xcode, select the **ScreenplayStudio** target → General → Identity:

- **Version** (`MARKETING_VERSION`): what users see, e.g. `1.0`, then `1.1`, `1.2`…
- **Build** (`CURRENT_PROJECT_VERSION`): must increase on every upload, even for the same
  version: `1`, `2`, `3`…

Use the same numbers in `android/app/build.gradle.kts` (`versionName`, `versionCode`)
so both stores show the same version.

## Step 5 — Archive and upload

Do this twice: once for iPhone/iPad and once for Mac.

**iPhone + iPad**
1. Open `mobile/ScreenplayStudio.xcodeproj`.
2. Scheme **ScreenplayStudio**, destination **Any iOS Device (arm64)**.
3. Product → **Archive**. When it finishes, the Organizer window opens.
4. **Distribute App** → **App Store Connect** → Upload. Keep the defaults: automatic
   signing, upload symbols. Xcode creates the distribution certificate and profile if
   they don't exist yet.

**Mac**
1. Destination **Any Mac (Mac Catalyst)**.
2. Product → **Archive** → Distribute App → **App Store Connect** → Upload.
3. The Mac build is sandboxed with `ScreenplayStudio.Mac.entitlements` (network, audio
   input for the slate's timecode reader). Xcode creates the Mac App Distribution and
   Mac Installer Distribution certificates the first time.

After a few minutes each build shows up in App Store Connect → TestFlight as
"Processing". Apple then emails you when it's ready (usually 10–30 minutes). You won't
see an export-compliance question, because the project already declares
`ITSAppUsesNonExemptEncryption = NO` (the app only uses HTTPS).

**Command-line alternative**, for scripts and CI:
```bash
cd mobile
xcodebuild -project ScreenplayStudio.xcodeproj -scheme ScreenplayStudio \
  -destination 'generic/platform=iOS' -archivePath build/ios.xcarchive archive
xcodebuild -exportArchive -archivePath build/ios.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/ios
# ExportOptions.plist: method = app-store-connect, destination = upload, teamID = VP78TJ39Z6
```
For the Mac, use `-destination 'generic/platform=macOS,variant=Mac Catalyst'`.

## Step 6 — Screenshots

| Device | Size | Where |
| --- | --- | --- |
| iPhone 6.9" | 1320 × 2868 | `store/app-store/iphone-6.9/`, ready |
| iPad 13" | 2752 × 2064 (landscape) | `store/app-store/ipad-13/`, ready |
| Mac | 2880 × 1800, 2560 × 1600, 1440 × 900 or 1280 × 800 | **not made yet**, see below |

App Store Connect scales these down for smaller iPhones and iPads, so one set per family
is enough. You can upload up to 10 per device and the first 3 matter most. The order in
the folders is the suggested order.

**Making the Mac screenshots**: run the Mac build in demo mode, size the window, and
capture it:
```bash
open "path/to/Screenplay-Studio.app" --args -ss-demo -ss-route hub
```
Resize the window to about 1440 × 900, then press ⇧⌘4, then Space, then click the window
(hold ⌥ while clicking to leave out the shadow). Repeat for the `editor`, `scenes`,
`shots` and `today` routes.

**Regenerating the iPhone/iPad screenshots** after UI changes:
```bash
xcrun simctl launch --terminate-running-process booted no.northem.screenplaystudio -ss-demo -ss-route hub
xcrun simctl io booted screenshot 01-hub.png
```
Use an iPhone 17 Pro Max simulator and an iPad Pro 13" simulator. The simulator saves
landscape iPad shots sideways, so turn them upright with `sips -r 90 file.png`.

## Step 7 — Test with TestFlight (recommended)

1. App Store Connect → TestFlight. Once the builds have processed, add yourself under
   **Internal Testing**. Internal testers don't need review.
2. Install TestFlight on your iPhone/iPad and accept the invite. On the Mac, install
   TestFlight from the Mac App Store.
3. Sign in with the **review account** and check every screen: projects, hub, script
   editor, scenes, shots, schedule, slate and Today.
4. Create a throwaway account and delete it from Settings → Delete account. Reviewers
   check that this works.

## Step 8 — Submit for review

1. iOS tab → the version page → **Build** → pick the build you uploaded.
2. macOS tab → its version page → **Build** → pick the Mac build.
3. Release option: **Manually release this version** gives you control over launch day.
   "Automatically" publishes as soon as the app is approved.
4. **Add for Review** → **Submit to App Review**. iOS and macOS can be submitted together
   in one submission.

## Step 9 — After approval

- Press **Release This Version** if you chose manual release. The app is live within a
  few hours.
- For updates, consider **Phased Release** on the version page. It rolls out to
  automatic-update users over 7 days, and you can pause it if something breaks.

---

## Updating the app later

1. Bump **Version** and **Build** (Step 4).
2. Re-run the seed script.
3. Archive and upload both platforms (Step 5).
4. App Store Connect → **+ Version** on both the iOS and macOS tabs → fill in "What's
   New" → pick the builds → submit.

## If review rejects it

These are the usual reasons for an app like this, and what's already covered:

| Guideline | What they check | Status |
| --- | --- | --- |
| 2.1 App completeness | The demo account works and has content | Seed script, re-run before submitting |
| 5.1.1(v) Account deletion | Accounts can be deleted inside the app | Settings → Delete account |
| 5.1.1 Privacy | The policy URL works, and the privacy label matches the app | `listing.md` + `PrivacyInfo.xcprivacy` |
| 4.2 Minimum functionality | The app isn't just a website in a wrapper | Native SwiftUI, works offline |
| 2.5.4 / mic permission | The microphone use is explained and only requested when needed | Asked only when the slate's timecode input is turned on |
| 4.0 Design (Mac) | It feels like a Mac app | Sidebar, minimum window size, menus, Mac-shaped icon |

Reply in App Store Connect → the rejection message (Resolution Center). Short, specific
replies get re-reviewed fastest.
