import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Keyword lists ─────────────────────────────────────────────────────────────
const CRITICAL = [
  'child pornography', 'csam', 'loli explicit', 'shota explicit',
];
const HIGH = [
  'kill yourself', 'kys ', 'suicide method', 'bomb instructions',
  'how to make drugs', 'doxxing', 'credit card number',
];
const MEDIUM = [
  'nigger', 'faggot', 'cunt ', 'whore ', 'retard ', 'spastic',
  'i will find you', 'your family will', 'you deserve to die',
];
const LOW = [
  'buy now', 'click here', 'free bitcoin', 'cheap meds',
  'weight loss pills', 'earn money fast', 'work from home scam',
];

type Severity = 'low' | 'medium' | 'high' | 'critical';

function checkContent(text: string): { flagged: boolean; severity: Severity; reasons: string[] } {
  const lower = text.toLowerCase();
  const reasons: string[] = [];
  let severity: Severity = 'low';

  const check = (list: string[], s: Severity, prefix: string) => {
    for (const kw of list) {
      if (lower.includes(kw)) {
        reasons.push(`${prefix}: "${kw.trim()}"`);
        const rank: Record<Severity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
        if (rank[s] > rank[severity]) severity = s;
      }
    }
  };

  check(CRITICAL, 'critical', 'Prohibited content');
  check(HIGH,     'high',     'High-severity violation');
  check(MEDIUM,   'medium',   'Hate speech / harassment');
  check(LOW,      'low',      'Potential spam');

  // Repetition heuristic
  const words = lower.split(/\s+/);
  const freq = new Map<string, number>();
  for (const w of words) if (w.length > 3) freq.set(w, (freq.get(w) ?? 0) + 1);
  for (const [w, c] of Array.from(freq)) {
    if (c > 8) {
      reasons.push(`Repetitive: "${w}" ×${c}`);
      if (severity === 'low') severity = 'medium';
    }
  }

  // All-caps heuristic
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 20) {
    const upperRatio = letters.split('').filter(c => c === c.toUpperCase()).length / letters.length;
    if (upperRatio > 0.75) reasons.push('Excessive caps');
  }

  return { flagged: reasons.length > 0, severity, reasons };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      content: string;
      content_type: 'post' | 'comment' | 'script';
      content_id: string;
      community_id?: string;
      sensitivity?: 'low' | 'medium' | 'high';
    };
    const { content, content_type, content_id, community_id, sensitivity = 'medium' } = body;
    if (!content || !content_type || !content_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = checkContent(content);
    const thresholds: Record<string, number> = { low: 1, medium: 2, high: 3 };
    const rank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const shouldFlag = result.flagged && rank[result.severity] >= thresholds[sensitivity];

    if (shouldFlag) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const autoActioned = result.severity === 'critical' || result.severity === 'high';
      await supabase.from('automod_flags').insert({
        content_type, content_id,
        community_id: community_id ?? null,
        flagged_by: 'automod',
        reason: result.reasons.join('; '),
        severity: result.severity,
        auto_actioned: autoActioned,
      });
      if (autoActioned) {
        if (content_type === 'post') {
          await supabase.from('community_posts')
            .update({ status: 'archived', mod_status: 'rejected' })
            .eq('id', content_id);
        } else if (content_type === 'comment') {
          await supabase.from('community_comments')
            .update({ content: '[Removed by automod]' })
            .eq('id', content_id);
        }
      }
    }

    return NextResponse.json({
      flagged: shouldFlag,
      severity: result.severity,
      reasons: result.reasons,
      auto_actioned: shouldFlag && (result.severity === 'critical' || result.severity === 'high'),
    });
  } catch (err) {
    console.error('[automod]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
