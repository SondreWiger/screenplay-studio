/**
 * Versioned Story Editing — core utilities.
 *
 * Script elements store version tags in their JSONB metadata field:
 *   element.metadata.versions = ['version-a', 'version-b']
 *
 * Elements with NO version tags are always visible (universal content).
 * Elements WITH version tags are visible if ANY of their tagged versions
 * is currently enabled (i.e., not in the disabled list).
 *
 * Documents store version spans inline using the syntax:
 *   [v:version-name]...content...[/v]
 *
 * The active version config (which versions are disabled, faded preference)
 * is persisted per-script in scripts.metadata.version_config and
 * per-document in project_documents.metadata.version_config.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VersionConfig {
  /** Version names that are currently hidden / disabled */
  disabled: string[];
  /**
   * When true, disabled versions are rendered faded (opacity ~20%) instead
   * of being completely removed from view. Off by default.
   */
  showFaded: boolean;
  /**
   * Explicitly created version names that may not yet have any elements
   * tagged to them. Allows creating a version before tagging anything.
   */
  known?: string[];
}

export const DEFAULT_VERSION_CONFIG: VersionConfig = {
  disabled: [],
  showFaded: false,
  known: [],
};

// ── Script element helpers ────────────────────────────────────────────────────

/**
 * Return all known version names — union of explicitly created (config.known)
 * and versions detected from element metadata. Sorted alphabetically.
 */
export function getAllVersionNames(
  elements: Array<{ metadata?: Record<string, unknown> }>,
  config: VersionConfig,
): string[] {
  const fromElements = extractVersionsFromElements(elements);
  const known = config.known ?? [];
  const merged = new Set([...known, ...fromElements]);
  return Array.from(merged).sort();
}

/**
 * Extract the sorted, deduplicated set of all version names declared across
 * all script elements.
 */
export function extractVersionsFromElements(
  elements: Array<{ metadata?: Record<string, unknown> }>,
): string[] {
  const versionSet = new Set<string>();
  for (const el of elements) {
    const versions = el.metadata?.versions;
    if (Array.isArray(versions)) {
      for (const v of versions) {
        if (typeof v === 'string' && v.trim()) {
          versionSet.add(v.trim());
        }
      }
    }
  }
  return Array.from(versionSet).sort();
}

/**
 * Return true if the element should be shown given the current disabled list.
 * Elements with no version tags are always shown.
 */
export function isElementVisible(
  element: { metadata?: Record<string, unknown> },
  disabled: string[],
): boolean {
  if (disabled.length === 0) return true;
  const versions = element.metadata?.versions;
  if (!Array.isArray(versions) || versions.length === 0) return true;
  // Visible when at least one of the element's versions is enabled
  return versions.some((v) => typeof v === 'string' && !disabled.includes(v));
}

/**
 * Return the version tags for a given element (empty array if none).
 */
export function getElementVersions(
  element: { metadata?: Record<string, unknown> },
): string[] {
  const versions = element.metadata?.versions;
  if (!Array.isArray(versions)) return [];
  return versions.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
}

/**
 * Return updated metadata with the given version added to the element.
 * Deduplicates and trims.
 */
export function addVersionToMetadata(
  metadata: Record<string, unknown>,
  version: string,
): Record<string, unknown> {
  const trimmed = version.trim();
  if (!trimmed) return metadata;
  const current = Array.isArray(metadata.versions)
    ? (metadata.versions as string[]).filter((v) => typeof v === 'string')
    : [];
  if (current.includes(trimmed)) return metadata;
  return { ...metadata, versions: [...current, trimmed] };
}

/**
 * Return updated metadata with the given version removed from the element.
 */
export function removeVersionFromMetadata(
  metadata: Record<string, unknown>,
  version: string,
): Record<string, unknown> {
  const current = Array.isArray(metadata.versions)
    ? (metadata.versions as string[]).filter((v) => typeof v === 'string')
    : [];
  return { ...metadata, versions: current.filter((v) => v !== version) };
}

// ── Document content helpers ─────────────────────────────────────────────────

/** Regex for version spans in document content: [v:name]...[/v] */
const DOC_VERSION_RE = /\[v:([^\]]+)\]([\s\S]*?)\[\/v\]/g;

/**
 * Extract sorted, deduplicated list of all version names found in a document's
 * plain-text content via the [v:name]...[/v] syntax.
 */
export function extractVersionsFromDocContent(content: string): string[] {
  const versionSet = new Set<string>();
  let m: RegExpExecArray | null;
  DOC_VERSION_RE.lastIndex = 0;
  while ((m = DOC_VERSION_RE.exec(content)) !== null) {
    const name = m[1].trim();
    if (name) versionSet.add(name);
  }
  return Array.from(versionSet).sort();
}

/**
 * Render a document's content with version filtering applied.
 *
 * Returns an HTML string where disabled version content is either:
 *   - removed entirely (showFaded = false)
 *   - wrapped in a low-opacity span (showFaded = true)
 *
 * Note: call escapeHtml on the non-versioned segments before inserting into DOM
 * if using dangerouslySetInnerHTML. The function returns raw HTML.
 */
export function renderDocWithVersions(
  content: string,
  disabled: string[],
  showFaded: boolean,
): string {
  if (disabled.length === 0) {
    // No filter — strip markers, show all content
    return escapeHtml(content).replace(
      /\[v:([^\]]+)\]([\s\S]*?)\[\/v\]/g,
      (_m, _name, inner: string) => escapeHtml(inner),
    );
  }

  let result = '';
  let lastIndex = 0;
  DOC_VERSION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = DOC_VERSION_RE.exec(content)) !== null) {
    // Text before this span
    result += escapeHtml(content.slice(lastIndex, m.index));
    const name = m[1].trim();
    const inner = m[2];
    const isDisabled = disabled.includes(name);

    if (!isDisabled) {
      result += escapeHtml(inner);
    } else if (showFaded) {
      result += `<span class="version-faded" data-version="${escapeAttr(name)}">${escapeHtml(inner)}</span>`;
    }
    // else: omit entirely

    lastIndex = m.index + m[0].length;
  }

  // Remaining text after last span
  result += escapeHtml(content.slice(lastIndex));
  return result;
}

// ── Serialization helpers ─────────────────────────────────────────────────────

export function serializeVersionConfig(config: VersionConfig): Record<string, unknown> {
  return { disabled: config.disabled, showFaded: config.showFaded, known: config.known ?? [] };
}

/**
 * Remove a version from the config entirely (from known + disabled lists).
 * Does not untag elements — handle that separately in the caller.
 */
export function removeVersionFromConfig(config: VersionConfig, name: string): VersionConfig {
  return {
    ...config,
    known: (config.known ?? []).filter((v) => v !== name),
    disabled: config.disabled.filter((v) => v !== name),
  };
}

export function deserializeVersionConfig(raw: unknown): VersionConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_VERSION_CONFIG };
  const obj = raw as Record<string, unknown>;
  return {
    disabled: Array.isArray(obj.disabled)
      ? (obj.disabled as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
    showFaded: typeof obj.showFaded === 'boolean' ? obj.showFaded : false,
    known: Array.isArray(obj.known)
      ? (obj.known as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
  };
}

// ── Internal ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
