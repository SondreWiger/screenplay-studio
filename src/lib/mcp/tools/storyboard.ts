import { randomUUID } from 'crypto';
import { ToolError } from '../context';
import { s } from '../schema';
import { must, tool } from '../tool';

/**
 * Lets Claude sketch storyboard frames. Drawings are written to
 * shots.storyboard_drawing in the same layered stroke format the Storyboard
 * studio draws and edits (see components/storyboard/engine.ts), so a frame
 * Claude sketches opens in the studio as ordinary, editable strokes.
 *
 * Claude describes simple shapes (lines, curves, boxes, ellipses, arrows,
 * stick figures) on the studio's 640 x 360 canvas; this file turns them into
 * strokes.
 */

export const CANVAS_W = 640;
export const CANVAS_H = 360;

type Tool = 'pencil' | 'ink' | 'marker' | 'fineliner' | 'arrow';
type LayerId = 'bg' | 'char' | 'cam';

interface Point { x: number; y: number; pressure?: number }
interface Stroke { id: string; points: Point[]; color: string; width: number; tool: Tool; pressureSensitive: false; arrowHead?: 'none' | 'end' }
interface Layer { id: string; name: string; visible: boolean; locked: boolean; opacity: number; strokes: Stroke[] }

export interface ShapeInput {
  type: 'line' | 'curve' | 'rect' | 'ellipse' | 'arrow' | 'figure';
  layer?: LayerId;
  tool?: Exclude<Tool, 'arrow'>;
  color?: string;
  width?: number;
  points?: number[][];
  closed?: boolean;
  x?: number; y?: number; w?: number; h?: number;
  cx?: number; cy?: number; rx?: number; ry?: number;
  pose?: 'stand' | 'walk' | 'sit';
  facing?: 'left' | 'right';
}

const LAYER_NAMES: Record<LayerId, string> = { bg: 'Background', char: 'Characters / Action', cam: 'Camera & Notes' };
const LAYER_IDS: LayerId[] = ['bg', 'char', 'cam'];
/** Pencil for set dressing, ink for people, fineliner for camera marks. */
const DEFAULT_TOOL: Record<LayerId, Exclude<Tool, 'arrow'>> = { bg: 'pencil', char: 'ink', cam: 'fineliner' };
const DEFAULT_WIDTH: Record<LayerId, number> = { bg: 1.6, char: 2.6, cam: 2 };
const DEFAULT_COLOR = '#1f2328';
const CAMERA_COLOR = '#c0392b';
const MAX_SHAPES = 300;
const MAX_POINTS = 6000;

function emptyLayers(): Layer[] {
  return LAYER_IDS.map((id) => ({ id, name: LAYER_NAMES[id], visible: true, locked: false, opacity: 1, strokes: [] }));
}

/** Same reading as normalizeToLayers in the studio: layered, legacy flat strokes, or empty. */
export function toLayers(raw: unknown): Layer[] {
  if (!Array.isArray(raw) || raw.length === 0) return emptyLayers();
  if (raw[0] && typeof raw[0] === 'object' && 'strokes' in raw[0]) {
    const layers = (raw as Layer[]).map((l, i) => ({
      id: l.id || `layer-${i}`, name: l.name || `Layer ${i + 1}`, visible: l.visible !== false,
      locked: Boolean(l.locked), opacity: typeof l.opacity === 'number' ? l.opacity : 1, strokes: Array.isArray(l.strokes) ? l.strokes : [],
    }));
    for (const id of LAYER_IDS) if (!layers.some((l) => l.id === id)) layers.push({ id, name: LAYER_NAMES[id], visible: true, locked: false, opacity: 1, strokes: [] });
    return layers;
  }
  const layers = emptyLayers();
  layers[1].strokes = raw as Stroke[];
  return layers;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const pt = (x: number, y: number): Point => ({ x: r2(x), y: r2(y), pressure: 0.5 });

function ellipsePoints(cx: number, cy: number, rx: number, ry: number): Point[] {
  const n = Math.max(16, Math.min(64, Math.round((rx + ry) / 2)));
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(pt(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry));
  }
  return out;
}

/** Catmull-Rom through the given points, so a few control points read as a hand-drawn curve. */
function curvePoints(src: Point[]): Point[] {
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

/** A stick figure standing on (x, y) and h units tall when upright. */
function figureStrokes(x: number, y: number, h: number, pose: 'stand' | 'walk' | 'sit', facing: 'left' | 'right'): Point[][] {
  const d = facing === 'left' ? -1 : 1;
  const top = pose === 'sit' ? y - h * 0.74 : y - h;
  const headR = h * 0.085;
  const headCy = top + headR;
  const neck = pt(x, headCy + headR);
  const shoulderY = neck.y + h * 0.05;
  const head = ellipsePoints(x + d * h * 0.01, headCy, headR * 0.92, headR);

  if (pose === 'sit') {
    const hip = pt(x - d * h * 0.02, y - h * 0.3);
    const knee = pt(x + d * h * 0.22, y - h * 0.3);
    const foot = pt(x + d * h * 0.22, y);
    const hand = pt(x + d * h * 0.16, y - h * 0.32);
    return [head, [neck, hip], [hip, knee, foot], [pt(x, shoulderY), pt(x + d * h * 0.08, shoulderY + h * 0.14), hand]];
  }

  const hip = pt(x, y - h * 0.47);
  if (pose === 'walk') {
    return [
      head, [neck, hip],
      [hip, pt(x + d * h * 0.09, y - h * 0.22), pt(x + d * h * 0.17, y)],
      [hip, pt(x - d * h * 0.04, y - h * 0.24), pt(x - d * h * 0.12, y)],
      [pt(x, shoulderY), pt(x - d * h * 0.1, shoulderY + h * 0.16), pt(x - d * h * 0.14, shoulderY + h * 0.3)],
      [pt(x, shoulderY), pt(x + d * h * 0.09, shoulderY + h * 0.15), pt(x + d * h * 0.16, shoulderY + h * 0.27)],
    ];
  }
  return [
    head, [neck, hip],
    [hip, pt(x - h * 0.08, y)], [hip, pt(x + h * 0.08, y)],
    [pt(x, shoulderY), pt(x - h * 0.13, hip.y + h * 0.03)], [pt(x, shoulderY), pt(x + h * 0.13, hip.y + h * 0.03)],
  ];
}

function need(shape: ShapeInput, i: number, keys: (keyof ShapeInput)[]) {
  const missing = keys.filter((k) => typeof shape[k] !== 'number');
  if (missing.length) throw new ToolError(`shapes[${i}] (${shape.type}) needs ${missing.join(', ')}`);
}

function pointList(shape: ShapeInput, i: number, min: number): Point[] {
  const raw = shape.points ?? [];
  if (raw.length < min) throw new ToolError(`shapes[${i}] (${shape.type}) needs at least ${min} points as [[x, y], ...]`);
  return raw.map((p, j) => {
    if (!Array.isArray(p) || p.length < 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number') {
      throw new ToolError(`shapes[${i}].points[${j}] must be [x, y]`);
    }
    return pt(p[0], p[1]);
  });
}

/** Turns shapes into strokes, grouped by layer. Throws a readable error for a malformed shape. */
export function shapesToStrokes(shapes: ShapeInput[]): Record<LayerId, Stroke[]> {
  if (shapes.length > MAX_SHAPES) throw new ToolError(`At most ${MAX_SHAPES} shapes per call`);
  const out: Record<LayerId, Stroke[]> = { bg: [], char: [], cam: [] };
  let total = 0;

  shapes.forEach((shape, i) => {
    const layer: LayerId = shape.layer ?? (shape.type === 'figure' ? 'char' : shape.type === 'arrow' ? 'cam' : 'bg');
    const color = shape.color ?? (shape.type === 'arrow' ? CAMERA_COLOR : DEFAULT_COLOR);
    const width = shape.width ?? DEFAULT_WIDTH[layer];
    const brush: Tool = shape.type === 'arrow' ? 'arrow' : shape.tool ?? DEFAULT_TOOL[layer];
    let paths: Point[][];

    switch (shape.type) {
      case 'line': {
        const p = pointList(shape, i, 2);
        paths = [shape.closed ? [...p, p[0]] : p];
        break;
      }
      case 'curve': {
        const p = pointList(shape, i, 2);
        paths = [curvePoints(shape.closed ? [...p, p[0]] : p)];
        break;
      }
      case 'arrow':
        paths = [pointList(shape, i, 2)];
        break;
      case 'rect': {
        need(shape, i, ['x', 'y', 'w', 'h']);
        const { x, y, w, h } = shape as Required<ShapeInput>;
        paths = [[pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h), pt(x, y)]];
        break;
      }
      case 'ellipse':
        need(shape, i, ['cx', 'cy', 'rx', 'ry']);
        paths = [ellipsePoints(shape.cx!, shape.cy!, shape.rx!, shape.ry!)];
        break;
      case 'figure':
        need(shape, i, ['x', 'y', 'h']);
        paths = figureStrokes(shape.x!, shape.y!, shape.h!, shape.pose ?? 'stand', shape.facing ?? 'right');
        break;
      default:
        throw new ToolError(`shapes[${i}].type must be line, curve, rect, ellipse, arrow or figure`);
    }

    for (const points of paths) {
      total += points.length;
      out[layer].push({
        id: randomUUID().slice(0, 8), points, color, width, tool: brush, pressureSensitive: false,
        ...(brush === 'arrow' ? { arrowHead: 'end' as const } : {}),
      });
    }
  });

  if (total > MAX_POINTS) throw new ToolError(`That drawing has ${total} points; keep it under ${MAX_POINTS}`);
  return out;
}

const shapeInput = s.object({
  type: s.enum(['line', 'curve', 'rect', 'ellipse', 'arrow', 'figure'] as const),
  layer: s.enum(LAYER_IDS, 'bg = set and props (default for line/curve/rect/ellipse), char = people (default for figure), cam = camera moves and marks (default for arrow)'),
  tool: s.enum(['pencil', 'ink', 'marker', 'fineliner'] as const, 'Brush. marker is a translucent wash, good for shadows and fills'),
  color: s.string('Hex colour, default dark graphite; arrows default red'),
  width: s.number('Line width in canvas units (about 1 to 6)'),
  points: s.array(s.array(s.number()), 'line, curve, arrow: [[x, y], ...]'),
  closed: s.boolean('line, curve: join the last point back to the first'),
  x: s.number('rect: left. figure: feet centre'),
  y: s.number('rect: top. figure: ground line under the feet'),
  w: s.number('rect: width'),
  h: s.number('rect: height. figure: standing height'),
  cx: s.number('ellipse: centre x'), cy: s.number('ellipse: centre y'),
  rx: s.number('ellipse: horizontal radius'), ry: s.number('ellipse: vertical radius'),
  pose: s.enum(['stand', 'walk', 'sit'] as const, 'figure pose'),
  facing: s.enum(['left', 'right'] as const, 'figure facing'),
}, ['type']);

export const storyboardTools = [
  tool<{ shot_id: string; shapes: ShapeInput[]; mode?: 'replace' | 'append'; notes?: string }>({
    name: 'draw_storyboard',
    title: 'Draw storyboard frame',
    access: 'write',
    destructive: true,
    description:
      'Sketch a storyboard frame for a shot. The canvas is 640 x 360 (16:9), origin top-left, y down. Describe it as simple shapes: '
      + 'line/curve (points), rect (x, y, w, h), ellipse (cx, cy, rx, ry), arrow (points, for camera or action moves), '
      + 'figure (stick person standing on x, y, h tall; pose stand/walk/sit; facing). Draw the set on layer bg, people on char, camera marks on cam. '
      + 'Frame it like the shot: a close-up has a head filling most of the frame, a wide shot has small figures. '
      + 'The result appears in the Storyboard studio as editable strokes. mode "replace" (default) clears the shot\'s drawing first; "append" adds to it. '
      + 'Text cannot be drawn: put captions in notes, which become the shot\'s storyboard notes.',
    input: s.object({
      shot_id: s.id('Shot id'),
      shapes: s.array(shapeInput, 'What to draw, in order', { minItems: 1 }),
      mode: s.enum(['replace', 'append'] as const),
      notes: s.string('Storyboard notes shown under the frame'),
    }, ['shot_id', 'shapes']),
    async run(args, ctx) {
      const shot = must(await ctx.db.from('shots').select('id, project_id, shot_number, storyboard_drawing').eq('id', args.shot_id).maybeSingle(), 'Loading shot') as
        { id: string; project_id: string; shot_number: string | null; storyboard_drawing: unknown } | null;
      if (!shot) throw new ToolError(`Shot ${args.shot_id} not found`);
      await ctx.requireProject(shot.project_id, 'write');

      const drawn = shapesToStrokes(args.shapes);
      const layers = args.mode === 'append' ? toLayers(shot.storyboard_drawing) : emptyLayers();
      for (const id of LAYER_IDS) layers.find((l) => l.id === id)!.strokes.push(...drawn[id]);

      const patch: Record<string, unknown> = { storyboard_drawing: layers };
      if (args.notes !== undefined) patch.storyboard_notes = args.notes;
      must(await ctx.db.from('shots').update(patch).eq('id', shot.id), 'Saving storyboard');
      await ctx.audit('storyboard.draw', 'shot', shot.id, { shapes: args.shapes.length, mode: args.mode ?? 'replace' });

      return {
        shot_id: shot.id,
        shot_number: shot.shot_number,
        mode: args.mode ?? 'replace',
        strokes: Object.fromEntries(layers.map((l) => [l.id, l.strokes.length])),
      };
    },
  }),
];
