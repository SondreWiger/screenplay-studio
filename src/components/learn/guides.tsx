import type { ReactNode } from 'react';
import { BookOpenText, Calculator, Clapperboard, ClipboardList, Globe2, Keyboard, LayoutGrid, PenLine } from 'lucide-react';

export interface Guide {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  group: 'Core tools' | 'Production' | 'Reference';
}

const ic = 'h-5 w-5';

/** Every guide in the learning hub, in reading order. */
export const GUIDES: Guide[] = [
  { href: '/learn/script-editor', title: 'Script Editor', description: 'Master formatting, shortcuts, and the core writing experience.', icon: <PenLine className={ic} />, group: 'Core tools' },
  { href: '/learn/worldbuilding', title: 'Worldbuilding', description: 'Create and connect characters, locations, and lore.', icon: <Globe2 className={ic} />, group: 'Core tools' },
  { href: '/learn/beat-board', title: 'Beat Board', description: 'Plan your story visually with interactive index cards.', icon: <LayoutGrid className={ic} />, group: 'Core tools' },
  { href: '/learn/shot-list', title: 'Shot List', description: 'Plan your cinematography shot by shot.', icon: <Clapperboard className={ic} />, group: 'Production' },
  { href: '/learn/call-sheets', title: 'Call Sheets', description: 'Organize your cast and crew for the shooting day.', icon: <ClipboardList className={ic} />, group: 'Production' },
  { href: '/learn/budget', title: 'Budgeting', description: 'Track your expenses and manage your production budget.', icon: <Calculator className={ic} />, group: 'Production' },
  { href: '/learn/keybinds', title: 'Keyboard Shortcuts', description: 'Work faster with the full list of keybinds.', icon: <Keyboard className={ic} />, group: 'Reference' },
  { href: '/tutorials', title: 'Tutorials', description: 'Step-by-step walkthroughs from blank page to production.', icon: <BookOpenText className={ic} />, group: 'Reference' },
];
