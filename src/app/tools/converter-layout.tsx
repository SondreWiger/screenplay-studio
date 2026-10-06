'use client';

import { ReactNode } from 'react';
import { ShellBack } from '@/components/shell/ShellActions';

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-white/55">
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-4 h-px shrink-0 bg-brand-500" />
      <Label>{children}</Label>
    </div>
  );
}

interface ConverterLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function ConverterLayout({ title, description, children }: ConverterLayoutProps) {
  return (
    <div className="min-h-screen relative" style={{ background: 'rgb(var(--surface-950))', color: '#fff' }}>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.032]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <ShellBack href="/tools" label="All tools" />
      <main className="relative z-10">
        <section className="max-w-screen-lg mx-auto px-6 pt-20 pb-16">
          <Eyebrow>Tools</Eyebrow>
          <h1
            className="font-semibold text-white mb-4"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.03em', lineHeight: 0.95 }}
          >
            {title}
          </h1>
          <p className="text-base text-white/50 leading-relaxed max-w-lg">{description}</p>
        </section>

        <div className="max-w-screen-lg mx-auto px-6">
          <div className="h-px bg-white/7" />
        </div>

        <section className="max-w-screen-lg mx-auto px-6 py-12">
          {children}
        </section>
      </main>

    </div>
  );
}
