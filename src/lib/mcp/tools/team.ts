import { PRODUCTION_ROLES } from '@/lib/types';
import { ToolError, type McpContext } from '../context';
import { fillEmails, findUserByEmail } from '@/lib/private-profile';
import { s } from '../schema';
import { compact, must, tool } from '../tool';

const ROLES = ['admin', 'writer', 'editor', 'viewer'] as const;
const PRODUCTION_ROLE_VALUES = PRODUCTION_ROLES.map((r) => r.value).filter(Boolean);

const memberProps = {
  production_role: s.enum(PRODUCTION_ROLE_VALUES, 'Crew/cast role, e.g. director, dp, actor'),
  job_title: s.string(),
  department: s.string(),
  character_name: s.string('For actors: the character they play'),
};

async function findUser(ctx: McpContext, who: { email?: string; username?: string; user_id?: string }) {
  // Addresses are private (profile_contact); resolve them through the RPC
  if (!who.user_id && who.email) {
    const found = await findUserByEmail(ctx.db, who.email);
    if (!found) throw new ToolError('No Screenplay Studio account matches. They need to sign up first.');
    const { data } = await ctx.db.from('profiles').select('id, display_name, username').eq('id', found.id).maybeSingle();
    return { ...(data ?? { id: found.id, display_name: found.display_name, username: null }), email: who.email.trim() } as { id: string; email: string; display_name: string | null; username: string | null };
  }
  let query = ctx.db.from('profiles').select('id, email, display_name, username');
  if (who.user_id) query = query.eq('id', who.user_id);
  else if (who.username) query = query.ilike('username', who.username.replace(/^@/, '').trim());
  else throw new ToolError('Give an email, username or user_id');
  const { data } = await query.limit(1).maybeSingle();
  if (!data) throw new ToolError('No Screenplay Studio account matches. They need to sign up first.');
  return data as { id: string; email: string; display_name: string | null; username: string | null };
}

async function defaultChannel(ctx: McpContext, projectId: string, channelId?: string) {
  const query = ctx.db.from('project_channels').select('id, name').eq('project_id', projectId);
  const { data } = channelId
    ? await query.eq('id', channelId).maybeSingle()
    : await query.order('is_default', { ascending: false }).order('sort_order').limit(1).maybeSingle();
  if (!data) throw new ToolError(channelId ? `Channel ${channelId} not found in this project` : 'This project has no chat channels yet');
  return data as { id: string; name: string };
}

export const teamTools = [
  tool<{ project_id: string }>({
    name: 'list_members',
    title: 'List team members',
    access: 'read',
    description: 'The project team with access roles (owner/admin/writer/editor/viewer) and production roles.',
    input: s.object({ project_id: s.id('Project id') }, ['project_id']),
    async run(args, ctx) {
      await ctx.requireProject(args.project_id, 'read');
      const rows = must(
        await ctx.db.from('project_members').select('user_id, role, production_role, job_title, department, character_name, joined_at, profile:profiles!user_id(id, display_name, username, email)').eq('project_id', args.project_id).order('joined_at'),
        'Loading team',
      ) as Record<string, unknown>[];
      await fillEmails(ctx.db, rows.map((m) => m.profile as { id?: string; email?: string | null } | null));
      return rows.map((m) => {
        const p = (m.profile ?? {}) as Record<string, unknown>;
        return compact({ ...m, profile: undefined, name: p.display_name, username: p.username, email: p.email });
      });
    },
  }),

  tool<{ project_id: string; email?: string; username?: string; role?: (typeof ROLES)[number] } & Record<string, string | undefined>>({
    name: 'add_member',
    title: 'Add team member',
    access: 'write',
    description: 'Add an existing Screenplay Studio user to the project by email or username. They get a notification. Owner or admin role.',
    input: s.object({
      project_id: s.id('Project id'),
      email: s.string(),
      username: s.string(),
      role: s.enum(ROLES, 'Access role (default editor)'),
      ...memberProps,
    }, ['project_id']),
    async run(args, ctx) {
      const { project } = await ctx.requireProject(args.project_id, 'manage');
      const person = await findUser(ctx, args);
      const { data: existing } = await ctx.db.from('project_members').select('id').eq('project_id', args.project_id).eq('user_id', person.id).maybeSingle();
      if (existing) throw new ToolError(`${person.display_name ?? person.email} is already on the team. Use update_member to change their role.`);

      const role = args.role ?? 'editor';
      must(await ctx.db.from('project_members').insert({
        project_id: args.project_id,
        user_id: person.id,
        role,
        invited_by: ctx.user.id,
        ...compact({ production_role: args.production_role, job_title: args.job_title, department: args.department, character_name: args.character_name }),
      }), 'Adding member');

      await ctx.db.from('notifications').insert({
        user_id: person.id,
        type: 'project_invitation',
        title: `You were added to ${project.title}`,
        body: `${ctx.user.display_name || 'Someone'} invited you as ${role}`,
        link: `/projects/${args.project_id}`,
        actor_id: ctx.user.id,
        entity_type: 'project',
        entity_id: args.project_id,
      });
      await ctx.audit('add_member', 'project', args.project_id, { member: person.id, role });
      return { added: person.display_name ?? person.username ?? person.email, user_id: person.id, role };
    },
  }),

  tool<{ project_id: string; user_id: string; role?: (typeof ROLES)[number] } & Record<string, string | undefined>>({
    name: 'update_member',
    title: 'Update team member',
    access: 'write',
    description: 'Change a member\'s access role or production role, job title, department or character. Owner or admin role.',
    input: s.object({ project_id: s.id('Project id'), user_id: s.id('Member user id'), role: s.enum(ROLES), ...memberProps }, ['project_id', 'user_id']),
    async run(args, ctx) {
      const { project } = await ctx.requireProject(args.project_id, 'manage');
      if (args.user_id === project.created_by && args.role) throw new ToolError('The project owner\'s role cannot be changed.');
      const change = compact({ role: args.role, production_role: args.production_role, job_title: args.job_title, department: args.department, character_name: args.character_name });
      if (Object.keys(change).length === 0) throw new ToolError('Nothing to update');
      const rows = must(await ctx.db.from('project_members').update(change).eq('project_id', args.project_id).eq('user_id', args.user_id).select('user_id, role, production_role, job_title'), 'Updating member') as unknown[];
      if (!rows.length) throw new ToolError('That user is not on this project');
      await ctx.audit('update_member', 'project', args.project_id, { member: args.user_id, ...change });
      return rows[0];
    },
  }),

  tool<{ project_id: string; user_id: string }>({
    name: 'remove_member',
    title: 'Remove team member',
    access: 'write',
    destructive: true,
    description: 'Remove someone from the project team. Owner or admin role. The owner cannot be removed.',
    input: s.object({ project_id: s.id('Project id'), user_id: s.id('Member user id') }, ['project_id', 'user_id']),
    async run(args, ctx) {
      const { project } = await ctx.requireProject(args.project_id, 'manage');
      if (args.user_id === project.created_by) throw new ToolError('The project owner cannot be removed.');
      must(await ctx.db.from('project_members').delete().eq('project_id', args.project_id).eq('user_id', args.user_id), 'Removing member');
      await ctx.audit('remove_member', 'project', args.project_id, { member: args.user_id });
      return { removed: args.user_id };
    },
  }),

  tool<{ project_id: string; channel_id?: string; limit?: number }>({
    name: 'read_messages',
    title: 'Read project chat',
    access: 'read',
    description: 'Recent messages from a project chat channel (the default channel unless channel_id is given). List channels with list_records kind "channels".',
    input: s.object({ project_id: s.id('Project id'), channel_id: s.id('Channel id'), limit: s.integer('Default 30', { minimum: 1, maximum: 200 }) }, ['project_id']),
    async run(args, ctx) {
      await ctx.requireProject(args.project_id, 'read');
      const channel = await defaultChannel(ctx, args.project_id, args.channel_id);
      const rows = must(
        await ctx.db.from('channel_messages').select('id, content, created_at, is_edited, sender:profiles!sender_id(display_name, username)').eq('channel_id', channel.id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(args.limit ?? 30),
        'Loading messages',
      ) as Record<string, unknown>[];
      return {
        channel: channel.name,
        messages: rows.reverse().map((m) => {
          const sender = (m.sender ?? {}) as Record<string, unknown>;
          return compact({ id: m.id, from: sender.display_name ?? sender.username, at: m.created_at, text: m.content, edited: m.is_edited || undefined });
        }),
      };
    },
  }),

  tool<{ project_id: string; content: string; channel_id?: string }>({
    name: 'send_message',
    title: 'Post to project chat',
    access: 'write',
    description: 'Post a message to the project chat as you. Only when the user asks you to message their team.',
    input: s.object({ project_id: s.id('Project id'), content: s.string('Message text', { minLength: 1 }), channel_id: s.id('Channel id (default channel if omitted)') }, ['project_id', 'content']),
    async run(args, ctx) {
      await ctx.requireProject(args.project_id, 'read');
      ctx.requireScope('write');
      const channel = await defaultChannel(ctx, args.project_id, args.channel_id);
      const row = must(
        await ctx.db.from('channel_messages').insert({ channel_id: channel.id, sender_id: ctx.user.id, content: args.content, message_type: 'text' }).select('id, created_at').single(),
        'Sending message',
      );
      await ctx.audit('send_message', 'project_channel', channel.id, { project_id: args.project_id });
      return { sent: true, channel: channel.name, ...(row as object) };
    },
  }),
];
