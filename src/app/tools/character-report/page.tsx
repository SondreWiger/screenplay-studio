'use client';

import { useState, useCallback } from 'react';
import { ConverterLayout } from '../converter-layout';
import { UploadZone, GhostButton } from '../shared';
import { parseFountain } from '@/lib/scripts/fountain';
import { parseFDX } from '@/lib/scripts/fdx';
import { parsePDF } from '@/lib/scripts/pdf';

interface CharStats { name: string; lines: number; words: number; parens: number; }

export default function CharacterReportPage() {
  const [chars, setChars] = useState<CharStats[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (file: File) => {
    setError(null); setChars([]); setFileName(file.name);
    try {
      const ext = file.name.toLowerCase().split('.').pop();
      let elements: { content: string; element_type: string; sort_order: number }[] = [];
      if (ext === 'pdf') { elements = (await parsePDF(file)).elements.map((e, i) => ({ ...e, sort_order: e.sort_order ?? i })); }
      else if (ext === 'fdx') { elements = (await parseFDX(await file.text())).elements.map((e, i) => ({ ...e, sort_order: e.sort_order ?? i })); }
      else if (ext === 'fountain' || ext === 'txt') { elements = (await parseFountain(await file.text())).elements.map((e, i) => ({ ...e, sort_order: e.sort_order ?? i })); }
      else { setError('Unsupported file. Use PDF, FDX, or Fountain.'); return; }

      const map = new Map<string, CharStats>();
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.element_type === 'character') {
          const name = el.content?.toUpperCase().trim();
          if (!name) continue;
          if (!map.has(name)) map.set(name, { name, lines: 0, words: 0, parens: 0 });
          const s = map.get(name)!; s.lines++;
          let j = i + 1;
          while (j < elements.length) {
            const n = elements[j];
            if (n.element_type === 'dialogue') { s.words += (n.content?.split(/\s+/).length || 0); j++; }
            else if (n.element_type === 'parenthetical') { s.parens++; j++; }
            else break;
          }
          i = j - 1;
        }
      }
      setChars(Array.from(map.values()).sort((a, b) => b.lines - a.lines));
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to analyze file'); }
  }, []);

  const download = () => {
    const lines = [
      `CHARACTER REPORT`, `${'═'.repeat(60)}`, `File: ${fileName}`, `Characters: ${chars.length}`, '',
      `${'Character'.padEnd(25)} ${'Lines'.padStart(6)} ${'Words'.padStart(8)} ${'Par.'.padStart(6)}`, `${'─'.repeat(48)}`,
    ];
    for (const c of chars) lines.push(`${c.name.padEnd(25)} ${c.lines.toString().padStart(6)} ${c.words.toString().padStart(8)} ${c.parens.toString().padStart(6)}`);
    lines.push('', `${'─'.repeat(48)}`, `TOTAL LINES: ${chars.reduce((s, c) => s + c.lines, 0)}`, `TOTAL WORDS: ${chars.reduce((s, c) => s + c.words, 0)}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `character_report_${fileName.replace(/\.[^.]+$/, '')}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ConverterLayout title="Character Report" description="Analyze dialogue distribution across characters in your screenplay.">
      <div className="flex flex-col items-center gap-8">
        <div className="w-full max-w-lg">
          <UploadZone onFile={analyze} accept=".pdf,.fdx,.fountain,.txt" label="Drop a script file or click to browse" sublabel="PDF, FDX, Fountain, or .txt" />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {chars.length > 0 && (
          <div className="w-full max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-1 rounded-full bg-brand-500" />
                <span className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/25 font-mono">{chars.length} CHARACTERS — {fileName}</span>
              </div>
              <GhostButton onClick={download}>Download Report</GhostButton>
            </div>
            <div className="p-6 bg-white/[0.02] border border-white/6">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 font-mono mb-4">DIALOGUE DISTRIBUTION</p>
              <div className="space-y-2">
                {chars.slice(0, 15).map(c => {
                  const pct = (c.lines / (chars[0]?.lines || 1)) * 100;
                  return (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="text-[10px] text-white/40 w-24 truncate text-right font-mono">{c.name}</span>
                      <div className="flex-1 h-3 bg-white/[0.04] overflow-hidden">
                        <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-white/30 w-8 text-right font-mono">{c.lines}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="border border-white/6">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/6">
                    {['Character', 'Lines', 'Words', 'Avg', 'Par.'].map(h => (
                      <th key={h} className={`text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 font-mono px-4 py-3 ${h !== 'Character' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chars.map(c => (
                    <tr key={c.name} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5 font-mono text-white/60">{c.name}</td>
                      <td className="px-4 py-2.5 text-right text-white/40 font-mono">{c.lines}</td>
                      <td className="px-4 py-2.5 text-right text-white/40 font-mono">{c.words.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-white/40 font-mono">{c.lines > 0 ? Math.round(c.words / c.lines) : 0}</td>
                      <td className="px-4 py-2.5 text-right text-white/40 font-mono">{c.parens}</td>
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
