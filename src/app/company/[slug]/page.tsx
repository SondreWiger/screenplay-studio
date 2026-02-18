'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Input, Textarea, LoadingPage } from '@/components/ui';
import type {
  Company, CompanyMember, CompanyTeam, CompanyTeamMember,
  CompanyInvitation, CompanyActivityLog, CompanyRole, Profile, Project
} from '@/lib/types';

// ============================================================
// Company Management
// ============================================================

type CompanyTab = 'overview' | 'members' | 'teams' | 'projects' | 'settings' | 'activity';

export default function CompanyPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const [tab, setTab] = useState<CompanyTab>('overview');
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [teams, setTeams] = useState<CompanyTeam[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<CompanyActivityLog[]>([]);
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [myRole, setMyRole] = useState<CompanyRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CompanyRole>('member');

  // Team form
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamColor, setTeamColor] = useState('#3B82F6');
  const [teamPerms, setTeamPerms] = useState({
    can_create_projects: false,
    can_edit_scripts: true,
    can_manage_production: false,
    can_view_budget: false,
    can_manage_budget: false,
    can_invite_members: false,
    can_publish_community: false,
    can_manage_company: false,
  });

  // Settings form
  const [settingsForm, setSettingsForm] = useState<Partial<Company>>({});

  const supabase = createClient();

  const loadCompany = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: co } = await supabase.from('companies').select('*').eq('slug', slug).single();
    if (!co) { router.replace('/dashboard'); return; }
    setCompany(co);
    setSettingsForm(co);

    const { data: mems } = await supabase.from('company_members')
      .select('*, profile:profiles!user_id(*)')
      .eq('company_id', co.id)
      .order('role');
    setMembers(mems || []);

    const me = (mems || []).find((m: CompanyMember) => m.user_id === user.id);
    setMyRole(me?.role || (co.owner_id === user.id ? 'owner' : null));

    const { data: ts } = await supabase.from('company_teams')
      .select('*')
      .eq('company_id', co.id)
      .order('name');
    setTeams(ts || []);

    const { data: ps } = await supabase.from('projects')
      .select('*')
      .eq('company_id', co.id)
      .order('updated_at', { ascending: false });
    setProjects(ps || []);

    const { data: invs } = await supabase.from('company_invitations')
      .select('*')
      .eq('company_id', co.id)
      .eq('accepted', false)
      .order('created_at', { ascending: false });
    setInvitations(invs || []);

    const { data: acts } = await supabase.from('company_activity_log')
      .select('*, profile:profiles(*)')
      .eq('company_id', co.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setActivity(acts || []);

    setLoading(false);
  }, [user, slug]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/auth/login'); return; }
    loadCompany();
  }, [user, authLoading, loadCompany]);

  const canManage = myRole === 'owner' || myRole === 'admin';

  const sendInvite = async () => {
    if (!company || !inviteEmail.trim()) return;
    setSaving(true);
    const token = crypto.randomUUID();
    await supabase.from('company_invitations').insert({
      company_id: company.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      team_ids: [],
      invited_by: user!.id,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await supabase.from('company_activity_log').insert({
      company_id: company.id,
      user_id: user!.id,
      action: 'invited_member',
      entity_type: 'invitation',
      metadata: { email: inviteEmail.trim(), role: inviteRole },
    });

    setInviteEmail('');
    setShowInviteModal(false);
    loadCompany();
    setSaving(false);
  };

  const createTeam = async () => {
    if (!company || !teamName.trim()) return;
    setSaving(true);
    await supabase.from('company_teams').insert({
      company_id: company.id,
      name: teamName.trim(),
      description: teamDescription.trim() || null,
      color: teamColor,
      ...teamPerms,
    });

    await supabase.from('company_activity_log').insert({
      company_id: company.id,
      user_id: user!.id,
      action: 'created_team',
      entity_type: 'team',
      metadata: { name: teamName.trim() },
    });

    setTeamName('');
    setTeamDescription('');
    setShowTeamModal(false);
    loadCompany();
    setSaving(false);
  };

  const removeMember = async (memberId: string) => {
    if (!company) return;
    await supabase.from('company_members').delete().eq('id', memberId);
    loadCompany();
  };

  const updateMemberRole = async (memberId: string, role: CompanyRole) => {
    if (!company) return;
    await supabase.from('company_members').update({ role }).eq('id', memberId);
    loadCompany();
  };

  const revokeInvitation = async (invId: string) => {
    await supabase.from('company_invitations').delete().eq('id', invId);
    loadCompany();
  };

  const deleteTeam = async (teamId: string) => {
    if (!company) return;
    await supabase.from('company_teams').delete().eq('id', teamId);
    loadCompany();
  };

  const saveSettings = async () => {
    if (!company) return;
    setSaving(true);
    const { name, description, website, email, phone, address, tagline, brand_color,
      public_page_enabled, show_team_on_public, show_projects_on_public, allow_script_reading } = settingsForm;
    await supabase.from('companies').update({
      name, description, website, email, phone, address, tagline, brand_color,
      public_page_enabled, show_team_on_public, show_projects_on_public, allow_script_reading,
    }).eq('id', company.id);

    await supabase.from('company_activity_log').insert({
      company_id: company.id,
      user_id: user!.id,
      action: 'updated_settings',
      entity_type: 'company',
      metadata: {},
    });

    loadCompany();
    setSaving(false);
  };

  if (authLoading || loading) return <LoadingPage />;
  if (!company) return null;

  const tabs: { key: CompanyTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'members', label: `Members (${members.length})` },
    { key: 'teams', label: `Teams (${teams.length})` },
    { key: 'projects', label: `Projects (${projects.length})` },
    ...(canManage ? [
      { key: 'settings' as CompanyTab, label: 'Settings' },
      { key: 'activity' as CompanyTab, label: 'Activity' },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-950">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/settings" className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-white/5 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <span className="text-surface-500 text-sm">Settings</span>
          </div>
          <div className="flex items-center gap-4">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: company.brand_color }}>
                {company.name[0]}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{company.name}</h1>
              {company.tagline && <p className="text-sm text-surface-400 mt-0.5">{company.tagline}</p>}
            </div>
          </div>
        </div>
        {/* Tab bar */}
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-1 -mb-px">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-brand-500 text-white'
                    : 'border-transparent text-surface-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Overview */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Members', value: members.length, icon: '👥' },
                { label: 'Teams', value: teams.length, icon: '🏢' },
                { label: 'Projects', value: projects.length, icon: '📁' },
                { label: 'Plan', value: company.plan.toUpperCase(), icon: '⭐' },
              ].map((stat) => (
                <Card key={stat.label} className="p-4 text-center">
                  <span className="text-2xl">{stat.icon}</span>
                  <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                  <p className="text-xs text-surface-400">{stat.label}</p>
                </Card>
              ))}
            </div>

            {company.description && (
              <Card className="p-6">
                <h3 className="text-sm font-semibold text-surface-400 mb-2">About</h3>
                <p className="text-surface-300">{company.description}</p>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              {company.website && (
                <Card className="p-4">
                  <p className="text-xs text-surface-500">Website</p>
                  <a href={company.website} target="_blank" rel="noopener" className="text-sm text-brand-400 hover:underline">{company.website}</a>
                </Card>
              )}
              {company.email && (
                <Card className="p-4">
                  <p className="text-xs text-surface-500">Contact</p>
                  <p className="text-sm text-surface-300">{company.email}</p>
                </Card>
              )}
            </div>

            {/* Recent activity */}
            {activity.length > 0 && (
              <Card className="p-6">
                <h3 className="text-sm font-semibold text-surface-400 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {activity.slice(0, 5).map((act) => (
                    <div key={act.id} className="flex items-center gap-3 text-sm">
                      <div className="w-6 h-6 rounded-full bg-surface-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {(act.profile as Profile | undefined)?.display_name?.[0] || '?'}
                      </div>
                      <p className="text-surface-300">
                        <span className="text-white font-medium">{(act.profile as Profile | undefined)?.display_name || 'Someone'}</span>
                        {' '}{act.action.replace(/_/g, ' ')}
                      </p>
                      <span className="text-surface-500 text-xs ml-auto shrink-0">{new Date(act.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Members */}
        {tab === 'members' && (
          <div className="space-y-6">
            {canManage && (
              <div className="flex justify-end gap-2">
                <Button onClick={() => setShowInviteModal(true)}>Invite Member</Button>
              </div>
            )}

            <div className="space-y-3">
              {members.map((m) => (
                <Card key={m.id} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-800 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {(m.profile as Profile | undefined)?.avatar_url ? (
                      <img src={(m.profile as Profile).avatar_url!} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      (m.profile as Profile | undefined)?.display_name?.[0] || '?'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{(m.profile as Profile | undefined)?.display_name || (m.profile as Profile | undefined)?.full_name || 'Member'}</p>
                    <p className="text-xs text-surface-400">{m.job_title || m.role} {m.department ? `· ${m.department}` : ''}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                    m.role === 'owner' ? 'bg-yellow-500/20 text-yellow-400' :
                    m.role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-surface-700 text-surface-300'
                  }`}>{m.role}</span>
                  {canManage && m.role !== 'owner' && m.user_id !== user?.id && (
                    <div className="flex gap-1">
                      <select
                        value={m.role}
                        onChange={(e) => updateMemberRole(m.id, e.target.value as CompanyRole)}
                        className="text-xs bg-surface-800 text-white border border-surface-700 rounded px-2 py-1"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button onClick={() => removeMember(m.id)} className="text-red-400 hover:text-red-300 text-xs px-2">Remove</button>
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-surface-400 mt-8 mb-3">Pending Invitations</h3>
                <div className="space-y-2">
                  {invitations.map((inv) => (
                    <Card key={inv.id} className="p-4 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-sm text-surface-400">📧</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{inv.email}</p>
                        <p className="text-xs text-surface-400">Invited as {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                      </div>
                      {canManage && (
                        <button onClick={() => revokeInvitation(inv.id)} className="text-xs text-red-400 hover:text-red-300">Revoke</button>
                      )}
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Teams */}
        {tab === 'teams' && (
          <div className="space-y-6">
            {canManage && (
              <div className="flex justify-end">
                <Button onClick={() => setShowTeamModal(true)}>Create Team</Button>
              </div>
            )}
            {teams.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-surface-400">No teams created yet.</p>
                <p className="text-xs text-surface-500 mt-1">Teams let you organize members and control permissions for different departments.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {teams.map((team) => (
                  <Card key={team.id} className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: team.color }}>
                        {team.icon || team.name[0]}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{team.name}</h3>
                        {team.description && <p className="text-[11px] text-surface-400">{team.description}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {[
                        team.can_create_projects && 'Projects',
                        team.can_edit_scripts && 'Scripts',
                        team.can_manage_production && 'Production',
                        team.can_view_budget && 'View Budget',
                        team.can_manage_budget && 'Manage Budget',
                        team.can_invite_members && 'Invite',
                        team.can_publish_community && 'Publish',
                        team.can_manage_company && 'Admin',
                      ].filter(Boolean).map((perm) => (
                        <span key={perm as string} className="px-1.5 py-0.5 text-[10px] rounded bg-surface-800 text-surface-400">{perm}</span>
                      ))}
                    </div>
                    {canManage && (
                      <div className="mt-4 pt-3 border-t border-surface-800 flex justify-end">
                        <button onClick={() => deleteTeam(team.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projects */}
        {tab === 'projects' && (
          <div className="space-y-4">
            {projects.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-surface-400">No projects assigned to this company yet.</p>
                <p className="text-xs text-surface-500 mt-1">Assign projects from the project settings page.</p>
              </Card>
            ) : (
              projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="p-4 flex items-center gap-4 hover:bg-surface-800/50 transition-colors cursor-pointer">
                    {project.poster_url ? (
                      <img src={project.poster_url} alt="" className="w-12 h-16 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-16 rounded-lg bg-surface-800 flex items-center justify-center text-surface-500">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white">{project.title}</h3>
                      {project.logline && <p className="text-xs text-surface-400 line-clamp-1 mt-0.5">{project.logline}</p>}
                    </div>
                    <span className="text-xs text-surface-500 capitalize">{project.status.replace(/_/g, ' ')}</span>
                  </Card>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Settings */}
        {tab === 'settings' && canManage && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Company Details</h3>
              <div className="space-y-4">
                <Input label="Name" value={settingsForm.name || ''} onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })} />
                <Input label="Tagline" value={settingsForm.tagline || ''} onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })} placeholder="A short slogan" />
                <Textarea label="Description" value={settingsForm.description || ''} onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })} rows={3} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Website" value={settingsForm.website || ''} onChange={(e) => setSettingsForm({ ...settingsForm, website: e.target.value })} />
                  <Input label="Email" value={settingsForm.email || ''} onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Phone" value={settingsForm.phone || ''} onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })} />
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={settingsForm.brand_color || '#dd574e'} onChange={(e) => setSettingsForm({ ...settingsForm, brand_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                      <span className="text-sm text-surface-400">{settingsForm.brand_color}</span>
                    </div>
                  </div>
                </div>
                <Textarea label="Address" value={settingsForm.address || ''} onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })} rows={2} />
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Public Page</h3>
              <div className="space-y-4">
                {[
                  { key: 'public_page_enabled', label: 'Enable Public Page', desc: 'Allow visitors to see your company page' },
                  { key: 'show_team_on_public', label: 'Show Team', desc: 'Display team members on public page' },
                  { key: 'show_projects_on_public', label: 'Show Projects', desc: 'Display projects on public page' },
                  { key: 'allow_script_reading', label: 'Allow Script Reading', desc: 'Let visitors read published scripts' },
                ].map((toggle) => (
                  <button
                    key={toggle.key}
                    onClick={() => setSettingsForm({ ...settingsForm, [toggle.key]: !(settingsForm as Record<string, unknown>)[toggle.key] })}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-surface-700 hover:border-surface-600 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{toggle.label}</p>
                      <p className="text-[11px] text-surface-400">{toggle.desc}</p>
                    </div>
                    <div className={`w-10 h-5.5 rounded-full shrink-0 transition-colors relative ${(settingsForm as Record<string, unknown>)[toggle.key] ? 'bg-brand-500' : 'bg-surface-700'}`}>
                      <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${(settingsForm as Record<string, unknown>)[toggle.key] ? 'left-[18px]' : 'left-0.5'}`} />
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Button onClick={saveSettings} loading={saving}>Save Settings</Button>
          </div>
        )}

        {/* Activity */}
        {tab === 'activity' && canManage && (
          <div className="space-y-2">
            {activity.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-surface-400">No activity yet.</p>
              </Card>
            ) : (
              activity.map((act) => (
                <Card key={act.id} className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {(act.profile as Profile | undefined)?.display_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-300">
                      <span className="text-white font-medium">{(act.profile as Profile | undefined)?.display_name || 'System'}</span>
                      {' '}{act.action.replace(/_/g, ' ')}
                      {act.entity_type && <span className="text-surface-500"> · {act.entity_type}</span>}
                    </p>
                  </div>
                  <span className="text-xs text-surface-500 shrink-0">{new Date(act.created_at).toLocaleString()}</span>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowInviteModal(false)}>
          <div className="w-full max-w-md p-6 rounded-xl border border-surface-800 bg-surface-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-6">Invite Member</h2>
            <div className="space-y-4">
              <Input label="Email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" />
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as CompanyRole)}
                  className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
                >
                  <option value="admin">Admin — Full access</option>
                  <option value="manager">Manager — Manage projects & members</option>
                  <option value="member">Member — Edit content</option>
                  <option value="viewer">Viewer — Read only</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-surface-800">
              <Button variant="ghost" onClick={() => setShowInviteModal(false)}>Cancel</Button>
              <Button onClick={sendInvite} loading={saving} disabled={!inviteEmail.trim()}>Send Invite</Button>
            </div>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowTeamModal(false)}>
          <div className="w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto rounded-xl border border-surface-800 bg-surface-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-6">Create Team</h2>
            <div className="space-y-4">
              <Input label="Team Name" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Writers Room" />
              <Textarea label="Description" value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} placeholder="What does this team do?" rows={2} />
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Color</label>
                <input type="color" value={teamColor} onChange={(e) => setTeamColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-3">Permissions</label>
                <div className="space-y-2">
                  {[
                    { key: 'can_create_projects', label: 'Create Projects' },
                    { key: 'can_edit_scripts', label: 'Edit Scripts' },
                    { key: 'can_manage_production', label: 'Manage Production' },
                    { key: 'can_view_budget', label: 'View Budget' },
                    { key: 'can_manage_budget', label: 'Manage Budget' },
                    { key: 'can_invite_members', label: 'Invite Members' },
                    { key: 'can_publish_community', label: 'Publish to Community' },
                    { key: 'can_manage_company', label: 'Manage Company' },
                  ].map((perm) => (
                    <label key={perm.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(teamPerms as Record<string, boolean>)[perm.key]}
                        onChange={(e) => setTeamPerms({ ...teamPerms, [perm.key]: e.target.checked })}
                        className="rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500"
                      />
                      <span className="text-sm text-surface-300">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-surface-800">
              <Button variant="ghost" onClick={() => setShowTeamModal(false)}>Cancel</Button>
              <Button onClick={createTeam} loading={saving} disabled={!teamName.trim()}>Create Team</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
