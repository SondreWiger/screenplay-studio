'use client';

import type { ScriptElementType } from '@/lib/types';

// ============================================================
// Screenplay Renderer — renders structured script elements
// as a properly formatted screenplay.
// ============================================================

export interface ScreenplayElement {
  element_type: ScriptElementType;
  content: string;
  scene_number?: string | null;
}

/**
 * Attempt to parse script_content as structured screenplay elements.
 * Returns null if it's plain text (not JSON).
 */
export function parseScreenplayElements(raw: string | null | undefined): ScreenplayElement[] | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].element_type && 'content' in parsed[0]) {
      return parsed as ScreenplayElement[];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Renders screenplay elements in proper screenplay format.
 */
export function ScreenplayRenderer({ elements, className }: { elements: ScreenplayElement[]; className?: string }) {
  return (
    <div className={`font-[Courier_Prime,Courier,monospace] text-[12px] leading-[1.6] text-stone-800 ${className || ''}`}>
      {elements.map((el, i) => {
        switch (el.element_type) {
          case 'scene_heading':
            return (
              <div key={i} className="mt-6 mb-2 font-bold uppercase tracking-wide text-stone-900">
                {el.scene_number && <span className="mr-3 text-stone-500">{el.scene_number}.</span>}
                {el.content}
              </div>
            );

          case 'action':
            return (
              <div key={i} className="my-1.5 max-w-[60ch]">
                {el.content}
              </div>
            );

          case 'character':
            return (
              <div key={i} className="mt-4 mb-0 text-center uppercase font-semibold tracking-wide text-stone-900" style={{ marginLeft: '35%', textAlign: 'left' }}>
                {el.content}
              </div>
            );

          case 'parenthetical':
            return (
              <div key={i} className="text-stone-600 italic" style={{ marginLeft: '30%', maxWidth: '25ch' }}>
                ({el.content.replace(/^\(|\)$/g, '')})
              </div>
            );

          case 'dialogue':
            return (
              <div key={i} className="mb-1" style={{ marginLeft: '25%', maxWidth: '35ch' }}>
                {el.content}
              </div>
            );

          case 'transition':
            return (
              <div key={i} className="my-3 text-right uppercase font-semibold text-stone-700 pr-4">
                {el.content}
              </div>
            );

          case 'shot':
            return (
              <div key={i} className="my-2 uppercase font-semibold text-stone-700">
                {el.content}
              </div>
            );

          case 'centered':
            return (
              <div key={i} className="my-2 text-center text-stone-700">
                {el.content}
              </div>
            );

          case 'lyrics':
            return (
              <div key={i} className="my-1 italic text-stone-600" style={{ marginLeft: '25%', maxWidth: '35ch' }}>
                {el.content}
              </div>
            );

          case 'note':
            return (
              <div key={i} className="my-2 px-3 py-1.5 bg-amber-50 border-l-2 border-amber-300 text-stone-600 text-[11px]">
                {el.content}
              </div>
            );

          case 'section':
            return (
              <div key={i} className="mt-8 mb-2 text-sm font-bold uppercase text-stone-500 tracking-wider">
                {el.content}
              </div>
            );

          case 'synopsis':
            return (
              <div key={i} className="my-2 text-stone-500 italic text-[11px]">
                {el.content}
              </div>
            );

          case 'page_break':
            return (
              <div key={i} className="my-4 border-t border-dashed border-stone-300" />
            );

          case 'title_page':
            return (
              <div key={i} className="my-4 text-center">
                <div className="text-lg font-bold uppercase text-stone-900">{el.content}</div>
              </div>
            );

          default:
            return el.content ? (
              <div key={i} className="my-1">{el.content}</div>
            ) : null;
        }
      })}
    </div>
  );
}

/**
 * Smart script content viewer — auto-detects structured vs plain text.
 */
export function ScriptContentViewer({ content, className }: { content: string; className?: string }) {
  const elements = parseScreenplayElements(content);

  if (elements) {
    return <ScreenplayRenderer elements={elements} className={className} />;
  }

  // Fallback: render as plain text
  return (
    <pre className={`text-xs text-stone-700 whitespace-pre-wrap font-[Courier_Prime,Courier,monospace] leading-relaxed ${className || ''}`}>
      {content}
    </pre>
  );
}
