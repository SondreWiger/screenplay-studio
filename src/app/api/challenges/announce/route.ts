import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';
import { getChallengePhase, formatDateTime } from '@/lib/utils';
import { sendDiscordWebhook, announceBlogPost, announceBlogPostWithSeries } from '@/lib/discord';
import { getThemeEmoji, getPhaseEmoji } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();

    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get challenges that have changed in the last 24 hours
    // This includes:
    // 1. New challenges (created in last 24h)
    // 2. Challenges entering a new phase (phase changes)
    // 3. Challenges that just completed

    const { data: recentChallenges } = await supabase
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
        challenge_type,
        week_number,
        year,
        status,
        created_at,
        updated_at
      `)
      .or(`created_at.gt.${yesterday},updated_at.gt.${yesterday}`)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (!recentChallenges || recentChallenges.length === 0) {
      return NextResponse.json({ message: 'No challenges to announce' }, { status: 200 });
    }

    const results = [];

    for (const challenge of recentChallenges) {
      const phase = getChallengePhase(challenge);
      const embedTitle = getPhaseEmoji(phase) + ' ' + challenge.title;

      try {
        // Send Discord notification
        await sendDiscordWebhook({
          content: getPhaseNotification(phase, challenge.title, getThemeEmoji(challenge.theme_id)),
          embeds: [
            {
              title: embedTitle,
              description: challenge.description,
              color: getPhaseColor(phase),
              fields: [
                {
                  name: '📅 Phase',
                  value: getPhaseLabel(phase),
                  inline: true
                },
                {
                  name: '⏰ Timeline',
                  value: `
                    **Starts:** ${formatDateTime(challenge.starts_at)}
                    **Closes:** ${formatDateTime(challenge.submissions_close_at)}
                  `,                  inline: true
                },
                {
                  name: '👥 Submissions',
                  value: `${challenge.submission_count} submissions`,                  inline: true
                },
                {
                  name: '💰 Prize',
                  value: challenge.prize_title || 'TBD',
                  inline: false
                },
                {
                  name: '🔗 View Challenge',
                  value: `[View Challenge](https://screenplay.studio/community/challenges/${challenge.id}) 📝\n[View Submissions](https://screenplay.studio/community/challenges/${challenge.id}#submissions) 👁️`,                  inline: false
                }
              ],
              footer: { text: 'Screenplay Studio Weekly Challenge' },
              timestamp: new Date().toISOString(),
            }
          ],
          username: 'Screenplay Studio Bot',
          avatar_url: 'https://screenplay.studio/logo.png',
        });

        results.push({
          challengeId: challenge.id,
          phase,
          status: 'success',
        });
      } catch (error) {
        logger.error('[api]', `Failed to announce challenge ${challenge.id}:`, error);
        results.push({
          challengeId: challenge.id,
          phase,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Also fetch new blog posts from the last 24 hours
    const { data: recentPosts } = await supabase
      .from('blog_posts')
      .select(`
        id,
        title,
        excerpt,
        content,
        published_at,
        created_at,
        cover_image_url,
        slug,
        series_name,
        author:profiles!author_id(full_name,avatar_url)
      `)
      .or(`published_at.gt.${yesterday},created_at.gt.${yesterday}`)
      .order('published_at', { ascending: false })
      .limit(20);

    if (recentPosts && recentPosts.length > 0) {
      // Group posts by series if they have a series_name
      for (const post of recentPosts) {
        try {
          if (post.series_name) {
            await announceBlogPostWithSeries(post, post.series_name);
          } else {
            await announceBlogPost(post);
          }

          results.push({
            postId: post.id,
            title: post.title,
            status: 'success',
            type: 'blog_post',
          });
        } catch (error) {
          logger.error('[api]', `Failed to announce blog post ${post.id}:`, error);
          results.push({
            postId: post.id,
            title: post.title,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            type: 'blog_post',
          });
        }
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      processed: results.length,
      results,
    }, { status: 200 });

  } catch (error) {
    logger.error('[api]', 'Error in Discord challenge notification API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
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

function getPhaseNotification(phase: string, title: string, emoji: string): string {
  switch (phase) {
    case 'upcoming':
      return `🚀 **New Weekly Challenge Dropped!** ${emoji} ${title}\n\nThe hunt begins! Submit your script before the deadline. Ready, set, WRITE! ✨`;
    case 'submissions':
      return `📝 **Submissions Now Open!** ${emoji} ${title}\n\nCreate your masterpiece and submit it now! You have until the deadline to join the challenge.`;
    case 'voting':
      return `🗳️ **Voting Now Open!** ${emoji} ${title}\n\nRead the submissions and cast your vote for the best script! One vote per person.`;
    case 'completed':
      return `🏆 **Challenge Complete!** ${emoji} ${title}\n\nThe results are in! The winner has been crowned. Check the community feed for all the details.`;
    case 'reveal_pending':
      return `⏳ **Almost There!** ${emoji} ${title}\n\nVoting is closed. The results will be revealed shortly. Stay tuned!`;
    default:
      return `🎭 **Challenge Update!** ${emoji} ${title}`;
  }
}