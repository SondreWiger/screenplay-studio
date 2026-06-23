/** Routes that belong in the browser, not the desktop app shell. */

export const ELECTRON_WORKSPACE_PREFIXES = [
  '/dashboard',
  '/projects',
  '/settings',
  '/auth',
  '/idea-boards',
  '/quotes',
  '/accountability',
  '/messages',
  '/company',
  '/billing',
  '/onboarding',
];

export const ELECTRON_MARKETING_PATHS = [
  '/blog',
  '/community',
  '/legal',
  '/support',
  '/about',
  '/pricing',
  '/pro',
  '/testimonials',
  '/translations',
  '/download',
  '/colorbar',
  '/compare',
  '/changelog',
  '/contribute',
  '/feedback',
  '/licenses',
  '/press',
  '/ref',
  '/sitemap-visual',
  '/dev',
];

export function isElectronWorkspacePath(pathname: string): boolean {
  if (pathname === '/') return false;
  return ELECTRON_WORKSPACE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function isElectronMarketingPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return ELECTRON_MARKETING_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
