# Store listing copy

One source for both stores. Character limits are noted; every field below fits.

## Name

| Store | Field | Text |
| --- | --- | --- |
| App Store | Name (30) | Screenplay Studio |
| App Store | Subtitle (30) | Write, break down & shoot |
| Google Play | App name (30) | Screenplay Studio |
| Google Play | Short description (80) | Write screenplays, break down scenes and run your shoot — synced with the web. |

## Promotional text — App Store (170)

Your script, breakdown, shot list and schedule in your pocket — and on your iPad and Mac. Same account as the website, synced live, works offline on set.

## Description (App Store 4,000 / Google Play 4,000)

Screenplay Studio is the writing and production app for filmmakers who don't stop working when they leave the desk. It's the same account and the same projects as screenplaystudio.fun — no export, no import, no second copy to keep in sync.

WRITE
• A real screenplay editor: scene headings, action, character, dialogue, parentheticals and transitions, formatted the way a page should look.
• Return knows what comes next — character, then dialogue, then character — so you can write a scene with your thumbs.
• An element bar above the keyboard, Tab to cycle on a hardware keyboard, and a scene list to jump anywhere in the script.
• Autosave that never makes you wait, even on a bad connection.

BREAK IT DOWN
• Every scene with its day/night, page count in eighths and cast.
• Props, costumes, effects, vehicles, animals, music and equipment — add and remove items in place.
• Mark scenes shot as you go and watch production progress fill up.

SHOOT
• Shot list grouped by scene, with lens and movement, and a +1 take button big enough for cold hands.
• A working digital slate: running timecode, scene, shot, take and roll. Every clap logs the take onto the shot list.
• An agenda of shoot days, call times and recces, and a Today view across every project.

EVERYWHERE YOU WORK
• iPhone, iPad and Mac, Android phones and tablets — layouts built for each screen, not stretched from a phone.
• Changes from the web, a collaborator or another device arrive without a refresh.
• Lists open instantly from what's saved on the device, so last night's schedule is there in a basement location with no signal.

Budgets, call sheets, storyboards and the broadcast tools stay on the web, one tap away from the app.

Made by Northem Development in Oslo.

## Keywords — App Store (100, comma-separated, no spaces)

screenwriting,script,film,shot list,slate,clapperboard,fountain,breakdown,filmmaking,production

## What's new — first release

The first release of Screenplay Studio for iPhone, iPad, Mac and Android: the script editor, scene breakdown, shot list, schedule, characters and a digital slate, all synced with your account on the web.

## Categories and rating

| | App Store | Google Play |
| --- | --- | --- |
| Primary category | Productivity | Productivity |
| Secondary category | Entertainment | — |
| Age rating | 4+ (questionnaire: all "None") | IARC questionnaire: no violence, sex, language, gambling, drugs; users can interact (shared projects) → expect "Everyone" / PEGI 3 |
| Price | Free | Free |
| Contains ads | No | No |
| In-app purchases | None in the app | None in the app |

## URLs

| | |
| --- | --- |
| Marketing / website | https://screenplaystudio.fun |
| Support URL | https://screenplaystudio.fun/support |
| Privacy policy | https://screenplaystudio.fun/legal/privacy |
| Terms (EULA) | https://screenplaystudio.fun/legal/terms |
| Account deletion (Play requires a web URL) | https://screenplaystudio.fun/settings/security |
| Support email | support@screenplaystudio.fun |

## App Review / App access notes

Paste into App Store Connect → App Review Information → Notes, and Play Console → App content → App access → "All or some functionality is restricted" → instructions.

> Sign in with the demo account below; it already has a project ("The Long Winter") with a script, scenes, shots, characters and a schedule that starts today.
>
> • Projects → The Long Winter opens the project hub. Script opens the editor; tap any line and use the element bar above the keyboard to change its type.
> • Scenes & breakdown, Shot list, Schedule and Characters are under the same hub. Slate is a clapperboard: tap CLAP to log a take onto the selected shot.
> • Today lists what's scheduled across all projects.
> • Settings → Delete account permanently deletes the account and its data (type DELETE to confirm). Please use a new account if you test this, not the demo account.
>
> The microphone permission (iOS/Mac only) is requested only if the user turns on timecode input in the slate; it reads LTC timecode from a sync box and never records audio.
>
> Email: appreview@screenplaystudio.fun
> Password: (from `scripts/seed-review-account.mjs`)

## Privacy answers

Both stores ask the same thing in different forms. What the apps actually collect:

| Data | Collected | Linked to user | Tracking | Purpose |
| --- | --- | --- | --- | --- |
| Email address | Yes | Yes | No | Account / app functionality |
| Name | Yes (optional, at sign-up) | Yes | No | App functionality |
| User ID | Yes | Yes | No | App functionality |
| User content (scripts, projects, notes) | Yes | Yes | No | App functionality |
| Audio | No — LTC is analysed on-device, never stored or sent | — | — | — |
| Location, contacts, photos, health, financial, browsing, diagnostics, identifiers for ads | No | — | — | — |

**App Store → App Privacy:** "Data Linked to You": Contact Info → Email Address, Name; Identifiers → User ID; User Content → Other User Content. All for App Functionality. No tracking. This matches `mobile/ScreenplayStudio/Resources/PrivacyInfo.xcprivacy`.

**Google Play → Data safety:**
- Collects: Personal info → Email address, Name, User IDs; App activity → Other user-generated content.
- Shared with third parties: No (Supabase is a processor acting for us, which Play does not count as sharing).
- Encrypted in transit: Yes. Users can request deletion: Yes (in the app and at the URL above).
- Collection is required for email/user ID, optional for name.

## Export compliance

The apps only use HTTPS (TLS from the OS). App Store: `ITSAppUsesNonExemptEncryption = NO` is already set, so no export questionnaire per build. Play: no declaration needed beyond "uses standard encryption" if asked.
