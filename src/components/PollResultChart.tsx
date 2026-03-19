'use client';

// Poll result charts — pure CSS/SVG, zero external deps.
// (Replaced recharts which bundled Redux and caused HMR crashes.)

export interface QuestionResult {
  question_id: string;
  question_text: string;
  question_type: string;
  total_answers: number;
  option_counts: { label: string; count: number }[];
  text_answers: string[];
  ranking_scores: { label: string; avg_rank: number; count: number }[];
}

const BAR_COLORS = [
  '#FF5F1F', '#3b82f6', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

export function PollResultCard({ result }: { result: QuestionResult }) {
  const { question_text, question_type, total_answers, option_counts, text_answers, ranking_scores } = result;
  const maxCount = Math.max(...option_counts.map((o) => o.count), 1);

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="font-semibold text-white">{question_text}</p>
        <span className="text-xs text-white/30 flex-shrink-0">
          {total_answers} answer{total_answers !== 1 ? 's' : ''}
        </span>
      </div>

      {total_answers === 0 && (
        <p className="text-white/20 text-sm italic">No answers yet</p>
      )}

      {/* Horizontal bar chart for yes_no / single_select / multi_select */}
      {(question_type === 'yes_no' || question_type === 'single_select' || question_type === 'multi_select') && total_answers > 0 && (
        <div className="space-y-3">
          {option_counts.map((opt, i) => {
            const pct = total_answers > 0 ? Math.round((opt.count / total_answers) * 100) : 0;
            const barPct = Math.round((opt.count / maxCount) * 100);
            return (
              <div key={opt.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white/70 truncate mr-3">{opt.label}</span>
                  <span className="text-xs text-white/40 flex-shrink-0 tabular-nums">
                    {opt.count} · {pct}%
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barPct}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ranking results */}
      {question_type === 'ranking' && total_answers > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/30 mb-3">Average rank (lower = more preferred)</p>
          {ranking_scores.map((r, i) => {
            const maxRank = ranking_scores.length;
            const barPct = maxRank > 1 ? Math.round((1 - (r.avg_rank - 1) / (maxRank - 1)) * 100) : 100;
            return (
              <div key={r.label} className="flex items-center gap-3">
                <span className="text-[#FF5F1F] font-bold text-sm w-5 flex-shrink-0">
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white truncate">{r.label}</span>
                    <span className="text-xs text-white/30 flex-shrink-0 ml-2 tabular-nums">
                      avg {r.avg_rank.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(4, barPct)}%`,
                        background: BAR_COLORS[i % BAR_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Text answers */}
      {(question_type === 'short_text' || question_type === 'long_text') && text_answers.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {text_answers.map((t, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2 text-sm text-white/70">
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
