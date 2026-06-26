'use client';

import { useState, useCallback } from 'react';
import { ConverterLayout } from '../converter-layout';
import { parseFountain } from '@/lib/scripts/fountain';
import { parseFDX } from '@/lib/scripts/fdx';
import { parsePDF } from '@/lib/scripts/pdf';

interface SceneInfo {
  number: string;
  heading: string;
  location: string;
  timeOfDay: string;
  elementCount: number;
  wordCount: number;
  pageEstimate: string;
}

export default function SceneListPage() {
  const [scenes, setScenes] = useState<SceneInfo[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const analyzeFile = useCallback(async (file: File) => {
    setError(null);
    setScenes([]);
    setFileName(file.name);

    try {
      const ext = file.name.toLowerCase().split('.').pop();
      let elements: { content: string; element_type: string; scene_number?: string | null }[] = [];

      if (ext === 'pdf') {
        const result = await parsePDF(file);
        elements = result.elements;
      } else if (ext === 'fdx') {
        const text = await file.text();
        const result = parseFDX(text);
        elements = result.elements;
      } else if (ext === 'fountain' || ext === 'txt') {
        const text = await file.text();
        const result = parseFountain(text);
        elements = result.elements;
      } else {
        setError('Unsupported file format. Use PDF, FDX, or Fountain.');
        return;
      }

      // Extract scenes
      const sceneList: SceneInfo[] = [];
      let currentScene: SceneInfo | null = null;
      let sceneNum = 0;

      for (const el of elements) {
        if (el.element_type === 'scene_heading') {
          if (currentScene) sceneList.push(currentScene);
          sceneNum++;
          const heading = el.content || '';

          // Parse INT/EXT, location, and time of day
          const match = heading.match(/^(INT|EXT|EST|INT\.\/EXT|INT\/EXT|I\/E)[\.\s]*(.+)/i);
          const location = match ? match[2].trim() : heading;
          const timeMatch = location.match(/[-–]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|CONTINUOUS|LATER|MOMENTS LATER)$/i);
          const timeOfDay = timeMatch ? timeMatch[1] : '';
          const cleanLocation = timeOfDay ? location.replace(/\s*[-–]\s*$/, '').trim() : location;

          currentScene = {
            number: el.scene_number || String(sceneNum),
            heading: heading,
            location: cleanLocation,
            timeOfDay,
            elementCount: 1,
            wordCount: (heading.split(/\s+/).length),
            pageEstimate: '',
          };
        } else if (currentScene) {
          currentScene.elementCount++;
          currentScene.wordCount += (el.content?.split(/\s+/).length || 0);
        }
      }
      if (currentScene) sceneList.push(currentScene);

      // Estimate pages (~250 words per page)
      for (const s of sceneList) {
        const pages = s.wordCount / 250;
        s.pageEstimate = pages < 0.1 ? '< 0.1' : pages.toFixed(1);
      }

      setScenes(sceneList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    }
  }, []);

  const downloadList = () => {
    const lines = [
      `SCENE LIST`,
      `${'═'.repeat(80)}`,
      `File: ${fileName}`,
      `Total Scenes: ${scenes.length}`,
      '',
      `${'#'.padStart(4)}  ${'Scene Heading'.padEnd(50)} ${'Pages'.padStart(6)}`,
      `${'─'.repeat(64)}`,
    ];

    for (const s of scenes) {
      lines.push(
        `${s.number.padStart(4)}  ${s.heading.padEnd(50).slice(0, 50)} ${s.pageEstimate.padStart(6)}`
      );
    }

    lines.push('');
    lines.push(`${'─'.repeat(64)}`);
    lines.push(`TOTAL SCENES: ${scenes.length}`);
    lines.push(`EST. PAGES: ${scenes.reduce((s, sc) => s + parseFloat(sc.pageEstimate || '0'), 0).toFixed(1)}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scene_list_${fileName.replace(/\.[^.]+$/, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ConverterLayout title="Scene List" description="Extract and list all scenes from your screenplay with page estimates">
      <div className="flex flex-col items-center gap-8">
        {/* Upload */}
        <div
          className="w-full max-w-lg border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-foreground/20 transition-colors cursor-pointer"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const dropped = e.dataTransfer.files[0];
            if (dropped) analyzeFile(dropped);
          }}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.fdx,.fountain,.txt';
            input.onchange = (e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) analyzeFile(f);
            };
            input.click();
          }}
        >
          <p className="text-foreground font-medium">Drop a script file or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">PDF, FDX, Fountain, or .txt</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {scenes.length > 0 && (
          <div className="w-full max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted-foreground">
                {scenes.length} scenes found in {fileName}
              </p>
              <button
                onClick={downloadList}
                className="text-xs text-orange-500 hover:text-orange-600 underline underline-offset-4"
              >
                Download Scene List
              </button>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3 w-12">#</th>
                    <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3">Scene Heading</th>
                    <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3 w-24">Location</th>
                    <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3 w-20">Time</th>
                    <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3 w-16">Words</th>
                    <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3 w-16">Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {scenes.map((s) => (
                    <tr key={s.number} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-2 text-muted-foreground font-mono">{s.number}</td>
                      <td className="px-4 py-2 text-foreground font-mono text-xs">{s.heading}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs truncate max-w-[200px]">{s.location}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{s.timeOfDay}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground font-mono">{s.wordCount.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground font-mono">{s.pageEstimate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Total Scenes</p>
                <p className="text-lg font-medium text-foreground">{scenes.length}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Total Words</p>
                <p className="text-lg font-medium text-foreground">{scenes.reduce((s, sc) => s + sc.wordCount, 0).toLocaleString()}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Est. Pages</p>
                <p className="text-lg font-medium text-foreground">{scenes.reduce((s, sc) => s + parseFloat(sc.pageEstimate || '0'), 0).toFixed(1)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ConverterLayout>
  );
}
