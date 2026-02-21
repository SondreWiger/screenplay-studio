import { Metadata } from 'next';
import { SupportButton } from '@/components/SupportButton';

export const metadata: Metadata = {
  title: 'Community — Screenplay Studio',
  description: 'Share scripts, get feedback, join writing challenges, and discover free-to-use screenplays.',
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SupportButton />
    </>
  );
}
