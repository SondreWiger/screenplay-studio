/**
 * Line diff for script snapshots — shared by Revisions and Printed Drafts.
 */

export type DiffLine = { type: 'same' | 'added' | 'removed'; text: string };

/** The fields of a script element a snapshot keeps. */
export type SnapshotElement = {
  id: string;
  element_type: string;
  content: string;
  sort_order: number;
  scene_number: string | null;
  revision_color: string;
  is_revised: boolean;
  is_omitted: boolean;
  metadata: Record<string, string | number | boolean | null>;
};

/** LCS-based line diff. Falls back to set-based diff for very large scripts. */
export function diffLines(aLines: string[], bLines: string[]): DiffLine[] {
  const m = aLines.length;
  const n = bLines.length;
  if (m * n > 500_000) return diffSimple(aLines, bLines);

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aLines[i - 1] === bLines[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const stack: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      stack.push({ type: 'same', text: aLines[i - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'added', text: bLines[j - 1] }); j--;
    } else {
      stack.push({ type: 'removed', text: aLines[i - 1] }); i--;
    }
  }
  stack.reverse();
  return stack;
}

function diffSimple(aLines: string[], bLines: string[]): DiffLine[] {
  const bSet = new Set(bLines);
  const aSet = new Set(aLines);
  const result: DiffLine[] = [];
  for (const line of aLines) result.push({ type: bSet.has(line) ? 'same' : 'removed', text: line });
  for (const line of bLines) { if (!aSet.has(line)) result.push({ type: 'added', text: line }); }
  return result;
}

/** Convert snapshot elements into labelled text lines for diffing. */
export function snapshotToLines(elements: Pick<SnapshotElement, 'element_type' | 'content' | 'sort_order' | 'is_omitted'>[]): string[] {
  return [...elements]
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter(el => !el.is_omitted)
    .map(el => {
      const prefix = el.element_type ? `[${el.element_type.toUpperCase().replace(/_/g, ' ')}] ` : '';
      return prefix + (el.content || '');
    });
}

/** Count added/removed lines in a diff. */
export function diffStats(diff: DiffLine[]): { added: number; removed: number } {
  let added = 0, removed = 0;
  for (const d of diff) {
    if (d.type === 'added') added++;
    else if (d.type === 'removed') removed++;
  }
  return { added, removed };
}
