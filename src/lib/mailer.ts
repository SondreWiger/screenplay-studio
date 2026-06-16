import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DEFAULT_FROM_EMAIL = process.env.EMAIL_FROM || 'Screenplay Studio <onboarding@resend.dev>';
const DEFAULT_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Screenplay Studio';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

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

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  if (!resend) {
    console.warn('[mailer] RESEND_API_KEY not configured — skipping email');
    return { success: false, error: 'Resend API key not configured' };
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const from = options.from
    ? `${options.from.name || ''} <${options.from.email}>`.trim()
    : DEFAULT_FROM_EMAIL;

  try {
    const result = await resend.emails.send({
      from,
      to: recipients.map((r) => r.email),
      subject: options.subject,
      text: options.text,
      html: options.html,
      // @ts-expect-error — Resend SDK uses snake_case for this field
      reply_to: options.replyTo?.email,
      tags: options.tags?.map((t) => ({ name: t, value: t })),
    });

    if (result.error) {
      console.error('[mailer] Resend error:', result.error);
      return { success: false, error: result.error.message || String(result.error) };
    }

    return { success: true, messageId: result.data?.id };
  } catch (err: any) {
    console.error('[mailer] Send error:', err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

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
    text: `${heading}\n\n${body.replace(/<[^>]*>/g, '')}${ctaUrl ? `\n\n${ctaLabel}: ${ctaUrl.startsWith('http') ? ctaUrl : appUrl + ctaUrl}` : ''}`,
    replyTo: { email: 'sondre@screenplaystudio.fun', name: 'Sondre' },
    tags: ['notification'],
  });
}

export async function sendWelcomeEmail(to: EmailRecipient): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    subject: "You're in — Screenplay Studio",
    heading: 'Welcome!',
    body: `Hey ${to.name || 'there'},<br><br>Glad you signed up. You've got a blank dashboard waiting — go create a project and start writing.<br><br>Everything's free. No limits, no paywalls. Just write.<br><br>If you hit anything weird or have ideas, reply to this email. I read every one.<br><br>— Sondre`,
    ctaLabel: 'Start Writing',
    ctaUrl: '/dashboard',
  });
}

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

// Template functions

export async function sendBlogPostEmail(
  to: EmailRecipient,
  postTitle: string,
  postSlug: string,
  excerpt: string,
): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    subject: `New post: ${postTitle}`,
    heading: 'New on the blog',
    body: `<strong>${postTitle}</strong><br><br>${excerpt}<br><br>Read the full post below.`,
    ctaLabel: 'Read Post',
    ctaUrl: `/blog/${postSlug}`,
  });
}

export async function sendPollEmail(
  to: EmailRecipient,
  pollQuestion: string,
  pollId: string,
  description?: string,
): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    subject: `New poll: ${pollQuestion}`,
    heading: 'Vote now',
    body: `<strong>${pollQuestion}</strong>${description ? `<br><br>${description}` : ''}<br><br>Cast your vote — it takes 10 seconds.`,
    ctaLabel: 'Vote',
    ctaUrl: `/polls/${pollId}`,
  });
}

export async function sendChallengeEmail(
  to: EmailRecipient,
  challengeTitle: string,
  challengeDescription: string,
  challengeId: string,
  deadline: string,
): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    subject: `New challenge: ${challengeTitle}`,
    heading: 'Challenge time',
    body: `<strong>${challengeTitle}</strong><br><br>${challengeDescription}<br><br>Deadline: <strong>${deadline}</strong>. Show us what you've got.`,
    ctaLabel: 'Join Challenge',
    ctaUrl: `/community/challenges/${challengeId}`,
  });
}

export async function sendWeeklyDigestEmail(
  to: EmailRecipient,
  stats: {
    wordsWritten: number;
    pagesWritten: number;
    scenesCreated: number;
    topProject: string;
    streak: number;
  },
): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    subject: 'Your weekly writing digest',
    heading: 'This week in your scripts',
    body: `Here's how your writing week went:<br><br>` +
      `<strong>${stats.wordsWritten.toLocaleString()}</strong> words written<br>` +
      `<strong>${stats.pagesWritten}</strong> pages<br>` +
      `<strong>${stats.scenesCreated}</strong> scenes created<br>` +
      `<strong>${stats.topProject}</strong> was your most active project<br>` +
      (stats.streak > 0 ? `<br>You're on a <strong>${stats.streak}-day writing streak</strong>. Keep it going.` : `<br>Start a streak today — write something, anything.`),
    ctaLabel: 'Keep Writing',
    ctaUrl: '/dashboard',
  });
}

export async function sendScriptFeedbackEmail(
  to: EmailRecipient,
  reviewerName: string,
  scriptTitle: string,
  scriptId: string,
  commentCount: number,
): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    subject: `${reviewerName} left feedback on "${scriptTitle}"`,
    heading: 'New feedback',
    body: `<strong>${reviewerName}</strong> left <strong>${commentCount}</strong> comment${commentCount !== 1 ? 's' : ''} on your script <strong>${scriptTitle}</strong>.`,
    ctaLabel: 'View Feedback',
    ctaUrl: `/projects/${scriptId}/script`,
  });
}

export async function sendBadgeEarnedEmail(
  to: EmailRecipient,
  badgeName: string,
  badgeDescription: string,
): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    subject: `You earned a badge: ${badgeName}`,
    heading: 'Badge unlocked',
    body: `You just earned the <strong>${badgeName}</strong> badge.<br><br>${badgeDescription}<br><br>Check your profile to see it displayed.`,
    ctaLabel: 'View Profile',
    ctaUrl: '/settings',
  });
}

export async function sendFeatureAnnouncementEmail(
  to: EmailRecipient,
  featureName: string,
  featureDescription: string,
  featureUrl?: string,
): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    subject: `New feature: ${featureName}`,
    heading: 'Just shipped',
    body: `<strong>${featureName}</strong><br><br>${featureDescription}`,
    ctaLabel: featureUrl ? 'Check it out' : 'Open App',
    ctaUrl: featureUrl || '/dashboard',
  });
}

export async function sendChangelogEmail(
  to: EmailRecipient,
  version: string,
  changes: string[],
): Promise<EmailResult> {
  const changeList = changes.map((c) => `• ${c}`).join('<br>');
  return sendNotificationEmail({
    to,
    subject: `What's new — v${version}`,
    heading: `Screenplay Studio v${version}`,
    body: `Here's what changed:<br><br>${changeList}`,
    ctaLabel: 'View Changelog',
    ctaUrl: '/changelog',
  });
}

export async function sendReengagementEmail(
  to: EmailRecipient,
): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    subject: "We miss you — Screenplay Studio",
    heading: "Come back to your story",
    body: `Hey ${to.name || 'there'},<br><br>It's been a while since you last visited. Your projects are still here, waiting for you.<br><br>Whether you're mid-draft or just starting out, there's always room for one more scene.`,
    ctaLabel: 'Continue Writing',
    ctaUrl: '/dashboard',
  });
}

export async function sendCorrectionEmail(
  to: EmailRecipient,
  originalSubject: string,
): Promise<EmailResult> {
  return sendNotificationEmail({
    to,
    subject: `Quick correction — ${originalSubject}`,
    heading: 'Oops, wrong link',
    body: `Hey ${to.name || 'there'},<br><br>The last email had a broken link. Sorry about that — here's the correct one:<br><br><strong>${originalSubject}</strong>`,
    ctaLabel: 'Go to Screenplay Studio',
    ctaUrl: '/dashboard',
  });
}
