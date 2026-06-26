'use client';

import { useState, useCallback } from 'react';
import { ConverterLayout } from '../converter-layout';
import { parsePDF } from '@/lib/scripts/pdf';

interface SlateData {
  project: string;
  scene: string;
  take: string;
  director: string;
  dop: string;
  date: string;
  camera: string;
  lens: string;
  fps: string;
  notes: string;
  production: string;
  roll: string;
  sound: string;
  mos: boolean;
}

export default function SlatesPage() {
  const [slate, setSlate] = useState<SlateData>({
    project: '',
    scene: '',
    take: '1',
    director: '',
    dop: '',
    date: new Date().toISOString().split('T')[0],
    camera: '',
    lens: '',
    fps: '24',
    notes: '',
    production: '',
    roll: '',
    sound: 'SYNC',
    mos: false,
  });

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const updateField = (field: keyof SlateData, value: string | boolean) => {
    setSlate(prev => ({ ...prev, [field]: value }));
  };

  const extractFromPDF = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setExtracting(true);
      setExtractError(null);
      try {
        const result = await parsePDF(file);
        if (result.titlePage.title) {
          updateField('project', result.titlePage.title);
        }
        if (result.titlePage.author) {
          updateField('director', result.titlePage.author);
        }
      } catch (err) {
        setExtractError('Failed to parse PDF');
      } finally {
        setExtracting(false);
      }
    };
    input.click();
  }, []);

  const generateSlateText = (): string => {
    const lines = [
      '╔══════════════════════════════════════════════════╗',
      '║                  SLATE                           ║',
      '╠══════════════════════════════════════════════════╣',
      `║  PROJECT:   ${slate.project.padEnd(36)}║`,
      `║  PRODUCTION:${slate.production.padEnd(36)}║`,
      '╠══════════════════════════════════════════════════╣',
      `║  SCENE:     ${slate.scene.padEnd(36)}║`,
      `║  TAKE:      ${slate.take.padEnd(36)}║`,
      `║  ROLL:      ${slate.roll.padEnd(36)}║`,
      '╠══════════════════════════════════════════════════╣',
      `║  DIRECTOR:  ${slate.director.padEnd(36)}║`,
      `║  DOP:       ${slate.dop.padEnd(36)}║`,
      `║  CAMERA:    ${slate.camera.padEnd(36)}║`,
      `║  LENS:      ${slate.lens.padEnd(36)}║`,
      '╠══════════════════════════════════════════════════╣',
      `║  DATE:      ${slate.date.padEnd(36)}║`,
      `║  FPS:       ${slate.fps.padEnd(36)}║`,
      `║  SOUND:     ${(slate.mos ? 'MOS' : slate.sound).padEnd(36)}║`,
      '╠══════════════════════════════════════════════════╣',
      `║  NOTES:     ${slate.notes.padEnd(36)}║`,
      '╚══════════════════════════════════════════════════╝',
    ];
    return lines.join('\n');
  };

  const downloadSlate = () => {
    const text = generateSlateText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slate_${slate.scene || 'X'}_take${slate.take}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copySlate = () => {
    navigator.clipboard.writeText(generateSlateText());
  };

  return (
    <ConverterLayout title="Production Slates" description="Generate production slate cards for your shoot">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Slate Details</h2>
            <button
              onClick={extractFromPDF}
              disabled={extracting}
              className="text-xs text-orange-500 hover:text-orange-600 underline underline-offset-4 disabled:opacity-40"
            >
              {extracting ? 'Extracting…' : 'Extract from PDF'}
            </button>
          </div>
          {extractError && <p className="text-xs text-red-500">{extractError}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Project" value={slate.project} onChange={v => updateField('project', v)} />
            <Field label="Production" value={slate.production} onChange={v => updateField('production', v)} />
            <Field label="Scene" value={slate.scene} onChange={v => updateField('scene', v)} />
            <Field label="Take" value={slate.take} onChange={v => updateField('take', v)} />
            <Field label="Roll" value={slate.roll} onChange={v => updateField('roll', v)} />
            <Field label="Date" value={slate.date} onChange={v => updateField('date', v)} type="date" />
            <Field label="Director" value={slate.director} onChange={v => updateField('director', v)} />
            <Field label="DOP" value={slate.dop} onChange={v => updateField('dop', v)} />
            <Field label="Camera" value={slate.camera} onChange={v => updateField('camera', v)} />
            <Field label="Lens" value={slate.lens} onChange={v => updateField('lens', v)} />
            <Field label="FPS" value={slate.fps} onChange={v => updateField('fps', v)} />
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Sound</label>
              <div className="flex items-center gap-3">
                <select
                  value={slate.mos ? 'mos' : slate.sound}
                  onChange={e => {
                    if (e.target.value === 'mos') {
                      updateField('mos', true);
                    } else {
                      updateField('mos', false);
                      updateField('sound', e.target.value);
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-transparent border border-border rounded-md text-sm text-foreground"
                >
                  <option value="SYNC">SYNC</option>
                  <option value="WILD">WILD</option>
                  <option value="SLATE">SLATE</option>
                  <option value="mos">MOS</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Notes</label>
            <textarea
              value={slate.notes}
              onChange={e => updateField('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-transparent border border-border rounded-md text-sm text-foreground resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={copySlate}
              className="px-6 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-accent transition-colors"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={downloadSlate}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              Download .txt
            </button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <h2 className="text-sm font-medium text-foreground mb-3">Preview</h2>
          <pre className="bg-card border border-border rounded-xl p-6 text-sm text-foreground font-mono whitespace-pre overflow-x-auto">
            {generateSlateText()}
          </pre>
        </div>
      </div>
    </ConverterLayout>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-transparent border border-border rounded-md text-sm text-foreground"
      />
    </div>
  );
}
