'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldAlert, X, Send, Lock, Info, CheckCircle2 } from 'lucide-react';
import { Button, toast } from '@/components/ui';
import { requestAdminProjectAccessAction, STANDARD_ACCESS_REASONS } from '@/lib/admin-access-actions';
import type { AccessRequestReasonType } from '@/lib/types';

interface AdminRequestAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    title: string;
    ownerName?: string;
    ownerEmail?: string;
  };
  onSuccess?: () => void;
}

export function AdminRequestAccessModal({
  isOpen,
  onClose,
  project,
  onSuccess,
}: AdminRequestAccessModalProps) {
  const [reasonType, setReasonType] = useState<AccessRequestReasonType>('standard');
  const [selectedStandard, setSelectedStandard] = useState<string>(STANDARD_ACCESS_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reasonType === 'custom' && !customReason.trim()) {
      toast.error('Please provide a reason for the access request.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await requestAdminProjectAccessAction({
        projectId: project.id,
        reasonType,
        standardReason: selectedStandard,
        customReason: customReason.trim(),
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to request access');
      } else {
        toast.success(`Access request sent to ${project.ownerName || 'project owner'}!`);
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error sending request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg rounded-2xl border border-surface-700 bg-surface-900 p-6 text-white shadow-2xl z-10 overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-surface-400 hover:bg-surface-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="flex items-start gap-3.5 mb-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Shield className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-white tracking-tight">
                Request Moderatory Access
              </h3>
              <p className="text-xs text-surface-400 mt-0.5 truncate">
                Project: <span className="text-surface-200 font-medium">{project.title}</span>
                {project.ownerName && (
                  <> &middot; Owner: <span className="text-surface-200">{project.ownerName}</span></>
                )}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reason Type Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-surface-300 block">
                Reason for Access
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReasonType('standard')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${
                    reasonType === 'standard'
                      ? 'border-brand-500/50 bg-brand-500/10 text-white shadow-sm'
                      : 'border-surface-800 bg-surface-950/40 text-surface-400 hover:border-surface-700 hover:text-surface-200'
                  }`}
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Standard Purpose</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReasonType('custom')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${
                    reasonType === 'custom'
                      ? 'border-brand-500/50 bg-brand-500/10 text-white shadow-sm'
                      : 'border-surface-800 bg-surface-950/40 text-surface-400 hover:border-surface-700 hover:text-surface-200'
                  }`}
                >
                  <span>Custom Reason</span>
                </button>
              </div>
            </div>

            {/* Standard Purpose Selector */}
            {reasonType === 'standard' ? (
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-surface-400 block">
                  Select standard reason template:
                </label>
                <div className="space-y-1.5">
                  {STANDARD_ACCESS_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        selectedStandard === reason
                          ? 'border-brand-500/40 bg-surface-800/80 text-white'
                          : 'border-surface-800/80 bg-surface-950/40 text-surface-300 hover:bg-surface-800/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="standard_reason"
                        checked={selectedStandard === reason}
                        onChange={() => setSelectedStandard(reason)}
                        className="text-brand-500 focus:ring-brand-500 h-3.5 w-3.5 bg-surface-900 border-surface-700"
                      />
                      <span className="flex-1">{reason}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-surface-400 block">
                  Custom explanation for the owner:
                </label>
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Explain why you are requesting access (e.g. investigating user report, reviewing flagged content, technical assistance)..."
                  rows={3}
                  className="w-full rounded-xl border border-surface-700 bg-surface-950 px-3 py-2 text-xs text-white placeholder-surface-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                  required
                />
              </div>
            )}

            {/* Permissions & Safeguards Notice */}
            <div className="rounded-xl border border-surface-800 bg-surface-950/60 p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-surface-300">
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                <span>Read & Comment Access Only</span>
              </div>
              <ul className="text-[11px] text-surface-400 space-y-1 list-disc pl-4">
                <li>If approved by the project owner, you will be granted <strong>Viewer</strong> role.</li>
                <li>You can inspect scripts, shots, scenes, and post feedback comments.</li>
                <li>You <strong>cannot</strong> edit, delete, or modify any project assets.</li>
                <li>The project owner will receive an email and an in-app review request.</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={submitting}
                className="gap-1.5 shadow-md"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send Request to Owner</span>
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
