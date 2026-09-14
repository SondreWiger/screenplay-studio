/** Token scopes. Kept apart from tokens.ts so the settings page can import them without Node's crypto. */

export type TokenScope = 'read' | 'write' | 'admin';

export const TOKEN_SCOPES: { value: TokenScope; label: string; description: string }[] = [
  { value: 'read', label: 'Read only', description: 'Browse projects, read scripts and data. Cannot change anything.' },
  { value: 'write', label: 'Read & write', description: 'Everything you can do in your projects: write, plan, organise.' },
  { value: 'admin', label: 'Platform admin', description: 'Write access plus site administration. Admins only.' },
];
