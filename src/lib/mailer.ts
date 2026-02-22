// ============================================================
// Zeptomail Email Service (via Nodemailer SMTP)
// Sends transactional emails via Zoho's Zeptomail.
// ============================================================

import nodemailer from 'nodemailer';

const ZEPTOMAIL_USER = process.env.ZEPTOMAIL_USER || 'emailapikey';
const ZEPTOMAIL_PASS = process.env.ZEPTOMAIL_PASS || '';
const DEFAULT_FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@screenplaystudio.fun';
const DEFAULT_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Screenplay Studio';

const transporter = nodemailer.createTransport({
  host: 'smtp.zeptomail.eu',
  port: 587,
  auth: {
    user: ZEPTOMAIL_USER,
    pass: ZEPTOMAIL_PASS,
  },
});

export interface EmailRecipient {
  email: string;
  name?: string;
}

interface SendEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  text?: string;
  html?: string;
  from?: EmailRecipient;
  replyTo?: EmailRecipient;
  tags?: string[];
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via Zeptomail SMTP (Nodemailer).
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  if (!ZEPTOMAIL_PASS) {
    console.warn('[mailer] ZEPTOMAIL_PASS not configured — skipping email');
    return { success: false, error: 'SMTP credentials not configured' };
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const from = options.from || { email: DEFAULT_FROM_EMAIL, name: DEFAULT_FROM_NAME };

  try {
    const info = await transporter.sendMail({
      from: `"${from.name || 'Screenplay Studio'}" <${from.email}>`,
      to: recipients.map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(', '),
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo
        ? `"${options.replyTo.name || ''}" <${options.replyTo.email}>`
        : undefined,
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] Send error:', err);
    return { success: false, error: String(err) };
  }
}

// ── Convenience helpers ─────────────────────────────────────

/**
 * Send a notification email with the Screenplay Studio branded template.
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
}): Promise<EmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://screenplaystudio.fun';
  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<div style="text-align:center;margin:28px 0"><a href="${ctaUrl.startsWith('http') ? ctaUrl : appUrl + ctaUrl}" style="display:inline-block;padding:12px 32px;background:#ef4444;color:#fff;font-weight:600;border-radius:8px;text-decoration:none;font-size:14px">${ctaLabel}</a></div>`
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
      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#a1a1aa">${body}</p>
      ${ctaHtml}
    </div>
    <div style="text-align:center;margin-top:24px">
      <p style="font-size:11px;color:#52525b">You received this because you have an account on Screenplay Studio.</p>
      <p style="font-size:11px;color:#52525b;margin-top:4px"><a href="${appUrl}/settings" style="color:#ef4444;text-decoration:none">Manage email preferences</a></p>
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
export async function sendWelcomeEmail(to: EmailRecipient): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    subject: 'Welcome to Screenplay Studio! 🎬',
    heading: 'Welcome aboard!',
    body: `Hey ${to.name || 'there'},<br><br>Thanks for joining Screenplay Studio! You can now create projects, write scripts, collaborate with your team, and showcase your work to the community.<br><br>Let\u2019s start bringing your story to life.`,
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
): Promise<EmailResult> {
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
): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    subject: `${inviterName} invited you to "${projectName}" — Screenplay Studio`,
    heading: "You've been invited!",
    body: `<strong>${inviterName}</strong> has invited you to join the project <strong>${projectName}</strong>. Open the project to start collaborating.`,
    ctaLabel: 'Open Project',
    ctaUrl: `/projects/${projectId}`,
  });
}
