'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { SubNav } from '@/components/shell/SubNav';

const GROUPS = [
  { items: [{ href: '/learn', label: 'Learning hub' }] },
  { label: 'Core tools', items: [
    { href: '/learn/script-editor', label: 'Script Editor' },
    { href: '/learn/worldbuilding', label: 'Worldbuilding' },
    { href: '/learn/beat-board', label: 'Beat Board' },
  ] },
  { label: 'Production', items: [
    { href: '/learn/shot-list', label: 'Shot List' },
    { href: '/learn/call-sheets', label: 'Call Sheets' },
    { href: '/learn/budget', label: 'Budgeting' },
  ] },
  { label: 'Reference', items: [
    { href: '/learn/keybinds', label: 'Keyboard Shortcuts' },
    { href: '/tutorials', label: 'Video tutorials' },
  ] },
];

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  return (
    <AppShell>
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-900/10 via-transparent to-transparent" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 md:py-10 lg:flex-row lg:gap-10">
          <SubNav
            id="learn"
            title="Learning hub"
            groups={GROUPS.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, active: pathname === i.href })) }))}
          />
          <div className="min-w-0 max-w-4xl flex-1">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
