'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Scene } from '@/lib/types';
import { hasDrawing, type ShotWithStoryboard } from './engine';
import { FRAMES_PER_PAGE } from '@/lib/storyboard-print/layout';
import {
  buildSheetsHtml, buildShotListHtml, openPrintWindow, paginateShots, writePrintDocument, type SheetPage,
} from '@/lib/storyboard-print/print';
import { registerSheets } from '@/lib/storyboard-print/sheets';

export type PrintOption = 'shotlist' | 'template-shots' | 'template-blank' | 'drawn';

const OPTIONS: { value: PrintOption; title: string; body: string }[] = [
  { value: 'shotlist', title: 'Shot list', body: 'A table of every shot, grouped by scene, with tick boxes for set.' },
  { value: 'template-shots', title: 'Storyboard template — from the shot list', body: 'Empty frames to draw in, each labelled with its shot number, scene and description.' },
  { value: 'template-blank', title: 'Storyboard template — blank', body: 'Empty frames with lines underneath to write the shot details by hand.' },
  { value: 'drawn', title: 'Storyboard as drawn', body: 'The frames as they look on the site, with their shot details.' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  userId: string | null;
  scenes: Scene[];
  shots: ShotWithStoryboard[];
  /** Scene filter active on the page ('all' or a scene id). */
  sceneFilter?: string;
  defaultOption?: PrintOption;
}

export function StoryboardPrintDialog({ isOpen, onClose, projectId, projectTitle, userId, scenes, shots, sceneFilter = 'all', defaultOption = 'shotlist' }: Props) {
  const [option, setOption] = useState<PrintOption>(defaultOption);
  const [scope, setScope] = useState(sceneFilter);
  const [withThumbs, setWithThumbs] = useState(false);
  const [pagePerScene, setPagePerScene] = useState(true);
  const [onlyDrawn, setOnlyDrawn] = useState(true);
  const [blankPages, setBlankPages] = useState(2);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setOption(defaultOption);
    setScope(sceneFilter);
  }, [isOpen, defaultOption, sceneFilter]);

  const scoped = useMemo(() => (scope === 'all' ? shots : shots.filter((s) => s.scene_id === scope)), [shots, scope]);
  const drawnCount = useMemo(() => scoped.filter((s) => hasDrawing(s.storyboard_drawing) || s.storyboard_url).length, [scoped]);
  const scopedScenes = scope === 'all' ? scenes : scenes.filter((s) => s.id === scope);
  const sceneTitle = scope === 'all' ? undefined : (() => {
    const s = scenes.find((x) => x.id === scope);
    return s ? `Scene ${s.scene_number || '?'}${s.scene_heading ? ` — ${s.scene_heading}` : ''}` : undefined;
  })();

  const sheetShots = option === 'drawn' && onlyDrawn ? scoped.filter((s) => hasDrawing(s.storyboard_drawing) || s.storyboard_url) : scoped;
  const pageCount = option === 'template-blank'
    ? blankPages
    : option === 'shotlist' ? null : paginateShots(sheetShots, scopedScenes, pagePerScene).length;

  const needsShots = option !== 'template-blank';
  const nothing = needsShots && (option === 'drawn' ? sheetShots.length === 0 : scoped.length === 0);

  const handlePrint = async () => {
    // The window must open inside the click, before any await, or it gets blocked.
    const win = openPrintWindow();
    if (!win) {
      toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
      return;
    }
    setBusy(true);
    try {
      if (option === 'shotlist') {
        writePrintDocument(win, buildShotListHtml({ projectTitle, scenes: scopedScenes, shots: scoped, withThumbnails: withThumbs, subtitle: sceneTitle }));
      } else if (option === 'template-blank') {
        const pages: SheetPage[] = Array.from({ length: blankPages }, () => ({ kind: 'blank', code: 0, frames: Array(FRAMES_PER_PAGE).fill(null) }));
        writePrintDocument(win, buildSheetsHtml(pages, projectTitle, scenes));
      } else {
        const kind = option === 'drawn' ? 'drawn' : 'shotlist';
        const layout = paginateShots(sheetShots, scopedScenes, pagePerScene);
        const codes = await registerSheets(projectId, kind, layout.map((p) => p.shots.map((s) => s?.id ?? null)), userId);
        if (!codes) {
          toast.warning('Printed without page codes — scans of these pages will need their frames matched by hand.');
        }
        const pages: SheetPage[] = layout.map((p, i) => ({ kind, code: codes?.[i] || 0, frames: p.shots, scene: p.scene }));
        // Pages without a code scan like blank ones; mark them so the printed kind matches.
        pages.forEach((p) => { if (!p.code) p.kind = kind === 'drawn' ? 'drawn' : 'blank'; });
        writePrintDocument(win, buildSheetsHtml(pages, projectTitle, scenes));
      }
      onClose();
    } catch (err) {
      console.error('Print:', err);
      win.close();
      toast.error('Couldn’t prepare the printout.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Print" size="lg">
      <div className="space-y-5">
        <div className="grid gap-2" role="radiogroup" aria-label="What to print">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors',
                option === o.value ? 'border-brand-500 bg-brand-500/10' : 'border-surface-700 hover:border-surface-600'
              )}
            >
              <input type="radio" name="print-option" className="mt-1" checked={option === o.value} onChange={() => setOption(o.value)} />
              <span>
                <span className="block text-sm font-medium text-white">{o.title}</span>
                <span className="block text-xs text-surface-400 mt-0.5">{o.body}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {needsShots && (
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5" htmlFor="print-scope">Scenes</label>
              <select
                id="print-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white"
              >
                <option value="all">All scenes ({shots.length} shots)</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>Scene {s.scene_number || '?'} — {s.scene_heading || s.location_name || 'Untitled'}</option>
                ))}
              </select>
            </div>
          )}
          {option === 'template-blank' && (
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5" htmlFor="print-pages">Pages</label>
              <input
                id="print-pages"
                type="number"
                min={1}
                max={50}
                value={blankPages}
                onChange={(e) => setBlankPages(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white"
              />
            </div>
          )}
          <div className="space-y-2 self-end">
            {option === 'shotlist' && (
              <Check checked={withThumbs} onChange={setWithThumbs} label="Include storyboard frames" />
            )}
            {(option === 'template-shots' || option === 'drawn') && scope === 'all' && (
              <Check checked={pagePerScene} onChange={setPagePerScene} label="Start each scene on a new page" />
            )}
            {option === 'drawn' && (
              <Check checked={onlyDrawn} onChange={setOnlyDrawn} label="Only shots that have a frame" />
            )}
          </div>
        </div>

        {option !== 'shotlist' && (
          <p className="text-xs text-surface-400 leading-relaxed">
            Six 16:9 frames per A4 landscape page. The corner marks and the code strip let you scan
            drawn pages back in with <span className="text-surface-200">Storyboard → Scan</span>
            {option === 'template-blank' ? ' — you pick which shot each frame belongs to.' : ' — every frame lands on its own shot.'}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-4 border-t border-surface-800">
          <span className="text-xs text-surface-500">
            {nothing
              ? (option === 'drawn' ? 'No drawn frames in this selection.' : 'No shots in this selection.')
              : pageCount != null
                ? `${pageCount} page${pageCount === 1 ? '' : 's'}${option === 'drawn' ? ` · ${drawnCount} drawn frame${drawnCount === 1 ? '' : 's'}` : ''}`
                : `${scoped.length} shot${scoped.length === 1 ? '' : 's'}`}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handlePrint} loading={busy} disabled={nothing}>Print</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
