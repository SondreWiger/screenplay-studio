'use client';

import { useState, useCallback } from 'react';
import { ConverterLayout } from '../converter-layout';
import { UploadZone, OrangeButton } from '../shared';
import { parseFountain, generateFDX } from '@/lib/scripts/fountain';
import type { TitlePageData, ScriptElement } from '@/lib/types';

export default function FountainToFdxPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'converting' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith('.fountain') && !ext.endsWith('.txt')) {
      setError('Select a Fountain or .txt file.');
      return;
    }
    setFile(f);
    setStatus('idle');
    setError(null);
  }, []);

  const convert = useCallback(async () => {
    if (!file) return;
    setStatus('converting');
    setError(null);
    try {
      const text = await file.text();
      const result = parseFountain(text);
      const fdx = generateFDX(result.elements as ScriptElement[], result.titlePage as TitlePageData);
      const blob = new Blob([fdx], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.(fountain|txt)$/i, '.fdx');
      a.click();
      URL.revokeObjectURL(url);
      setStatus('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to convert Fountain');
      setStatus('error');
    }
  }, [file]);

  return (
    <ConverterLayout title="Fountain → FDX" description="Convert a Fountain plain text screenplay to Final Draft XML.">
      <div className="flex flex-col items-center gap-8 max-w-lg mx-auto">
        <UploadZone
          onFile={handleFile}
          accept=".fountain,.txt"
          label="Drop a Fountain file here or click to browse"
          sublabel="Fountain (.fountain) or plain text (.txt)"
        >
          {file ? (
            <div>
              <p className="text-sm font-bold text-white/80">{file.name}</p>
              <p className="text-xs text-white/25 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              <p
                className="text-[10px] mt-3 underline underline-offset-4 cursor-pointer"
                style={{ color: '#FF5F1F' }}
                onClick={(e) => { e.stopPropagation(); setFile(null); setStatus('idle'); setError(null); }}
              >
                Choose a different file
              </p>
            </div>
          ) : undefined}
        </UploadZone>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {status === 'done' && <p className="text-xs" style={{ color: '#FF5F1F' }}>Conversion complete — check your downloads.</p>}

        <OrangeButton onClick={convert} disabled={!file || status === 'converting'}>
          {status === 'converting' ? 'Converting…' : 'Convert to FDX'}
        </OrangeButton>
      </div>
    </ConverterLayout>
  );
}
