'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { X } from 'lucide-react';

interface DonationModalProps {
  onClose: () => void;
  kofiUrl: string;
}

export function DonationModal({ onClose, kofiUrl }: DonationModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 150);
  };

  const handleDonate = () => {
    window.open(kofiUrl, '_blank');
    // Don't close immediately - let them read the instructions
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-150 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`relative bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl max-w-md w-[90vw] p-6 sm:p-8 transition-transform duration-150 ${isClosing ? 'scale-95' : 'scale-100'}`}>
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-surface-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="text-center">
          <div className="mb-4 text-3xl">❤️</div>
          <h2 className="text-2xl font-bold text-white mb-3">Help Keep Screenplay Studio Running</h2>

          <p className="text-surface-300 mb-4">
            Hey! I'm the developer behind Screenplay Studio, and I'm in a real crunch right now. Your support helps me keep this service alive and continue building amazing features for you.
          </p>

          <div className="bg-brand-600/10 border border-brand-600/30 rounded-lg p-4 mb-6">
            <p className="text-brand-400 font-medium mb-2">🎁 For a $10 donation:</p>
            <p className="text-surface-300 text-sm">
              Get <span className="font-semibold text-white">2 months of Pro access</span> absolutely free, plus all Pro features unlocked.
            </p>
          </div>

          <p className="text-surface-400 text-sm mb-6">
            Every donation makes a real difference. Thank you for believing in this project.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleClose}
            variant="secondary"
            className="flex-1"
          >
            Maybe Later
          </Button>
          <Button
            onClick={handleDonate}
            className="flex-1 bg-brand-600 hover:bg-brand-700"
          >
            Donate $10 💝
          </Button>
        </div>

        <p className="text-xs text-surface-500 text-center mt-4">
          After donating on Ko-Fi, your Pro access activates automatically. Just visit <a href="/claim-pro" className="text-brand-400 hover:text-brand-300 underline">screenplaystudio.fun/claim-pro</a> to confirm it's active.
        </p>
      </div>
    </div>
  );
}
