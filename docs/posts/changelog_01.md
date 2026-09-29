# Changelog 01: The "Pro Tools & Mobile" Update! 🚀

Date: 26 August 2026

Welcome to the biggest update to Screenplay Studio yet! We've been hard at work making the app faster, more secure, and way more powerful. Oh, and we built an entire iPhone app. No big deal. 😉

Here's a breakdown of everything new, shiny, and fixed!

## 📱 The All-New Native iPhone App
That's right! Screenplay Studio is now available natively on iOS. It's lightning-fast, offline-first, and designed specifically for your phone.
- **Offline First**: Write in the desert. Write in a cave. Your scripts sync up automatically the second you get signal.
- **Live Collaboration**: Watch your co-writers' edits appear in real time. 
- **Digital Clapperboard**: A fully working digital slate right in your pocket. Snap it, log it, and it syncs straight to your shot list!
- **Mobile-Perfect Typing**: Screenplay indents that actually fit on your screen, with a custom quick-action bar for switching between Dialogue, Action, and Character cues instantly.

## 🛠️ The Pro Tools Suite
We completely ripped out the old "Studio" sidebar and replaced it with a massive, beautifully organized **Pro Tools Hub**.
- **37 Production Tools**: Everything from Budgeting and Dailies to Unions, Guilds, and Catering.
- **Color-Coded & Clean**: Tools are now categorized into ledgers, boards, checklists, and cards, making it instantly clear what you're working on.
- **Interconnected**: Tag a real character in the casting tool. Link a catering log to a real shoot day. Your data is now smart and connected across the entire project!
- **Lightning Fast Search**: Finding a tool is now as simple as opening the Command Palette and typing its name.

## 📇 The People Directory
Projects end. People don't. Introducing the **People Directory**—your personal, private, cross-project address book!
- **Track Cast & Crew**: Keep contact info, day rates, and agency details in one place.
- **Rate Your Crew**: Leave private 1-5 star ratings and notes so you always remember who to hire again.
- **Import from Projects**: Instantly pull contacts from your existing shoots to build your directory fast.

## 🎨 A Cleaner, More Professional Design
We heard you: the intense "cyberpunk neon glow" was a bit much for a daily writing tool. 
- **Sleek & Professional**: We removed the intense neon halos and aggressive bold text, replacing them with clean shadows, refined typography, and better contrast.
- **Easier on the Eyes**: Fonts are slightly larger and much more legible, meaning less eye strain during those 3 AM writing sessions.

## 🐛 Bug Fixes & Under-the-Hood Magic
- **Security First**: We locked down theme publishing and commenting, ensuring no one can spoof authorship.
- **Google Auth**: Fixed an issue where signing in with Google sent you into the void. It now correctly lands you in the app!
- **Mobile Web Fixes**: If you use the website on your phone, everything is much smoother. Inputs no longer aggressively zoom in, buttons are easier to tap, and script margins finally fit your screen perfectly.
- **Desktop Icons**: The Windows and Mac desktop apps now feature beautifully rounded, transparent icons, and we've added full support for Linux icons too!
- **Speed & Stability**: We obliterated a bunch of crashes, squashed race conditions that occurred when switching projects quickly, and drastically improved the stability of our authentication flow.

---
**Developers (Action Required)**: If you are running the project locally, please make sure to run the two new Supabase migrations (`20260826140000_pro_tool_suite.sql` and `20260826160000_people_directory.sql`) so your database is up to date for the new tools!

Happy Writing! 🎬
