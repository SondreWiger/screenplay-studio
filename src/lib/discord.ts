// Discord webhook utility for challenge announcements

import { getThemeEmoji } from '@/lib/constants';
import { formatDate as formatDateUtil } from '@/lib/utils';
import { APP_LOGO, DISCORD_BOT_NAME } from '@/lib/constants';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1516878478576980078/fy7BTgt9w-vusUqNi-mbSzBeKnBz2cnohQSzxoh6y7hbaSumuApbwc0KFilVk64Y8SqU';

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
  thumbnail?: { url: string };
  image?: { url: string };
  author?: { name: string; url?: string; icon_url?: string };
}

export interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
  thread_id?: string;
}

export async function sendDiscordWebhook(payload: DiscordWebhookPayload): Promise<Response> {
  const response = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
  }

  return response;
}

export async function announceChallenge(challenge: { title: string; description?: string; starts_at: string; submissions_close_at: string; submission_count: number; id: string; prize_title?: string; prize_description?: string; placement?: number; submissions?: Array<{ author?: { full_name?: string; avatar_url?: string } }>; theme?: string }, phase: 'upcoming' | 'submissions' | 'voting' | 'completed'): Promise<void> {
  const embed: DiscordEmbed = {
    title: `🎉 ${challenge.title}`,
    description: challenge.description,
    color: getPhaseColor(phase),
    fields: [
      {
        name: '📅 Phase',
        value: phase === 'upcoming' ? '🔥 Upcoming - Submissions Open' :
               phase === 'submissions' ? '⏰ Submissions Open' :
               phase === 'voting' ? '🗳️ Voting Open' :
               '🏆 Results Revealed',
        inline: true
      },
      {
        name: '⏰ Timeline',
        value: `
          **Starts:** ${formatDateUtil(challenge.starts_at)}
          **Closes:** ${formatDateUtil(challenge.submissions_close_at)}
          ${phase === 'completed' ? `**Winner:** ${getWinnerInfo(challenge)}` : ''}
        `,        inline: true
      },
      {
        name: '📝 Submissions',
        value: `${challenge.submission_count} ${phase === 'completed' ? 'total' : 'made'}`,        inline: true
      },
      {
        name: '🔗 How to Participate',
        value: `[View Challenge](https://screenplay.studio/community/challenges/${challenge.id}) 📝\n[Submit Script](https://screenplay.studio/community/challenges/${challenge.id}?tab=submit) ✍️`,        inline: false
      }
    ],
    footer: { text: 'Screenplay Studio Weekly Challenge' },
    timestamp: new Date().toISOString(),
  };

  if (challenge.prize_title) {
    embed.fields!.push({
      name: '💰 Prize',
      value: `${challenge.prize_title}${challenge.prize_description ? ` — ${challenge.prize_description}` : ''}`,      inline: false
    });
  }

  if (phase === 'completed' && challenge.placement && challenge.placement <= 3) {
    const winner = challenge.submissions?.[challenge.placement - 1];
    if (winner) {
      embed.image = {
        url: winner.author?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + winner.author?.full_name || 'anonymous'
      };
      embed.author = {
        name: winner.author?.full_name || 'Anonymous',
        icon_url: winner.author?.avatar_url
      };
    }
  }

  await sendDiscordWebhook({
    content: phase === 'upcoming' ? `🚀 **New Weekly Challenge Dropped!** ${getThemeEmoji(challenge.theme)}` :
            phase === 'submissions' ? `📝 **Submissions Now Open!** Time to write!` :
            phase === 'voting' ? `🗳️ **Voting Now Open!** Help decide the winner!` :
            `🏆 **Challenge Complete!** ${getThemeEmoji(challenge.theme)}`,
    embeds: [embed],
    username: DISCORD_BOT_NAME,
    avatar_url: APP_LOGO,
  });
}

function getPhaseColor(phase: string): number {
  switch (phase) {
    case 'upcoming':
      return 0xFF5F1F; // Orange - new drop
    case 'submissions':
      return 0x00FF00; // Green - submit
    case 'voting':
      return 0xFFD700; // Gold - vote
    case 'completed':
      return 0xFF00FF; // Purple - results
    default:
      return 0x808080;
  }
}

function formatDate(dateString: string): string {
  return formatDateUtil(dateString);
}

function getWinnerInfo(challenge: { submissions?: Array<{ author?: { full_name?: string } }> }): string {
  if (!challenge.submissions || challenge.submissions.length === 0) return 'No submissions';
  const winner = challenge.submissions[0];
  return winner.author?.full_name || 'Anonymous';
}

// Helper to extract author name from possibly-array author field
function getAuthorName(author?: { full_name?: string } | Array<{ full_name?: string }>): string {
  if (!author) return 'Anonymous';
  if (Array.isArray(author)) return author[0]?.full_name || 'Anonymous';
  return author.full_name || 'Anonymous';
}

export async function announceBlogPost(post: { title: string; excerpt?: string; content?: string; slug?: string; id: string; author?: { full_name?: string } | Array<{ full_name?: string; avatar_url?: string }>; published_at?: string; created_at?: string; tags?: string[]; cover_image_url?: string }): Promise<void> {
  const embed: DiscordEmbed = {
    title: `📝 ${post.title}`,
    description: post.excerpt || post.content?.substring(0, 200) + '...' || 'No excerpt available',
    color: 0xFF5F1F,
    fields: [
      {
        name: '👤 Author',
        value: getAuthorName(post.author),
        inline: true
      },
      {
        name: '📅 Published',
        value: formatDateUtil(post.published_at || post.created_at || new Date().toISOString()),
        inline: true
      },
      {
        name: '🏷️ Tags',
        value: post.tags?.join(', ') || 'No tags',
        inline: true
      },
      {
        name: '🔗 Read More',
        value: `[Read the full article](https://screenplay.studio/blog/${post.slug || post.id}) 📖\n[Share on social](https://screenplay.studio/blog/${post.slug || post.id}) 🔗`,        inline: false
      }
    ],
    footer: { text: 'Screenplay Studio Blog' },
    timestamp: new Date().toISOString(),
  };

  if (post.cover_image_url) {
    embed.thumbnail = { url: post.cover_image_url };
  }

  await sendDiscordWebhook({
    content: `📝 **NEW BLOG POST!** 🎭 **${post.title}**\n\n${getAuthorName(post.author)} has shared a new article with the community! Dive in and read the latest insights from our writers and creators. ✨`,
    embeds: [embed],
    username: DISCORD_BOT_NAME,
    avatar_url: APP_LOGO,
  });
}

export async function announceBlogPostWithSeries(post: { title: string; excerpt?: string; content?: string; slug?: string; id: string; author?: { full_name?: string } | Array<{ full_name?: string }>; published_at?: string; created_at?: string; tags?: string[]; cover_image_url?: string }, seriesName: string): Promise<void> {
  const embed: DiscordEmbed = {
    title: `📚 ${post.title}`, // New Blog Post in Series
    description: post.excerpt || post.content?.substring(0, 200) + '...' || 'No excerpt available',
    color: 0xFF5F1F, // Orange
    fields: [
      {
        name: '📚 Series',
        value: `Part of: **${seriesName}**\n📖 Current: ${post.title}`,
        inline: false
      },
      {
        name: '👤 Author',
        value: getAuthorName(post.author),
        inline: true
      },
      {
        name: '📅 Published',
        value: formatDateUtil(post.published_at || post.created_at || new Date().toISOString()),
        inline: true
      },
      {
        name: '🏷️ Tags',
        value: post.tags?.join(', ') || 'No tags',
        inline: true
      },
      {
        name: '🔗 Read More',
        value: `[Read the full article](https://screenplay.studio/blog/${post.slug || post.id}) 📖\n[Share on social](https://screenplay.studio/blog/${post.slug || post.id}) 🔗`,        inline: false
      }
    ],
    footer: { text: 'Screenplay Studio Blog' },
    timestamp: new Date().toISOString(),
  };

  if (post.cover_image_url) {
    embed.thumbnail = { url: post.cover_image_url };
  }

  await sendDiscordWebhook({
    content: `📚 **NEW BLOG POST IN SERIES!** 🎭 **${post.title}**\n\nPart of the **${seriesName}** series! ${getAuthorName(post.author)} has added another chapter to this ongoing collection. Check it out! ✨`,
    embeds: [embed],
    username: DISCORD_BOT_NAME,
    avatar_url: APP_LOGO,
  });
}