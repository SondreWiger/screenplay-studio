'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { PollModal } from '@/components/PollModal';
import { cleanPollSource } from '@/lib/polls/analytics';

export default function PollPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  // ?src=notification / ?src=email from the links we send; anything else is a shared link
  const source = cleanPollSource(useSearchParams()?.get('src')) ?? 'link';

  const handleClose = () => {
    // Try to go back, fall back to dashboard
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/dashboard');
    }
  };

  return (
    // Branded radial gradient bg — gives depth behind the modal overlay
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(ellipse at 50% -10%, rgba(255,95,31,0.12) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(99,102,241,0.06) 0%, transparent 50%), #0a0a0b',
      }}
    >
      <PollModal pollId={params.id} source={source} onClose={handleClose} />
    </div>
  );
}
