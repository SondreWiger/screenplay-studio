import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ────────────────────────────────────────────────────────────
// Wire Feed Polling API — Real RSS/Atom feed ingestion
// POST /api/broadcast/wire-poll
// Body: { feed_id: string; project_id: string }
//
// This route:
// 1. Fetches the RSS/Atom feed URL from the database
// 2. Parses the XML (no external library — uses built-in DOMParser
//    equivalent via regex for server-side)
// 3. Deduplicates stories by external_id
// 4. Inserts new stories into broadcast_wire_stories
// 5. Updates feed metadata (last_polled_at, stories_ingested)
// ────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── XML Parsing (server-side, no DOM) ─────────────────────

interface FeedItem {
  external_id: string;
  headline: string;
  summary: string;
  body: string;
  source_name: string;
  category: string;
  priority: 'flash' | 'bulletin' | 'urgent' | 'routine' | 'deferred';
  published_at: string | null;
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA sections
  const cdataPattern = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdataPattern);
  if (cdataMatch) return cdataMatch[1].trim();

  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(pattern);
  return match ? match[1].trim() : '';
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const pattern = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const match = xml.match(pattern);
  return match ? match[1].trim() : '';
}

function parseRSS(xml: string, sourceName: string): FeedItem[] {
  const items: FeedItem[] = [];
  // Split by <item> tags
  const itemBlocks = xml.split(/<item[\s>]/i).slice(1);

  for (const block of itemBlocks) {
    const itemXml = block.split(/<\/item>/i)[0];
    if (!itemXml) continue;

    const title = extractTag(itemXml, 'title');
    const description = extractTag(itemXml, 'description');
    const content = extractTag(itemXml, 'content:encoded') || extractTag(itemXml, 'content');
    const link = extractTag(itemXml, 'link') || extractTag(itemXml, 'guid');
    const guid = extractTag(itemXml, 'guid') || link;
    const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date');
    const category = extractTag(itemXml, 'category');

    if (!title && !guid) continue;

    // Generate stable external_id from guid or link
    const external_id = guid || link || title.slice(0, 100);

    items.push({
      external_id,
      headline: decodeHTMLEntities(title),
      summary: decodeHTMLEntities(stripHTML(description)).slice(0, 1000),
      body: content ? decodeHTMLEntities(content) : decodeHTMLEntities(description),
      source_name: sourceName,
      category: decodeHTMLEntities(category),
      priority: detectPriority(title),
      published_at: pubDate ? new Date(pubDate).toISOString() : null,
    });
  }

  return items;
}

function parseAtom(xml: string, sourceName: string): FeedItem[] {
  const items: FeedItem[] = [];
  const entryBlocks = xml.split(/<entry[\s>]/i).slice(1);

  for (const block of entryBlocks) {
    const entryXml = block.split(/<\/entry>/i)[0];
    if (!entryXml) continue;

    const title = extractTag(entryXml, 'title');
    const summary = extractTag(entryXml, 'summary');
    const content = extractTag(entryXml, 'content');
    const id = extractTag(entryXml, 'id');
    const link = extractAttr(entryXml, 'link', 'href');
    const updated = extractTag(entryXml, 'updated') || extractTag(entryXml, 'published');
    const category = extractAttr(entryXml, 'category', 'term');

    if (!title && !id) continue;

    const external_id = id || link || title.slice(0, 100);

    items.push({
      external_id,
      headline: decodeHTMLEntities(title),
      summary: decodeHTMLEntities(stripHTML(summary || content || '')).slice(0, 1000),
      body: content || summary || '',
      source_name: sourceName,
      category: decodeHTMLEntities(category),
      priority: detectPriority(title),
      published_at: updated ? new Date(updated).toISOString() : null,
    });
  }

  return items;
}

function detectPriority(headline: string): FeedItem['priority'] {
  const upper = headline.toUpperCase();
  if (upper.includes('BREAKING') || upper.includes('FLASH')) return 'flash';
  if (upper.includes('BULLETIN') || upper.includes('ALERT')) return 'bulletin';
  if (upper.includes('URGENT') || upper.includes('DEVELOPING')) return 'urgent';
  return 'routine';
}

function stripHTML(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// ─── API Route ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { feed_id, project_id } = await request.json();

    if (!feed_id || !project_id) {
      return NextResponse.json({ error: 'feed_id and project_id required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // 1. Get feed config
    const { data: feed, error: feedError } = await supabase
      .from('broadcast_wire_feeds')
      .select('*')
      .eq('id', feed_id)
      .eq('project_id', project_id)
      .single();

    if (feedError || !feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    if (!feed.is_active) {
      return NextResponse.json({ error: 'Feed is inactive' }, { status: 400 });
    }

    // 2. Fetch the actual RSS/Atom feed
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    let feedResponse: Response;
    try {
      feedResponse = await fetch(feed.feed_url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ScreenplayStudio-NRCS/1.0 (Broadcast Wire Ingestion)',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
      });
    } catch (fetchErr: unknown) {
      const message = fetchErr instanceof Error ? fetchErr.message : 'Unknown error';
      // Update feed with error
      await supabase
        .from('broadcast_wire_feeds')
        .update({ last_polled_at: new Date().toISOString(), last_error: `Fetch failed: ${message}` })
        .eq('id', feed_id);
      return NextResponse.json({ error: `Failed to fetch feed: ${message}` }, { status: 502 });
    } finally {
      clearTimeout(timeout);
    }

    if (!feedResponse.ok) {
      await supabase
        .from('broadcast_wire_feeds')
        .update({ last_polled_at: new Date().toISOString(), last_error: `HTTP ${feedResponse.status}` })
        .eq('id', feed_id);
      return NextResponse.json({ error: `Feed returned HTTP ${feedResponse.status}` }, { status: 502 });
    }

    const xml = await feedResponse.text();

    // 3. Detect feed type and parse
    const isAtom = xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"');
    const feedSourceName = feed.name || 'Wire';

    let items: FeedItem[];
    if (feed.feed_type === 'atom' || isAtom) {
      items = parseAtom(xml, feedSourceName);
    } else {
      items = parseRSS(xml, feedSourceName);
    }

    if (items.length === 0) {
      await supabase
        .from('broadcast_wire_feeds')
        .update({ last_polled_at: new Date().toISOString(), last_error: null })
        .eq('id', feed_id);
      return NextResponse.json({ ingested: 0, total_items: 0 });
    }

    // 4. Get existing external_ids to deduplicate
    const externalIds = items.map(i => i.external_id);
    const { data: existing } = await supabase
      .from('broadcast_wire_stories')
      .select('external_id')
      .eq('feed_id', feed_id)
      .in('external_id', externalIds);

    const existingSet = new Set((existing || []).map(e => e.external_id));
    const newItems = items.filter(i => !existingSet.has(i.external_id));

    // 5. Insert new stories
    let insertedCount = 0;
    if (newItems.length > 0) {
      const rows = newItems.map(item => ({
        feed_id,
        project_id,
        external_id: item.external_id,
        headline: item.headline,
        summary: item.summary,
        body: item.body,
        source_name: item.source_name,
        category: item.category || feed.category || null,
        priority: item.priority,
        published_at: item.published_at,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('broadcast_wire_stories')
        .upsert(rows, { onConflict: 'feed_id,external_id', ignoreDuplicates: true })
        .select('id');

      if (insertError) {
        console.error('Wire insert error:', insertError);
        await supabase
          .from('broadcast_wire_feeds')
          .update({ last_polled_at: new Date().toISOString(), last_error: insertError.message })
          .eq('id', feed_id);
        return NextResponse.json({ error: 'Failed to insert stories', detail: insertError.message }, { status: 500 });
      }

      insertedCount = inserted?.length || 0;
    }

    // 6. Update feed metadata
    await supabase
      .from('broadcast_wire_feeds')
      .update({
        last_polled_at: new Date().toISOString(),
        last_error: null,
        stories_ingested: (feed.stories_ingested || 0) + insertedCount,
      })
      .eq('id', feed_id);

    return NextResponse.json({
      ingested: insertedCount,
      duplicates_skipped: items.length - newItems.length,
      total_items: items.length,
    });
  } catch (err: unknown) {
    console.error('Wire poll error:', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
