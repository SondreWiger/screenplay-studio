'use client';

import { useState, useCallback } from 'react';
import { ConverterLayout } from '../converter-layout';
import { UploadZone, StatBox, GhostButton } from '../shared';
import { parseFountain } from '@/lib/scripts/fountain';
import { parseFDX } from '@/lib/scripts/fdx';
import { parsePDF } from '@/lib/scripts/pdf';

interface SceneInfo { number: string; heading: string; location: string; timeOfDay: string; wordCount: number; pageEstimate: string; }

export default function SceneListPage() {
  const [scenes, setScenes] = useState<SceneInfo[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (file: File) => {
    setError(null); setScenes([]); setFileName(file.name);
    try {
      const ext = file.name.toLowerCase().split('.').pop();
      let elements: { content: string; element_type: string; scene_number?: string | null }[] = [];
      if (ext === 'pdf') { elements = (await parsePDF(file)).elements; }
      else if (ext === 'fdx') { elements = (await parseFDX(await file.text())).elements; }
      else if (ext === 'fountain' || ext === 'txt') { elements = (await parseFountain(await file.text())).elements; }
      else { setError('Unsupported file. Use PDF, FDX, or Fountain.'); return; }

      const list: SceneInfo[] = [];
      let cur: SceneInfo | null = null; let n = 0;
      for (const el of elements) {
        if (el.element_type === 'scene_heading') {
          if (cur) list.push(cur); n++;
          const h = el.content || '';
          const m = h.match(/^(INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[\.\s]*(.+)/i);
          const loc = m ? m[2].trim() : h;
          const tM = loc.match(/[-–]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|CONTINUOUS|LATER)$/i);
          cur = { number: el.scene_number || String(n), heading: h, location: tM ? loc.replace(/\s*[-–]\s*$/, '').trim() : loc, timeOfDay: tM ? tM[1] : '', wordCount: h.split(/\s+/).length, pageEstimate: '' };
        } else if (cur) { cur.wordCount += (el.content?.split(/\s+/).length || 0); }
      }
      if (cur) list.push(cur);
      for (const s of list) { const p = s.wordCount / 250; s.pageEstimate = p < 0.1 ? '< 0.1' : p.toFixed(1); }
      setScenes(list);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to analyze file'); }
  }, []);

  const download = () => {
    const lines = [
      `SCENE LIST`, `${'═'.repeat(80)}`, `File: ${fileName}`, `Scenes: ${scenes.length}`, '',
      `${'#'.padStart(4)}  ${'Scene Heading'.padEnd(50)} ${'Pages'.padStart(6)}`, `${'─'.repeat(64)}`,
    ];
    for (const s of scenes) lines.push(`${s.number.padStart(4)}  ${s.heading.padEnd(50).slice(0, 50)} ${s.pageEstimate.padStart(6)}`);
    lines.push('', `${'─'.repeat(64)}`, `TOTAL: ${scenes.length} scenes, ~${scenes.reduce((s, sc) => s + parseFloat(sc.pageEstimate || '0'), 0).toFixed(1)} pages`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `scene_list_${fileName.replace(/\.[^.]+$/, '')}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ConverterLayout title="Scene List" description="Extract and list every scene from your screenplay with word counts and page estimates.">
      <div className="flex flex-col items-center gap-8">
        <div className="w-full max-w-lg">
          <UploadZone onFile={analyze} accept=".pdf,.fdx,.fountain,.txt" label="Drop a script file or click to browse" sublabel="PDF, FDX, Fountain, or .txt" />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {scenes.length > 0 && (
          <div className="w-full max-w-3xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-1 rounded-full bg-brand-500" />
                <span className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/25 font-mono">{scenes.length} SCENES — {fileName}</span>
              </div>
              <GhostButton onClick={download}>Download List</GhostButton>
            </div>
            <div className="border border-white/6">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/6">
                    {['#', 'Scene Heading', 'Location', 'Time', 'Words', 'Pages'].map(h => (
                      <th key={h} className={`text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 font-mono px-4 py-3 ${['Words', 'Pages'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scenes.map(s => (
                    <tr key={s.number} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5 text-white/30 font-mono">{s.number}</td>
                      <td className="px-4 py-2.5 text-white/50 font-mono text-[11px]">{s.heading}</td>
                      <td className="px-4 py-2.5 text-white/30 text-[11px] truncate max-w-[200px]">{s.location}</td>
                      <td className="px-4 py-2.5 text-white/30 text-[11px]">{s.timeOfDay}</td>
                      <td className="px-4 py-2.5 text-right text-white/30 font-mono">{s.wordCount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-white/30 font-mono">{s.pageEstimate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Scenes" value={scenes.length.toString()} />
              <StatBox label="Words" value={scenes.reduce((s, sc) => s + sc.wordCount, 0).toLocaleString()} />
              <StatBox label="Pages" value={scenes.reduce((s, sc) => s + parseFloat(sc.pageEstimate || '0'), 0).toFixed(1)} />
            </div>
          </div>
        )}
      </div>
    </ConverterLayout>
  );
}
