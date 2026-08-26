import React from 'react';
import Link from 'next/link';

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-surface-950 text-surface-50">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-surface-800 bg-surface-900/40 backdrop-blur-sm flex flex-col hidden md:flex">
        <div className="p-6 border-b border-surface-800">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="text-brand-500">❖</span>
            Screenplay Studio
          </h2>
          <p className="text-xs text-surface-400 mt-1 uppercase tracking-[0.04em] font-semibold">Learning Hub</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <nav className="space-y-1">
            <Link href="/learn" className="flex items-center px-3 py-2 text-sm font-medium rounded-xl text-surface-300 hover:text-white hover:bg-surface-800/50 transition-colors">
              <span className="mr-3 text-lg opacity-70">⌂</span> Home
            </Link>
          </nav>
          
          <div>
            <h3 className="px-3 text-xs font-semibold text-surface-500 uppercase tracking-[0.04em] mb-2">Core Tools</h3>
            <nav className="space-y-1">
              <Link href="/learn/script-editor" className="flex items-center px-3 py-2 text-sm font-medium rounded-xl text-surface-300 hover:text-white hover:bg-surface-800/50 transition-colors">
                <span className="mr-3 text-lg opacity-70">✎</span> Script Editor
              </Link>
              <Link href="/learn/worldbuilding" className="flex items-center px-3 py-2 text-sm font-medium rounded-xl text-surface-300 hover:text-white hover:bg-surface-800/50 transition-colors">
                <span className="mr-3 text-lg opacity-70">🌍</span> Worldbuilding
              </Link>
              <Link href="/learn/beat-board" className="flex items-center px-3 py-2 text-sm font-medium rounded-xl text-surface-300 hover:text-white hover:bg-surface-800/50 transition-colors">
                <span className="mr-3 text-lg opacity-70">📋</span> Beat Board
              </Link>
            </nav>
          </div>

          <div>
            <h3 className="px-3 text-xs font-semibold text-surface-500 uppercase tracking-[0.04em] mb-2">Production</h3>
            <nav className="space-y-1">
              <Link href="/learn/shot-list" className="flex items-center px-3 py-2 text-sm font-medium rounded-xl text-surface-300 hover:text-white hover:bg-surface-800/50 transition-colors">
                <span className="mr-3 text-lg opacity-70">🎥</span> Shot List
              </Link>
              <Link href="/learn/call-sheets" className="flex items-center px-3 py-2 text-sm font-medium rounded-xl text-surface-300 hover:text-white hover:bg-surface-800/50 transition-colors">
                <span className="mr-3 text-lg opacity-70">📄</span> Call Sheets
              </Link>
              <Link href="/learn/budget" className="flex items-center px-3 py-2 text-sm font-medium rounded-xl text-surface-300 hover:text-white hover:bg-surface-800/50 transition-colors">
                <span className="mr-3 text-lg opacity-70">💰</span> Budgeting
              </Link>
            </nav>
          </div>

          <div>
            <h3 className="px-3 text-xs font-semibold text-surface-500 uppercase tracking-[0.04em] mb-2">Reference</h3>
            <nav className="space-y-1">
              <Link href="/learn/keybinds" className="flex items-center px-3 py-2 text-sm font-medium rounded-xl text-surface-300 hover:text-white hover:bg-surface-800/50 transition-colors">
                <span className="mr-3 text-lg opacity-70">⌨️</span> Keyboard Shortcuts
              </Link>
            </nav>
          </div>
        </div>
        
        <div className="p-4 border-t border-surface-800">
          <Link href="/dashboard" className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium rounded-xl bg-surface-800 hover:bg-surface-700 text-white transition-all duration-300 ease-spring">
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-surface-950 relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-900/10 via-surface-950 to-surface-950"></div>
        <div className="relative z-10 max-w-5xl mx-auto p-6 md:p-12">
          {children}
        </div>
      </main>
    </div>
  );
}
