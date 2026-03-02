'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProFeatures } from '@/hooks/useProFeatures';
import { useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, LoadingSpinner, toast, ToastContainer } from '@/components/ui';

// ============================================================
// Advanced Export — Pro feature
// Branded PDF/DOCX/HTML/Fountain export with watermark & cover
// ============================================================

type ExportFormat = 'pdf' | 'docx' | 'fountain' | 'html' | 'fdx';

interface ExportConfig {
  format: ExportFormat;
  includeTitle: boolean;
  includeCover: boolean;
  coverLogoUrl: string;
  coverCompanyName: string;
  coverSubtitle: string;
  watermarkText: string;
  watermarkEnabled: boolean;
  headerLeft: string;
  headerRight: string;
  footerEnabled: boolean;
  pageNumbers: boolean;
  sceneNumbers: boolean;
  draftLabel: string;
  contactInfo: string;
  colorCoding: boolean;
  revisionColor: string;
  fontSize: number;
}

const defaultConfig: ExportConfig = {
  format: 'pdf',
  includeTitle: true,
  includeCover: true,
  coverLogoUrl: '',
  coverCompanyName: '',
  coverSubtitle: '',
  watermarkText: 'CONFIDENTIAL',
  watermarkEnabled: false,
  headerLeft: '',
  headerRight: '',
  footerEnabled: true,
  pageNumbers: true,
  sceneNumbers: true,
  draftLabel: '',
  contactInfo: '',
  colorCoding: false,
  revisionColor: '#60a5fa',
  fontSize: 12,
};

const FORMATS: { id: ExportFormat; label: string; icon: string; desc: string }[] = [
  { id: 'pdf', label: 'PDF', icon: 'PDF', desc: 'Industry standard, print-ready' },
  { id: 'docx', label: 'DOCX', icon: 'DOC', desc: 'Microsoft Word, editable' },
  { id: 'fountain', label: 'Fountain', icon: '.FTN', desc: 'Plain text markup format' },
  { id: 'html', label: 'HTML', icon: 'HTML', desc: 'Web-ready, embeddable' },
  { id: 'fdx', label: 'FDX', icon: 'FDX', desc: 'Final Draft compatible' },
];

const REVISION_COLORS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Blue', value: '#60a5fa' },
  { label: 'Pink', value: '#f472b6' },
  { label: 'Yellow', value: '#fbbf24' },
  { label: 'Green', value: '#34d399' },
  { label: 'Goldenrod', value: '#daa520' },
  { label: 'Buff', value: '#f0dc82' },
  { label: 'Salmon', value: '#fa8072' },
  { label: 'Cherry', value: '#de3163' },
  { label: 'Tan', value: '#d2b48c' },
];

export default function ExportPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { isPro, hasAdvancedExports } = useProFeatures();
  const { currentProject } = useProjectStore();
  const [scripts, setScripts] = useState<any[]>([]);
  const [selectedScript, setSelectedScript] = useState<string>('');
  const [elements, setElements] = useState<Record<string, any[]>>({});
  const [config, setConfig] = useState<ExportConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchFormats, setBatchFormats] = useState<ExportFormat[]>(['pdf']);
  const [exportHistory, setExportHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    const supabase = createClient();
    const [scriptRes] = await Promise.all([
      supabase.from('scripts')
        .select('id, title, content, updated_at')
        .eq('project_id', params.id)
        .order('created_at', { ascending: true }),
    ]);
    const scr = scriptRes.data || [];
    setScripts(scr);
    if (scr.length > 0) setSelectedScript(scr[0].id);

    // Fetch actual script_elements for each script (the real content source)
    const elemsByScript: Record<string, any[]> = {};
    for (const s of scr) {
      const { data: elems } = await supabase
        .from('script_elements')
        .select('element_type, content, sort_order, scene_number, revision_color, is_revised, is_omitted')
        .eq('script_id', s.id)
        .order('sort_order');
      elemsByScript[s.id] = (elems || []).filter((e: { is_omitted?: boolean }) => !e.is_omitted).map((e: { element_type: string; content: string; scene_number?: string; revision_color?: string; is_revised?: boolean }) => ({
        type: e.element_type,
        text: e.content,
        scene_number: e.scene_number,
        revision_color: e.revision_color,
        is_revised: e.is_revised,
      }));
    }
    setElements(elemsByScript);

    // Hydrate cover info from project branding if available
    if (currentProject?.custom_branding) {
      const b = currentProject.custom_branding;
      setConfig(prev => ({
        ...prev,
        coverLogoUrl: b.logo_url || '',
        coverCompanyName: b.company_name || '',
        watermarkText: b.watermark || 'CONFIDENTIAL',
        watermarkEnabled: !!b.watermark,
        coverSubtitle: b.cover_subtitle || '',
      }));
    }
    setLoading(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const formats = batchMode ? batchFormats : [config.format];
      for (const fmt of formats) {
        const script = scripts.find(s => s.id === selectedScript);
        if (!script) continue;

        // Use script_elements (the actual content), falling back to scripts.content
        const scriptElements = elements[selectedScript] || [];
        const content = scriptElements.length > 0
          ? scriptElements
          : (Array.isArray(script.content) ? script.content : []);

        if (content.length === 0) {
          toast('No script content to export. Write your script first.', 'warning');
          setExporting(false);
          return;
        }

        // Apply branding from custom_branding if available
        const branding = currentProject?.custom_branding;
        const appliedConfig = { ...config, format: fmt };
        if (branding) {
          if (!appliedConfig.coverCompanyName && branding.company_name) appliedConfig.coverCompanyName = branding.company_name;
          if (!appliedConfig.coverLogoUrl && branding.logo_url) appliedConfig.coverLogoUrl = branding.logo_url;
          if (!appliedConfig.watermarkText && branding.watermark) appliedConfig.watermarkText = branding.watermark;
          if (!appliedConfig.coverSubtitle && branding.cover_subtitle) appliedConfig.coverSubtitle = branding.cover_subtitle;
        }

        const exportData = {
          project_name: currentProject?.title || 'Untitled',
          script_title: script.title,
          content,
          format: fmt,
          config: appliedConfig,
          projectType: currentProject?.project_type || 'film',
          fontFamily: branding?.font_family || 'Courier New',
          coverTitle: branding?.cover_title || '',
          watermarkOpacity: branding?.watermark_opacity ?? 6,
          headerTemplate: branding?.header_template || 'minimal',
          primaryColor: branding?.primary_color || '#3B82F6',
          secondaryColor: branding?.secondary_color || '#F59E0B',
        };

        if (fmt === 'pdf') {
          // PDF: generate HTML and open in a new tab for printing
          const html = generateScreenplayHTML(exportData);
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const win = window.open(url, '_blank');
          if (win) {
            win.onload = () => {
              setTimeout(() => {
                win.print();
                URL.revokeObjectURL(url);
              }, 300);
            };
          } else {
            // Fallback: download as HTML if popup blocked
            const a = document.createElement('a');
            a.href = url;
            a.download = `${script.title || 'script'}.html`;
            a.click();
            URL.revokeObjectURL(url);
            toast('Popup blocked — downloaded as HTML instead. Open the file and print to PDF.', 'warning');
          }
        } else {
          // All other formats: download as blob
          const blob = generateExport(exportData);
          const ext = fmt === 'docx' ? 'doc' : fmt;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${script.title || 'script'}.${ext}`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      toast(`Exported ${formats.length} file${formats.length > 1 ? 's' : ''}`, 'success');
    } catch (err) {
      toast('Export failed', 'error');
    }
    setExporting(false);
  };

  const updateConfig = (key: keyof ExportConfig, value: string | number | boolean | null) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const hasProAccess = isPro || currentProject?.pro_enabled === true;

  if (!hasProAccess) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="max-w-md p-8 text-center">
          <div className="text-4xl mb-4">
            <svg className="w-12 h-12 mx-auto text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Advanced Export</h2>
          <p className="text-sm text-surface-400 mb-4">Export your screenplay in PDF, DOCX, Fountain, HTML, and FDX formats with custom branding and watermarks.</p>
          <Badge variant="warning">Pro Feature</Badge>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-6xl">
      <ToastContainer />
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-white">Advanced Export</h1>
            <Badge variant="warning">⭐ Pro</Badge>
          </div>
          <p className="text-sm text-surface-400 mt-1">Branded, production-ready exports in multiple formats.</p>
        </div>
      </div>

      {loading ? <LoadingSpinner className="py-32" /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Config */}
          <div className="lg:col-span-2 space-y-6">
            {/* Script Select */}
            {scripts.length > 1 && (
              <Card className="p-4">
                <label className="block text-xs font-medium text-surface-400 mb-2">Script</label>
                <select
                  className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white"
                  value={selectedScript}
                  onChange={e => setSelectedScript(e.target.value)}
                >
                  {scripts.map(s => (
                    <option key={s.id} value={s.id}>{s.title || 'Untitled'}</option>
                  ))}
                </select>
              </Card>
            )}

            {/* Format */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-medium text-surface-400">Format</label>
                <label className="flex items-center gap-2 text-xs text-surface-400">
                  <input
                    type="checkbox"
                    checked={batchMode}
                    onChange={e => setBatchMode(e.target.checked)}
                    className="rounded bg-surface-800 border-surface-600 text-[#FF5F1F] focus:ring-[#FF5F1F]"
                  />
                  Batch export
                </label>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {FORMATS.map(f => {
                  const isActive = batchMode
                    ? batchFormats.includes(f.id)
                    : config.format === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        if (batchMode) {
                          setBatchFormats(prev =>
                            prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id]
                          );
                        } else {
                          updateConfig('format', f.id);
                        }
                      }}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        isActive
                          ? 'bg-[#FF5F1F]/10 border-[#FF5F1F] text-[#FF5F1F]'
                          : 'bg-surface-800/50 border-surface-700 text-surface-400 hover:border-surface-600'
                      }`}
                    >
                      <div className="text-2xl mb-1">{f.icon}</div>
                      <div className="text-xs font-medium">{f.label}</div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Cover Page */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-medium text-surface-400">Cover Page</label>
                <input
                  type="checkbox"
                  checked={config.includeCover}
                  onChange={e => updateConfig('includeCover', e.target.checked)}
                  className="rounded bg-surface-800 border-surface-600 text-[#FF5F1F] focus:ring-[#FF5F1F]"
                />
              </div>
              {config.includeCover && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-surface-500 mb-1">Company / Studio Name</label>
                    <input
                      type="text"
                      value={config.coverCompanyName}
                      onChange={e => updateConfig('coverCompanyName', e.target.value)}
                      placeholder="Acme Productions"
                      className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-surface-500 mb-1">Subtitle</label>
                    <input
                      type="text"
                      value={config.coverSubtitle}
                      onChange={e => updateConfig('coverSubtitle', e.target.value)}
                      placeholder="Original Screenplay by..."
                      className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-surface-500 mb-1">Contact Info</label>
                    <input
                      type="text"
                      value={config.contactInfo}
                      onChange={e => updateConfig('contactInfo', e.target.value)}
                      placeholder="agent@example.com"
                      className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-surface-500 mb-1">Draft Label</label>
                    <input
                      type="text"
                      value={config.draftLabel}
                      onChange={e => updateConfig('draftLabel', e.target.value)}
                      placeholder="THIRD DRAFT — June 2025"
                      className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-surface-500 mb-1">Logo URL (optional)</label>
                    <input
                      type="url"
                      value={config.coverLogoUrl}
                      onChange={e => updateConfig('coverLogoUrl', e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-600"
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Watermark */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-medium text-surface-400">Watermark</label>
                <input
                  type="checkbox"
                  checked={config.watermarkEnabled}
                  onChange={e => updateConfig('watermarkEnabled', e.target.checked)}
                  className="rounded bg-surface-800 border-surface-600 text-[#FF5F1F] focus:ring-[#FF5F1F]"
                />
              </div>
              {config.watermarkEnabled && (
                <input
                  type="text"
                  value={config.watermarkText}
                  onChange={e => updateConfig('watermarkText', e.target.value)}
                  placeholder="CONFIDENTIAL"
                  className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-600"
                />
              )}
            </Card>

            {/* Page Options */}
            <Card className="p-4">
              <label className="block text-xs font-medium text-surface-400 mb-3">Page Options</label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-sm text-surface-300">
                  <input
                    type="checkbox"
                    checked={config.pageNumbers}
                    onChange={e => updateConfig('pageNumbers', e.target.checked)}
                    className="rounded bg-surface-800 border-surface-600 text-[#FF5F1F] focus:ring-[#FF5F1F]"
                  />
                  Page numbers
                </label>
                <label className="flex items-center gap-2 text-sm text-surface-300">
                  <input
                    type="checkbox"
                    checked={config.sceneNumbers}
                    onChange={e => updateConfig('sceneNumbers', e.target.checked)}
                    className="rounded bg-surface-800 border-surface-600 text-[#FF5F1F] focus:ring-[#FF5F1F]"
                  />
                  Scene numbers
                </label>
                <label className="flex items-center gap-2 text-sm text-surface-300">
                  <input
                    type="checkbox"
                    checked={config.includeTitle}
                    onChange={e => updateConfig('includeTitle', e.target.checked)}
                    className="rounded bg-surface-800 border-surface-600 text-[#FF5F1F] focus:ring-[#FF5F1F]"
                  />
                  Title page
                </label>
                <label className="flex items-center gap-2 text-sm text-surface-300">
                  <input
                    type="checkbox"
                    checked={config.footerEnabled}
                    onChange={e => updateConfig('footerEnabled', e.target.checked)}
                    className="rounded bg-surface-800 border-surface-600 text-[#FF5F1F] focus:ring-[#FF5F1F]"
                  />
                  Footer
                </label>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-surface-500 mb-1">Header Left</label>
                  <input
                    type="text"
                    value={config.headerLeft}
                    onChange={e => updateConfig('headerLeft', e.target.value)}
                    placeholder="Project name..."
                    className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-surface-500 mb-1">Header Right</label>
                  <input
                    type="text"
                    value={config.headerRight}
                    onChange={e => updateConfig('headerRight', e.target.value)}
                    placeholder="Date..."
                    className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-600"
                  />
                </div>
              </div>
            </Card>

            {/* Revision Colors */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-medium text-surface-400">Revision Color Coding</label>
                <input
                  type="checkbox"
                  checked={config.colorCoding}
                  onChange={e => updateConfig('colorCoding', e.target.checked)}
                  className="rounded bg-surface-800 border-surface-600 text-[#FF5F1F] focus:ring-[#FF5F1F]"
                />
              </div>
              {config.colorCoding && (
                <div className="flex flex-wrap gap-2">
                  {REVISION_COLORS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => updateConfig('revisionColor', c.value)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all ${
                        config.revisionColor === c.value
                          ? 'border-[#FF5F1F] bg-[#FF5F1F]/10'
                          : 'border-surface-700 hover:border-surface-600'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.value }} />
                      <span className="text-surface-300">{c.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Font Size */}
            <Card className="p-4">
              <label className="block text-xs font-medium text-surface-400 mb-3">Font Size: {config.fontSize}pt</label>
              <input
                type="range"
                min={8}
                max={16}
                value={config.fontSize}
                onChange={e => updateConfig('fontSize', Number(e.target.value))}
                className="w-full accent-brand-500"
              />
              <div className="flex justify-between text-[10px] text-surface-600 mt-1">
                <span>8pt</span><span>12pt</span><span>16pt</span>
              </div>
            </Card>
          </div>

          {/* Right: Preview & Export */}
          <div className="space-y-4">
            <Card className="p-4 sticky top-4">
              <h3 className="text-sm font-medium text-white mb-3">Export Preview</h3>
              <div className="aspect-[8.5/11] bg-surface-900 rounded-lg overflow-hidden relative mb-4">
                <div className="p-4 text-[6px] leading-tight text-white/90 font-mono" style={{ fontSize: `${config.fontSize * 0.5}px` }}>
                  {config.includeCover && (
                    <div className="text-center mb-4">
                      {config.coverLogoUrl && <div className="mb-1 text-[4px] text-gray-400">[Logo]</div>}
                      {config.coverCompanyName && <div className="text-[5px] text-white/40 mb-1">{config.coverCompanyName}</div>}
                      <div className="text-[8px] font-bold mb-0.5">{currentProject?.title || 'Script Title'}</div>
                      {config.coverSubtitle && <div className="text-[5px] text-white/40">{config.coverSubtitle}</div>}
                      {config.draftLabel && <div className="text-[4px] text-gray-400 mt-1">{config.draftLabel}</div>}
                      <div className="border-b border-white/10 mt-2 mb-2" />
                    </div>
                  )}
                  <div className="space-y-1">
                    {config.sceneNumbers && <span className="text-gray-400">1. </span>}
                    <span className="font-bold">INT. OFFICE - DAY</span>
                    <p className="text-white/60 ml-0">A modern office. Sunlight streams through floor-to-ceiling windows.</p>
                    <p className="text-center font-bold text-white/90 mt-1">ALEX</p>
                    <p className="text-center text-white/70">This is going to change everything.</p>
                  </div>
                </div>
                {config.watermarkEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none rotate-[-30deg]">
                    <span className="text-red-200/30 text-2xl font-black uppercase tracking-widest">{config.watermarkText}</span>
                  </div>
                )}
                {config.pageNumbers && (
                  <div className="absolute bottom-1 right-2 text-[4px] text-gray-400">1.</div>
                )}
              </div>

              <Button
                className="w-full mb-2"
                onClick={handleExport}
                loading={exporting}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {batchMode ? `Export ${batchFormats.length} format${batchFormats.length !== 1 ? 's' : ''}` : `Export as ${config.format.toUpperCase()}`}
              </Button>

              <div className="text-[10px] text-surface-500 text-center">
                {batchMode ? batchFormats.map(f => f.toUpperCase()).join(' + ') : `${config.format.toUpperCase()} format`}
                {config.watermarkEnabled && ' • Watermarked'}
                {config.includeCover && ' • Cover page'}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Screenplay HTML builder (shared between PDF & HTML export) ──

function generateScreenplayHTML(data: any): string {
  const { content, config: cfg, fontFamily, coverTitle, watermarkOpacity, headerTemplate, primaryColor, projectType } = data;
  const elements = Array.isArray(content) ? content : [];
  let sceneNum = 0;
  const font = fontFamily || 'Courier New';
  const wmOpacity = (watermarkOpacity ?? 6) / 100;
  const isAudioDrama = projectType === 'audio_drama';
  const isStagePlay = projectType === 'stage_play';

  const bodyParts: string[] = [];

  // Cover page
  if (cfg.includeCover) {
    bodyParts.push('<div class="cover-page">');
    if (cfg.coverLogoUrl) bodyParts.push(`<img src="${cfg.coverLogoUrl}" alt="" style="max-height:60px;margin-bottom:20px;" />`);
    if (cfg.coverCompanyName) bodyParts.push(`<div class="cover-company">${esc(cfg.coverCompanyName)}</div>`);
    const title = coverTitle || cfg.coverTitle || data.script_title || data.project_name;
    bodyParts.push(`<h1 class="cover-title">${esc(title)}</h1>`);
    if (cfg.coverSubtitle) bodyParts.push(`<div class="cover-subtitle">${esc(cfg.coverSubtitle)}</div>`);
    if (cfg.draftLabel) bodyParts.push(`<div class="cover-draft">${esc(cfg.draftLabel)}</div>`);
    if (cfg.contactInfo) bodyParts.push(`<div class="cover-contact">${esc(cfg.contactInfo)}</div>`);
    bodyParts.push('</div><div style="page-break-after:always"></div>');
  }

  // Header based on template
  const hdrTemplate = headerTemplate || 'minimal';
  if (hdrTemplate === 'classic' || hdrTemplate === 'branded') {
    bodyParts.push('<div class="page-header">');
    if (hdrTemplate === 'branded') {
      if (cfg.coverLogoUrl) bodyParts.push(`<img src="${cfg.coverLogoUrl}" alt="" style="max-height:20px;vertical-align:middle;margin-right:8px;" />`);
      if (cfg.coverCompanyName) bodyParts.push(`<span class="header-company">${esc(cfg.coverCompanyName)}</span>`);
    }
    if (cfg.draftLabel) bodyParts.push(`<span class="header-draft">${esc(cfg.draftLabel)}</span>`);
    bodyParts.push(`<span class="header-date">${new Date().toLocaleDateString()}</span>`);
    bodyParts.push('</div>');
  }

  // Script body
  for (const el of elements) {
    const type = (el.type || '').toLowerCase();
    const text = el.text || '';

    if (isAudioDrama) {
      // ── Audio Drama rendering ──────────────────────────────
      if (type === 'scene_heading' || type === 'heading' || type === 'setting') {
        sceneNum++;
        const num = cfg.sceneNumbers ? `<span class="scene-num">${sceneNum}</span>` : '';
        bodyParts.push(`<p class="scene-heading">${num}${esc(text)}</p>`);
      } else if (type === 'character' || type === 'narrator' || type === 'announcer') {
        const cls = type === 'narrator' ? 'narrator' : type === 'announcer' ? 'announcer' : 'ad-character';
        bodyParts.push(`<p class="${cls}">${esc(text)}</p>`);
      } else if (type === 'dialogue') {
        bodyParts.push(`<p class="ad-dialogue">${esc(text)}</p>`);
      } else if (type === 'parenthetical') {
        bodyParts.push(`<p class="parenthetical">(${esc(text)})</p>`);
      } else if (type === 'sfx_cue' || type === 'sound_cue' || type === 'sound_effect') {
        bodyParts.push(`<p class="audio-cue sfx">[SFX: ${esc(text)}]</p>`);
      } else if (type === 'music_cue') {
        bodyParts.push(`<p class="audio-cue music">[MUSIC: ${esc(text)}]</p>`);
      } else if (type === 'ambience_cue' || type === 'ambience') {
        bodyParts.push(`<p class="audio-cue ambience">[AMBIENCE: ${esc(text)}]</p>`);
      } else if (type === 'act_break') {
        bodyParts.push(`<p class="act-break">${esc(text)}</p>`);
      } else {
        bodyParts.push(`<p class="action">${esc(text)}</p>`);
      }
    } else if (isStagePlay) {
      // ── Stage Play rendering ───────────────────────────────
      if (type === 'scene_heading' || type === 'heading') {
        sceneNum++;
        const num = cfg.sceneNumbers ? `<span class="scene-num">${sceneNum}</span>` : '';
        bodyParts.push(`<p class="scene-heading">${num}${esc(text)}</p>`);
      } else if (type === 'character') {
        bodyParts.push(`<p class="character">${esc(text)}</p>`);
      } else if (type === 'dialogue') {
        bodyParts.push(`<p class="dialogue">${esc(text)}</p>`);
      } else if (type === 'parenthetical') {
        bodyParts.push(`<p class="parenthetical">(${esc(text)})</p>`);
      } else if (type === 'song_title') {
        bodyParts.push(`<p class="song-title">♪ ${esc(text)}</p>`);
      } else if (type === 'lyric') {
        bodyParts.push(`<p class="lyric">${esc(text)}</p>`);
      } else if (type === 'dance_direction') {
        bodyParts.push(`<p class="stage-cue dance">[DANCE: ${esc(text)}]</p>`);
      } else if (type === 'musical_cue') {
        bodyParts.push(`<p class="stage-cue musical">[MUSIC: ${esc(text)}]</p>`);
      } else if (type === 'lighting_cue') {
        bodyParts.push(`<p class="stage-cue lighting">[LX: ${esc(text)}]</p>`);
      } else if (type === 'set_direction') {
        bodyParts.push(`<p class="stage-cue set">[SET: ${esc(text)}]</p>`);
      } else if (type === 'transition') {
        bodyParts.push(`<p class="transition">${esc(text)}</p>`);
      } else {
        bodyParts.push(`<p class="action">${esc(text)}</p>`);
      }
    } else {
      // ── Standard Screenplay rendering ─────────────────────
      if (type === 'scene_heading' || type === 'heading') {
        sceneNum++;
        const num = cfg.sceneNumbers ? `<span class="scene-num">${sceneNum}</span>` : '';
        bodyParts.push(`<p class="scene-heading">${num}${esc(text)}</p>`);
      } else if (type === 'character') {
        bodyParts.push(`<p class="character">${esc(text)}</p>`);
      } else if (type === 'dialogue') {
        bodyParts.push(`<p class="dialogue">${esc(text)}</p>`);
      } else if (type === 'parenthetical') {
        bodyParts.push(`<p class="parenthetical">(${esc(text)})</p>`);
      } else if (type === 'transition') {
        bodyParts.push(`<p class="transition">${esc(text)}</p>`);
      } else {
        bodyParts.push(`<p class="action">${esc(text)}</p>`);
      }
    }
  }

  const watermarkCSS = cfg.watermarkEnabled
    ? `body::after{content:"${cfg.watermarkText}";position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80pt;color:rgba(200,0,0,${wmOpacity});pointer-events:none;z-index:9999;white-space:nowrap;}`
    : '';

  const accentColor = primaryColor || '#3B82F6';

  // ─── Format-specific CSS ─────────────────────────────────────────────────
  const audioDramaCSS = isAudioDrama ? `
    .ad-character{text-transform:uppercase;font-weight:bold;margin-top:14px;margin-bottom:0;}
    .narrator{text-transform:uppercase;font-weight:bold;margin-top:14px;font-style:italic;color:#444;}
    .announcer{text-transform:uppercase;font-weight:bold;margin-top:14px;color:#22557a;}
    .ad-dialogue{margin:2px 0 10px 0;padding-left:0.5in;padding-right:0.5in;}
    .audio-cue{font-style:italic;margin:8px 0;padding:4px 8px;border-left:3px solid #ccc;color:#444;}
    .audio-cue.sfx{border-color:#0ea5e9;color:#0c4a6e;}
    .audio-cue.music{border-color:#8b5cf6;color:#3b0764;}
    .audio-cue.ambience{border-color:#10b981;color:#064e3b;}
    .act-break{text-align:center;font-weight:bold;text-transform:uppercase;font-size:14pt;margin:32px 0;border-top:2px solid #333;border-bottom:2px solid #333;padding:8px 0;}
  ` : '';

  const stageCSSExtra = isStagePlay ? `
    .song-title{text-align:center;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;margin:24px 0 8px 0;font-size:${cfg.fontSize + 1}pt;}
    .lyric{text-align:center;font-style:italic;margin:2px 0;padding-left:1.5in;padding-right:1.5in;}
    .stage-cue{font-style:italic;margin:6px 0;color:#555;}
    .stage-cue.lighting{text-align:right;}
    .stage-cue.musical{text-align:right;}
    .stage-cue.dance{text-align:center;}
    .stage-cue.set{margin:8px 0;padding-left:0.5in;}
  ` : '';

  // Margins: audio drama uses narrower margins; stage play uses standard play margins
  const pageMargin = isAudioDrama ? '0.75in' : isStagePlay ? '1in 1in 1in 1.25in' : '1in';
  const charIndent = isAudioDrama ? '0' : isStagePlay ? '2.5in' : '2in';
  const dialoguePadding = isAudioDrama ? '0 0.5in' : isStagePlay ? '0 1.5in 0 1.75in' : '0 1.5in';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(data.script_title || data.project_name)}</title>
<style>
@page{size:letter;margin:${pageMargin};}
body{font-family:'${font}',Courier,monospace;font-size:${cfg.fontSize}pt;line-height:1.5;color:#111;max-width:7.5in;margin:0 auto;padding:40px 20px;}
${watermarkCSS}
.cover-page{text-align:center;padding-top:3in;}
.cover-company{font-size:14pt;color:#555;margin-bottom:12px;}
.cover-title{font-size:24pt;margin:0 0 12px 0;text-transform:uppercase;}
.cover-subtitle{font-size:12pt;color:#555;margin-bottom:8px;}
.cover-draft{font-size:10pt;color:#888;margin-top:24px;}
.cover-contact{font-size:10pt;color:#888;margin-top:48px;white-space:pre-line;}
.page-header{display:flex;align-items:center;justify-content:space-between;font-size:8pt;color:#888;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:24px;}
.header-company{font-weight:bold;color:#555;}
.header-draft{margin-left:auto;margin-right:12px;}
.header-date{color:#aaa;}
.scene-heading{font-weight:bold;text-transform:uppercase;margin-top:24px;margin-bottom:12px;border-bottom:1px solid ${accentColor}20;padding-bottom:4px;}
.scene-num{margin-right:12px;color:${accentColor};}
.action{margin:6px 0;}
.character{text-align:left;padding-left:${charIndent};text-transform:uppercase;font-weight:bold;margin-top:18px;margin-bottom:0;}
.dialogue{margin:0;padding:${dialoguePadding};}
.parenthetical{padding-left:${isAudioDrama ? '0.25in' : '1.8in'};padding-right:${isAudioDrama ? '0.25in' : '1.8in'};font-style:italic;color:#555;margin:0;}
.transition{text-align:right;text-transform:uppercase;margin:18px 0;}
${audioDramaCSS}
${stageCSSExtra}
@media print{body{max-width:none;padding:0;margin:0;}.page-header{position:running(header);}}
</style></head>
<body>${bodyParts.join('\n')}</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Generate downloadable export blob ──

function generateExport(data: any): Blob {
  const { content, format, config: cfg } = data;
  const elements = Array.isArray(content) ? content : [];

  if (format === 'html') {
    return new Blob([generateScreenplayHTML(data)], { type: 'text/html' });
  }

  if (format === 'fountain') {
    const fountain: string[] = [];
    fountain.push(`Title: ${data.script_title}`);
    if (cfg.coverCompanyName) fountain.push(`Credit: ${cfg.coverCompanyName}`);
    if (cfg.coverSubtitle) fountain.push(`Author: ${cfg.coverSubtitle}`);
    if (cfg.draftLabel) fountain.push(`Draft date: ${cfg.draftLabel}`);
    if (cfg.contactInfo) fountain.push(`Contact: ${cfg.contactInfo}`);
    fountain.push('', '===', '');
    for (const el of elements) {
      const type = (el.type || '').toLowerCase();
      const text = el.text || '';
      if (type === 'scene_heading' || type === 'heading') {
        fountain.push('', text.startsWith('INT.') || text.startsWith('EXT.') ? text : `.${text}`, '');
      } else if (type === 'character') {
        fountain.push('', text.toUpperCase());
      } else if (type === 'dialogue') {
        fountain.push(text);
      } else if (type === 'parenthetical') {
        fountain.push(`(${text})`);
      } else if (type === 'transition') {
        fountain.push('', `> ${text}`);
      } else {
        fountain.push('', text);
      }
    }
    return new Blob([fountain.join('\n')], { type: 'text/plain;charset=utf-8' });
  }

  if (format === 'fdx') {
    // Final Draft XML (FDX) format
    const fdxParts: string[] = [];
    fdxParts.push('<?xml version="1.0" encoding="UTF-8"?>');
    fdxParts.push('<FinalDraft DocumentType="Script" Template="No" Version="5">');
    fdxParts.push('<Content>');
    for (const el of elements) {
      const type = (el.type || '').toLowerCase();
      const text = el.text || '';
      let fdxType = 'Action';
      if (type === 'scene_heading' || type === 'heading') fdxType = 'Scene Heading';
      else if (type === 'character') fdxType = 'Character';
      else if (type === 'dialogue') fdxType = 'Dialogue';
      else if (type === 'parenthetical') fdxType = 'Parenthetical';
      else if (type === 'transition') fdxType = 'Transition';
      else if (type === 'general' || type === 'note') fdxType = 'General';
      fdxParts.push(`<Paragraph Type="${fdxType}">`);
      fdxParts.push(`<Text>${esc(text)}</Text>`);
      fdxParts.push('</Paragraph>');
    }
    fdxParts.push('</Content>');

    // Title page
    if (cfg.includeCover) {
      fdxParts.push('<TitlePage>');
      fdxParts.push('<Content>');
      fdxParts.push(`<Paragraph Type="Title"><Text>${esc(data.script_title || data.project_name)}</Text></Paragraph>`);
      if (cfg.coverSubtitle) fdxParts.push(`<Paragraph Type="Author"><Text>${esc(cfg.coverSubtitle)}</Text></Paragraph>`);
      if (cfg.contactInfo) fdxParts.push(`<Paragraph Type="Contact"><Text>${esc(cfg.contactInfo)}</Text></Paragraph>`);
      if (cfg.draftLabel) fdxParts.push(`<Paragraph Type="Draft"><Text>${esc(cfg.draftLabel)}</Text></Paragraph>`);
      fdxParts.push('</Content>');
      fdxParts.push('</TitlePage>');
    }

    fdxParts.push('</FinalDraft>');
    return new Blob([fdxParts.join('\n')], { type: 'application/xml;charset=utf-8' });
  }

  if (format === 'docx') {
    // Word-compatible HTML (Word opens .doc HTML files natively)
    const htmlContent = generateScreenplayHTML(data);
    const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
${htmlContent.match(/<style>[\s\S]*?<\/style>/)?.[0] || ''}
</head>
<body>${htmlContent.match(/<body>([\s\S]*?)<\/body>/)?.[1] || ''}</body></html>`;
    return new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
  }

  // Fallback: plain text
  const lines: string[] = [];
  let sceneNum = 0;
  if (cfg.includeCover) {
    if (cfg.coverCompanyName) lines.push(cfg.coverCompanyName);
    lines.push('', data.script_title || data.project_name, '');
    if (cfg.coverSubtitle) lines.push(cfg.coverSubtitle);
    if (cfg.draftLabel) lines.push(cfg.draftLabel);
    if (cfg.contactInfo) lines.push('', cfg.contactInfo);
    lines.push('', '---', '');
  }
  for (const el of elements) {
    const type = (el.type || '').toLowerCase();
    const text = el.text || '';
    if (type === 'scene_heading' || type === 'heading') { sceneNum++; lines.push('', cfg.sceneNumbers ? `${sceneNum}. ${text}` : text, ''); }
    else if (type === 'character') lines.push('', `\t\t\t${text}`);
    else if (type === 'dialogue') lines.push(`\t\t${text}`);
    else if (type === 'parenthetical') lines.push(`\t\t(${text})`);
    else if (type === 'transition') lines.push('', `\t\t\t\t\t${text}`, '');
    else lines.push(text);
  }
  return new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
}
