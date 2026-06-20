'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, toast } from '@/components/ui';
import { parseFDX } from '@/lib/scripts/fdx';
import { parseFountain } from '@/lib/scripts/fountain';
import { parseStarcFile } from '@/lib/scripts/starc';
import { SCRIPT_TYPE_OPTIONS } from '@/lib/types';
import type { ScriptType, ProjectType, ScriptElement } from '@/lib/types';

interface ParsedFile {
  id: string;
  file: File;
  name: string;
  format: 'fdx' | 'fountain' | 'starc';
  title: string;
  scriptType: ScriptType;
  projectType: ProjectType;
  elements: Partial<ScriptElement>[];
  titlePage: Record<string, string>;
  characters?: string[];
  locations?: string[];
  error?: string;
}

const PROJECT_TYPE_MAP: Record<ScriptType, ProjectType> = {
  screenplay: 'film',
  stageplay: 'stage_play',
  episodic: 'tv_production',
  sketch: 'film',
  comic: 'film',
  podcast: 'podcast',
  audio_drama: 'audio_drama',
  youtube: 'youtube',
  tiktok: 'tiktok',
};

const ACCEPTED = '.fdx,.fountain,.txt,.starc';

function detectFormat(name: string): 'fdx' | 'fountain' | 'starc' | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.fdx')) return 'fdx';
  if (lower.endsWith('.starc')) return 'starc';
  if (lower.endsWith('.fountain') || lower.endsWith('.txt')) return 'fountain';
  return null;
}

function deriveTitle(filename: string): string {
  return filename
    .replace(/\.(fdx|fountain|txt)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

export default function BulkImportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: ParsedFile[] = [];

    for (const file of Array.from(fileList)) {
      const fmt = detectFormat(file.name);
      if (!fmt) {
        newFiles.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          format: 'fountain',
          title: deriveTitle(file.name),
          scriptType: 'screenplay',
          projectType: 'film',
          elements: [],
          titlePage: {},
          error: 'Unsupported file type. Use .fdx, .fountain, or .starc.',
        });
        continue;
      }

      try {
        // .starc files are binary SQLite databases — handle separately
        if (fmt === 'starc') {
          const parsed = await parseStarcFile(file);
          newFiles.push({
            id: crypto.randomUUID(),
            file,
            name: file.name,
            format: 'starc',
            title: parsed.title,
            scriptType: 'screenplay',
            projectType: 'film',
            elements: parsed.elements,
            titlePage: parsed.titlePage as Record<string, string>,
            characters: parsed.characters,
            locations: parsed.locations,
          });
          continue;
        }

        const text = await file.text();
        let result: { elements: Partial<ScriptElement>[]; titlePage: Record<string, string> };

        if (fmt === 'fdx') {
          const parsed = parseFDX(text);
          result = { elements: parsed.elements, titlePage: parsed.titlePage as Record<string, string> };
        } else {
          const parsed = parseFountain(text);
          result = { elements: parsed.elements, titlePage: parsed.titlePage as Record<string, string> };
        }

        const detectedTitle = result.titlePage.title || deriveTitle(file.name);
        const scriptType: ScriptType = 'screenplay';

        newFiles.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          format: fmt,
          title: detectedTitle,
          scriptType,
          projectType: PROJECT_TYPE_MAP[scriptType],
          elements: result.elements,
          titlePage: result.titlePage,
        });
      } catch (err) {
        newFiles.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          format: fmt,
          title: deriveTitle(file.name),
          scriptType: 'screenplay',
          projectType: 'film',
          elements: [],
          titlePage: {},
          error: `Failed to parse: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
    }

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  }, [processFiles]);

  const updateFile = useCallback((id: string, updates: Partial<ParsedFile>) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const updated = { ...f, ...updates };
        if (updates.scriptType) {
          updated.projectType = PROJECT_TYPE_MAP[updates.scriptType];
        }
        return updated;
      })
    );
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const importAll = useCallback(async () => {
    if (!user || files.length === 0) return;
    const valid = files.filter((f) => !f.error && f.elements.length > 0);
    if (valid.length === 0) {
      toast('No valid files to import', 'error');
      return;
    }

    setImporting(true);
    setProgress({ done: 0, total: valid.length });
    const supabase = createClient();
    let created = 0;

    for (const file of valid) {
      try {
        // 1. Create project
        const { data: project, error: projectErr } = await supabase
          .from('projects')
          .insert({
            title: file.title,
            script_type: file.scriptType,
            project_type: file.projectType,
            format: file.scriptType === 'episodic' ? 'series' : 'feature',
            created_by: user.id,
          })
          .select()
          .single();

        if (projectErr || !project) {
          console.error('Failed to create project for', file.name, projectErr);
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          continue;
        }

        // 2. Create script
        const { data: script, error: scriptErr } = await supabase
          .from('scripts')
          .insert({
            project_id: project.id,
            title: file.title,
            version: 1,
            is_active: true,
            title_page_data: file.titlePage || {},
          })
          .select()
          .single();

        if (scriptErr || !script) {
          console.error('Failed to create script for', file.name, scriptErr);
          setProgress((p) => ({ ...p, done: p.done + 1 }));
          continue;
        }

        // 3. Insert script elements in batches
        const elements = file.elements.map((el, i) => ({
          script_id: script.id,
          element_type: el.element_type || 'action',
          content: el.content || '',
          sort_order: i,
          scene_number: el.scene_number || null,
          metadata: el.metadata || {},
        }));

        const BATCH = 100;
        for (let i = 0; i < elements.length; i += BATCH) {
          const batch = elements.slice(i, i + BATCH);
          const { error: elErr } = await supabase.from('script_elements').insert(batch);
          if (elErr) {
            console.error('Failed to insert elements for', file.name, elErr);
          }
        }

        created++;
      } catch (err) {
        console.error('Unexpected error importing', file.name, err);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setImporting(false);
    if (created > 0) {
      toast(`Successfully created ${created} project${created > 1 ? 's' : ''}`, 'success');
      router.push('/dashboard');
    } else {
      toast('Failed to create any projects', 'error');
    }
  }, [user, files, router]);

  const validCount = files.filter((f) => !f.error && f.elements.length > 0).length;
  const errorCount = files.filter((f) => f.error).length;

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <div className="border-b border-surface-800 bg-surface-900/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-surface-400 hover:text-white transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dashboard
            </Link>
            <span className="text-surface-600">/</span>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">Bulk Import</h1>
          </div>
          {files.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-surface-400">
                {validCount} valid{errorCount > 0 && <span className="text-red-400 ml-2">{errorCount} errors</span>}
              </span>
              <Button
                onClick={importAll}
                disabled={validCount === 0 || importing}
                loading={importing}
                size="sm"
              >
                {importing
                  ? `Importing ${progress.done}/${progress.total}...`
                  : `Create ${validCount} Project${validCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
            dragOver
              ? 'border-[#FF5F1F] bg-[#FF5F1F]/5'
              : 'border-surface-700 hover:border-surface-500 bg-surface-900/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-4">
            <div className={`w-14 h-14 flex items-center justify-center rounded-xl transition-colors ${
              dragOver ? 'bg-[#FF5F1F]/20' : 'bg-surface-800'
            }`}>
              <svg className={`w-7 h-7 transition-colors ${dragOver ? 'text-[#FF5F1F]' : 'text-surface-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">
                {dragOver ? 'Drop files here' : 'Drop FDX or Fountain files, or click to browse'}
              </p>
              <p className="text-xs text-surface-400">
                Supports Final Draft (.fdx), Fountain (.fountain, .txt), and Story Architect (.starc) — each file becomes a separate project
              </p>
            </div>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-surface-400 uppercase tracking-wider">
                {files.length} File{files.length !== 1 ? 's' : ''} Queued
              </h2>
              <button
                onClick={() => setFiles([])}
                className="text-xs text-surface-500 hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            </div>

            {files.map((file) => (
              <Card key={file.id} className="p-4">
                <div className="flex items-start gap-4">
                  {/* File icon */}
                  <div className={`w-10 h-10 flex items-center justify-center rounded-lg shrink-0 text-[10px] font-black uppercase ${
                    file.format === 'fdx'
                      ? 'bg-blue-500/15 text-blue-400'
                      : file.format === 'starc'
                      ? 'bg-purple-500/15 text-purple-400'
                      : 'bg-green-500/15 text-green-400'
                  }`}>
                    {file.format}
                  </div>

                  {/* Fields */}
                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Title */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                        Project Title
                      </label>
                      <input
                        value={file.title}
                        onChange={(e) => updateFile(file.id, { title: e.target.value })}
                        className="w-full px-3 py-2 text-sm bg-surface-800 border border-surface-700 rounded-lg text-white focus:border-[#FF5F1F] focus:outline-none transition-colors"
                        disabled={importing}
                      />
                    </div>

                    {/* Script Type */}
                    <div>
                      <label className="block text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                        Script Type
                      </label>
                      <select
                        value={file.scriptType}
                        onChange={(e) => updateFile(file.id, { scriptType: e.target.value as ScriptType })}
                        className="w-full px-3 py-2 text-sm bg-surface-800 border border-surface-700 rounded-lg text-white focus:border-[#FF5F1F] focus:outline-none transition-colors"
                        disabled={importing}
                      >
                        {SCRIPT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Format */}
                    <div>
                      <label className="block text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                        Format
                      </label>
                      <select
                        value={file.projectType}
                        onChange={(e) => updateFile(file.id, { projectType: e.target.value as ProjectType })}
                        className="w-full px-3 py-2 text-sm bg-surface-800 border border-surface-700 rounded-lg text-white focus:border-[#FF5F1F] focus:outline-none transition-colors"
                        disabled={importing}
                      >
                        {Object.entries(PROJECT_TYPE_MAP).map(([_, pt]) => (
                          <option key={pt} value={pt}>
                            {pt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Status + remove */}
                  <div className="flex items-center gap-2 shrink-0">
                    {file.error ? (
                      <span className="text-[10px] font-mono text-red-400 max-w-[120px] truncate" title={file.error}>
                        Error
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-surface-500">
                        {file.elements.length} elements
                        {file.characters && file.characters.length > 0 && (
                          <span className="ml-2 text-purple-400/70">{file.characters.length} chars</span>
                        )}
                        {file.locations && file.locations.length > 0 && (
                          <span className="ml-2 text-blue-400/70">{file.locations.length} locs</span>
                        )}
                      </span>
                    )}
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1 text-surface-500 hover:text-red-400 transition-colors"
                      disabled={importing}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Error message */}
                {file.error && (
                  <p className="mt-2 text-xs text-red-400/80 ml-14">{file.error}</p>
                )}

                {/* Title page preview */}
                {!file.error && file.titlePage && Object.keys(file.titlePage).length > 0 && (
                  <div className="mt-2 ml-14 flex flex-wrap gap-x-4 gap-y-1">
                    {file.titlePage.author && (
                      <span className="text-[10px] text-surface-500">
                        by <span className="text-surface-300">{file.titlePage.author}</span>
                      </span>
                    )}
                    {file.titlePage.draft_date && (
                      <span className="text-[10px] text-surface-500">
                        Draft: <span className="text-surface-300">{file.titlePage.draft_date}</span>
                      </span>
                    )}
                    {file.titlePage.contact && (
                      <span className="text-[10px] text-surface-500">
                        Contact: <span className="text-surface-300">{file.titlePage.contact}</span>
                      </span>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Empty state when no files */}
        {files.length === 0 && (
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-900 border border-surface-800 rounded-lg">
              <svg className="w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-surface-400">
                Coming from Story Architect? Export as FDX/Fountain, or drop your .starc project files directly — we cracked the format.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
