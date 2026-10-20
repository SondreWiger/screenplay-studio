/**
 * Storyboard sheet scanner — finds a printed sheet in a photo or scan, works
 * out which way up it is, reads its code strip, cuts out each frame and turns
 * the pencil/ink inside into editable storyboard strokes.
 *
 * Pure functions over RGBA buffers: no DOM, no canvas, so the whole pipeline
 * runs in tests. The browser wrapper (scan-browser.ts) only decodes files.
 *
 * Pipeline:
 *   1. grey + downscale → adaptive threshold → connected components
 *   2. keep L-shaped blobs, classify each by which way its arms point
 *   3. try combinations of one L per corner; for each, fit a homography for
 *      all four page rotations, check the orientation square and the CRC of
 *      the code strip, keep the best
 *   4. warp every frame (and its notes strip) out of the full-res image
 *   5. flatten lighting (divide by an estimated paper background), threshold,
 *      despeckle, thin to a skeleton, trace polylines, simplify, and store the
 *      local line width as pen pressure
 */

import type { DrawingLayer, DrawingPoint, DrawingStroke } from '@/components/storyboard/engine';
import {
  CODE_BITS, CORNERS, FRAME_SAMPLE_INSET, FRAME_SLOTS, MARK_VERTEX,
  codeCell, decodeSheetCode, orientRect,
  type Corner, type Pt, type Rect, type SheetKind,
} from './layout';

export interface RGBAImage { data: Uint8ClampedArray; width: number; height: number }

export type Homography = number[]; // 9 values, row-major, h[8] = 1

// ── Geometry ──────────────────────────────────────────────────────────

/** Homography mapping each src point onto the matching dst point. */
export function solveHomography(src: Pt[], dst: Pt[]): Homography | null {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-10) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      if (!f) continue;
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const h = A.map((row, i) => row[n] / row[i]);
  return [...h, 1];
}

export function applyHomography(H: Homography, p: Pt): Pt {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
}

// ── Pixels ────────────────────────────────────────────────────────────

function toGray(img: RGBAImage): Uint8Array {
  const { data, width, height } = img;
  const g = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) {
    g[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
  }
  return g;
}

/** Box-filter downscale of a grey image by an integer-free factor. */
function downscaleGray(g: Uint8Array, w: number, h: number, maxSide: number): { g: Uint8Array; w: number; h: number; scale: number } {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  if (scale >= 1) return { g, w, h, scale: 1 };
  const W = Math.max(1, Math.round(w * scale));
  const H = Math.max(1, Math.round(h * scale));
  const out = new Uint8Array(W * H);
  const fx = w / W;
  const fy = h / H;
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor(y * fy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * fx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      let s = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) s += g[yy * w + xx];
      out[y * W + x] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return { g: out, w: W, h: H, scale: W / w };
}

/** Bradley adaptive threshold: a pixel is dark when it is t below its neighbourhood mean. */
function adaptiveThreshold(g: Uint8Array, w: number, h: number, win: number, t: number): Uint8Array {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += g[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Uint8Array(w * h);
  const r = Math.max(2, win >> 1);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const count = (x1 - x0) * (y1 - y0);
      out[y * w + x] = g[y * w + x] * count < sum * (1 - t) ? 1 : 0;
    }
  }
  return out;
}

interface Component { id: number; count: number; minX: number; minY: number; maxX: number; maxY: number }

/** 8-connected component labelling. Returns labels (0 = background, ids from 1). */
function label(mask: Uint8Array, w: number, h: number): { labels: Int32Array; comps: Component[] } {
  const labels = new Int32Array(w * h);
  const comps: Component[] = [];
  const stack = new Int32Array(w * h);
  let next = 1;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const c: Component = { id: next, count: 0, minX: w, minY: h, maxX: 0, maxY: 0 };
    let sp = 0;
    stack[sp++] = start;
    labels[start] = next;
    while (sp) {
      const i = stack[--sp];
      const x = i % w;
      const y = (i - x) / w;
      c.count++;
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (mask[j] && !labels[j]) {
            labels[j] = next;
            stack[sp++] = j;
          }
        }
      }
    }
    comps.push(c);
    next++;
  }
  return { labels, comps };
}

// ── Corner marks ──────────────────────────────────────────────────────

export interface MarkCandidate { corner: Corner; vertex: Pt; size: number }

const QUAD_CORNER: Corner[] = ['tl', 'tr', 'bl', 'br'];
const OPPOSITE: Record<Corner, Corner> = { tl: 'br', tr: 'bl', br: 'tl', bl: 'tr' };

/** Blobs shaped like the printed L's, with the corner of the page each one marks. */
export function findMarkCandidates(mask: Uint8Array, w: number, h: number): MarkCandidate[] {
  const { labels, comps } = label(mask, w, h);
  const maxDim = Math.max(w, h);
  const out: MarkCandidate[] = [];
  for (const c of comps) {
    const bw = c.maxX - c.minX + 1;
    const bh = c.maxY - c.minY + 1;
    if (bw < Math.max(8, maxDim * 0.01) || bh < Math.max(8, maxDim * 0.01)) continue;
    if (bw > maxDim * 0.2 || bh > maxDim * 0.2) continue;
    if (bw / bh > 2 || bh / bw > 2) continue;
    const fill = c.count / (bw * bh);
    if (fill < 0.2 || fill > 0.75) continue;

    const cx = c.minX + bw / 2;
    const cy = c.minY + bh / 2;
    const counts = [0, 0, 0, 0];
    const areas = [0, 0, 0, 0];
    for (let y = c.minY; y <= c.maxY; y++) {
      for (let x = c.minX; x <= c.maxX; x++) {
        const q = (x >= cx ? 1 : 0) + (y >= cy ? 2 : 0);
        areas[q]++;
        if (labels[y * w + x] === c.id) counts[q]++;
      }
    }
    const dens = counts.map((n, i) => n / Math.max(1, areas[i]));
    let best = 0;
    for (let i = 1; i < 4; i++) if (dens[i] > dens[best]) best = i;
    const corner = QUAD_CORNER[best];
    const opp = dens[QUAD_CORNER.indexOf(OPPOSITE[corner])];
    const sides = [0, 1, 2, 3].filter((i) => i !== best && QUAD_CORNER[i] !== OPPOSITE[corner]).map((i) => dens[i]);
    if (dens[best] < 0.45 || opp > 0.15 || sides.some((d) => d < 0.15 || d > 0.85)) continue;

    // The outer vertex is the blob pixel furthest towards its corner.
    const sx = corner === 'tl' || corner === 'bl' ? -1 : 1;
    const sy = corner === 'tl' || corner === 'tr' ? -1 : 1;
    let bestScore = -Infinity;
    let vertex: Pt = { x: cx, y: cy };
    for (let y = c.minY; y <= c.maxY; y++) {
      for (let x = c.minX; x <= c.maxX; x++) {
        if (labels[y * w + x] !== c.id) continue;
        const s = sx * x + sy * y;
        if (s > bestScore) {
          bestScore = s;
          vertex = { x: x + (sx > 0 ? 1 : 0), y: y + (sy > 0 ? 1 : 0) };
        }
      }
    }
    out.push({ corner, vertex, size: (bw + bh) / 2 });
  }
  return out;
}

// ── Sampling ──────────────────────────────────────────────────────────

/** Mean grey of a page rectangle (inner `frac` of it), sampled through H. */
function sampleRect(g: Uint8Array, w: number, h: number, H: Homography, r: Rect, frac = 0.6, n = 5): number {
  let s = 0;
  let k = 0;
  const mx = (r.w * (1 - frac)) / 2;
  const my = (r.h * (1 - frac)) / 2;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const p = applyHomography(H, {
        x: r.x + mx + ((i + 0.5) / n) * r.w * frac,
        y: r.y + my + ((j + 0.5) / n) * r.h * frac,
      });
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (x < 0 || y < 0 || x >= w || y >= h) return NaN;
      s += g[y * w + x];
      k++;
    }
  }
  return s / k;
}

function isConvex(q: Pt[]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    const s = Math.sign(cross);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

// ── Sheet detection ───────────────────────────────────────────────────

export interface SheetDetection {
  /** Page (mm) → full-resolution image pixels. */
  H: Homography;
  /** Quarter turns the page was rotated by in the image (0–3). */
  rotation: number;
  kind: SheetKind;
  code: number;
  /** False when the strip could not be read; kind/code then fall back to blank/0. */
  codeOk: boolean;
  /** Image positions of the page corners tl, tr, br, bl (full resolution). */
  corners: Pt[];
}

const DETECT_MAX_SIDE = 1600;

export function detectSheet(img: RGBAImage): SheetDetection | null {
  const full = toGray(img);
  const { g, w, h, scale } = downscaleGray(full, img.width, img.height, DETECT_MAX_SIDE);
  const mask = adaptiveThreshold(g, w, h, Math.round(Math.max(w, h) / 10), 0.18);
  const cands = findMarkCandidates(mask, w, h);

  const groups = CORNERS.map((c) =>
    cands.filter((m) => m.corner === c).sort((a, b) => b.size - a.size).slice(0, 4)
  );
  if (groups.some((gr) => gr.length === 0)) return null;

  let best: (SheetDetection & { score: number }) | null = null;
  for (const a of groups[0]) for (const b of groups[1]) for (const c of groups[2]) for (const d of groups[3]) {
    const quad = [a, b, c, d];
    const sizes = quad.map((m) => m.size);
    if (Math.max(...sizes) / Math.min(...sizes) > 3) continue;
    const pts = quad.map((m) => m.vertex);
    if (!isConvex(pts)) continue;
    // The page must be much bigger than its marks.
    const span = Math.min(Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y), Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y));
    if (span < Math.max(...sizes) * 4) continue;

    for (let rot = 0; rot < 4; rot++) {
      // Page corner i sits at image corner (i + rot) % 4.
      const src = CORNERS.map((c) => MARK_VERTEX[c]);
      const dst = CORNERS.map((_, i) => pts[(i + rot) % 4]);
      const H = solveHomography(src, dst);
      if (!H) continue;
      const dot = sampleRect(g, w, h, H, orientRect('tl'));
      const blanks = (['tr', 'br', 'bl'] as Corner[]).map((c) => sampleRect(g, w, h, H, orientRect(c)));
      if ([dot, ...blanks].some(Number.isNaN)) continue;
      const white = Math.max(1, blanks.reduce((s, v) => s + v, 0) / 3);
      const contrast = (Math.min(...blanks) - dot) / white;
      if (contrast < 0.2) continue;

      const mid = (white + dot) / 2;
      const bits: number[] = [];
      for (let i = 0; i < CODE_BITS; i++) bits.push(sampleRect(g, w, h, H, codeCell(i), 0.5, 3) < mid ? 1 : 0);
      const decoded = decodeSheetCode(bits);
      const score = contrast + (decoded ? 2 : 0) + (Math.min(...sizes) / Math.max(...sizes)) * 0.2;
      if (best && score <= best.score) continue;

      const fullDst = dst.map((p) => ({ x: p.x / scale, y: p.y / scale }));
      const Hfull = solveHomography(src, fullDst);
      if (!Hfull) continue;
      best = {
        score,
        H: Hfull,
        rotation: rot,
        kind: decoded?.kind ?? 'blank',
        code: decoded?.code ?? 0,
        codeOk: !!decoded,
        corners: fullDst,
      };
    }
  }
  if (!best) return null;
  const { score: _score, ...det } = best;
  return det;
}

// ── Rectification ─────────────────────────────────────────────────────

/** Warps a page rectangle out of the image into an outW × outH RGBA buffer (bilinear). */
export function warpRect(img: RGBAImage, H: Homography, r: Rect, outW: number, outH: number): RGBAImage {
  const { data, width, height } = img;
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let j = 0; j < outH; j++) {
    for (let i = 0; i < outW; i++) {
      const p = applyHomography(H, { x: r.x + ((i + 0.5) / outW) * r.w, y: r.y + ((j + 0.5) / outH) * r.h });
      const o = (j * outW + i) * 4;
      const x = p.x - 0.5;
      const y = p.y - 0.5;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= width || y0 + 1 >= height) {
        out[o] = out[o + 1] = out[o + 2] = 255;
        out[o + 3] = 255;
        continue;
      }
      const fx = x - x0;
      const fy = y - y0;
      const i00 = (y0 * width + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + width * 4;
      const i11 = i01 + 4;
      for (let k = 0; k < 3; k++) {
        const top = data[i00 + k] + (data[i10 + k] - data[i00 + k]) * fx;
        const bot = data[i01 + k] + (data[i11 + k] - data[i01 + k]) * fx;
        out[o + k] = top + (bot - top) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, width: outW, height: outH };
}

export const FRAME_OUT_W = 1280;
export const FRAME_OUT_H = 720;

export interface ScannedFrame {
  index: number;
  /** The frame's picture area, straightened (FRAME_OUT_W × FRAME_OUT_H). */
  image: RGBAImage;
  /** The notes area under it, straightened, for reading handwriting. */
  info: RGBAImage;
}

export function extractFrames(img: RGBAImage, det: SheetDetection): ScannedFrame[] {
  const inset = FRAME_SAMPLE_INSET;
  return FRAME_SLOTS.map((slot) => {
    const r = { x: slot.image.x + inset, y: slot.image.y + inset, w: slot.image.w - inset * 2, h: slot.image.h - inset * 2 };
    const infoW = 640;
    const infoH = Math.round((infoW * slot.info.h) / slot.info.w);
    return {
      index: slot.index,
      image: warpRect(img, det.H, r, FRAME_OUT_W, FRAME_OUT_H),
      info: warpRect(img, det.H, slot.info, infoW, infoH),
    };
  });
}

// ── Ink extraction ────────────────────────────────────────────────────

/** Paper brightness per pixel, estimated from block maxima so shadows and tints fall out. */
function estimateBackground(g: Uint8Array, w: number, h: number, block: number): Float32Array {
  const gw = Math.ceil(w / block);
  const gh = Math.ceil(h / block);
  let grid = new Float32Array(gw * gh);
  for (let by = 0; by < gh; by++) {
    for (let bx = 0; bx < gw; bx++) {
      // 95th percentile rather than max, so a speck of glare doesn't win.
      const hist = new Uint32Array(256);
      let n = 0;
      for (let y = by * block; y < Math.min(h, (by + 1) * block); y++) {
        for (let x = bx * block; x < Math.min(w, (bx + 1) * block); x++) { hist[g[y * w + x]]++; n++; }
      }
      let acc = 0;
      let v = 255;
      for (; v > 0; v--) { acc += hist[v]; if (acc >= n * 0.05) break; }
      grid[by * gw + bx] = v;
    }
  }
  // Dilate (so big dark fills don't pull the paper estimate down), then blur twice.
  const pass = (src: Float32Array, op: 'max' | 'mean') => {
    const dst = new Float32Array(src.length);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        let acc = op === 'max' ? 0 : 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
          const v = src[yy * gw + xx];
          if (op === 'max') acc = Math.max(acc, v); else acc += v;
          n++;
        }
        dst[y * gw + x] = op === 'max' ? acc : acc / n;
      }
    }
    return dst;
  };
  grid = pass(pass(pass(grid, 'max'), 'mean'), 'mean');
  // Bilinear upsample.
  const bg = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const gy = Math.min(gh - 1, Math.max(0, (y + 0.5) / block - 0.5));
    const y0 = Math.floor(gy), y1 = Math.min(gh - 1, y0 + 1), fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = Math.min(gw - 1, Math.max(0, (x + 0.5) / block - 0.5));
      const x0 = Math.floor(gx), x1 = Math.min(gw - 1, x0 + 1), fx = gx - x0;
      const top = grid[y0 * gw + x0] + (grid[y0 * gw + x1] - grid[y0 * gw + x0]) * fx;
      const bot = grid[y1 * gw + x0] + (grid[y1 * gw + x1] - grid[y1 * gw + x0]) * fx;
      bg[y * w + x] = Math.max(24, top + (bot - top) * fy);
    }
  }
  return bg;
}

export interface InkMap {
  mask: Uint8Array;
  width: number;
  height: number;
  /** Fraction of the frame covered by ink. */
  coverage: number;
}

/**
 * Lighting-independent ink mask. `sensitivity` 0..1 — higher keeps fainter pencil.
 */
export function extractInk(frame: RGBAImage, sensitivity = 0.5): InkMap {
  const { width: w, height: h } = frame;
  const g = toGray(frame);
  const bg = estimateBackground(g, w, h, Math.max(16, Math.round(w / 32)));
  const thresh = 0.62 + 0.26 * Math.max(0, Math.min(1, sensitivity));
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = g[i] / bg[i] < thresh ? 1 : 0;

  // Clear a thin margin: anything there is the printed frame line, not drawing.
  const m = Math.round(w * 0.004);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < m || y < m || x >= w - m || y >= h - m) mask[y * w + x] = 0;
  }

  // Despeckle: drop blobs smaller than a pencil dot, and long thin slivers hugging the edge
  // (the printed frame line when the registration is a hair off).
  const { labels, comps } = label(mask, w, h);
  const minArea = Math.max(6, Math.round((w * h) / 80000));
  const edge = Math.round(w * 0.02);
  const drop = new Uint8Array(comps.length + 1);
  for (const c of comps) {
    const bw = c.maxX - c.minX + 1;
    const bh = c.maxY - c.minY + 1;
    if (c.count < minArea) { drop[c.id] = 1; continue; }
    const hugsH = (c.minY < edge || c.maxY >= h - edge) && bh < edge && bw > w * 0.25;
    const hugsV = (c.minX < edge || c.maxX >= w - edge) && bw < edge && bh > h * 0.25;
    if (hugsH || hugsV) drop[c.id] = 1;
  }
  let ink = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] && drop[labels[i]]) mask[i] = 0;
    if (mask[i]) ink++;
  }
  return { mask, width: w, height: h, coverage: ink / mask.length };
}

// ── Vectorisation ─────────────────────────────────────────────────────

/** Chamfer (3-4) distance to the nearest background pixel, in pixels. */
function distanceTransform(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!d[i]) continue;
    d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!d[i]) continue;
    d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
  }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

/** Zhang–Suen thinning, in place, restricted to the ink bounding box. */
function thin(mask: Uint8Array, w: number, h: number) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (maxX < 0) return;
  minX = Math.max(1, minX); minY = Math.max(1, minY);
  maxX = Math.min(w - 2, maxX); maxY = Math.min(h - 2, maxY);
  const del: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      del.length = 0;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const i = y * w + x;
          if (!mask[i]) continue;
          const p2 = mask[i - w], p3 = mask[i - w + 1], p4 = mask[i + 1], p5 = mask[i + w + 1];
          const p6 = mask[i + w], p7 = mask[i + w - 1], p8 = mask[i - 1], p9 = mask[i - w - 1];
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const a = (+(!p2 && p3)) + (+(!p3 && p4)) + (+(!p4 && p5)) + (+(!p5 && p6))
            + (+(!p6 && p7)) + (+(!p7 && p8)) + (+(!p8 && p9)) + (+(!p9 && p2));
          if (a !== 1) continue;
          if (step === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
          del.push(i);
        }
      }
      if (del.length) {
        changed = true;
        for (const i of del) mask[i] = 0;
      }
    }
  }
}

const N8 = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]]; // 4-neighbours first

/** Walks the skeleton into polylines (pixel coordinates). */
function traceSkeleton(skel: Uint8Array, w: number, h: number): Pt[][] {
  const visited = new Uint8Array(w * h);
  const degree = (x: number, y: number) => {
    let n = 0;
    for (const [dx, dy] of N8) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && skel[yy * w + xx]) n++;
    }
    return n;
  };
  const paths: Pt[][] = [];
  const walk = (sx: number, sy: number) => {
    const path: Pt[] = [{ x: sx, y: sy }];
    visited[sy * w + sx] = 1;
    let x = sx, y = sy;
    let px = -1, py = -1;
    for (;;) {
      let moved = false;
      for (const [dx, dy] of N8) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (skel[j] && !visited[j]) {
          visited[j] = 1;
          px = x; py = y;
          x = xx; y = yy;
          path.push({ x, y });
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
    // Join the end onto a neighbouring, already-traced line so junctions stay connected.
    for (const [dx, dy] of N8) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || (xx === px && yy === py)) continue;
      if (skel[yy * w + xx] && visited[yy * w + xx]) {
        path.push({ x: xx, y: yy });
        break;
      }
    }
    paths.push(path);
  };
  // Endpoints first so open lines are traced end to end, then whatever is left (loops).
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (skel[i] && !visited[i] && degree(x, y) === 1) walk(x, y);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (skel[i] && !visited[i]) walk(x, y);
  }
  return paths;
}

/** Ramer–Douglas–Peucker; returns indices of kept points. */
function simplify(pts: Pt[], eps: number): number[] {
  if (pts.length < 3) return pts.map((_, i) => i);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const A = pts[a], B = pts[b];
    const dx = B.x - A.x, dy = B.y - A.y;
    const len = Math.hypot(dx, dy);
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      // A closed loop has coinciding ends: measure from the point instead of the chord.
      const d = len < 1e-6
        ? Math.hypot(pts[i].x - A.x, pts[i].y - A.y)
        : Math.abs(dy * (pts[i].x - A.x) - dx * (pts[i].y - A.y)) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out: number[] = [];
  keep.forEach((k, i) => { if (k) out.push(i); });
  return out;
}

const SCANNED_INK = '#111827';

function strokeColour(frame: RGBAImage, pts: Pt[]): string {
  let r = 0, g = 0, b = 0;
  for (const p of pts) {
    const o = (Math.round(p.y) * frame.width + Math.round(p.x)) * 4;
    r += frame.data[o]; g += frame.data[o + 1]; b += frame.data[o + 2];
  }
  const n = pts.length || 1;
  r /= n; g /= n; b /= n;
  // Grey/black pencil and ink become charcoal; coloured pens keep their hue, deepened a little.
  if (Math.max(r, g, b) - Math.min(r, g, b) < 45) return SCANNED_INK;
  const k = 0.8;
  const hex = (v: number) => Math.round(Math.max(0, Math.min(255, v * k))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Inverse of engine.getPressureWidth for the ink tool: pressure that gives width w at base width b. */
function pressureFor(w: number, base: number): number {
  const t = (w / base - 0.2) / 1.4;
  return Math.max(0.04, Math.min(1, Math.pow(Math.max(0, t), 1 / 0.85)));
}

export interface VectorizeResult {
  layers: DrawingLayer[];
  strokeCount: number;
  pointCount: number;
  coverage: number;
}

/** Turns a straightened frame into storyboard layers in the 640×360 base space. */
export function vectorizeFrame(frame: RGBAImage, sensitivity = 0.5, baseW = 640): VectorizeResult {
  const ink = extractInk(frame, sensitivity);
  const { mask, width: w, height: h } = ink;
  const dist = distanceTransform(mask, w, h);
  const skel = mask.slice();
  thin(skel, w, h);
  const paths = traceSkeleton(skel, w, h);
  const s = baseW / w; // pixel → base units

  const strokes: DrawingStroke[] = [];
  let pointCount = 0;
  for (const path of paths) {
    const widths = path.map((p) => Math.max(1, 2 * dist[p.y * w + p.x] - 1));
    let len = 0;
    for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    const maxW = Math.max(...widths);
    // Single stray pixels of skeleton (spurs from thinning) are noise unless they mark a real dot.
    if (len < 2 && maxW < 3) continue;

    // Light smoothing removes the pixel staircase before simplification.
    const smooth = path.map((p, i) => {
      if (i === 0 || i === path.length - 1) return { x: p.x + 0.5, y: p.y + 0.5 };
      const a = path[i - 1], c = path[i + 1];
      return { x: (a.x + 2 * p.x + c.x) / 4 + 0.5, y: (a.y + 2 * p.y + c.y) / 4 + 0.5 };
    });
    const kept = simplify(smooth, 0.7);
    const sorted = [...widths].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const base = (median * s) / 1.235; // median width ↔ pressure 0.7 (see engine.getPressureWidth)
    const points: DrawingPoint[] = kept.map((i) => {
      // Width at a kept point = mean over the stretch it stands for.
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - 2); k <= Math.min(widths.length - 1, i + 2); k++) { sum += widths[k]; n++; }
      return {
        x: smooth[i].x * s,
        y: smooth[i].y * s,
        pressure: pressureFor((sum / n) * s, base),
      };
    });
    if (points.length === 1) points.push({ ...points[0] });
    pointCount += points.length;
    strokes.push({
      id: `scan-${strokes.length}`,
      tool: 'ink',
      color: strokeColour(frame, path),
      width: Math.round(base * 100) / 100,
      pressureSensitive: true,
      points,
    });
  }

  return {
    layers: [
      { id: 'bg', name: 'Background', visible: true, locked: false, opacity: 1, strokes: [] },
      { id: 'char', name: 'Scanned drawing', visible: true, locked: false, opacity: 1, strokes },
      { id: 'cam', name: 'Camera & Notes', visible: true, locked: false, opacity: 1, strokes: [] },
    ],
    strokeCount: strokes.length,
    pointCount,
    coverage: ink.coverage,
  };
}

/** Below this ink coverage a frame is treated as left blank. */
export const EMPTY_FRAME_COVERAGE = 0.0012;
