import { describe, expect, it } from 'vitest';
import {
  CORNERS, FRAME_SLOTS, MARK_VERTEX, PAGE_H, PAGE_W,
  decodeSheetCode, encodeSheetCode, formatSheetCode, parseSheetCode, registrationRects,
  type Pt, type SheetKind,
} from '@/lib/storyboard-print/layout';
import {
  EMPTY_FRAME_COVERAGE, applyHomography, detectSheet, extractFrames, solveHomography, vectorizeFrame,
  type RGBAImage,
} from '@/lib/storyboard-print/scan';

describe('sheet code', () => {
  it('round-trips kind and code', () => {
    for (const [kind, code] of [['blank', 0], ['shotlist', 1], ['drawn', 123456], ['shotlist', 0xffffff]] as [SheetKind, number][]) {
      expect(decodeSheetCode(encodeSheetCode(kind, code))).toEqual({ kind, code });
    }
  });

  it('rejects a flipped bit', () => {
    const bits = encodeSheetCode('drawn', 4242);
    bits[7] ^= 1;
    expect(decodeSheetCode(bits)).toBeNull();
  });

  it('formats and parses the printed code', () => {
    expect(formatSheetCode(42)).toBe('SB-000042');
    expect(parseSheetCode('sb-000042')).toBe(42);
    expect(parseSheetCode('42')).toBe(42);
    expect(parseSheetCode('nope')).toBeNull();
  });
});

describe('homography', () => {
  it('maps the four points it was solved for', () => {
    const src = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }];
    const dst = [{ x: 3, y: 7 }, { x: 90, y: 12 }, { x: 80, y: 60 }, { x: 5, y: 50 }];
    const H = solveHomography(src, dst)!;
    src.forEach((p, i) => {
      const q = applyHomography(H, p);
      expect(q.x).toBeCloseTo(dst[i].x, 6);
      expect(q.y).toBeCloseTo(dst[i].y, 6);
    });
  });
});

/**
 * Renders a "photo" of a sheet: the page is placed with perspective at the given
 * image positions of its four paper corners, under uneven lighting, with a
 * hand-drawn circle in frame 2 (index 1) and a diagonal line in frame 5 (index 4).
 */
function photograph(kind: SheetKind, code: number, paperCorners: Pt[], W: number, H: number): RGBAImage {
  const pagePts = [{ x: 0, y: 0 }, { x: PAGE_W, y: 0 }, { x: PAGE_W, y: PAGE_H }, { x: 0, y: PAGE_H }];
  const toPage = solveHomography(paperCorners, pagePts)!;
  const rects = registrationRects(kind, code);
  const frames = FRAME_SLOTS.map((s) => s.image);
  const circle = FRAME_SLOTS[1].image;
  const cx = circle.x + circle.w / 2, cy = circle.y + circle.h / 2, rad = circle.h * 0.3;
  const line = FRAME_SLOTS[4].image;

  const data = new Uint8ClampedArray(W * H * 4);
  let seed = 7;
  const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff - 0.5) * 16; };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = applyHomography(toPage, { x: x + 0.5, y: y + 0.5 });
      // Lamp from the top-left: paper goes from bright to quite dim.
      const light = 0.45 + 0.55 * (1 - (x / W) * 0.6 - (y / H) * 0.4);
      let v = 70; // dark desk
      let tint = [1, 1, 1];
      if (p.x >= 0 && p.y >= 0 && p.x <= PAGE_W && p.y <= PAGE_H) {
        v = 245;
        tint = [1, 0.97, 0.9]; // warm light
        const inRect = (r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h;
        if (rects.some(inRect)) v = 20;
        // Thin printed frame borders.
        for (const f of frames) {
          const onX = (Math.abs(p.x - f.x) < 0.2 || Math.abs(p.x - f.x - f.w) < 0.2) && p.y >= f.y && p.y <= f.y + f.h;
          const onY = (Math.abs(p.y - f.y) < 0.2 || Math.abs(p.y - f.y - f.h) < 0.2) && p.x >= f.x && p.x <= f.x + f.w;
          if (onX || onY) v = 30;
        }
        // Pencil circle (0.5 mm line) and a pen diagonal.
        if (Math.abs(Math.hypot(p.x - cx, p.y - cy) - rad) < 0.3) v = 80;
        if (p.x > line.x + 10 && p.x < line.x + line.w - 10) {
          const t = (p.x - line.x - 10) / (line.w - 20);
          const ly = line.y + 8 + t * (line.h - 16);
          if (Math.abs(p.y - ly) < 0.35) v = 40;
        }
      }
      const o = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) data[o + k] = v * light * tint[k] + noise();
      data[o + 3] = 255;
    }
  }
  return { data, width: W, height: H };
}

describe('detectSheet', () => {
  it('finds an upright page, reads its code and vectorises the drawings', () => {
    const img = photograph('shotlist', 9001, [{ x: 60, y: 50 }, { x: 1240, y: 80 }, { x: 1210, y: 900 }, { x: 40, y: 860 }], 1300, 960);
    const det = detectSheet(img)!;
    expect(det).not.toBeNull();
    expect(det.rotation).toBe(0);
    expect(det.codeOk).toBe(true);
    expect(det).toMatchObject({ kind: 'shotlist', code: 9001 });

    const frames = extractFrames(img, det);
    expect(frames).toHaveLength(6);

    const empty = vectorizeFrame(frames[0].image);
    expect(empty.coverage).toBeLessThan(EMPTY_FRAME_COVERAGE);
    expect(empty.strokeCount).toBe(0);

    const drawn = vectorizeFrame(frames[1].image);
    expect(drawn.coverage).toBeGreaterThan(EMPTY_FRAME_COVERAGE);
    const pts = drawn.layers.flatMap((l) => l.strokes.flatMap((s) => s.points));
    expect(pts.length).toBeGreaterThan(8);
    // The circle sits in the middle of the frame, radius ≈ 0.3 × frame height (≈ 108 base units of 360).
    for (const p of pts) {
      const r = Math.hypot(p.x - 320, p.y - 180);
      expect(r).toBeGreaterThan(85);
      expect(r).toBeLessThan(130);
    }

    const diag = vectorizeFrame(frames[4].image);
    expect(diag.strokeCount).toBeGreaterThanOrEqual(1);
    expect(diag.strokeCount).toBeLessThanOrEqual(3);
  });

  it('works out the page was photographed upside down', () => {
    // Paper corners tl,tr,br,bl of the page land at image br,bl,tl,tr.
    const img = photograph('drawn', 77, [{ x: 1230, y: 900 }, { x: 70, y: 880 }, { x: 50, y: 60 }, { x: 1250, y: 40 }], 1300, 960);
    const det = detectSheet(img)!;
    expect(det).not.toBeNull();
    expect(det.rotation).toBe(2);
    expect(det).toMatchObject({ kind: 'drawn', code: 77, codeOk: true });
    // The circle must still come out of frame index 1.
    const frames = extractFrames(img, det);
    expect(vectorizeFrame(frames[1].image).coverage).toBeGreaterThan(EMPTY_FRAME_COVERAGE);
    expect(vectorizeFrame(frames[0].image).coverage).toBeLessThan(EMPTY_FRAME_COVERAGE);
  });

  it('handles a page turned a quarter (portrait photo)', () => {
    // Page rotated 90° clockwise: page tl → image tr.
    const img = photograph('blank', 0, [{ x: 840, y: 40 }, { x: 860, y: 1240 }, { x: 30, y: 1220 }, { x: 50, y: 60 }], 900, 1300);
    const det = detectSheet(img)!;
    expect(det).not.toBeNull();
    expect(det.rotation).toBe(1);
    expect(det).toMatchObject({ kind: 'blank', code: 0, codeOk: true });
  });

  it('returns null when there is no sheet', () => {
    const W = 400, H = 300;
    const data = new Uint8ClampedArray(W * H * 4).fill(200);
    expect(detectSheet({ data, width: W, height: H })).toBeNull();
  });
});

// Keeps the corner constants honest: the L vertices span the page symmetrically.
it('marks are symmetric', () => {
  const v = CORNERS.map((c) => MARK_VERTEX[c]);
  expect(v[0].x + v[1].x).toBe(PAGE_W);
  expect(v[0].y + v[3].y).toBe(PAGE_H);
});
