# Screenplay Studio — Pro Features Plan

## Philosophy: DaVinci Resolve Model
- The free version is **fully functional** — no artificial limits, no nags, no visible paywalls
- Pro features are **completely hidden** unless the user has Pro status
- Users who don't have Pro never see locked icons, upgrade prompts, or "this is a Pro feature" text
- Pro is gated by the admin (no self-serve payments yet) via the admin dashboard toggle
- Think of it as: free = DaVinci Resolve free, Pro = DaVinci Resolve Studio

---

## Database/Infrastructure (Already Done)
- `profiles.is_pro` (BOOLEAN, default false)
- `profiles.pro_since` (TIMESTAMPTZ)
- Admin can toggle Pro status per user via Edit User modal
- PRO badge shows in admin user table

## Implementation Pattern (Not Yet Built)
When we implement, create a `useProFeatures()` hook:
```ts
function useProFeatures() {
  const { user } = useAuthStore();
  const isPro = user?.is_pro ?? false;
  return { isPro };
}
```
Then in components: `if (!isPro) return null;` — the feature simply doesn't render.

---

## Pro Feature Ideas

### 1. Advanced Analytics Dashboard
- Per-project writing analytics (words/day, pace, streak)
- Character dialogue distribution breakdown (who speaks most)
- Scene complexity scoring
- Time tracking per session
- Writing heatmap (GitHub-style contribution graph)

### 2. AI-Assisted Tools
- AI scene description suggestions
- Dialogue improvement suggestions (tone, pacing)
- Auto-generate scene breakdowns from script
- Character consistency checker
- Auto-generate shooting schedule from scene breakdowns

### 3. Advanced Export Options
- Export to Final Draft (.fdx)
- Export to Fountain (.fountain)
- Custom watermarking on PDFs
- Batch export all scripts in a project
- Export shot list as PDF with storyboard images

### 4. Storyboard Drawing Tool
- Built-in simple drawing canvas per shot
- Reference image overlay
- Basic shapes and stick figures
- Export storyboard as PDF

### 5. Advanced Collaboration
- Version branching (fork a script, merge later)
- Inline suggest mode (like Google Docs suggestions)
- Approval workflows for script changes
- Per-scene commenting threads
- Locking sections while editing

### 6. Production Reports
- Daily production reports (auto-generated)
- Call sheets generation
- Day-out-of-days report
- One-liner schedule
- Scene continuity reports

### 7. Color-Coded Script Revisions (Enhanced)
- Side-by-side revision comparison
- Revision statistics and change logs
- Multi-draft comparison view
- Revision approval workflow

### 8. Advanced Budget Tools
- Budget templates for different production scales
- Currency conversion
- PayPal/invoice integration links
- Budget vs. actuals trend charts
- Multi-project budget aggregation

### 9. Custom Branding
- Custom project cover page
- Company logo on exports
- Custom color themes for projects
- Branded call sheets

### 10. Advanced Schedule Features
- Drag-and-drop day reordering
- Weather API integration
- Crew availability tracking
- Equipment booking system
- Automated conflict detection

---

## Priority Tiers

### Tier 1 (High Value, Build First)
- Advanced Export (.fdx, .fountain, watermarked PDF)
- Production Reports (call sheets, day-out-of-days)
- Writing Analytics Dashboard
- Revision comparison

### Tier 2 (Medium Value)
- AI-Assisted Tools
- Storyboard Drawing Tool
- Advanced Collaboration
- Budget templates & reports

### Tier 3 (Nice to Have)
- Custom Branding
- Advanced Schedule Features
- Equipment booking

---

## Revenue Model (Future)
- Monthly subscription (consider $9.99/mo or $99/yr)
- Lifetime option ($199 one-time)
- Educational discount (50% off)
- Free for open-source film projects

---

## Notes
- NEVER show "upgrade" prompts or locked feature indicators
- If a user doesn't have Pro, they see the exact same UI minus the Pro features
- Pro features should feel like bonus power tools, not core necessities
- The free version should remain genuinely useful for production
