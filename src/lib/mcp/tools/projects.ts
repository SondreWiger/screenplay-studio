import { KINDS, cleanRecord, type RecordKind } from '../kinds';
import { ToolError } from '../context';
import { s } from '../schema';
import { compact, must, tool } from '../tool';
import { writeFountain } from './scripts';
import { fillEmails } from '@/lib/private-profile';

const SCRIPT_TYPES = ['screenplay', 'stageplay', 'episodic', 'sketch', 'comic', 'podcast', 'audio_drama', 'youtube', 'tiktok', 'videogame'] as const;
const PROJECT_TYPES = ['film', 'youtube', 'tiktok', 'podcast', 'audio_drama', 'documentary', 'educational', 'livestream', 'tv_production', 'stage_play', 'videogame'] as const;
const PROJECT_STATUS = ['development', 'pre_production', 'production', 'post_production', 'completed', 'archived'] as const;

/** The project columns a client may change. Ownership and billing columns are deliberately absent. */
export const PROJECT_FIELDS: RecordKind = {
  table: 'projects', group: 'story', scope: 'project', title: 'title',
  about: 'A project.',
  fields: {
    title: 'text!', logline: 'text', synopsis: 'text', genre: 'text[]', format: 'text', script_type: SCRIPT_TYPES.join('|'),
    project_type: PROJECT_TYPES.join('|'), status: PROJECT_STATUS.join('|'), target_length_minutes: 'int', episode_count: 'int',
    season_number: 'int', language: 'text', poster_url: 'text', cover_url: 'text', accent_color: 'text', page_size: 'letter|a4',
    external_links: 'json', production_trivia: 'json', set_photos: 'json', is_showcased: 'bool', showcase_description: 'text',
    showcase_script: 'bool', showcase_mindmap: 'bool', showcase_moodboard: 'bool', showcase_video_url: 'text', trailer_url: 'text',
    director: 'text', producer: 'text', dp: 'text', editor: 'text', composer: 'text', distributor: 'text', production_year: 'int',
    runtime_minutes: 'int', country: 'text', imdb_url: 'text', website_url: 'text', content_rating: 'text', aspect_ratio: 'text',
    color_format: 'text', shooting_format: 'text', premiere_type: 'text', has_premiered: 'bool', premiere_festival: 'text',
    premiere_date: 'date', press_kit_enabled: 'bool', press_kit_tagline: 'text', press_kit_contact: 'text', custom_branding: 'json',
  },
};

const PROJECT_SUMMARY = 'id, title, logline, status, project_type, script_type, format, genre, updated_at, created_by';

export const projectTools = [
  tool<Record<string, never>>({
    name: 'whoami',
    title: 'Who am I',
    access: 'read',
    description: 'Your account, token scope and a count of your projects. A good first call.',
    input: s.object({}),
    async run(_args, ctx) {
      const { count } = await ctx.db.from('project_members').select('id', { count: 'exact', head: true }).eq('user_id', ctx.user.id);
      return {
        user: compact({ id: ctx.user.id, email: ctx.user.email, display_name: ctx.user.display_name, username: ctx.user.username, pro: ctx.user.is_pro }),
        token_scope: ctx.scope,
        platform_admin: ctx.isPlatformAdmin,
        projects: count ?? 0,
        site: ctx.siteUrl,
      };
    },
  }),

  tool<{ query?: string; status?: string; include_archived?: boolean }>({
    name: 'list_projects',
    title: 'List projects',
    access: 'read',
    description: 'Projects you own or are a member of, most recently updated first, with your role in each.',
    input: s.object({
      query: s.string('Match against title or logline'),
      status: s.enum(PROJECT_STATUS),
      include_archived: s.boolean('Include archived projects (default false)'),
    }),
    async run(args, ctx) {
      const memberships = must(
        await ctx.db.from('project_members').select('project_id, role').eq('user_id', ctx.user.id),
        'Loading memberships',
      ) as { project_id: string; role: string }[];
      const roles = new Map(memberships.map((m) => [m.project_id, m.role]));

      // Creators are normally members too (a trigger adds them), but older projects may predate it.
      const [owned, joined] = await Promise.all([
        ctx.db.from('projects').select(PROJECT_SUMMARY).eq('created_by', ctx.user.id),
        roles.size ? ctx.db.from('projects').select(PROJECT_SUMMARY).in('id', Array.from(roles.keys())) : Promise.resolve({ data: [], error: null }),
      ]);
      const byId = new Map<string, Record<string, unknown>>();
      const rows = [...(must<Record<string, unknown>[]>(owned, 'Loading projects') ?? []), ...(must<Record<string, unknown>[]>(joined, 'Loading projects') ?? [])];
      for (const p of rows) {
        byId.set(p.id as string, p);
      }

      const q = args.query?.toLowerCase();
      const projects = Array.from(byId.values())
        .filter((p) => args.include_archived || args.status === 'archived' || p.status !== 'archived')
        .filter((p) => !args.status || p.status === args.status)
        .filter((p) => !q || `${p.title} ${p.logline ?? ''}`.toLowerCase().includes(q))
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
        .map((p) => compact({
          ...p,
          created_by: undefined,
          your_role: p.created_by === ctx.user.id ? 'owner' : roles.get(p.id as string),
        }));

      return { count: projects.length, projects };
    },
  }),

  tool<{ project_id: string }>({
    name: 'get_project',
    title: 'Project overview',
    access: 'read',
    description:
      'Everything at a glance for one project: details, your role, scripts/episodes, team, and how many records of each kind exist (characters, scenes, shots, budget lines, ...). Start here before working in a project.',
    input: s.object({ project_id: s.id('Project id') }, ['project_id']),
    async run(args, ctx) {
      const access = await ctx.requireProject(args.project_id, 'read');
      const projectKinds = Object.entries(KINDS).filter(([, k]) => k.scope === 'project');

      const [project, scripts, members, ...counts] = await Promise.all([
        ctx.db.from('projects').select('*').eq('id', args.project_id).single(),
        ctx.db.from('scripts').select('id, title, revision_color, locked, metadata, updated_at').eq('project_id', args.project_id).order('created_at'),
        ctx.db.from('project_members').select('user_id, role, production_role, job_title, department, character_name, profile:profiles!user_id(id, display_name, username, email)').eq('project_id', args.project_id),
        ...projectKinds.map(([, k]) => ctx.db.from(k.table).select('*', { count: 'exact', head: true }).eq('project_id', args.project_id)),
      ]);

      await fillEmails(ctx.db, ((members as { data?: { profile?: { id?: string; email?: string | null } | null }[] | null }).data || []).map((m) => m.profile));
      const p = must(project, 'Loading project') as Record<string, unknown>;
      const meta = (p.content_metadata ?? {}) as Record<string, unknown>;
      const record_counts: Record<string, number> = {};
      projectKinds.forEach(([name], i) => {
        const n = counts[i].count ?? 0;
        if (n > 0) record_counts[name] = n;
      });

      return {
        project: compact({ ...p, content_metadata: undefined, sidebar_tabs: undefined, press_kit_password: undefined }),
        url: `${ctx.siteUrl}/projects/${args.project_id}`,
        your_role: access.role,
        scripts: (must(scripts, 'Loading scripts') as Record<string, unknown>[]).map((sc) => {
          const m = (sc.metadata ?? {}) as Record<string, unknown>;
          return compact({ id: sc.id, title: sc.title, locked: sc.locked || undefined, season: m.episode_season, episode_order: m.sort_order, updated_at: sc.updated_at });
        }),
        team: (must(members, 'Loading team') as Record<string, unknown>[]).map((m) => {
          const profile = (m.profile ?? {}) as Record<string, unknown>;
          return compact({ user_id: m.user_id, name: profile.display_name ?? profile.username ?? profile.email, role: m.role, production_role: m.production_role, job_title: m.job_title, department: m.department, character_name: m.character_name });
        }),
        record_counts,
        has_beat_sheet: Boolean(meta.beat_sheets || meta.beat_sheet),
        has_arc_map: Boolean(meta.arc_map),
      };
    },
  }),

  tool<{ title: string; fountain?: string } & Record<string, unknown>>({
    name: 'create_project',
    title: 'Create project',
    access: 'write',
    description:
      'Create a project. You become the owner and it starts with one empty script. Pass `fountain` to write the first draft straight into that script.',
    input: s.object({
      title: s.string('Project title', { minLength: 1 }),
      logline: s.string(),
      synopsis: s.string(),
      project_type: s.enum(PROJECT_TYPES, 'What is being made (default film)'),
      script_type: s.enum(SCRIPT_TYPES, 'Writing format (default screenplay). Use episodic for series.'),
      format: s.string('e.g. feature, short, pilot, web series'),
      genre: s.array(s.string()),
      status: s.enum(PROJECT_STATUS),
      target_length_minutes: s.integer(),
      episode_count: s.integer(),
      season_number: s.integer(),
      language: s.string('Language code, e.g. en'),
      fountain: s.string('Optional first draft in Fountain format'),
    }, ['title']),
    async run(args, ctx) {
      ctx.requireScope('write');
      const { fountain, ...fields } = args;
      const { values, errors } = cleanRecord(PROJECT_FIELDS, fields, 'create');
      if (errors.length) throw new ToolError(errors.join('; '));

      const project = must(
        await ctx.db.from('projects').insert({ project_type: 'film', script_type: 'screenplay', ...values, created_by: ctx.user.id }).select('id, title').single(),
        'Creating project',
      ) as { id: string; title: string };

      // The database trigger adds the owner membership and a first script. Older
      // databases without it still get a working project.
      const { data: member } = await ctx.db.from('project_members').select('id').eq('project_id', project.id).eq('user_id', ctx.user.id).maybeSingle();
      if (!member) await ctx.db.from('project_members').insert({ project_id: project.id, user_id: ctx.user.id, role: 'owner' });

      let { data: script } = await ctx.db.from('scripts').select('id, title').eq('project_id', project.id).order('created_at').limit(1).maybeSingle();
      if (!script) {
        script = must(await ctx.db.from('scripts').insert({ project_id: project.id, title: `${project.title} - Draft 1`, created_by: ctx.user.id }).select('id, title').single(), 'Creating script');
      }

      let written: unknown;
      if (fountain?.trim()) written = await writeFountain(ctx, script!.id, fountain, { position: 'end' }, { titlePage: true });

      await ctx.audit('create_project', 'project', project.id, { title: project.title });
      return { project_id: project.id, script_id: script!.id, url: `${ctx.siteUrl}/projects/${project.id}`, ...(written ? { script: written } : {}) };
    },
  }),

  tool<{ project_id: string; changes: Record<string, unknown> }>({
    name: 'update_project',
    title: 'Update project',
    access: 'write',
    description: 'Change project details: title, logline, synopsis, genre, status, format, showcase and press kit settings, credits metadata. Owner or admin role.',
    input: s.object({
      project_id: s.id('Project id'),
      changes: s.record(`Fields to change. Writable: ${Object.keys(PROJECT_FIELDS.fields).join(', ')}`),
    }, ['project_id', 'changes']),
    async run(args, ctx) {
      await ctx.requireProject(args.project_id, 'manage');
      const { values, errors } = cleanRecord(PROJECT_FIELDS, args.changes, 'update');
      if (errors.length) throw new ToolError(errors.join('; '));
      const row = must(
        await ctx.db.from('projects').update({ ...values, updated_at: new Date().toISOString() }).eq('id', args.project_id).select(PROJECT_SUMMARY).single(),
        'Updating project',
      );
      await ctx.audit('update_project', 'project', args.project_id, { fields: Object.keys(values) });
      return compact(row as Record<string, unknown>);
    },
  }),

  tool<{ project_id: string; confirm_title: string }>({
    name: 'delete_project',
    title: 'Delete project',
    access: 'write',
    destructive: true,
    description:
      'Permanently delete a project and everything in it. Owner only. Only call this when the user has explicitly asked, and pass the exact project title as confirm_title. Prefer update_project with status "archived" when unsure.',
    input: s.object({
      project_id: s.id('Project id'),
      confirm_title: s.string('The exact current project title'),
    }, ['project_id', 'confirm_title']),
    async run(args, ctx) {
      const { project } = await ctx.requireProject(args.project_id, 'own');
      if (args.confirm_title !== project.title) {
        throw new ToolError(`confirm_title does not match. The project is titled "${project.title}".`);
      }
      must(await ctx.db.from('projects').delete().eq('id', args.project_id), 'Deleting project');
      await ctx.audit('delete_project', 'project', args.project_id, { title: project.title });
      return { deleted: true, project_id: args.project_id, title: project.title };
    },
  }),
];
