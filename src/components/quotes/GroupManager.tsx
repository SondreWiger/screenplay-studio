'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Input, EmptyState, LoadingSpinner } from '@/components/ui';
import { toast } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import type { QuoteGroup, QuoteGroupMember } from '@/lib/types';

interface GroupManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupChange?: () => void;
}

export function GroupManager({ isOpen, onClose, onGroupChange }: GroupManagerProps) {
  const [groups, setGroups] = useState<QuoteGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<QuoteGroup | null>(null);
  const [members, setMembers] = useState<QuoteGroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEmoji, setNewEmoji] = useState('💬');
  const [creating, setCreating] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<{ id: string; display_name: string | null; avatar_url: string | null }[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedInviteUser, setSelectedInviteUser] = useState<{ id: string; display_name: string | null; avatar_url: string | null } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<QuoteGroup | null>(null);

  const supabase = createClient();

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quote-groups');
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        console.error('Non-JSON response:', text.slice(0, 500));
        const match = text.match(/<pre>([^<]+)<\/pre>/);
        const detail = match ? match[1] : text.slice(0, 200);
        throw new Error(`Server error (${res.status}): ${detail}`);
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load groups');
      setGroups(json.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    fetchGroups();
  }, [isOpen, fetchGroups]);

  const fetchMembers = useCallback(async (groupId: string) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/quote-groups/${groupId}/members`);
      const json = await res.json();
      if (json.data) setMembers(json.data);
    } catch {
      toast.error('Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/quote-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || null,
          emoji: newEmoji,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Group created!');
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewEmoji('💬');
      fetchGroups();
      onGroupChange?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/quote-groups/${editingGroup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || null,
          emoji: newEmoji,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Group updated!');
      setEditingGroup(null);
      setNewName('');
      setNewDesc('');
      setNewEmoji('💬');
      fetchGroups();
      onGroupChange?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update group');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm('Delete this group? Quotes in this group will be unlinked.')) return;
    try {
      const res = await fetch(`/api/quote-groups/${groupId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Group deleted');
      setSelectedGroup(null);
      fetchGroups();
      onGroupChange?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete group');
    }
  };

  const handleInvite = async () => {
    if (!selectedInviteUser || !selectedGroup) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/quote-groups/${selectedGroup.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedInviteUser.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Member added!');
      clearInviteUser();
      fetchMembers(selectedGroup.id);
      onGroupChange?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member?')) return;
    try {
      const res = await fetch(`/api/quote-groups/${selectedGroup!.id}/members/${memberId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Member removed');
      fetchMembers(selectedGroup!.id);
      onGroupChange?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  // Search users by display name (debounced)
  useEffect(() => {
    if (!inviteSearch.trim() || !selectedGroup) {
      setInviteResults([]);
      return;
    }

    // Don't search if a user is already selected
    if (selectedInviteUser) return;

    const timer = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        // Exclude existing members
        const existingIds = members.map(m => m.user_id);
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .ilike('display_name', `%${inviteSearch.trim()}%`)
          .limit(10);

        if (data) {
          setInviteResults(data.filter(p => !existingIds.includes(p.id)));
        }
      } catch {
        // Silent
      } finally {
        setSearchingUsers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inviteSearch, selectedGroup, selectedInviteUser, members, supabase]);

  const selectInviteUser = (user: { id: string; display_name: string | null; avatar_url: string | null }) => {
    setSelectedInviteUser(user);
    setInviteSearch(user.display_name || 'Unknown');
    setInviteResults([]);
  };

  const clearInviteUser = () => {
    setSelectedInviteUser(null);
    setInviteSearch('');
    setInviteResults([]);
  };

  const isOwner = (group: QuoteGroup) => userId && group.created_by === userId;

  const EMOTES = ['💬', '📝', '🎬', '🎭', '📖', '✍️', '🎯', '💡', '🔥', '⭐', '🌟', '💫', '✨', '🎉', '🎊', '🏆', '🥇', '👏', '🙌', '💪'];

  const selectGroup = (group: QuoteGroup) => {
    setSelectedGroup(group);
    fetchMembers(group.id);
  };

  if (selectedGroup) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={`${selectedGroup.emoji} ${selectedGroup.name}`} size="md">
        <div className="flex flex-col gap-4">
          {/* Back */}
          <button
            onClick={() => setSelectedGroup(null)}
            className="self-start text-xs text-surface-500 hover:text-surface-300 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to groups
          </button>

          {/* Description */}
          {selectedGroup.description && (
            <p className="text-sm text-surface-400">{selectedGroup.description}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-surface-500">
            <span>{selectedGroup.quote_count ?? 0} quotes</span>
            <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Owner actions */}
          {isOwner(selectedGroup) && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingGroup(selectedGroup);
                  setNewName(selectedGroup.name);
                  setNewDesc(selectedGroup.description || '');
                  setNewEmoji(selectedGroup.emoji || '💬');
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => handleDelete(selectedGroup.id)}
              >
                Delete
              </Button>
            </div>
          )}

          {/* Members */}
          <div>
            <h4 className="text-xs font-semibold text-surface-400 mb-2 uppercase tracking-wider">Members</h4>
            {membersLoading ? (
              <div className="flex justify-center py-4"><LoadingSpinner /></div>
            ) : members.length === 0 ? (
              <p className="text-xs text-surface-500">No members yet</p>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between bg-surface-900/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-[10px] font-bold text-brand-400 shrink-0">
                        {member.profile?.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm text-white truncate">{member.profile?.display_name || 'Unknown'}</span>
                      {member.role === 'owner' && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Owner</span>
                      )}
                    </div>
                    {isOwner(selectedGroup) && member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        className="text-[10px] text-surface-500 hover:text-red-400 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invite (owner only) */}
          {isOwner(selectedGroup) && (
            <div className="relative">
              <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wider">
                Add Member
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Search by display name..."
                    value={inviteSearch}
                    onChange={(e) => { setInviteSearch(e.target.value); setSelectedInviteUser(null); }}
                    className="w-full text-xs"
                  />
                  {searchingUsers && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <div className="w-3.5 h-3.5 border-2 border-surface-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {selectedInviteUser && (
                    <button
                      onClick={clearInviteUser}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleInvite}
                  loading={inviting}
                  disabled={!selectedInviteUser}
                >
                  Invite
                </Button>
              </div>

              {/* Search dropdown */}
              {inviteResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-surface-800 border border-surface-700 rounded-lg shadow-xl overflow-hidden">
                  {inviteResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => selectInviteUser(user)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-700/50 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400 shrink-0">
                        {user.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm text-white">{user.display_name || 'Unknown'}</span>
                    </button>
                  ))}
                </div>
              )}

              {inviteSearch && !searchingUsers && inviteResults.length === 0 && !selectedInviteUser && (
                <p className="text-[11px] text-surface-500 mt-1">No users found</p>
              )}
            </div>
          )}

          {/* Edit form */}
          {editingGroup && (
            <form onSubmit={handleUpdateGroup} className="bg-surface-900/80 border border-surface-800/60 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-semibold text-surface-400">Edit Group</h4>
              <Input label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
              <Input label="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <div>
                <label className="block text-xs font-semibold text-surface-400 mb-1.5">Emoji</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOTES.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setNewEmoji(e)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all ${newEmoji === e ? 'bg-brand-500/20 ring-1 ring-brand-500/50 scale-110' : 'bg-surface-800/50 hover:bg-surface-800'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" type="button" onClick={() => setEditingGroup(null)}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit" loading={creating}>Save</Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quote Groups" size="md">
      <div className="flex flex-col gap-4">
        {/* Create button */}
        {!showCreate && (
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} className="self-start">
            + New Group
          </Button>
        )}

        {/* Create form */}
        {showCreate && (
          <form onSubmit={handleCreate} className="bg-surface-900/80 border border-surface-800/60 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-semibold text-surface-400">Create a Shared Group</h4>
            <p className="text-[11px] text-surface-500">Share quotes with collaborators. Anyone in the group can add quotes.</p>
            <Input label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Our Movie" required />
            <Input label="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What is this group for?" />
            <div>
              <label className="block text-xs font-semibold text-surface-400 mb-1.5">Emoji</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOTES.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setNewEmoji(e)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all ${newEmoji === e ? 'bg-brand-500/20 ring-1 ring-brand-500/50 scale-110' : 'bg-surface-800/50 hover:bg-surface-800'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="primary" size="sm" type="submit" loading={creating}>Create Group</Button>
            </div>
          </form>
        )}

        {/* Group list */}
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<span className="text-2xl">💬</span>}
            title="No groups yet"
            description="Create a shared group to start collecting quotes with collaborators."
          />
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 -mr-1">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => selectGroup(group)}
                className="w-full text-left bg-surface-900/50 border border-surface-800/60 rounded-xl p-3.5 hover:border-surface-700/80 transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{group.emoji || '💬'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{group.name}</p>
                      {group.description && (
                        <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{group.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-surface-500">{group.quote_count ?? 0} quotes</span>
                    <span className="text-[10px] text-surface-500">{group.members?.length ?? 0} members</span>
                    {isOwner(group) && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Owner</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
