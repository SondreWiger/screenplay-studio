/** Cross-component Zen writing mode (script editor). */

export const ZEN_MODE_EVENT = 'ss-zen-mode-change';

export function setZenMode(active: boolean): void {
  if (typeof document === 'undefined') return;
  if (active) {
    document.documentElement.dataset.zen = 'true';
    document.body.style.overflow = 'hidden';
  } else {
    delete document.documentElement.dataset.zen;
    document.body.style.overflow = '';
  }
  window.dispatchEvent(new CustomEvent(ZEN_MODE_EVENT, { detail: active }));
}

export function isZenModeActive(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.zen === 'true';
}
