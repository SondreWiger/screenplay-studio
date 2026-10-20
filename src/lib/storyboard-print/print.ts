/**
 * Printable shot lists and storyboard sheets.
 *
 * Sheets are drawn as one SVG per A4 landscape page in millimetres, from the
 * same geometry the scanner reads (layout.ts), so a printed page always scans.
 * Like the other print views in the app, the document is written into a new
 * window that prints itself once its images have loaded.
 */

import { hasDrawing, makeCanvas, renderDrawing, type ShotWithStoryboard } from '@/components/storyboard/engine';
import type { Scene } from '@/lib/types';
import {
  CODE_BOX, CODE_CELL, CODE_X, CODE_Y, FRAMES_PER_PAGE, FRAME_SLOTS, PAGE_H, PAGE_W,
  formatSheetCode, registrationRects, type FrameSlot, type Rect, type SheetKind,
} from './layout';

// ── Helpers ───────────────────────────────────────────────────────────

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const label = (v: string | null | undefined) => (v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Greedy word wrap using an average Helvetica glyph width. */
function wrap(text: string, widthMm: number, fontMm: number, maxLines: number): string[] {
  const maxChars = Math.max(4, Math.floor(widthMm / (fontMm * 0.5)));
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) { line = next; continue; }
    if (line) lines.push(line);
    line = word.length > maxChars ? word.slice(0, maxChars - 1) + '…' : word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length + 1) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = (last.length >= maxChars ? last.slice(0, maxChars - 1) : last) + '…';
  }
  return lines;
}

const rectSvg = (r: Rect, attrs = 'fill="#000"') => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" ${attrs}/>`;
const text = (x: number, y: number, size: number, body: string, attrs = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" ${attrs}>${esc(body)}</text>`;
const hline = (x1: number, x2: number, y: number) => `<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="#9ca3af" stroke-width="0.2"/>`;

/** Renders a drawing on white to a PNG data URL. */
export function drawingToDataUrl(drawing: any, width = 1280): string {
  const h = Math.round((width * 9) / 16);
  const c = makeCanvas(width, h);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, h);
  renderDrawing(ctx, drawing, width, h);
  return c.toDataURL('image/png');
}

export function shotHeadline(shot: ShotWithStoryboard, scene?: Scene | null): string {
  return [
    scene?.scene_number ? `Sc ${scene.scene_number}` : null,
    label(shot.shot_type),
    shot.shot_movement && shot.shot_movement !== 'static' ? label(shot.shot_movement) : null,
    shot.lens || null,
    shot.duration_seconds ? `${shot.duration_seconds}s` : null,
  ].filter(Boolean).join(' · ');
}

// ── Print window ──────────────────────────────────────────────────────

/** Open synchronously from the click so popup blockers allow it; fill it in later. */
export function openPrintWindow(): Window | null {
  const win = window.open('', '_blank', 'width=1100,height=820');
  if (win) {
    win.document.write('<!DOCTYPE html><title>Preparing…</title><body style="font:14px system-ui;padding:40px;color:#444">Preparing your printout…</body>');
  }
  return win;
}

const PRINT_SCRIPT = `<script>
  window.addEventListener('load', function () {
    var imgs = Array.prototype.slice.call(document.images || []);
    Promise.all(imgs.map(function (i) { return i.complete ? 0 : new Promise(function (r) { i.onload = i.onerror = r; }); }))
      .then(function () { setTimeout(function () { window.print(); }, 150); });
  });
<\/script>`;

export function writePrintDocument(win: Window, html: string) {
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ── Shot list ─────────────────────────────────────────────────────────

export interface ShotListPrintOptions {
  projectTitle: string;
  scenes: Scene[];
  shots: ShotWithStoryboard[];
  withThumbnails: boolean;
  subtitle?: string;
}

export function buildShotListHtml({ projectTitle, scenes, shots, withThumbnails, subtitle }: ShotListPrintOptions): string {
  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const groups: { scene: Scene | null; shots: ShotWithStoryboard[] }[] = [];
  for (const scene of scenes) {
    const g = shots.filter((s) => s.scene_id === scene.id);
    if (g.length) groups.push({ scene, shots: g });
  }
  const loose = shots.filter((s) => !s.scene_id || !sceneById.has(s.scene_id));
  if (loose.length) groups.push({ scene: null, shots: loose });

  const thumb = (s: ShotWithStoryboard) => {
    if (hasDrawing(s.storyboard_drawing)) return `<img src="${drawingToDataUrl(s.storyboard_drawing, 480)}" alt="">`;
    if (s.storyboard_url) return `<img src="${esc(s.storyboard_url)}" alt="">`;
    return '<div class="nothumb"></div>';
  };

  const notes = (s: ShotWithStoryboard) => [
    s.camera_notes && `<div><b>Cam</b> ${esc(s.camera_notes)}</div>`,
    s.lighting_notes && `<div><b>Light</b> ${esc(s.lighting_notes)}</div>`,
    s.sound_notes && `<div><b>Sound</b> ${esc(s.sound_notes)}</div>`,
    s.vfx_required && `<div><b>VFX</b> ${esc(s.vfx_notes || 'Yes')}</div>`,
  ].filter(Boolean).join('');

  const body = groups.map((g) => `
    <tbody>
      <tr class="scene"><td colspan="${withThumbnails ? 9 : 8}">
        ${g.scene ? `<b>Scene ${esc(g.scene.scene_number || '?')}</b> &nbsp; ${esc(g.scene.scene_heading || [g.scene.location_type, g.scene.location_name, g.scene.time_of_day].filter(Boolean).join(' · ').toUpperCase())}` : '<b>Unassigned shots</b>'}
        <span class="count">${g.shots.length} shot${g.shots.length === 1 ? '' : 's'}</span>
      </td></tr>
      ${g.shots.map((s) => `
      <tr>
        <td class="chk"><span class="box">${s.is_completed ? '✓' : ''}</span></td>
        <td class="num">${esc(s.shot_number || '')}</td>
        ${withThumbnails ? `<td class="thumb">${thumb(s)}</td>` : ''}
        <td>${esc(label(s.shot_type))}</td>
        <td>${esc(label(s.shot_movement))}</td>
        <td>${esc(s.lens || '')}</td>
        <td class="dur">${s.duration_seconds ? `${s.duration_seconds}s` : ''}</td>
        <td class="desc">${esc(s.description || '')}${s.dialogue_ref ? `<div class="dlg">“${esc(s.dialogue_ref)}”</div>` : ''}<div class="notes">${notes(s)}</div></td>
        <td class="takes">${s.takes_completed || 0}/${s.takes_needed || 1}</td>
      </tr>`).join('')}
    </tbody>`).join('');

  const dateStr = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${esc(projectTitle)} — Shot List</title>
<style>
  @page { size: A4 landscape; margin: 14mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #111; background: #fff; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6pt; margin-bottom: 8pt; }
  h1 { font-size: 15pt; font-weight: 900; letter-spacing: -0.3px; }
  .sub { color: #555; margin-top: 2pt; }
  .meta { text-align: right; color: #555; font-size: 8pt; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: .05em; color: #555; padding: 3pt 4pt; border-bottom: 1.5px solid #111; }
  td { padding: 4pt; vertical-align: top; border-bottom: .5px solid #ddd; }
  tbody { break-inside: auto; }
  tr { break-inside: avoid; }
  tr.scene td { background: #f3f4f6; border-top: 1px solid #111; padding: 5pt 4pt; font-size: 8.5pt; }
  tr.scene .count { float: right; color: #666; font-size: 7.5pt; }
  .chk { width: 18pt; } .box { display: inline-block; width: 10pt; height: 10pt; border: 1px solid #111; text-align: center; line-height: 9pt; font-size: 8pt; }
  .num { width: 30pt; font-weight: 800; }
  .thumb { width: 92pt; } .thumb img, .nothumb { width: 88pt; height: 49.5pt; object-fit: cover; border: .5px solid #999; display: block; }
  .dur, .takes { width: 34pt; font-variant-numeric: tabular-nums; }
  .desc { width: 46%; }
  .dlg { color: #555; font-style: italic; margin-top: 2pt; }
  .notes { color: #444; font-size: 7.5pt; margin-top: 2pt; } .notes b { font-size: 6.5pt; text-transform: uppercase; color: #777; margin-right: 2pt; }
  .foot { margin-top: 8pt; font-size: 7pt; color: #aaa; text-align: right; }
</style></head><body>
  <div class="head">
    <div><h1>${esc(projectTitle)}</h1><div class="sub">Shot List${subtitle ? ` — ${esc(subtitle)}` : ''}</div></div>
    <div class="meta"><div>${esc(dateStr)}</div><div>${shots.length} shot${shots.length === 1 ? '' : 's'} · ${shots.filter((s) => s.is_completed).length} done</div></div>
  </div>
  <table>
    <thead><tr><th></th><th>Shot</th>${withThumbnails ? '<th>Frame</th>' : ''}<th>Type</th><th>Movement</th><th>Lens</th><th>Dur</th><th>Description &amp; notes</th><th>Takes</th></tr></thead>
    ${body}
  </table>
  <div class="foot">Screenplay Studio — ${esc(projectTitle)}</div>
  ${PRINT_SCRIPT}
</body></html>`;
}

// ── Storyboard sheets ─────────────────────────────────────────────────

export interface SheetPage {
  kind: SheetKind;
  /** Printed code (0 for blank sheets, or when no code could be registered). */
  code: number;
  /** One entry per frame slot; null = empty slot. */
  frames: (ShotWithStoryboard | null)[];
  /** Scene the page belongs to, when pages are split by scene. */
  scene?: Scene | null;
}

/** Splits shots into pages of six, optionally starting each scene on a fresh page. */
export function paginateShots(shots: ShotWithStoryboard[], scenes: Scene[], pagePerScene: boolean): { scene: Scene | null; shots: (ShotWithStoryboard | null)[] }[] {
  const chunks = (list: ShotWithStoryboard[], scene: Scene | null) => {
    const out: { scene: Scene | null; shots: (ShotWithStoryboard | null)[] }[] = [];
    for (let i = 0; i < list.length; i += FRAMES_PER_PAGE) {
      const page: (ShotWithStoryboard | null)[] = list.slice(i, i + FRAMES_PER_PAGE);
      while (page.length < FRAMES_PER_PAGE) page.push(null);
      out.push({ scene, shots: page });
    }
    return out;
  };
  if (!pagePerScene) return chunks(shots, null);
  const sceneIds = new Set(scenes.map((s) => s.id));
  const pages = scenes.flatMap((scene) => chunks(shots.filter((s) => s.scene_id === scene.id), scene));
  return [...pages, ...chunks(shots.filter((s) => !s.scene_id || !sceneIds.has(s.scene_id)), null)];
}

function blankInfo(slot: FrameSlot): string {
  const { x, y, w } = slot.info;
  const fields = [['SHOT', 0, 0.3], ['SCENE', 0.34, 0.3], ['TYPE / MOVE', 0.68, 0.32]] as const;
  return [
    ...fields.map(([name, at, span]) => {
      const fx = x + w * at;
      return text(fx, y + 3.6, 2, name, 'fill="#6b7280" font-weight="700" letter-spacing="0.2"') + hline(fx + name.length * 1.25 + 1.5, fx + w * span - 1.5, y + 4.2);
    }),
    hline(x, x + w, y + 10.2),
    hline(x, x + w, y + 15.7),
    hline(x, x + w, y + 21.2),
  ].join('');
}

function shotInfo(slot: FrameSlot, shot: ShotWithStoryboard, scene: Scene | null | undefined, kind: SheetKind): string {
  const { x, y, w } = slot.info;
  const num = shot.shot_number || '—';
  const numW = Math.max(6, num.length * 2.6 + 2);
  const parts = [
    text(x, y + 4.2, 4, num, 'font-weight="900"'),
    ...wrap(shotHeadline(shot, scene), w - numW, 2.5, 1).map((l) => text(x + numW, y + 3.9, 2.5, l, 'font-weight="700"')),
  ];
  const heading = scene?.scene_heading || [scene?.location_type, scene?.location_name].filter(Boolean).join(' ');
  if (heading) parts.push(...wrap(heading.toUpperCase(), w, 2, 1).map((l) => text(x, y + 7.6, 2, l, 'fill="#6b7280"')));
  const desc = wrap(shot.description || '', w, 2.5, 2);
  desc.forEach((l, i) => parts.push(text(x, y + 11.4 + i * 3.3, 2.5, l)));
  let lineY = desc.length ? 11.4 + desc.length * 3.3 + 1.6 : 12;
  if (kind === 'drawn' && shot.storyboard_notes) {
    for (const l of wrap(shot.storyboard_notes, w, 2.2, 1)) parts.push(text(x, y + lineY + 1.4, 2.2, l, 'fill="#374151" font-style="italic"'));
    lineY += 4;
  }
  for (let ly = lineY + 3; ly <= 24; ly += 5) parts.push(hline(x, x + w, y + ly));
  return parts.join('');
}

function frameArt(slot: FrameSlot, shot: ShotWithStoryboard, pageIdx: number): string {
  const r = slot.image;
  const clip = `clip-${pageIdx}-${slot.index}`;
  const layers: string[] = [];
  if (shot.storyboard_url) layers.push(`<image href="${esc(shot.storyboard_url)}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="xMidYMid slice"/>`);
  if (hasDrawing(shot.storyboard_drawing)) {
    // A transparent-background render would be nicer over a photo, but the white render matches the site.
    layers.push(`<image href="${drawingToDataUrl(shot.storyboard_drawing)}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="none"${shot.storyboard_url ? ' style="mix-blend-mode:multiply"' : ''}/>`);
  }
  if (!layers.length) return '';
  return `<clipPath id="${clip}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/></clipPath><g clip-path="url(#${clip})">${layers.join('')}</g>`;
}

const KIND_TITLE: Record<SheetKind, string> = {
  blank: 'Storyboard',
  shotlist: 'Storyboard — shot list',
  drawn: 'Storyboard',
};

function sheetSvg(page: SheetPage, pageIdx: number, pageCount: number, projectTitle: string, sceneById: Map<string, Scene>): string {
  const regs = registrationRects(page.kind, page.code).map((r) => rectSvg(r)).join('');
  const header = [
    text(30, 17.5, 5, projectTitle || 'Untitled', 'font-weight="900" letter-spacing="-0.1"'),
    text(30, 23.5, 2.8, [KIND_TITLE[page.kind], page.scene ? `Scene ${page.scene.scene_number || '?'}${page.scene.scene_heading ? ` — ${page.scene.scene_heading}` : ''}` : null].filter(Boolean).join(' · '), 'fill="#4b5563"'),
    page.kind === 'blank'
      ? text(267, 17.5, 2.6, 'DATE ____________   PAGE ______', 'text-anchor="end" fill="#6b7280" font-weight="700"')
      : text(267, 17.5, 2.6, new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }), 'text-anchor="end" fill="#6b7280"'),
    page.kind !== 'blank' ? text(267, 23.5, 2.6, `Page ${pageIdx + 1} of ${pageCount}`, 'text-anchor="end" fill="#6b7280"') : '',
  ].join('');

  const frames = FRAME_SLOTS.map((slot) => {
    const shot = page.frames[slot.index] || null;
    const art = shot && page.kind === 'drawn' ? frameArt(slot, shot, pageIdx) : '';
    const info = shot ? shotInfo(slot, shot, shot.scene_id ? sceneById.get(shot.scene_id) : null, page.kind) : blankInfo(slot);
    return art + rectSvg(slot.image, 'fill="none" stroke="#111" stroke-width="0.35"') + info;
  }).join('');

  const strip = [
    rectSvg(CODE_BOX, 'fill="none" stroke="#111" stroke-width="0.25"'),
    text(CODE_X + CODE_BOX.w + 2, CODE_Y + CODE_CELL - 0.6, 2.4,
      `${page.code ? formatSheetCode(page.code) : 'BLANK TEMPLATE'} · Scan this page in Screenplay Studio → Storyboard → Scan`, 'fill="#6b7280"'),
  ].join('');

  return `<svg class="page" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}mm" height="${PAGE_H}mm" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#111">
    <rect width="${PAGE_W}" height="${PAGE_H}" fill="#fff"/>
    ${regs}${header}${frames}${strip}
  </svg>`;
}

export function buildSheetsHtml(pages: SheetPage[], projectTitle: string, scenes: Scene[]): string {
  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const svgs = pages.map((p, i) => sheetSvg(p, i, pages.length, projectTitle, sceneById)).join('');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${esc(projectTitle)} — Storyboard sheets</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #e5e7eb; }
  .bar { font: 13px system-ui, sans-serif; color: #374151; padding: 12px 16px; display: flex; gap: 12px; align-items: center; justify-content: center; flex-wrap: wrap; }
  .bar button { font: inherit; padding: 6px 14px; border-radius: 6px; border: 0; background: #111; color: #fff; cursor: pointer; }
  .page { display: block; margin: 0 auto 16px; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.15); width: calc(100vw - 32px); max-width: 297mm; height: auto; }
  @media print {
    html, body { background: #fff; }
    .bar { display: none; }
    .page { margin: 0; box-shadow: none; width: 297mm; height: 210mm; break-after: page; page-break-after: always; }
    .page:last-of-type { break-after: auto; page-break-after: auto; }
  }
</style></head><body>
  <div class="bar">
    <span>Print at 100% / “Actual size” on A4 landscape (fit-to-page also works). Keep the four corner marks visible.</span>
    <button onclick="window.print()">Print</button>
  </div>
  ${svgs}
  ${PRINT_SCRIPT}
</body></html>`;
}
