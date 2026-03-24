/**
 * Shared content moderation scanner.
 * Checks text against CSAM / child-safety keyword list
 * and reports matches to the admin moderation API.
 */

const CSAM_TERMS = [
  'child porn', 'child pornography', 'csam',
  'cp link', 'cp video', 'cp image',
  'underage sex', 'underage porn', 'underage nude',
  'minor sex', 'minor nude', 'minor porn',
  'kid sex', 'kid porn', 'kid nude',
  'child exploitation', 'child abuse material',
  'child sex', 'child nude', 'child naked',
  'sexual abuse of child', 'sexual abuse of minor',
  'molest child', 'molest kid', 'molest minor',
  'pedoph', 'paedoph',
  'hebephil', 'ephebophil',
  'loli explicit', 'shota explicit',
  'lolicon', 'shotacon',
  'pizza cheese',
  'young sex', 'young nude', 'young naked',
  'preteen sex', 'preteen nude', 'preteen naked',
  'teen sex tape', 'teen porn',
  'groom child', 'grooming minor', 'grooming kid',
  'send nudes kid', 'send nudes child',
  'age play sexual', 'ageplay sex',
  'child trafficking', 'sell child', 'buy child',
  'child for sale', 'kid for sale',
];

export function scanContent(text: string): string[] {
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

/**
 * Scan text and if flagged, report to the moderation API (fire-and-forget).
 * Returns the list of matched terms (empty = clean).
 */
export async function automodCheck(opts: {
  text: string;
  contentType: string;
  contentId: string;
  projectId?: string | null;
  userId: string;
  getAccessToken: () => Promise<string | undefined>;
}): Promise<string[]> {
  const matches = scanContent(opts.text);
  if (matches.length === 0) return [];

  // Report to moderation API (fire-and-forget, don't block the user)
  try {
    const token = await opts.getAccessToken();
    if (token) {
      fetch('/api/admin/moderation/flag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          content_type: opts.contentType,
          content_id: opts.contentId,
          project_id: opts.projectId || null,
          flagged_user_id: opts.userId,
          matched_terms: matches,
          content_snippet: opts.text.substring(0, 500),
        }),
      }).catch(() => {
        // Silent fail — don't interfere with user's action
      });
    }
  } catch {
    // Silent fail
  }

  return matches;
}
