'use client';

import { useEffect, useState, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArcMindmap } from '@/components/ArcMindmap';
import { cn } from '@/lib/utils';
import type {
  CourseDifficulty, LessonType,
  LessonContentText, LessonContentVideo, LessonContentQuiz,
  LessonContentScriptEditor, LessonContentArcEditor, LessonContentExample,
  QuizQuestion, QuizOption,
} from '@/lib/types';
import type { MindmapData } from '@/components/ArcMindmap';

// ============================================================
// Course Creation / Edit — /community/courses/create
// ============================================================

type Step = 'meta' | 'build';
type DraftLesson = {
  id: string;
  title: string;
  lesson_type: LessonType;
  xp_reward: number;
  is_required: boolean;
  content: unknown;
};
type DraftSection = { id: string; title: string; lessons: DraftLesson[] };

function uid() { return Math.random().toString(36).slice(2); }

// ── Lesson content form ────────────────────────────────────────
function TextForm({ value, onChange }: { value: LessonContentText; onChange: (v: LessonContentText) => void }) {
  return (
    <div className="space-y-3">
      <label className="block text-xs text-white/50 mb-1">Content (Markdown supported)</label>
      <textarea
        value={value.markdown}
        onChange={e => onChange({ markdown: e.target.value })}
        rows={12}
        className="w-full bg-white/[0.04] border border-white/10 rounded-xl font-mono text-sm text-white/80 p-4 outline-none focus:border-white/30 resize-y"
        placeholder="# Lesson Title&#10;&#10;Your content here. **Bold**, *italic*, `code`, > blockquote&#10;&#10;## Sub-heading"
      />
      <p className="text-[10px] text-white/25">Supports Markdown headings, bold, italic, inline code, blockquotes, lists, and links.</p>
    </div>
  );
}

function VideoForm({ value, onChange }: { value: LessonContentVideo; onChange: (v: LessonContentVideo) => void }) {
  const detectProvider = (url: string): 'youtube' | 'vimeo' | 'direct' => {
    if (url.includes('youtube') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('vimeo')) return 'vimeo';
    return 'direct';
  };
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-white/50 mb-1">Video URL *</label>
        <input
          value={value.embed_url}
          onChange={e => onChange({ ...value, embed_url: e.target.value, provider: detectProvider(e.target.value) })}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-2.5 outline-none focus:border-white/30"
        />
        {value.embed_url && (
          <p className="text-[10px] text-white/30 mt-1">Detected provider: {value.provider}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-white/50 mb-1">Duration (seconds)</label>
          <input
            type="number"
            value={value.duration_seconds ?? ''}
            onChange={e => onChange({ ...value, duration_seconds: e.target.value ? +e.target.value : undefined })}
            placeholder="180"
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-2.5 outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Caption (optional)</label>
          <input
            value={value.caption ?? ''}
            onChange={e => onChange({ ...value, caption: e.target.value })}
            placeholder="e.g. Scene opening example"
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-2.5 outline-none focus:border-white/30"
          />
        </div>
      </div>
    </div>
  );
}

function QuizForm({ value, onChange }: { value: LessonContentQuiz; onChange: (v: LessonContentQuiz) => void }) {
  const addQuestion = () => {
    const q: QuizQuestion = {
      id: uid(), text: '', explanation: '',
      options: [
        { id: uid(), text: '', is_correct: true },
        { id: uid(), text: '', is_correct: false },
        { id: uid(), text: '', is_correct: false },
        { id: uid(), text: '', is_correct: false },
      ],
    };
    onChange({ questions: [...value.questions, q] });
  };

  const updateQ = (qid: string, patch: Partial<QuizQuestion>) =>
    onChange({ questions: value.questions.map(q => q.id === qid ? { ...q, ...patch } : q) });

  const removeQ = (qid: string) =>
    onChange({ questions: value.questions.filter(q => q.id !== qid) });

  const updateOpt = (qid: string, oid: string, patch: Partial<QuizOption>) =>
    onChange({ questions: value.questions.map(q =>
      q.id === qid ? { ...q, options: q.options.map(o => o.id === oid ? { ...o, ...patch } : o) } : q,
    )});

  const addOpt = (qid: string) =>
    onChange({ questions: value.questions.map(q =>
      q.id === qid ? { ...q, options: [...q.options, { id: uid(), text: '', is_correct: false }] } : q,
    )});

  const markCorrect = (qid: string, oid: string) =>
    onChange({ questions: value.questions.map(q =>
      q.id === qid ? { ...q, options: q.options.map(o => ({ ...o, is_correct: o.id === oid })) } : q,
    )});

  return (
    <div className="space-y-6">
      {value.questions.map((q, qi) => (
        <div key={q.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Question {qi + 1}</span>
            <button onClick={() => removeQ(q.id)} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Remove</button>
          </div>
          <textarea
            value={q.text}
            onChange={e => updateQ(q.id, { text: e.target.value })}
            rows={2}
            placeholder="What is the purpose of a slugline?"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white/80 px-3 py-2 outline-none focus:border-white/30 resize-none"
          />
          <div className="space-y-1.5">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Answer Choices <span className="text-[#FF5F1F]">— click radio to mark correct</span></p>
            {q.options.map(opt => (
              <div key={opt.id} className="flex items-center gap-2">
                <button
                  onClick={() => markCorrect(q.id, opt.id)}
                  className={cn(
                    'w-4 h-4 rounded-full border-2 shrink-0 transition-all',
                    opt.is_correct ? 'border-emerald-500 bg-emerald-500' : 'border-white/20 hover:border-white/40',
                  )}
                />
                <input
                  value={opt.text}
                  onChange={e => updateOpt(q.id, opt.id, { text: e.target.value })}
                  placeholder={`Option ${q.options.indexOf(opt) + 1}`}
                  className={cn(
                    'flex-1 bg-white/[0.04] border rounded-lg text-sm px-3 py-1.5 outline-none transition-colors',
                    opt.is_correct ? 'border-emerald-500/30 text-emerald-400' : 'border-white/10 text-white/70',
                  )}
                />
              </div>
            ))}
            {q.options.length < 6 && (
              <button onClick={() => addOpt(q.id)} className="text-xs text-white/30 hover:text-white/60 transition-colors pl-6">+ Add option</button>
            )}
          </div>
          <div>
            <label className="block text-[10px] text-white/30 uppercase tracking-wider mb-1">Explanation (shown after answer)</label>
            <input
              value={q.explanation ?? ''}
              onChange={e => updateQ(q.id, { explanation: e.target.value })}
              placeholder="Sluglines identify each new scene location and time of day..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white/70 px-3 py-2 outline-none focus:border-white/30"
            />
          </div>
        </div>
      ))}
      <button onClick={addQuestion}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/20 text-sm text-white/50 hover:text-white/80 hover:border-white/40 transition-all w-full justify-center">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
        Add Question
      </button>
    </div>
  );
}

function ScriptEditorForm({ value, onChange }: { value: LessonContentScriptEditor; onChange: (v: LessonContentScriptEditor) => void }) {
  const [kwInput, setKwInput] = useState('');
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-white/50 mb-1">Instructions for student *</label>
        <textarea
          value={value.instructions}
          onChange={e => onChange({ ...value, instructions: e.target.value })}
          rows={3}
          placeholder="Write a scene opening with an INT slugline and a two-line action description."
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-2.5 outline-none focus:border-white/30 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs text-white/50 mb-1">Initial content (pre-filled in editor)</label>
        <textarea
          value={value.initial_content}
          onChange={e => onChange({ ...value, initial_content: e.target.value })}
          rows={6}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl font-mono text-sm text-white/80 px-4 py-3 outline-none focus:border-white/30 resize-y"
          placeholder="INT. COFFEE SHOP - DAY&#10;&#10;The smell of espresso fills the air."
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
          <input type="checkbox" checked={value.locked} onChange={e => onChange({ ...value, locked: e.target.checked })}
            className="w-4 h-4 accent-[#FF5F1F]" />
          Read-only (student can only view, not edit)
        </label>
      </div>
      {!value.locked && (
        <>
          <div>
            <label className="block text-xs text-white/50 mb-1">Expected keywords (green when present)</label>
            <div className="flex gap-2">
              <input
                value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && kwInput.trim()) { onChange({ ...value, expected_keywords: [...(value.expected_keywords||[]), kwInput.trim()] }); setKwInput(''); e.preventDefault(); } }}
                placeholder="Type keyword and press Enter"
                className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-3 py-2 outline-none focus:border-white/30"
              />
            </div>
            {(value.expected_keywords || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(value.expected_keywords || []).map(kw => (
                  <span key={kw} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
                    {kw}
                    <button onClick={() => onChange({ ...value, expected_keywords: (value.expected_keywords||[]).filter(k => k !== kw) })} className="hover:text-red-400">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Hint text (shown on request)</label>
            <input
              value={value.hint ?? ''}
              onChange={e => onChange({ ...value, hint: e.target.value })}
              placeholder="Remember: sluglines are always UPPERCASE and describe location/time."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-3 py-2.5 outline-none focus:border-white/30"
            />
          </div>
        </>
      )}
    </div>
  );
}

function ArcEditorForm({ value, onChange }: { value: LessonContentArcEditor; onChange: (v: LessonContentArcEditor) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-white/50 mb-1">Instructions for student *</label>
        <textarea
          value={value.instructions}
          onChange={e => onChange({ ...value, instructions: e.target.value })}
          rows={3}
          placeholder="Map out the three-act structure for a drama series using the arc editor below."
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-2.5 outline-none focus:border-white/30 resize-none"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
        <input type="checkbox" checked={value.locked} onChange={e => onChange({ ...value, locked: e.target.checked })}
          className="w-4 h-4 accent-[#FF5F1F]" />
        Read-only (students can only view this arc, not edit it)
      </label>
      <div>
        <p className="text-xs text-white/50 mb-2">Arc canvas — build the example/template here</p>
        <div className="rounded-2xl overflow-hidden border border-white/[0.08]" style={{ height: '400px' }}>
          <ArcMindmap
            projectId={`course-create-${uid()}`}
            initialData={(value.arc_data as MindmapData | null) ?? null}
            canEdit={true}
            onSave={data => onChange({ ...value, arc_data: data as unknown as Record<string,unknown> })}
          />
        </div>
      </div>
    </div>
  );
}

function ExampleForm({ value, onChange }: { value: LessonContentExample; onChange: (v: LessonContentExample) => void }) {
  const [annLine, setAnnLine] = useState('');
  const [annNote, setAnnNote] = useState('');
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-white/50 mb-1">Description (optional)</label>
        <input
          value={value.description ?? ''}
          onChange={e => onChange({ ...value, description: e.target.value })}
          placeholder="This example shows proper slugline and action formatting."
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-2.5 outline-none focus:border-white/30"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-white/50">Language</label>
        </div>
        <select
          value={value.language}
          onChange={e => onChange({ ...value, language: e.target.value })}
          className="bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-3 py-2 outline-none focus:border-white/30"
        >
          <option value="fountain">Fountain (Screenplay)</option>
          <option value="text">Plain Text</option>
          <option value="json">JSON</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-white/50 mb-1">Example content *</label>
        <textarea
          value={value.content}
          onChange={e => onChange({ ...value, content: e.target.value })}
          rows={10}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl font-mono text-sm text-white/80 px-4 py-3 outline-none focus:border-white/30 resize-y"
          placeholder={`INT. COFFEE SHOP - DAY\n\nThe smell of espresso fills the air.\n\nBARISTA\n(smiling)\nWhat can I get you?`}
        />
      </div>
      <div>
        <p className="text-xs text-white/50 mb-2 uppercase tracking-wider">Annotations (appear next to line)</p>
        <div className="flex gap-2 mb-2">
          <input type="number" value={annLine} onChange={e => setAnnLine(e.target.value)} placeholder="Line #" className="w-20 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white/80 px-3 py-1.5 outline-none" />
          <input value={annNote} onChange={e => setAnnNote(e.target.value)} placeholder="Annotation text..." className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white/80 px-3 py-1.5 outline-none" />
          <button
            onClick={() => { if (annLine && annNote.trim()) { onChange({ ...value, annotations: [...(value.annotations||[]), { line: +annLine, note: annNote.trim() }] }); setAnnLine(''); setAnnNote(''); } }}
            className="px-3 py-1.5 text-xs font-semibold bg-[#FF5F1F]/10 text-[#FF5F1F] rounded-lg hover:bg-[#FF5F1F]/20 transition-colors">
            Add
          </button>
        </div>
        {(value.annotations || []).map((a, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-white/50 mb-1">
            <span className="text-white/30 w-14">Line {a.line}:</span>
            <span className="flex-1">{a.note}</span>
            <button onClick={() => onChange({ ...value, annotations: (value.annotations||[]).filter((_,j) => j !== i) })} className="text-red-400/50 hover:text-red-400">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Default content per type ───────────────────────────────────
function defaultContent(type: LessonType): Record<string, unknown> {
  switch (type) {
    case 'text':          return { markdown: '' } satisfies LessonContentText;
    case 'video':         return { embed_url: '', provider: 'youtube' } satisfies LessonContentVideo;
    case 'quiz':          return { questions: [] } satisfies LessonContentQuiz;
    case 'script_editor': return { instructions: '', initial_content: '', locked: false, expected_keywords: [] } satisfies LessonContentScriptEditor;
    case 'arc_editor':    return { instructions: '', arc_data: null, locked: false } satisfies LessonContentArcEditor;
    case 'example':       return { content: '', language: 'fountain', annotations: [] } satisfies LessonContentExample;
  }
}

const LESSON_TYPE_OPTIONS: { value: LessonType; label: string; desc: string; icon: string }[] = [
  { value: 'text',          icon: '📄', label: 'Reading',      desc: 'Markdown text, formatted content' },
  { value: 'video',         icon: '🎬', label: 'Video',        desc: 'YouTube, Vimeo, or direct embed' },
  { value: 'quiz',          icon: '🧠', label: 'Quiz',         desc: 'Multiple-choice with explanations' },
  { value: 'script_editor', icon: '✍️', label: 'Script Task',  desc: 'Mini screenplay editor (locked or task)' },
  { value: 'arc_editor',    icon: '🗺️', label: 'Arc Task',    desc: 'Embedded arc mind-map' },
  { value: 'example',       icon: '💡', label: 'Example',     desc: 'Annotated screenplay/code example' },
];

export default function CreateCoursePage() {
  const { user } = useAuth();
  const router = useRouter();

  // Meta
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [shortDesc, setShortDesc]     = useState('');
  const [difficulty, setDifficulty]   = useState<CourseDifficulty>('beginner');
  const [tags, setTags]               = useState<string[]>([]);
  const [tagInput, setTagInput]       = useState('');
  const [xpReward, setXpReward]       = useState(100);
  const [estMins, setEstMins]         = useState(30);
  const [thumbnail, setThumbnail]     = useState('');

  // Build
  const [step, setStep]               = useState<Step>('meta');
  const [sections, setSections]       = useState<DraftSection[]>([
    { id: uid(), title: 'Introduction', lessons: [] },
  ]);
  const [editingLesson, setEditingLesson] = useState<{ secId: string; lesson: DraftLesson } | null>(null);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (!user) return;
    const allowed = user.role === 'admin' || user.role === 'moderator';
    // Also check level — but we'd need extra fetch; skip for now, DB enforces it
    if (!allowed) {
      // will be validated server-side; allow UI to proceed
    }
  }, [user]);

  // ── Section helpers ────────────────────────────────────────
  const addSection = () => setSections(s => [...s, { id: uid(), title: 'New Section', lessons: [] }]);
  const updateSection = (id: string, patch: Partial<DraftSection>) =>
    setSections(s => s.map(sec => sec.id === id ? { ...sec, ...patch } : sec));
  const removeSection = (id: string) =>
    setSections(s => s.filter(sec => sec.id !== id));

  const addLesson = (secId: string) => {
    const lesson: DraftLesson = { id: uid(), title: 'New Lesson', lesson_type: 'text', xp_reward: 15, is_required: true, content: defaultContent('text') };
    setSections(s => s.map(sec => sec.id === secId ? { ...sec, lessons: [...sec.lessons, lesson] } : sec));
    setEditingLesson({ secId, lesson });
  };

  const updateLesson = (secId: string, lessonId: string, patch: Partial<DraftLesson>) =>
    setSections(s => s.map(sec =>
      sec.id === secId
        ? { ...sec, lessons: sec.lessons.map(l => l.id === lessonId ? { ...l, ...patch } : l) }
        : sec,
    ));

  const removeLesson = (secId: string, lessonId: string) =>
    setSections(s => s.map(sec =>
      sec.id === secId ? { ...sec, lessons: sec.lessons.filter(l => l.id !== lessonId) } : sec,
    ));

  const openEditLesson = (secId: string, lesson: DraftLesson) => setEditingLesson({ secId, lesson: { ...lesson } });

  const saveEditLesson = () => {
    if (!editingLesson) return;
    updateLesson(editingLesson.secId, editingLesson.lesson.id, editingLesson.lesson);
    setEditingLesson(null);
  };

  // ── Save course to DB ──────────────────────────────────────
  const handleSave = async (status: 'draft' | 'published') => {
    if (!user || !title.trim()) return;
    setSaving(true);
    const supabase = createClient();

    // Insert course
    const { data: course, error } = await supabase
      .from('courses')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        short_desc: shortDesc.trim() || null,
        type: user.role === 'admin' ? 'system' : 'user',
        creator_id: user.id,
        difficulty,
        tags,
        status,
        xp_reward: xpReward,
        estimated_minutes: estMins,
        thumbnail_url: thumbnail.trim() || null,
      })
      .select()
      .single();

    if (error || !course) { setSaving(false); return; }

    // Insert sections + lessons
    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si];
      const { data: secData } = await supabase
        .from('course_sections')
        .insert({ course_id: course.id, title: sec.title, order_index: si })
        .select()
        .single();
      if (!secData) continue;

      for (let li = 0; li < sec.lessons.length; li++) {
        const l = sec.lessons[li];
        await supabase.from('course_lessons').insert({
          course_id: course.id,
          section_id: secData.id,
          title: l.title,
          order_index: li,
          lesson_type: l.lesson_type,
          content: l.content,
          xp_reward: l.xp_reward,
          is_required: l.is_required,
        });
      }
    }

    setSaving(false);
    router.push(`/community/courses/${course.id}`);
  };

  return (
    <div className="min-h-screen" style={{ background: '#070710', color: '#fff' }}>
      <div className="pointer-events-none fixed inset-0 opacity-[0.10]"
        style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.4) 1px,transparent 1px)', backgroundSize: '32px 32px' }}
      />

      {/* Nav */}
      <nav className="sticky top-14 z-30 backdrop-blur-xl border-b border-white/[0.07]" style={{ background: 'rgba(7,7,16,0.95)' }}>
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-4 h-14">
          <Link href="/community/courses" className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors uppercase tracking-wider">← Courses</Link>
          <span className="text-white/10">|</span>
          <h1 className="text-sm font-bold text-white">Create Course</h1>

          {/* Step indicator */}
          <div className="flex items-center gap-1 ml-auto">
            {(['meta','build'] as Step[]).map((s, i) => (
              <button key={s} onClick={() => step === 'build' || s === 'meta' ? setStep(s) : undefined}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  step === s ? 'bg-[#FF5F1F] text-white' : 'text-white/40 hover:text-white/60',
                )}>
                <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[9px]">{i+1}</span>
                {s === 'meta' ? 'Details' : 'Build'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {step === 'meta' ? (
          // ── Step 1: Course metadata ────────────────────────
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-2xl font-black text-white mb-1" style={{ letterSpacing: '-0.02em' }}>Course Details</h2>
              <p className="text-sm text-white/40">Fill in the basic information about your course.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Introduction to Screenplay Formatting"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-base font-semibold text-white px-4 py-3 outline-none focus:border-[#FF5F1F]/40 placeholder-white/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Short Description (for card)</label>
                <input value={shortDesc} onChange={e => setShortDesc(e.target.value)}
                  placeholder="Learn the rules of professional screenplay formatting."
                  maxLength={100}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white px-4 py-2.5 outline-none focus:border-white/30 placeholder-white/20"
                />
                <p className="text-[10px] text-white/25 mt-1">{shortDesc.length}/100</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Full Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  rows={5} placeholder="A detailed description of what students will learn..."
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-3 outline-none focus:border-white/30 resize-none placeholder-white/20"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Difficulty</label>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value as CourseDifficulty)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white px-3 py-2.5 outline-none focus:border-white/30">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">XP Reward</label>
                  <input type="number" value={xpReward} onChange={e => setXpReward(+e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white px-3 py-2.5 outline-none focus:border-white/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Est. Minutes</label>
                  <input type="number" value={estMins} onChange={e => setEstMins(+e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white px-3 py-2.5 outline-none focus:border-white/30" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Tags</label>
                <div className="flex gap-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { setTags(t => [...t, tagInput.trim()]); setTagInput(''); e.preventDefault(); } }}
                    placeholder="Type tag and press Enter"
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-3 py-2 outline-none focus:border-white/30"
                  />
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map(t => (
                      <span key={t} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-white/5 text-white/50 rounded border border-white/10">
                        {t}
                        <button onClick={() => setTags(prev => prev.filter(k => k !== t))} className="hover:text-red-400 transition-colors">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Thumbnail URL (optional)</label>
                <input value={thumbnail} onChange={e => setThumbnail(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-2.5 outline-none focus:border-white/30 placeholder-white/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => { if (title.trim()) setStep('build'); }}
                disabled={!title.trim()}
                className="px-6 py-3 rounded-xl font-semibold text-sm bg-[#FF5F1F] text-white hover:bg-[#E54E15] transition-colors disabled:opacity-40"
              >
                Continue to Builder →
              </button>
            </div>
          </div>
        ) : (
          // ── Step 2: Section + Lesson builder ──────────────
          <div className="space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-xl font-black text-white mb-0.5" style={{ letterSpacing: '-0.02em' }}>{title}</h2>
                <p className="text-sm text-white/40">Build your sections and lessons.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleSave('draft')} disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] text-white/70 hover:bg-white/10 transition-colors disabled:opacity-40">
                  Save Draft
                </button>
                <button onClick={() => handleSave('published')} disabled={saving || sections.every(s => s.lessons.length === 0)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF5F1F] text-white hover:bg-[#E54E15] transition-colors disabled:opacity-40">
                  {saving ? 'Publishing...' : 'Publish Course'}
                </button>
              </div>
            </div>

            {sections.map((sec, si) => (
              <div key={sec.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                {/* Section header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] bg-white/[0.03]">
                  <span className="w-6 h-6 rounded-full bg-[#FF5F1F]/20 text-[#FF5F1F] text-xs font-bold flex items-center justify-center shrink-0">
                    {si + 1}
                  </span>
                  <input
                    value={sec.title}
                    onChange={e => updateSection(sec.id, { title: e.target.value })}
                    className="flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder-white/25"
                    placeholder="Section Title"
                  />
                  <button onClick={() => removeSection(sec.id)} className="text-xs text-red-400/50 hover:text-red-400 transition-colors">Remove</button>
                </div>

                {/* Lessons */}
                <div className="divide-y divide-white/[0.04]">
                  {sec.lessons.map((lesson, li) => (
                    <div key={lesson.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-sm">{LESSON_TYPE_OPTIONS.find(t => t.value === lesson.lesson_type)?.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white/80 block truncate">{lesson.title}</span>
                        <span className="text-[10px] text-white/30">{LESSON_TYPE_OPTIONS.find(t => t.value === lesson.lesson_type)?.label} · {lesson.xp_reward} XP</span>
                      </div>
                      <button onClick={() => openEditLesson(sec.id, lesson)}
                        className="text-xs text-white/40 hover:text-white/80 transition-colors px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg">
                        Edit
                      </button>
                      <button onClick={() => removeLesson(sec.id, lesson.id)}
                        className="text-xs text-red-400/50 hover:text-red-400 transition-colors">×</button>
                    </div>
                  ))}
                </div>

                {/* Add lesson button */}
                <div className="p-3">
                  <button onClick={() => addLesson(sec.id)}
                    className="flex items-center gap-1.5 w-full justify-center px-4 py-2.5 text-xs text-white/40 hover:text-white/70 border border-dashed border-white/10 hover:border-white/25 rounded-xl transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    Add Lesson
                  </button>
                </div>
              </div>
            ))}

            <button onClick={addSection}
              className="flex items-center gap-2 w-full justify-center px-6 py-4 text-sm text-white/40 hover:text-white/70 border-2 border-dashed border-white/10 hover:border-white/25 rounded-2xl transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Add Section
            </button>
          </div>
        )}
      </div>

      {/* ─── Lesson Editor Modal ─── */}
      {editingLesson && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
          <div className="w-full sm:max-w-2xl bg-[#0E0E1C] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#0E0E1C] z-10">
              <h3 className="text-sm font-bold text-white">Edit Lesson</h3>
              <button onClick={() => setEditingLesson(null)} className="text-white/40 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Title + type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-white/50 mb-1">Lesson Title *</label>
                  <input
                    value={editingLesson.lesson.title}
                    onChange={e => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, title: e.target.value } } : null)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm font-semibold text-white px-4 py-2.5 outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">XP Reward</label>
                  <input type="number"
                    value={editingLesson.lesson.xp_reward}
                    onChange={e => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, xp_reward: +e.target.value } } : null)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white px-3 py-2.5 outline-none focus:border-white/30"
                  />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                    <input type="checkbox"
                      checked={editingLesson.lesson.is_required}
                      onChange={e => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, is_required: e.target.checked } } : null)}
                      className="w-4 h-4 accent-[#FF5F1F]"
                    />
                    Required to complete
                  </label>
                </div>
              </div>

              {/* Lesson type picker */}
              <div>
                <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Lesson Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LESSON_TYPE_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, lesson_type: opt.value, content: defaultContent(opt.value) } } : null)}
                      className={cn(
                        'flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all',
                        editingLesson.lesson.lesson_type === opt.value
                          ? 'border-[#FF5F1F]/40 bg-[#FF5F1F]/10'
                          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20',
                      )}>
                      <span className="text-lg leading-none">{opt.icon}</span>
                      <div>
                        <div className="text-xs font-semibold text-white">{opt.label}</div>
                        <div className="text-[10px] text-white/40 mt-0.5 leading-snug">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content form */}
              <div>
                <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Content</label>
                {editingLesson.lesson.lesson_type === 'text' && (
                  <TextForm
                    value={editingLesson.lesson.content as unknown as LessonContentText}
                    onChange={v => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, content: v as unknown } } : null)}
                  />
                )}
                {editingLesson.lesson.lesson_type === 'video' && (
                  <VideoForm
                    value={editingLesson.lesson.content as unknown as LessonContentVideo}
                    onChange={v => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, content: v as unknown } } : null)}
                  />
                )}
                {editingLesson.lesson.lesson_type === 'quiz' && (
                  <QuizForm
                    value={editingLesson.lesson.content as unknown as LessonContentQuiz}
                    onChange={v => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, content: v as unknown } } : null)}
                  />
                )}
                {editingLesson.lesson.lesson_type === 'script_editor' && (
                  <ScriptEditorForm
                    value={editingLesson.lesson.content as unknown as LessonContentScriptEditor}
                    onChange={v => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, content: v as unknown } } : null)}
                  />
                )}
                {editingLesson.lesson.lesson_type === 'arc_editor' && (
                  <ArcEditorForm
                    value={editingLesson.lesson.content as unknown as LessonContentArcEditor}
                    onChange={v => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, content: v as unknown } } : null)}
                  />
                )}
                {editingLesson.lesson.lesson_type === 'example' && (
                  <ExampleForm
                    value={editingLesson.lesson.content as unknown as LessonContentExample}
                    onChange={v => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, content: v as unknown } } : null)}
                  />
                )}
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06] bg-[#0E0E1C]">
              <button onClick={() => setEditingLesson(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
              <button onClick={saveEditLesson}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#FF5F1F] text-white hover:bg-[#E54E15] transition-colors">
                Save Lesson
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
