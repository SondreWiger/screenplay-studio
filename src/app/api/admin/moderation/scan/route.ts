import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════
// Content Moderation API — Admin-only
// Scans platform content for CSAM / child exploitation terms.
// Uses service role to bypass RLS for full content access.
// ═══════════════════════════════════════════════════════════════

const ADMIN_UID = 'f0e0c4a4-0833-4c64-b012-15829c087c77';

// Terms that indicate CSAM or child exploitation content.
// These are deliberately broad to catch variations.
// Screenwriting context: legitimate scripts about child characters
// are NOT flagged — only sexually explicit/exploitative terms.
const CSAM_TERMS = [
  // Direct references
  'child porn', 'child pornography', 'csam',
  'cp link', 'cp video', 'cp image',
  'underage sex', 'underage porn', 'underage nude',
  'minor sex', 'minor nude', 'minor porn',
  'kid sex', 'kid porn', 'kid nude',
  // Exploitation
  'child exploitation', 'child abuse material',
  'child sex', 'child nude', 'child naked',
  'sexual abuse of child', 'sexual abuse of minor',
  'molest child', 'molest kid', 'molest minor',
  'pedoph', 'paedoph',  // catches pedophile, pedophilia, etc.
  'hebephil', 'ephebophil',
  // Coded terms commonly used
  'loli explicit', 'shota explicit',
  'lolicon', 'shotacon',
  'pizza cheese', // known coded reference
  'young sex', 'young nude', 'young naked',
  'preteen sex', 'preteen nude', 'preteen naked',
  'teen sex tape', 'teen porn',
  // Grooming language
  'groom child', 'grooming minor', 'grooming kid',
  'send nudes kid', 'send nudes child',
  'age play sexual', 'ageplay sex',
  // Trafficking
  'child trafficking', 'sell child', 'buy child',
  'child for sale', 'kid for sale',
];

interface ScanResult {
  content_type: string;
  content_id: string;
  project_id: string | null;
  flagged_user_id: string;
  matched_terms: string[];
  snippet: string;
  full_content: string;
}

function scanText(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matches: string[] = [];
  for (const term of CSAM_TERMS) {
    if (lower.includes(term)) {
      matches.push(term);
    }
  }
  return matches;
}

function truncate(text: string, maxLen: number = 500): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const supabase = createAdminSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  // Check if platform admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (user.id === ADMIN_UID || profile?.role === 'admin') {
    return user.id;
  }
  return null;
}

// ─── POST /api/admin/moderation/scan ──────────────────────────
// Trigger: Admin clicks "Scan Platform" button
// Scans all content tables for CSAM terms, flags matches,
// and preserves evidence.
export async function POST(req: NextRequest) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const flags: ScanResult[] = [];

  // ── 1. Scan script elements ────────────────────────────────
  const { data: elements } = await supabase
    .from('script_elements')
    .select('id, content, script_id, created_by')
    .not('content', 'is', null)
    .limit(10000);

  if (elements) {
    // Get project_ids via scripts
    const scriptIds = Array.from(new Set(elements.map(e => e.script_id)));
    const { data: scripts } = await supabase
      .from('scripts')
      .select('id, project_id')
      .in('id', scriptIds);
    const scriptProjectMap = new Map(scripts?.map(s => [s.id, s.project_id]) || []);

    for (const el of elements) {
      const matches = scanText(el.content || '');
      if (matches.length > 0) {
        flags.push({
          content_type: 'script_element',
          content_id: el.id,
          project_id: scriptProjectMap.get(el.script_id) || null,
          flagged_user_id: el.created_by,
          matched_terms: matches,
          snippet: truncate(el.content),
          full_content: el.content,
        });
      }
    }
  }

  // ── 2. Scan ideas ──────────────────────────────────────────
  const { data: ideas } = await supabase
    .from('ideas')
    .select('id, title, description, project_id, created_by')
    .limit(10000);

  if (ideas) {
    for (const idea of ideas) {
      const text = `${idea.title || ''} ${idea.description || ''}`;
      const matches = scanText(text);
      if (matches.length > 0) {
        flags.push({
          content_type: 'idea',
          content_id: idea.id,
          project_id: idea.project_id,
          flagged_user_id: idea.created_by,
          matched_terms: matches,
          snippet: truncate(text),
          full_content: text,
        });
      }
    }
  }

  // ── 3. Scan documents ──────────────────────────────────────
  const { data: docs } = await supabase
    .from('project_documents')
    .select('id, title, content, project_id, created_by')
    .limit(10000);

  if (docs) {
    for (const doc of docs) {
      const text = `${doc.title || ''} ${doc.content || ''}`;
      const matches = scanText(text);
      if (matches.length > 0) {
        flags.push({
          content_type: 'document',
          content_id: doc.id,
          project_id: doc.project_id,
          flagged_user_id: doc.created_by,
          matched_terms: matches,
          snippet: truncate(text),
          full_content: text,
        });
      }
    }
  }

  // ── 4. Scan scenes ─────────────────────────────────────────
  const { data: scenes } = await supabase
    .from('scenes')
    .select('id, scene_heading, synopsis, project_id')
    .limit(10000);

  if (scenes) {
    for (const scene of scenes) {
      const text = `${scene.scene_heading || ''} ${scene.synopsis || ''}`;
      const matches = scanText(text);
      if (matches.length > 0) {
        // Get project owner
        const { data: project } = await supabase
          .from('projects')
          .select('created_by')
          .eq('id', scene.project_id)
          .single();
        if (project) {
          flags.push({
            content_type: 'scene',
            content_id: scene.id,
            project_id: scene.project_id,
            flagged_user_id: project.created_by,
            matched_terms: matches,
            snippet: truncate(text),
            full_content: text,
          });
        }
      }
    }
  }

  // ── 5. Scan characters ─────────────────────────────────────
  const { data: characters } = await supabase
    .from('characters')
    .select('id, name, description, backstory, project_id')
    .limit(10000);

  if (characters) {
    for (const char of characters) {
      const text = `${char.name || ''} ${char.description || ''} ${char.backstory || ''}`;
      const matches = scanText(text);
      if (matches.length > 0) {
        const { data: project } = await supabase
          .from('projects')
          .select('created_by')
          .eq('id', char.project_id)
          .single();
        if (project) {
          flags.push({
            content_type: 'character',
            content_id: char.id,
            project_id: char.project_id,
            flagged_user_id: project.created_by,
            matched_terms: matches,
            snippet: truncate(text),
            full_content: text,
          });
        }
      }
    }
  }

  // ── 6. Scan channel messages (project chat) ────────────────
  const { data: channelMsgs } = await supabase
    .from('channel_messages')
    .select('id, content, sender_id, channel_id')
    .eq('is_deleted', false)
    .limit(10000);

  if (channelMsgs) {
    const channelIds = Array.from(new Set(channelMsgs.map(m => m.channel_id)));
    const { data: channels } = await supabase
      .from('project_channels')
      .select('id, project_id')
      .in('id', channelIds);
    const channelProjectMap = new Map(channels?.map(c => [c.id, c.project_id]) || []);

    for (const msg of channelMsgs) {
      const matches = scanText(msg.content || '');
      if (matches.length > 0) {
        flags.push({
          content_type: 'channel_message',
          content_id: msg.id,
          project_id: channelProjectMap.get(msg.channel_id) || null,
          flagged_user_id: msg.sender_id,
          matched_terms: matches,
          snippet: truncate(msg.content),
          full_content: msg.content,
        });
      }
    }
  }

  // ── 7. Scan direct messages (DMs) ──────────────────────────
  const { data: dms } = await supabase
    .from('direct_messages')
    .select('id, content, sender_id, conversation_id')
    .eq('is_deleted', false)
    .limit(10000);

  if (dms) {
    for (const dm of dms) {
      const matches = scanText(dm.content || '');
      if (matches.length > 0) {
        flags.push({
          content_type: 'direct_message',
          content_id: dm.id,
          project_id: null,
          flagged_user_id: dm.sender_id,
          matched_terms: matches,
          snippet: truncate(dm.content),
          full_content: dm.content,
        });
      }
    }
  }

  // ── Store all flags ────────────────────────────────────────
  let newFlagsCount = 0;
  for (const flag of flags) {
    // Check if this content_id is already flagged (avoid duplicates)
    const { data: existing } = await supabase
      .from('content_flags')
      .select('id')
      .eq('content_id', flag.content_id)
      .eq('content_type', flag.content_type)
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Determine flag_reason
    const isCSAM = flag.matched_terms.some(t =>
      CSAM_TERMS.slice(0, 35).includes(t) // First 35 terms are CSAM-specific
    );

    const { data: insertedFlag } = await supabase
      .from('content_flags')
      .insert({
        content_type: flag.content_type,
        content_id: flag.content_id,
        project_id: flag.project_id,
        flagged_user_id: flag.flagged_user_id,
        flag_reason: isCSAM ? 'csam' : 'child_exploitation',
        matched_terms: flag.matched_terms,
        content_snippet: flag.snippet,
        severity: 'critical',
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertedFlag) {
      newFlagsCount++;

      // Auto-preserve evidence
      const { data: author } = await supabase
        .from('profiles')
        .select('email, full_name, display_name')
        .eq('id', flag.flagged_user_id)
        .single();

      await supabase.from('moderation_evidence').insert({
        flag_id: insertedFlag.id,
        content_type: flag.content_type,
        content_id: flag.content_id,
        full_content: flag.full_content,
        content_metadata: {
          project_id: flag.project_id,
          matched_terms: flag.matched_terms,
          scan_timestamp: new Date().toISOString(),
        },
        author_id: flag.flagged_user_id,
        author_email: author?.email || null,
        author_name: author?.full_name || author?.display_name || null,
        captured_by: adminId,
        content_hash: sha256(flag.full_content),
      });

      // Log to audit
      await supabase.from('audit_log').insert({
        user_id: adminId,
        action: 'content_scan_flag',
        entity_type: 'content_flag',
        entity_id: insertedFlag.id,
        metadata: {
          content_type: flag.content_type,
          flagged_user_id: flag.flagged_user_id,
          matched_terms: flag.matched_terms,
        },
      });
    }
  }

  return NextResponse.json({
    scanned: {
      script_elements: elements?.length || 0,
      ideas: ideas?.length || 0,
      documents: docs?.length || 0,
      scenes: scenes?.length || 0,
      characters: characters?.length || 0,
      channel_messages: channelMsgs?.length || 0,
      direct_messages: dms?.length || 0,
    },
    total_flagged: flags.length,
    new_flags: newFlagsCount,
    duplicate_skipped: flags.length - newFlagsCount,
  });
}

// ─── GET /api/admin/moderation/scan ───────────────────────────
// Retrieve current flags and stats
export async function GET(req: NextRequest) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: flags, count } = await supabase
    .from('content_flags')
    .select('*, flagged_user:profiles!flagged_user_id(email, full_name, display_name, avatar_url, username)', { count: 'exact' })
    .order('detected_at', { ascending: false })
    .limit(200);

  const { data: stats } = await supabase
    .from('content_flags')
    .select('status, severity');

  const statusCounts: Record<string, number> = {};
  const severityCounts: Record<string, number> = {};
  for (const s of stats || []) {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    severityCounts[s.severity] = (severityCounts[s.severity] || 0) + 1;
  }

  return NextResponse.json({
    flags: flags || [],
    total: count || 0,
    stats: { by_status: statusCounts, by_severity: severityCounts },
  });
}
