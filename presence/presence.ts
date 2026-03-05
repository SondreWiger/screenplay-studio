/**
 * Screenplay Studio — PreMiD Presence
 *
 * Reads `window.__PREMID_DATA__` from the page (written by the app's
 * usePreMiD hook) and forwards it to Discord via the PreMiD desktop app.
 *
 * Build: npm run build  →  dist/presence.js
 * Test: Load via the PreMiD extension's local presence loader.
 *
 * Submitting to PreMiD's official store:
 *   https://docs.premid.app/dev/presence/guidelines
 *   Open a PR to https://github.com/PreMiD/Presences
 *
 * Discord Application Setup (for self-hosting):
 *   1. https://discord.com/developers/applications → New Application
 *   2. Name it "Screenplay Studio"
 *   3. Copy the Application ID and paste it as the clientId below
 *   4. Go to Rich Presence → Art Assets and upload:
 *      - "ss-logo"  — the Screenplay Studio square logo (512×512 min)
 *      - "writing"  — pencil / writing icon
 *      - "idle"     — idle / moon icon
 */

// ─────────────────────────────────────────────────────────────
// IMPORTANT: Replace this with your Discord Application Client ID.
// PreMiD will provide one when the presence is accepted to their store.
// For self-testing, create your own at discord.com/developers/applications.
const CLIENT_ID = "0000000000000000000";
// ─────────────────────────────────────────────────────────────

interface PreMiDData {
  state: "editing" | "viewing" | "idle";
  project: string | null;
  tool: string | null;
  startTimestamp: number;
}

const presence = new Presence({ clientId: CLIENT_ID });

// Fallback timestamp for when the user is just browsing the site
const browsingTimestamp = Math.floor(Date.now() / 1000);

presence.on("UpdateData", async () => {
  const [enabled, showProject, showTool, showTimestamp] = await Promise.all([
    presence.getSetting<boolean>("enabled"),
    presence.getSetting<boolean>("showProject"),
    presence.getSetting<boolean>("showTool"),
    presence.getSetting<boolean>("showTimestamp"),
  ]);

  if (!enabled) {
    presence.clearActivity();
    return;
  }

  const data = await presence.getPageVariable<PreMiDData>("__PREMID_DATA__");
  const path = location.pathname;

  const presenceData: PresenceData = {
    largeImageKey:  "ss-logo",
    largeImageText: "Screenplay Studio",
  };

  // ── Not in a project (landing, dashboard, auth, etc.) ────────
  if (!data || path === "/" || path === "/dashboard" || path.startsWith("/auth")) {
    const pageLabels: Record<string, string> = {
      "/":          "Browsing the landing page",
      "/dashboard": "Browsing the dashboard",
      "/blog":      "Reading the blog",
      "/community": "In the community",
      "/about":     "Reading about",
      "/pro":       "Checking out Pro",
    };
    presenceData.details = pageLabels[path] ?? "Browsing";
    if (showTimestamp) presenceData.startTimestamp = browsingTimestamp;
    presence.setActivity(presenceData);
    return;
  }

  // ── Idle ────────────────────────────────────────────────────
  if (data.state === "idle") {
    presenceData.details        = showProject && data.project ? data.project : "Screenplay Studio";
    presenceData.state          = "Taking a break";
    presenceData.smallImageKey  = "idle";
    presenceData.smallImageText = "Idle";
    // Do not show timestamp when idle
    presence.setActivity(presenceData);
    return;
  }

  // ── Active in a project ──────────────────────────────────────
  presenceData.details = showProject && data.project
    ? data.project
    : "Working on a project";

  if (showTool && data.tool) {
    presenceData.state = data.tool;
  }

  presenceData.smallImageKey  = "writing";
  presenceData.smallImageText = "Editing";

  if (showTimestamp && data.startTimestamp) {
    presenceData.startTimestamp = data.startTimestamp;
  }

  presence.setActivity(presenceData);
});
