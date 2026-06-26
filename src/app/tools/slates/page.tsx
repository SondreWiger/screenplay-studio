'use client';

import { useState, useCallback } from 'react';
import { ConverterLayout } from '../converter-layout';
import { OrangeButton, GhostButton } from '../shared';
import { parsePDF } from '@/lib/scripts/pdf';

const ORANGE = '#FF5F1F';

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
    project: '', scene: '', take: '1', director: '', dop: '',
    date: new Date().toISOString().split('T')[0], camera: '', lens: '',
    fps: '24', notes: '', production: '', roll: '', sound: 'SYNC', mos: false,
  });
  const [extracting, setExtracting] = useState(false);

  const update = (field: keyof SlateData, value: string | boolean) =>
    setSlate(prev => ({ ...prev, [field]: value }));

  const extractFromPDF = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setExtracting(true);
      try {
        const result = await parsePDF(file);
        if (result.titlePage.title) update('project', result.titlePage.title);
        if (result.titlePage.author) update('director', result.titlePage.author);
      } finally { setExtracting(false); }
    };
    input.click();
  }, []);

  const generateSlateText = (): string => {
    const p = (s: string) => s.padEnd(36);
    return [
      '╔══════════════════════════════════════════════════╗',
      '║                  SLATE                           ║',
      '╠══════════════════════════════════════════════════╣',
      `║  PROJECT:   ${p(slate.project)}║`,
      `║  PRODUCTION:${p(slate.production)}║`,
      '╠══════════════════════════════════════════════════╣',
      `║  SCENE:     ${p(slate.scene)}║`,
      `║  TAKE:      ${p(slate.take)}║`,
      `║  ROLL:      ${p(slate.roll)}║`,
      '╠══════════════════════════════════════════════════╣',
      `║  DIRECTOR:  ${p(slate.director)}║`,
      `║  DOP:       ${p(slate.dop)}║`,
      `║  CAMERA:    ${p(slate.camera)}║`,
      `║  LENS:      ${p(slate.lens)}║`,
      '╠══════════════════════════════════════════════════╣',
      `║  DATE:      ${p(slate.date)}║`,
      `║  FPS:       ${p(slate.fps)}║`,
      `║  SOUND:     ${p(slate.mos ? 'MOS' : slate.sound)}║`,
      '╠══════════════════════════════════════════════════╣',
      `║  NOTES:     ${p(slate.notes)}║`,
      '╚══════════════════════════════════════════════════╝',
    ].join('\n');
  };

  const downloadSlate = () => {
    const blob = new Blob([generateSlateText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slate_${slate.scene || 'X'}_take${slate.take}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ConverterLayout title="Production Slates" description="Generate production slate cards for your shoot.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Form */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-1 rounded-full" style={{ background: ORANGE }} />
              <span className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/25 font-mono">SLATE DETAILS</span>
            </div>
            <button
              onClick={extractFromPDF}
              disabled={extracting}
              className="text-[10px] font-bold uppercase tracking-[0.12em] underline underline-offset-4 disabled:opacity-30"
              style={{ color: ORANGE }}
            >
              {extracting ? 'Extracting…' : 'Extract from PDF'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {([
              ['Project', 'project'], ['Production', 'production'], ['Scene', 'scene'],
              ['Take', 'take'], ['Roll', 'roll'], ['Director', 'director'],
              ['DOP', 'dop'], ['Camera', 'camera'], ['Lens', 'lens'], ['FPS', 'fps'],
            ] as const).map(([label, field]) => (
              <Field key={field} label={label} value={slate[field]} onChange={v => update(field, v)} />
            ))}
            <Field label="Date" value={slate.date} onChange={v => update('date', v)} type="date" />
            <div>
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 font-mono mb-1.5 block">Sound</label>
              <select
                value={slate.mos ? 'mos' : slate.sound}
                onChange={e => {
                  if (e.target.value === 'mos') { update('mos', true); }
                  else { update('mos', false); update('sound', e.target.value); }
                }}
                className="w-full px-3 py-2 bg-transparent border text-sm text-white/80"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <option value="SYNC" className="bg-black">SYNC</option>
                <option value="WILD" className="bg-black">WILD</option>
                <option value="SLATE" className="bg-black">SLATE</option>
                <option value="mos" className="bg-black">MOS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 font-mono mb-1.5 block">Notes</label>
            <textarea
              value={slate.notes}
              onChange={e => update('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-transparent border text-sm text-white/80 resize-none"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            />
          </div>

          <div className="flex gap-3">
            <GhostButton onClick={() => navigator.clipboard.writeText(generateSlateText())}>
              Copy to Clipboard
            </GhostButton>
            <OrangeButton onClick={downloadSlate}>
              Download .txt
            </OrangeButton>
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-1 rounded-full" style={{ background: ORANGE }} />
            <span className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/25 font-mono">PREVIEW</span>
          </div>
          <pre
            className="p-6 text-xs text-white/60 font-mono whitespace-pre overflow-x-auto leading-relaxed"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
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
      <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 font-mono mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-transparent border text-sm text-white/80"
        style={{ borderColor: 'rgba(255,255,255,0.1)' }}
      />
    </div>
  );
}
