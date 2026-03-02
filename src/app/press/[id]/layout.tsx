import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Press Kit', template: '%s — Press Kit | Screenplay Studio' },
};

export default function PressLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {children}
    </div>
  );
}
