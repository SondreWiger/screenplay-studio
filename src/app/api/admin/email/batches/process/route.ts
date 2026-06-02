import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { sendNotificationEmail } from '@/lib/mailer';

function replaceVars(str: string, vars: Record<string, string>): string {
  let result = str;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, val);
  }
  return result;
}

export async function GET(req: NextRequest) {
  // Auth: require cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = createAdminSupabaseClient();

  // Find next pending batch
  const { data: batch, error: batchErr } = await adminSupabase
    .from('email_batches')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (batchErr || !batch) {
    return NextResponse.json({ message: 'No pending batches', processed: 0 });
  }

  // Get next batch_size unsent recipients
  const { data: recipients, error: recErr } = await adminSupabase
    .from('email_batch_recipients')
    .select('*')
    .eq('batch_id', batch.id)
    .eq('sent', false)
    .order('id', { ascending: true })
    .limit(batch.batch_size);

  if (recErr || !recipients || recipients.length === 0) {
    // Mark batch as completed
    await adminSupabase
      .from('email_batches')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', batch.id);

    return NextResponse.json({ message: 'Batch completed', batchId: batch.id, processed: 0 });
  }

  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const vars = { name: recipient.email.split('@')[0], email: recipient.email };

    // Fetch user name
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('full_name, display_name')
      .eq('id', recipient.user_id)
      .single();

    const name = profile?.display_name || profile?.full_name || 'there';
    vars.name = name;

    const result = await sendNotificationEmail({
      to: { email: recipient.email, name },
      subject: replaceVars(batch.subject, vars),
      heading: replaceVars(batch.heading, vars),
      body: replaceVars(batch.body, vars),
      ctaLabel: batch.cta_label ? replaceVars(batch.cta_label, vars) : undefined,
      ctaUrl: batch.cta_url ? replaceVars(batch.cta_url, vars) : undefined,
    });

    if (result.success) {
      sent++;
      await adminSupabase
        .from('email_batch_recipients')
        .update({ sent: true, sent_at: new Date().toISOString() })
        .eq('id', recipient.id);
    } else {
      failed++;
      errors.push(`${recipient.email}: ${result.error}`);
      await adminSupabase
        .from('email_batch_recipients')
        .update({ error: result.error || 'unknown' })
        .eq('id', recipient.id);
    }

    // Rate limit: 100ms between sends
    await new Promise(r => setTimeout(r, 100));
  }

  // Update batch progress
  const newSentCount = batch.sent_count + sent;
  const newFailedCount = batch.failed_count + failed;
  const allDone = newSentCount + newFailedCount >= batch.total_recipients;

  await adminSupabase
    .from('email_batches')
    .update({
      sent_count: newSentCount,
      failed_count: newFailedCount,
      last_processed_at: new Date().toISOString(),
      status: allDone ? 'completed' : 'pending',
      completed_at: allDone ? new Date().toISOString() : null,
      errors: [...(batch.errors || []), ...errors],
    })
    .eq('id', batch.id);

  return NextResponse.json({
    batchId: batch.id,
    sent,
    failed,
    totalProcessed: newSentCount + newFailedCount,
    totalRecipients: batch.total_recipients,
    remaining: batch.total_recipients - newSentCount - newFailedCount,
    allDone,
  });
}
