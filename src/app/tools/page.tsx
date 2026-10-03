'use client';

import Link from 'next/link';
import { SiteVersion } from '@/components/SiteVersion';

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-white/55">
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-4 h-px shrink-0 bg-brand-500" />
      <Label>{children}</Label>
    </div>
  );
}

function Rule() {
  return <div className="h-px bg-white/7" />;
}

const sections = [
  {
    title: 'Format Converters',
    tag: 'CONVERT',
    tools: [
      { id: 'pdf-to-fdx', name: 'PDF → FDX', desc: 'Convert PDF screenplays to Final Draft XML format.' },
      { id: 'pdf-to-fountain', name: 'PDF → Fountain', desc: 'Convert PDF screenplays to Fountain plain text.' },
      { id: 'fdx-to-fountain', name: 'FDX → Fountain', desc: 'Convert Final Draft XML to Fountain plain text.' },
      { id: 'fountain-to-fdx', name: 'Fountain → FDX', desc: 'Convert Fountain plain text to Final Draft XML.' },
    ],
  },
  {
    title: 'Production Tools',
    tag: 'PRODUCTION',
    tools: [
      { id: 'slates', name: 'Production Slates', desc: 'Generate production slate cards with project, scene, and take details.' },
    ],
  },
  {
    title: 'Script Analysis',
    tag: 'ANALYSIS',
    tools: [
      { id: 'page-count', name: 'Page Count Calculator', desc: 'Estimate screenplay page count and runtime from your script file.' },
      { id: 'character-report', name: 'Character Report', desc: 'Analyze dialogue distribution across all characters in your script.' },
      { id: 'scene-list', name: 'Scene List', desc: 'Extract and list every scene with word counts and page estimates.' },
    ],
  },
];

export default function ToolsPage() {
  return (
    <div className="min-h-screen relative" style={{ background: 'rgb(var(--surface-950))', color: '#fff' }}>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.032]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 border-b border-white/5">
        <div className="max-w-screen-xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-brand-500" />
            <Label>SCREENPLAY STUDIO — TOOLS</Label>
          </div>
          <div className="hidden md:flex items-center gap-5">
            <SiteVersion />
          </div>
        </div>
      </div>



      <main className="relative z-10">
        <section className="max-w-screen-xl mx-auto px-6 pt-20 pb-16">
          <Eyebrow>Tools</Eyebrow>
          <h1
            className="font-semibold text-white mb-4"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', letterSpacing: '-0.03em', lineHeight: 0.95 }}
          >
            SCREENPLAY
            <br />
            <span className="text-brand-500">TOOLS.</span>
          </h1>
          <p className="text-base text-white/40 leading-relaxed max-w-lg">
            Convert, analyze, and prepare your screenplays. Free. No sign-up required.
          </p>
        </section>

        <div className="max-w-screen-xl mx-auto px-6"><Rule /></div>

        {sections.map((section, sIdx) => (
          <section key={section.tag} className="max-w-screen-xl mx-auto px-6 py-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1 h-1 rounded-full bg-brand-500" />
              <Label>{section.tag}</Label>
              <span className="text-white/10">·</span>
              <span className="text-xs text-white/30 font-medium">{section.title}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.tools.map((tool) => (
                <Link
                  key={tool.id}
                  href={`/tools/${tool.id}`}
                  className="group border border-white/6 p-6 transition-all duration-200 hover:bg-white/[0.03] hover:border-white/10"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-bold text-white/80 group-hover:text-white transition-colors" style={{ letterSpacing: '-0.01em' }}>
                      {tool.name}
                    </h3>
                    <span className="text-xs text-brand-500 transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                  </div>
                  <p className="text-xs text-white/30 leading-relaxed">{tool.desc}</p>
                </Link>
              ))}
            </div>

            {sIdx < sections.length - 1 && <div className="mt-12"><Rule /></div>}
          </section>
        ))}
      </main>

    </div>
  );
}
