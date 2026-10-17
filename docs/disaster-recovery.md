# Disaster recovery

How user projects survive Supabase being down, the project being deleted, or a
leaked key being used to wipe it.

| Layer | What it protects against | Where |
| --- | --- | --- |
| Local copy in each browser / desktop app | Short outages — people keep writing, changes sync later | `src/lib/offline/`, `src/lib/local-files.ts` |
| Supabase daily backups / PITR (paid plans) | Mistakes, bad migrations, accidental deletes | Supabase dashboard |
| Nightly off-site backup | Losing the Supabase project or account entirely | `.github/workflows/backup.yml` → R2/B2 bucket |

Targets: lose at most **24 hours** of server data (people's own devices usually
hold the rest), and be back up within **one day** on a fresh Supabase project.

## One-time setup

1. **Encryption key.** On your own machine: `age-keygen -o backup-key.txt`.
   Put the `age1…` public key in the `BACKUP_AGE_RECIPIENT` repo secret. Keep
   `backup-key.txt` offline (password manager + a printed copy). Without it
   the backups can't be read. That's deliberate: they contain password hashes.
2. **Bucket at a different provider** (Cloudflare R2 or Backblaze B2). Create
   a token that can write to just that bucket and fill in the `BACKUP_S3_*`
   secrets. Add lifecycle rules to delete `daily/` after 35 days and
   `monthly/` after 400 days. If the provider supports object lock, turn it
   on, so the backups can't be deleted even with a leaked token.
3. **Database connection.** Dashboard → Connect → Session pooler string (port
   5432) → `BACKUP_DATABASE_URL`. A read-only role is better than `postgres`
   if your project lets you grant it:
   ```sql
   CREATE ROLE backup_reader LOGIN PASSWORD '…';
   GRANT pg_read_all_data TO backup_reader;
   ```
4. **Storage files (optional but recommended).** Dashboard → Storage → S3
   connection: enable it, create an access key, and fill in the
   `SUPABASE_S3_*` secrets plus a long random `BACKUP_STORAGE_PASSWORD`.
5. Actions → *Off-site backup* → **Run workflow**, then check the bucket.
   GitHub emails you when a scheduled run fails.

## Restoring

Into a **new Supabase project** (Postgres 17 tools):

```bash
age --decrypt -i backup-key.txt -o db.dump db.dump.age
# 1. Schema: run every SQL migration in order (supabase/FULL.sql, then supabase/migrations/*)
# 2. Data — auth first so profiles' foreign keys resolve:
pg_restore --data-only --no-owner --disable-triggers --schema=auth   -d "$NEW_DB_URL" db.dump
pg_restore --data-only --no-owner --disable-triggers --schema=public -d "$NEW_DB_URL" db.dump
pg_restore --data-only --no-owner --disable-triggers --schema=storage -d "$NEW_DB_URL" db.dump
```

Then copy the Storage files back (rclone `vault:` → the new project's S3
endpoint), point `NEXT_PUBLIC_SUPABASE_URL` and the keys at the new project in
Vercel, and redeploy. Restored accounts keep their passwords.

To just **read** a dump (e.g. send one user their scripts): restore it into
any local Postgres with `pg_restore --no-owner -d postgres://localhost/recovery db.dump`.

## During an outage

- The editor saves to the device first and queues writes; nothing is dropped
  (`src/lib/offline/queue.ts`). Tell users not to clear site data.
- Post on the status channels; the killswitch and data export both need
  Supabase, so use the latest dump for anything urgent.

## Test it

Every quarter, restore the latest dump into a throwaway project and open a few
real projects. A backup you haven't restored isn't a backup.
