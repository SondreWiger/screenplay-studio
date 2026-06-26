import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/mailer';

const KILLSWITCH_KEY = process.env.KILLSWITCH_SECRET || '';

// How long (ms) to wait between emails to avoid rate-limiting
const EMAIL_DELAY_MS = 150;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildKillswitchEmail(name: string): { html: string; text: string } {
  const githubUrl = 'https://github.com/anomalyco/screenplay-studio';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://screenplaystudio.fun';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">
    <div style="text-align:center;margin-bottom:32px">
      <span style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px">🎬 Screenplay Studio</span>
    </div>
    <div style="background:#141418;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:36px;color:#e5e5e5">
      <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#fff">An important message about Screenplay Studio</h1>

      <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#a1a1aa">
        Hi ${name || 'there'},
      </p>

      <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#a1a1aa">
        The creator of Screenplay Studio, <strong style="color:#fff">Sondre</strong>, is no longer able to maintain
        or operate this service. The open-source kill switch has been activated.
      </p>

      <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#a1a1aa">
        <strong style="color:#fff">This is not a closure — this is a handover.</strong><br>
        Screenplay Studio is fully open-source and you can continue using it locally or self-host it forever.
        Everything you've built is yours to keep.
      </p>

      <div style="background:#1e1e28;border-left:3px solid #ef4444;border-radius:6px;padding:20px;margin:24px 0">
        <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#fff">How to download your data</p>
        <p style="margin:0 0 12px;font-size:13px;line-height:1.7;color:#a1a1aa">
          Visit <a href="${appUrl}/settings" style="color:#ef4444">${appUrl}/settings</a> → scroll to
          <em>Data &amp; Export</em> → click <strong>Export All Data</strong>. You'll receive a ZIP with all your
          scripts, projects, and notes in standard formats.
        </p>
      </div>

      <div style="background:#1e1e28;border-left:3px solid #6366f1;border-radius:6px;padding:20px;margin:24px 0">
        <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#fff">How to run Screenplay Studio locally</p>
        <ol style="margin:0;padding-left:20px;font-size:13px;line-height:1.9;color:#a1a1aa">
          <li>Clone the repository: <code style="background:#0a0a0c;padding:2px 6px;border-radius:4px;color:#a5f3fc">git clone ${githubUrl}</code></li>
          <li>Copy <code style="background:#0a0a0c;padding:2px 6px;border-radius:4px;color:#a5f3fc">.env.local.example</code> to <code style="background:#0a0a0c;padding:2px 6px;border-radius:4px;color:#a5f3fc">.env.local</code> and fill in your own Supabase credentials</li>
          <li>Run <code style="background:#0a0a0c;padding:2px 6px;border-radius:4px;color:#a5f3fc">npm install</code> then <code style="background:#0a0a0c;padding:2px 6px;border-radius:4px;color:#a5f3fc">npm run dev</code></li>
          <li>Open <code style="background:#0a0a0c;padding:2px 6px;border-radius:4px;color:#a5f3fc">http://localhost:3000</code></li>
        </ol>
        <p style="margin:12px 0 0;font-size:13px;color:#a1a1aa">
          Full instructions at <a href="${githubUrl}" style="color:#6366f1">${githubUrl}</a>
        </p>
      </div>

      <div style="background:#1e1e28;border-left:3px solid #22c55e;border-radius:6px;padding:20px;margin:24px 0">
        <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#fff">How to self-host</p>
        <p style="margin:0;font-size:13px;line-height:1.7;color:#a1a1aa">
          Deploy to <strong style="color:#fff">Vercel</strong> (free tier works), or use the included
          <code style="background:#0a0a0c;padding:2px 6px;border-radius:4px;color:#a5f3fc">Dockerfile</code> and
          <code style="background:#0a0a0c;padding:2px 6px;border-radius:4px;color:#a5f3fc">docker-compose.yml</code>
          to run on any server. See the README for step-by-step instructions.
        </p>
      </div>

      <p style="margin:24px 0 0;font-size:15px;line-height:1.8;color:#a1a1aa">
        It has been an honour to build something people actually use and love. Thank you for being part of this.
        The stories you're writing matter — please keep writing them.
      </p>

      <p style="margin:16px 0 0;font-size:15px;color:#a1a1aa">— Sondre</p>
    </div>

    <div style="text-align:center;margin-top:28px">
      <a href="${githubUrl}" style="display:inline-block;padding:12px 32px;background:#ef4444;color:#fff;font-weight:600;border-radius:8px;text-decoration:none;font-size:14px;margin-bottom:16px">
        Download the Repository
      </a>
      <br>
      <p style="font-size:11px;color:#52525b;margin-top:8px">
        Screenplay Studio is MIT-licensed. Fork it, run it, share it freely.
      </p>
    </div>
  </div>
</body>
</html>`.trim();

  const text = [
    `Hi ${name || 'there'},`,
    '',
    'The creator of Screenplay Studio, Sondre, is no longer able to maintain or operate this service.',
    'The open-source kill switch has been activated.',
    '',
    'THIS IS NOT A CLOSURE — THIS IS A HANDOVER.',
    'Screenplay Studio is fully open-source and you can continue using it locally or self-host it forever.',
    '',
    '--- How to download your data ---',
    `Visit ${appUrl}/settings → scroll to "Data & Export" → click "Export All Data".`,
    '',
    '--- How to run locally ---',
    `1. git clone ${githubUrl}`,
    '2. Copy .env.local.example to .env.local and fill in your Supabase credentials',
    '3. npm install && npm run dev',
    '4. Open http://localhost:3000',
    '',
    '--- How to self-host ---',
    'Deploy to Vercel (free tier) or use the included Dockerfile / docker-compose.yml.',
    `Full instructions: ${githubUrl}`,
    '',
    'It has been an honour. Thank you for being part of this. Keep writing.',
    '',
    '— Sondre',
  ].join('\n');

  return { html, text };
}

export async function POST(req: NextRequest) {
  // Validate the kill-switch key
  if (!KILLSWITCH_KEY) {
    return NextResponse.json({ error: 'Kill switch not configured on this server.' }, { status: 503 });
  }

  let body: { key?: string; confirmation?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.key || body.key.trim() !== KILLSWITCH_KEY.trim()) {
    // Artificial delay to prevent timing attacks / brute-force
    await sleep(1200);
    return NextResponse.json({ error: 'Invalid key.' }, { status: 403 });
  }

  if (!body.confirmation) {
    return NextResponse.json({ error: 'Explicit confirmation required.' }, { status: 400 });
  }

  // --- Key validated. Fire the kill switch. ---

  const adminSupabase = createAdminSupabaseClient();

  // Fetch all user emails from profiles
  const { data: profiles, error: fetchError } = await adminSupabase
    .from('profiles')
    .select('id, email, display_name, full_name')
    .not('email', 'is', null);

  if (fetchError) {
    return NextResponse.json(
      { error: `Failed to fetch user list: ${fetchError.message}` },
      { status: 500 },
    );
  }

  const users = (profiles ?? []).filter((p) => !!p.email);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const name = user.display_name || user.full_name || 'there';
    const { html, text } = buildKillswitchEmail(name);

    const result = await sendEmail({
      to: { email: user.email, name },
      subject: 'An important message about Screenplay Studio',
      html,
      text,
      tags: ['killswitch'],
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(`${user.email}: ${result.error ?? 'unknown error'}`);
    }

    // Rate-limit friendly delay between sends
    if (i < users.length - 1) {
      await sleep(EMAIL_DELAY_MS);
    }
  }

  // Log the execution (best-effort — don't fail the response if this fails)
  try {
    await adminSupabase.from('killswitch_log').insert({
      executed_at: new Date().toISOString(),
      emails_sent: sent,
      emails_failed: failed,
    });
  } catch {
    // table may not exist — that's fine
  }

  return NextResponse.json({
    status: 'EXECUTED',
    total: users.length,
    sent,
    failed,
    errors: errors.slice(0, 20), // cap to avoid response bloat
  });
}
