'use client';

import { ReactNode } from 'react';

const ORANGE = '#FF5F1F';

interface UploadZoneProps {
  onFile: (file: File) => void;
  accept: string;
  label: string;
  sublabel: string;
  children?: ReactNode;
}

export function UploadZone({ onFile, accept, label, sublabel, children }: UploadZoneProps) {
  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) onFile(f);
    };
    input.click();
  };

  return (
    <div
      className="border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200 hover:bg-white/[0.02]"
      style={{ borderColor: 'rgba(255,255,255,0.1)' }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropped = e.dataTransfer.files[0];
        if (dropped) onFile(dropped);
      }}
      onClick={handleClick}
    >
      {children || (
        <>
          <p className="text-sm font-bold text-white/70">{label}</p>
          <p className="text-xs text-white/25 mt-1.5">{sublabel}</p>
        </>
      )}
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: string;
  sub?: string;
}

export function StatBox({ label, value, sub }: StatBoxProps) {
  return (
    <div className="border p-4 text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 font-mono mb-1">{label}</p>
      <p className="text-xl font-black text-white" style={{ letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p className="text-[10px] text-white/20 mt-0.5">{sub}</p>}
    </div>
  );
}

export function OrangeButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-6 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-white transition-all duration-150 hover:-translate-y-px disabled:opacity-30 disabled:cursor-not-allowed disabled:translate-y-0"
      style={{ background: ORANGE }}
    >
      {children}
    </button>
  );
}

export function GhostButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white/50 border transition-colors hover:text-white hover:bg-white/[0.03]"
      style={{ borderColor: 'rgba(255,255,255,0.1)' }}
    >
      {children}
    </button>
  );
}
