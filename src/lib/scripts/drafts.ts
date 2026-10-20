/**
 * Printed drafts: each print/export of a script gets a short code and a frozen
 * snapshot (see supabase/migrations/20261002120000_printed_drafts.sql).
 */

import QRCode from 'qrcode';
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
  /** Private key carried by the QR code, so a scan works without public lookup */
  qr_token?: string;
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
  const { data, error } = await supabase.rpc('create_printed_draft', {
    p_script_id: scriptId,
    p_recipient: opts.recipient || null,
    p_notes: opts.notes || null,
    p_source: opts.source || 'manual',
    p_format: opts.format || null,
  });
  if (error) throw new Error(error.message);
  // The function returns no row when you can't access the script.
  const row = (Array.isArray(data) ? data[0] : data) as ScriptDraft | undefined;
  if (!row) throw new Error('You don’t have access to this script.');
  return row;
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

/**
 * Where a draft's QR code points. The key lets whoever holds the paper see
 * the print info even when the project keeps code lookup private.
 */
export function draftLookupUrl(draft: Pick<ScriptDraft, 'code' | 'qr_token'>): string {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL
    || (typeof window !== 'undefined' && /^https?:/.test(window.location.origin) ? window.location.origin : '')
    || 'https://screenplaystudio.fun').replace(/\/$/, '');
  const key = draft.qr_token ? `&k=${encodeURIComponent(draft.qr_token)}` : '';
  return `${origin}/lookup?code=${draft.code}${key}`;
}

/**
 * The front-page QR block for a printed draft: an inline SVG code plus a tiny
 * caption. Returns '' if the code can't be drawn, so printing never fails on it.
 */
export async function draftQrHTML(draft: Pick<ScriptDraft, 'code' | 'qr_token'>): Promise<string> {
  try {
    const svg = await QRCode.toString(draftLookupUrl(draft), {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 0,
      color: { dark: '#000000', light: '#ffffff' },
    });
    return `<div class="draft-qr">${svg}<div class="draft-qr-caption">Scan for print info · ${draft.code}</div></div>`;
  } catch {
    return '';
  }
}

/**
 * CSS for a `.draft-qr` block placed inside a fixed-size page box: tucked
 * into the top-left page margin, clear of the text and the page number.
 */
export function draftQrCSS(): string {
  return `.draft-qr{position:absolute;top:0.3in;left:0.45in;width:0.7in;text-align:center;pointer-events:none;}
.draft-qr svg{display:block;width:0.7in;height:0.7in;}
.draft-qr-caption{margin-top:3pt;${STAMP_STYLE}font-size:5pt;letter-spacing:0.04em;line-height:1.15;color:#9a9a9a;}`;
}

/** CSS for a `.draft-qr` block in documents that flow (no page boxes). */
export function draftQrFlowCSS(): string {
  return `.draft-qr{width:0.8in;margin:0 auto;text-align:center;}
.draft-qr svg{display:block;width:0.8in;height:0.8in;}
.draft-qr-caption{margin-top:4pt;${STAMP_STYLE}font-size:5.5pt;letter-spacing:0.04em;line-height:1.15;color:#9a9a9a;}
.draft-qr.corner{float:right;margin:0 0 12pt 12pt;}`;
}
