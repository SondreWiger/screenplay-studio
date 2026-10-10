/**
 * Cross-component helper to compact / expand the project layout sidebar.
 * Used by full-width studio tools like StoryboardSequenceStudio to maximize
 * drawing canvas screen real-estate while keeping quick nav icons accessible.
 */

export const SIDEBAR_COLLAPSE_EVENT = 'ss-sidebar-collapse';

export interface SidebarCollapseDetail {
  collapsed: boolean;
}

export function requestSidebarCompact(compact: boolean = true): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SidebarCollapseDetail>(SIDEBAR_COLLAPSE_EVENT, {
      detail: { collapsed: compact },
    })
  );
}

export function isSidebarCurrentlyCollapsed(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.sidebarCollapsed === 'true';
}
