// Discord webhook utility for challenge announcements
// https://discord.com/api/webhooks/1516878478576980078/fy7BTgt9w-vusUqNi-mbSzBeKnBz2cnohQSzxoh6y7hbaSumuApbwc0KFilVk64Y8SqU

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

export async function announceChallenge(challenge: any, phase: 'upcoming' | 'submissions' | 'voting' | 'completed'): Promise<void> {
  const embed: DiscordEmbed = {
    title: `🎉 ${challenge.title}`, // The Last Day - Weekly Writing Challenge
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
          **Starts:** ${formatDate(challenge.starts_at)}
          **Closes:** ${formatDate(challenge.submissions_close_at)}
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
    content: phase === 'upcoming' ? `🚀 **New Weekly Challenge Dropped!** ${getThemeEmoji(challenge)}` :
            phase === 'submissions' ? `📝 **Submissions Now Open!** Time to write!` :
            phase === 'voting' ? `🗳️ **Voting Now Open!** Help decide the winner!` :
            `🏆 **Challenge Complete!** ${getThemeEmoji(challenge)}`,
    embeds: [embed],
    username: 'Screenplay Studio Bot',
    avatar_url: 'https://screenplay.studio/logo.png',
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
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getWinnerInfo(challenge: any): string {
  if (!challenge.submissions || challenge.submissions.length === 0) return 'No submissions';
  const winner = challenge.submissions[0];
  return winner.author?.full_name || 'Anonymous';
}

function getThemeEmoji(challenge: any): string {
  if (!challenge.theme) return '🎭';
  const theme = challenge.theme.toLowerCase();
  if (theme.includes('day') || theme.includes('time')) return '⏰';
  if (theme.includes('stranger') || theme.includes('person')) return '👤';
  if (theme.includes('wrong') || theme.includes('letter')) return '✉️';
  if (theme.includes('room') || theme.includes('silent')) return '🏠';
  if (theme.includes('train') || theme.includes('film')) return '🚂';
  if (theme.includes('night') || theme.includes('dark')) return '🌙';
  if (theme.includes('loop') || theme.includes('time')) return '🔄';
  if (theme.includes('heist') || theme.includes('money')) return '💰';
  if (theme.includes('contact') || theme.includes('first')) return '📞';
  if (theme.includes('party') || theme.includes('dinner')) return '🍽️';
  if (theme.includes('unreliable')) return '🤔';
  if (theme.includes('chase') || theme.includes('pursuit')) return '🏃';
  if (theme.includes('backwards')) return '⬅️';
  if (theme.includes('audition')) return '🎭';
  return '🎪';
}

export async function announceBlogPost(post: any): Promise<void> {
  const embed: DiscordEmbed = {
    title: `📝 ${post.title}`, // New Blog Post
    description: post.excerpt || post.content?.substring(0, 200) + '...' || 'No excerpt available',
    color: 0xFF5F1F, // Orange
    fields: [
      {
        name: '👤 Author',
        value: post.author?.full_name || 'Anonymous',
        inline: true
      },
      {
        name: '📅 Published',
        value: formatDate(post.published_at || post.created_at),
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
    content: `📝 **NEW BLOG POST!** 🎭 **${post.title}**\n\n${post.author?.full_name || 'Anonymous'} has shared a new article with the community! Dive in and read the latest insights from our writers and creators. ✨`,
    embeds: [embed],
    username: 'Screenplay Studio Bot',
    avatar_url: 'https://screenplay.studio/logo.png',
  });
}

export async function announceBlogPostWithSeries(post: any, seriesName: string): Promise<void> {
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
        value: post.author?.full_name || 'Anonymous',
        inline: true
      },
      {
        name: '📅 Published',
        value: formatDate(post.published_at || post.created_at),
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
    content: `📚 **NEW BLOG POST IN SERIES!** 🎭 **${post.title}**\n\nPart of the **${seriesName}** series! ${post.author?.full_name || 'Anonymous'} has added another chapter to this ongoing collection. Check it out! ✨`,
    embeds: [embed],
    username: 'Screenplay Studio Bot',
    avatar_url: 'https://screenplay.studio/logo.png',
  });
}