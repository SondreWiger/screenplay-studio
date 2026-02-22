/**
 * Content Protection Utilities
 * Prevents unauthorized scraping, copying, and AI training on user content
 */

/**
 * Injects content protection measures into a page.
 * Call this in a useEffect for pages that display user scripts or creative content.
 */
export function enableContentProtection() {
  if (typeof window === 'undefined') return;

  // Disable right-click context menu on script content
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-protected]')) {
      e.preventDefault();
    }
  };

  // Disable text selection on protected content via CSS
  const style = document.createElement('style');
  style.id = 'content-protection';
  style.textContent = `
    [data-protected] {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
    [data-protected]::selection {
      background: transparent;
    }
    @media print {
      [data-no-print] {
        display: none !important;
      }
    }
  `;

  if (!document.getElementById('content-protection')) {
    document.head.appendChild(style);
  }

  document.addEventListener('contextmenu', handler);

  // Disable Ctrl+A, Ctrl+C on protected content
  const keyHandler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-protected]')) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'c' || e.key === 'u')) {
        e.preventDefault();
      }
    }
  };
  document.addEventListener('keydown', keyHandler);

  // Return cleanup function
  return () => {
    document.removeEventListener('contextmenu', handler);
    document.removeEventListener('keydown', keyHandler);
    const styleEl = document.getElementById('content-protection');
    if (styleEl) styleEl.remove();
  };
}

/**
 * Generate a text watermark overlay for script content.
 * This deters unauthorized screenshots by embedding user info.
 */
export function generateWatermarkCSS(username: string): string {
  const encoded = btoa(username + ' - ' + new Date().toISOString().split('T')[0]);
  return `
    position: relative;
    &::after {
      content: '${username}';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 4rem;
      color: rgba(255,255,255,0.03);
      pointer-events: none;
      white-space: nowrap;
      z-index: 1;
    }
  `;
}

/**
 * Anti-bot meta tags to add to pages with user content
 */
export const ANTI_AI_META = {
  'robots': 'noai, noimageai',
  'googlebot': 'noai, noimageai',
};

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize a URL to prevent javascript: and data: attacks
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    // If it's a relative path, allow it
    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }
    return '';
  }
}

/**
 * Generate a CSRF-like token for forms
 */
export function generateFormToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Check if a password meets security requirements
 */
export function validatePassword(password: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (password.length < 8) issues.push('Must be at least 8 characters');
  if (password.length > 128) issues.push('Must be less than 128 characters');
  if (!/[A-Z]/.test(password)) issues.push('Must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('Must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) issues.push('Must contain at least one number');
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('Must contain at least one special character');

  // Check for common weak passwords
  const weak = ['password', '12345678', 'qwerty', 'letmein', 'welcome', 'admin'];
  if (weak.some(w => password.toLowerCase().includes(w))) {
    issues.push('Password is too common');
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Mask an email for display (show first 2 chars + domain)
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const masked = local.substring(0, 2) + '***';
  return `${masked}@${domain}`;
}

/**
 * Mask an IP address for display
 */
export function maskIP(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.**`;
  }
  // IPv6
  const v6Parts = ip.split(':');
  if (v6Parts.length > 2) {
    return `${v6Parts[0]}:${v6Parts[1]}:***`;
  }
  return ip;
}
