'use client';

import { ReactNode } from 'react';
import Link from 'next/link';

interface ConverterLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function ConverterLayout({ title, description, children }: ConverterLayoutProps) {
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
          <Link href="/tools" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            Tools
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
              <Link href="/tools" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
                Tools
              </Link>
              <div className="h-px flex-1 bg-border" />
            </div>
            <h1 className="text-4xl font-light text-foreground text-center mb-2">{title}</h1>
            <p className="text-sm text-muted-foreground text-center">{description}</p>
          </div>
          {children}
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
