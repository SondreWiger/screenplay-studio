import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { s, validate } from '@/lib/mcp/schema';
import { KINDS, cleanRecord, parseField, parseFilter } from '@/lib/mcp/kinds';
import { roleAllows, type McpContext } from '@/lib/mcp/context';
import { generateToken, hashToken, scopeAllows, tokenFromHeader } from '@/lib/mcp/tokens';
import { cueName, findReplace, neighbours, ordersBetween, outline, renumberScenes, scriptStats, type ElementLite } from '@/lib/mcp/script-ops';
import { handleMessage, listTools, LATEST_PROTOCOL_VERSION } from '@/lib/mcp/server';
import { TOOLS } from '@/lib/mcp/tools';
import { parseSceneHeading } from '@/lib/scripts/scene-heading';

function el(id: string, type: ElementLite['element_type'], content: string, sort: number, extra: Partial<ElementLite> = {}): ElementLite {
  return { id, element_type: type, content, sort_order: sort, scene_number: null, is_omitted: false, ...extra };
}

function fakeCtx(overrides: Partial<McpContext> = {}): McpContext {
  const fail = () => { throw new Error('no database in tests'); };
  return {
    db: new Proxy({}, { get: fail }) as McpContext['db'],
    user: { id: 'u1', email: 'a@b.c', display_name: 'A', username: 'a', role: 'writer', is_pro: true, moderation_status: 'clean' },
    scope: 'write',
    tokenId: 't1',
    isPlatformAdmin: false,
    siteUrl: 'https://example.test',
    requireScope: () => {},
    requireProject: fail,
    requireScript: fail,
    requirePlatformAdmin: () => {},
    audit: async () => {},
    ...overrides,
  };
}

describe('schema validation', () => {
  const schema = s.object({
    name: s.string(),
    mode: s.enum(['a', 'b']),
    count: s.integer('', { minimum: 1 }),
    items: s.array(s.object({ id: s.string() }, ['id'])),
    data: s.record(),
  }, ['name']);

  it('accepts valid input', () => {
    expect(validate(schema, { name: 'x', mode: 'a', count: 2, items: [{ id: '1' }], data: { anything: true } })).toEqual([]);
  });

  it('reports missing, mistyped, out-of-range, unknown and nested problems', () => {
    const errors = validate(schema, { mode: 'c', count: 0, items: [{}], extra: 1 });
    expect(errors).toEqual(expect.arrayContaining([
      'arguments.name is required',
      'arguments.mode must be one of: a, b',
      'arguments.count must be at least 1',
      'arguments.items[0].id is required',
      expect.stringContaining('arguments.extra is not a known option'),
    ]));
  });

  it('rejects non-integers for integer fields', () => {
    expect(validate(s.integer(), 1.5)).toEqual(['arguments must be an integer, got number']);
  });
});

describe('record kinds', () => {
  const VALID_TYPES = new Set(['text', 'int', 'number', 'bool', 'date', 'datetime', 'time', 'uuid', 'json', 'text[]', 'uuid[]', 'enum']);
  const PROTECTED = ['id', 'project_id', 'created_by', 'owner_id', 'created_at', 'updated_at', 'last_edited_by', 'token'];

  it('every field spec parses to a known type', () => {
    for (const [name, kind] of Object.entries(KINDS)) {
      for (const [field, spec] of Object.entries(kind.fields)) {
        expect(VALID_TYPES.has(parseField(spec).type), `${name}.${field} = ${spec}`).toBe(true);
      }
    }
  });

  it('never lets a client write ownership columns', () => {
    for (const [name, kind] of Object.entries(KINDS)) {
      for (const col of PROTECTED) expect(kind.fields[col], `${name} exposes ${col}`).toBeUndefined();
      if (kind.stamp) expect(kind.fields[kind.stamp], `${name} exposes ${kind.stamp}`).toBeUndefined();
      if (kind.owner) expect(kind.fields[kind.owner], `${name} exposes ${kind.owner}`).toBeUndefined();
    }
  });

  it('user kinds say how they are owned', () => {
    for (const [name, kind] of Object.entries(KINDS)) {
      if (kind.scope === 'user') expect(Boolean(kind.owner || kind.parent), name).toBe(true);
      if (kind.parent) expect(KINDS[kind.parent.kind]?.owner, `${name} parent`).toBeTruthy();
    }
  });

  it('cleanRecord validates values and required fields', () => {
    const ok = cleanRecord(KINDS.characters, { name: 'Maya', is_main: true, personality_traits: ['stubborn'] }, 'create');
    expect(ok.errors).toEqual([]);
    expect(ok.values).toEqual({ name: 'Maya', is_main: true, personality_traits: ['stubborn'] });

    const bad = cleanRecord(KINDS.characters, { is_main: 'yes', project_id: 'x' }, 'create');
    expect(bad.errors).toEqual(expect.arrayContaining([
      'is_main must be true or false',
      '"project_id" is not a writable field of characters',
      'name is required',
    ]));
  });

  it('cleanRecord checks enums, dates, times and uuids', () => {
    const { errors } = cleanRecord(KINDS.shoot_days, { day_number: 1, shoot_date: '03/01/2026', call_time: '7am', status: 'maybe' }, 'create');
    expect(errors).toEqual(expect.arrayContaining([
      'shoot_date must be a date like 2026-03-01',
      'call_time must be a time like 07:30',
      'status must be one of: planned, confirmed, completed, cancelled',
    ]));
    expect(cleanRecord(KINDS.shots, { scene_id: 'not-a-uuid' }, 'update').errors).toEqual(['scene_id must be a uuid']);
    expect(cleanRecord(KINDS.shots, {}, 'update').errors).toEqual(['nothing to update']);
  });

  it('parseFilter understands shorthand and operators, and refuses unknown columns', () => {
    const { filters, errors } = parseFilter(KINDS.budget, {
      category: ['talent', 'equipment'],
      estimated_amount: { gte: 100, lt: 5000 },
      vendor: null,
      is_paid: false,
      bogus: 1,
    });
    expect(filters).toEqual([
      { column: 'category', op: 'in', value: ['talent', 'equipment'] },
      { column: 'estimated_amount', op: 'gte', value: 100 },
      { column: 'estimated_amount', op: 'lt', value: 5000 },
      { column: 'vendor', op: 'is', value: null },
      { column: 'is_paid', op: 'eq', value: false },
    ]);
    expect(errors).toEqual(['cannot filter budget_items by "bogus"']);
    expect(parseFilter(KINDS.budget, { amount: { between: 1 } }).errors[0]).toMatch(/cannot filter/);
    expect(parseFilter(KINDS.budget, { vendor: { between: 1 } }).errors[0]).toMatch(/unknown filter operator/);
  });
});

describe('access rules', () => {
  const plain = { isCreator: false, isPlatformAdmin: false };

  it('maps project roles to levels', () => {
    expect(roleAllows('viewer', 'read', plain)).toBe(true);
    expect(roleAllows('viewer', 'write', plain)).toBe(false);
    expect(roleAllows('writer', 'write', plain)).toBe(true);
    expect(roleAllows('editor', 'manage', plain)).toBe(false);
    expect(roleAllows('admin', 'manage', plain)).toBe(true);
    expect(roleAllows('admin', 'own', plain)).toBe(false);
    expect(roleAllows('owner', 'own', plain)).toBe(true);
    expect(roleAllows(null, 'read', plain)).toBe(false);
  });

  it('treats the creator as owner and lets platform admins read but not write', () => {
    expect(roleAllows(null, 'own', { isCreator: true, isPlatformAdmin: false })).toBe(true);
    expect(roleAllows(null, 'read', { isCreator: false, isPlatformAdmin: true })).toBe(true);
    expect(roleAllows(null, 'write', { isCreator: false, isPlatformAdmin: true })).toBe(false);
  });
});

describe('tokens', () => {
  it('generates prefixed tokens whose hash matches', () => {
    const { token, hash, prefix } = generateToken();
    expect(token).toMatch(/^sps_[A-Za-z0-9_-]{43}$/);
    expect(hashToken(token)).toBe(hash);
    expect(token.startsWith(prefix)).toBe(true);
    expect(generateToken().token).not.toBe(token);
  });

  it('reads bearer headers strictly', () => {
    const { token } = generateToken();
    expect(tokenFromHeader(`Bearer ${token}`)).toBe(token);
    expect(tokenFromHeader(`bearer ${token}`)).toBe(token);
    expect(tokenFromHeader(token)).toBeNull();
    expect(tokenFromHeader('Bearer eyJhbGciOi.supabase.jwt')).toBeNull();
    expect(tokenFromHeader(null)).toBeNull();
  });

  it('orders scopes read < write < admin', () => {
    expect(scopeAllows('read', 'write')).toBe(false);
    expect(scopeAllows('write', 'read')).toBe(true);
    expect(scopeAllows('admin', 'write')).toBe(true);
  });
});

describe('script ops', () => {
  const script = [
    el('h1', 'scene_heading', 'INT. KITCHEN - NIGHT', 0, { scene_number: '1' }),
    el('a1', 'action', 'Maya enters.', 1),
    el('c1', 'character', 'MAYA (V.O.)', 2),
    el('d1', 'dialogue', 'Hello there, hello.', 3),
    el('h2', 'scene_heading', 'EXT. GARDEN - DAY', 4, { scene_number: '2' }),
    el('c2', 'character', "TOM (CONT'D)", 5),
    el('d2', 'dialogue', 'Othello is here.', 6),
    el('o1', 'action', 'An omitted line.', 7, { is_omitted: true }),
  ];

  it('places new elements between neighbours', () => {
    expect(ordersBetween(1, 2, 3)).toEqual([1.25, 1.5, 1.75]);
    expect(ordersBetween(5, null, 2)).toEqual([6, 7]);
    expect(ordersBetween(null, 0, 2)).toEqual([-2, -1]);
    expect(ordersBetween(null, null, 2)).toEqual([0, 1]);
    expect(ordersBetween(1, 1 + 1e-9, 1)).toBeNull();
    expect(neighbours(script, { position: 'after', id: 'a1' })).toEqual({ prev: 1, next: 2 });
    expect(neighbours(script, { position: 'before', id: 'h1' })).toEqual({ prev: null, next: 0 });
    expect(neighbours(script, { position: 'end' })).toEqual({ prev: 7, next: null });
    expect(() => neighbours(script, { position: 'after', id: 'nope' })).toThrow();
  });

  it('renumbers plain scene numbers but leaves production numbering alone', () => {
    const inserted = [...script.slice(0, 4), el('hx', 'scene_heading', 'INT. HALL - DAY', 3.5), ...script.slice(4)].sort((a, b) => a.sort_order - b.sort_order);
    expect(renumberScenes(inserted)).toEqual([{ id: 'hx', scene_number: '2' }, { id: 'h2', scene_number: '3' }]);
    const locked = inserted.map((e) => (e.id === 'h2' ? { ...e, scene_number: '2A' } : e));
    expect(renumberScenes(locked)).toEqual([]);
  });

  it('finds and replaces with case and whole-word options', () => {
    expect(findReplace(script, 'hello', 'hi').map((r) => [r.id, r.after, r.count])).toEqual([['d1', 'hi there, hi.', 2], ['d2', 'Othi is here.', 1]]);
    expect(findReplace(script, 'Hello', 'hi', { matchCase: true }).map((r) => r.id)).toEqual(['d1']);
    expect(findReplace(script, 'hello', null, { wholeWord: true }).map((r) => r.id)).toEqual(['d1']);
    expect(findReplace(script, 'ello', null, { wholeWord: true })).toEqual([]);
    expect(findReplace(script, 'MAYA', 'JUNE', { elementTypes: ['character'] }).map((r) => r.after)).toEqual(['JUNE (V.O.)']);
    expect(findReplace(script, 'a.b', 'x')).toEqual([]);
  });

  it('strips extensions from character cues', () => {
    expect(cueName('MAYA (V.O.)')).toBe('MAYA');
    expect(cueName("tom (cont'd)")).toBe('TOM');
    expect(cueName('BOB ^')).toBe('BOB');
  });

  it('outlines scenes with characters and a summary', () => {
    const scenes = outline(script);
    expect(scenes.map((sc) => [sc.heading, sc.characters, sc.summary])).toEqual([
      ['INT. KITCHEN - NIGHT', ['MAYA'], 'Maya enters.'],
      ['EXT. GARDEN - DAY', ['TOM'], ''],
    ]);
  });

  it('computes stats without omitted elements', () => {
    const stats = scriptStats(script);
    expect(stats.scenes).toBe(2);
    expect(stats.elements).toBe(7);
    expect(stats.interior_exterior).toEqual({ int: 1, ext: 1 });
    expect(stats.day_night).toEqual({ day: 1, night: 1 });
    expect(stats.characters.map((c) => c.name)).toEqual(['MAYA', 'TOM']);
    expect(stats.locations).toEqual([{ name: 'KITCHEN', scenes: 1 }, { name: 'GARDEN', scenes: 1 }]);
  });

  it('parses scene headings the way the Scenes page does', () => {
    expect(parseSceneHeading('INT./EXT. CAR - MOVING - NIGHT')).toEqual({ locationType: 'INT_EXT', locationName: 'CAR', timeOfDay: 'NIGHT' });
    expect(parseSceneHeading('ext. beach')).toEqual({ locationType: 'EXT', locationName: 'BEACH', timeOfDay: 'DAY' });
  });
});

describe('MCP protocol', () => {
  it('negotiates the protocol version on initialize', async () => {
    const res = await handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, fakeCtx());
    expect(res).toMatchObject({ id: 1, result: { protocolVersion: '2025-03-26', serverInfo: { name: 'screenplay-studio' }, capabilities: { tools: {} } } });
    const unknown = await handleMessage({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, fakeCtx());
    expect(unknown).toMatchObject({ result: { protocolVersion: LATEST_PROTOCOL_VERSION } });
  });

  it('does not answer notifications and rejects unknown methods', async () => {
    expect(await handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, fakeCtx())).toBeNull();
    expect(await handleMessage({ jsonrpc: '2.0', id: 3, method: 'sampling/createMessage' }, fakeCtx())).toMatchObject({ error: { code: -32601 } });
    expect(await handleMessage('nope', fakeCtx())).toMatchObject({ error: { code: -32600 } });
    expect(await handleMessage({ jsonrpc: '2.0', id: 4, method: 'ping' }, fakeCtx())).toEqual({ jsonrpc: '2.0', id: 4, result: {} });
  });

  it('lists only the tools a token can use', () => {
    const names = (ctx: Partial<McpContext>) => listTools({ scope: 'write', isPlatformAdmin: false, ...ctx } as McpContext).map((t) => t.name);
    const read = names({ scope: 'read' });
    const write = names({ scope: 'write' });
    const adminNotPlatform = names({ scope: 'admin' });
    const platformAdmin = names({ scope: 'admin', isPlatformAdmin: true });

    expect(read).toContain('read_script');
    expect(read).not.toContain('write_script');
    expect(write).toContain('write_script');
    expect(write.some((n) => n.startsWith('admin_'))).toBe(false);
    expect(adminNotPlatform.some((n) => n.startsWith('admin_'))).toBe(false);
    expect(platformAdmin).toContain('admin_moderate_user');
    expect(platformAdmin.length).toBe(TOOLS.length);
  });

  it('marks destructive and read-only tools for clients', () => {
    const tools = listTools({ scope: 'admin', isPlatformAdmin: true } as McpContext);
    expect(tools.find((t) => t.name === 'delete_records')?.annotations).toMatchObject({ destructiveHint: true, readOnlyHint: false });
    expect(tools.find((t) => t.name === 'list_records')?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
  });

  it('validates arguments before running a tool', async () => {
    const res = await handleMessage({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'read_script', arguments: { format: 'pdf' } } }, fakeCtx());
    const result = (res as { result: { isError: boolean; content: { text: string }[] } }).result;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('arguments.script_id is required');
    expect(result.content[0].text).toContain('arguments.format must be one of');
  });

  it('refuses tools the token cannot see, and unknown tools', async () => {
    const call = async (name: string, ctx: McpContext) =>
      ((await handleMessage({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name, arguments: {} } }, ctx)) as { result: { isError?: boolean; content: { text: string }[] } }).result;
    expect((await call('write_script', fakeCtx({ scope: 'read' }))).content[0].text).toContain('needs a write token');
    expect((await call('admin_stats', fakeCtx({ scope: 'admin' }))).isError).toBe(true);
    expect((await call('make_coffee', fakeCtx())).content[0].text).toContain('Unknown tool');
  });

  it('runs a tool and returns its result as text', async () => {
    const res = await handleMessage({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'describe_kinds', arguments: { kind: 'scenes' } } }, fakeCtx());
    const body = JSON.parse((res as { result: { content: { text: string }[] } }).result.content[0].text);
    expect(body.kind).toBe('scenes');
    expect(body.fields.location_type).toContain('INT | EXT');
  });

  it('hides platform kinds from non-admins', async () => {
    const res = await handleMessage({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'describe_kinds', arguments: {} } }, fakeCtx());
    const kinds = JSON.parse((res as { result: { content: { text: string }[] } }).result.content[0].text).kinds.map((k: { kind: string }) => k.kind);
    expect(kinds).toContain('characters');
    expect(kinds).not.toContain('site_settings');
  });

  it('turns thrown tool errors into readable results', async () => {
    const res = await handleMessage({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'describe_kinds', arguments: { kind: 'wizards' } } }, fakeCtx());
    expect((res as { result: { isError: boolean; content: { text: string }[] } }).result).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('Unknown kind "wizards"') }] });
  });
});

describe('tool definitions and docs', () => {
  const skill = readFileSync(path.resolve(__dirname, '../public/mcp/SKILL.md'), 'utf8');
  const docs = readFileSync(path.resolve(__dirname, '../docs/mcp.md'), 'utf8');

  it('tools have unique snake_case names, object schemas and descriptions', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(t.input.type).toBe('object');
      expect(t.description.length).toBeGreaterThan(20);
      if (/^(delete|remove)_/.test(t.name)) expect(t.destructive, t.name).toBe(true);
    }
  });

  it('the skill has valid frontmatter', () => {
    expect(skill).toMatch(/^---\nname: screenplay-studio\ndescription: .{50,1024}\n---\n/);
  });

  it('the skill and docs mention every tool', () => {
    for (const t of TOOLS) {
      expect(skill, `SKILL.md is missing ${t.name}`).toContain(`\`${t.name}\``);
      expect(docs, `docs/mcp.md is missing ${t.name}`).toContain(`\`${t.name}\``);
    }
  });

  it('the skill mentions every record kind', () => {
    for (const name of Object.keys(KINDS)) {
      expect(skill, `SKILL.md is missing kind ${name}`).toContain(`\`${name}\``);
    }
  });
});
