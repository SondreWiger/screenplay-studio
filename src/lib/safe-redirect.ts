/**
 * Only same-origin paths may be used as a post-login redirect target.
 * Rejects absolute URLs, protocol-relative URLs and `javascript:` style schemes.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/dashboard'): string {
  return value && /^\/(?!\/)[^@\\]*$/.test(value) ? value : fallback;
}
