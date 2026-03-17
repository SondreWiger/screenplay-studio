'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const FeedbackSubmitModal = dynamic(
  () => import('@/components/feedback/FeedbackSubmitModal').then(m => ({ default: m.FeedbackSubmitModal })),
  { ssr: false }
);

interface ReportIssueButtonProps {
  label?: string;
  defaultType?: 'bug_report' | 'feature_request' | 'testimonial' | 'other';
  prefillTitle?: string;
  prefillBody?: string;
  isErrorReport?: boolean;
  className?: string;
}

export function ReportIssueButton({
  label = 'Report an Issue',
  defaultType = 'bug_report',
  prefillTitle,
  prefillBody,
  isErrorReport = false,
  className,
}: ReportIssueButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          'rounded-lg border border-surface-700 bg-surface-900 px-5 py-2.5 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-800'
        }
      >
        {label}
      </button>

      {open && (
        <FeedbackSubmitModal
          onClose={() => setOpen(false)}
          onSubmitted={() => setOpen(false)}
          defaultType={defaultType}
          prefillTitle={prefillTitle}
          prefillBody={prefillBody}
          isErrorReport={isErrorReport}
        />
      )}
    </>
  );
}
