import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';
import { getChallengePhase, formatDateTime } from '@/lib/utils';
import { sendDiscordWebhook, announceChallenge, announceBlogPost, announceBlogPostWithSeries, type DiscordEmbed } from '@/lib/discord';
import { getThemeEmoji, getPhaseEmoji } from '@/lib/constants';
import type { ChallengeSubmission } from '@/lib/types/gamification';

interface ChallengeQueryResult {
  id: string;
  title: string;
  description: string;
  theme_id: string | null;
  starts_at: string;
  submissions_close_at: string;
  voting_close_at: string;
  reveal_at: string;
  submission_count: number;
  prize_title: string | null;
  prize_description: string | null;
  status: string;
  challenge_type: string;
  week_number: number | null;
  year: number | null;
  created_at: string;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const now = new Date();

    // Check for challenges that need notifications based on their current phase
    const { data: allChallenges } = await supabase
      .from('community_challenges')
      .select(`
        id,
        title,
        description,
        theme_id,
        starts_at,
        submissions_close_at,
        voting_close_at,
        reveal_at,
        submission_count,
        prize_title,
        prize_description,
        status,
        challenge_type,
        week_number,
        year,
        created_at
      `)
      .in('status', ['upcoming', 'active', 'voting'])
      .order('starts_at', { ascending: true });

    if (!allChallenges || allChallenges.length === 0) {
      return NextResponse.json({ message: 'No active challenges to process' }, { status: 200 });
    }

    const processedChallenges = [];

    for (const challenge of allChallenges) {
      const phase = getChallengePhase(challenge);

      try {
        if (phase === 'upcoming' && new Date(challenge.starts_at) <= now) {
          // Challenge is starting NOW
          await announceChallenge(challenge, 'upcoming');
          processedChallenges.push({
            challengeId: challenge.id,
            action: 'announced_start',
            phase,
            success: true,
          });
        }
        else if (phase === 'submissions' && new Date(challenge.submissions_close_at) <= now) {
          // Challenge entering VOTING phase
          await announcePhaseChange(challenge, 'submissions', 'voting');
          processedChallenges.push({
            challengeId: challenge.id,
            action: 'announced_submissions_close',
            phase,
            success: true,
          });
        }
        else if (phase === 'voting' && new Date(challenge.voting_close_at) <= now) {
          // Challenge entering REVEAL PENDING phase
          await announcePhaseChange(challenge, 'voting', 'reveal_pending');
          processedChallenges.push({
            challengeId: challenge.id,
            action: 'announced_voting_close',
            phase,
            success: true,
          });
        }
        else if (phase === 'reveal_pending' && new Date(challenge.reveal_at) <= now) {
          // Challenge entering COMPLETED phase
          await announcePhaseChange(challenge, 'reveal_pending', 'completed');
          processedChallenges.push({
            challengeId: challenge.id,
            action: 'announced_reveal',
            phase,
            success: true,
          });
        }
        else if (phase === 'completed') {
          // Just completed, announce winner
          await announceWinner(challenge);
          processedChallenges.push({
            challengeId: challenge.id,
            action: 'announced_winner',
            phase,
            success: true,
          });
        }
      } catch (error) {
        console.error(`Failed to process challenge ${challenge.id}:`, error);
        processedChallenges.push({
          challengeId: challenge.id,
          action: 'error',
          phase,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Check for new blog posts from the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { data: newPosts } = await supabase
      .from('blog_posts')
      .select(`
        id,
        title,
        series_name,
        published_at,
        author:profiles!author_id(full_name,avatar_url)
      `)
      .gt('published_at', yesterday.toISOString())
      .order('published_at', { ascending: false })
      .limit(10);

    if (newPosts && newPosts.length > 0) {
      for (const post of newPosts) {
        try {
          if (post.series_name) {
            await announceBlogPostWithSeries(post, post.series_name);
          } else {
            await announceBlogPost(post);
          }

          processedChallenges.push({
            postId: post.id,
            title: post.title,
            action: post.series_name ? 'announced_series_post' : 'announced_blog_post',
            success: true,
          });
        } catch (error) {
          console.error(`Failed to process blog post ${post.id}:`, error);
          processedChallenges.push({
            postId: post.id,
            title: post.title,
            action: 'error',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalProcessed: processedChallenges.length,
      successful: processedChallenges.filter(c => c.success).length,
      failed: processedChallenges.filter(c => !c.success).length,
      processed: processedChallenges,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in Discord challenge scheduler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function announceChallengeStart(challenge: ChallengeQueryResult): Promise<void> {
  const phaseEmoji = getPhaseEmoji('upcoming');
  const themeEmoji = getThemeEmoji(challenge.theme_id);

  await sendDiscordWebhook({
    content: `🔥 **NEW CHALLENGE DROPPED!** ${themeEmoji} **${challenge.title}**\n\n🎭 The theme is set! Get ready to write. The challenge just kicked off! 🎭\n\n🏃 Hurry, submissions close soon! Time to create something special. ✨`,
    embeds: [
      {
        title: `🔥 ${challenge.title}`,
        description: getChallengeDescription(challenge),
        color: 0xFF5F1F,
        fields: [
          {
            name: '⏰ Starting Right Now!',
            value: `The challenge just launched! Get writing! 🎯\\n\\n*Current time:* ${formatDateTime(new Date().toISOString())}`,            inline: false
          },
          {
            name: '📝 How to Participate',
            value: `1️⃣ Write your script\n2️⃣ Submit via the challenge page\n3️⃣ Wait for voting!\n\n🚀 Ready? Let the words flow!`,            inline: false
          },
          {
            name: '💰 Prize',
            value: challenge.prize_title || 'TBD',
            inline: true
          },
          {
            name: '👥 Current Submissions',
            value: challenge.submission_count.toString(),
            inline: true
          }
        ],
        footer: { text: 'Screenplay Studio Weekly Challenge' },
        timestamp: new Date().toISOString(),
      }
    ],
    username: 'Screenplay Studio Bot',
    avatar_url: 'https://screenplay.studio/logo.png',
  });
}

async function announcePhaseChange(challenge: ChallengeQueryResult, fromPhase: string, toPhase: string): Promise<void> {
  const themeEmoji = getThemeEmoji(challenge.theme_id);

  await sendDiscordWebhook({
    content: `⏰ **PHASE CHANGE!** ${themeEmoji} **${challenge.title}**\n\n🚀 Moving from **${getPhaseLabel(fromPhase)}** to **${getPhaseLabel(toPhase)}**!\n\n📋 ${getPhaseChangeMessage(fromPhase, toPhase)}`,
    embeds: [
      {
        title: `⏰ ${challenge.title}`,
        description: getChallengeDescription(challenge),
        color: getPhaseColor(toPhase),
        fields: [
          {
            name: '🔄 Phase Transition',
            value: `**From:** ${getPhaseLabel(fromPhase)}\n**To:** ${getPhaseLabel(toPhase)}\n\n${getPhaseChangeDetails(fromPhase, toPhase)}`,            inline: false
          },
          {
            name: '📝 Actions',
            value: getPhaseActions(toPhase),
            inline: false
          },
          {
            name: '👥 Current Status',
            value: `Submissions: ${challenge.submission_count}`,            inline: true
          },
          {
            name: '⏱️ Deadline',
            value: getNextDeadline(challenge, toPhase),
            inline: true
          }
        ],
        footer: { text: 'Screenplay Studio Weekly Challenge' },
        timestamp: new Date().toISOString(),
      }
    ],
    username: 'Screenplay Studio Bot',
    avatar_url: 'https://screenplay.studio/logo.png',
  });
}

async function announceWinner(challenge: ChallengeQueryResult): Promise<void> {
  const themeEmoji = getThemeEmoji(challenge.theme_id);
  const supabase = createClient();

  const { data: submissions } = await supabase
    .from('challenge_submissions')
    .select(`
      id,
      title,
      description,
      vote_count,
      placement,
      author:profiles!author_id(full_name,avatar_url)
    `)
    .eq('challenge_id', challenge.id)
    .order('placement', { ascending: true }) as { data: (ChallengeSubmission & { author: { full_name: string | null; avatar_url: string | null } })[] | null };

  if (!submissions || submissions.length === 0) {
    await sendDiscordWebhook({
      content: `🏆 **Challenge Complete!** ${themeEmoji} **${challenge.title}**\n\n⏳ The results are in, but no one submitted their scripts. Sad! 😢\n\nNext challenge coming soon! 🔥`,
      embeds: [
        {
          title: `🏆 ${challenge.title}`,
          description: 'No submissions were entered for this challenge.',
          color: 0x808080,
          fields: [
            {
              name: '📝 Challenge Stats',
              value: `Submissions: ${challenge.submission_count}\nTheme: ${challenge.theme_id || 'Unknown'}`,              inline: false
            }
          ],
          footer: { text: 'Screenplay Studio Weekly Challenge' },
          timestamp: new Date().toISOString(),
        }
      ],
      username: 'Screenplay Studio Bot',
      avatar_url: 'https://screenplay.studio/logo.png',
    });
    return;
  }

  const winner = submissions[0];
  const runnerUp = submissions[1] || null;

  const embed: DiscordEmbed = {
    title: `🏆 ${challenge.title}`,
    description: `**Congratulations to the winner!** 🎉\\n\\n${winner.author?.full_name || 'Anonymous'} has been crowned champion of this week's challenge! 🎭`,
    color: 0xFFD700,
    fields: [
      {
        name: '🥇 1st Place Winner',
        value: `
          **${winner.title}**
          ${winner.description || 'No description'}
          ${winner.author?.full_name ? `\\nBy: ${winner.author.full_name}` : '\\nBy: Anonymous'}
          ${winner.vote_count > 0 ? `\nVotes: ${winner.vote_count}` : ''}
        `,        inline: false
      },
      {
        name: '📊 Complete Rankings',
        value: submissions.map((sub: ChallengeSubmission & { author: { full_name: string | null } }, idx: number) => (
          `${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`} ${sub.title}`
        )).join('\\n'),
        inline: false
      },
      {
        name: '💰 Prize',
        value: challenge.prize_title || 'TBD',
        inline: true
      },
      {
        name: '👥 Total Submissions',
        value: challenge.submission_count.toString(),
        inline: true
      }
    ],
    footer: { text: 'Screenplay Studio Weekly Challenge' },
    timestamp: new Date().toISOString(),
  };

  if (winner.author?.avatar_url) {
    embed.thumbnail = { url: winner.author.avatar_url };
  }

  if (runnerUp) {
    embed.fields!.push({
      name: '🥈 2nd Place',
      value: `
        **${runnerUp.title}**
        ${runnerUp.author?.full_name ? `By: ${runnerUp.author.full_name}` : 'Anonymous'}
        ${runnerUp.vote_count > 0 ? `Votes: ${runnerUp.vote_count}` : ''}
      `,      inline: false
    });
  }

  await sendDiscordWebhook({
    content: `🏆 **WINNER ANNOUNCED!** ${themeEmoji} **${challenge.title}**\\n\\n${winner.author?.full_name || 'Anonymous'} has won this week's challenge! 🎭\\n\\nCheck the community page for all the details and the full gallery of submissions!`,
    embeds: [embed],
    username: 'Screenplay Studio Bot',
    avatar_url: 'https://screenplay.studio/logo.png',
  });
}

function getChallengeDescription(challenge: ChallengeQueryResult): string {
  let description = challenge.description || '';
  if (challenge.theme_id && !description.includes(challenge.theme_id)) {
    if (description) description += '\n\n';
    description += `**Theme:** ${challenge.theme_id}`;
  }
  return description || 'A weekly writing challenge with a random theme.';
}

function getPhaseLabel(phase: string): string {
  switch (phase) {
    case 'upcoming': return '🔥 Upcoming - Submissions Open';
    case 'submissions': return '⏰ Submissions Open';
    case 'voting': return '🗳️ Voting Open';
    case 'completed': return '🏆 Results Revealed';
    case 'reveal_pending': return '⏳ Results Coming Soon';
    default: return phase;
  }
}

function getPhaseColor(phase: string): number {
  switch (phase) {
    case 'upcoming': return 0xFF5F1F;
    case 'submissions': return 0x00FF00;
    case 'voting': return 0xFFD700;
    case 'completed': return 0xFF00FF;
    case 'reveal_pending': return 0xFF8C00;
    default: return 0x808080;
  }
}

function getPhaseChangeMessage(fromPhase: string, toPhase: string): string {
  switch (fromPhase) {
    case 'upcoming':
      return `Great news! Submissions are now open! Get writing and share your take on the theme! 🎯`;
    case 'submissions':
      return `The submission window has closed! Now it's time to vote for your favorite scripts! 🗳️`;
    case 'voting':
      return `Voting is now closed! The results are being tallied, and we'll reveal the winners soon! 🏆`;
    case 'reveal_pending':
      return `Winners are being announced! Check the community page to see who took home the prize! 🎭`;
    default:
      return `Phase changed from ${fromPhase} to ${toPhase}!`;
  }
}

function getPhaseChangeDetails(fromPhase: string, toPhase: string): string {
  switch (fromPhase) {
    case 'upcoming':
      return `The challenge has launched! You now have time to create your script for the theme. Good luck!`;
    case 'submissions':
      return `Submission deadline has passed. Community members can now vote for their favorite scripts. One vote per person.`;
    case 'voting':
      return `Voting deadline has passed. The system is now counting votes and will reveal the winners shortly.`;
    case 'reveal_pending':
      return `Results have been revealed! Winners are announced and rankings are finalized. Community feedback appreciated!`;
    default:
      return `Phase has changed from ${fromPhase} to ${toPhase}.`;
  }
}

function getPhaseActions(phase: string): string {
  switch (phase) {
    case 'submissions':
      return `✍️ Write your script\n📝 Submit to the challenge\n👀 Review other submissions`;
    case 'voting':
      return `🗳️ Vote for your favorite\n👀 Read all submissions\n💭 Share your thoughts`;
    case 'reveal_pending':
      return `🏆 Check results\n🎭 See winning scripts\n📚 Learn from others`;
    case 'completed':
      return `🏆 View the winner\n📝 Read all submissions\n🎭 Enjoy the community!`;
    default:
      return 'Take appropriate action for this phase.';
  }
}

function getNextDeadline(challenge: ChallengeQueryResult, phase: string): string {
  switch (phase) {
    case 'submissions':
      return `Closes: ${formatDateTime(challenge.submissions_close_at)}`;
    case 'voting':
      return `Closes: ${formatDateTime(challenge.voting_close_at)}`;
    case 'reveal_pending':
      return `Reveals: ${formatDateTime(challenge.reveal_at)}`;
    default:
      return 'N/A';
  }
}