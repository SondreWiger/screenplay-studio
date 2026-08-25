import React from 'react';
import Link from 'next/link';

export default function LearnPage() {
  const modules = [
    { title: 'Script Editor', description: 'Master formatting, shortcuts, and the core writing experience.', icon: '✎', href: '/learn/script-editor' },
    { title: 'Worldbuilding', description: 'Create and connect characters, locations, and lore.', icon: '🌍', href: '/learn/worldbuilding' },
    { title: 'Beat Board', description: 'Plan your story visually with interactive index cards.', icon: '📋', href: '/learn/beat-board' },
    { title: 'Shot List', description: 'Plan your cinematography shot by shot.', icon: '🎥', href: '/learn/shot-list' },
    { title: 'Call Sheets', description: 'Organize your cast and crew for the shooting day.', icon: '📄', href: '/learn/call-sheets' },
    { title: 'Budgeting', description: 'Track your expenses and manage your production budget.', icon: '💰', href: '/learn/budget' },
    { title: 'Keyboard Shortcuts', description: 'Work faster with our comprehensive list of keybinds.', icon: '⌨️', href: '/learn/keybinds' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Learning Hub</h1>
        <p className="text-surface-400 text-lg">Master Screenplay Studio with our comprehensive guides and tutorials.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((mod) => (
          <Link key={mod.href} href={mod.href} className="group block">
            <div className="h-full p-6 rounded-2xl border border-surface-800/50 bg-surface-900/40 backdrop-blur-md transition-all duration-300 ease-spring group-hover:-translate-y-1 group-hover:border-brand-500/50 group-hover:bg-surface-800/50 group-hover:shadow-lg group-hover:shadow-brand-500/10">
              <div className="text-3xl mb-4 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform duration-300 origin-bottom-left">
                {mod.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-brand-400 transition-colors">{mod.title}</h3>
              <p className="text-sm text-surface-400 leading-relaxed">
                {mod.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
