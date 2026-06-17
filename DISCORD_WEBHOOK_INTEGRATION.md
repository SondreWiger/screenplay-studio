# Discord Webhook Integration

This documentation explains how the Discord webhook integration works to announce weekly writing challenges in the community.

## Overview

The Discord webhook integration automatically announces new weekly writing challenges, phase changes, and winner announcements in a Discord server. This provides real-time updates to community members about challenge progress and new blog posts.

## Features

### Automatic Notifications

The integration provides the following automated notifications:

1. **Challenge Launch** - When a new weekly challenge starts (every Monday 00:00 UTC)
2. **Phase Changes** - When challenges move to new phases (submissions close, voting opens, voting closes, results revealed)
3. **Winner Announcements** - When challenge results are revealed and winners are announced
4. **Blog Posts** - When new blog posts are published (with or without series)

### Message Types

Each notification includes:

- **Rich embeds** with challenge details
- **Theme emojis** to make the messages visually engaging
- **Actionable buttons** with links to view challenges, submit scripts, or vote
- **Proper formatting** with timestamps and community branding

## Setup

### 1. Discord Webhook URL

To use this integration, you need a Discord webhook URL:

1. Go to your Discord server settings
2. Navigate to ** Integrations** → **Edit Webhook**
3. Copy the webhook URL
4. Add it to your `.env.local` file:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR-WEBHOOK-ID/YOUR-TOKEN
```

### 2. Environment Variables

Make sure the following environment variable is set:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1516878478576980078/fy7BTgt9w-vusUqNi-mbSzBeKnBz2cnohQSzxoh6y7hbaSumuApbwc0KFilVk64Y8SqU
```

### 3. API Routes

The integration exposes two API routes:

1. **`/api/challenges/announce`** - Manually trigger challenge notifications
2. **`/api/challenges/scheduler`** - Scheduled endpoint that checks for phase changes and sends notifications

### 4. Cron Job Setup

To run the scheduler automatically, set up a cron job (Vercel, GitHub Actions, or similar):

```bash
# Run every hour to check for phase changes and new blog posts
0 * * * * curl -X GET https://your-app.com/api/challenges/scheduler
```

## Message Templates

### Challenge Launch

```
🔥 **NEW CHALLENGE DROPPED!** 🎭 **Weekly Challenge: The Last Day**

The hunt begins! Submit your script before the deadline. Ready, set, WRITE! ✨

📝 **Actions:**
✍️ Write your script
📝 Submit to the challenge
👀 Review other submissions

💰 Prize: Weekly Winner
👥 Current Submissions: 12
```

### Phase Change: Submissions Close → Voting Opens

```
⏰ **PHASE CHANGE!** 🎭 **Weekly Challenge: The Last Day**

🚀 Moving from **⏰ Submissions Open** to **🗳️ Voting Open**!

📋 **Phase Transition:**
**From:** ⏰ Submissions Open
**To:** 🗳️ Voting Open

**Submissions close:** Friday 21:00 UTC
**Voting closes:** Saturday 23:59 UTC
**Results revealed:** Sunday 12:00 UTC

📝 **Actions:**
🗳️ Vote for your favorite
👀 Read all submissions
💭 Share your thoughts

👥 Current Status: 12 submissions
⏱️ Deadline: Saturday 23:59 UTC left
```

### Winner Announcement

```
🏆 **WINNER ANNOUNCED!** 🎭 **Weekly Challenge: The Last Day**

🥇 **1st Place Winner:** Anonymous
**Title:** The Last Day
**Votes:** 5

📊 **Complete Rankings:**
🥇 Anonymous - The Last Day (5 votes)
🥈 John Doe - Wrong Number (3 votes)
🥉 Jane Smith - The Room (2 votes)

💰 Prize: Weekly Winner
👥 Total Submissions: 12
```

## Development

### Testing the Integration

To test the Discord webhook integration locally:

```bash
# Start the development server
npm run dev

# Call the announce API manually (replace with your test challenge ID)
curl -X GET "http://localhost:3000/api/challenges/announce?challengeId=test-id"

# Run the scheduler to test phase change detection
curl -X GET "http://localhost:3000/api/challenges/scheduler"
```

### Environment Setup

For local development, you can use the `.env.local.example` file as a template:

```env
# Discord webhook URL for challenge announcements
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR-WEBHOOK-ID/YOUR-TOKEN
```

## Technical Details

### Message Format

All Discord messages are sent using the Discord webhook API with the following format:

- **Content:** Plain text message
- **Embeds:** Rich embeds with challenge details
- **Username:** "Screenplay Studio Bot"
- **Avatar:** Screenplay Studio logo
- **Color:** Theme-specific colors for each phase (orange for upcoming, green for submissions, gold for voting, purple for completed)

### Phase Detection

The integration detects phase changes based on the following schedule:

- **Upcoming → Submissions:** When `starts_at` <= current time
- **Submissions → Voting:** When `submissions_close_at` <= current time
- **Voting → Reveal Pending:** When `voting_close_at` <= current time
- **Reveal Pending → Completed:** When `reveal_at` <= current time
- **Completed → Winner Announcement:** When challenge status is 'completed'

### Theme Detection

The integration automatically assigns emoji themes based on challenge content:

### Blog Post Detection

The integration detects new blog posts published in the last 24 hours:

- **Regular Blog Post:** Any new blog post without a series
- **Series Blog Post:** New blog post belonging to a series (with `series_name`)

### Theme Detection for Blog Posts

The integration automatically assigns emoji themes based on blog post content:

## Blog Post Notifications

### Regular Blog Post

```
📝 **NEW BLOG POST!** 🎭 **Creating a Screenplay**

John Doe has shared a new article with the community! Dive in and read the latest insights from our writers and creators. ✨

👤 Author: John Doe
📅 Published: Jan 15, 2024 at 10:30 AM
🏷️ Tags: screenwriting, creating

🔗 Read More: [Read the full article](https://screenplay.studio/blog/creating-a-screenplay) 📖
[Share on social](https://screenplay.studio/blog/creating-a-screenplay) 🔗
```

### Blog Post in Series

```
📚 **NEW BLOG POST IN SERIES!** 🎭 **Character Development Deep Dive**

Part of the **Storytelling Mastery** series! Jane Smith has added another chapter to this ongoing collection. Check it out! ✨

📚 Series: Part of: **Storytelling Mastery**
📖 Current: Character Development Deep Dive
👤 Author: Jane Smith
📅 Published: Jan 15, 2024 at 10:30 AM
🏷️ Tags: character development, storytelling

🔗 Read More: [Read the full article](https://screenplay.studio/blog/character-development) 📖
[Share on social](https://screenplay.studio/blog/character-development) 🔗
```

## Support

For issues with the Discord webhook integration, please:

1. Check the Vercel dashboard logs for error details
2. Verify your Discord webhook URL is correct
3. Ensure the DISCORD_WEBHOOK_URL environment variable is set
4. Check the application logs in your deployment environment

## License

This integration is part of the Screenplay Studio project and is licensed under the MIT License.

## Blog Post Features

### Regular Blog Post Announcement

The integration automatically sends Discord notifications for any new blog post:

- **Rich embeds** with title, excerpt, author, and publication date
- **Cover image** display when available
- **Actionable buttons** with links to read the full article and share on social media
- **Tags display** to categorize the content
- **Emoji themes** based on content for visual engagement

### Blog Post in Series Announcement

When a blog post belongs to a series, the integration sends enhanced notifications:

- **Series context** to help readers follow the ongoing collection
- **Progress tracking** showing current post in the series
- **Consistent formatting** across all series posts
- **Enhanced engagement** with series-specific messaging

## Database Requirements

The blog post functionality requires the following database schema:

### blog_posts Table

```sql
id (UUID, primary key)
title (text)
content (text)
excerpt (text)
published_at (timestamptz)
created_at (timestamptz)
updated_at (timestamptz)
slug (text)
cover_image_url (text)
author_id (UUID, foreign key to profiles.id)
series_name (text, optional)
tags (text[], optional)
```

### profiles Table

The blog post announcement functionality requires the `profiles` table with these columns:

- `id` (UUID, primary key)
- `full_name` (text, optional)
- `avatar_url` (text, optional)

## Deployment Considerations

### Cron Job Frequency

For optimal performance and to avoid Discord rate limits:

- **Recommended:** Every 2-3 hours
- **Minimum:** Every hour
- **Maximum:** Every 30 minutes (if high traffic)

### Message Content Optimization

The integration includes several optimizations to ensure good message delivery:

1. **Rate Limiting:** Built-in delays between notifications
2. **Message Size:** Discord-compliant message sizing
3. **Fallback Content:** Graceful handling of missing data
4. **Error Recovery:** Automatic retry for failed deliveries

### Monitoring

Set up monitoring for:

1. **Webhook delivery failures:** Check Discord webhook status
2. **Database connectivity:** Verify Supabase connection
3. **Cron job success:** Monitor API response times
4. **Message content:** Ensure proper formatting and delivery

## Support

For issues with the Discord webhook integration, please:

1. Check the Vercel dashboard logs for error details
2. Verify your Discord webhook URL is correct
3. Ensure the DISCORD_WEBHOOK_URL environment variable is set
4. Check the application logs in your deployment environment

## License

This integration is part of the Screenplay Studio project and is licensed under the MIT License.


- "day" or "time" → ⏰
- "stranger" or "person" → 👤
- "wrong" or "letter" → ✉️
- "room" or "silent" → 🏠
- "train" or "film" → 🚂
- "night" or "dark" → 🌙
- "loop" or "time" → 🔄
- "heist" or "money" → 💰
- "contact" or "first" → 📞
- "party" or "dinner" → 🍽️
- "unreliable" → 🤔
- "chase" or "pursuit" → 🏃
- "backwards" → ⬅️
- "audition" → 🎭
- default → 🎪

## Deployment

### Vercel

For Vercel deployments, add the DISCORD_WEBHOOK_URL to your environment variables:

1. Go to Vercel Dashboard → Your Project → Environment Variables
2. Add `DISCORD_WEBHOOK_URL` with your webhook URL
3. Deploy

### Docker

Add the DISCORD_WEBHOOK_URL to your `.env` file when running Docker:

```dockerfile
ENV DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR-WEBHOOK-ID/YOUR-TOKEN
```

## Troubleshooting

### Webhook Not Sending Messages

1. **Verify the webhook URL:** Make sure the URL is correct and the webhook exists
2. **Check permissions:** Ensure the webhook has permissions to send messages in the target channel
3. **Environment variable:** Confirm DISCORD_WEBHOOK_URL is set in your environment

### Rate Limits

Discord has rate limits for webhooks. If you're experiencing rate limit issues:

1. **Reduce frequency:** Run the scheduler less frequently (e.g., every 2 hours)
2. **Batch notifications:** Group multiple notifications into single messages

### Database Connection Issues

If the scheduler fails to connect to the database:

1. **Check Supabase connection:** Verify your Supabase credentials are correct
2. **Database permissions:** Ensure the database user has permissions to read from the challenges table
3. **Environment variables:** Check that your Supabase environment variables are set correctly

## Support

For issues with the Discord webhook integration, please:

1. Check the Vercel dashboard logs for error details
2. Verify your Discord webhook URL is correct
3. Ensure the DISCORD_WEBHOOK_URL environment variable is set
4. Check the application logs in your deployment environment

## License

This integration is part of the Screenplay Studio project and is licensed under the MIT License.
