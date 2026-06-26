'use client';

import { useState, useCallback } from 'react';
import { ConverterLayout } from '../converter-layout';
import { UploadZone, OrangeButton } from '../shared';
import { parseFDX, generateFountain } from '@/lib/scripts/fdx';

export default function FdxToFountainPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'converting' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.fdx')) {
      setError('Select an FDX file.');
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
      const fdxText = await file.text();
      const result = parseFDX(fdxText);
      const fountain = generateFountain(result.elements, result.titlePage);
      const blob = new Blob([fountain], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.fdx$/i, '.fountain');
      a.click();
      URL.revokeObjectURL(url);
      setStatus('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to convert FDX');
      setStatus('error');
    }
  }, [file]);

  return (
    <ConverterLayout title="FDX → Fountain" description="Convert a Final Draft XML file to Fountain plain text.">
      <div className="flex flex-col items-center gap-8 max-w-lg mx-auto">
        <UploadZone
          onFile={handleFile}
          accept=".fdx"
          label="Drop an FDX file here or click to browse"
          sublabel="Final Draft XML (.fdx)"
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
          {status === 'converting' ? 'Converting…' : 'Convert to Fountain'}
        </OrangeButton>
      </div>
    </ConverterLayout>
  );
}
