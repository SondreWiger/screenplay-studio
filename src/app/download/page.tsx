'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SiteVersion } from '@/components/SiteVersion';
import {
  Monitor,
  Laptop,
  LayoutGrid,
  Download as DownloadIcon,
  Check,
  FileText,
  Users,
  Cloud,
  Palette,
  Zap,
  FolderOpen,
} from 'lucide-react';

const ORANGE = '#FF5F1F';
const GITHUB_REPO = 'SondreWiger/screenplay-studio';
const RELEASE_TAG = 'v1.0.0-electron.1';

function getDownloadUrl(os: string, ext: string): string {
  return `https://github.com/${GITHUB_REPO}/releases/download/${RELEASE_TAG}/ScreenplayStudio-${os}.${ext}`;
}

type Platform = 'macos' | 'windows' | 'linux';

const PLATFORMS: {
  key: Platform;
  label: string;
  icon: typeof Monitor;
  format: string;
  ext: string;
  os: string;
}[] = [
  { key: 'macos', label: 'macOS', icon: Laptop, format: '.dmg', ext: 'dmg', os: 'mac' },
  { key: 'windows', label: 'Windows', icon: Monitor, format: '.exe', ext: 'exe', os: 'win' },
  { key: 'linux', label: 'Linux', icon: LayoutGrid, format: '.AppImage', ext: 'AppImage', os: 'linux' },
];

const FEATURES = [
  { icon: FileText, title: 'Full Script Editor', desc: 'Industry-standard screenplay formatting with real-time preview.' },
  { icon: FolderOpen, title: 'Local Files', desc: 'Save and open .screenplay files directly on your machine.' },
  { icon: Cloud, title: 'Optional Cloud Sync', desc: 'Sign in to sync projects across devices. Work offline without an account.' },
  { icon: Users, title: 'Collaboration', desc: 'Real-time editing with your team when connected.' },
  { icon: Palette, title: 'Breakdowns & Storyboards', desc: 'Scene breakdowns, shot lists, and visual storyboarding.' },
  { icon: Zap, title: 'Auto-Updates', desc: 'Always on the latest version with silent background updates.' },
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/25 font-mono">
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-4 h-px shrink-0" style={{ background: ORANGE }} />
      <Label>{children}</Label>
    </div>
  );
}

function detectOS(): Platform {
  if (typeof navigator === 'undefined') return 'macos';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  return 'linux';
}

export default function DownloadPage() {
  const [detected, setDetected] = useState<Platform>('macos');
  const [selected, setSelected] = useState<Platform>('macos');

  useEffect(() => {
    const os = detectOS();
    setDetected(os);
    setSelected(os);
  }, []);

  const dl = PLATFORMS.find((p) => p.key === selected)!;

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: 'rgb(var(--surface-950))', color: '#fff' }}>
      {/* dot-grid texture */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          opacity: 0.032,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* SYSTEM BAR */}
      <div className="relative z-10 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-screen-xl mx-auto px-6 h-8 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ORANGE }} />
              <Label>SCREENPLAY STUDIO — DOWNLOAD</Label>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-5">
            <SiteVersion />
          </div>
        </div>
      </div>

      {/* NAV */}
      <nav className="relative z-10 max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center text-[8px] font-black text-white shrink-0" style={{ background: ORANGE }}>SS</div>
          <div className="leading-none">
            <div className="text-[11px] font-bold tracking-[-0.03em] text-white/90">SCREENPLAY STUDIO</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/auth"
            className="h-8 px-4 flex items-center text-[10px] font-bold uppercase tracking-[0.12em] text-white/60 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/download"
            className="h-8 px-4 flex items-center text-[10px] font-bold uppercase tracking-[0.12em] text-white border transition-colors"
            style={{ borderColor: ORANGE, background: `${ORANGE}15` }}
          >
            Download
          </Link>
        </div>
      </nav>

      {/* MAIN */}
      <main className="relative z-10 max-w-screen-xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="max-w-2xl mb-16">
          <Eyebrow>Download</Eyebrow>
          <h1
            className="font-black text-white mb-6"
            style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', letterSpacing: '-0.03em', lineHeight: 0.95 }}
          >
            WRITE.<br />OFFLINE.<br />
            <span style={{ color: ORANGE }}>SYNC.</span>
          </h1>
          <p className="text-base text-white/40 leading-relaxed max-w-lg">
            Screenplay Studio runs natively on your desktop. Write without an internet connection,
            save files locally, and optionally sync to the cloud when you sign in.
          </p>
        </div>

        {/* Platform selector + download */}
        <div className="flex flex-col md:flex-row gap-8 mb-20">
          {/* Platform tabs */}
          <div className="flex flex-row md:flex-col gap-2">
            {PLATFORMS.map((p) => {
              const Icon = p.icon;
              const isDetected = p.key === detected;
              return (
                <button
                  key={p.key}
                  onClick={() => setSelected(p.key)}
                  className={`flex items-center gap-3 px-4 py-3 border text-left transition-all ${
                    selected === p.key
                      ? 'border-white/20 bg-white/5'
                      : 'border-white/5 bg-transparent hover:border-white/10 hover:bg-white/[0.02]'
                  }`}
                >
                  <Icon size={18} style={{ color: selected === p.key ? ORANGE : 'rgba(255,255,255,0.3)' }} />
                  <div>
                    <div className="text-sm font-bold text-white/90">{p.label}</div>
                    <div className="text-[10px] text-white/30 font-mono">{p.format}</div>
                  </div>
                  {isDetected && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border" style={{ borderColor: `${ORANGE}40`, color: ORANGE }}>
                      Detected
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Download card */}
          <div className="flex-1 border p-8 flex flex-col justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 mb-2 font-mono">
                {dl.label} — {dl.format}
              </div>
              <h2 className="text-2xl font-black text-white mb-3" style={{ letterSpacing: '-0.02em' }}>
                Screenplay Studio for {dl.label}
              </h2>
              <p className="text-xs text-white/40 leading-relaxed mb-4">
                Native desktop app with full offline support. Save projects to your hard drive,
                open .screenplay files, and sync when you&apos;re ready.
              </p>
              {selected === 'macos' && (
                <p className="text-[11px] text-white/30 leading-relaxed mb-4 border-l-2 pl-3" style={{ borderColor: ORANGE }}>
                  macOS may show a security warning on first launch. Right-click the app → Open → Open to bypass.
                </p>
              )}
              <div className="flex flex-wrap gap-3 text-[10px] text-white/30 mb-8">
                <span className="flex items-center gap-1"><Check size={12} style={{ color: ORANGE }} /> Free forever</span>
                <span className="flex items-center gap-1"><Check size={12} style={{ color: ORANGE }} /> No account required</span>
                <span className="flex items-center gap-1"><Check size={12} style={{ color: ORANGE }} /> Auto-updates</span>
                <span className="flex items-center gap-1"><Check size={12} style={{ color: ORANGE }} /> Works offline</span>
              </div>
            </div>
            <a
              href={getDownloadUrl(dl.os, dl.ext)}
              download
              className="inline-flex items-center justify-center gap-2 h-12 px-8 text-sm font-bold uppercase tracking-[0.12em] text-white transition-all hover:opacity-90"
              style={{ background: ORANGE }}
            >
              <DownloadIcon size={16} />
              Download for {dl.label}
            </a>
          </div>
        </div>

        {/* Features grid */}
        <div className="mb-20">
          <Eyebrow>Features</Eyebrow>
          <h2 className="font-black text-white mb-10" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', letterSpacing: '-0.02em', lineHeight: 0.95 }}>
            EVERYTHING YOU NEED.
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="p-6 border" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                  <Icon size={20} style={{ color: ORANGE }} className="mb-4" />
                  <h3 className="text-sm font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* System requirements */}
        <div className="border p-8" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
          <Eyebrow>System Requirements</Eyebrow>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-bold text-white mb-2">macOS</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                macOS 11 (Big Sur) or later. Intel or Apple Silicon (M1/M2/M3/M4).
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-2">Windows</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Windows 10 (64-bit) or later. x86_64 processor.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-2">Linux</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Ubuntu 20.04+, Debian 11+, Fedora 36+, or equivalent. x86_64.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 hover:text-white/60 transition-colors">
              Home
            </Link>
            <Link href="/auth" className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 hover:text-white/60 transition-colors">
              Sign in
            </Link>
            <Link href="/docs" className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 hover:text-white/60 transition-colors">
              Docs
            </Link>
          </div>
          <Label>SCREENPLAY STUDIO — NORTHEM DEVELOPMENT</Label>
        </div>
      </main>
    </div>
  );
}
