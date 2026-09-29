import type { ScriptElement } from '@/lib/types';

/**
 * Parsers return partial elements (a line may have no content or type).
 * Fill the fields every consumer relies on so string operations can't throw.
 */
export function normalizeParsed(elements: Partial<ScriptElement>[]): ScriptElement[] {
  return elements.map((e, i) => ({
    ...e,
    content: e.content ?? '',
    element_type: e.element_type ?? 'action',
    sort_order: e.sort_order ?? i,
  })) as ScriptElement[];
}
