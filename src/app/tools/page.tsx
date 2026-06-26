'use client';

import Link from 'next/link';

const converters = [
  {
    id: 'pdf-to-fdx',
    name: 'PDF → FDX',
    description: 'Convert PDF screenplays to Final Draft XML format',
  },
  {
    id: 'pdf-to-fountain',
    name: 'PDF → Fountain',
    description: 'Convert PDF screenplays to Fountain plain text',
  },
  {
    id: 'fdx-to-fountain',
    name: 'FDX → Fountain',
    description: 'Convert Final Draft XML to Fountain plain text',
  },
  {
    id: 'fountain-to-fdx',
    name: 'Fountain → FDX',
    description: 'Convert Fountain plain text to Final Draft XML',
  },
];

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 lg:px-12 h-14 border-b border-border">
        <Link href="/" className="flex items-center gap-3 text-foreground">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="6" r="3" fill="currentColor" />
            <circle cx="18" cy="6" r="3" fill="currentColor" />
            <circle cx="6" cy="18" r="3" fill="currentColor" />
            <circle cx="18" cy="18" r="3" fill="currentColor" />
          </svg>
          <span className="font-semibold text-sm tracking-wide uppercase">Script Studio</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            Home
          </Link>
          <Link href="/dashboard" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex items-start justify-center pt-12 sm:pt-24 pb-12">
        <div className="max-w-screen-lg w-full px-6 lg:px-12">
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tools</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <h1 className="text-4xl font-light text-foreground text-center mb-2">Format Converters</h1>
            <p className="text-sm text-muted-foreground text-center">Convert screenplay files between PDF, Final Draft, and Fountain formats</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {converters.map((converter) => (
              <Link
                key={converter.id}
                href={`/tools/${converter.id}`}
                className="border border-border rounded-xl p-6 hover:border-foreground/20 transition-colors bg-card group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-foreground group-hover:text-orange-500 transition-colors">
                      {converter.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">{converter.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-6 lg:px-12">
        <div className="max-w-screen-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="6" cy="6" r="3" fill="currentColor" />
              <circle cx="18" cy="6" r="3" fill="currentColor" />
              <circle cx="6" cy="18" r="3" fill="currentColor" />
              <circle cx="18" cy="18" r="3" fill="currentColor" />
            </svg>
            <span className="text-xs text-muted-foreground">Script Studio</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            <Link href="/dashboard" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
