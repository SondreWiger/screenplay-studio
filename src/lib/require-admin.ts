import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || process.env.ADMIN_UID || '';

/**
 * For routes that act with the service role on an admin's behalf. Signed-in
 * is not enough: returns a 403 response unless the user is the owner account
 * or has role 'admin', otherwise null.
 */
export async function rejectUnlessAdmin(userId: string | undefined): Promise<NextResponse | null> {
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ADMIN_UID && userId === ADMIN_UID) return null;
  const { data } = await createAdminSupabaseClient().from('profiles').select('role').eq('id', userId).single();
  return data?.role === 'admin' ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
