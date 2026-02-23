'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Modal, Button } from '@/components/ui';

// ============================================================
// useConfirmDialog — Promise-based replacement for window.confirm()
//
// Usage:
//   const { confirm, ConfirmDialog } = useConfirmDialog();
//
//   const ok = await confirm('Delete this item?');
//   if (!ok) return;
//
//   // Render <ConfirmDialog /> somewhere in your JSX
// ============================================================

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((val: boolean) => void) | null>(null);

  const confirm = useCallback((messageOrOpts: string | ConfirmOptions): Promise<boolean> => {
    const opts = typeof messageOrOpts === 'string' ? { message: messageOrOpts } : messageOrOpts;
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const ConfirmDialog = useCallback(() => {
    if (!options) return null;
    return (
      <Modal
        isOpen
        onClose={() => handleClose(false)}
        title={options.title || 'Confirm'}
        size="sm"
      >
        <p className="text-sm text-surface-300 mb-6">{options.message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => handleClose(false)}>
            {options.cancelLabel || 'Cancel'}
          </Button>
          <Button
            variant={options.variant === 'danger' ? 'danger' : 'primary'}
            onClick={() => handleClose(true)}
          >
            {options.confirmLabel || 'Confirm'}
          </Button>
        </div>
      </Modal>
    );
  }, [options, handleClose]);

  return { confirm, ConfirmDialog };
}
