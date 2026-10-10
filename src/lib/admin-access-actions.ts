'use server';

/**
 * Server actions for requesting and managing admin moderatory access to projects.
 * - Allows admins to request read+comment access with either a standard reason or custom explanation.
 * - Enforces that ONLY project owners can approve or deny requests.
 * - Automatically emails the project owner and sends an in-app notification.
 * - Upon acceptance, grants the admin 'viewer' role (strictly read + comment, no editing).
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getEmailsByIds } from '@/lib/private-profile';
import { escapeHtml } from '@/lib/utils';
import logger from '@/lib/logger';
import { sendNotificationEmail } from '@/lib/mailer';
import type { AdminProjectAccessRequest, AccessRequestReasonType, AccessRequestStatus } from '@/lib/types';

export const STANDARD_ACCESS_REASONS = [
  'Routine content moderation & safety review',
  'Investigating flagged content or user report',
  'Platform terms & safety compliance check',
  'Assisting user with technical support or project recovery',
] as const;

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || process.env.ADMIN_UID || 'f0e0c4a4-0833-4c64-b012-15829c087c77';

function isStaffOrAdmin(userId: string, role?: string | null): boolean {
  return userId === ADMIN_UID || role === 'admin' || role === 'moderator';
}

async function getAuthenticatedUser() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const adminDb = createAdminSupabaseClient();
  const { data: profile } = await adminDb.from('profiles').select('id, role, display_name, full_name, email').eq('id', user.id).maybeSingle();
  return { user, profile };
}

/**
 * Admin requests moderatory access to a project.
 */
export async function requestAdminProjectAccessAction({
  projectId,
  reasonType,
  customReason,
  standardReason,
}: {
  projectId: string;
  reasonType: AccessRequestReasonType;
  customReason?: string;
  standardReason?: string;
}): Promise<{ success: boolean; error?: string; requestId?: string }> {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) return { success: false, error: 'Unauthorized' };

    const { user, profile } = auth;
    if (!isStaffOrAdmin(user.id, profile?.role)) {
      return { success: false, error: 'Only administrators or platform moderators can request project access' };
    }

    const finalReason = reasonType === 'custom'
      ? (customReason || '').trim()
      : (standardReason || STANDARD_ACCESS_REASONS[0]);

    if (!finalReason) {
      return { success: false, error: 'A reason for access must be provided' };
    }

    const db = createAdminSupabaseClient();

    // 1. Fetch project and owner details
    const { data: project, error: projectErr } = await db
      .from('projects')
      .select('id, title, created_by, content_metadata')
      .eq('id', projectId)
      .maybeSingle();

    if (projectErr || !project) {
      return { success: false, error: 'Project not found' };
    }

    const ownerId = project.created_by;
    if (!ownerId) {
      return { success: false, error: 'Project owner could not be determined' };
    }

    // 2. Check if admin is already a member
    const { data: existingMember } = await db
      .from('project_members')
      .select('id, role, job_title')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMember) {
      if (existingMember.role === 'owner') {
        return { success: false, error: 'You are the owner of this project' };
      }
      return { success: false, error: `You already have access to this project as a ${existingMember.job_title || existingMember.role}` };
    }

    // 3. Create request object
    const requestId = crypto.randomUUID();
    const now = new Date().toISOString();

    const requestRow: AdminProjectAccessRequest = {
      id: requestId,
      project_id: projectId,
      requester_id: user.id,
      owner_id: ownerId,
      reason_type: reasonType,
      reason: finalReason,
      status: 'pending',
      access_type: 'moderation_view',
      created_at: now,
    };

    // Attempt to write into admin_project_access_requests table
    let tableWritten = false;
    try {
      const { error: insertErr } = await db.from('admin_project_access_requests').insert({
        id: requestId,
        project_id: projectId,
        requester_id: user.id,
        owner_id: ownerId,
        reason_type: reasonType,
        reason: finalReason,
        status: 'pending',
        access_type: 'moderation_view',
        created_at: now,
      });
      if (!insertErr) tableWritten = true;
    } catch {
      // Table may not be migrated in schema cache yet
    }

    // Always mirror in projects.content_metadata for zero-downtime resilience
    const existingMeta = (project.content_metadata || {}) as Record<string, unknown>;
    const existingRequests = Array.isArray(existingMeta.admin_access_requests)
      ? (existingMeta.admin_access_requests as AdminProjectAccessRequest[])
      : [];

    const updatedRequests = [
      ...existingRequests.filter((r) => r.id !== requestId && r.status === 'pending'),
      requestRow,
    ];

    await db.from('projects').update({
      content_metadata: {
        ...existingMeta,
        admin_access_requests: updatedRequests,
      },
    }).eq('id', projectId);

    // 4. Send In-App Notification to project owner
    const requesterName = profile?.display_name || profile?.full_name || 'Platform Moderator';
    await db.from('notifications').insert({
      user_id: ownerId,
      type: 'access_request',
      title: '🛡️ Moderator Access Requested',
      body: `${requesterName} requested read-only access with comments to "${project.title}" for: ${finalReason}`,
      link: `/projects/${projectId}?mod_request=${requestId}`,
      actor_id: user.id,
      entity_type: 'project_access_request',
      entity_id: requestId,
      metadata: {
        requestId,
        projectId,
        projectTitle: project.title,
        requesterId: user.id,
        requesterName,
        reasonType,
        reason: finalReason,
        status: 'pending',
        requestedAt: now,
      },
      read: false,
      acted_on: false,
    });

    // 5. Send Transactional Email to project owner
    try {
      const [{ data: ownerProfile }, emails] = await Promise.all([
        db.from('profiles').select('id, display_name, full_name, email').eq('id', ownerId).maybeSingle(),
        getEmailsByIds(db, [ownerId]),
      ]);

      const ownerEmail = emails.get(ownerId) || ownerProfile?.email;
      const ownerName = ownerProfile?.display_name || ownerProfile?.full_name || 'Project Owner';

      if (ownerEmail) {
        await sendNotificationEmail({
          to: { email: ownerEmail, name: ownerName },
          subject: `🛡️ Platform Moderator Access Requested: ${project.title}`,
          heading: `Moderator Access Request`,
          body: `A Screenplay Studio platform administrator (${requesterName}) has requested read-only view and comment access to your project "${project.title}".\n\nReason: "${finalReason}"\n\nOnly you as the project owner can approve or deny this request. If approved, the moderator can view project pages and leave feedback notes, but CANNOT modify your scripts, scenes, shots, budget, or other project data.`,
          ctaLabel: 'Review Access Request',
          ctaUrl: `/projects/${projectId}?mod_request=${requestId}`,
        });
      }
    } catch (emailErr) {
      logger.warn('[admin-access]', 'Failed to send notification email to project owner:', emailErr);
    }

    // 6. Log to mod_actions if available
    try {
      await db.from('mod_actions').insert({
        mod_user_id: user.id,
        action_type: 'request_project_access',
        target_type: 'project',
        target_id: projectId,
        reason: finalReason,
      });
    } catch {
      // Best-effort audit logging
    }

    return { success: true, requestId };
  } catch (err: unknown) {
    logger.error('[admin-access]', 'Error requesting project access:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to request access' };
  }
}

/**
 * Project owner accepts or denies an admin access request.
 * Strictly checks that caller is the project owner.
 */
export async function respondToAdminAccessAction({
  projectId,
  requestId,
  action,
  note,
}: {
  projectId: string;
  requestId: string;
  action: 'accept' | 'deny';
  note?: string;
}): Promise<{ success: boolean; error?: string; status?: AccessRequestStatus }> {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) return { success: false, error: 'Unauthorized' };

    const { user, profile } = auth;
    const db = createAdminSupabaseClient();

    // 1. Verify that the project exists and the caller is strictly the OWNER
    const { data: project, error: pErr } = await db
      .from('projects')
      .select('id, title, created_by, content_metadata')
      .eq('id', projectId)
      .maybeSingle();

    if (pErr || !project) {
      return { success: false, error: 'Project not found' };
    }

    // Check project ownership
    const isOwner = project.created_by === user.id;
    if (!isOwner) {
      // Check if user has 'owner' role in project_members
      const { data: ownerMember } = await db
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (ownerMember?.role !== 'owner') {
        return { success: false, error: 'Only the project owner can approve or deny this request' };
      }
    }

    // 2. Find the access request
    let request: AdminProjectAccessRequest | null = null;

    // Check table first
    try {
      const { data: tReq } = await db
        .from('admin_project_access_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();
      if (tReq) request = tReq as AdminProjectAccessRequest;
    } catch {
      // Table may not exist yet
    }

    // Check content_metadata fallback
    const meta = (project.content_metadata || {}) as Record<string, unknown>;
    const requestsInMeta = Array.isArray(meta.admin_access_requests)
      ? (meta.admin_access_requests as AdminProjectAccessRequest[])
      : [];

    if (!request) {
      request = requestsInMeta.find((r) => r.id === requestId) || null;
    }

    if (!request) {
      return { success: false, error: 'Access request not found or expired' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: `This request has already been ${request.status}` };
    }

    const newStatus: AccessRequestStatus = action === 'accept' ? 'accepted' : 'denied';
    const now = new Date().toISOString();

    // 3. Update table
    try {
      await db.from('admin_project_access_requests').update({
        status: newStatus,
        responded_at: now,
        response_note: note || null,
        reviewed_by: user.id,
      }).eq('id', requestId);
    } catch {
      // Table update best-effort
    }

    // Update metadata fallback
    const updatedMetaRequests = requestsInMeta.map((r) => {
      if (r.id === requestId) {
        return {
          ...r,
          status: newStatus,
          responded_at: now,
          response_note: note || null,
          reviewed_by: user.id,
        };
      }
      return r;
    });

    await db.from('projects').update({
      content_metadata: {
        ...meta,
        admin_access_requests: updatedMetaRequests,
      },
    }).eq('id', projectId);

    // 4. If ACCEPTED: Add the admin to project_members as viewer / Platform Moderator
    if (action === 'accept') {
      const { error: memberErr } = await db.from('project_members').upsert({
        project_id: projectId,
        user_id: request.requester_id,
        role: 'viewer', // Read-only role: cannot write or edit anything, but CAN comment!
        production_role: 'other',
        job_title: 'Platform Moderator',
        department: 'Platform Moderation',
        joined_at: now,
      }, { onConflict: 'project_id,user_id' });

      if (memberErr) {
        logger.error('[admin-access]', 'Failed to add admin to project_members:', memberErr);
        return { success: false, error: 'Failed to grant project access' };
      }
    }

    // 5. Update notification in owner's inbox to acted_on
    try {
      await db.from('notifications').update({
        acted_on: true,
      }).eq('entity_id', requestId);
    } catch {
      // Best-effort
    }

    // 6. Send in-app notification to the admin requester
    const ownerName = profile?.display_name || profile?.full_name || 'Project Owner';
    const statusLabel = action === 'accept' ? 'approved' : 'declined';

    await db.from('notifications').insert({
      user_id: request.requester_id,
      type: 'access_response',
      title: action === 'accept' ? '🛡️ Access Approved' : '🛡️ Access Declined',
      body: `${ownerName} ${statusLabel} your moderatory access request for "${project.title}".`,
      link: action === 'accept' ? `/projects/${projectId}` : `/admin?tab=projects`,
      actor_id: user.id,
      entity_type: 'project_access_response',
      entity_id: requestId,
      metadata: {
        requestId,
        projectId,
        projectTitle: project.title,
        status: newStatus,
        respondedAt: now,
        note,
      },
      read: false,
      acted_on: false,
    });

    return { success: true, status: newStatus };
  } catch (err: unknown) {
    logger.error('[admin-access]', 'Error responding to project access:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update access request' };
  }
}

/**
 * Fetch pending access requests for a project (used by project owner banner).
 */
export async function getPendingAccessRequestsForProjectAction(projectId: string): Promise<AdminProjectAccessRequest[]> {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) return [];

    const { user } = auth;
    const db = createAdminSupabaseClient();

    // Verify ownership
    const { data: project } = await db.from('projects').select('created_by, content_metadata').eq('id', projectId).maybeSingle();
    if (!project) return [];

    const isOwner = project.created_by === user.id;
    if (!isOwner) {
      const { data: member } = await db.from('project_members').select('role').eq('project_id', projectId).eq('user_id', user.id).maybeSingle();
      if (member?.role !== 'owner') return [];
    }

    let results: AdminProjectAccessRequest[] = [];

    // Query table first
    try {
      const { data: rows } = await db
        .from('admin_project_access_requests')
        .select('*, requester:profiles!requester_id(id, display_name, full_name, email, avatar_url)')
        .eq('project_id', projectId)
        .eq('status', 'pending');
      if (rows && rows.length > 0) {
        results = rows as AdminProjectAccessRequest[];
      }
    } catch {
      // Table fallback
    }

    if (results.length === 0) {
      const meta = (project.content_metadata || {}) as Record<string, unknown>;
      const metaRequests = Array.isArray(meta.admin_access_requests)
        ? (meta.admin_access_requests as AdminProjectAccessRequest[])
        : [];
      results = metaRequests.filter((r) => r.status === 'pending');
    }

    // Attach requester profiles if needed
    if (results.length > 0) {
      const requesterIds = results.map((r) => r.requester_id);
      const { data: profiles } = await db.from('profiles').select('id, display_name, full_name, email, avatar_url').in('id', requesterIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      results = results.map((r) => ({
        ...r,
        requester: profileMap.get(r.requester_id) || r.requester,
      }));
    }

    return results;
  } catch (err) {
    logger.error('[admin-access]', 'Failed to get pending requests:', err);
    return [];
  }
}

/**
 * Checks an admin's access status for a given project.
 */
export async function checkAdminAccessStatusAction(projectId: string): Promise<{
  status: 'none' | AccessRequestStatus;
  isMember: boolean;
  memberRole?: string;
  isModeratorView: boolean;
  request?: AdminProjectAccessRequest | null;
}> {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) return { status: 'none', isMember: false, isModeratorView: false };

    const { user } = auth;
    const db = createAdminSupabaseClient();

    // Check membership
    const { data: member } = await db
      .from('project_members')
      .select('role, job_title')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .maybeSingle();

    const isMember = !!member;
    const isModeratorView = member?.role === 'viewer' && (member.job_title === 'Platform Moderator' || member.job_title === 'Moderator');

    // Check access requests
    let request: AdminProjectAccessRequest | null = null;
    try {
      const { data: rows } = await db
        .from('admin_project_access_requests')
        .select('*')
        .eq('project_id', projectId)
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (rows && rows.length > 0) request = rows[0] as AdminProjectAccessRequest;
    } catch {
      // Table fallback
    }

    if (!request) {
      const { data: project } = await db.from('projects').select('content_metadata').eq('id', projectId).maybeSingle();
      const meta = (project?.content_metadata || {}) as Record<string, unknown>;
      const metaRequests = Array.isArray(meta.admin_access_requests)
        ? (meta.admin_access_requests as AdminProjectAccessRequest[])
        : [];
      const userRequests = metaRequests.filter((r) => r.requester_id === user.id);
      if (userRequests.length > 0) {
        request = userRequests[userRequests.length - 1];
      }
    }

    if (isMember) {
      return { status: 'accepted', isMember: true, memberRole: member.role, isModeratorView, request };
    }

    if (request) {
      return { status: request.status, isMember: false, isModeratorView: false, request };
    }

    return { status: 'none', isMember: false, isModeratorView: false };
  } catch {
    return { status: 'none', isMember: false, isModeratorView: false };
  }
}
