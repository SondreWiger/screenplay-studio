'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, usePresenceStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, EmptyState, LoadingSpinner, Avatar } from '@/components/ui';
import { cn, getInitials, randomColor, timeAgo, formatDate } from '@/lib/utils';
import type { ProjectMember, Profile, UserRole, UserPresence } from '@/lib/types';

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'owner', label: 'Owner', description: 'Full access, can delete project' },
  { value: 'admin', label: 'Admin', description: 'Manage members, edit everything' },
  { value: 'writer', label: 'Writer', description: 'Edit scripts, characters, scenes' },
  { value: 'editor', label: 'Editor', description: 'Edit content, no admin access' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];

const ROLE_COLORS: Record<string, string> = {
  owner: 'text-yellow-400', admin: 'text-purple-400', writer: 'text-blue-400',
  editor: 'text-green-400', viewer: 'text-surface-400',
};

const ROLE_BG: Record<string, string> = {
  owner: 'bg-yellow-500/10', admin: 'bg-purple-500/10', writer: 'bg-blue-500/10',
  editor: 'bg-green-500/10', viewer: 'bg-surface-800',
};

const PAGE_LABELS: Record<string, string> = {
  overview: 'Overview', script: 'Script Editor', characters: 'Characters',
  locations: 'Locations', scenes: 'Scenes', shots: 'Shot List',
  schedule: 'Schedule', ideas: 'Ideas', budget: 'Budget',
  team: 'Team', settings: 'Settings',
};

interface MemberWithProfile extends ProjectMember {
  profile?: Profile;
}

export default function TeamPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { onlineUsers } = usePresenceStore();
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberWithProfile | null>(null);

  useEffect(() => { fetchMembers(); }, [params.id]);

  const fetchMembers = async () => {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('project_members')
        .select('*, profile:profiles!user_id(*)')
        .eq('project_id', params.id)
        .order('role');
      if (fetchError) {
        console.error('Error fetching members:', fetchError.message);
        setError(fetchError.message);
      }
      setMembers((data || []).map((m: any) => ({ ...m, profile: m.profile })));
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this team member?')) return;
    try {
      const supabase = createClient();
      const { error: delError } = await supabase.from('project_members').delete().eq('id', memberId);
      if (delError) { alert(delError.message); return; }
      setMembers(members.filter((m) => m.id !== memberId));
    } catch {
      alert('Failed to remove member');
    }
  };

  const handleRoleChange = async (memberId: string, role: UserRole) => {
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.from('project_members').update({ role }).eq('id', memberId);
      if (updateError) { alert(updateError.message); return; }
      setMembers(members.map((m) => m.id === memberId ? { ...m, role } : m));
      setEditingMember(null);
    } catch {
      alert('Failed to update role');
    }
  };

  const isOnline = (userId: string) => onlineUsers.some((u: any) => u.user_id === userId);
  const getUserPresence = (userId: string) => onlineUsers.find((u: any) => u.user_id === userId);

  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role;
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-sm text-surface-400 mt-1">
            {members.length} member{members.length !== 1 ? 's' : ''}
            {onlineUsers.length > 0 && (
              <span className="text-green-400 ml-2">{'\u00B7'} {onlineUsers.length} online</span>
            )}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowInvite(true)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            Invite Member
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {ROLES.map((r) => {
          const count = members.filter((m) => m.role === r.value).length;
          return (
            <Card key={r.value} className={cn('p-3 text-center', ROLE_BG[r.value])}>
              <p className={cn('text-2xl font-bold', ROLE_COLORS[r.value])}>{count}</p>
              <p className="text-[11px] text-surface-400 mt-0.5">{r.label}{count !== 1 ? 's' : ''}</p>
            </Card>
          );
        })}
      </div>

      {/* Online now section */}
      {onlineUsers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-surface-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Active Now
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {onlineUsers.map((presence: any) => {
              const pagePath = presence.current_page || '';
              const pageSegment = pagePath.split('/').pop() || 'overview';
              const pageLabel = PAGE_LABELS[pageSegment] || pageSegment;
              return (
                <Card key={presence.user_id} className="p-3 border-green-500/20">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={presence.avatar_url}
                      name={presence.full_name || presence.email}
                      size="md"
                      online
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {presence.full_name || presence.email || 'User'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-green-400">Viewing</span>
                        <span className="text-[11px] text-surface-300 font-medium">{pageLabel}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Members list */}
      <h2 className="text-sm font-medium text-surface-400 mb-3">All Members</h2>
      <div className="space-y-2">
        {members.map((member) => {
          const name = member.profile?.full_name || member.profile?.email || 'Unknown';
          const email = member.profile?.email || '';
          const isCurrentUser = member.user_id === user?.id;
          const role = ROLES.find((r) => r.value === member.role);
          const online = isOnline(member.user_id);
          const presence = getUserPresence(member.user_id);
          const pagePath = (presence as any)?.current_page || '';
          const pageSegment = pagePath.split('/').pop() || '';
          const pageLabel = PAGE_LABELS[pageSegment];

          return (
            <Card key={member.id} className="overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <Avatar name={name} src={member.profile?.avatar_url} size="lg" online={online} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-white">{name}</h3>
                    {isCurrentUser && <Badge size="sm" variant="info">You</Badge>}
                    {online && <Badge size="sm" variant="success">Online</Badge>}
                  </div>
                  <p className="text-xs text-surface-400">{email}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {member.department && (
                      <span className="text-[11px] text-surface-500">{member.department}</span>
                    )}
                    {member.job_title && (
                      <span className="text-[11px] text-surface-500">{'\u00B7'} {member.job_title}</span>
                    )}
                    <span className="text-[11px] text-surface-600">Joined {formatDate(member.joined_at)}</span>
                    {online && pageLabel && (
                      <span className="text-[11px] text-green-400">{'\u00B7'} Viewing {pageLabel}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {canManage && !isCurrentUser && member.role !== 'owner' ? (
                    <button
                      onClick={() => setEditingMember(member)}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border border-surface-700 hover:bg-white/5 transition-colors', ROLE_COLORS[member.role])}
                    >
                      {role?.label}
                    </button>
                  ) : (
                    <span className={cn('text-xs font-medium px-3 py-1.5', ROLE_COLORS[member.role])}>{role?.label}</span>
                  )}
                  {canManage && !isCurrentUser && member.role !== 'owner' && (
                    <button onClick={() => handleRemove(member.id)}
                      className="p-1.5 text-surface-500 hover:text-red-400 rounded-lg hover:bg-white/5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Role editor modal */}
      {editingMember && (
        <Modal isOpen={true} onClose={() => setEditingMember(null)} title="Change Role" size="sm">
          <div className="space-y-2">
            {ROLES.filter((r) => r.value !== 'owner').map((role) => (
              <button key={role.value} onClick={() => handleRoleChange(editingMember.id, role.value)}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-lg border transition-colors',
                  editingMember.role === role.value
                    ? 'border-brand-500/50 bg-brand-600/10'
                    : 'border-surface-700 hover:border-surface-600 hover:bg-white/[0.02]'
                )}>
                <div>
                  <p className={cn('text-sm font-medium', ROLE_COLORS[role.value])}>{role.label}</p>
                  <p className="text-xs text-surface-500">{role.description}</p>
                </div>
                {editingMember.role === role.value && <span className="text-brand-400">{'\u2713'}</span>}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Invite modal */}
      <InviteModal isOpen={showInvite} onClose={() => setShowInvite(false)} projectId={params.id}
        onInvited={() => { fetchMembers(); setShowInvite(false); }} />
    </div>
  );
}

function InviteModal({ isOpen, onClose, projectId, onInvited }: {
  isOpen: boolean; onClose: () => void; projectId: string; onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setEmail(''); setRole('editor'); setError(''); }, [isOpen]);

  const handleInvite = async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();

      // Find user by email
      const { data: profile, error: profileErr } = await supabase.from('profiles').select('id').eq('email', email).single();
      if (profileErr || !profile) { setError('No user found with that email. They need to create an account first.'); setLoading(false); return; }

      // Check if already a member
      const { data: existing } = await supabase.from('project_members').select('id').eq('project_id', projectId).eq('user_id', profile.id).single();
      if (existing) { setError('This user is already a team member.'); setLoading(false); return; }

      const { error: insertErr } = await supabase.from('project_members').insert({
        project_id: projectId, user_id: profile.id, role,
      });
      if (insertErr) { setError(insertErr.message); setLoading(false); return; }

      setLoading(false);
      onInvited();
    } catch (err) {
      setError('Failed to invite member. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Team Member" size="sm">
      <div className="space-y-4">
        <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@studio.com" error={error} />
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Role</label>
          <div className="space-y-2">
            {ROLES.filter((r) => r.value !== 'owner').map((r) => (
              <button key={r.value} onClick={() => setRole(r.value)}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left',
                  role === r.value ? 'border-brand-500/50 bg-brand-600/10' : 'border-surface-700 hover:border-surface-600'
                )}>
                <div>
                  <p className={cn('text-sm font-medium', ROLE_COLORS[r.value])}>{r.label}</p>
                  <p className="text-xs text-surface-500">{r.description}</p>
                </div>
                {role === r.value && <span className="text-brand-400">{'\u2713'}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-surface-800">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleInvite} loading={loading}>Send Invite</Button>
      </div>
    </Modal>
  );
}
