'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Shield, ShieldAlert, Check, X, Lock } from 'lucide-react';
import { Button, toast } from '@/components/ui';
import { getPendingAccessRequestsForProjectAction, respondToAdminAccessAction } from '@/lib/admin-access-actions';
import type { AdminProjectAccessRequest } from '@/lib/types';
import { useAuthStore, useProjectStore } from '@/lib/stores';

interface AdminAccessRequestBannerProps {
  projectId: string;
}

export function AdminAccessRequestBanner({ projectId }: AdminAccessRequestBannerProps) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [requests, setRequests] = useState<AdminProjectAccessRequest[]>([]);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<AdminProjectAccessRequest | null>(null);
  const [confirmModal, setConfirmModal] = useState<'accept' | 'deny' | null>(null);
  const [responseNote, setResponseNote] = useState<string>('');

  const isOwner = Boolean(
    (currentProject && user && currentProject.created_by === user.id) ||
    members.some((m) => m.user_id === user?.id && m.role === 'owner')
  );

  const currentMember = members.find((m) => m.user_id === user?.id);
  const isModeratorView = Boolean(
    currentMember &&
    currentMember.role === 'viewer' &&
    (currentMember.job_title === 'Platform Moderator' || currentMember.job_title === 'Moderator')
  );

  const fetchRequests = useCallback(async () => {
    if (!isOwner || !projectId) {
      return;
    }

    try {
      const data = await getPendingAccessRequestsForProjectAction(projectId);
      setRequests(data);

      // Check if URL specified a specific request
      const modRequestId = searchParams?.get('mod_request');
      if (modRequestId && data.length > 0) {
        const target = data.find((r) => r.id === modRequestId);
        if (target) {
          setSelectedRequest(target);
        }
      }
    } catch (err) {
      console.error('[AdminAccessRequestBanner] Failed to fetch requests:', err);
    }
  }, [projectId, isOwner, searchParams]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleRespond = async (action: 'accept' | 'deny') => {
    const target = selectedRequest || requests[0];
    if (!target) return;

    setActionLoading(true);
    try {
      const res = await respondToAdminAccessAction({
        projectId,
        requestId: target.id,
        action,
        note: responseNote.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to update request');
      } else {
        toast.success(action === 'accept' ? 'Moderatory access granted!' : 'Access request declined.');
        setRequests((prev) => prev.filter((r) => r.id !== target.id));
        setConfirmModal(null);
        setSelectedRequest(null);
        setResponseNote('');

        // Clean query param
        if (searchParams?.get('mod_request')) {
          router.replace(`/projects/${projectId}`);
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error updating request');
    } finally {
      setActionLoading(false);
    }
  };

  // 1. Moderator View Indicator (for the admin when viewing the project)
  if (isModeratorView) {
    return (
      <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-2 text-xs flex items-center justify-between text-amber-200">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="font-medium">Moderatory View:</span>
          <span className="text-amber-300/90">
            You have read & comment access to this project for moderation purposes. You cannot modify project assets.
          </span>
        </div>
        <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-semibold border border-amber-500/30">
          Viewer / Moderator
        </span>
      </div>
    );
  }

  // 2. Project Owner Banner (if owner and there is a pending request)
  if (!isOwner || requests.length === 0) return null;

  const currentReq = selectedRequest || requests[0];
  const requesterName = currentReq.requester?.display_name || currentReq.requester?.full_name || 'A platform administrator';

  return (
    <>
      <div className="bg-gradient-to-r from-amber-950/70 via-surface-900 to-amber-950/70 border-b border-amber-500/40 px-4 py-3 text-xs shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5 sm:mt-0">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">Platform Moderator Access Request</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium">Pending Owner Approval</span>
              </div>
              <p className="text-surface-300 mt-0.5">
                <strong className="text-amber-200">{requesterName}</strong> requested read-only & comment access for:{' '}
                <span className="italic text-white">&ldquo;{currentReq.reason}&rdquo;</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedRequest(currentReq);
                setConfirmModal('deny');
              }}
              className="text-xs border-surface-700 hover:border-red-500/40 hover:text-red-300 gap-1"
            >
              <X className="h-3.5 w-3.5" />
              <span>Deny</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedRequest(currentReq);
                setConfirmModal('accept');
              }}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1 shadow-sm"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Accept Access</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-surface-700 bg-surface-900 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${confirmModal === 'accept' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {confirmModal === 'accept' ? <Shield className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {confirmModal === 'accept' ? 'Grant Moderatory Access?' : 'Decline Access Request?'}
                </h3>
                <p className="text-xs text-surface-400">
                  {confirmModal === 'accept'
                    ? `Grant ${requesterName} read-only access with comments`
                    : `Decline access request from ${requesterName}`}
                </p>
              </div>
            </div>

            {confirmModal === 'accept' ? (
              <div className="rounded-xl border border-surface-800 bg-surface-950 p-3 space-y-2 text-xs text-surface-300">
                <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Permissions Granted</span>
                </div>
                <ul className="text-[11px] text-surface-400 space-y-1 list-disc pl-4">
                  <li>Role: <strong>Viewer</strong> (Platform Moderator)</li>
                  <li>Can view all scenes, shots, scripts, and documents</li>
                  <li>Can post feedback comments in comment threads</li>
                  <li><strong>Cannot edit, delete, or modify any project data</strong></li>
                </ul>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs text-surface-400">Optional note for the administrator:</label>
                <textarea
                  value={responseNote}
                  onChange={(e) => setResponseNote(e.target.value)}
                  placeholder="Optional reason for declining..."
                  rows={2}
                  className="w-full rounded-lg border border-surface-700 bg-surface-950 p-2 text-xs text-white placeholder-surface-500 focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmModal(null);
                  setResponseNote('');
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant={confirmModal === 'accept' ? 'primary' : 'danger'}
                size="sm"
                loading={actionLoading}
                onClick={() => handleRespond(confirmModal)}
                className={confirmModal === 'accept' ? 'bg-emerald-600 hover:bg-emerald-500' : ''}
              >
                {confirmModal === 'accept' ? 'Confirm & Grant Access' : 'Confirm Decline'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
