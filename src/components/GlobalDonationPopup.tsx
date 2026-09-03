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
