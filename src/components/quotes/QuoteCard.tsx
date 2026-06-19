'use client';

import type { Quote } from '@/lib/types';

interface QuoteCardProps {
  quote: Quote;
  onEdit?: (quote: Quote) => void;
  onDelete?: (id: string) => void;
  isOwner?: boolean;
}

export function QuoteCard({ quote, onEdit, onDelete, isOwner }: QuoteCardProps) {
  const dateStr = quote.said_at
    ? new Date(quote.said_at + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="group relative bg-surface-900/50 border border-surface-800/60 rounded-xl p-4 hover:border-surface-700/80 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      {/* Quote mark */}
      <div className="absolute -top-2 -left-1 text-4xl leading-none text-brand-500/20 select-none pointer-events-none font-serif">
        &ldquo;
      </div>

      {/* Quote content */}
      <p className="text-sm text-white/90 leading-relaxed italic pl-3 mb-3">
        {quote.content}
      </p>

      {/* Attribution */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-brand-400 truncate">
            &mdash; {quote.said_by}
          </span>
          {dateStr && (
            <span className="text-[10px] text-surface-500 shrink-0">{dateStr}</span>
          )}
        </div>

        {/* Actions */}
        {isOwner && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(quote)}
                className="p-1 rounded-md text-surface-500 hover:text-white hover:bg-surface-800/80 transition-colors"
                title="Edit quote"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(quote.id)}
                className="p-1 rounded-md text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete quote"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Meta tags */}
      {(quote.context || quote.location || quote.group_name || quote.group) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-surface-800/40">
          {quote.group && (
            <span className="text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 flex items-center gap-1">
              {quote.group.emoji} {quote.group.name}
            </span>
          )}
          {!quote.group && quote.group_name && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400">
              {quote.group_name}
            </span>
          )}
          {quote.context && (
            <span className="text-[10px] text-surface-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {quote.context}
            </span>
          )}
          {quote.location && (
            <span className="text-[10px] text-surface-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {quote.location}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
