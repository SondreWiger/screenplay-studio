import { describe, it, expect } from 'vitest';
import {
  getAllVersionNames,
  extractVersionsFromElements,
  isElementVisible,
  getElementVersions,
  addVersionToMetadata,
  removeVersionFromMetadata,
  extractVersionsFromDocContent,
  renderDocWithVersions,
  serializeVersionConfig,
  removeVersionFromConfig,
  deserializeVersionConfig,
  DEFAULT_VERSION_CONFIG,
} from '@/lib/versioning';

describe('extractVersionsFromElements', () => {
  it('extracts version names from element metadata', () => {
    const elements = [
      { metadata: { versions: ['v1', 'v2'] } },
      { metadata: { versions: ['v2', 'v3'] } },
    ];
    expect(extractVersionsFromElements(elements)).toEqual(['v1', 'v2', 'v3']);
  });

  it('deduplicates versions', () => {
    const elements = [
      { metadata: { versions: ['v1', 'v1', 'v2'] } },
    ];
    expect(extractVersionsFromElements(elements)).toEqual(['v1', 'v2']);
  });

  it('sorts versions alphabetically', () => {
    const elements = [{ metadata: { versions: ['charlie', 'alpha', 'bravo'] } }];
    expect(extractVersionsFromElements(elements)).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('ignores non-string versions', () => {
    const elements = [{ metadata: { versions: [123, null, 'valid'] } }];
    expect(extractVersionsFromElements(elements)).toEqual(['valid']);
  });

  it('handles elements without metadata', () => {
    expect(extractVersionsFromElements([{}, { metadata: {} }])).toEqual([]);
  });

  it('trims whitespace from versions', () => {
    const elements = [{ metadata: { versions: ['  v1  '] } }];
    expect(extractVersionsFromElements(elements)).toEqual(['v1']);
  });

  it('skips empty string versions', () => {
    const elements = [{ metadata: { versions: ['', '  ', 'v1'] } }];
    expect(extractVersionsFromElements(elements)).toEqual(['v1']);
  });
});

describe('getAllVersionNames', () => {
  it('merges known from config and versions from elements', () => {
    const elements = [{ metadata: { versions: ['v1'] } }];
    const config = { disabled: [], showFaded: false, known: ['v2'] };
    expect(getAllVersionNames(elements, config)).toEqual(['v1', 'v2']);
  });

  it('deduplicates across config and elements', () => {
    const elements = [{ metadata: { versions: ['v1'] } }];
    const config = { disabled: [], showFaded: false, known: ['v1'] };
    expect(getAllVersionNames(elements, config)).toEqual(['v1']);
  });
});

describe('isElementVisible', () => {
  it('returns true when disabled list is empty', () => {
    expect(isElementVisible({ metadata: { versions: ['v1'] } }, [])).toBe(true);
  });

  it('returns true for elements without version tags', () => {
    expect(isElementVisible({}, ['v1'])).toBe(true);
  });

  it('returns true when element has enabled version', () => {
    expect(isElementVisible({ metadata: { versions: ['v1', 'v2'] } }, ['v1'])).toBe(true);
  });

  it('returns false when all versions are disabled', () => {
    expect(isElementVisible({ metadata: { versions: ['v1'] } }, ['v1'])).toBe(false);
  });

  it('handles mixed enabled/disabled', () => {
    expect(isElementVisible({ metadata: { versions: ['v1', 'v2'] } }, ['v1'])).toBe(true);
    expect(isElementVisible({ metadata: { versions: ['v1', 'v2'] } }, ['v1', 'v2'])).toBe(false);
  });
});

describe('getElementVersions', () => {
  it('returns version array', () => {
    expect(getElementVersions({ metadata: { versions: ['a', 'b'] } })).toEqual(['a', 'b']);
  });

  it('returns empty array when no versions', () => {
    expect(getElementVersions({})).toEqual([]);
    expect(getElementVersions({ metadata: {} })).toEqual([]);
  });

  it('filters out non-strings and empty', () => {
    expect(getElementVersions({ metadata: { versions: [123, '', 'valid'] } })).toEqual(['valid']);
  });
});

describe('addVersionToMetadata', () => {
  it('adds a new version', () => {
    const result = addVersionToMetadata({}, 'v1');
    expect(result.versions).toEqual(['v1']);
  });

  it('deduplicates', () => {
    const result = addVersionToMetadata({ versions: ['v1'] }, 'v1');
    expect(result.versions).toEqual(['v1']);
  });

  it('trims whitespace', () => {
    const result = addVersionToMetadata({}, '  v1  ');
    expect(result.versions).toEqual(['v1']);
  });

  it('does not add empty version', () => {
    expect(addVersionToMetadata({}, '')).toEqual({});
    expect(addVersionToMetadata({}, '  ')).toEqual({});
  });

  it('preserves existing metadata', () => {
    const result = addVersionToMetadata({ other: 'data', versions: ['v1'] }, 'v2');
    expect(result.other).toBe('data');
    expect(result.versions).toEqual(['v1', 'v2']);
  });
});

describe('removeVersionFromMetadata', () => {
  it('removes a version', () => {
    const result = removeVersionFromMetadata({ versions: ['v1', 'v2'] }, 'v1');
    expect(result.versions).toEqual(['v2']);
  });

  it('handles missing version gracefully', () => {
    const result = removeVersionFromMetadata({ versions: ['v1'] }, 'v2');
    expect(result.versions).toEqual(['v1']);
  });

  it('handles no versions in metadata', () => {
    const result = removeVersionFromMetadata({}, 'v1');
    expect(result.versions).toEqual([]);
  });
});

describe('extractVersionsFromDocContent', () => {
  it('extracts version names from [v:name]...[/v] syntax', () => {
    const content = 'Text [v:alt]alt text[/v] more [v:director]dir text[/v]';
    expect(extractVersionsFromDocContent(content)).toEqual(['alt', 'director']);
  });

  it('deduplicates and sorts', () => {
    const content = '[v:b]...[/v] [v:a]...[/v] [v:b]...[/v]';
    expect(extractVersionsFromDocContent(content)).toEqual(['a', 'b']);
  });

  it('returns empty for no versions', () => {
    expect(extractVersionsFromDocContent('plain text')).toEqual([]);
  });
});

describe('renderDocWithVersions', () => {
  it('strips version markers when no disabled versions', () => {
    const result = renderDocWithVersions('Hello [v:alt]alt[/v] world', [], false);
    expect(result).not.toContain('[v:');
    expect(result).not.toContain('[/v]');
    expect(result).toContain('alt');
  });

  it('removes disabled version content when showFaded=false', () => {
    const result = renderDocWithVersions('Hello [v:alt]alt text[/v] world', ['alt'], false);
    expect(result).toContain('Hello');
    expect(result).toContain('world');
    expect(result).not.toContain('alt text');
  });

  it('wraps disabled version content in span when showFaded=true', () => {
    const result = renderDocWithVersions('Hello [v:alt]alt text[/v] world', ['alt'], true);
    expect(result).toContain('version-faded');
    expect(result).toContain('alt text');
    expect(result).toContain('data-version="alt"');
  });

  it('keeps enabled version content', () => {
    const result = renderDocWithVersions('[v:alt]alt[/v] [v:dir]dir[/v]', ['alt'], false);
    expect(result).not.toContain('alt');
    expect(result).toContain('dir');
  });
});

describe('serializeVersionConfig', () => {
  it('serializes config', () => {
    const config = { disabled: ['v1'], showFaded: true, known: ['v1', 'v2'] };
    const result = serializeVersionConfig(config);
    expect(result.disabled).toEqual(['v1']);
    expect(result.showFaded).toBe(true);
    expect(result.known).toEqual(['v1', 'v2']);
  });

  it('defaults known to empty array', () => {
    const result = serializeVersionConfig({ disabled: [], showFaded: false });
    expect(result.known).toEqual([]);
  });
});

describe('removeVersionFromConfig', () => {
  it('removes from known and disabled', () => {
    const config = { disabled: ['v1', 'v2'], showFaded: false, known: ['v1', 'v2', 'v3'] };
    const result = removeVersionFromConfig(config, 'v1');
    expect(result.known).toEqual(['v2', 'v3']);
    expect(result.disabled).toEqual(['v2']);
  });

  it('handles version not in config', () => {
    const config = { disabled: ['v1'], showFaded: false, known: ['v1'] };
    const result = removeVersionFromConfig(config, 'v99');
    expect(result.known).toEqual(['v1']);
    expect(result.disabled).toEqual(['v1']);
  });
});

describe('deserializeVersionConfig', () => {
  it('deserializes valid config', () => {
    const raw = { disabled: ['v1'], showFaded: true, known: ['v2'] };
    expect(deserializeVersionConfig(raw)).toEqual({ disabled: ['v1'], showFaded: true, known: ['v2'] });
  });

  it('returns defaults for null/undefined', () => {
    expect(deserializeVersionConfig(null)).toEqual(DEFAULT_VERSION_CONFIG);
    expect(deserializeVersionConfig(undefined)).toEqual(DEFAULT_VERSION_CONFIG);
  });

  it('returns defaults for non-object', () => {
    expect(deserializeVersionConfig('string')).toEqual(DEFAULT_VERSION_CONFIG);
  });

  it('handles missing fields gracefully', () => {
    const result = deserializeVersionConfig({});
    expect(result.disabled).toEqual([]);
    expect(result.showFaded).toBe(false);
    expect(result.known).toEqual([]);
  });

  it('filters non-string values in arrays', () => {
    const raw = { disabled: [123, 'v1'], known: [null, 'v2'] };
    const result = deserializeVersionConfig(raw);
    expect(result.disabled).toEqual(['v1']);
    expect(result.known).toEqual(['v2']);
  });
});

describe('DEFAULT_VERSION_CONFIG', () => {
  it('has empty disabled and known', () => {
    expect(DEFAULT_VERSION_CONFIG.disabled).toEqual([]);
    expect(DEFAULT_VERSION_CONFIG.known).toEqual([]);
    expect(DEFAULT_VERSION_CONFIG.showFaded).toBe(false);
  });
});
