'use client';

import { useState, useCallback } from 'react';
import { ConverterLayout } from '../converter-layout';
import { parseFountain } from '@/lib/scripts/fountain';
import { parseFDX } from '@/lib/scripts/fdx';
import { parsePDF } from '@/lib/scripts/pdf';

interface PageStats {
  totalPages: number;
  totalElements: number;
  sceneCount: number;
  characterCount: number;
  estimatedMinutes: number;
  wordCount: number;
  dialoguePages: number;
  actionPages: number;
}

export default function PageCountPage() {
  const [stats, setStats] = useState<PageStats | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const analyzeFile = useCallback(async (file: File) => {
    setError(null);
    setStats(null);
    setFileName(file.name);

    try {
      const ext = file.name.toLowerCase().split('.').pop();
      let elements: { content: string; element_type: string }[] = [];

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

      // Calculate stats
      const sceneHeadings = elements.filter(e => e.element_type === 'scene_heading');
      const characters = new Set(elements.filter(e => e.element_type === 'character').map(e => e.content?.toUpperCase().trim()));
      const dialogueElements = elements.filter(e => e.element_type === 'dialogue' || e.element_type === 'parenthetical');
      const actionElements = elements.filter(e => e.element_type === 'action' || e.element_type === 'scene_heading' || e.element_type === 'transition');

      const totalWords = elements.reduce((sum, e) => sum + (e.content?.split(/\s+/).length || 0), 0);

      // Rough page estimation: ~250 words per screenplay page
      // More accurate: weight by element type
      const dialogueWords = dialogueElements.reduce((sum, e) => sum + (e.content?.split(/\s+/).length || 0), 0);
      const actionWords = actionElements.reduce((sum, e) => sum + (e.content?.split(/\s+/).length || 0), 0);

      // Dialogue-heavy pages tend to be shorter (~200 words/page)
      // Action-heavy pages tend to be longer (~300 words/page)
      const dialoguePages = dialogueWords / 200;
      const actionPages = actionWords / 300;
      const totalPages = Math.max(1, Math.ceil(dialoguePages + actionPages));

      setStats({
        totalPages,
        totalElements: elements.length,
        sceneCount: sceneHeadings.length,
        characterCount: characters.size,
        estimatedMinutes: totalPages, // 1 page ≈ 1 minute
        wordCount: totalWords,
        dialoguePages: Math.round(dialoguePages * 10) / 10,
        actionPages: Math.round(actionPages * 10) / 10,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    }
  }, []);

  return (
    <ConverterLayout title="Page Count Calculator" description="Estimate screenplay page count and runtime from your script file">
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

        {stats && (
          <div className="w-full max-w-lg">
            <p className="text-xs text-muted-foreground mb-4 text-center">Analyzed: {fileName}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatCard label="Pages" value={stats.totalPages.toString()} sub="est." />
              <StatCard label="Runtime" value={`~${stats.estimatedMinutes} min`} sub="1pg ≈ 1min" />
              <StatCard label="Scenes" value={stats.sceneCount.toString()} />
              <StatCard label="Characters" value={stats.characterCount.toString()} />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <StatCard label="Words" value={stats.wordCount.toLocaleString()} />
              <StatCard label="Elements" value={stats.totalElements.toLocaleString()} />
              <StatCard label="Dialogue Pages" value={stats.dialoguePages.toString()} />
              <StatCard label="Action Pages" value={stats.actionPages.toString()} />
            </div>

            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Industry Standard</p>
              <p className="text-2xl font-light text-foreground">
                {stats.totalPages} pages = ~{stats.estimatedMinutes} minutes of screen time
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                One screenplay page ≈ one minute of screen time (industry rule of thumb)
              </p>
            </div>
          </div>
        )}
      </div>
    </ConverterLayout>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-medium text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
