#!/usr/bin/env node
// Creates (or refreshes) the account App Store and Google Play reviewers sign
// in with, and fills it with a realistic demo project so every screen of the
// apps has something on it.
//
//   REVIEW_PASSWORD='…' node --env-file=.env.local scripts/seed-review-account.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side
// only — run this from your own machine, never from a client). Safe to re-run:
// the user is reused, its password reset to REVIEW_PASSWORD, and the demo
// project is deleted and recreated so reviewers always see a clean copy.
//
// Leave REVIEW_PASSWORD unset to have one generated; it's printed once at the
// end. Paste the email and password into App Store Connect → App Review
// Information, and Play Console → App content → App access.

import crypto from 'node:crypto';

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.REVIEW_EMAIL || 'appreview@screenplaystudio.fun';
const PASSWORD = process.env.REVIEW_PASSWORD || crypto.randomBytes(12).toString('base64url');
const PROJECT_TITLE = 'The Long Winter';

if (!URL_BASE || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local.');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function call(method, path, body, extra = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: { ...headers, ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const rest = (method, table, body, query = '') =>
  call(method, `/rest/v1/${table}${query}`, body, { Prefer: 'return=representation' });

// ── 1. The user ────────────────────────────────────────────────────────────

async function findUser(email) {
  for (let page = 1; page < 50; page++) {
    const { users } = await call('GET', `/auth/v1/admin/users?page=${page}&per_page=200`);
    const hit = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

let user = await findUser(EMAIL);
if (user) {
  await call('PUT', `/auth/v1/admin/users/${user.id}`, { password: PASSWORD, email_confirm: true });
  console.log(`✓ Reusing ${EMAIL} (${user.id}), password reset`);
} else {
  user = await call('POST', '/auth/v1/admin/users', {
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'App Review' },
  });
  console.log(`✓ Created ${EMAIL} (${user.id})`);
}
const uid = user.id;
await rest('PATCH', 'profiles', { full_name: 'App Review', display_name: 'App Review' }, `?id=eq.${uid}`).catch(() => {});

// ── 2. A clean demo project ────────────────────────────────────────────────

await rest('DELETE', 'projects', undefined, `?created_by=eq.${uid}&title=eq.${encodeURIComponent(PROJECT_TITLE)}`);

const [project] = await rest('POST', 'projects', [{
  title: PROJECT_TITLE,
  logline: "A lighthouse keeper's daughter finds a body in the ice — and the only witness is the man she left behind.",
  genre: ['Thriller', 'Drama'],
  format: 'feature',
  status: 'pre_production',
  created_by: uid,
}]);
console.log(`✓ Project ${project.id}`);

// A database trigger gives every new project a first draft; reuse it.
let [script] = await rest('GET', 'scripts', undefined, `?project_id=eq.${project.id}&limit=1`);
if (script) {
  [script] = await rest('PATCH', 'scripts', { title: PROJECT_TITLE, is_active: true }, `?id=eq.${script.id}`);
} else {
  [script] = await rest('POST', 'scripts', [{ project_id: project.id, title: PROJECT_TITLE, created_by: uid, is_active: true }]);
}

const lines = [
  ['scene_heading', 'EXT. HALVARD POINT LIGHTHOUSE - DAWN'],
  ['action', 'Ice all the way to the horizon. The lighthouse stands against it like something that refuses to be told.'],
  ['action', "MAREN, 34, weatherproofed to the eyes, walks the frozen shoreline with a torch she doesn't need yet."],
  ['character', 'MAREN'],
  ['parenthetical', '(into a radio)'],
  ['dialogue', "Station, this is Halvard Point. I've got something on the ice about two hundred metres out."],
  ['action', 'Static. She waits. The wind takes the sound away from her.'],
  ['character', 'RADIO (V.O.)'],
  ['dialogue', 'Say again, Halvard Point.'],
  ['character', 'MAREN'],
  ['dialogue', "I said there's a body."],
  ['transition', 'CUT TO:'],
  ['scene_heading', 'INT. LIGHTHOUSE - KITCHEN - CONTINUOUS'],
  ['action', 'A kettle screams itself out on an unlit hob. Nobody comes.'],
  ['scene_heading', 'EXT. QUAY - DAY'],
  ['action', "A police launch noses through the channel it broke coming in. JOHAN, 40s, steps off it before it's tied."],
  ['character', 'JOHAN'],
  ['dialogue', "You didn't have to call it in yourself."],
  ['character', 'MAREN'],
  ['dialogue', "There wasn't anybody else on the point."],
  ['action', 'He looks at the lighthouse. Twenty years fold up between them and neither one mentions it.'],
];
await rest('DELETE', 'script_elements', undefined, `?script_id=eq.${script.id}`);
await rest('POST', 'script_elements', lines.map(([element_type, content], i) => ({
  script_id: script.id, element_type, content, sort_order: i, created_by: uid,
})));
console.log(`✓ Script with ${lines.length} elements`);

const characters = await rest('POST', 'characters', [
  { name: 'MAREN', full_name: 'Maren Halvardsen', age: '34', gender: 'Female', description: 'Keeps the light. Keeps most other things too.', color: '#FF5F1F', is_main: true, cast_actor: 'Ingrid Solheim', sort_order: 0 },
  { name: 'JOHAN', full_name: 'Johan Lie', age: '41', gender: 'Male', description: "Came back for the case. Says it's the case.", color: '#8B5CF6', is_main: true, sort_order: 1 },
  { name: 'ELSE', full_name: 'Else Halvardsen', age: '71', gender: 'Female', description: "Maren's mother. Remembers a different winter.", color: '#06B6D4', is_main: false, sort_order: 2 },
].map((c) => ({ ...c, project_id: project.id, created_by: uid })));
const [maren, johan] = characters;

const scenes = await rest('POST', 'scenes', [
  { scene_number: '1', scene_heading: 'EXT. HALVARD POINT LIGHTHOUSE - DAWN', location_type: 'EXT', location_name: 'HALVARD POINT LIGHTHOUSE', time_of_day: 'DAWN', synopsis: 'Maren finds the body on the ice and calls it in.', page_count: 2.5, cast_ids: [maren.id], props: ['Storm torch', 'Handheld VHF radio', 'Ice axe'], costumes: ['Maren — survival suit'], special_effects: ['Breath vapour', 'Blown snow'], special_equipment: ['Ice mats', 'Rescue line'], notes: 'First shot of the film. Protect the dawn light.', is_completed: true, sort_order: 0 },
  { scene_number: '2', scene_heading: 'INT. LIGHTHOUSE - KITCHEN - CONTINUOUS', location_type: 'INT', location_name: 'LIGHTHOUSE KITCHEN', time_of_day: 'CONTINUOUS', synopsis: 'An empty room that says everything.', page_count: 0.375, cast_ids: [], props: ['Enamel kettle', 'Tin mugs'], special_effects: ['Practical steam'], is_completed: true, sort_order: 1 },
  { scene_number: '3', scene_heading: 'EXT. QUAY - DAY', location_type: 'EXT', location_name: 'HALVARD QUAY', time_of_day: 'DAY', synopsis: 'Johan arrives. Twenty years in one look.', page_count: 1.75, cast_ids: [maren.id, johan.id], extras_count: 6, props: ['Mooring rope', 'Evidence case'], vehicles: ['Police launch'], notes: 'Tide window is 11:00–14:00 only.', is_completed: false, sort_order: 2 },
  { scene_number: '4', scene_heading: 'INT. LIGHTHOUSE - LAMP ROOM - NIGHT', location_type: 'INT', location_name: 'LAMP ROOM', time_of_day: 'NIGHT', synopsis: 'Maren tells Johan what she saw. Not all of it.', page_count: 3.125, cast_ids: [maren.id, johan.id], props: ['Logbook', 'Paraffin lamp'], music_cues: ['Lamp room theme'], is_completed: false, sort_order: 3 },
].map((s) => ({ ...s, project_id: project.id, script_id: script.id, created_by: uid })));
console.log(`✓ ${scenes.length} scenes, ${characters.length} characters`);

await rest('POST', 'shots', [
  { scene_id: scenes[0].id, shot_number: '1A', shot_type: 'establishing', shot_movement: 'crane_up', lens: '24mm', description: 'Crane up from the ice to reveal the lighthouse against a colourless dawn.', takes_needed: 3, takes_completed: 4, is_completed: true, sort_order: 0 },
  { scene_id: scenes[0].id, shot_number: '1B', shot_type: 'medium', shot_movement: 'follow', lens: '50mm', description: 'Track with Maren along the shoreline.', takes_needed: 4, takes_completed: 6, is_completed: true, sort_order: 1 },
  { scene_id: scenes[2].id, shot_number: '3A', shot_type: 'wide', shot_movement: 'static', lens: '35mm', description: 'The launch noses in through broken ice.', takes_needed: 2, takes_completed: 0, sort_order: 2 },
  { scene_id: scenes[2].id, shot_number: '3B', shot_type: 'over_shoulder', shot_movement: 'rack_focus', lens: '75mm', description: 'Over Johan to Maren — rack as she decides not to say it.', takes_needed: 4, takes_completed: 0, sort_order: 3 },
  { scene_id: scenes[3].id, shot_number: '4A', shot_type: 'two_shot', shot_movement: 'orbit', lens: '32mm', description: 'Slow orbit around them both as the lamp comes round.', takes_needed: 6, takes_completed: 0, sort_order: 4 },
].map((s) => ({ ...s, project_id: project.id, created_by: uid })));

// Schedule relative to today, so "Today" and "Next up" are never empty for a
// reviewer, whenever they open the app. Re-run before each submission.
const at = (days, hour) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
await rest('POST', 'production_schedule', [
  { title: 'Day 4 — Quay exteriors', event_type: 'shooting', start_time: at(0, 7), end_time: at(0, 18), call_time: at(0, 6), scene_ids: [scenes[2].id], notes: 'Tide window 11:00–14:00. Marine safety boat on standby.', is_confirmed: true },
  { title: 'Day 5 — Lamp room nights', event_type: 'shooting', start_time: at(1, 16), end_time: at(1, 23), scene_ids: [scenes[3].id], is_confirmed: true },
  { title: 'Recce — north shoreline', event_type: 'location_scout', start_time: at(3, 9), end_time: at(3, 13), is_confirmed: false },
].map((e) => ({ ...e, project_id: project.id, all_day: false, created_by: uid })));
console.log('✓ Shots and schedule');

console.log(`
Reviewer sign-in (paste into App Store Connect and Play Console):
  Email:    ${EMAIL}
  Password: ${PASSWORD}
`);
