/**
 * Ready-made drawings for draw_storyboard: heads, busts, hands, hatching and a
 * sketchy double line. Each function returns paths in canvas coordinates
 * (640 x 360, y down); storyboard.ts turns them into studio strokes.
 */

export interface Point { x: number; y: number; pressure?: number }

/** One stroke to draw. width scales the shape's line width; smooth passes it through a curve. */
export interface Path { pts: Point[]; width?: number; smooth?: boolean; /** Absolute line width, for parts that scale with the drawing (fingers, limbs). */ abs?: number }

const r2 = (v: number) => Math.round(v * 100) / 100;
export const pt = (x: number, y: number): Point => ({ x: r2(x), y: r2(y), pressure: 0.5 });

export function ellipsePoints(cx: number, cy: number, rx: number, ry: number): Point[] {
  const n = Math.max(16, Math.min(72, Math.round((rx + ry) / 2)));
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(pt(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry));
  }
  return out;
}

/** Catmull-Rom through the given points, so a few control points read as a hand-drawn curve. */
export function curvePoints(src: Point[]): Point[] {
  if (src.length < 3) return src;
  const out: Point[] = [];
  for (let i = 0; i < src.length - 1; i++) {
    const p0 = src[Math.max(0, i - 1)], p1 = src[i], p2 = src[i + 1], p3 = src[Math.min(src.length - 1, i + 2)];
    for (let t = 0; t < 1; t += 0.125) {
      const t2 = t * t, t3 = t2 * t;
      out.push(pt(
        0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      ));
    }
  }
  out.push(src[src.length - 1]);
  return out;
}

/**
 * The outline of a rounded tube of width w along a centre line: a finger, a
 * thumb, an arm. Drawn as one closed stroke so it reads as line art.
 */
export function tube(centre: Point[], w: number, capStart = false): Point[] {
  const c = centre.length > 2 ? curvePoints(centre) : centre;
  if (c.length < 2) return c;
  const half = w / 2;
  const normal = (i: number) => {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  };
  const left = c.map((p, i) => { const n = normal(i); return pt(p.x + n.x * half, p.y + n.y * half); });
  const right = c.map((p, i) => { const n = normal(i); return pt(p.x - n.x * half, p.y - n.y * half); });
  const cap = (p: Point, i: number, from: number) => {
    const n = normal(i);
    const base = Math.atan2(n.y, n.x);
    const out: Point[] = [];
    for (let k = 1; k < 8; k++) {
      const a = base + from * (k / 8) * Math.PI;
      out.push(pt(p.x + Math.cos(a) * half, p.y + Math.sin(a) * half));
    }
    return out;
  };
  const end = c.length - 1;
  return [...left, ...cap(c[end], end, -1), ...right.reverse(), ...(capStart ? cap(c[0], 0, -1).reverse() : []), ...(capStart ? [left[0]] : [])];
}

/** Maps unit coordinates (x right, y down, around a centre) onto the canvas. */
function frame(cx: number, cy: number, s: number, flip = 1, angleDeg = 0) {
  const a = (angleDeg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  return (u: number, v: number) => pt(cx + (u * flip * c - v * sn) * s, cy + (u * flip * sn + v * c) * s);
}

const path = (map: (u: number, v: number) => Point, uv: number[][], extra: Omit<Path, 'pts'> = { smooth: true }): Path =>
  ({ pts: uv.map(([u, v]) => map(u, v)), ...extra });

export type Expression = 'neutral' | 'smile' | 'laugh' | 'sad' | 'surprised' | 'closed' | 'squint' | 'down' | 'worried';
export type Hair = 'short' | 'long' | 'bald' | 'hood';
export type View = 'front' | 'three_quarter' | 'profile';

function features(m: (u: number, v: number) => Point, expr: Expression, shift: number, far = 1): Path[] {
  const out: Path[] = [];
  const eyeY = -0.04;
  for (const side of [-1, 1]) {
    const x = side * 0.17 + shift;
    const sc = side === 1 ? 1 : far;
    if (sc <= 0) continue;
    const w = 0.07 * sc;
    // Brows carry most of the expression.
    const browTilt = expr === 'sad' || expr === 'worried' ? side * -0.03 : expr === 'surprised' ? 0 : side * 0.01;
    const browY = expr === 'surprised' ? -0.2 : -0.14;
    out.push(path(m, [[x - w * 1.3, browY - browTilt], [x, browY - 0.02], [x + w * 1.3, browY + browTilt]], { width: 0.8, smooth: true }));
    if (expr === 'closed' || expr === 'laugh') {
      out.push(path(m, [[x - w, eyeY], [x, eyeY + 0.03], [x + w, eyeY]], { width: 0.8 }));
    } else if (expr === 'squint') {
      out.push(path(m, [[x - w, eyeY + 0.01], [x, eyeY - 0.015], [x + w, eyeY + 0.01]], { width: 0.8 }));
    } else if (expr === 'down') {
      out.push(path(m, [[x - w, eyeY], [x, eyeY + 0.025], [x + w, eyeY]], { width: 0.8 }));
      out.push(path(m, [[x - w * 0.9, eyeY - 0.015], [x + w * 0.9, eyeY - 0.015]], { width: 0.5, smooth: false }));
    } else {
      const open = expr === 'surprised' ? 0.05 : 0.032;
      out.push({ pts: ellipsePoints(m(x, eyeY).x, m(x, eyeY).y, Math.abs(m(w, 0).x - m(0, 0).x) || w, Math.abs(m(0, open).y - m(0, 0).y) || open), width: 0.7 });
      const p = m(x + shift * 0.15, eyeY + 0.004);
      const pr = Math.abs(m(0.022, 0).x - m(0, 0).x) || 1;
      out.push({ pts: ellipsePoints(p.x, p.y, pr, pr), width: 1.4 });
    }
  }
  // Nose and mouth.
  out.push(path(m, [[shift * 1.2, 0.0], [shift * 1.4 - 0.025, 0.13], [shift * 1.2 + 0.035, 0.15]], { width: 0.7 }));
  const mx = shift * 1.1, my = 0.27;
  const mouths: Record<Expression, number[][]> = {
    neutral: [[mx - 0.09, my], [mx, my + 0.005], [mx + 0.09, my]],
    down: [[mx - 0.08, my], [mx + 0.08, my]],
    closed: [[mx - 0.08, my + 0.005], [mx + 0.08, my + 0.005]],
    squint: [[mx - 0.09, my + 0.01], [mx, my], [mx + 0.09, my + 0.01]],
    smile: [[mx - 0.11, my - 0.02], [mx, my + 0.04], [mx + 0.11, my - 0.02]],
    sad: [[mx - 0.1, my + 0.03], [mx, my - 0.01], [mx + 0.1, my + 0.03]],
    worried: [[mx - 0.09, my + 0.02], [mx - 0.03, my], [mx + 0.03, my + 0.015], [mx + 0.09, my]],
    surprised: [[mx - 0.05, my], [mx, my - 0.04], [mx + 0.05, my], [mx, my + 0.05], [mx - 0.05, my]],
    laugh: [[mx - 0.13, my - 0.03], [mx, my + 0.1], [mx + 0.13, my - 0.03], [mx, my - 0.01], [mx - 0.13, my - 0.03]],
  };
  out.push(path(m, mouths[expr], { width: 0.8 }));
  return out;
}

/** A head h tall centred on (x, y). */
export function headPaths(x: number, y: number, h: number, view: View, facing: 'left' | 'right', expr: Expression, hair: Hair): Path[] {
  const d = facing === 'left' ? -1 : 1;
  const m = frame(x, y, h, d);
  const out: Path[] = [];

  if (view === 'profile') {
    out.push(path(m, [[-0.4, 0.3], [-0.47, 0.05], [-0.42, -0.25], [-0.2, -0.47], [0.1, -0.5], [0.32, -0.36], [0.4, -0.16], [0.42, -0.06],
      [0.52, 0.08], [0.42, 0.13], [0.44, 0.2], [0.4, 0.25], [0.42, 0.3], [0.36, 0.4], [0.2, 0.47], [0.05, 0.45]]));
    out.push(path(m, [[-0.06, -0.04], [-0.12, -0.08], [-0.16, 0.02], [-0.12, 0.13], [-0.06, 0.1]], { width: 0.7 }));
    const eye = expr === 'closed' || expr === 'laugh' || expr === 'down' ? [[0.22, -0.03], [0.27, -0.01], [0.31, -0.03]] : [[0.24, -0.06], [0.3, -0.04], [0.26, -0.01]];
    out.push(path(m, eye, { width: 0.8 }));
    out.push(path(m, [[0.18, -0.13], [0.28, -0.16], [0.37, -0.13]], { width: 0.8 }));
    out.push(path(m, expr === 'smile' || expr === 'laugh' ? [[0.3, 0.27], [0.36, 0.26], [0.41, 0.24]] : expr === 'sad' ? [[0.3, 0.25], [0.36, 0.27], [0.41, 0.27]] : [[0.31, 0.26], [0.41, 0.26]], { width: 0.8 }));
    if (hair !== 'bald') out.push(path(m, [[-0.46, 0.05], [-0.48, -0.25], [-0.25, -0.5], [0.1, -0.53], [0.3, -0.42], [0.25, -0.33], [0.05, -0.35], [-0.12, -0.25], [-0.2, -0.05]], { width: 0.9 }));
    if (hair === 'long' || hair === 'hood') out.push(path(m, [[-0.46, 0.05], [-0.5, 0.35], [-0.42, 0.6]], { width: 0.9 }));
    return out;
  }

  const shift = view === 'three_quarter' ? 0.1 : 0;
  // Skull and jaw: wider at the temples, narrowing to the chin.
  out.push(path(m, [[0, -0.5], [0.24 + shift, -0.45], [0.37 + shift * 0.5, -0.24], [0.38 + shift * 0.3, 0.02], [0.32 + shift * 0.3, 0.24], [0.2 + shift * 0.6, 0.41],
    [0.03 + shift, 0.5], [-0.16 + shift * 0.5, 0.43], [-0.3 + shift * 0.3, 0.26], [-0.37 + shift * 0.2, 0.02], [-0.36, -0.24], [-0.24, -0.45], [0, -0.5]]));
  out.push(path(m, [[0.38 + shift * 0.3, -0.04], [0.45 + shift * 0.2, -0.06], [0.46 + shift * 0.2, 0.06], [0.37 + shift * 0.3, 0.14]], { width: 0.8 }));
  if (view === 'front') out.push(path(m, [[-0.37, -0.04], [-0.45, -0.06], [-0.46, 0.06], [-0.37, 0.14]], { width: 0.8 }));
  out.push(...features(m, expr, shift, view === 'three_quarter' ? 0.75 : 1));

  if (hair === 'short') {
    out.push(path(m, [[-0.38, -0.08], [-0.41, -0.33], [-0.2, -0.53], [0.08, -0.56], [0.33, -0.47], [0.41, -0.3], [0.39, -0.08]], { width: 1 }));
    out.push(path(m, [[-0.36, -0.22], [-0.15, -0.34], [0.05, -0.3], [0.22, -0.36], [0.37, -0.24]], { width: 0.8 }));
  } else if (hair === 'long') {
    out.push(path(m, [[-0.44, 0.6], [-0.46, 0.1], [-0.42, -0.35], [-0.2, -0.54], [0.1, -0.56], [0.36, -0.46], [0.46, -0.2], [0.47, 0.2], [0.44, 0.6]], { width: 1 }));
    out.push(path(m, [[-0.36, -0.2], [-0.1, -0.36], [0.12, -0.38], [0.36, -0.24]], { width: 0.8 }));
  } else if (hair === 'hood') {
    out.push(path(m, [[-0.55, 0.65], [-0.58, 0.1], [-0.5, -0.4], [-0.2, -0.64], [0.15, -0.64], [0.48, -0.42], [0.58, 0.1], [0.55, 0.65]], { width: 1 }));
    out.push(path(m, [[-0.36, -0.26], [-0.15, -0.38], [0.15, -0.38], [0.36, -0.26]], { width: 0.8 }));
  }
  return out;
}

export type Clothing = 'fleece' | 'hoodie' | 'jacket' | 'shirt' | 'none';

/** Head and shoulders: the head is h tall and centred on (x, y); the body runs off the bottom of the frame. */
export function bustPaths(x: number, y: number, h: number, view: View, facing: 'left' | 'right', expr: Expression, hair: Hair, clothing: Clothing): Path[] {
  const out = headPaths(x, y, h, view, facing, expr, hair);
  const d = facing === 'left' ? -1 : 1;
  const m = frame(x, y, h, d);
  const shift = view === 'front' ? 0 : view === 'three_quarter' ? 0.06 : -0.05;
  const bottom = Math.max(1.3, (360 - y) / h + 0.1);
  out.push(path(m, [[-0.14 + shift, 0.42], [-0.16 + shift, 0.62]], { width: 0.9, smooth: false }));
  out.push(path(m, [[0.14 + shift, 0.42], [0.16 + shift, 0.62]], { width: 0.9, smooth: false }));
  out.push(path(m, [[-1.15 + shift, bottom], [-1.05 + shift, 0.95], [-0.75 + shift, 0.72], [-0.2 + shift, 0.62]]));
  out.push(path(m, [[1.15 + shift, bottom], [1.05 + shift, 0.95], [0.75 + shift, 0.72], [0.2 + shift, 0.62]]));
  if (clothing === 'fleece') {
    out.push(path(m, [[-0.24 + shift, 0.6], [-0.06 + shift, 0.86], [0.06 + shift, 0.86], [0.24 + shift, 0.6]], { width: 0.9 }));
    out.push({ pts: [m(0.0 + shift, 0.86), m(0.02 + shift, bottom)], width: 0.6 });
    out.push({ pts: [m(-0.75 + shift, 0.9), m(-0.7 + shift, bottom)], width: 0.5 });
    out.push({ pts: [m(0.75 + shift, 0.9), m(0.7 + shift, bottom)], width: 0.5 });
  } else if (clothing === 'hoodie') {
    out.push(path(m, [[-0.5 + shift, 0.66], [-0.32 + shift, 0.95], [0.32 + shift, 0.95], [0.5 + shift, 0.66]], { width: 1 }));
    out.push({ pts: [m(-0.1 + shift, 0.95), m(-0.12 + shift, 1.25)], width: 0.6 });
    out.push({ pts: [m(0.1 + shift, 0.95), m(0.12 + shift, 1.25)], width: 0.6 });
  } else if (clothing === 'jacket') {
    out.push(path(m, [[-0.22 + shift, 0.62], [-0.05 + shift, 1.05], [0.05 + shift, 1.05], [0.22 + shift, 0.62]], { width: 0.9, smooth: false }));
    out.push(path(m, [[-0.22 + shift, 0.62], [-0.42 + shift, 0.8], [-0.12 + shift, 1.0]], { width: 0.8, smooth: false }));
    out.push(path(m, [[0.22 + shift, 0.62], [0.42 + shift, 0.8], [0.12 + shift, 1.0]], { width: 0.8, smooth: false }));
  } else if (clothing === 'shirt') {
    out.push(path(m, [[-0.2 + shift, 0.6], [0 + shift, 0.75], [0.2 + shift, 0.6]], { width: 0.8, smooth: false }));
  }
  return out;
}

export type HandPose = 'open' | 'grip' | 'point' | 'fist' | 'reach';

/**
 * A hand with its wrist at (x, y), h long from wrist to fingertip, pointing
 * along angle (degrees, 0 = right, 90 = down). thumb picks the side the thumb is on.
 */
export function handPaths(x: number, y: number, h: number, angle: number, pose: HandPose, thumb: 'up' | 'down', arm: number): Path[] {
  const t = thumb === 'up' ? -1 : 1;
  const a = (angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const m = (u: number, v: number) => pt(x + (u * c - v * t * s) * h, y + (u * s + v * t * c) * h);
  const out: Path[] = [];
  // Palm: a soft trapezoid, wider at the knuckles.
  out.push(path(m, [[0, -0.17], [0.2, -0.21], [0.42, -0.19], [0.47, -0.05], [0.46, 0.12], [0.4, 0.2], [0.18, 0.2], [0, 0.17]]));
  const fingers = [
    { v: 0.15, len: 0.36 }, { v: 0.05, len: 0.48 }, { v: -0.06, len: 0.52 }, { v: -0.16, len: 0.46 },
  ];
  fingers.forEach((f, i) => {
    const base: number[] = [0.45, f.v];
    let shape: number[][];
    const curled = pose === 'fist' || pose === 'grip' || (pose === 'point' && i !== 3);
    if (pose === 'reach') shape = [base, [0.45 + f.len * 0.55, f.v * 1.15], [0.45 + f.len, f.v * 1.3 + 0.03]];
    else if (curled) shape = [base, [0.6, f.v - 0.02], [0.66, f.v + 0.08], [0.55, f.v + 0.12]];
    else shape = [base, [0.45 + f.len * 0.5, f.v * 1.1], [0.45 + f.len, f.v * 1.25]];
    out.push({ pts: tube(shape.map(([u, v]) => m(u, v)), h * 0.085), width: 0.8, smooth: false });
  });
  const thumbShape = pose === 'fist' || pose === 'grip' ? [[0.1, 0.16], [0.28, 0.26], [0.46, 0.22]] : [[0.1, 0.16], [0.26, 0.28], [0.4, 0.32]];
  out.push({ pts: tube(thumbShape.map(([u, v]) => m(u, v)), h * 0.1), width: 0.8, smooth: false });
  if (arm > 0) {
    out.push(path(m, [[0.02, -0.17], [-arm / h * 0.5, -0.2], [-arm / h, -0.24]], { width: 1 }));
    out.push(path(m, [[0.02, 0.17], [-arm / h * 0.5, 0.21], [-arm / h, 0.26]], { width: 1 }));
    out.push(path(m, [[-0.02, -0.17], [-0.06, 0], [-0.02, 0.17]], { width: 0.6 }));
  }
  return out;
}

/** Parallel lines spaced `spacing` apart at `angle` degrees, clipped to a polygon. */
export function hatchPaths(poly: Point[], spacing: number, angle: number): Path[] {
  if (poly.length < 3 || spacing <= 0) return [];
  const a = (angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  // Rotate into a frame where hatch lines are horizontal.
  const rot = poly.map((p) => ({ x: p.x * c + p.y * s, y: -p.x * s + p.y * c }));
  const ys = rot.map((p) => p.y);
  const out: Path[] = [];
  for (let yy = Math.min(...ys) + spacing / 2; yy < Math.max(...ys); yy += spacing) {
    const xs: number[] = [];
    for (let i = 0; i < rot.length; i++) {
      const p = rot[i], q = rot[(i + 1) % rot.length];
      if ((p.y <= yy && q.y > yy) || (q.y <= yy && p.y > yy)) xs.push(p.x + ((yy - p.y) / (q.y - p.y)) * (q.x - p.x));
    }
    xs.sort((u, v) => u - v);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const back = (u: number) => pt(u * c - yy * s, u * s + yy * c);
      out.push({ pts: [back(xs[k]), back(xs[k + 1])], smooth: false });
    }
  }
  return out;
}

/** A second, lighter pass a little off the first, so lines read as sketched rather than ruled. */
export function roughen(pts: Point[], seed: number, amount: number): Point[] {
  let st = (seed * 9301 + 49297) % 233280;
  const rnd = () => { st = (st * 9301 + 49297) % 233280; return st / 233280 - 0.5; };
  const dx = rnd() * amount * 2, dy = rnd() * amount * 2;
  return pts.map((p, i) => pt(p.x + dx + (i % 7 === 0 ? rnd() * amount : 0), p.y + dy + (i % 7 === 0 ? rnd() * amount : 0)));
}
