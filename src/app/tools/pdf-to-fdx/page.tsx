'use client';

import { useState, useCallback } from 'react';
import { ConverterLayout } from '../converter-layout';
import { parsePDF, generateFDXFromPDF } from '@/lib/scripts/pdf';

export default function PdfToFdxPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file');
      return;
    }
    setFile(f);
    setStatus('idle');
    setError(null);
  }, []);

  const convert = useCallback(async () => {
    if (!file) return;
    setStatus('parsing');
    setError(null);
    try {
      const result = await parsePDF(file);
      const fdx = generateFDXFromPDF(result);

      // Download
      const blob = new Blob([fdx], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, '.fdx');
      a.click();
      URL.revokeObjectURL(url);
      setStatus('done');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to convert PDF';
      setError(message);
      setStatus('error');
    }
  }, [file]);

  return (
    <ConverterLayout title="PDF → FDX" description="Convert PDF screenplays to Final Draft XML format">
      <div className="flex flex-col items-center gap-6">
        <div
          className="w-full max-w-lg border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-foreground/20 transition-colors cursor-pointer"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const dropped = e.dataTransfer.files[0];
            if (dropped) handleFile(dropped);
          }}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf';
            input.onchange = (e) => {
              const target = e.target as HTMLInputElement;
              const f = target.files?.[0];
              if (f) handleFile(f);
            };
            input.click();
          }}
        >
          {file ? (
            <div>
              <p className="text-foreground font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              <button
                className="mt-4 text-xs text-orange-500 hover:text-orange-600 underline underline-offset-4"
                onClick={(e) => { e.stopPropagation(); setFile(null); setStatus('idle'); setError(null); }}
              >
                Choose a different file
              </button>
            </div>
          ) : (
            <div>
              <p className="text-foreground font-medium">Drop a PDF here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">Supports screenwriting PDFs</p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {status === 'done' && (
          <p className="text-sm text-green-500">Conversion complete! Check your downloads.</p>
        )}

        <button
          onClick={convert}
          disabled={!file || status === 'parsing'}
          className="px-8 py-3 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === 'parsing' ? 'Converting…' : 'Convert to FDX'}
        </button>
      </div>
    </ConverterLayout>
  );
}
