import { randomUUID } from 'crypto';
import {
  bustPaths, curvePoints, ellipsePoints, handPaths, hatchPaths, headPaths, pt, roughen, tube,
  type Clothing, type Expression, type Hair, type HandPose, type Path, type Point, type View,
} from './storyboard-art';
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

interface Stroke { id: string; points: Point[]; color: string; width: number; tool: Tool; pressureSensitive: false; arrowHead?: 'none' | 'end' }
interface Layer { id: string; name: string; visible: boolean; locked: boolean; opacity: number; strokes: Stroke[] }

export interface ShapeInput {
  type: 'line' | 'curve' | 'rect' | 'ellipse' | 'arrow' | 'figure' | 'head' | 'bust' | 'hand' | 'hatch';
  layer?: LayerId;
  tool?: Exclude<Tool, 'arrow'>;
  color?: string;
  width?: number;
  points?: number[][];
  closed?: boolean;
  rough?: boolean;
  x?: number; y?: number; w?: number; h?: number;
  cx?: number; cy?: number; rx?: number; ry?: number;
  pose?: 'stand' | 'walk' | 'sit';
  facing?: 'left' | 'right';
  view?: View;
  expression?: Expression;
  hair?: Hair;
  clothing?: Clothing;
  hand_pose?: HandPose;
  angle?: number;
  thumb?: 'up' | 'down';
  arm?: number;
  spacing?: number;
}

const SHAPE_TYPES = ['line', 'curve', 'rect', 'ellipse', 'arrow', 'figure', 'head', 'bust', 'hand', 'hatch'] as const;
const LAYER_NAMES: Record<LayerId, string> = { bg: 'Background', char: 'Characters / Action', cam: 'Camera & Notes' };
const LAYER_IDS: LayerId[] = ['bg', 'char', 'cam'];
/** Pencil for set dressing, ink for people, fineliner for camera marks. */
const DEFAULT_TOOL: Record<LayerId, Exclude<Tool, 'arrow'>> = { bg: 'pencil', char: 'ink', cam: 'fineliner' };
const DEFAULT_WIDTH: Record<LayerId, number> = { bg: 1.6, char: 2.4, cam: 2 };
const DEFAULT_COLOR = '#1f2328';
const CAMERA_COLOR = '#c0392b';
const PEOPLE = new Set(['figure', 'head', 'bust', 'hand']);
const MAX_SHAPES = 400;
const MAX_POINTS = 20000;

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

/**
 * The studio smooths every stroke through the midpoints between its points, so
 * a straight line with only its corners would come out as a rounded blob.
 * Adding a point every few units keeps lines straight and corners sharp.
 */
function densify(src: Point[], step = 3): Point[] {
  if (src.length < 2) return src;
  const out: Point[] = [src[0]];
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1], b = src[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 1; k <= n; k++) out.push(pt(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n));
  }
  return out;
}

/** A simple mannequin standing on (x, y) and h units tall when upright: head, torso outline, limbs. */
function figurePaths(x: number, y: number, h: number, pose: 'stand' | 'walk' | 'sit', facing: 'left' | 'right'): Path[] {
  const d = facing === 'left' ? -1 : 1;
  const top = pose === 'sit' ? y - h * 0.74 : y - h;
  const headR = h * 0.075;
  const headCy = top + headR;
  const neckY = headCy + headR;
  const sh = neckY + h * 0.05;
  const hipY = pose === 'sit' ? y - h * 0.3 : y - h * 0.47;
  const hx = pose === 'sit' ? x - d * h * 0.02 : x;
  const head: Path = { pts: ellipsePoints(x + d * h * 0.012, headCy, headR * 0.86, headR), width: 1 };
  const torso: Path = { pts: [pt(hx - h * 0.07, hipY), pt(x - h * 0.09, sh + h * 0.08), pt(x - h * 0.1, sh + h * 0.02), pt(x - h * 0.05, sh - h * 0.005), pt(x + h * 0.05, sh - h * 0.005), pt(x + h * 0.1, sh + h * 0.02), pt(x + h * 0.09, sh + h * 0.08), pt(hx + h * 0.07, hipY), pt(hx - h * 0.07, hipY)], smooth: true, width: 1 };
  const neck: Path = { pts: [pt(x, neckY), pt(x, sh)], width: 1.4 };
  const limb = (...p: Point[]): Path => ({ pts: tube(p, Math.max(3, h * 0.045), true), width: 0.8, smooth: false });
  const L = (dx: number, dy: number) => pt(x + dx * h, dy);

  if (pose === 'sit') {
    return [head, neck, torso,
      limb(pt(hx, hipY), L(d * 0.24, hipY), L(d * 0.24, y)), limb(pt(hx + d * h * 0.03, hipY), L(d * 0.2, hipY + h * 0.01), L(d * 0.2, y)),
      limb(L(-d * 0.07, sh + 2), L(-d * 0.04, sh + h * 0.17), L(d * 0.14, hipY - h * 0.04)), limb(L(d * 0.08, sh + 2), L(d * 0.1, sh + h * 0.16), L(d * 0.22, hipY - h * 0.05))];
  }
  if (pose === 'walk') {
    return [head, neck, torso,
      limb(L(d * 0.04, hipY), L(d * 0.1, y - h * 0.22), L(d * 0.18, y)), limb(L(-d * 0.04, hipY), L(-d * 0.06, y - h * 0.24), L(-d * 0.13, y)),
      limb(L(-d * 0.09, sh + 2), L(-d * 0.13, sh + h * 0.16), L(-d * 0.15, sh + h * 0.3)), limb(L(d * 0.09, sh + 2), L(d * 0.13, sh + h * 0.15), L(d * 0.19, sh + h * 0.26))];
  }
  return [head, neck, torso,
    limb(L(-0.04, hipY), L(-0.06, y - h * 0.24), L(-0.07, y)), limb(L(0.04, hipY), L(0.06, y - h * 0.24), L(0.07, y)),
    limb(L(-0.1, sh + 2), L(-0.13, sh + h * 0.16), L(-0.13, hipY + h * 0.03)), limb(L(0.1, sh + 2), L(0.13, sh + h * 0.16), L(0.13, hipY + h * 0.03))];
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

function shapePaths(shape: ShapeInput, i: number): Path[] {
  switch (shape.type) {
    case 'line': {
      const p = pointList(shape, i, 2);
      return [{ pts: shape.closed ? [...p, p[0]] : p }];
    }
    case 'curve': {
      const p = pointList(shape, i, 2);
      return [{ pts: shape.closed ? [...p, p[0]] : p, smooth: true }];
    }
    case 'arrow':
      return [{ pts: pointList(shape, i, 2) }];
    case 'rect': {
      need(shape, i, ['x', 'y', 'w', 'h']);
      const { x, y, w, h } = shape as Required<ShapeInput>;
      return [{ pts: [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h), pt(x, y)] }];
    }
    case 'ellipse':
      need(shape, i, ['cx', 'cy', 'rx', 'ry']);
      return [{ pts: ellipsePoints(shape.cx!, shape.cy!, shape.rx!, shape.ry!), smooth: false }];
    case 'figure':
      need(shape, i, ['x', 'y', 'h']);
      return figurePaths(shape.x!, shape.y!, shape.h!, shape.pose ?? 'stand', shape.facing ?? 'right');
    case 'head':
      need(shape, i, ['x', 'y', 'h']);
      return headPaths(shape.x!, shape.y!, shape.h!, shape.view ?? 'front', shape.facing ?? 'right', shape.expression ?? 'neutral', shape.hair ?? 'short');
    case 'bust':
      need(shape, i, ['x', 'y', 'h']);
      return bustPaths(shape.x!, shape.y!, shape.h!, shape.view ?? 'front', shape.facing ?? 'right', shape.expression ?? 'neutral', shape.hair ?? 'short', shape.clothing ?? 'fleece');
    case 'hand':
      need(shape, i, ['x', 'y', 'h']);
      return handPaths(shape.x!, shape.y!, shape.h!, shape.angle ?? 0, shape.hand_pose ?? 'open', shape.thumb ?? 'up', shape.arm ?? 0);
    case 'hatch': {
      let poly: Point[];
      if (shape.points?.length) poly = pointList(shape, i, 3);
      else {
        need(shape, i, ['x', 'y', 'w', 'h']);
        const { x, y, w, h } = shape as Required<ShapeInput>;
        poly = [pt(x, y), pt(x + w, y), pt(x + w, y + h), pt(x, y + h)];
      }
      return hatchPaths(poly, shape.spacing ?? 6, shape.angle ?? 45);
    }
    default:
      throw new ToolError(`shapes[${i}].type must be one of ${SHAPE_TYPES.join(', ')}`);
  }
}

/** Turns shapes into strokes, grouped by layer. Throws a readable error for a malformed shape. */
export function shapesToStrokes(shapes: ShapeInput[]): Record<LayerId, Stroke[]> {
  if (shapes.length > MAX_SHAPES) throw new ToolError(`At most ${MAX_SHAPES} shapes per call`);
  const out: Record<LayerId, Stroke[]> = { bg: [], char: [], cam: [] };
  let total = 0;

  shapes.forEach((shape, i) => {
    const layer: LayerId = shape.layer ?? (PEOPLE.has(shape.type) ? 'char' : shape.type === 'arrow' ? 'cam' : 'bg');
    const color = shape.color ?? (shape.type === 'arrow' ? CAMERA_COLOR : DEFAULT_COLOR);
    const width = shape.width ?? (shape.type === 'hatch' ? 0.8 : DEFAULT_WIDTH[layer]);
    const brush: Tool = shape.type === 'arrow' ? 'arrow' : shape.tool ?? (shape.type === 'hatch' ? 'pencil' : DEFAULT_TOOL[layer]);

    shapePaths(shape, i).forEach((p, k) => {
      const passes = [p.smooth ? curvePoints(p.pts) : densify(p.pts)];
      if (shape.rough && brush !== 'arrow') passes.push(roughen(passes[0], i * 31 + k, Math.max(0.6, width * 0.5)));
      passes.forEach((points, pass) => {
        total += points.length;
        out[layer].push({
          id: randomUUID().slice(0, 8), points, color,
          width: r2((p.abs ?? width * (p.width ?? 1)) * (pass ? 0.45 : 1)), tool: pass ? 'pencil' : brush, pressureSensitive: false,
          ...(brush === 'arrow' ? { arrowHead: 'end' as const } : {}),
        });
      });
    });
  });

  if (total > MAX_POINTS) throw new ToolError(`That drawing has ${total} points; keep it under ${MAX_POINTS}`);
  return out;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

const shapeInput = s.object({
  type: s.enum(SHAPE_TYPES),
  layer: s.enum(LAYER_IDS, 'bg = set and props (default), char = people (default for figure, head, bust, hand), cam = camera moves and marks (default for arrow)'),
  tool: s.enum(['pencil', 'ink', 'marker', 'fineliner'] as const, 'Brush. marker is a translucent wash, good for shadows and fills'),
  color: s.string('Hex colour, default dark graphite; arrows default red'),
  width: s.number('Line width in canvas units (about 1 to 6)'),
  rough: s.boolean('Add a second, lighter sketch pass so the line looks hand-drawn'),
  points: s.array(s.array(s.number()), 'line, curve, arrow: [[x, y], ...]. hatch: the polygon to fill'),
  closed: s.boolean('line, curve: join the last point back to the first'),
  x: s.number('rect, hatch: left. figure: feet centre. head, bust: head centre. hand: wrist'),
  y: s.number('rect, hatch: top. figure: ground under the feet. head, bust: head centre. hand: wrist'),
  w: s.number('rect, hatch: width'),
  h: s.number('rect, hatch: height. figure: standing height. head, bust: head height. hand: wrist to fingertip'),
  cx: s.number('ellipse: centre x'), cy: s.number('ellipse: centre y'),
  rx: s.number('ellipse: horizontal radius'), ry: s.number('ellipse: vertical radius'),
  pose: s.enum(['stand', 'walk', 'sit'] as const, 'figure pose'),
  facing: s.enum(['left', 'right'] as const, 'figure, head, bust: which way they face'),
  view: s.enum(['front', 'three_quarter', 'profile'] as const, 'head, bust: angle'),
  expression: s.enum(['neutral', 'smile', 'laugh', 'sad', 'surprised', 'closed', 'squint', 'down', 'worried'] as const, 'head, bust'),
  hair: s.enum(['short', 'long', 'bald', 'hood'] as const, 'head, bust'),
  clothing: s.enum(['fleece', 'hoodie', 'jacket', 'shirt', 'none'] as const, 'bust'),
  hand_pose: s.enum(['open', 'grip', 'point', 'fist', 'reach'] as const, 'hand'),
  angle: s.number('hand: direction the fingers point, degrees (0 right, 90 down, 180 left). hatch: line angle'),
  thumb: s.enum(['up', 'down'] as const, 'hand: which side the thumb is on'),
  arm: s.number('hand: length of forearm to draw behind the wrist'),
  spacing: s.number('hatch: distance between lines (default 6)'),
}, ['type']);

export const storyboardTools = [
  tool<{ shot_id: string; shapes: ShapeInput[]; mode?: 'replace' | 'append'; notes?: string }>({
    name: 'draw_storyboard',
    title: 'Draw storyboard frame',
    access: 'write',
    destructive: true,
    description:
      'Sketch a storyboard frame for a shot. The canvas is 640 x 360 (16:9), origin top-left, y down. Build it from shapes: '
      + 'line/curve (points), rect (x, y, w, h), ellipse (cx, cy, rx, ry), arrow (points: camera or action moves), hatch (shading inside a rect or polygon), '
      + 'figure (body standing on x, y, h tall; pose stand/walk/sit), head (centred on x, y, h tall; view front/three_quarter/profile, expression, hair), '
      + 'bust (head plus shoulders for close-ups and mediums; clothing), hand (wrist at x, y, h long; hand_pose open/grip/point/fist/reach, angle, thumb, arm). '
      + 'Set on layer bg, people on char, camera marks on cam. Frame it like the shot: a close-up bust fills the frame, a wide shot has small figures. '
      + 'Use hatch and marker washes for shadow and depth, and rough: true for a sketchier line. '
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
