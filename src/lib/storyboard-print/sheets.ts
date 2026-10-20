/**
 * Printed sheet registry: each storyboard page printed from shots gets a row in
 * storyboard_print_sheets, whose numeric code goes on the page. A scan reads the
 * code back and looks up which shot sits in which frame.
 */

import { createClient } from '@/lib/supabase/client';
import type { SheetKind } from './layout';

export interface PrintSheetRow {
  id: string;
  code: number;
  project_id: string;
  kind: Exclude<SheetKind, 'blank'>;
  page_index: number;
  page_count: number;
  frames: (string | null)[];
  created_at: string;
}

/** Registers pages and returns their codes in order, or null if the table isn't there yet. */
export async function registerSheets(
  projectId: string,
  kind: Exclude<SheetKind, 'blank'>,
  pages: (string | null)[][],
  userId: string | null
): Promise<number[] | null> {
  const supabase = createClient();
  const rows = pages.map((frames, i) => ({
    project_id: projectId,
    kind,
    page_index: i,
    page_count: pages.length,
    frames,
    created_by: userId,
  }));
  const { data, error } = await supabase.from('storyboard_print_sheets').insert(rows).select('code, page_index');
  if (error || !data) {
    console.error('Register print sheets:', error);
    return null;
  }
  const byIndex = new Map((data as { code: number; page_index: number }[]).map((r) => [r.page_index, r.code]));
  return pages.map((_, i) => byIndex.get(i) ?? 0);
}

export async function lookupSheet(projectId: string, code: number): Promise<PrintSheetRow | null> {
  if (!code) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('storyboard_print_sheets')
    .select('*')
    .eq('project_id', projectId)
    .eq('code', code)
    .maybeSingle();
  if (error) {
    console.error('Look up print sheet:', error);
    return null;
  }
  return (data as PrintSheetRow) || null;
}
