'use client';

import { useEffect, useState } from 'react';
import { Button, Input, LoadingSpinner, toast } from '@/components/ui';
import { useAuthStore } from '@/lib/stores';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function ClaimProPage() {
  const { user } = useAuthStore();
  const [transactionId, setTransactionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setCheckingExisting(false);
      return;
    }

    const checkPro = async () => {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_pro')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.is_pro) {
        toast.success('You already have Pro access! 🎉');
        setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
        return;
      }

      setCheckingExisting(false);
    };

    checkPro();
  }, [user?.id]);

  const handleClaim = async () => {
    if (!transactionId.trim()) {
      toast.error('Please enter your Ko-Fi transaction ID');
      return;
    }

    if (!user?.id) {
      toast.error('Please sign in first');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/donations/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kofiTransactionId: transactionId.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to claim Pro access');
        return;
      }

      toast.success('🎉 Pro access activated! Welcome to the Pro tier.');
      setTransactionId('');

      setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to process your request');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Claim Your Pro Access</h1>
          <p className="text-surface-400 mb-6">
            Please sign in to claim your Pro access from your donation.
          </p>
          <Link href="/auth">
            <Button className="w-full">Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-surface-900 border border-surface-700 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Claim Your Pro Access</h1>
          <p className="text-surface-400 mb-6">
            Thank you for your donation! If it hasn't activated automatically, enter your Ko-Fi transaction ID below to activate 2 months of Pro.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-2">
                Ko-Fi Transaction ID
              </label>
              <Input
                type="text"
                placeholder="Found in your Ko-Fi receipt email"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button
              onClick={handleClaim}
              disabled={isLoading || !transactionId.trim()}
              className="w-full"
            >
              {isLoading ? 'Processing...' : 'Claim Pro Access (2 Months)'}
            </Button>
          </div>

          <p className="text-xs text-surface-500 text-center mt-6">
            Your Ko-Fi transaction ID can be found in your Ko-Fi receipt email. Need help?{' '}
            <a href="mailto:help@screenplaystudio.fun" className="text-brand-400 hover:text-brand-300">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
