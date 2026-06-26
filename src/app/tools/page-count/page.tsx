'use client';

import { useState, useCallback } from 'react';
import { ConverterLayout } from '../converter-layout';
import { UploadZone, StatBox } from '../shared';
import { parseFountain } from '@/lib/scripts/fountain';
import { parseFDX } from '@/lib/scripts/fdx';
import { parsePDF } from '@/lib/scripts/pdf';

interface PageStats {
  totalPages: number; sceneCount: number; characterCount: number;
  estimatedMinutes: number; wordCount: number; dialoguePages: number; actionPages: number;
}

export default function PageCountPage() {
  const [stats, setStats] = useState<PageStats | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (file: File) => {
    setError(null); setStats(null); setFileName(file.name);
    try {
      const ext = file.name.toLowerCase().split('.').pop();
      let elements: { content: string; element_type: string }[] = [];
      if (ext === 'pdf') { elements = (await parsePDF(file)).elements; }
      else if (ext === 'fdx') { elements = (await parseFDX(await file.text())).elements; }
      else if (ext === 'fountain' || ext === 'txt') { elements = (await parseFountain(await file.text())).elements; }
      else { setError('Unsupported file. Use PDF, FDX, or Fountain.'); return; }

      const scenes = elements.filter(e => e.element_type === 'scene_heading');
      const chars = new Set(elements.filter(e => e.element_type === 'character').map(e => e.content?.toUpperCase().trim()));
      const dialogueW = elements.filter(e => e.element_type === 'dialogue' || e.element_type === 'parenthetical').reduce((s, e) => s + (e.content?.split(/\s+/).length || 0), 0);
      const actionW = elements.filter(e => e.element_type === 'action' || e.element_type === 'scene_heading' || e.element_type === 'transition').reduce((s, e) => s + (e.content?.split(/\s+/).length || 0), 0);
      const totalW = elements.reduce((s, e) => s + (e.content?.split(/\s+/).length || 0), 0);
      const dpg = dialogueW / 200, apg = actionW / 300;
      const pages = Math.max(1, Math.ceil(dpg + apg));

      setStats({ totalPages: pages, sceneCount: scenes.length, characterCount: chars.size, estimatedMinutes: pages, wordCount: totalW, dialoguePages: Math.round(dpg * 10) / 10, actionPages: Math.round(apg * 10) / 10 });
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to analyze file'); }
  }, []);

  return (
    <ConverterLayout title="Page Count Calculator" description="Estimate screenplay page count and runtime from your script file.">
      <div className="flex flex-col items-center gap-8 max-w-lg mx-auto">
        <UploadZone onFile={analyze} accept=".pdf,.fdx,.fountain,.txt" label="Drop a script file or click to browse" sublabel="PDF, FDX, Fountain, or .txt" />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {stats && (
          <div className="w-full space-y-6">
            <p className="text-[10px] text-white/20 text-center font-mono uppercase tracking-widest">Analyzed: {fileName}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox label="Pages" value={stats.totalPages.toString()} sub="est." />
              <StatBox label="Runtime" value={`~${stats.estimatedMinutes}`} sub="minutes" />
              <StatBox label="Scenes" value={stats.sceneCount.toString()} />
              <StatBox label="Characters" value={stats.characterCount.toString()} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Words" value={stats.wordCount.toLocaleString()} />
              <StatBox label="Dialogue Pages" value={stats.dialoguePages.toString()} />
              <StatBox label="Action Pages" value={stats.actionPages.toString()} />
            </div>
            <div className="p-6 text-center bg-white/[0.02] border border-white/6">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 font-mono mb-2">INDUSTRY STANDARD</p>
              <p className="text-2xl font-black text-white" style={{ letterSpacing: '-0.02em' }}>{stats.totalPages} pages = ~{stats.estimatedMinutes} min</p>
              <p className="text-xs text-white/25 mt-2">One screenplay page ≈ one minute of screen time</p>
            </div>
          </div>
        )}
      </div>
    </ConverterLayout>
  );
}
