import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const userClient = createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { userIds, subject, heading, body: emailBody, ctaLabel, ctaUrl, batchSize = 100 } = body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: 'userIds required' }, { status: 400 });
  }
  if (!subject || !heading || !emailBody) {
    return NextResponse.json({ error: 'subject, heading, body required' }, { status: 400 });
  }

  const adminSupabase = createAdminSupabaseClient();

  // Create batch record
  const { data: batch, error: batchErr } = await adminSupabase
    .from('email_batches')
    .insert({
      subject,
      heading,
      body: emailBody,
      cta_label: ctaLabel || null,
      cta_url: ctaUrl || null,
      total_recipients: userIds.length,
      batch_size: batchSize,
      status: 'pending',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (batchErr || !batch) {
    return NextResponse.json({ error: `Failed to create batch: ${batchErr?.message}` }, { status: 500 });
  }

  // Fetch user emails
  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('id, email')
    .in('id', userIds);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ error: 'No valid recipients' }, { status: 400 });
  }

  // Insert all recipients
  const recipients = profiles
    .filter(p => p.email)
    .map(p => ({
      batch_id: batch.id,
      user_id: p.id,
      email: p.email!,
      sent: false,
    }));

  const { error: recErr } = await adminSupabase
    .from('email_batch_recipients')
    .insert(recipients);

  if (recErr) {
    return NextResponse.json({ error: `Failed to add recipients: ${recErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    batchId: batch.id,
    totalRecipients: recipients.length,
    estimatedDays: Math.ceil(recipients.length / batchSize),
  });
}
