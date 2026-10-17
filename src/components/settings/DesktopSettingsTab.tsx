'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cloud, FolderOpen, HardDrive, Monitor, Moon, RefreshCw, ScrollText, Sun } from 'lucide-react';
import { Button, Card, Toggle, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { DesktopInfo, DesktopSettings, DesktopUpdateStatus } from '@/types/electron';

/** Chromium zoom levels the desktop app steps through (factor = 1.2^level). */
const ZOOM_STEPS = [-1, -0.5, 0, 0.5, 1, 1.5, 2];
const zoomPercent = (level: number) => Math.round(Math.pow(1.2, level) * 100);

function Segmented<T extends string>({
  value, options, onChange, label,
}: {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-surface-700 bg-surface-900/60 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            value === opt.value ? 'bg-surface-700 text-white shadow-sm' : 'text-surface-400 hover:text-white',
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        {description && <p className="mt-0.5 text-xs text-surface-500">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function shortcutKeys(mac: boolean) {
  const mod = mac ? '⌘' : 'Ctrl';
  const shift = mac ? '⇧' : 'Shift';
  const join = (...k: string[]) => (mac ? k.join('') : k.join('+'));
  return [
    { keys: join(mod, 'N'), action: 'New project' },
    { keys: join(mod, shift, 'N'), action: 'New window' },
    { keys: join(mod, 'O'), action: 'Open a script or project file' },
    { keys: join(mod, 'S'), action: 'Save the script to a file' },
    { keys: join(mod, 'K'), action: 'Command palette' },
    { keys: join(mod, '\\'), action: 'Show or hide the sidebar' },
    { keys: `${join(mod, '[')} / ${join(mod, ']')}`, action: 'Back / forward' },
    { keys: `${join(mod, '+')} / ${join(mod, '-')}`, action: 'Bigger / smaller text' },
    { keys: join(mod, ','), action: 'These settings' },
    { keys: join(mod, '/'), action: 'All keyboard shortcuts' },
  ];
}

export function DesktopSettingsTab() {
  const router = useRouter();
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [info, setInfo] = useState<DesktopInfo | null>(null);
  const [update, setUpdate] = useState<DesktopUpdateStatus>({ state: 'idle' });
  const [storage, setStorage] = useState<'cloud' | 'local'>('cloud');
  const bridge = typeof window !== 'undefined' ? window.electron : undefined;
  const mac = bridge?.platform === 'darwin';
  const fileManager = mac ? 'Finder' : bridge?.platform === 'win32' ? 'File Explorer' : 'your file manager';

  useEffect(() => {
    if (!bridge) return;
    bridge.getSettings?.().then(setSettings).catch(() => {});
    bridge.getInfo?.().then(setInfo).catch(() => {});
    bridge.getUpdateStatus?.().then(setUpdate).catch(() => {});
    const choice = bridge.getPreferenceSync?.('ss-auth-choice') ?? localStorage.getItem('ss-auth-choice');
    setStorage(choice === 'local' ? 'local' : 'cloud');
    const offSettings = bridge.onSettingsChanged?.(setSettings);
    const offUpdate = bridge.onUpdateStatus?.(setUpdate);
    return () => { offSettings?.(); offUpdate?.(); };
  }, [bridge]);

  const change = useCallback(async (patch: Partial<DesktopSettings>) => {
    if (!bridge?.updateSettings) return;
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    try {
      setSettings(await bridge.updateSettings(patch));
    } catch {
      toast.error('Couldn’t save that setting.');
    }
  }, [bridge]);

  const changeStorage = async (mode: 'cloud' | 'local') => {
    if (mode === storage) return;
    setStorage(mode);
    await bridge?.setPreference('ss-auth-choice', mode);
    await bridge?.setPreference('ss-onboarding-completed', '1');
    localStorage.setItem('ss-auth-choice', mode);
    localStorage.setItem('ss-onboarding-completed', '1');

    if (mode === 'local') {
      await bridge?.setPreference('ss-local-mode', '1');
      localStorage.setItem('ss-local-mode', '1');
      document.cookie = 'ss-local-mode=1; path=/; max-age=31536000; SameSite=Lax';
      const { createLocalUser } = await import('@/lib/supabase/electron-client');
      createLocalUser('Local Writer');
      toast.success('Projects are now kept on this computer.');
      window.location.href = '/dashboard';
    } else {
      await bridge?.setPreference('ss-local-mode', null);
      localStorage.removeItem('ss-local-mode');
      document.cookie = 'ss-local-mode=; path=/; max-age=0';
      toast.success('Sign in to sync your projects.');
      router.push('/auth/login');
    }
  };

  if (!bridge) {
    return (
      <Card className="p-6">
        <p className="text-sm text-surface-400">These settings are for the Screenplay Studio desktop app.</p>
      </Card>
    );
  }

  const zoomIndex = settings ? ZOOM_STEPS.reduce((best, step, i) => (Math.abs(step - settings.zoomLevel) < Math.abs(ZOOM_STEPS[best] - settings.zoomLevel) ? i : best), 0) : 2;

  const updateLabel = (() => {
    switch (update.state) {
      case 'checking': return 'Checking…';
      case 'downloading': return `Downloading ${update.version} · ${update.percent}%`;
      case 'ready': return `Version ${update.version} is ready — restart to install`;
      case 'up-to-date': return 'You’re on the newest version';
      case 'error': return 'Couldn’t reach the update server';
      default: return info?.isPackaged === false ? 'Updates are off in development builds' : 'Checked automatically';
    }
  })();

  return (
    <div className="space-y-6">
      {/* Storage */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">Where your projects live</h2>
        <p className="mb-4 mt-1 text-sm text-surface-400">You can switch at any time. Switching doesn’t move or delete anything.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { mode: 'cloud' as const, icon: <Cloud className="h-5 w-5" />, title: 'Your account', body: 'Synced across devices, the iPhone and iPad app, and collaborators.' },
            { mode: 'local' as const, icon: <HardDrive className="h-5 w-5" />, title: 'This computer only', body: 'No account. Projects stay in your Documents folder.' },
          ]).map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => changeStorage(opt.mode)}
              aria-pressed={storage === opt.mode}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                storage === opt.mode ? 'border-brand-500/60 bg-brand-500/10' : 'border-surface-700 hover:border-surface-600',
              )}
            >
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', storage === opt.mode ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400')}>
                {opt.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">{opt.title}</span>
                <span className="mt-0.5 block text-xs text-surface-400">{opt.body}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Window */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Window</h2>
        <div className="divide-y divide-surface-800">
          <Row title="Window appearance" description="Menus, dialogs and the title bar. The pages follow your theme in Appearance.">
            <Segmented
              label="Window appearance"
              value={settings?.theme ?? 'dark'}
              onChange={(theme) => change({ theme })}
              options={[
                { value: 'system', label: 'System', icon: <Monitor className="h-3.5 w-3.5" /> },
                { value: 'light', label: 'Light', icon: <Sun className="h-3.5 w-3.5" /> },
                { value: 'dark', label: 'Dark', icon: <Moon className="h-3.5 w-3.5" /> },
              ]}
            />
          </Row>
          <Row title="Text size" description={`Everything in the window scales together. ${mac ? '⌘+ and ⌘−' : 'Ctrl+ and Ctrl−'} work too.`}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={ZOOM_STEPS.length - 1}
                step={1}
                value={zoomIndex}
                onChange={(e) => change({ zoomLevel: ZOOM_STEPS[Number(e.target.value)] })}
                aria-label="Text size"
                aria-valuetext={`${zoomPercent(ZOOM_STEPS[zoomIndex])}%`}
                className="w-40 accent-brand-500"
              />
              <span className="w-11 text-right font-mono text-xs text-surface-300">{zoomPercent(ZOOM_STEPS[zoomIndex])}%</span>
            </div>
          </Row>
          <Row title="When the app opens" description="New windows always start at your projects.">
            <Segmented
              label="When the app opens"
              value={settings?.launchBehaviour ?? 'restore'}
              onChange={(launchBehaviour) => change({ launchBehaviour })}
              options={[
                { value: 'restore', label: 'Where I left off' },
                { value: 'dashboard', label: 'Projects' },
              ]}
            />
          </Row>
          <Row title="Check spelling while typing" description="Misspelled words are underlined; right-click one for suggestions.">
            <Toggle checked={settings?.spellcheck ?? true} onChange={(spellcheck: boolean) => change({ spellcheck })} />
          </Row>
        </div>
      </Card>

      {/* Updates */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Updates</h2>
        <div className="divide-y divide-surface-800">
          <Row title="Download updates automatically" description="They install the next time the app restarts. Nothing interrupts your writing.">
            <Toggle checked={settings?.autoUpdate ?? true} onChange={(autoUpdate: boolean) => change({ autoUpdate })} />
          </Row>
          <Row title={`Screenplay Studio ${info?.version ?? ''}`} description={updateLabel}>
            {update.state === 'ready' ? (
              <Button size="sm" onClick={() => bridge.installUpdate?.()}>Restart and Update</Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={update.state === 'checking' || update.state === 'downloading'}
                onClick={() => bridge.checkForUpdates?.()}
              >
                <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', update.state === 'checking' && 'animate-spin')} />
                Check Now
              </Button>
            )}
          </Row>
        </div>
      </Card>

      {/* Files */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Files</h2>
        <div className="divide-y divide-surface-800">
          <Row title="Projects folder" description={info?.projectsFolder ?? 'Documents/ScreenplayStudio/projects'}>
            <Button size="sm" variant="secondary" onClick={() => bridge.openLocation?.('projects')}>
              <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Show in {fileManager}
            </Button>
          </Row>
          <Row title="App log" description="Useful if you’re reporting a problem.">
            <Button size="sm" variant="ghost" onClick={() => bridge.openLocation?.('logs')}>
              <ScrollText className="mr-1.5 h-3.5 w-3.5" /> Show Log
            </Button>
          </Row>
        </div>
      </Card>

      {/* Shortcuts */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Keyboard shortcuts</h2>
        <dl className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {shortcutKeys(mac).map((s) => (
            <div key={s.action} className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-surface-400">{s.action}</dt>
              <dd><kbd className="rounded-md border border-surface-700 bg-surface-800/70 px-1.5 py-0.5 font-mono text-[11px] text-surface-200">{s.keys}</kbd></dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
