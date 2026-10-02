/**
 * Printed drafts: each print/export of a script gets a short code and a frozen
 * snapshot (see supabase/migrations/20261002120000_script_drafts.sql).
 */

import { createClient } from '@/lib/supabase/client';
import { flushSyncQueue } from '@/lib/offline/queue';
import type { SnapshotElement } from './diff';

export type DraftSource = 'manual' | 'export' | 'print';

export interface ScriptDraft {
  id: string;
  code: string;
  project_id: string;
  script_id: string | null;
  script_title: string;
  snapshot: SnapshotElement[];
  title_page: Record<string, unknown>;
  content_hash: string;
  element_count: number;
  word_count: number;
  recipient: string | null;
  notes: string | null;
  source: DraftSource;
  format: string | null;
  printed_at: string;
  created_by: string | null;
}

/** Codes avoid 0/O and 1/I so they survive being read off paper. */
export const DRAFT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Upper-cases and strips spaces/dashes; returns null if it can't be a code. */
export function normalizeDraftCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  return /^[A-Z0-9]{5}$/.test(code) ? code : null;
}

/**
 * Issue a draft code for the script as it is saved right now. Pending edits
 * are sent first, then the snapshot is taken on the server so it matches what
 * was printed.
 */
export async function createScriptDraft(
  scriptId: string,
  opts: { recipient?: string; notes?: string; source?: DraftSource; format?: string } = {},
): Promise<ScriptDraft> {
  await flushSyncQueue();
  const supabase = createClient();
  const { data, error } = await supabase.rpc('create_script_draft', {
    p_script_id: scriptId,
    p_recipient: opts.recipient || null,
    p_notes: opts.notes || null,
    p_source: opts.source || 'manual',
    p_format: opts.format || null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('No draft returned');
  return data as ScriptDraft;
}

/** Short date used in the printed stamp, e.g. "2 Oct 2026". */
export function draftStampDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The text printed at the foot of every page. */
export function draftStampText(draft: Pick<ScriptDraft, 'code' | 'printed_at'>): string {
  return `Draft ${draft.code} · ${draftStampDate(draft.printed_at)}`;
}

const STAMP_STYLE = "font-family:'Courier Prime','Courier New',Courier,monospace;font-size:7pt;letter-spacing:0.08em;color:#b4b4b4;";

/**
 * CSS for a `.draft-stamp` element placed inside each fixed-size page box:
 * small and light grey, tucked into the bottom margin.
 */
export function draftStampCSS(): string {
  return `.draft-stamp{position:absolute;bottom:0.45in;right:1in;${STAMP_STYLE}line-height:1;white-space:nowrap;pointer-events:none;}`;
}

/**
 * CSS for documents that flow across pages (no page boxes): the stamp goes in
 * the bottom-right page-margin box so it never overlaps the text.
 */
export function draftStampMarginCSS(stamp: string): string {
  const text = stamp.replace(/[\\"]/g, '');
  return `@page{@bottom-right{content:"${text}";${STAMP_STYLE}vertical-align:middle;}}`;
}
