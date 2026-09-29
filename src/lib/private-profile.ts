/**
 * Email, last known IP and moderation notes live outside `profiles` (see
 * migration 20261001000100_private_profile_fields.sql): profiles is public, so
 * those fields are in `profile_contact` / `profile_moderation` with their own
 * access rules. These helpers read them.
 *
 * Every helper tolerates the migration not having run yet (the tables are
 * missing): it then leaves whatever the profiles row already carried, so the
 * app works on both sides of the migration.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

type WithEmail = { id?: string | null; email?: string | null } | null | undefined;

/** Map of user id → email for the ids the caller is allowed to see. */
export async function getEmailsByIds(db: Db, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => !!id)));
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await db.from('profile_contact').select('id, email').in('id', unique.slice(i, i + 200));
    if (error) return out; // migration not applied yet — callers keep their fallback
    for (const row of (data || []) as { id: string; email: string | null }[]) {
      if (row.email) out.set(row.id, row.email);
    }
  }
  return out;
}

/**
 * Fill `email` on profile objects (as embedded by a query) in place. Objects
 * must carry `id`. Existing non-empty emails are kept.
 */
export async function fillEmails<T extends WithEmail>(db: Db, profiles: T[]): Promise<T[]> {
  const map = await getEmailsByIds(db, profiles.map((p) => p?.id));
  for (const p of profiles) {
    if (p && p.id && !p.email && map.has(p.id)) (p as { email?: string | null }).email = map.get(p.id)!;
  }
  return profiles;
}

/** A user's own (or, for staff, anyone's) IP and moderation notes. */
export async function getModeration(db: Db, id: string): Promise<{ last_known_ip: string | null; moderation_notes: string | null } | null> {
  const { data, error } = await db.from('profile_moderation').select('last_known_ip, moderation_notes').eq('id', id).maybeSingle();
  if (error) return null;
  return data;
}

/** Resolve an exact email address to a user, for invitations. */
export async function findUserByEmail(db: Db, email: string): Promise<{ id: string; display_name: string | null; full_name: string | null } | null> {
  const { data, error } = await db.rpc('find_user_by_email', { p_email: email });
  if (!error) return (Array.isArray(data) ? data[0] : data) ?? null;
  // Before the migration: the address is still on profiles
  const { data: legacy } = await db.from('profiles').select('id, display_name, full_name').eq('email', email.trim()).maybeSingle();
  return legacy ?? null;
}
