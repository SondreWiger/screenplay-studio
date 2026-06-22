/**
 * Feature gating for Electron local-only mode.
 * When running in Electron without a cloud connection,
 * server-dependent features are disabled.
 */

export function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as Record<string, unknown>).electron;
}

export function isElectronLocalMode(): boolean {
  if (!isElectron()) return false;
  // In local mode, user hasn't signed in to cloud
  const user = localStorage.getItem('ss-local-user');
  const cloudConnected = localStorage.getItem('ss-cloud-connected');
  return !cloudConnected && !!user;
}

export const FEATURE_FLAGS = {
  /** Multi-user real-time editing */
  collaboration: () => !isElectronLocalMode(),
  /** Community forum */
  community: () => !isElectronLocalMode(),
  /** Direct messages */
  directMessages: () => !isElectronLocalMode(),
  /** Admin panel */
  admin: () => !isElectronLocalMode(),
  /** Public share links */
  publicSharing: () => !isElectronLocalMode(),
  /** Company/organization features */
  companies: () => !isElectronLocalMode(),
  /** Push notifications */
  pushNotifications: () => !isElectronLocalMode(),
  /** Billing/subscription */
  billing: () => !isElectronLocalMode(),
  /** Cloud sync (available when connected) */
  cloudSync: () => isElectron() || true,
  /** Local file save/open (Electron only) */
  localFiles: () => isElectron(),
  /** Auto-updates (Electron only) */
  autoUpdates: () => isElectron(),
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]();
}
