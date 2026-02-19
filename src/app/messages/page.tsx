import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/ui';

const MessagesClient = dynamic(() => import('./MessagesClient'), { ssr: false, loading: () => <div className="py-32"><LoadingSpinner /></div> });

export default function MessagesPage() {
  return <MessagesClient />;
}
