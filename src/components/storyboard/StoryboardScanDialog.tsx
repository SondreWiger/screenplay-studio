'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Badge, Button, Modal, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Scene } from '@/lib/types';
import type { ShotWithStoryboard } from './engine';
import { StoryboardThumb } from './StoryboardThumb';
import { formatSheetCode, parseSheetCode, type SheetKind } from '@/lib/storyboard-print/layout';
import {
  EMPTY_FRAME_COVERAGE, detectSheet, extractFrames, vectorizeFrame,
  type RGBAImage, type VectorizeResult,
} from '@/lib/storyboard-print/scan';
import { decodeScanFiles, nextFrame, rgbaToDataUrl } from '@/lib/storyboard-print/scan-browser';
import { lookupSheet } from '@/lib/storyboard-print/sheets';
import { planScanImport, saveShotStoryboard, type ShotStoryboardPatch } from '@/lib/storyboard-print/versions';

interface FrameState {
  index: number;
  image: RGBAImage;
  photoUrl: string;
  infoUrl: string;
  result: VectorizeResult;
  empty: boolean;
  shotId: string | null;
  /** True when the shot came from the printed sheet rather than a guess. */
  fromSheet: boolean;
  include: boolean;
  showPhoto: boolean;
}

interface PageState {
  name: string;
  kind: SheetKind;
  code: number;
  codeOk: boolean;
  sheetFound: boolean;
  frames: FrameState[];
}

interface Failed { name: string; reason: string }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  userId: string | null;
  scenes: Scene[];
  shots: ShotWithStoryboard[];
  onShotPatched: (shotId: string, patch: Partial<ShotWithStoryboard>) => void;
}

export function StoryboardScanDialog({ isOpen, onClose, projectId, userId, scenes, shots, onShotPatched }: Props) {
  const [step, setStep] = useState<'pick' | 'working' | 'review'>('pick');
  const [progress, setProgress] = useState('');
  const [pages, setPages] = useState<PageState[]>([]);
  const [failed, setFailed] = useState<Failed[]>([]);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [makeCurrent, setMakeCurrent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const shotById = useMemo(() => new Map(shots.map((s) => [s.id, s])), [shots]);
  const sceneById = useMemo(() => new Map(scenes.map((s) => [s.id, s])), [scenes]);
  const shotLabel = useCallback((s: ShotWithStoryboard) => {
    const sc = s.scene_id ? sceneById.get(s.scene_id) : null;
    return `${s.shot_number || '#'}${sc ? ` · Sc ${sc.scene_number || '?'}` : ''}${s.description ? ` — ${s.description.slice(0, 40)}` : ''}`;
  }, [sceneById]);

  const reset = () => {
    setStep('pick');
    setPages([]);
    setFailed([]);
    setProgress('');
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const processFiles = async (files: File[]) => {
    if (!files.length) return;
    setStep('working');
    setProgress('Reading files…');
    await nextFrame();
    const out: PageState[] = [];
    const bad: Failed[] = [];
    try {
      const sources = await decodeScanFiles(files);
      for (let p = 0; p < sources.length; p++) {
        const src = sources[p];
        const tag = sources.length > 1 ? `Page ${p + 1} of ${sources.length}: ` : '';
        setProgress(`${tag}finding the corner marks…`);
        await nextFrame();
        const det = detectSheet(src.image);
        if (!det) {
          bad.push({ name: src.name, reason: 'Couldn’t find all four corner marks. Make sure the whole page is in the picture.' });
          continue;
        }
        const sheet = det.codeOk && det.code ? await lookupSheet(projectId, det.code) : null;
        const cut = extractFrames(src.image, det);
        const frames: FrameState[] = [];
        for (const f of cut) {
          setProgress(`${tag}tracing frame ${f.index + 1} of ${cut.length}…`);
          await nextFrame();
          const result = vectorizeFrame(f.image, sensitivity);
          const sheetShot = sheet?.frames[f.index] || null;
          const shotId = sheetShot && shotById.has(sheetShot) ? sheetShot : null;
          const empty = result.coverage < EMPTY_FRAME_COVERAGE || result.strokeCount === 0;
          frames.push({
            index: f.index,
            image: f.image,
            photoUrl: rgbaToDataUrl(downscale(f.image, 480)),
            infoUrl: rgbaToDataUrl(f.info),
            result,
            empty,
            shotId,
            fromSheet: !!shotId,
            include: !empty && !!shotId,
            showPhoto: false,
          });
        }
        out.push({ name: src.name, kind: det.kind, code: det.code, codeOk: det.codeOk, sheetFound: !!sheet, frames });
      }
    } catch (err) {
      console.error('Scan:', err);
      bad.push({ name: files.map((f) => f.name).join(', '), reason: err instanceof Error ? err.message : 'Couldn’t read the file.' });
    }
    setPages(out);
    setFailed(bad);
    setStep(out.length || bad.length ? 'review' : 'pick');
  };

  const updateFrame = (p: number, f: number, patch: Partial<FrameState>) =>
    setPages((prev) => prev.map((pg, i) => (i !== p ? pg : { ...pg, frames: pg.frames.map((fr, j) => (j === f ? { ...fr, ...patch } : fr)) })));

  /** Picking a shot also suggests the following shots for the next unassigned drawn frames. */
  const assign = (p: number, f: number, shotId: string | null) => {
    setPages((prev) => prev.map((pg, i) => {
      if (i !== p) return pg;
      const frames = pg.frames.map((fr) => ({ ...fr }));
      frames[f] = { ...frames[f], shotId, fromSheet: false, include: !!shotId && !frames[f].empty };
      if (shotId) {
        let at = shots.findIndex((s) => s.id === shotId);
        for (let k = f + 1; k < frames.length && at >= 0; k++) {
          if (frames[k].empty || frames[k].shotId) continue;
          at++;
          if (at >= shots.length) break;
          frames[k] = { ...frames[k], shotId: shots[at].id, include: true };
        }
      }
      return { ...pg, frames };
    }));
  };

  const retrace = async (value: number) => {
    setSensitivity(value);
    setStep('working');
    setProgress('Re-tracing with the new sensitivity…');
    await nextFrame();
    const next: PageState[] = [];
    for (const pg of pages) {
      const frames: FrameState[] = [];
      for (const fr of pg.frames) {
        await nextFrame();
        const result = vectorizeFrame(fr.image, value);
        const empty = result.coverage < EMPTY_FRAME_COVERAGE || result.strokeCount === 0;
        frames.push({ ...fr, result, empty, include: fr.include && !empty });
      }
      next.push({ ...pg, frames });
    }
    setPages(next);
    setStep('review');
  };

  const enterCode = async (p: number) => {
    const raw = window.prompt('Type the code printed next to the strip at the bottom of the page (e.g. SB-000123):');
    if (raw == null) return;
    const code = parseSheetCode(raw);
    if (!code) { toast.error('That doesn’t look like a sheet code.'); return; }
    const sheet = await lookupSheet(projectId, code);
    if (!sheet) { toast.error(`No sheet ${formatSheetCode(code)} in this project.`); return; }
    setPages((prev) => prev.map((pg, i) => i !== p ? pg : {
      ...pg,
      code,
      kind: sheet.kind,
      sheetFound: true,
      frames: pg.frames.map((fr) => {
        const id = sheet.frames[fr.index];
        return id && shotById.has(id) ? { ...fr, shotId: id, fromSheet: true, include: !fr.empty } : fr;
      }),
    }));
  };

  const selected = pages.flatMap((pg) => pg.frames.filter((f) => f.include && f.shotId && !f.empty).map((f) => ({ pg, f })));

  const apply = async () => {
    if (!selected.length) return;
    setSaving(true);
    // Several frames can target one shot; fold them in order so each becomes a version.
    const working = new Map<string, ShotWithStoryboard>();
    const patches = new Map<string, ShotStoryboardPatch>();
    for (const { pg, f } of selected) {
      const shot = working.get(f.shotId!) || shotById.get(f.shotId!);
      if (!shot) continue;
      const patch = planScanImport(shot, f.result.layers, {
        makeCurrent,
        userId,
        sheetCode: pg.code || undefined,
        label: `Scan ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}${pg.code ? ` · ${formatSheetCode(pg.code)}` : ''}`,
      });
      working.set(shot.id, { ...shot, ...patch });
      patches.set(shot.id, { ...(patches.get(shot.id) || {}), ...patch });
    }
    let ok = 0;
    let lastError = '';
    for (const [shotId, patch] of Array.from(patches)) {
      try {
        await saveShotStoryboard(shotId, patch);
        onShotPatched(shotId, patch as Partial<ShotWithStoryboard>);
        ok++;
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Save failed';
      }
    }
    setSaving(false);
    if (lastError) toast.error(lastError);
    if (ok) {
      toast.success(`Scanned ${selected.length} frame${selected.length === 1 ? '' : 's'} into ${ok} shot${ok === 1 ? '' : 's'}.`);
      reset();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Scan storyboard pages" size="xl">
      {step === 'pick' && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); processFiles(Array.from(e.dataTransfer.files)); }}
            className={cn(
              'rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
              dragOver ? 'border-brand-500 bg-brand-500/10' : 'border-surface-700'
            )}
          >
            <p className="text-sm text-surface-200 font-medium">Drop photos or scans of printed storyboard pages</p>
            <p className="text-xs text-surface-500 mt-1">JPG, PNG, HEIC (Safari) or PDF · several pages at once is fine</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <Button size="sm" onClick={() => fileRef.current?.click()}>Choose files</Button>
              <Button size="sm" variant="secondary" onClick={() => cameraRef.current?.click()}>Take a photo</Button>
            </div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
              onChange={(e) => { processFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { processFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
          </div>
          <ul className="text-xs text-surface-400 space-y-1 list-disc pl-5">
            <li>Use sheets printed from <span className="text-surface-200">Print → Storyboard template</span>. All four corner marks need to be in the shot; the page can be at an angle or upside down.</li>
            <li>Shadows and warm light are fine — the drawing is separated from the paper and turned into editable lines.</li>
            <li>Pages printed from the shot list land on their shots automatically. On blank pages you pick the shot for each frame.</li>
          </ul>
        </div>
      )}

      {step === 'working' && (
        <div className="py-16 flex flex-col items-center gap-3 text-sm text-surface-300" aria-live="polite">
          <div className="w-6 h-6 border-2 border-surface-600 border-t-brand-500 rounded-full animate-spin" />
          {progress}
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-5">
          {failed.map((f) => (
            <div key={f.name} className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <b>{f.name}</b>: {f.reason}
            </div>
          ))}

          {pages.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg bg-surface-950 px-4 py-3">
              <label className="flex items-center gap-3 text-sm text-surface-300">
                Line sensitivity
                <input type="range" min={0} max={1} step={0.05} defaultValue={sensitivity}
                  onPointerUp={(e) => retrace(parseFloat((e.target as HTMLInputElement).value))}
                  onKeyUp={(e) => retrace(parseFloat((e.target as HTMLInputElement).value))}
                  aria-label="Line sensitivity — higher keeps fainter pencil" />
              </label>
              <label className="flex items-center gap-2 text-sm text-surface-300">
                <input type="checkbox" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} />
                Make scans the current frame (the old frame is kept as a version)
              </label>
            </div>
          )}

          <div className="max-h-[55vh] overflow-y-auto space-y-6 pr-1">
            {pages.map((pg, p) => (
              <section key={p}>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-white truncate max-w-[50%]">{pg.name}</span>
                  <Badge size="sm" variant="info">{pg.kind === 'blank' ? 'Blank template' : pg.kind === 'drawn' ? 'Printed board' : 'Shot-list template'}</Badge>
                  {pg.code > 0 && <Badge size="sm">{formatSheetCode(pg.code)}</Badge>}
                  {!pg.codeOk && <Badge size="sm" variant="warning">Code unreadable</Badge>}
                  {pg.code > 0 && !pg.sheetFound && <Badge size="sm" variant="warning">Sheet not in this project</Badge>}
                  {(!pg.codeOk || (pg.kind !== 'blank' && !pg.sheetFound)) && (
                    <button type="button" onClick={() => enterCode(p)} className="text-xs text-brand-400 hover:underline">Type the code</button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pg.frames.map((fr, f) => (
                    <div key={fr.index} className={cn('rounded-lg border overflow-hidden', fr.include ? 'border-brand-500/60' : 'border-surface-800', fr.empty && 'opacity-50')}>
                      <button type="button" className="block w-full relative" onClick={() => updateFrame(p, f, { showPhoto: !fr.showPhoto })} title="Show the photo / the traced lines">
                        {fr.showPhoto
                          ? <img src={fr.photoUrl} alt="" className="w-full aspect-video object-cover bg-white" />
                          : <StoryboardThumb drawing={fr.result.layers} emptyLabel="Empty frame" />}
                        <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                          {fr.index + 1} · {fr.showPhoto ? 'photo' : fr.empty ? 'empty' : `${fr.result.strokeCount} lines`}
                        </span>
                      </button>
                      <img src={fr.infoUrl} alt={`Notes under frame ${fr.index + 1}`} className="w-full bg-white border-t border-surface-800" />
                      <div className="p-2 space-y-1.5 bg-surface-950">
                        <select
                          value={fr.shotId || ''}
                          onChange={(e) => assign(p, f, e.target.value || null)}
                          disabled={fr.empty}
                          aria-label={`Shot for frame ${fr.index + 1}`}
                          className="w-full rounded-md border border-surface-700 bg-surface-900 px-2 py-1.5 text-xs text-white"
                        >
                          <option value="">{fr.empty ? 'Nothing drawn' : 'Choose shot…'}</option>
                          {shots.map((s) => <option key={s.id} value={s.id}>{shotLabel(s)}</option>)}
                        </select>
                        {!fr.empty && fr.shotId && (
                          <label className="flex items-center gap-2 text-[11px] text-surface-400">
                            <input type="checkbox" checked={fr.include} onChange={(e) => updateFrame(p, f, { include: e.target.checked })} />
                            Import{fr.fromSheet ? ' (from printed sheet)' : ''}
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-surface-800">
            <Button variant="ghost" onClick={reset} disabled={saving}>Scan other pages</Button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-surface-500">{selected.length} frame{selected.length === 1 ? '' : 's'} to import</span>
              <Button onClick={apply} loading={saving} disabled={!selected.length}>Import</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Nearest-neighbour shrink for the photo preview. */
function downscale(img: RGBAImage, width: number): RGBAImage {
  const height = Math.round((img.height * width) / img.width);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.floor((y * img.height) / height);
    for (let x = 0; x < width; x++) {
      const sx = Math.floor((x * img.width) / width);
      const o = (y * width + x) * 4;
      const i = (sy * img.width + sx) * 4;
      data[o] = img.data[i]; data[o + 1] = img.data[i + 1]; data[o + 2] = img.data[i + 2]; data[o + 3] = 255;
    }
  }
  return { data, width, height };
}
