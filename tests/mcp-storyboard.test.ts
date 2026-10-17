import { describe, it, expect } from 'vitest';
import { shapesToStrokes, toLayers } from '@/lib/mcp/tools/storyboard';
import { TOOLS_BY_NAME } from '@/lib/mcp/tools';
import { validate } from '@/lib/mcp/schema';
import { hasDrawing, normalizeToLayers } from '@/components/storyboard/engine';

describe('draw_storyboard shapes', () => {
  it('puts each shape on its default layer with a stroke the studio can draw', () => {
    const out = shapesToStrokes([
      { type: 'rect', x: 20, y: 20, w: 100, h: 200 },
      { type: 'figure', x: 320, y: 300, h: 200 },
      { type: 'arrow', points: [[100, 300], [500, 300]] },
    ]);
    expect(out.bg).toHaveLength(1);
    expect(out.bg[0].points.length).toBeGreaterThan(50);
    expect(out.bg[0].points).toContainEqual(expect.objectContaining({ x: 120, y: 220 }));
    expect(out.char.length).toBeGreaterThanOrEqual(6);
    expect(out.cam[0].tool).toBe('arrow');
    expect(out.cam[0].arrowHead).toBe('end');
  });

  it('samples ellipses and curves into smooth point lists', () => {
    const out = shapesToStrokes([
      { type: 'ellipse', cx: 320, cy: 180, rx: 60, ry: 40 },
      { type: 'curve', points: [[0, 300], [200, 250], [400, 320], [640, 280]] },
    ]);
    const [ellipse, curve] = out.bg;
    expect(ellipse.points.length).toBeGreaterThan(16);
    expect(ellipse.points[0]).toEqual(ellipse.points[ellipse.points.length - 1]);
    expect(curve.points.length).toBeGreaterThan(4);
  });

  it('keeps figures upright: head above the feet', () => {
    for (const pose of ['stand', 'walk', 'sit'] as const) {
      const [head] = shapesToStrokes([{ type: 'figure', x: 300, y: 340, h: 200, pose }]).char;
      expect(Math.max(...head.points.map((p) => p.y))).toBeLessThan(340);
    }
  });

  it('names the shape and the missing field when a shape is incomplete', () => {
    expect(() => shapesToStrokes([{ type: 'rect', x: 1, y: 1 }])).toThrow(/shapes\[0\] \(rect\) needs w, h/);
    expect(() => shapesToStrokes([{ type: 'line', points: [[1, 1]] }])).toThrow(/at least 2 points/);
  });

  it('writes layers the studio reads back unchanged', () => {
    const layers = toLayers(null);
    layers[0].strokes.push(...shapesToStrokes([{ type: 'rect', x: 0, y: 0, w: 10, h: 10 }]).bg);
    expect(hasDrawing(layers)).toBe(true);
    expect(normalizeToLayers(layers).map((l) => l.id)).toEqual(['bg', 'char', 'cam']);
  });

  it('wraps a legacy flat stroke list when appending', () => {
    const legacy = [{ points: [{ x: 1, y: 1 }], color: '#000', width: 2, tool: 'ink' }];
    const layers = toLayers(legacy);
    expect(layers.find((l) => l.id === 'char')!.strokes).toHaveLength(1);
  });

  it('advertises a schema that accepts a typical call', () => {
    const def = TOOLS_BY_NAME.get('draw_storyboard')!;
    expect(def.access).toBe('write');
    expect(validate(def.input, {
      shot_id: 'x',
      shapes: [{ type: 'figure', x: 320, y: 340, h: 260, pose: 'sit', facing: 'left' }, { type: 'line', points: [[0, 300], [640, 300]] }],
      notes: 'Geir Ove alone',
    })).toEqual([]);
  });
});
