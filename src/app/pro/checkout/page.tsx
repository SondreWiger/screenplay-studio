'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores';
import { Button, Card, LoadingPage } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';

// ============================================================
// Pro Checkout — PayPal return page
// Handles the redirect back from PayPal after payment approval
// ============================================================

export default function ProCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl animate-pulse">💳</div>
          <h1 className="text-xl font-bold text-white mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [status, setStatus] = useState<'processing' | 'success' | 'error' | 'cancelled'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<string>('/settings/billing');

  useEffect(() => {
    const urlStatus = searchParams.get('status');
    const token = searchParams.get('token'); // PayPal sends token param on approve

    if (urlStatus === 'cancelled') {
      setStatus('cancelled');
      return;
    }

    // Get orderId from sessionStorage (set before redirect to PayPal)
    const orderId = sessionStorage.getItem('paypal_order_id');
    if (!orderId) {
      setStatus('error');
      setError('No order found. Please try again from the Pro page.');
      return;
    }

    captureOrder(orderId);
  }, []);

  const captureOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Payment capture failed');
      }

      // Clear stored order
      sessionStorage.removeItem('paypal_order_id');
      sessionStorage.removeItem('paypal_plan');

      // Update auth state to reflect Pro status
      if (user) {
        useAuthStore.getState().setUser({ ...user, is_pro: true, pro_since: new Date().toISOString() });
      }

      setRedirect(data.redirect || '/settings/billing');
      setStatus('success');
    } catch (err: unknown) {
      console.error('Capture failed:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please contact support.');
    }
  };

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl animate-pulse">
            💳
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Processing your payment...</h1>
          <p className="text-surface-400 text-sm">Please don't close this tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950">
      <AppHeader />
      <div className="max-w-md mx-auto px-4 py-16">
        {status === 'success' && (
          <Card className="p-8 text-center border-2 border-green-500/30">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-2xl">
              ✓
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to Pro!</h1>
            <p className="text-surface-400 mb-6">
              Your payment was successful. All Pro features are now unlocked.
            </p>
            <Button className="w-full" onClick={() => router.push(redirect)}>
              Continue to Dashboard
            </Button>
          </Card>
        )}

        {status === 'cancelled' && (
          <Card className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-800 flex items-center justify-center text-2xl">
              ✕
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Payment Cancelled</h1>
            <p className="text-surface-400 mb-6">
              No worries — you weren't charged. You can upgrade anytime.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => router.push('/dashboard')}>
                Dashboard
              </Button>
              <Button className="flex-1" onClick={() => router.push('/pro')}>
                Try Again
              </Button>
            </div>
          </Card>
        )}

        {status === 'error' && (
          <Card className="p-8 text-center border-2 border-red-500/30">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center text-2xl">
              ⚠
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-surface-400 mb-2">{error}</p>
            <p className="text-xs text-surface-600 mb-6">
              If you were charged, please contact support at support@screenplaystudio.dev
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => router.push('/dashboard')}>
                Dashboard
              </Button>
              <Button className="flex-1" onClick={() => router.push('/pro')}>
                Try Again
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
