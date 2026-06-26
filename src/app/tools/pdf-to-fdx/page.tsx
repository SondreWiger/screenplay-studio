'use client';

import { useState, useCallback } from 'react';
import { ConverterLayout } from '../converter-layout';
import { UploadZone, OrangeButton } from '../shared';
import { parsePDF, generateFDXFromPDF } from '@/lib/scripts/pdf';

export default function PdfToFdxPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('Select a PDF file.'); return; }
    setFile(f); setStatus('idle'); setError(null);
  }, []);

  const convert = useCallback(async () => {
    if (!file) return;
    setStatus('parsing'); setError(null);
    try {
      const result = await parsePDF(file);
      const fdx = generateFDXFromPDF(result);
      const blob = new Blob([fdx], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = file.name.replace(/\.pdf$/i, '.fdx'); a.click();
      URL.revokeObjectURL(url); setStatus('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to convert PDF'); setStatus('error');
    }
  }, [file]);

  return (
    <ConverterLayout title="PDF → FDX" description="Extract screenplay content from a PDF and convert it to Final Draft XML.">
      <div className="flex flex-col items-center gap-8 max-w-lg mx-auto">
        <UploadZone onFile={handleFile} accept=".pdf" label="Drop a PDF here or click to browse" sublabel="Screenwriting PDFs — exported from Final Draft, Fade In, Highland, etc.">
          {file ? (
            <div>
              <p className="text-sm font-bold text-white/80">{file.name}</p>
              <p className="text-xs text-white/25 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              <p className="text-[10px] mt-3 underline underline-offset-4 cursor-pointer text-brand-500" onClick={(e) => { e.stopPropagation(); setFile(null); setStatus('idle'); setError(null); }}>Choose a different file</p>
            </div>
          ) : undefined}
        </UploadZone>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {status === 'done' && <p className="text-xs text-brand-500">Conversion complete — check your downloads.</p>}
        <OrangeButton onClick={convert} disabled={!file || status === 'parsing'}>
          {status === 'parsing' ? 'Converting…' : 'Convert to FDX'}
        </OrangeButton>
      </div>
    </ConverterLayout>
  );
}
