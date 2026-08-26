'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { useProToolRecords } from '@/hooks/useProToolRecords';
import { sidebarIcons } from '@/components/sidebar/SidebarIcons';
import { useProjectRefs, type RefOption } from '@/hooks/useProjectRefs';
import {
  computeStats, formatField, matchesQuery, nextStatus, refSourcesFor, relatedTools,
  statusMeta, toCSV, REF_SOURCE_LABEL, REF_SOURCE_ROUTE, TONE_CLASSES,
  type ProToolField, type ProToolRecord, type ProTool, type RefResolver,
} from '@/lib/pro-tools';

// The shared UI for every Pro tool. The tool definition supplies the
// columns, the form fields, the status set and the summary stats — this
// component supplies the behaviour.

type FormState = { title: string; status: string; data: Record<string, unknown> };

const emptyForm = (tool: ProTool): FormState => ({
  title: '',
  status: tool.statuses[0]?.value ?? '',
  data: {},
});

const HIDE_CLASS: Record<'md' | 'lg', string> = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

function FieldInput({
  field, value, onChange, refOptions,
}: {
  field: ProToolField;
  value: unknown;
  onChange: (v: unknown) => void;
  refOptions: RefOption[];
}) {
  const base = 'w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-brand-500/60';

  switch (field.type) {
    case 'ref':
      return refOptions.length === 0 ? (
        <p className="text-xs text-surface-500 py-2">
          No {field.refSource ? REF_SOURCE_LABEL[field.refSource] : 'record'}s in this project yet.
        </p>
      ) : (
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">—</option>
          {refOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      );
    case 'textarea':
      return (
        <textarea
          rows={2} value={(value as string) ?? ''} placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn(base, 'resize-none')}
        />
      );
    case 'select':
      return (
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">—</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'number':
    case 'currency':
    case 'percent':
      return (
        <input
          type="number" step={field.type === 'number' ? '1' : '0.01'}
          value={(value as number | string) ?? ''} placeholder={field.placeholder ?? '0'}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={base}
        />
      );
    case 'date':
      return (
        <input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className={base} />
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-surface-300 py-2">
          <input
            type="checkbox" checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-surface-600 bg-surface-900 accent-brand-500"
          />
          {field.label}
        </label>
      );
    case 'tags':
      return (
        <input
          value={Array.isArray(value) ? (value as string[]).join(', ') : ((value as string) ?? '')}
          placeholder={field.placeholder ?? 'Comma separated'}
          onChange={(e) => onChange(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
          className={base}
        />
      );
    default:
      return (
        <input
          value={(value as string) ?? ''} placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      );
  }
}

export function ProToolShell({ tool, projectId }: { tool: ProTool; projectId: string }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const role = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = role !== 'viewer';

  const { records, loading, error, create, update, remove } = useProToolRecords(projectId, tool);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(tool));
  const [saving, setSaving] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const quickRef = useRef<HTMLInputElement>(null);

  const refSources = useMemo(() => refSourcesFor(tool), [tool]);
  const { options: refOptions, resolve } = useProjectRefs(projectId, refSources);
  const resolveRef: RefResolver = resolve;

  const columns = useMemo(() => tool.fields.filter((f) => f.column), [tool]);
  const stats = useMemo(() => computeStats(tool, records), [tool, records]);

  const filtered = useMemo(() => records.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return matchesQuery(tool, r, query, resolveRef);
  }), [records, statusFilter, query, tool, resolveRef]);

  const grouped = useMemo(() => {
    if (!tool.groupBy) return [{ key: '', rows: filtered }];
    const map = new Map<string, ProToolRecord[]>();
    for (const r of filtered) {
      const key = (r.data[tool.groupBy] as string) || 'Unassigned';
      const bucket = map.get(key);
      if (bucket) bucket.push(r);
      else map.set(key, [r]);
    }
    return Array.from(map, ([key, rows]) => ({ key, rows }));
  }, [filtered, tool.groupBy]);

  const openNew = () => {
    setForm(emptyForm(tool));
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (record: ProToolRecord) => {
    setForm({ title: record.title, status: record.status, data: { ...record.data } });
    setEditingId(record.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error(`${tool.titleLabel} is required`);
      return;
    }
    setSaving(true);
    if (editingId) {
      await update(editingId, { title: form.title.trim(), status: form.status, data: form.data });
      toast.success('Saved');
    } else {
      const created = await create(form.title.trim(), form.status, form.data);
      if (!created) {
        setSaving(false);
        return;
      }
      toast.success(`${tool.noun} added`);
    }
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (record: ProToolRecord) => {
    if (!confirm(`Delete “${record.title}”?`)) return;
    await remove(record.id);
    toast.success('Deleted');
  };

  const handleExportCSV = () => {
    const csv = toCSV(tool, filtered, resolveRef);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tool.slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addStarter = async (title: string) => {
    await create(title, tool.statuses[0]?.value ?? '', {});
  };

  // Most rows start life as just a name — typing one and pressing Enter beats
  // opening a modal to fill in one field. Details can be added by editing.
  const handleQuickAdd = async () => {
    const title = quickTitle.trim();
    if (!title || quickAdding) return;
    setQuickAdding(true);
    const created = await create(title, tool.statuses[0]?.value ?? '', {});
    setQuickAdding(false);
    if (created) {
      setQuickTitle('');
      quickRef.current?.focus();
    }
  };

  const openNewRef = useRef(openNew);
  openNewRef.current = openNew;

  // n = new, / = search, both ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (el?.isContentEditable) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'n' && canEdit) {
        e.preventDefault();
        openNewRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit]);

  // Esc closes the form.
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm]);

  const related = useMemo(() => relatedTools(tool), [tool]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-surface-800 px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-brand-500 shrink-0">{sidebarIcons[tool.icon]}</span>
            <h1 className="text-lg font-bold text-white truncate">{tool.label}</h1>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 font-semibold uppercase tracking-[0.04em] shrink-0">
              Pro
            </span>
          </div>
          <p className="text-sm text-surface-400 mt-0.5 truncate">{tool.tagline}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-surface-700 text-surface-300 hover:text-white hover:border-surface-500 transition-colors flex items-center gap-1.5 disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            CSV
          </button>
          {canEdit && (
            <button
              onClick={openNew}
              className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 text-white font-semibold hover:bg-orange-500 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New {tool.noun}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-surface-800/50 shrink-0">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-surface-800 bg-surface-900/40 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.04em] text-surface-500 truncate">{s.label}</div>
            <div className="text-lg font-semibold text-white tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="px-6 py-2.5 flex items-center gap-2 border-b border-surface-800/50 shrink-0">
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…  /"
          className="text-sm bg-surface-900 border border-surface-700 rounded-lg px-2.5 py-1.5 text-surface-200 outline-none focus:border-brand-500/50 w-48"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs bg-surface-900 border border-surface-700 rounded-lg px-2.5 py-1 text-surface-300 outline-none focus:border-brand-500/50"
        >
          <option value="all">All statuses</option>
          {tool.statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div className="flex-1" />
        <span className="text-xs text-surface-500">
          {filtered.length} of {records.length}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-xl bg-surface-800 flex items-center justify-center mx-auto mb-4 text-surface-500 [&_svg]:w-8 [&_svg]:h-8">
                {sidebarIcons[tool.icon]}
              </div>
              <p className="text-surface-400 font-medium">
                {records.length === 0 ? `No ${tool.noun}s yet` : 'Nothing matches those filters'}
              </p>
              {records.length === 0 && canEdit && (
                <>
                  <p className="text-surface-600 text-sm mt-1">{tool.tagline}</p>
                  {tool.starters && tool.starters.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                      {tool.starters.map((s) => (
                        <button
                          key={s}
                          onClick={() => addStarter(s)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-surface-700 text-surface-300 hover:text-white hover:border-brand-500/50 transition-colors"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          grouped.map(({ key, rows }) => (
            <div key={key || 'all'}>
              {key && (
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-[11px] font-semibold text-surface-500 uppercase tracking-[0.04em]">{key}</h2>
                  <span className="text-[11px] text-surface-700">{rows.length}</span>
                </div>
              )}
              <div className="rounded-xl border border-surface-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-800 bg-surface-900/60">
                      <th className="text-left text-[11px] font-medium text-surface-500 uppercase tracking-[0.04em] px-4 py-2">
                        {tool.titleLabel}
                      </th>
                      {columns.map((f) => (
                        <th
                          key={f.key}
                          className={cn(
                            'text-[11px] font-medium text-surface-500 uppercase tracking-[0.04em] px-3 py-2',
                            f.align === 'right' ? 'text-right' : 'text-left',
                            f.hideBelow && HIDE_CLASS[f.hideBelow],
                          )}
                        >
                          {f.label}
                        </th>
                      ))}
                      <th className="text-left text-[11px] font-medium text-surface-500 uppercase tracking-[0.04em] px-3 py-2 w-32">
                        Status
                      </th>
                      {canEdit && <th className="w-16 px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((record) => {
                      const meta = statusMeta(tool, record.status);
                      return (
                        <tr key={record.id} className="border-b border-surface-800/40 last:border-0 hover:bg-surface-800/20 transition-colors group">
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => canEdit && openEdit(record)}
                              disabled={!canEdit}
                              className="font-medium text-white text-left hover:text-brand-500 transition-colors disabled:hover:text-white"
                            >
                              {record.title}
                            </button>
                            {typeof record.data.notes === 'string' && record.data.notes && (
                              <p className="text-[11px] text-surface-500 truncate max-w-[260px]">{record.data.notes}</p>
                            )}
                          </td>
                          {columns.map((f) => (
                            <td
                              key={f.key}
                              className={cn(
                                'px-3 py-2.5 text-xs text-surface-300',
                                f.align === 'right' ? 'text-right tabular-nums' : 'text-left',
                                f.hideBelow && HIDE_CLASS[f.hideBelow],
                              )}
                            >
                              {f.type === 'ref' && f.refSource && record.data[f.key] ? (
                                <Link
                                  href={`/projects/${projectId}/${REF_SOURCE_ROUTE[f.refSource]}`}
                                  className="text-brand-500 hover:underline"
                                >
                                  {formatField(f, record.data[f.key], resolveRef) || 'Linked'}
                                </Link>
                              ) : (
                                formatField(f, record.data[f.key], resolveRef) || <span className="text-surface-600">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => canEdit && update(record.id, { status: nextStatus(tool, record.status) })}
                              disabled={!canEdit}
                              title={canEdit ? 'Click to advance' : undefined}
                              className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium transition-opacity hover:opacity-80', TONE_CLASSES[meta.tone])}
                            >
                              {meta.label}
                            </button>
                          </td>
                          {canEdit && (
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEdit(record)}
                                  className="p-1 rounded text-surface-500 hover:text-white transition-colors"
                                  aria-label="Edit"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button
                                  onClick={() => handleDelete(record)}
                                  className="p-1 rounded text-surface-500 hover:text-red-400 transition-colors"
                                  aria-label="Delete"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}

        {/* Inline quick-add — the fast path for "just get it on the list". */}
        {canEdit && (
          <div className="rounded-xl border border-dashed border-surface-800 hover:border-surface-700 transition-colors">
            <div className="flex items-center gap-2 px-4 py-2.5">
              <svg className="w-4 h-4 text-surface-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <input
                ref={quickRef}
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); }}
                placeholder={`Add a ${tool.noun}…`}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-surface-600 outline-none"
              />
              {quickTitle.trim() && (
                <button
                  onClick={handleQuickAdd}
                  disabled={quickAdding}
                  className="text-xs px-2.5 py-1 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors disabled:opacity-50"
                >
                  {quickAdding ? 'Adding…' : 'Add'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Where to go next — production work rarely stops at one tool. */}
        {related.length > 0 && (
          <div className="pt-2 pb-6 border-t border-surface-800/60">
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-surface-500 mb-2">
              Related
            </p>
            <div className="flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/projects/${projectId}/pro/${r.slug}`}
                  className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-surface-800 text-surface-300 hover:text-white hover:border-brand-500/50 transition-colors"
                >
                  <span className="text-surface-500 [&_svg]:w-4 [&_svg]:h-4">{sidebarIcons[r.icon]}</span>
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[85vh] overflow-auto rounded-2xl border border-surface-700 bg-surface-950 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">
                {editingId ? `Edit ${tool.noun}` : `New ${tool.noun}`}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-surface-500 hover:text-white p-1 rounded transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">{tool.titleLabel} *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={tool.titlePlaceholder}
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-brand-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-brand-500/60"
                >
                  {tool.statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {tool.fields.map((field) => (
                <div key={field.key}>
                  {field.type !== 'checkbox' && (
                    <label className="block text-xs font-medium text-surface-400 mb-1">{field.label}</label>
                  )}
                  <FieldInput
                    field={field}
                    value={form.data[field.key]}
                    refOptions={field.refSource ? refOptions[field.refSource] ?? [] : []}
                    onChange={(v) => setForm((f) => ({ ...f, data: { ...f.data, [field.key]: v } }))}
                  />
                  {field.hint && <p className="text-[11px] text-surface-600 mt-1">{field.hint}</p>}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-surface-700 text-surface-300 hover:text-white text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-brand-500 text-white font-semibold text-sm hover:bg-orange-500 active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
