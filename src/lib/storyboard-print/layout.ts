/**
 * Geometry of the printable storyboard sheet, shared by the printer and the scanner.
 *
 * Everything is in millimetres on an A4 landscape page (297 × 210). The page
 * carries four L-shaped corner marks, an orientation square tucked into the
 * top-left L, and a strip of bit cells along the bottom that encodes the sheet
 * kind and code. A scan finds the four L's, uses the square to work out which
 * way up the page is, reads the strip, and then knows exactly where every
 * frame and its notes lines are.
 *
 * Printers that "fit to page" only scale the sheet uniformly, which the
 * scanner does not care about — it only uses positions relative to the marks.
 */

export const PAGE_W = 297;
export const PAGE_H = 210;

export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

// ── Corner marks ──────────────────────────────────────────────────────

export const MARK_INSET = 10;
export const MARK_ARM = 14;
export const MARK_THICK = 3.5;

export type Corner = 'tl' | 'tr' | 'br' | 'bl';
export const CORNERS: Corner[] = ['tl', 'tr', 'br', 'bl'];

/** The outer vertex of each L — these are the points the scanner locates. */
export const MARK_VERTEX: Record<Corner, Pt> = {
  tl: { x: MARK_INSET, y: MARK_INSET },
  tr: { x: PAGE_W - MARK_INSET, y: MARK_INSET },
  br: { x: PAGE_W - MARK_INSET, y: PAGE_H - MARK_INSET },
  bl: { x: MARK_INSET, y: PAGE_H - MARK_INSET },
};

/** The two bars that make up each L. */
export function markRects(corner: Corner): Rect[] {
  const v = MARK_VERTEX[corner];
  const sx = corner === 'tl' || corner === 'bl' ? 1 : -1;
  const sy = corner === 'tl' || corner === 'tr' ? 1 : -1;
  const bar = (dx: number, dy: number, w: number, h: number): Rect => ({
    x: sx > 0 ? v.x + dx : v.x - dx - w,
    y: sy > 0 ? v.y + dy : v.y - dy - h,
    w,
    h,
  });
  return [bar(0, 0, MARK_ARM, MARK_THICK), bar(0, 0, MARK_THICK, MARK_ARM)];
}

/** Orientation square, inside the crook of the top-left L only. */
export const ORIENT_SIZE = 4;
export const ORIENT_OFFSET = 7; // from the L vertex to the square's near corner

/** Where the orientation square would sit for a given corner (only 'tl' is printed). */
export function orientRect(corner: Corner): Rect {
  const v = MARK_VERTEX[corner];
  const sx = corner === 'tl' || corner === 'bl' ? 1 : -1;
  const sy = corner === 'tl' || corner === 'tr' ? 1 : -1;
  return {
    x: sx > 0 ? v.x + ORIENT_OFFSET : v.x - ORIENT_OFFSET - ORIENT_SIZE,
    y: sy > 0 ? v.y + ORIENT_OFFSET : v.y - ORIENT_OFFSET - ORIENT_SIZE,
    w: ORIENT_SIZE,
    h: ORIENT_SIZE,
  };
}

// ── Code strip ────────────────────────────────────────────────────────

export type SheetKind = 'blank' | 'shotlist' | 'drawn';
const KIND_BITS: Record<SheetKind, number> = { blank: 0, shotlist: 1, drawn: 2 };
const BITS_KIND: SheetKind[] = ['blank', 'shotlist', 'drawn'];

export const CODE_BITS = 34; // 2 kind + 24 code + 8 CRC
export const CODE_CELL = 3.6;
export const CODE_X = 34;
export const CODE_Y = PAGE_H - MARK_INSET - CODE_CELL;

/** Frame around the strip, so empty cells still read as part of a strip. */
export const CODE_BOX: Rect = { x: CODE_X - 1.2, y: CODE_Y - 1.2, w: CODE_BITS * CODE_CELL + 2.4, h: CODE_CELL + 2.4 };

export function codeCell(i: number): Rect {
  return { x: CODE_X + i * CODE_CELL, y: CODE_Y, w: CODE_CELL, h: CODE_CELL };
}

function crc8(bits: number[]): number {
  let crc = 0;
  for (const b of bits) {
    const top = ((crc >> 7) & 1) ^ b;
    crc = (crc << 1) & 0xff;
    if (top) crc ^= 0x07;
  }
  return crc;
}

function toBits(value: number, n: number): number[] {
  const out: number[] = [];
  for (let i = n - 1; i >= 0; i--) out.push((value >>> i) & 1);
  return out;
}

function fromBits(bits: number[]): number {
  return bits.reduce((acc, b) => acc * 2 + b, 0);
}

export function encodeSheetCode(kind: SheetKind, code: number): number[] {
  const payload = [...toBits(KIND_BITS[kind], 2), ...toBits(code & 0xffffff, 24)];
  return [...payload, ...toBits(crc8(payload), 8)];
}

export function decodeSheetCode(bits: number[]): { kind: SheetKind; code: number } | null {
  if (bits.length !== CODE_BITS) return null;
  const payload = bits.slice(0, 26);
  if (crc8(payload) !== fromBits(bits.slice(26))) return null;
  const kind = BITS_KIND[fromBits(payload.slice(0, 2))];
  if (!kind) return null;
  return { kind, code: fromBits(payload.slice(2)) };
}

/** Human-readable form printed beside the strip, e.g. "SB-000123". */
export function formatSheetCode(code: number): string {
  return `SB-${String(code).padStart(6, '0')}`;
}

export function parseSheetCode(text: string): number | null {
  const m = text.trim().toUpperCase().match(/^(?:SB-?)?(\d{1,8})$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 0 && n <= 0xffffff ? n : null;
}

// ── Frames ────────────────────────────────────────────────────────────

export const COLS = 3;
export const ROWS = 2;
export const FRAMES_PER_PAGE = COLS * ROWS;

const GRID_X = 16;
const GRID_Y = 30;
const GUTTER_X = 8;
const GUTTER_Y = 6;
export const FRAME_W = (PAGE_W - 2 * GRID_X - (COLS - 1) * GUTTER_X) / COLS; // 83
export const FRAME_H = (FRAME_W * 9) / 16;
export const INFO_H = 27;

export interface FrameSlot {
  index: number;
  /** The 16:9 picture box. */
  image: Rect;
  /** The notes area underneath it. */
  info: Rect;
}

export function frameSlot(index: number): FrameSlot {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = GRID_X + col * (FRAME_W + GUTTER_X);
  const y = GRID_Y + row * (FRAME_H + INFO_H + GUTTER_Y);
  return {
    index,
    image: { x, y, w: FRAME_W, h: FRAME_H },
    info: { x, y: y + FRAME_H + 1.5, w: FRAME_W, h: INFO_H - 2 },
  };
}

export const FRAME_SLOTS: FrameSlot[] = Array.from({ length: FRAMES_PER_PAGE }, (_, i) => frameSlot(i));

/** How far inside the printed frame line the scanner samples, so the line itself is never vectorised. */
export const FRAME_SAMPLE_INSET = 1.4;

/** Everything solid black that the scanner relies on (for tests and the printer). */
export function registrationRects(kind: SheetKind, code: number): Rect[] {
  const bits = encodeSheetCode(kind, code);
  return [
    ...CORNERS.flatMap(markRects),
    orientRect('tl'),
    ...bits.flatMap((b, i) => (b ? [codeCell(i)] : [])),
  ];
}
