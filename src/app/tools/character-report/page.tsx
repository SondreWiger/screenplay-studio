'use client';

import { useState, useCallback } from 'react';
import { ConverterLayout } from '../converter-layout';
import { parseFountain } from '@/lib/scripts/fountain';
import { parseFDX } from '@/lib/scripts/fdx';
import { parsePDF } from '@/lib/scripts/pdf';

interface CharacterStats {
  name: string;
  dialogueCount: number;
  totalWords: number;
  parentheticalCount: number;
  firstAppearance: number;
}

export default function CharacterReportPage() {
  const [characters, setCharacters] = useState<CharacterStats[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);

  const analyzeFile = useCallback(async (file: File) => {
    setError(null);
    setCharacters([]);
    setFileName(file.name);

    try {
      const ext = file.name.toLowerCase().split('.').pop();
      let elements: { content: string; element_type: string; sort_order: number }[] = [];

      if (ext === 'pdf') {
        const result = await parsePDF(file);
        elements = result.elements.map((e, i) => ({ ...e, sort_order: e.sort_order ?? i }));
      } else if (ext === 'fdx') {
        const text = await file.text();
        const result = parseFDX(text);
        elements = result.elements.map((e, i) => ({ ...e, sort_order: e.sort_order ?? i }));
      } else if (ext === 'fountain' || ext === 'txt') {
        const text = await file.text();
        const result = parseFountain(text);
        elements = result.elements.map((e, i) => ({ ...e, sort_order: e.sort_order ?? i }));
      } else {
        setError('Unsupported file format. Use PDF, FDX, or Fountain.');
        return;
      }

      setTotalElements(elements.length);

      // Build character stats
      const charMap = new Map<string, CharacterStats>();

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.element_type === 'character') {
          const name = el.content?.toUpperCase().trim() || '';
          if (!name) continue;

          if (!charMap.has(name)) {
            charMap.set(name, {
              name,
              dialogueCount: 0,
              totalWords: 0,
              parentheticalCount: 0,
              firstAppearance: i,
            });
          }

          const stats = charMap.get(name)!;
          stats.dialogueCount++;

          // Count following dialogue + parenthetical lines
          let j = i + 1;
          while (j < elements.length) {
            const next = elements[j];
            if (next.element_type === 'dialogue') {
              stats.totalWords += (next.content?.split(/\s+/).length || 0);
              j++;
            } else if (next.element_type === 'parenthetical') {
              stats.parentheticalCount++;
              j++;
            } else {
              break;
            }
          }

          i = j - 1; // Skip past dialogue block
        }
      }

      // Sort by dialogue count (most lines first)
      const sorted = Array.from(charMap.values()).sort((a, b) => b.dialogueCount - a.dialogueCount);
      setCharacters(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file');
    }
  }, []);

  const downloadReport = () => {
    const lines = [
      `CHARACTER REPORT`,
      `${'═'.repeat(60)}`,
      `File: ${fileName}`,
      `Total Elements: ${totalElements}`,
      `Characters Found: ${characters.length}`,
      '',
      `${'Character'.padEnd(25)} ${'Lines'.padStart(6)} ${'Words'.padStart(8)} ${'Par.}'.padStart(6)}`,
      `${'─'.repeat(48)}`,
    ];

    for (const c of characters) {
      lines.push(
        `${c.name.padEnd(25)} ${c.dialogueCount.toString().padStart(6)} ${c.totalWords.toString().padStart(8)} ${c.parentheticalCount.toString().padStart(6)}`
      );
    }

    lines.push('');
    lines.push(`${'─'.repeat(48)}`);
    lines.push(`TOTAL DIALOGUE LINES: ${characters.reduce((s, c) => s + c.dialogueCount, 0)}`);
    lines.push(`TOTAL DIALOGUE WORDS: ${characters.reduce((s, c) => s + c.totalWords, 0)}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `character_report_${fileName.replace(/\.[^.]+$/, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ConverterLayout title="Character Report" description="Analyze dialogue distribution across characters in your screenplay">
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

        {characters.length > 0 && (
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted-foreground">
                {characters.length} characters found in {fileName}
              </p>
              <button
                onClick={downloadReport}
                className="text-xs text-orange-500 hover:text-orange-600 underline underline-offset-4"
              >
                Download Report
              </button>
            </div>

            {/* Bar chart */}
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Dialogue Distribution</h3>
              <div className="space-y-2">
                {characters.slice(0, 15).map((c) => {
                  const maxLines = characters[0]?.dialogueCount || 1;
                  const pct = (c.dialogueCount / maxLines) * 100;
                  return (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="text-xs text-foreground w-24 truncate text-right font-mono">{c.name}</span>
                      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{c.dialogueCount}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3">Character</th>
                    <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3">Lines</th>
                    <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3">Words</th>
                    <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3">Avg Words/Line</th>
                    <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-3">Parentheticals</th>
                  </tr>
                </thead>
                <tbody>
                  {characters.map((c) => (
                    <tr key={c.name} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-2 font-mono text-foreground">{c.name}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{c.dialogueCount}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{c.totalWords.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {c.dialogueCount > 0 ? Math.round(c.totalWords / c.dialogueCount) : 0}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{c.parentheticalCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ConverterLayout>
  );
}
