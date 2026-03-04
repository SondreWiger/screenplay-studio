'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { ArcMindmap } from '@/components/ArcMindmap';
import { cn } from '@/lib/utils';
import type {
  Course, CourseSection, CourseLesson, CourseEnrollment, CourseLessonProgress,
  LessonContentText, LessonContentVideo, LessonContentQuiz, LessonContentScriptEditor,
  LessonContentArcEditor, LessonContentExample, QuizQuestion,
} from '@/lib/types';
import type { MindmapData } from '@/components/ArcMindmap';

// ============================================================
// Course Viewer / Player — /community/courses/[id]
// ============================================================

// ── Simple Markdown → HTML renderer (no deps) ─────────────────
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-white mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-white mt-6 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-7 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-white/80">$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded text-[#FF5F1F] bg-[#FF5F1F]/10 font-mono text-sm">$1</code>')
    .replace(/^\> (.+)$/gm, '<blockquote class="border-l-2 border-[#FF5F1F]/40 pl-4 text-white/60 italic my-3">$1</blockquote>')
    .replace(/^\- (.+)$/gm, '<li class="text-white/70 ml-4 list-disc mb-1">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="text-white/70 ml-4 list-decimal mb-1">$2</li>')
    .replace(/\n\n/g, '</p><p class="text-white/70 leading-relaxed mb-4">')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[#FF5F1F] hover:underline" target="_blank" rel="noopener">$1</a>');
}

// ── Lesson type renders ────────────────────────────────────────

function TextLesson({ content }: { content: LessonContentText }) {
  return (
    <div
      className="prose-custom text-white/70 leading-relaxed max-w-none"
      dangerouslySetInnerHTML={{ __html: `<p class="text-white/70 leading-relaxed mb-4">${renderMarkdown(content.markdown)}</p>` }}
    />
  );
}

function VideoLesson({ content }: { content: LessonContentVideo }) {
  const getEmbedUrl = () => {
    const url = content.embed_url;
    if (content.provider === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
      const id = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1];
      return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : url;
    }
    if (content.provider === 'vimeo' || url.includes('vimeo.com')) {
      const id = url.match(/vimeo\.com\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}?title=0&byline=0` : url;
    }
    return url;
  };

  return (
    <div className="space-y-4">
      <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-white/10" style={{ paddingTop: '56.25%' }}>
        <iframe
          src={getEmbedUrl()}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Course video"
        />
      </div>
      {content.caption && (
        <p className="text-sm text-white/50 italic text-center">{content.caption}</p>
      )}
      {content.duration_seconds && (
        <div className="flex items-center gap-1.5 text-xs text-white/30">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          {Math.floor(content.duration_seconds / 60)}:{String(content.duration_seconds % 60).padStart(2, '0')} video
        </div>
      )}
    </div>
  );
}

function QuizLesson({
  content,
  onComplete,
  existingScore,
}: {
  content: LessonContentQuiz;
  onComplete: (score: number, answers: Record<string, string>) => void;
  existingScore?: number | null;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(existingScore ?? null);

  const handleSubmit = () => {
    if (Object.keys(answers).length < content.questions.length) return;
    let correct = 0;
    content.questions.forEach(q => {
      const chosen = answers[q.id];
      if (q.options.find(o => o.id === chosen)?.is_correct) correct++;
    });
    const pct = Math.round((correct / content.questions.length) * 100);
    setScore(pct);
    setSubmitted(true);
    onComplete(pct, answers);
  };

  const allAnswered = content.questions.every(q => answers[q.id]);

  if (score !== null && existingScore !== undefined) {
    // Already completed previously — show results read-only
    return (
      <div className="space-y-6">
        <div className={cn(
          'flex items-center justify-between p-5 rounded-2xl border',
          score === 100 ? 'bg-emerald-500/10 border-emerald-500/30' :
          score >= 70  ? 'bg-amber-500/10 border-amber-500/30' :
                         'bg-red-500/10 border-red-500/30',
        )}>
          <div>
            <div className={cn('text-3xl font-black', score === 100 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-red-400')}>
              {score}%
            </div>
            <div className="text-sm text-white/50 mt-0.5">
              {score === 100 ? '🎉 Perfect score!' : score >= 70 ? '✅ Passed' : '❌ Try again'}
            </div>
          </div>
          {score < 70 && (
            <button onClick={() => { setAnswers({}); setSubmitted(false); setScore(null); }}
              className="px-4 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              Retry Quiz
            </button>
          )}
        </div>
        {content.questions.map((q, i) => (
          <QuizQuestionView key={q.id} q={q} idx={i} answer={answers[q.id]} submitted={true} onSelect={() => {}} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {submitted && score !== null ? (
        <div className={cn(
          'flex items-center justify-between p-5 rounded-2xl border',
          score === 100 ? 'bg-emerald-500/10 border-emerald-500/30' :
          score >= 70  ? 'bg-amber-500/10 border-amber-500/30' :
                         'bg-red-500/10 border-red-500/30',
        )}>
          <div>
            <div className={cn('text-3xl font-black', score === 100 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-red-400')}>
              {score}%
            </div>
            <div className="text-sm text-white/50 mt-0.5">
              {score === 100 ? '🎉 Perfect score! +25 bonus XP' : score >= 70 ? '✅ Passed' : '❌ Below passing (70%)'}
            </div>
          </div>
          {score < 70 && (
            <button onClick={() => { setAnswers({}); setSubmitted(false); setScore(null); }}
              className="px-4 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              Retry Quiz
            </button>
          )}
        </div>
      ) : null}

      {content.questions.map((q, i) => (
        <QuizQuestionView
          key={q.id} q={q} idx={i}
          answer={answers[q.id]}
          submitted={submitted}
          onSelect={id => !submitted && setAnswers(prev => ({ ...prev, [q.id]: id }))}
        />
      ))}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className={cn(
            'w-full py-3 rounded-xl text-sm font-semibold transition-all',
            allAnswered
              ? 'bg-[#FF5F1F] text-white hover:bg-[#E54E15]'
              : 'bg-white/5 text-white/30 cursor-not-allowed',
          )}
        >
          {allAnswered ? 'Submit Answers' : `Answer all ${content.questions.length} questions to submit`}
        </button>
      )}
    </div>
  );
}

function QuizQuestionView({ q, idx, answer, submitted, onSelect }: {
  q: QuizQuestion; idx: number; answer?: string; submitted: boolean; onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-6 h-6 rounded-full bg-[#FF5F1F]/20 text-[#FF5F1F] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
          {idx + 1}
        </span>
        <p className="text-sm text-white font-medium leading-relaxed">{q.text}</p>
      </div>
      <div className="space-y-2 ml-9">
        {q.options.map(opt => {
          const isSelected = answer === opt.id;
          const showResult = submitted;
          const isCorrect   = opt.is_correct;
          return (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              className={cn(
                'w-full text-left px-4 py-3 rounded-xl text-sm transition-all border',
                !showResult && !isSelected && 'border-white/10 text-white/60 hover:border-white/30 hover:text-white bg-white/[0.03]',
                !showResult && isSelected  && 'border-[#FF5F1F]/40 text-white bg-[#FF5F1F]/10',
                showResult && isCorrect    && 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
                showResult && !isCorrect && isSelected && !opt.is_correct && 'border-red-500/40 text-red-400 bg-red-500/10',
                showResult && !isCorrect && !isSelected && 'border-white/5 text-white/30',
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn(
                  'w-4 h-4 rounded-full border-2 shrink-0 transition-all',
                  !showResult && isSelected ? 'border-[#FF5F1F] bg-[#FF5F1F]' : 'border-white/20',
                  showResult && isCorrect ? 'border-emerald-500 bg-emerald-500' : '',
                  showResult && !isCorrect && isSelected ? 'border-red-500 bg-red-500' : '',
                )} />
                {opt.text}
              </div>
            </button>
          );
        })}
      </div>
      {submitted && q.explanation && (
        <div className="mt-4 ml-9 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white/60">
          <span className="text-white/40 font-semibold uppercase tracking-wider text-[9px] block mb-1">Explanation</span>
          {q.explanation}
        </div>
      )}
    </div>
  );
}

function ScriptEditorLesson({
  content,
  onComplete,
  existingCompletion,
}: {
  content: LessonContentScriptEditor;
  onComplete: () => void;
  existingCompletion?: boolean;
}) {
  const [text, setText] = useState(content.initial_content || '');
  const [showHint, setShowHint] = useState(false);

  const hasKeywords = content.expected_keywords
    ? content.expected_keywords.every(kw => text.toLowerCase().includes(kw.toLowerCase()))
    : true;

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="p-4 rounded-xl bg-[#FF5F1F]/5 border border-[#FF5F1F]/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[#FF5F1F] text-xs font-bold uppercase tracking-wider">Task</span>
          {content.locked && <span className="text-[9px] text-white/30 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded">Read Only</span>}
        </div>
        <p className="text-sm text-white/70 leading-relaxed">{content.instructions}</p>
      </div>

      {/* Mini screenplay editor */}
      <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0A0A14]">
        {/* Editor header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.03]">
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Screenplay Editor</span>
          <div className="flex items-center gap-2">
            {content.expected_keywords && content.expected_keywords.length > 0 && (
              <div className="flex items-center gap-1">
                {content.expected_keywords.map(kw => (
                  <span key={kw} className={cn(
                    'px-1.5 py-0.5 text-[9px] rounded font-mono',
                    text.toLowerCase().includes(kw.toLowerCase())
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-white/5 text-white/30',
                  )}>{kw}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <textarea
          value={text}
          onChange={e => !content.locked && setText(e.target.value)}
          readOnly={content.locked}
          spellCheck={false}
          className={cn(
            'w-full bg-transparent font-mono text-sm p-6 outline-none resize-none text-white/80',
            'placeholder-white/20',
            content.locked && 'cursor-default select-all',
          )}
          style={{ minHeight: '320px', tabSize: 4, lineHeight: '1.8' }}
          placeholder={content.locked ? '' : 'Write your screenplay here...\n\nINT. LOCATION - DAY\n\nAction description.\n\nCHARACTER\nDialogue.'}
        />

        {/* Line count */}
        <div className="px-4 py-2 border-t border-white/[0.06] bg-white/[0.03] flex items-center justify-between">
          <span className="text-[10px] font-mono text-white/20">{text.split('\n').length} lines</span>
          {!content.locked && hasKeywords && !existingCompletion && (
            <button onClick={onComplete}
              className="px-3 py-1.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors">
              Mark Complete ✓
            </button>
          )}
        </div>
      </div>

      {/* Fountain formatting reference */}
      <details className="rounded-xl border border-white/[0.08] overflow-hidden">
        <summary className="px-4 py-3 bg-white/[0.03] text-xs text-white/40 cursor-pointer hover:text-white/60 transition-colors flex items-center gap-2">
          <span>📋</span> Fountain Formatting Quick Reference
        </summary>
        <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-mono">
          {[
            ['INT./EXT. ...', 'Scene header'],
            ['CHARACTER NAME', 'Dialogue character (all caps)'],
            ['(parenthetical)', 'Stage direction in dialogue'],
            ['> TRANSITION:', 'Transition'],
            ['[[NOTE]]', 'Note/comment'],
            ['= SECTION', 'Section / act break'],
            ['~lyric', 'Lyric'],
            ['[[SYNOPSIS]]', 'Synopsis'],
          ].map(([syntax, desc]) => (
            <div key={syntax} className="flex gap-2">
              <code className="text-[#FF5F1F] shrink-0 w-32">{syntax}</code>
              <span className="text-white/30">{desc}</span>
            </div>
          ))}
        </div>
      </details>

      {content.hint && (
        <div className="flex items-start gap-3">
          <button onClick={() => setShowHint(v => !v)}
            className="text-xs text-white/30 hover:text-white/60 transition-colors underline underline-offset-2 whitespace-nowrap">
            {showHint ? 'Hide hint' : 'Show hint'}
          </button>
          {showHint && <p className="text-xs text-white/50 italic">{content.hint}</p>}
        </div>
      )}
    </div>
  );
}

function ArcEditorLesson({
  content,
  onComplete,
  existingCompletion,
}: {
  content: LessonContentArcEditor;
  onComplete: () => void;
  existingCompletion?: boolean;
}) {
  const [userData, setUserData] = useState<MindmapData | null>(null);

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="p-4 rounded-xl bg-[#FF5F1F]/5 border border-[#FF5F1F]/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[#FF5F1F] text-xs font-bold uppercase tracking-wider">
            {content.locked ? 'Example' : 'Task'}
          </span>
          {content.locked && <span className="text-[9px] text-white/30 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded">Read Only</span>}
        </div>
        <p className="text-sm text-white/70 leading-relaxed">{content.instructions}</p>
      </div>

      {/* Arc mindmap */}
      <div className="rounded-2xl overflow-hidden border border-white/[0.08]" style={{ height: '480px' }}>
        <ArcMindmap
          projectId={`course-lesson-${Math.random()}`}
          initialData={content.arc_data as MindmapData | null}
          canEdit={!content.locked}
          onSave={data => setUserData(data)}
        />
      </div>

      {!content.locked && !existingCompletion && (
        <button onClick={onComplete}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#FF5F1F] text-white hover:bg-[#E54E15] transition-colors">
          Submit Arc & Complete ✓
        </button>
      )}
    </div>
  );
}

function ExampleLesson({ content }: { content: LessonContentExample }) {
  const lines = content.content.split('\n');
  const annotationMap = new Map((content.annotations || []).map(a => [a.line, a.note]));

  return (
    <div className="space-y-4">
      {content.description && (
        <p className="text-sm text-white/60 leading-relaxed">{content.description}</p>
      )}
      <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#080810]">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.03]">
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
            {content.language === 'fountain' ? 'Screenplay Example' : content.language}
          </span>
          <span className="text-[10px] text-white/20">{lines.length} lines</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <tbody>
              {lines.map((line, i) => {
                const lineNum = i + 1;
                const note = annotationMap.get(lineNum);
                return (
                  <tr key={i} className={cn('group', note && 'bg-[#FF5F1F]/5')}>
                    <td className="py-0.5 px-3 text-right text-white/20 select-none w-10 border-r border-white/[0.04]">
                      {lineNum}
                    </td>
                    <td className="py-0.5 px-4 text-white/70 whitespace-pre">
                      <FountainLine text={line} lang={content.language} />
                    </td>
                    {note && (
                      <td className="py-0.5 px-3 text-[10px] text-[#FF5F1F]/70 italic whitespace-nowrap">
                        ← {note}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FountainLine({ text, lang }: { text: string; lang: string }) {
  if (lang !== 'fountain') return <span>{text}</span>;
  const t = text.trim();
  if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/.test(t))
    return <span className="text-emerald-400 font-bold">{text}</span>;
  if (/^[A-Z][A-Z0-9 .]*$/.test(t) && t.length > 0)
    return <span className="text-amber-400 font-bold pl-20">{text}</span>;
  if (/^\(.+\)$/.test(t))
    return <span className="text-white/50 pl-14 italic">{text}</span>;
  if (/^>/.test(t))
    return <span className="text-purple-400">{text}</span>;
  if (/^=/.test(t))
    return <span className="text-[#FF5F1F]">{text}</span>;
  if (t === '')
    return <span> </span>;
  return <span>{text}</span>;
}

// ── Progress sidebar ───────────────────────────────────────────
function ProgressSidebar({
  sections,
  completedIds,
  activeLessonId,
  onSelect,
  enrollment,
  course,
}: {
  sections: CourseSection[];
  completedIds: Set<string>;
  activeLessonId: string | null;
  onSelect: (lesson: CourseLesson) => void;
  enrollment: CourseEnrollment | null;
  course: Course;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Course header in sidebar */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1">{course.type === 'system' ? 'Official Course' : 'Community Course'}</div>
        <h2 className="text-sm font-bold text-white leading-snug">{course.title}</h2>
        {enrollment && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
              <span>Progress</span>
              <span className="text-white/60">{enrollment.progress_percent}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#FF5F1F] rounded-full transition-all" style={{ width: `${enrollment.progress_percent}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Sections & lessons */}
      <div className="flex-1 overflow-y-auto py-2">
        {sections.map(sec => (
          <div key={sec.id} className="mb-1">
            <div className="px-4 py-2">
              <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{sec.title}</span>
            </div>
            {(sec.lessons || []).map(lesson => {
              const done = completedIds.has(lesson.id);
              const active = lesson.id === activeLessonId;
              return (
                <button
                  key={lesson.id}
                  onClick={() => onSelect(lesson)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 flex items-start gap-2.5 transition-colors text-xs',
                    active ? 'bg-[#FF5F1F]/10 text-white' : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80',
                  )}
                >
                  <span className={cn(
                    'w-4 h-4 rounded-full shrink-0 mt-0.5 flex items-center justify-center border',
                    done ? 'bg-emerald-500 border-emerald-500'
                      : active ? 'border-[#FF5F1F]'
                      : 'border-white/20',
                  )}>
                    {done ? (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                    ) : active ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF5F1F]" />
                    ) : null}
                  </span>
                  <div className="min-w-0">
                    <span className="block leading-snug line-clamp-2">{lesson.title}</span>
                    <span className={cn(
                      'text-[9px] uppercase tracking-wider mt-0.5 block',
                      active ? 'text-[#FF5F1F]/70' : 'text-white/25',
                    )}>
                      {LESSON_TYPE_LABEL[lesson.lesson_type]} · {lesson.xp_reward} XP
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* XP summary */}
      <div className="p-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/30">Course reward</span>
          <span className="text-[#FF5F1F] font-bold">+{course.xp_reward} XP</span>
        </div>
      </div>
    </div>
  );
}

const LESSON_TYPE_LABEL: Record<string, string> = {
  text:          'Reading',
  video:         'Video',
  quiz:          'Quiz',
  script_editor: 'Editor Task',
  arc_editor:    'Arc Task',
  example:       'Example',
};

const LESSON_TYPE_ICON: Record<string, string> = {
  text:          '📄',
  video:         '🎬',
  quiz:          '🧠',
  script_editor: '✍️',
  arc_editor:    '🗺️',
  example:       '💡',
};

// ── Main page ──────────────────────────────────────────────────
export default function CourseViewerPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const router = useRouter();
  const { awardXP } = useGamification();

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [allLessons, setAllLessons] = useState<CourseLesson[]>([]);
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [progress, setProgress] = useState<Map<string, CourseLessonProgress>>(new Map());
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [showRating, setShowRating] = useState(false);

  useEffect(() => { load(); }, [params.id, user]);

  const load = async () => {
    const supabase = createClient();

    const [courseRes, sectionsRes, lessonsRes, enrollRes, progressRes] = await Promise.all([
      supabase.from('courses').select('*, creator:profiles!creator_id(full_name,username)').eq('id', params.id).single(),
      supabase.from('course_sections').select('*').eq('course_id', params.id).order('order_index'),
      supabase.from('course_lessons').select('*').eq('course_id', params.id).order('order_index'),
      user
        ? supabase.from('course_enrollments').select('*').eq('user_id', user.id).eq('course_id', params.id).maybeSingle()
        : Promise.resolve({ data: null }),
      user
        ? supabase.from('course_lesson_progress').select('*').eq('user_id', user.id).eq('course_id', params.id)
        : Promise.resolve({ data: [] }),
    ]);

    if (courseRes.error || !courseRes.data) { router.push('/community/courses'); return; }

    const courseData = courseRes.data as Course;
    setCourse(courseData);

    const secs = (sectionsRes.data || []) as CourseSection[];
    const lessons = (lessonsRes.data || []) as CourseLesson[];

    // Attach lessons to sections
    const lessonsBySec = new Map<string | null, CourseLesson[]>();
    lessons.forEach(l => {
      const k = l.section_id ?? '_unsectioned';
      if (!lessonsBySec.has(k)) lessonsBySec.set(k, []);
      lessonsBySec.get(k)!.push(l);
    });

    const hydratedSections: CourseSection[] = secs.map(s => ({
      ...s,
      lessons: lessonsBySec.get(s.id) || [],
    }));

    // If lessons not in any section, create a default section
    const unsectioned = lessonsBySec.get('_unsectioned') || [];
    if (unsectioned.length > 0 && secs.length === 0) {
      hydratedSections.push({ id: '_default', course_id: params.id, title: 'Lessons', description: null, order_index: 0, created_at: '', lessons: unsectioned });
    }

    setSections(hydratedSections);
    setAllLessons(lessons);

    if (enrollRes.data) {
      setEnrollment(enrollRes.data as CourseEnrollment);
      setUserRating((enrollRes.data as any).rating ?? null);
    }

    const progressMap = new Map<string, CourseLessonProgress>();
    (progressRes.data || []).forEach((p: CourseLessonProgress) => progressMap.set(p.lesson_id, p));
    setProgress(progressMap);

    // Set first incomplete lesson as active
    const completedIds = new Set(progressMap.keys());
    const firstIncomplete = lessons.find(l => !completedIds.has(l.id));
    setActiveLessonId(firstIncomplete?.id ?? lessons[0]?.id ?? null);

    setLoading(false);
  };

  const activeLesson = allLessons.find(l => l.id === activeLessonId) ?? null;
  const completedIds = new Set(progress.keys());
  const activeIdx = allLessons.findIndex(l => l.id === activeLessonId);

  const markComplete = useCallback(async (score?: number, answerData?: Record<string, string>) => {
    if (!user || !activeLessonId || !activeLesson || completing) return;
    setCompleting(true);

    const supabase = createClient();
    const { data } = await supabase
      .from('course_lesson_progress')
      .upsert({
        user_id: user.id,
        lesson_id: activeLessonId,
        course_id: params.id,
        score: score ?? null,
        answer_data: answerData ?? null,
      }, { onConflict: 'user_id,lesson_id' })
      .select()
      .single();

    if (data) {
      setProgress(prev => new Map(prev).set(activeLessonId, data as CourseLessonProgress));
      // Award XP
      await awardXP('lesson_complete');
      if (score === 100) await awardXP('quiz_perfect_score');

      // Refresh enrollment progress
      const { data: updated } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', params.id)
        .single();
      if (updated) {
        setEnrollment(updated as CourseEnrollment);
        // If just completed the course
        if ((updated as CourseEnrollment).completed_at && !enrollment?.completed_at) {
          await awardXP('course_complete');
          setShowRating(true);
        }
      }
    }
    setCompleting(false);
  }, [user, activeLessonId, activeLesson, params.id, completing, enrollment, awardXP]);

  const handleRate = async (r: number) => {
    const supabase = createClient();
    await supabase.rpc('rate_course', { p_course_id: params.id, p_rating: r });
    setUserRating(r);
    setShowRating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#070710' }}>
        <div className="w-8 h-8 border-2 border-[#FF5F1F]/30 border-t-[#FF5F1F] rounded-full animate-spin" />
      </div>
    );
  }

  if (!course) return null;

  const isCompleted = enrollment?.completed_at != null;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden" style={{ background: '#070710', color: '#fff' }}>
      {/* ─── Sidebar ─── */}
      <div className={cn(
        'flex-shrink-0 border-r border-white/[0.07] transition-all duration-200 overflow-hidden',
        sidebarOpen ? 'w-72' : 'w-0',
      )} style={{ background: 'rgba(7,7,16,0.97)' }}>
        {sidebarOpen && (
          <ProgressSidebar
            sections={sections}
            completedIds={completedIds}
            activeLessonId={activeLessonId}
            onSelect={l => setActiveLessonId(l.id)}
            enrollment={enrollment}
            course={course}
          />
        )}
      </div>

      {/* ─── Main content ─── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-white/[0.07] bg-[rgba(7,7,16,0.95)] shrink-0">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="text-white/40 hover:text-white/70 transition-colors p-1.5 rounded-lg hover:bg-white/5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/community/courses" className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors uppercase tracking-wider">
            ← Courses
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white truncate">{course.title}</h1>
          </div>

          {isCompleted && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
              Completed
            </span>
          )}
        </header>

        {/* Lesson content */}
        <div className="flex-1 overflow-y-auto">
          {activeLesson ? (
            <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
              {/* Lesson header */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{LESSON_TYPE_ICON[activeLesson.lesson_type]}</span>
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                    {LESSON_TYPE_LABEL[activeLesson.lesson_type]}
                  </span>
                  <span className="text-[10px] text-[#FF5F1F]/70">+{activeLesson.xp_reward} XP</span>
                  {completedIds.has(activeLesson.id) && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 ml-auto">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                      Completed
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-black text-white" style={{ letterSpacing: '-0.02em' }}>{activeLesson.title}</h2>
              </div>

              {/* Lesson body */}
              {activeLesson.lesson_type === 'text' && (
                <TextLesson content={activeLesson.content as LessonContentText} />
              )}
              {activeLesson.lesson_type === 'video' && (
                <VideoLesson content={activeLesson.content as LessonContentVideo} />
              )}
              {activeLesson.lesson_type === 'quiz' && (
                <QuizLesson
                  content={activeLesson.content as LessonContentQuiz}
                  existingScore={progress.get(activeLesson.id)?.score}
                  onComplete={(score, answers) => markComplete(score, answers)}
                />
              )}
              {activeLesson.lesson_type === 'script_editor' && (
                <ScriptEditorLesson
                  content={activeLesson.content as LessonContentScriptEditor}
                  existingCompletion={completedIds.has(activeLesson.id)}
                  onComplete={() => markComplete()}
                />
              )}
              {activeLesson.lesson_type === 'arc_editor' && (
                <ArcEditorLesson
                  content={activeLesson.content as LessonContentArcEditor}
                  existingCompletion={completedIds.has(activeLesson.id)}
                  onComplete={() => markComplete()}
                />
              )}
              {activeLesson.lesson_type === 'example' && (
                <ExampleLesson content={activeLesson.content as LessonContentExample} />
              )}

              {/* Bottom nav */}
              <div className="flex items-center justify-between mt-12 pt-8 border-t border-white/[0.06]">
                <button
                  onClick={() => setActiveLessonId(allLessons[activeIdx - 1]?.id ?? null)}
                  disabled={activeIdx === 0}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  Previous
                </button>

                <div className="flex items-center gap-2">
                  {/* Mark complete (for text/video/example) */}
                  {['text','video','example'].includes(activeLesson.lesson_type) && !completedIds.has(activeLesson.id) && (
                    <button
                      onClick={() => markComplete()}
                      disabled={completing}
                      className="px-5 py-2.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all disabled:opacity-50"
                    >
                      {completing ? 'Saving...' : 'Mark Complete'}
                    </button>
                  )}

                  {activeIdx < allLessons.length - 1 && (
                    <button
                      onClick={() => setActiveLessonId(allLessons[activeIdx + 1]?.id ?? null)}
                      className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#FF5F1F]/10 hover:bg-[#FF5F1F]/20 text-[#FF5F1F] rounded-xl transition-all border border-[#FF5F1F]/20"
                    >
                      Next
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="text-5xl mb-4">🎓</div>
              <h3 className="text-lg font-bold text-white mb-2">All lessons completed!</h3>
              <p className="text-sm text-white/50 max-w-sm">You've worked through every lesson in this course.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Rating modal ─── */}
      {showRating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#0D0D1A] rounded-2xl border border-[#FF5F1F]/20 p-8 text-center shadow-2xl">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-xl font-black text-white mb-1" style={{ letterSpacing: '-0.02em' }}>Course Complete!</h3>
            <p className="text-sm text-white/50 mb-2">You earned <span className="text-[#FF5F1F] font-bold">+{course.xp_reward} XP</span></p>
            <p className="text-sm text-white/60 mb-6">How would you rate this course?</p>
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1,2,3,4,5].map(r => (
                <button key={r} onClick={() => handleRate(r)}
                  className={cn('w-10 h-10 text-2xl transition-all hover:scale-110', r <= (userRating ?? 0) ? '' : 'opacity-30')}>
                  ★
                </button>
              ))}
            </div>
            <button onClick={() => setShowRating(false)} className="text-xs text-white/30 hover:text-white/60 transition-colors">Skip rating</button>
          </div>
        </div>
      )}
    </div>
  );
}
