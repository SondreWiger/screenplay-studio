'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Badge, Button, Card, Input, LoadingPage, Select, toast } from '@/components/ui';
import { TOKEN_SCOPES, type TokenScope } from '@/lib/mcp/scopes';
import { cn } from '@/lib/utils';

// Settings / Claude & MCP — personal access tokens for the MCP endpoint

interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  scope: TokenScope;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const EXPIRY_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'No expiry' },
];

type Client = 'claude-code' | 'claude-desktop' | 'cursor' | 'other';

const CLIENTS: { value: Client; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'claude-desktop', label: 'Claude Desktop' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'other', label: 'Other' },
];

function setupSnippet(client: Client, endpoint: string, token: string): string {
  switch (client) {
    case 'claude-code':
      return `claude mcp add --transport http screenplay-studio ${endpoint} --header "Authorization: Bearer ${token}"`;
    case 'claude-desktop':
      return JSON.stringify({
        mcpServers: {
          'screenplay-studio': {
            command: 'npx',
            args: ['-y', 'mcp-remote', endpoint, '--header', 'Authorization:${AUTH_HEADER}'],
            env: { AUTH_HEADER: `Bearer ${token}` },
          },
        },
      }, null, 2);
    case 'cursor':
      return JSON.stringify({
        mcpServers: { 'screenplay-studio': { url: endpoint, headers: { Authorization: `Bearer ${token}` } } },
      }, null, 2);
    default:
      return `URL:        ${endpoint}\nTransport:  Streamable HTTP\nHeader:     Authorization: Bearer ${token}`;
  }
}

const CLIENT_HINT: Record<Client, string> = {
  'claude-code': 'Run this in a terminal. Add --scope user to use it in every project.',
  'claude-desktop': 'Add to claude_desktop_config.json (Settings → Developer → Edit Config), then restart Claude Desktop.',
  cursor: 'Add to ~/.cursor/mcp.json, or .cursor/mcp.json in a project.',
  other: 'Any MCP client that supports Streamable HTTP with a custom header.',
};

function CopyBlock({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className={cn('relative group', className)}>
      <pre className="text-xs text-surface-200 bg-surface-950 border border-surface-800 rounded-lg p-3 pr-16 overflow-x-auto whitespace-pre font-mono">{text}</pre>
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 px-2 py-1 rounded-md text-[11px] font-medium bg-surface-800 text-surface-300 hover:text-white hover:bg-surface-700 transition-colors"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function relative(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function McpSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [eligible, setEligible] = useState(false);
  const [canCreateAdmin, setCanCreateAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [scope, setScope] = useState<TokenScope>('write');
  const [expiry, setExpiry] = useState('90');
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [client, setClient] = useState<Client>('claude-code');

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const endpoint = `${siteUrl}/api/mcp`;

  const load = useCallback(async () => {
    const res = await fetch('/api/mcp/tokens');
    if (res.ok) {
      const data = await res.json();
      setTokens(data.tokens ?? []);
      setEligible(Boolean(data.eligible));
      setCanCreateAdmin(Boolean(data.can_create_admin));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const create = async () => {
    if (!name.trim()) {
      toast.error('Give the token a name, e.g. "Claude Code on my laptop"');
      return;
    }
    setCreating(true);
    const res = await fetch('/api/mcp/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, scope, expires_in_days: expiry === 'never' ? null : Number(expiry) }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      toast.error(data.error || 'Could not create token');
      return;
    }
    setSecret(data.secret);
    setName('');
    setTokens((prev) => [data.token, ...prev]);
  };

  const revoke = async (token: TokenRow) => {
    const ok = await confirm({
      title: 'Revoke token',
      message: `"${token.name}" will stop working immediately. Any AI client using it will lose access.`,
      confirmLabel: 'Revoke',
      variant: 'danger',
    });
    if (!ok) return;
    const res = await fetch(`/api/mcp/tokens?id=${token.id}`, { method: 'DELETE' });
    if (res.ok) {
      setTokens((prev) => prev.filter((t) => t.id !== token.id));
      toast.success('Token revoked');
    } else {
      toast.error('Could not revoke token');
    }
  };

  if (authLoading || loading) return <LoadingPage />;
  if (!user) return null;

  const scopeOptions = TOKEN_SCOPES.filter((sc) => sc.value !== 'admin' || canCreateAdmin).map((sc) => ({ value: sc.value, label: sc.label }));
  const skillCommand = `mkdir -p ~/.claude/skills/screenplay-studio && curl -fsSL ${siteUrl}/mcp/SKILL.md -o ~/.claude/skills/screenplay-studio/SKILL.md`;

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      <div>
        <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>Claude & MCP</h1>
        <p className="text-sm text-surface-400 mt-1 max-w-2xl">
          Connect Claude, or any AI assistant that speaks the Model Context Protocol, to your Screenplay Studio account.
          It can then write and edit scripts, break them down, plan beats and arcs, build schedules and budgets, and manage your team — in the projects you already have access to.
        </p>
      </div>

      {!eligible ? (
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold text-white">MCP access is part of Pro</h2>
                <Badge variant="warning">Pro</Badge>
              </div>
              <p className="text-sm text-surface-400">Upgrade to create access tokens for Claude and other AI clients.</p>
            </div>
            <Link href="/pro"><Button size="sm">Upgrade to Pro</Button></Link>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Create an access token</h2>
            <p className="text-sm text-surface-400 mb-4">A token acts as you. Keep it secret, and make one per device so you can revoke them separately.</p>

            <div className="grid gap-3 sm:grid-cols-[1fr_180px_140px_auto] sm:items-end">
              <Input label="Name" placeholder="Claude Code on my laptop" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
              <Select label="Access" value={scope} onChange={(e) => setScope(e.target.value as TokenScope)} options={scopeOptions} />
              <Select label="Expires" value={expiry} onChange={(e) => setExpiry(e.target.value)} options={EXPIRY_OPTIONS} />
              <Button onClick={create} loading={creating}>Create token</Button>
            </div>
            <p className="text-xs text-surface-500 mt-2">{TOKEN_SCOPES.find((sc) => sc.value === scope)?.description}</p>

            {secret && (
              <div className="mt-5 rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                <p className="text-sm font-medium text-green-400 mb-2">Copy your token now. You will not see it again.</p>
                <CopyBlock text={secret} />
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Connect a client</h2>
            <p className="text-sm text-surface-400 mb-4">
              Endpoint: <code className="text-surface-200">{endpoint}</code>
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {CLIENTS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setClient(c.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    client === c.value ? 'bg-white/10 text-white' : 'text-surface-400 hover:text-white hover:bg-white/[0.04]',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <CopyBlock text={setupSnippet(client, endpoint, secret ?? 'YOUR_TOKEN')} />
            <p className="text-xs text-surface-500 mt-2">{CLIENT_HINT[client]}{!secret && ' Replace YOUR_TOKEN with a token created above.'}</p>

            <div className="mt-6 pt-5 border-t border-surface-800">
              <h3 className="text-sm font-semibold text-white mb-1">Add the Screenplay Studio skill</h3>
              <p className="text-sm text-surface-400 mb-3">
                The skill teaches Claude the workflows — writing in Fountain, breaking down a script, planning a shoot — so it uses the tools well.
                For Claude Code, run:
              </p>
              <CopyBlock text={skillCommand} />
              <p className="text-xs text-surface-500 mt-2">
                On claude.ai or Claude Desktop, download <a className="text-brand-400 hover:underline" href="/mcp/SKILL.md" target="_blank" rel="noreferrer">SKILL.md</a>, put it in a folder named screenplay-studio, zip it, and upload it under Settings → Capabilities → Skills.
              </p>
            </div>
          </Card>
        </>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Your tokens</h2>
        {tokens.length === 0 ? (
          <p className="text-sm text-surface-500">No active tokens.</p>
        ) : (
          <div className="divide-y divide-surface-800">
            {tokens.map((t) => {
              const expired = t.expires_at && new Date(t.expires_at) < new Date();
              return (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{t.name}</p>
                      <Badge variant={t.scope === 'admin' ? 'error' : t.scope === 'write' ? 'info' : 'default'}>{TOKEN_SCOPES.find((sc) => sc.value === t.scope)?.label}</Badge>
                      {expired && <Badge variant="warning">Expired</Badge>}
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5 font-mono">
                      {t.token_prefix}… · last used {relative(t.last_used_at).toLowerCase()} · {t.expires_at ? `${expired ? 'expired' : 'expires'} ${new Date(t.expires_at).toLocaleDateString()}` : 'no expiry'}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => revoke(t)}>Revoke</Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
