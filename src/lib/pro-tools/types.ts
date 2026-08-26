// Pro tool suite — shared types and pure helpers.
//
// The Pro tier ships ~30 production tools that are all the same shape:
// a list of records scoped to a project, each with a title, a status and a
// handful of typed fields. Rather than 30 near-identical tables and pages,
// every tool is described by a `ProTool` definition and rendered by the
// shared shell in `@/components/pro-tools/ProToolShell`.

export type ProToolFieldType =
  | 'text' | 'textarea' | 'number' | 'currency' | 'percent'
  | 'date' | 'select' | 'tags' | 'url' | 'checkbox' | 'ref';

/**
 * Project records a Pro tool row can point at. A `ref` field stores the target
 * row's id, so a clearance is attached to an actual scene rather than to text
 * someone retyped.
 */
export type ProToolRefSource = 'scenes' | 'shoot_days' | 'characters' | 'locations';

/** Where each ref source lives in the project, for the table's onward link. */
export const REF_SOURCE_ROUTE: Record<ProToolRefSource, string> = {
  scenes: 'scenes',
  shoot_days: 'schedule',
  characters: 'characters',
  locations: 'locations',
};

export const REF_SOURCE_LABEL: Record<ProToolRefSource, string> = {
  scenes: 'scene',
  shoot_days: 'shoot day',
  characters: 'character',
  locations: 'location',
};

/** Resolves a stored ref id to something readable. */
export type RefResolver = (source: ProToolRefSource, id: string) => string | undefined;

export type ProToolTone = 'neutral' | 'info' | 'good' | 'warn' | 'bad' | 'accent';

export interface ProToolField {
  key: string;
  label: string;
  type: ProToolFieldType;
  /** Required when `type` is 'ref' — which project table to pick from. */
  refSource?: ProToolRefSource;
  /** Options for `select` fields. */
  options?: string[];
  placeholder?: string;
  /** Show this field as a column in the table view. */
  column?: boolean;
  /** Right-align the column (numbers, money, dates). */
  align?: 'left' | 'right';
  /** Only visible from the md/lg breakpoint up — keeps narrow tables readable. */
  hideBelow?: 'md' | 'lg';
  hint?: string;
}

export interface ProToolStatus {
  value: string;
  label: string;
  tone: ProToolTone;
}

export interface ProToolStat {
  label: string;
  /** count = number of records, sum = total of a numeric field,
   *  status = records in a given status, distinct = unique values of a field. */
  kind: 'count' | 'sum' | 'status' | 'distinct';
  /** Field key for `sum` / `distinct`. */
  field?: string;
  /** Status value for `status`. */
  status?: string;
  format?: 'number' | 'currency' | 'percent';
}

export interface ProTool {
  /** URL segment under /projects/[id]/pro/ */
  slug: string;
  /** Sidebar icon key (see SidebarIcons). */
  icon: string;
  /** feature_flags.key used for gating. */
  flag: string;
  label: string;
  tagline: string;
  /** Grouping used by the Pro tools index page. */
  group: ProToolGroup;
  /** Singular noun for a record, e.g. "clearance". */
  noun: string;
  /** Label + placeholder for the always-present title field. */
  titleLabel: string;
  titlePlaceholder: string;
  statuses: ProToolStatus[];
  fields: ProToolField[];
  stats: ProToolStat[];
  /** Field key to group rows by in the table (must be a `select` field). */
  groupBy?: string;
  /**
   * Slugs of tools worth jumping to from here. Defaults to the other tools in
   * the same group — set this only for cross-group links that matter, e.g.
   * clearances → music cues.
   */
  related?: string[];
  /** Example records offered as one-click seeds on an empty board. */
  starters?: string[];
}

export type ProToolGroup =
  | 'Money' | 'Legal & Rights' | 'People' | 'Production' | 'Post & Delivery' | 'Audience';

export interface ProToolRecord {
  id: string;
  project_id: string;
  tool: string;
  title: string;
  status: string;
  data: Record<string, unknown>;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Badge classes per tone — matches the palette used across the project tools. */
export const TONE_CLASSES: Record<ProToolTone, string> = {
  neutral: 'text-surface-400 bg-surface-800 border-surface-700',
  info: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  good: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  warn: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  bad: 'text-red-400 bg-red-500/10 border-red-500/30',
  accent: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
};

export function statusMeta(tool: ProTool, value: string): ProToolStatus {
  return tool.statuses.find((s) => s.value === value)
    ?? { value, label: value || '—', tone: 'neutral' };
}

/** Next status in the tool's cycle — powers click-to-advance status pills. */
export function nextStatus(tool: ProTool, current: string): string {
  const i = tool.statuses.findIndex((s) => s.value === current);
  if (i === -1) return tool.statuses[0]?.value ?? current;
  return tool.statuses[(i + 1) % tool.statuses.length].value;
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function formatCurrency(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(n);
}

export function formatStat(value: number, format: ProToolStat['format']): string {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return `${Math.round(value)}%`;
  return new Intl.NumberFormat('en-US').format(value);
}

/** Display a single field value as text (also used by the CSV export). */
export function formatField(field: ProToolField, value: unknown, resolve?: RefResolver): string {
  if (value == null || value === '') return '';
  switch (field.type) {
    case 'ref': {
      if (!field.refSource) return '';
      return resolve?.(field.refSource, String(value)) ?? '';
    }
    case 'currency': return formatCurrency(toNumber(value));
    case 'percent': return `${toNumber(value)}%`;
    case 'number': return String(toNumber(value));
    case 'checkbox': return value ? 'Yes' : 'No';
    case 'tags': return Array.isArray(value) ? value.join(', ') : String(value);
    default: return String(value);
  }
}

export function computeStats(tool: ProTool, records: ProToolRecord[]): { label: string; value: string }[] {
  return tool.stats.map((stat) => {
    let n = 0;
    switch (stat.kind) {
      case 'count':
        n = records.length;
        break;
      case 'sum':
        n = records.reduce((acc, r) => acc + toNumber(r.data[stat.field!]), 0);
        break;
      case 'status':
        n = records.filter((r) => r.status === stat.status).length;
        break;
      case 'distinct': {
        const seen = new Set<string>();
        for (const r of records) {
          const v = r.data[stat.field!];
          if (v != null && v !== '') seen.add(String(v));
        }
        n = seen.size;
        break;
      }
    }
    return { label: stat.label, value: formatStat(n, stat.format) };
  });
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCSV(tool: ProTool, records: ProToolRecord[], resolve?: RefResolver): string {
  const header = [tool.titleLabel, 'Status', ...tool.fields.map((f) => f.label)];
  const rows = records.map((r) => [
    r.title,
    statusMeta(tool, r.status).label,
    ...tool.fields.map((f) => formatField(f, r.data[f.key], resolve)),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

/** Search across the title and every field value, resolved refs included. */
export function matchesQuery(
  tool: ProTool, record: ProToolRecord, query: string, resolve?: RefResolver,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (record.title.toLowerCase().includes(q)) return true;
  return tool.fields.some((f) => formatField(f, record.data[f.key], resolve).toLowerCase().includes(q));
}

/** Every ref source a tool needs loaded, de-duplicated. */
export function refSourcesFor(tool: ProTool): ProToolRefSource[] {
  const sources = new Set<ProToolRefSource>();
  for (const f of tool.fields) {
    if (f.type === 'ref' && f.refSource) sources.add(f.refSource);
  }
  return Array.from(sources);
}
