'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { SiteVersion } from '@/components/SiteVersion';

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/25 font-mono">
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
        className="pointer-events-none fixed inset-0 opacity-[0.032]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 border-b border-white/5">
        <div className="max-w-screen-lg mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-brand-500" />
            <Label>SCREENPLAY STUDIO — TOOLS</Label>
          </div>
          <div className="hidden md:flex items-center gap-5">
            <SiteVersion />
          </div>
        </div>
      </div>

      <nav className="relative z-10 border-b border-white/5">
        <div className="max-w-screen-lg mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center bg-brand-500 text-[8px] font-black text-white shrink-0">
              SS
            </div>
            <div className="leading-none">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80 leading-none">SCREENPLAY</p>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] leading-none text-brand-500">STUDIO</p>
            </div>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/tools" className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60 hover:text-white transition-colors">
              Tools
            </Link>
            <Link href="/dashboard" className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30 hover:text-white/70 transition-colors">
              Dashboard
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white bg-brand-500 transition-all duration-150 hover:-translate-y-px"
            >
              Open App
              <span className="transition-transform duration-150">→</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <section className="max-w-screen-lg mx-auto px-6 pt-20 pb-16">
          <Eyebrow>Tools</Eyebrow>
          <h1
            className="font-black text-white mb-4"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.03em', lineHeight: 0.95 }}
          >
            {title}
          </h1>
          <p className="text-base text-white/40 leading-relaxed max-w-lg">{description}</p>
        </section>

        <div className="max-w-screen-lg mx-auto px-6">
          <div className="h-px bg-white/7" />
        </div>

        <section className="max-w-screen-lg mx-auto px-6 py-12">
          {children}
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-screen-lg mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 flex items-center justify-center bg-brand-500">
              <span className="font-black text-white text-[7px]" style={{ letterSpacing: '-0.04em' }}>SS</span>
            </div>
            <Label>SCREENPLAY STUDIO</Label>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/" className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/20 hover:text-white/50 transition-colors">
              Home
            </Link>
            <Link href="/dashboard" className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/20 hover:text-white/50 transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
