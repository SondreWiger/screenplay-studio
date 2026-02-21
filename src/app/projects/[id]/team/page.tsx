'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, usePresenceStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, EmptyState, LoadingSpinner, Avatar } from '@/components/ui';
import { cn, getInitials, randomColor, timeAgo, formatDate } from '@/lib/utils';
import { sendNotification } from '@/lib/notifications';
import type { ProjectMember, Profile, UserRole, UserPresence, ProductionRole, ExternalCredit, Character } from '@/lib/types';
import { PRODUCTION_ROLES } from '@/lib/types';

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
  const [externalCredits, setExternalCredits] = useState<ExternalCredit[]>([]);
  const [showAddCredit, setShowAddCredit] = useState(false);
  const [editingCredit, setEditingCredit] = useState<ExternalCredit | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);

  useEffect(() => { fetchMembers(); fetchExternalCredits(); fetchCharacters(); }, [params.id]);

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

  const handleProductionRoleChange = async (memberId: string, productionRole: string) => {
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.from('project_members').update({ production_role: productionRole || null }).eq('id', memberId);
      if (updateError) { alert(updateError.message); return; }
      setMembers(members.map((m) => m.id === memberId ? { ...m, production_role: productionRole as any } : m));
    } catch {
      alert('Failed to update production role');
    }
  };

  const handleCharacterNameChange = async (memberId: string, characterName: string) => {
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.from('project_members').update({ character_name: characterName || null }).eq('id', memberId);
      if (updateError) { alert(updateError.message); return; }
      setMembers(members.map((m) => m.id === memberId ? { ...m, character_name: characterName || null } : m));
    } catch {
      alert('Failed to update character name');
    }
  };

  const fetchExternalCredits = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('external_credits').select('*').eq('project_id', params.id).order('created_at');
      setExternalCredits(data || []);
    } catch {}
  };

  const handleDeleteCredit = async (creditId: string) => {
    if (!confirm('Remove this credit?')) return;
    const supabase = createClient();
    await supabase.from('external_credits').delete().eq('id', creditId);
    setExternalCredits(externalCredits.filter((c) => c.id !== creditId));
  };

  const fetchCharacters = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('characters').select('*').eq('project_id', params.id).order('name');
      setCharacters(data || []);
    } catch {}
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
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {member.production_role && (
                      <span className="text-[11px] text-brand-400 font-medium">
                        {PRODUCTION_ROLES.find(r => r.value === member.production_role)?.label || member.production_role}
                      </span>
                    )}
                    {member.character_name && (
                      <span className="text-[11px] text-amber-400 font-medium">as {member.character_name}</span>
                    )}
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
        <Modal isOpen={true} onClose={() => setEditingMember(null)} title={`Edit ${editingMember.profile?.full_name || 'Member'}`} size="sm">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-2">Access Role</p>
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
            </div>
            <div>
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-2">Production Role</p>
              <select
                value={editingMember.production_role || ''}
                onChange={(e) => handleProductionRoleChange(editingMember.id, e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white"
              >
                <option value="">No production role</option>
                {PRODUCTION_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-surface-500 mt-1">This shows their crew position (DP, AD, PA, etc.)</p>
            </div>
            {(editingMember.production_role === 'actor' || editingMember.production_role === 'extra') && (
              <div>
                <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-2">Character / Role Name</p>
                {characters.length > 0 ? (
                  <select
                    value={editingMember.character_name || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingMember({ ...editingMember, character_name: val || null });
                      handleCharacterNameChange(editingMember.id, val);
                    }}
                    className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white"
                  >
                    <option value="">Select character...</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}{c.description ? ` — ${c.description}` : ''}</option>
                    ))}
                    <option value="__custom">+ Custom name...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={editingMember.character_name || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingMember({ ...editingMember, character_name: val || null });
                      handleCharacterNameChange(editingMember.id, val);
                    }}
                    className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white"
                    placeholder="e.g. John Smith"
                  />
                )}
                {editingMember.character_name === '__custom' && (
                  <input
                    type="text"
                    autoFocus
                    className="w-full mt-2 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white"
                    placeholder="Enter custom character name..."
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setEditingMember({ ...editingMember, character_name: val });
                        handleCharacterNameChange(editingMember.id, val);
                      }
                    }}
                  />
                )}
                <p className="text-[11px] text-surface-500 mt-1">Select the character they play in the film.</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Invite modal */}
      <InviteModal isOpen={showInvite} onClose={() => setShowInvite(false)} projectId={params.id}
        onInvited={() => { fetchMembers(); setShowInvite(false); }} />

      {/* External Credits Section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-medium text-surface-400">External Credits</h2>
            <p className="text-[11px] text-surface-600 mt-0.5">Credit crew members who aren&apos;t on the platform</p>
          </div>
          {canManage && (
            <Button variant="ghost" onClick={() => setShowAddCredit(true)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Credit
            </Button>
          )}
        </div>
        {externalCredits.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-surface-500">No external credits yet. Add crew members who aren&apos;t on Screenplay Studio.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {externalCredits.map((credit) => (
              <Card key={credit.id} className="overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  {credit.avatar_url ? (
                    <img src={credit.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-surface-800 flex items-center justify-center text-sm font-bold text-surface-400">
                      {credit.name[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white">{credit.name}</h3>
                      {credit.external_url && (
                        <a href={credit.external_url} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-brand-400 font-medium">
                        {PRODUCTION_ROLES.find(r => r.value === credit.production_role)?.label || credit.production_role}
                      </span>
                      {credit.character_name && (
                        <span className="text-[11px] text-amber-400">as {credit.character_name}</span>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingCredit(credit)} className="p-1.5 text-surface-500 hover:text-brand-400 rounded-lg hover:bg-white/5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleDeleteCredit(credit.id)} className="p-1.5 text-surface-500 hover:text-red-400 rounded-lg hover:bg-white/5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add External Credit Modal */}
      <AddCreditModal
        isOpen={showAddCredit}
        onClose={() => setShowAddCredit(false)}
        projectId={params.id}
        characters={characters}
        onAdded={() => { fetchExternalCredits(); setShowAddCredit(false); }}
      />

      {/* Edit External Credit Modal */}
      {editingCredit && (
        <EditCreditModal
          isOpen={true}
          onClose={() => setEditingCredit(null)}
          credit={editingCredit}
          characters={characters}
          onSaved={(updated) => {
            setExternalCredits(externalCredits.map((c) => c.id === updated.id ? updated : c));
            setEditingCredit(null);
          }}
        />
      )}
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

      // Send notification to the invited user
      const { data: currentUser } = await supabase.from('profiles').select('display_name, full_name').eq('id', (await supabase.auth.getUser()).data.user?.id || '').single();
      const { data: project } = await supabase.from('projects').select('title').eq('id', projectId).single();
      const actorName = currentUser?.display_name || currentUser?.full_name || 'Someone';
      sendNotification({
        userId: profile.id,
        type: 'project_invitation',
        title: `You were added to ${project?.title || 'a project'}`,
        body: `${actorName} invited you as ${role}`,
        link: `/projects/${projectId}`,
        actorId: (await supabase.auth.getUser()).data.user?.id || undefined,
        entityType: 'project',
        entityId: projectId,
      });

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

function AddCreditModal({ isOpen, onClose, projectId, characters, onAdded }: {
  isOpen: boolean; onClose: () => void; projectId: string; characters: Character[]; onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<ProductionRole>('actor');
  const [characterName, setCharacterName] = useState('');
  const [customCharName, setCustomCharName] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setName(''); setRole('actor'); setCharacterName(''); setCustomCharName(''); setExternalUrl(''); setError(''); }, [isOpen]);

  const handleAdd = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    setError('');
    const finalCharName = characterName === '__custom' ? customCharName.trim() : characterName;
    try {
      const supabase = createClient();
      const { error: insertErr } = await supabase.from('external_credits').insert({
        project_id: projectId,
        name: name.trim(),
        production_role: role,
        character_name: finalCharName || null,
        external_url: externalUrl.trim() || null,
      });
      if (insertErr) { setError(insertErr.message); setLoading(false); return; }
      setLoading(false);
      onAdded();
    } catch {
      setError('Failed to add credit.');
      setLoading(false);
    }
  };

  const showCharacterField = role === 'actor' || role === 'extra';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add External Credit" size="sm">
      <div className="space-y-4">
        <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" error={error} />
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Production Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as ProductionRole)}
            className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none">
            {PRODUCTION_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        {showCharacterField && (
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Character</label>
            {characters.length > 0 ? (
              <select value={characterName} onChange={(e) => setCharacterName(e.target.value)}
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none">
                <option value="">Select character...</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}{c.description ? ` \u2014 ${c.description}` : ''}</option>
                ))}
                <option value="__custom">+ Custom name...</option>
              </select>
            ) : (
              <input type="text" value={characterName} onChange={(e) => setCharacterName(e.target.value)}
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" placeholder="e.g. Detective Jones" />
            )}
            {characterName === '__custom' && (
              <input type="text" autoFocus value={customCharName} onChange={(e) => setCustomCharName(e.target.value)}
                className="w-full mt-2 rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" placeholder="Enter custom character name..." />
            )}
          </div>
        )}
        <Input label="External Profile URL (optional)" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://imdb.com/name/..." />
      </div>
      <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-surface-800">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleAdd} loading={loading}>Add Credit</Button>
      </div>
    </Modal>
  );
}

function EditCreditModal({ isOpen, onClose, credit, characters, onSaved }: {
  isOpen: boolean; onClose: () => void; credit: ExternalCredit; characters: Character[]; onSaved: (updated: ExternalCredit) => void;
}) {
  const [name, setName] = useState(credit.name);
  const [role, setRole] = useState<ProductionRole>(credit.production_role as ProductionRole);
  const [characterName, setCharacterName] = useState(credit.character_name || '');
  const [customCharName, setCustomCharName] = useState('');
  const [externalUrl, setExternalUrl] = useState(credit.external_url || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(credit.name);
    setRole(credit.production_role as ProductionRole);
    const charInList = characters.some((c) => c.name === credit.character_name);
    if (credit.character_name && !charInList && characters.length > 0) {
      setCharacterName('__custom');
      setCustomCharName(credit.character_name);
    } else {
      setCharacterName(credit.character_name || '');
      setCustomCharName('');
    }
    setExternalUrl(credit.external_url || '');
    setError('');
  }, [credit, characters]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    setError('');
    const finalCharName = characterName === '__custom' ? customCharName.trim() : characterName;
    try {
      const supabase = createClient();
      const updates = {
        name: name.trim(),
        production_role: role,
        character_name: finalCharName || null,
        external_url: externalUrl.trim() || null,
      };
      const { error: updateErr } = await supabase.from('external_credits').update(updates).eq('id', credit.id);
      if (updateErr) { setError(updateErr.message); setLoading(false); return; }
      setLoading(false);
      onSaved({ ...credit, ...updates } as ExternalCredit);
    } catch {
      setError('Failed to update credit.');
      setLoading(false);
    }
  };

  const showCharacterField = role === 'actor' || role === 'extra';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit External Credit" size="sm">
      <div className="space-y-4">
        <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" error={error} />
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Production Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as ProductionRole)}
            className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none">
            {PRODUCTION_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        {showCharacterField && (
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Character</label>
            {characters.length > 0 ? (
              <select value={characterName} onChange={(e) => setCharacterName(e.target.value)}
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none">
                <option value="">Select character...</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}{c.description ? ` \u2014 ${c.description}` : ''}</option>
                ))}
                <option value="__custom">+ Custom name...</option>
              </select>
            ) : (
              <input type="text" value={characterName} onChange={(e) => setCharacterName(e.target.value)}
                className="w-full rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" placeholder="e.g. Detective Jones" />
            )}
            {characterName === '__custom' && (
              <input type="text" autoFocus value={customCharName} onChange={(e) => setCustomCharName(e.target.value)}
                className="w-full mt-2 rounded-lg bg-surface-800 border border-surface-700 px-3 py-2 text-sm text-white" placeholder="Enter custom character name..." />
            )}
          </div>
        )}
        <Input label="External Profile URL" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://imdb.com/name/..." />
      </div>
      <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-surface-800">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={loading}>Save Changes</Button>
      </div>
    </Modal>
  );
}
