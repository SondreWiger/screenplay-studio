// ============================================================
// MailerSend Email Service
// Sends transactional emails via the MailerSend API.
// ============================================================

const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY || '';
const MAILERSEND_ENDPOINT = 'https://api.mailersend.com/v1/email';
const DEFAULT_FROM_EMAIL = process.env.MAILERSEND_FROM_EMAIL || 'noreply@screenplaystudio.app';
const DEFAULT_FROM_NAME = process.env.MAILERSEND_FROM_NAME || 'Screenplay Studio';

interface EmailRecipient {
  email: string;
  name?: string;
}

interface SendEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  /** Plain text body */
  text?: string;
  /** HTML body */
  html?: string;
  from?: EmailRecipient;
  replyTo?: EmailRecipient;
  /** MailerSend template ID — if provided, html/text are ignored */
  templateId?: string;
  /** Template variables (personalization) */
  variables?: Record<string, string>;
  /** Tags for analytics grouping */
  tags?: string[];
}

interface MailerSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Send an email via MailerSend API.
 * Can be called from API routes, server actions, or server components.
 */
export async function sendEmail(options: SendEmailOptions): Promise<MailerSendResult> {
  if (!MAILERSEND_API_KEY) {
    console.warn('[mailer] MAILERSEND_API_KEY not configured — skipping email');
    return { success: false, error: 'API key not configured' };
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const from = options.from || { email: DEFAULT_FROM_EMAIL, name: DEFAULT_FROM_NAME };

  const body: Record<string, unknown> = {
    from: { email: from.email, name: from.name || from.email },
    to: recipients.map((r) => ({ email: r.email, name: r.name || r.email })),
    subject: options.subject,
  };

  if (options.templateId) {
    body.template_id = options.templateId;
    if (options.variables) {
      body.personalization = recipients.map((r) => ({
        email: r.email,
        data: options.variables,
      }));
    }
  } else {
    if (options.html) body.html = options.html;
    if (options.text) body.text = options.text;
  }

  if (options.replyTo) {
    body.reply_to = { email: options.replyTo.email, name: options.replyTo.name || options.replyTo.email };
  }

  if (options.tags?.length) {
    body.tags = options.tags;
  }

  try {
    const res = await fetch(MAILERSEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MAILERSEND_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok || res.status === 202) {
      const messageId = res.headers.get('x-message-id') || undefined;
      return { success: true, messageId, statusCode: res.status };
    }

    const errBody = await res.text();
    console.error(`[mailer] MailerSend error ${res.status}:`, errBody);
    return { success: false, error: errBody, statusCode: res.status };
  } catch (err) {
    console.error('[mailer] Network error:', err);
    return { success: false, error: String(err) };
  }
}

// ── Convenience helpers ─────────────────────────────────────

/**
 * Send a notification email with the standard Screenplay Studio template.
 */
export async function sendNotificationEmail({
  to,
  subject,
  heading,
  body,
  ctaLabel,
  ctaUrl,
}: {
  to: EmailRecipient;
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): Promise<MailerSendResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://screenplaystudio.app';
  const ctaHtml = ctaLabel && ctaUrl
    ? `<div style="text-align:center;margin:24px 0"><a href="${ctaUrl.startsWith('http') ? ctaUrl : appUrl + ctaUrl}" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#000;font-weight:600;border-radius:8px;text-decoration:none;font-size:14px">${ctaLabel}</a></div>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px">
    <div style="text-align:center;margin-bottom:32px">
      <span style="font-size:24px;font-weight:700;color:#fff;letter-spacing:-0.5px">🎬 Screenplay Studio</span>
    </div>
    <div style="background:#141418;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:32px;color:#e5e5e5">
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#fff">${heading}</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#a1a1aa">${body}</p>
      ${ctaHtml}
    </div>
    <div style="text-align:center;margin-top:24px">
      <p style="font-size:11px;color:#52525b">You received this because you have an account on Screenplay Studio.</p>
      <p style="font-size:11px;color:#52525b;margin-top:4px"><a href="${appUrl}/settings" style="color:#f59e0b;text-decoration:none">Manage email preferences</a></p>
    </div>
  </div>
</body>
</html>`.trim();

  return sendEmail({
    to,
    subject,
    html,
    text: `${heading}\n\n${body}${ctaUrl ? `\n\n${ctaLabel}: ${ctaUrl.startsWith('http') ? ctaUrl : appUrl + ctaUrl}` : ''}`,
    tags: ['notification'],
  });
}

/**
 * Send a welcome email to a newly registered user.
 */
export async function sendWelcomeEmail(to: EmailRecipient): Promise<MailerSendResult> {
  return sendNotificationEmail({
    to,
    subject: 'Welcome to Screenplay Studio! 🎬',
    heading: 'Welcome aboard!',
    body: `Hey ${to.name || 'there'},<br><br>Thanks for joining Screenplay Studio! You can now create projects, write scripts, collaborate with your team, and showcase your work to the community.<br><br>Let&rsquo;s start bringing your story to life.`,
    ctaLabel: 'Go to Dashboard',
    ctaUrl: '/dashboard',
  });
}

/**
 * Send a ticket reply notification email.
 */
export async function sendTicketReplyEmail(
  to: EmailRecipient,
  ticketSubject: string,
  ticketId: string,
): Promise<MailerSendResult> {
  return sendNotificationEmail({
    to,
    subject: `Re: ${ticketSubject} — Screenplay Studio Support`,
    heading: 'New reply on your support ticket',
    body: `Our team has responded to your support ticket: <strong>${ticketSubject}</strong>. Click below to view the reply and continue the conversation.`,
    ctaLabel: 'View Ticket',
    ctaUrl: `/support?ticket=${ticketId}`,
  });
}

/**
 * Send a project invitation email.
 */
export async function sendProjectInviteEmail(
  to: EmailRecipient,
  projectName: string,
  inviterName: string,
  projectId: string,
): Promise<MailerSendResult> {
  return sendNotificationEmail({
    to,
    subject: `${inviterName} invited you to "${projectName}" — Screenplay Studio`,
    heading: 'You\'ve been invited!',
    body: `<strong>${inviterName}</strong> has invited you to join the project <strong>${projectName}</strong>. Open the project to start collaborating.`,
    ctaLabel: 'Open Project',
    ctaUrl: `/projects/${projectId}`,
  });
}
