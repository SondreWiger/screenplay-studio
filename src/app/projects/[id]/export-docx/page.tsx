'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useScriptStore, useProjectStore } from '@/lib/stores';
import { Button, Card, LoadingSpinner, toast, ToastContainer } from '@/components/ui';

const FONT = 'Courier New';
const FONT_SIZE_PT = 12;
const LINE_HEIGHT = 1.5;

function estimateBytes(text: string): number {
  return text.length * 2;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getElementType(el: { element_type: string; content: string }) {
  const t = (el.element_type || '').toLowerCase();
  return t;
}

function generateDocxHTML(
  title: string,
  author: string,
  dateStr: string,
  elements: { element_type: string; content: string; scene_number?: string | null }[]
): string {
  const bodyLines: string[] = [];

  bodyLines.push(`<div style="text-align:center;padding-top:3in;">`);
  bodyLines.push(`<div style="font-size:12pt;margin-bottom:12px;">${esc(title)}</div>`);
  bodyLines.push(`<div style="font-size:10pt;color:#666;margin-top:24px;">Written by</div>`);
  bodyLines.push(`<div style="font-size:12pt;margin-top:8px;">${esc(author)}</div>`);
  bodyLines.push(`<div style="font-size:10pt;color:#666;margin-top:24px;">${esc(dateStr)}</div>`);
  bodyLines.push(`</div>`);
  bodyLines.push(`<div style="page-break-after:always"></div>`);

  for (const el of elements) {
    const type = (el.element_type || '').toLowerCase();
    const text = el.content || '';

    if (type === 'scene_heading' || type === 'heading') {
      bodyLines.push(`<p style="font-weight:bold;text-transform:uppercase;margin-top:18pt;margin-bottom:12pt;text-align:left;">${esc(text)}</p>`);
    } else if (type === 'character') {
      bodyLines.push(`<p style="text-transform:uppercase;font-weight:bold;text-align:center;margin-left:35%;margin-top:18pt;margin-bottom:0;">${esc(text)}</p>`);
    } else if (type === 'dialogue') {
      bodyLines.push(`<p style="text-align:center;margin-left:15%;margin-right:15%;margin-top:0;margin-bottom:0;">${esc(text)}</p>`);
    } else if (type === 'parenthetical') {
      bodyLines.push(`<p style="text-align:center;margin-left:25%;margin-top:0;margin-bottom:0;color:#555;">(${esc(text)})</p>`);
    } else if (type === 'transition') {
      bodyLines.push(`<p style="text-align:right;text-transform:uppercase;font-weight:bold;margin-top:18pt;margin-bottom:12pt;">${esc(text)}</p>`);
    } else {
      bodyLines.push(`<p style="margin:6pt 0;">${esc(text)}</p>`);
    }
  }

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
@page{size:letter;margin:1in;}
body{font-family:'Courier New',Courier,monospace;font-size:12pt;line-height:1.5;color:#111;max-width:7.5in;margin:0 auto;padding:40px 20px;}
</style>
</head>
<body>
${bodyLines.join('\n')}
</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface DocxModule {
  Document: any;
  Packer: any;
  Paragraph: any;
  TextRun: any;
  HeadingLevel: any;
  AlignmentType: any;
  TabStopPosition: any;
  TabStopType: any;
  PageNumber: any;
  Footer: any;
  Header: any;
  NumberFormat: any;
}

async function loadDocx(): Promise<DocxModule | null> {
  try {
    const mod = await import('docx');
    return mod as unknown as DocxModule;
  } catch {
    return null;
  }
}

function buildDocxDocument(
  docx: DocxModule,
  title: string,
  author: string,
  dateStr: string,
  elements: { element_type: string; content: string; scene_number?: string | null }[]
) {
  const { Document, Paragraph, TextRun, AlignmentType, PageNumber, Footer, Header } = docx;

  const titlePageChildren = [
    new Paragraph({ spacing: { before: 4000 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: title, bold: true, size: 48, font: FONT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      children: [new TextRun({ text: 'Written by', size: 24, font: FONT, color: '666666' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [new TextRun({ text: author, size: 28, font: FONT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
      children: [new TextRun({ text: dateStr, size: 24, font: FONT, color: '666666' })],
    }),
  ];

  const scriptChildren: any[] = [];

  for (const el of elements) {
    const type = (el.element_type || '').toLowerCase();
    const text = el.content || '';

    if (type === 'scene_heading' || type === 'heading') {
      scriptChildren.push(
        new Paragraph({
          spacing: { before: 360, after: 120 },
          children: [new TextRun({ text, bold: true, font: FONT, size: FONT_SIZE_PT * 2, allCaps: true })],
        })
      );
    } else if (type === 'character') {
      scriptChildren.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { left: 4320 },
          spacing: { before: 360, after: 0 },
          children: [new TextRun({ text, bold: true, font: FONT, size: FONT_SIZE_PT * 2, allCaps: true })],
        })
      );
    } else if (type === 'dialogue') {
      scriptChildren.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { left: 2160, right: 2160 },
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text, font: FONT, size: FONT_SIZE_PT * 2 })],
        })
      );
    } else if (type === 'parenthetical') {
      scriptChildren.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { left: 3240, right: 3240 },
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text: `(${text})`, font: FONT, size: FONT_SIZE_PT * 2, italics: true })],
        })
      );
    } else if (type === 'transition') {
      scriptChildren.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 360, after: 120 },
          children: [new TextRun({ text, bold: true, font: FONT, size: FONT_SIZE_PT * 2, allCaps: true })],
        })
      );
    } else {
      scriptChildren.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [new TextRun({ text, font: FONT, size: FONT_SIZE_PT * 2 })],
        })
      );
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: FONT_SIZE_PT * 2 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: titlePageChildren,
      },
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: title, font: FONT, size: 18, color: '999999', italics: true })],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '999999' }),
                new TextRun({ text: '.', font: FONT, size: 18, color: '999999' }),
              ],
            })],
          }),
        },
        children: scriptChildren,
      },
    ],
  });

  return doc;
}

function ExportDocxPageInner({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { currentProject, fetchProject } = useProjectStore();
  const { currentScript, elements, fetchScripts, fetchElements } = useScriptStore();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [author, setAuthor] = useState('');
  const [docxAvailable, setDocxAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    loadDocx().then((mod) => setDocxAvailable(mod !== null));
    fetchProject(params.id);
    fetchScripts(params.id);
  }, [params.id, fetchProject, fetchScripts]);

  useEffect(() => {
    if (currentScript) {
      fetchElements(currentScript.id).then(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [currentScript, fetchElements]);

  useEffect(() => {
    if (user?.full_name) setAuthor(user.full_name);
    else if (user?.email) setAuthor(user.email);
  }, [user]);

  const scriptTitle = currentScript?.title || currentProject?.title || 'Untitled';
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const filteredElements = useMemo(() => {
    return elements
      .filter((el) => !el.is_omitted && el.element_type !== 'page_break' && el.element_type !== 'title_page')
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [elements]);

  const fileSizeEstimate = useMemo(() => {
    const totalText = filteredElements.map((el) => el.content).join('\n');
    const baseBytes = estimateBytes(totalText) + 2048;
    return formatFileSize(baseBytes);
  }, [filteredElements]);

  const handleDownload = useCallback(async () => {
    if (filteredElements.length === 0) {
      toast.error('No script content to export');
      return;
    }

    setExporting(true);
    try {
      const docx = await loadDocx();

      if (docx) {
        const doc = buildDocxDocument(docx, scriptTitle, author, dateStr, filteredElements);
        const blob = await docx.Packer.toBlob(doc);
        triggerDownload(blob, `${scriptTitle}.docx`);
        toast.success('DOCX exported successfully');
      } else {
        const html = generateDocxHTML(scriptTitle, author, dateStr, filteredElements);
        const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
        triggerDownload(blob, `${scriptTitle}.doc`);
        toast.success('Exported as Word-compatible HTML (.doc)');
      }
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed');
    }
    setExporting(false);
  }, [scriptTitle, author, dateStr, filteredElements]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950">
      <ToastContainer />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href={`/projects/${params.id}/script`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Script
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-black text-white tracking-tight">Export to DOCX</h1>
          <p className="text-sm text-surface-400 mt-1">
            Export your screenplay as a Word document.
          </p>
        </div>

        {filteredElements.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-surface-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No script content</h3>
            <p className="text-sm text-surface-400">Write some script elements first, then come back to export.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-5">
                <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-4">Export Settings</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-400 mb-1.5">Title</label>
                    <input
                      type="text"
                      value={scriptTitle}
                      readOnly
                      className="w-full bg-surface-800/80 border border-surface-700/80 rounded-lg px-3 py-2.5 text-sm text-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-surface-400 mb-1.5">Author</label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-surface-800/80 border border-surface-700/80 rounded-lg px-3 py-2.5 text-sm text-white font-medium placeholder:text-surface-600 focus:border-[#FF5F1F]/70 focus:outline-none focus:ring-2 focus:ring-[#FF5F1F]/20 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-surface-400 mb-1.5">Date</label>
                    <input
                      type="text"
                      value={dateStr}
                      readOnly
                      className="w-full bg-surface-800/80 border border-surface-700/80 rounded-lg px-3 py-2.5 text-sm text-white font-medium"
                    />
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-3">Details</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-400">Elements</span>
                    <span className="text-white font-medium">{filteredElements.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Font</span>
                    <span className="text-white font-medium">{FONT} {FONT_SIZE_PT}pt</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Format</span>
                    <span className="text-white font-medium">
                      {docxAvailable === null ? 'Checking...' : docxAvailable ? 'DOCX (docx)' : 'DOC (HTML)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Est. size</span>
                    <span className="text-white font-medium">{fileSizeEstimate}</span>
                  </div>
                </div>
              </Card>

              <Button
                className="w-full"
                size="lg"
                onClick={handleDownload}
                loading={exporting}
                disabled={filteredElements.length === 0}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download {docxAvailable ? 'DOCX' : 'DOC'}
              </Button>
            </div>

            <div className="lg:col-span-3">
              <Card className="p-5">
                <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-4">Preview</h2>
                <div
                  className="bg-white rounded-lg overflow-y-auto max-h-[75vh]"
                  style={{
                    fontFamily: `'${FONT}', monospace`,
                    fontSize: `${FONT_SIZE_PT}pt`,
                    lineHeight: LINE_HEIGHT,
                    padding: '40px 50px',
                  }}
                >
                  <div className="text-center mb-8" style={{ paddingTop: '1.5in' }}>
                    <div className="text-xl font-bold mb-6">{scriptTitle}</div>
                    <div className="text-sm text-gray-500 mt-6">Written by</div>
                    <div className="text-base mt-2">{author || 'Author'}</div>
                    <div className="text-sm text-gray-500 mt-6">{dateStr}</div>
                  </div>

                  <div className="border-t border-gray-200 my-4" />

                  {filteredElements.map((el, i) => {
                    const type = getElementType(el);
                    const text = el.content || '';

                    if (type === 'scene_heading' || type === 'heading') {
                      return (
                        <p key={i} style={{ fontWeight: 'bold', textTransform: 'uppercase', marginTop: '18pt', marginBottom: '12pt', textAlign: 'left', color: '#111' }}>
                          {text}
                        </p>
                      );
                    }
                    if (type === 'character') {
                      return (
                        <p key={i} style={{ textTransform: 'uppercase', fontWeight: 'bold', textAlign: 'center', marginLeft: '35%', marginTop: '18pt', marginBottom: 0, color: '#111' }}>
                          {text}
                        </p>
                      );
                    }
                    if (type === 'dialogue') {
                      return (
                        <p key={i} style={{ textAlign: 'center', marginLeft: '15%', marginRight: '15%', marginTop: 0, marginBottom: 0, color: '#333' }}>
                          {text}
                        </p>
                      );
                    }
                    if (type === 'parenthetical') {
                      return (
                        <p key={i} style={{ textAlign: 'center', marginLeft: '25%', marginTop: 0, marginBottom: 0, color: '#555', fontStyle: 'italic' }}>
                          ({text})
                        </p>
                      );
                    }
                    if (type === 'transition') {
                      return (
                        <p key={i} style={{ textAlign: 'right', textTransform: 'uppercase', fontWeight: 'bold', marginTop: '18pt', marginBottom: '12pt', color: '#111' }}>
                          {text}
                        </p>
                      );
                    }
                    return (
                      <p key={i} style={{ margin: '6pt 0', color: '#333' }}>
                        {text}
                      </p>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportDocxPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    }>
      <ExportDocxPageInner params={params} />
    </Suspense>
  );
}
