'use client';

import { useEffect, useState } from 'react';
import { DonationModal } from '@/components/DonationModal';
import { useAuthStore } from '@/lib/stores';

export function GlobalDonationPopup() {
  const { user } = useAuthStore();
  const [showDonation, setShowDonation] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    // Check if this user has already dismissed the donation modal
    const dismissedKey = `donation-modal-dismissed-${user.id}`;
    const isDismissed = localStorage.getItem(dismissedKey);

    // Ask only people who have been using the app for a while. Showing it two
    // seconds into a brand-new user's first visit was their first impression.
    const firstSeenKey = `ss-first-seen-${user.id}`;
    let firstSeen = Number(localStorage.getItem(firstSeenKey) || 0);
    if (!firstSeen) {
      firstSeen = Date.now();
      try { localStorage.setItem(firstSeenKey, String(firstSeen)); } catch { /* ignore */ }
    }
    const MIN_AGE_MS = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() - firstSeen < MIN_AGE_MS) return;

    if (!isDismissed) {
      // Show after a small delay so it doesn't interfere with page load
      const timer = setTimeout(() => {
        setShowDonation(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  const handleClose = () => {
    if (user?.id) {
      // Mark as dismissed for this user
      localStorage.setItem(`donation-modal-dismissed-${user.id}`, 'true');
    }
    setShowDonation(false);
  };

  if (!showDonation) return null;

  return (
    <DonationModal
      onClose={handleClose}
      kofiUrl="https://ko-fi.com/northemdevelopment"
    />
  );
}
