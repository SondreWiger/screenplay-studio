# 3.0 launch checklist

Manual steps that code can't do. In order.

## Before deploying
1. **Apply the database migrations** in the Supabase SQL editor, in this order:
   1. `supabase/migrations/20260628100000_world_entities.sql` — Worldbuilding (never applied; the tool shows "not available" until it is)
   2. `supabase/migration_bundle_codes.sql` — Pro bundle codes for Cinderra / CastingCall
   3. `supabase/migrations/20260929120000_missing_profile_columns.sql` — `last_seen` (admin stats, middleware) and the writing goal
   4. `supabase/migrations/20261001000000_launch_3_0.sql` — sets the site version to 3.0.0 and turns the open-source claim off
2. **Supabase → Authentication → URL Configuration → Redirect URLs** must allow
   `https://<your domain>/auth/callback*` (password reset now returns through it to `/auth/reset-password`).
3. **Pro gating:** confirm `site_settings.pro_gating_enabled` is what you want at launch (`'false'` gives everyone Pro and Studio).
4. Optional: set `MIDDLEWARE_SECRET` in the environment (otherwise the moderation cookie is signed with the service-role key).

## Deploy
5. Deploy `main` (Vercel). CI runs lint, typecheck, build and tests.
6. Smoke test on production: sign up with a new address, confirm, reset password, create a project, write a scene, export PDF, open a Studio tool as a grandfathered Pro user.

## Desktop
7. Tag the release to build desktop installers: `git tag v3.0.0 && git push origin v3.0.0`.
   (3.0.0 is higher than 2.7.7, so existing desktop installs auto-update.)

## Announce
8. Post the 3.0.0 release notes in **Admin → Changelog** (text is in `CHANGELOG.md`) so they appear on /changelog and the "What's new" badge.
