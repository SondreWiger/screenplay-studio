'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  accentFor, doneStatusFor, formatField, statusMeta, toNumber,
  formatCurrency, REF_SOURCE_ROUTE, TONE_CLASSES,
  type ProToolField, type ProToolRecord, type ProTool, type RefResolver,
} from '@/lib/pro-tools';

// The suite shares one data model but not one look. Each layout answers a
// different question: a ledger asks "how much?", a board asks "where is it?",
// cards ask "who?", a checklist asks "is it done?".

export interface ViewProps {
  tool: ProTool;
  projectId: string;
  records: ProToolRecord[];
  columns: ProToolField[];
  canEdit: boolean;
  resolveRef: RefResolver;
  onEdit: (record: ProToolRecord) => void;
  onDelete: (record: ProToolRecord) => void;
  onCycleStatus: (record: ProToolRecord) => void;
  onSetStatus: (record: ProToolRecord, status: string) => void;
}

const HIDE_CLASS: Record<'md' | 'lg', string> = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

function StatusPill({ tool, record, canEdit, onCycle }: {
  tool: ProTool; record: ProToolRecord; canEdit: boolean; onCycle: () => void;
}) {
  const meta = statusMeta(tool, record.status);
  return (
    <button
      onClick={() => canEdit && onCycle()}
      disabled={!canEdit}
      title={canEdit ? 'Click to advance' : undefined}
      className={cn(
        'text-[11px] px-2 py-0.5 rounded-full border font-medium transition-opacity hover:opacity-80',
        TONE_CLASSES[meta.tone],
      )}
    >
      {meta.label}
    </button>
  );
}

function RowActions({ canEdit, onEdit, onDelete }: {
  canEdit: boolean; onEdit: () => void; onDelete: () => void;
}) {
  if (!canEdit) return null;
  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <button onClick={onEdit} aria-label="Edit" className="p-1 rounded text-surface-500 hover:text-white transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      </button>
      <button onClick={onDelete} aria-label="Delete" className="p-1 rounded text-surface-500 hover:text-red-400 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  );
}

/** A field value, linked through when it points at another project record. */
function Value({ field, record, projectId, resolveRef }: {
  field: ProToolField; record: ProToolRecord; projectId: string; resolveRef: RefResolver;
}) {
  const text = formatField(field, record.data[field.key], resolveRef);
  if (field.type === 'ref' && field.refSource && record.data[field.key]) {
    return (
      <Link href={`/projects/${projectId}/${REF_SOURCE_ROUTE[field.refSource]}`} className="text-brand-500 hover:underline">
        {text || 'Linked'}
      </Link>
    );
  }
  return text ? <>{text}</> : <span className="text-surface-600">—</span>;
}

// ── Table ───────────────────────────────────────────────────────────────────

export function TableView(props: ViewProps) {
  const { tool, projectId, records, columns, canEdit, resolveRef, onEdit, onDelete, onCycleStatus } = props;
  return (
    <div className="rounded-xl border border-surface-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-800 bg-surface-900/60">
            <th className="text-left text-[11px] font-medium text-surface-400 uppercase tracking-[0.04em] px-4 py-2">
              {tool.titleLabel}
            </th>
            {columns.map((f) => (
              <th key={f.key} className={cn(
                'text-[11px] font-medium text-surface-400 uppercase tracking-[0.04em] px-3 py-2',
                f.align === 'right' ? 'text-right' : 'text-left',
                f.hideBelow && HIDE_CLASS[f.hideBelow],
              )}>{f.label}</th>
            ))}
            <th className="text-left text-[11px] font-medium text-surface-400 uppercase tracking-[0.04em] px-3 py-2 w-32">Status</th>
            {canEdit && <th className="w-16 px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-b border-surface-800/40 last:border-0 hover:bg-surface-800/20 transition-colors group">
              <td className="px-4 py-2.5">
                <button
                  onClick={() => canEdit && onEdit(record)}
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
                <td key={f.key} className={cn(
                  'px-3 py-2.5 text-xs text-surface-300',
                  f.align === 'right' ? 'text-right tabular-nums' : 'text-left',
                  f.hideBelow && HIDE_CLASS[f.hideBelow],
                )}>
                  <Value field={f} record={record} projectId={projectId} resolveRef={resolveRef} />
                </td>
              ))}
              <td className="px-3 py-2.5">
                <StatusPill tool={tool} record={record} canEdit={canEdit} onCycle={() => onCycleStatus(record)} />
              </td>
              {canEdit && (
                <td className="px-3 py-2.5">
                  <RowActions canEdit={canEdit} onEdit={() => onEdit(record)} onDelete={() => onDelete(record)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Ledger ──────────────────────────────────────────────────────────────────

export function LedgerView(props: ViewProps) {
  const { tool, projectId, records, columns, canEdit, resolveRef, onEdit, onDelete, onCycleStatus } = props;
  const accent = accentFor(tool);
  const moneyFields = columns.filter((f) => f.type === 'currency');
  const otherFields = columns.filter((f) => f.type !== 'currency');
  const totals = moneyFields.map((f) => ({
    key: f.key,
    label: f.label,
    total: records.reduce((sum, r) => sum + toNumber(r.data[f.key]), 0),
  }));

  return (
    <div className={cn('rounded-xl border overflow-hidden', accent.border)}>
      <table className="w-full text-sm">
        <thead>
          <tr className={cn('border-b border-surface-800', accent.surface)}>
            <th className="text-left text-[11px] font-medium text-surface-400 uppercase tracking-[0.04em] px-4 py-2.5">
              {tool.titleLabel}
            </th>
            {otherFields.map((f) => (
              <th key={f.key} className={cn(
                'text-left text-[11px] font-medium text-surface-400 uppercase tracking-[0.04em] px-3 py-2.5',
                f.hideBelow && HIDE_CLASS[f.hideBelow],
              )}>{f.label}</th>
            ))}
            <th className="text-left text-[11px] font-medium text-surface-400 uppercase tracking-[0.04em] px-3 py-2.5 w-28">Status</th>
            {moneyFields.map((f) => (
              <th key={f.key} className="text-right text-[11px] font-medium text-surface-400 uppercase tracking-[0.04em] px-4 py-2.5">
                {f.label}
              </th>
            ))}
            {canEdit && <th className="w-12 px-2 py-2.5" />}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-b border-surface-800/40 last:border-0 hover:bg-surface-800/20 transition-colors group">
              <td className="px-4 py-2.5">
                <button
                  onClick={() => canEdit && onEdit(record)}
                  disabled={!canEdit}
                  className="font-medium text-white text-left hover:text-brand-500 transition-colors disabled:hover:text-white"
                >
                  {record.title}
                </button>
              </td>
              {otherFields.map((f) => (
                <td key={f.key} className={cn('px-3 py-2.5 text-xs text-surface-300', f.hideBelow && HIDE_CLASS[f.hideBelow])}>
                  <Value field={f} record={record} projectId={projectId} resolveRef={resolveRef} />
                </td>
              ))}
              <td className="px-3 py-2.5">
                <StatusPill tool={tool} record={record} canEdit={canEdit} onCycle={() => onCycleStatus(record)} />
              </td>
              {moneyFields.map((f) => (
                <td key={f.key} className="px-4 py-2.5 text-right tabular-nums text-sm font-medium text-white">
                  {formatField(f, record.data[f.key]) || <span className="text-surface-600">—</span>}
                </td>
              ))}
              {canEdit && (
                <td className="px-2 py-2.5">
                  <RowActions canEdit={canEdit} onEdit={() => onEdit(record)} onDelete={() => onDelete(record)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {totals.length > 0 && records.length > 0 && (
          <tfoot>
            <tr className={cn('border-t-2', accent.border, accent.surface)}>
              <td className="px-4 py-3 text-[11px] font-semibold text-surface-300 uppercase tracking-[0.04em]"
                  colSpan={1 + otherFields.length + 1}>
                Total · {records.length} {records.length === 1 ? tool.noun : `${tool.noun}s`}
              </td>
              {totals.map((t) => (
                <td key={t.key} className={cn('px-4 py-3 text-right tabular-nums font-semibold', accent.text)}>
                  {formatCurrency(t.total)}
                </td>
              ))}
              {canEdit && <td />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ── Board ───────────────────────────────────────────────────────────────────

export function BoardView(props: ViewProps) {
  const { tool, projectId, records, columns, canEdit, resolveRef, onEdit, onDelete, onCycleStatus } = props;
  const accent = accentFor(tool);
  const primary = columns.slice(0, 2);

  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
      {tool.statuses.map((status) => {
        const inColumn = records.filter((r) => r.status === status.value);
        return (
          <div key={status.value} className="w-64 shrink-0 flex flex-col">
            <div className="flex items-center gap-2 px-1 pb-2">
              <span className={cn('w-1.5 h-1.5 rounded-full', accent.rule)} />
              <h3 className="text-[11px] font-semibold text-surface-300 uppercase tracking-[0.04em]">{status.label}</h3>
              <span className="text-[11px] text-surface-600">{inColumn.length}</span>
            </div>
            <div className="flex-1 space-y-2 rounded-xl bg-surface-900/40 border border-surface-800/60 p-2 min-h-[6rem]">
              {inColumn.length === 0 && (
                <p className="text-[11px] text-surface-600 text-center py-6">Nothing here</p>
              )}
              {inColumn.map((record) => (
                <div key={record.id} className="rounded-lg border border-surface-800 bg-surface-900 p-3 group hover:border-surface-700 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => canEdit && onEdit(record)}
                      disabled={!canEdit}
                      className="text-sm font-medium text-white text-left leading-snug hover:text-brand-500 transition-colors disabled:hover:text-white"
                    >
                      {record.title}
                    </button>
                    <RowActions canEdit={canEdit} onEdit={() => onEdit(record)} onDelete={() => onDelete(record)} />
                  </div>
                  {primary.map((f) => {
                    const text = formatField(f, record.data[f.key], resolveRef);
                    if (!text) return null;
                    return (
                      <p key={f.key} className="text-[11px] text-surface-400 mt-1.5">
                        <span className="text-surface-600">{f.label}: </span>
                        <Value field={f} record={record} projectId={projectId} resolveRef={resolveRef} />
                      </p>
                    );
                  })}
                  {canEdit && (
                    <button
                      onClick={() => onCycleStatus(record)}
                      className="mt-2 text-[11px] text-surface-500 hover:text-brand-500 transition-colors"
                    >
                      Move on →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

export function CardsView(props: ViewProps) {
  const { tool, projectId, records, columns, canEdit, resolveRef, onEdit, onDelete, onCycleStatus } = props;
  const accent = accentFor(tool);

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {records.map((record) => (
        <div key={record.id} className={cn(
          'relative rounded-xl border border-surface-800 bg-surface-900/40 p-4 pl-5 group hover:border-surface-700 transition-colors',
        )}>
          <span className={cn('absolute left-0 top-4 bottom-4 w-0.5 rounded-full', accent.rule)} />
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <button
                onClick={() => canEdit && onEdit(record)}
                disabled={!canEdit}
                className="font-semibold text-white text-sm text-left hover:text-brand-500 transition-colors disabled:hover:text-white"
              >
                {record.title}
              </button>
            </div>
            <RowActions canEdit={canEdit} onEdit={() => onEdit(record)} onDelete={() => onDelete(record)} />
          </div>

          <dl className="mt-3 space-y-1.5">
            {columns.map((f) => {
              const text = formatField(f, record.data[f.key], resolveRef);
              if (!text) return null;
              return (
                <div key={f.key} className="flex items-baseline gap-2 text-xs">
                  <dt className="text-surface-600 shrink-0">{f.label}</dt>
                  <dd className="text-surface-300 min-w-0 truncate">
                    <Value field={f} record={record} projectId={projectId} resolveRef={resolveRef} />
                  </dd>
                </div>
              );
            })}
          </dl>

          <div className="mt-3 pt-3 border-t border-surface-800/60">
            <StatusPill tool={tool} record={record} canEdit={canEdit} onCycle={() => onCycleStatus(record)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Checklist ───────────────────────────────────────────────────────────────

export function ChecklistView(props: ViewProps) {
  const { tool, projectId, records, columns, canEdit, resolveRef, onEdit, onDelete, onCycleStatus, onSetStatus } = props;
  const accent = accentFor(tool);
  const doneValue = doneStatusFor(tool);
  const firstValue = tool.statuses[0]?.value ?? '';
  const secondary = columns.slice(0, 3);

  return (
    <div className="rounded-xl border border-surface-800 divide-y divide-surface-800/60 overflow-hidden">
      {records.map((record) => {
        const done = record.status === doneValue;
        return (
          <div key={record.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-800/20 transition-colors group">
            <button
              onClick={() => canEdit && doneValue && onSetStatus(record, done ? firstValue : doneValue)}
              disabled={!canEdit || !doneValue}
              aria-label={done ? 'Mark not done' : 'Mark done'}
              className={cn(
                'mt-0.5 w-5 h-5 rounded-md border shrink-0 flex items-center justify-center transition-colors',
                done ? cn(accent.rule, 'border-transparent') : 'border-surface-600 hover:border-surface-400',
              )}
            >
              {done && (
                <svg className="w-3.5 h-3.5 text-surface-950" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <button
                onClick={() => canEdit && onEdit(record)}
                disabled={!canEdit}
                className={cn(
                  'text-sm text-left font-medium transition-colors disabled:hover:text-white',
                  done ? 'text-surface-500 line-through' : 'text-white hover:text-brand-500',
                )}
              >
                {record.title}
              </button>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                {secondary.map((f) => {
                  const text = formatField(f, record.data[f.key], resolveRef);
                  if (!text) return null;
                  return (
                    <span key={f.key} className="text-[11px] text-surface-500">
                      {f.label}: <span className="text-surface-400">
                        <Value field={f} record={record} projectId={projectId} resolveRef={resolveRef} />
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <StatusPill tool={tool} record={record} canEdit={canEdit} onCycle={() => onCycleStatus(record)} />
              <RowActions canEdit={canEdit} onEdit={() => onEdit(record)} onDelete={() => onDelete(record)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const VIEWS = {
  table: TableView,
  ledger: LedgerView,
  board: BoardView,
  cards: CardsView,
  checklist: ChecklistView,
} as const;
