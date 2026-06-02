'use server';

import {
  sendNotificationEmail,
  sendWelcomeEmail,
  sendProjectInviteEmail,
  sendTicketReplyEmail,
  sendBlogPostEmail,
  sendPollEmail,
  sendChallengeEmail,
  sendWeeklyDigestEmail,
  sendScriptFeedbackEmail,
  sendBadgeEarnedEmail,
  sendFeatureAnnouncementEmail,
  sendChangelogEmail,
  sendReengagementEmail,
  sendCorrectionEmail,
} from '@/lib/mailer';

export async function sendWelcomeEmailAction(
  email: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendWelcomeEmail({ email, name });
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendProjectInviteEmailAction(
  email: string,
  name: string,
  projectName: string,
  inviterName: string,
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendProjectInviteEmail({ email, name }, projectName, inviterName, projectId);
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendTicketReplyEmailAction(
  email: string,
  name: string,
  ticketSubject: string,
  ticketId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendTicketReplyEmail({ email, name }, ticketSubject, ticketId);
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendNotificationEmailAction(
  email: string,
  name: string | undefined,
  subject: string,
  heading: string,
  body: string,
  ctaLabel?: string,
  ctaUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendNotificationEmail({ to: { email, name }, subject, heading, body, ctaLabel, ctaUrl });
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendBlogPostEmailAction(
  email: string,
  name: string,
  postTitle: string,
  postSlug: string,
  excerpt: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendBlogPostEmail({ email, name }, postTitle, postSlug, excerpt);
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendPollEmailAction(
  email: string,
  name: string,
  pollQuestion: string,
  pollId: string,
  description?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendPollEmail({ email, name }, pollQuestion, pollId, description);
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendChallengeEmailAction(
  email: string,
  name: string,
  challengeTitle: string,
  challengeDescription: string,
  challengeId: string,
  deadline: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendChallengeEmail({ email, name }, challengeTitle, challengeDescription, challengeId, deadline);
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendWeeklyDigestEmailAction(
  email: string,
  name: string,
  wordsWritten: number,
  pagesWritten: number,
  scenesCreated: number,
  topProject: string,
  streak: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendWeeklyDigestEmail({ email, name }, { wordsWritten, pagesWritten, scenesCreated, topProject, streak });
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendScriptFeedbackEmailAction(
  email: string,
  name: string,
  reviewerName: string,
  scriptTitle: string,
  scriptId: string,
  commentCount: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendScriptFeedbackEmail({ email, name }, reviewerName, scriptTitle, scriptId, commentCount);
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendBadgeEarnedEmailAction(
  email: string,
  name: string,
  badgeName: string,
  badgeDescription: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendBadgeEarnedEmail({ email, name }, badgeName, badgeDescription);
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendFeatureAnnouncementEmailAction(
  email: string,
  name: string,
  featureName: string,
  featureDescription: string,
  featureUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendFeatureAnnouncementEmail({ email, name }, featureName, featureDescription, featureUrl);
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendChangelogEmailAction(
  email: string,
  name: string,
  version: string,
  changes: string[],
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendChangelogEmail({ email, name }, version, changes);
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendReengagementEmailAction(
  email: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendReengagementEmail({ email, name });
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendCorrectionEmailAction(
  email: string,
  name: string,
  originalSubject: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await sendCorrectionEmail({ email, name }, originalSubject);
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
