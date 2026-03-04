'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArcMindmap } from '@/components/ArcMindmap';
import { cn } from '@/lib/utils';
import type {
  Course, CourseSection, CourseLesson, CourseDifficulty, LessonType,
  LessonContentText, LessonContentVideo, LessonContentQuiz, QuizQuestion, QuizOption,
  LessonContentScriptEditor, LessonContentArcEditor, LessonContentExample,
} from '@/lib/types';
import type { MindmapData } from '@/components/ArcMindmap';

// ============================================================
// Course Edit Page — /community/courses/[id]/edit
// Shares the same section/lesson builder as the create page.
// ============================================================

type DraftLesson = {
  id: string;             // DB uuid or temp "new-*"
  dbId?: string;         // set when it already exists in DB
  title: string;
  lesson_type: LessonType;
  xp_reward: number;
  is_required: boolean;
  content: unknown;
};
type DraftSection = {
  id: string;             // DB uuid or temp "new-*"
  dbId?: string;
  title: string;
  lessons: DraftLesson[];
};

function uid() { return 'new-' + Math.random().toString(36).slice(2); }

const LESSON_TYPES: { value: LessonType; icon: string; label: string; desc: string }[] = [
  { value: 'text',          icon: '📄', label: 'Reading',     desc: 'Markdown text content'      },
  { value: 'video',         icon: '🎬', label: 'Video',       desc: 'YouTube / Vimeo / direct'   },
  { value: 'quiz',          icon: '🧠', label: 'Quiz',        desc: 'Multiple-choice questions'  },
  { value: 'script_editor', icon: '✍️', label: 'Script Task', desc: 'Screenplay writing exercise'},
  { value: 'arc_editor',    icon: '🗺️', label: 'Arc Task',   desc: 'Mind-map exercise'           },
  { value: 'example',       icon: '💡', label: 'Example',    desc: 'Annotated code/screenplay'  },
];

function defaultContent(type: LessonType): unknown {
  switch (type) {
    case 'text':          return { markdown: '' } as LessonContentText;
    case 'video':         return { embed_url: '', provider: 'youtube' } as LessonContentVideo;
    case 'quiz':          return { questions: [] };
    case 'script_editor': return { instructions: '', initial_content: '', locked: false, expected_keywords: [] } as LessonContentScriptEditor;
    case 'arc_editor':    return { instructions: '', arc_data: null, locked: false } as LessonContentArcEditor;
    case 'example':       return { content: '', language: 'fountain', annotations: [] } as LessonContentExample;
  }
}

// ── Lean content editors (same logic as create page) ──────────

function LessonContentForm({ type, value, onChange }: {
  type: LessonType;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (type === 'text') {
    const v = value as LessonContentText;
    return (
      <textarea value={v.markdown} onChange={e => onChange({ markdown: e.target.value })}
        rows={10} placeholder="# Heading\n\nContent here…"
        className="w-full bg-white/[0.04] border border-white/10 rounded-xl font-mono text-sm text-white/80 px-4 py-3 outline-none focus:border-white/30 resize-y" />
    );
  }
  if (type === 'video') {
    const v = value as LessonContentVideo;
    const detect = (url: string) => url.includes('youtube') || url.includes('youtu.be') ? 'youtube' : url.includes('vimeo') ? 'vimeo' : 'direct';
    return (
      <div className="space-y-2">
        <input value={v.embed_url} onChange={e => onChange({ ...v, embed_url: e.target.value, provider: detect(e.target.value) })}
          placeholder="https://www.youtube.com/watch?v=…"
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-2.5 outline-none focus:border-white/30" />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={v.duration_seconds ?? ''} onChange={e => onChange({ ...v, duration_seconds: e.target.value ? +e.target.value : undefined })}
            placeholder="Duration (sec)" className="bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-3 py-2 outline-none" />
          <input value={v.caption ?? ''} onChange={e => onChange({ ...v, caption: e.target.value })}
            placeholder="Caption (optional)" className="bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-3 py-2 outline-none" />
        </div>
      </div>
    );
  }
  if (type === 'quiz') {
    const v = value as LessonContentQuiz;
    const addQ = () => onChange({ questions: [...v.questions, { id: uid(), text: '', explanation: '', options: [{ id: uid(), text: '', is_correct: true }, { id: uid(), text: '', is_correct: false }] }] });
    const removeQ = (qid: string) => onChange({ questions: v.questions.filter((q: QuizQuestion) => q.id !== qid) });
    const updateQ = (qid: string, patch: Partial<QuizQuestion>) => onChange({ questions: v.questions.map((q: QuizQuestion) => q.id === qid ? { ...q, ...patch } : q) });
    const markCorrect = (qid: string, oid: string) => onChange({ questions: v.questions.map((q: QuizQuestion) => q.id === qid ? { ...q, options: q.options.map((o: QuizOption) => ({ ...o, is_correct: o.id === oid })) } : q) });
    const updateOpt = (qid: string, oid: string, patch: Partial<QuizOption>) => onChange({ questions: v.questions.map((q: QuizQuestion) => q.id === qid ? { ...q, options: q.options.map((o: QuizOption) => o.id === oid ? { ...o, ...patch } : o) } : q) });
    return (
      <div className="space-y-4">
        {v.questions.map((q: QuizQuestion, qi: number) => (
          <div key={q.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Q{qi+1}</span>
              <button onClick={() => removeQ(q.id)} className="text-xs text-red-400/50 hover:text-red-400">Remove</button>
            </div>
            <textarea value={q.text} onChange={e => updateQ(q.id, { text: e.target.value })} rows={2}
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white/80 px-3 py-2 outline-none resize-none" />
            {q.options.map((opt: QuizOption) => (
              <div key={opt.id} className="flex items-center gap-2">
                <button onClick={() => markCorrect(q.id, opt.id)} className={cn('w-4 h-4 rounded-full border-2 shrink-0', opt.is_correct ? 'border-emerald-500 bg-emerald-500' : 'border-white/20')} />
                <input value={opt.text} onChange={e => updateOpt(q.id, opt.id, { text: e.target.value })}
                  className={cn('flex-1 bg-white/[0.04] border rounded-lg text-sm px-3 py-1.5 outline-none', opt.is_correct ? 'border-emerald-500/30 text-emerald-400' : 'border-white/10 text-white/70')} />
              </div>
            ))}
            <input value={q.explanation ?? ''} onChange={e => updateQ(q.id, { explanation: e.target.value })}
              placeholder="Explanation shown after answer…"
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white/70 px-3 py-2 outline-none" />
          </div>
        ))}
        <button onClick={addQ} className="w-full py-2 text-xs text-white/40 hover:text-white/70 border border-dashed border-white/15 hover:border-white/30 rounded-xl transition-all">+ Add Question</button>
      </div>
    );
  }
  if (type === 'script_editor') {
    const v = value as LessonContentScriptEditor;
    return (
      <div className="space-y-3">
        <textarea value={v.instructions} onChange={e => onChange({ ...v, instructions: e.target.value })} rows={2}
          placeholder="Instructions for student…" className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-2.5 outline-none resize-none" />
        <textarea value={v.initial_content} onChange={e => onChange({ ...v, initial_content: e.target.value })} rows={6}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl font-mono text-sm text-white/80 px-4 py-3 outline-none resize-y" placeholder="INT. — DAY" />
        <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
          <input type="checkbox" checked={v.locked} onChange={e => onChange({ ...v, locked: e.target.checked })} className="w-4 h-4 accent-[#FF5F1F]" />
          Read-only
        </label>
      </div>
    );
  }
  if (type === 'arc_editor') {
    const v = value as LessonContentArcEditor;
    return (
      <div className="space-y-3">
        <textarea value={v.instructions} onChange={e => onChange({ ...v, instructions: e.target.value })} rows={2}
          placeholder="Instructions for student…" className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-2.5 outline-none resize-none" />
        <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
          <input type="checkbox" checked={v.locked} onChange={e => onChange({ ...v, locked: e.target.checked })} className="w-4 h-4 accent-[#FF5F1F]" />
          Read-only
        </label>
        <div className="rounded-2xl overflow-hidden border border-white/[0.08]" style={{ height: '360px' }}>
          <ArcMindmap projectId={`course-edit-${uid()}`} initialData={(v.arc_data as MindmapData | null) ?? null} canEdit={true}
            onSave={data => onChange({ ...v, arc_data: data as unknown })} />
        </div>
      </div>
    );
  }
  if (type === 'example') {
    const v = value as LessonContentExample;
    return (
      <div className="space-y-3">
        <select value={v.language} onChange={e => onChange({ ...v, language: e.target.value })}
          className="bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-3 py-2 outline-none">
          <option value="fountain">Fountain</option><option value="text">Text</option><option value="json">JSON</option>
        </select>
        <textarea value={v.content} onChange={e => onChange({ ...v, content: e.target.value })} rows={10}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl font-mono text-sm text-white/80 px-4 py-3 outline-none resize-y" />
      </div>
    );
  }
  return null;
}

// Minimal type aliases to satisfy TSC without importing from types.ts (already imported)

export default function CourseEditPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  // ─── meta ───────────────────────────────────────────────────
  const [title, setTitle]             = useState('');
  const [shortDesc, setShortDesc]     = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty]   = useState<CourseDifficulty>('beginner');
  const [tags, setTags]               = useState<string[]>([]);
  const [tagInput, setTagInput]       = useState('');
  const [xpReward, setXpReward]       = useState(100);
  const [estMins, setEstMins]         = useState(30);
  const [thumbnail, setThumbnail]     = useState('');
  const [status, setStatus]           = useState<'draft' | 'published'>('draft');

  // ─── build ──────────────────────────────────────────────────
  const [step, setStep]               = useState<'meta' | 'build'>('meta');
  const [sections, setSections]       = useState<DraftSection[]>([]);
  const [editingLesson, setEditingLesson] = useState<{ secId: string; lesson: DraftLesson } | null>(null);
  const [saving, setSaving]           = useState(false);
  const [loading, setLoading]         = useState(true);

  // ─── Load existing course data ───────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    (async () => {
      const supabase = createClient();
      const [courseRes, sectionsRes, lessonsRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase.from('course_sections').select('*').eq('course_id', courseId).order('order_index'),
        supabase.from('course_lessons').select('*').eq('course_id', courseId).order('order_index'),
      ]);

      if (courseRes.error || !courseRes.data) { router.push('/community/courses'); return; }
      const c = courseRes.data as Course;

      // Check ownership
      if (user && c.creator_id !== user.id && user.role !== 'admin') {
        router.push(`/community/courses/${courseId}`);
        return;
      }

      setTitle(c.title);
      setShortDesc(c.short_desc || '');
      setDescription(c.description || '');
      setDifficulty(c.difficulty);
      setTags(c.tags || []);
      setXpReward(c.xp_reward);
      setEstMins(c.estimated_minutes || 30);
      setThumbnail(c.thumbnail_url || '');
      setStatus(c.status === 'published' ? 'published' : 'draft');

      const secData = (sectionsRes.data || []) as CourseSection[];
      const lesData = (lessonsRes.data || []) as CourseLesson[];

      setSections(secData.map(sec => ({
        id: sec.id,
        dbId: sec.id,
        title: sec.title,
        lessons: lesData
          .filter(l => l.section_id === sec.id)
          .map(l => ({
            id: l.id,
            dbId: l.id,
            title: l.title,
            lesson_type: l.lesson_type,
            xp_reward: l.xp_reward,
            is_required: l.is_required,
            content: l.content,
          })),
      })));

      setLoading(false);
    })();
  }, [courseId, user]);

  // ─── Section helpers ──────────────────────────────────────────
  const addSection = () => setSections(s => [...s, { id: uid(), title: 'New Section', lessons: [] }]);
  const updateSection = (id: string, patch: Partial<DraftSection>) => setSections(s => s.map(sec => sec.id === id ? { ...sec, ...patch } : sec));
  const removeSection = (id: string) => setSections(s => s.filter(sec => sec.id !== id));
  const addLesson = (secId: string) => {
    const lesson: DraftLesson = { id: uid(), title: 'New Lesson', lesson_type: 'text', xp_reward: 15, is_required: true, content: defaultContent('text') };
    setSections(s => s.map(sec => sec.id === secId ? { ...sec, lessons: [...sec.lessons, lesson] } : sec));
    setEditingLesson({ secId, lesson });
  };
  const updateLesson = (secId: string, lessonId: string, patch: Partial<DraftLesson>) =>
    setSections(s => s.map(sec => sec.id === secId ? { ...sec, lessons: sec.lessons.map(l => l.id === lessonId ? { ...l, ...patch } : l) } : sec));
  const removeLesson = (secId: string, lessonId: string) =>
    setSections(s => s.map(sec => sec.id === secId ? { ...sec, lessons: sec.lessons.filter(l => l.id !== lessonId) } : sec));
  const saveEditLesson = () => {
    if (!editingLesson) return;
    updateLesson(editingLesson.secId, editingLesson.lesson.id, editingLesson.lesson);
    setEditingLesson(null);
  };

  // ─── Save (UPDATE course + upsert sections/lessons) ───────────
  const handleSave = async (newStatus: 'draft' | 'published') => {
    if (!user || !title.trim()) return;
    setSaving(true);
    const supabase = createClient();

    // 1. Update course meta
    await supabase.from('courses').update({
      title: title.trim(),
      description: description.trim() || null,
      short_desc: shortDesc.trim() || null,
      difficulty,
      tags,
      status: newStatus,
      xp_reward: xpReward,
      estimated_minutes: estMins,
      thumbnail_url: thumbnail.trim() || null,
    }).eq('id', courseId);

    // 2. Track which section/lesson IDs remain (to delete removed ones)
    const keptSectionIds = sections.filter(s => s.dbId).map(s => s.dbId!);
    const keptLessonIds  = sections.flatMap(s => s.lessons.filter(l => l.dbId).map(l => l.dbId!));

    // Delete removed lessons + sections
    const allOldSections = await supabase.from('course_sections').select('id').eq('course_id', courseId);
    const oldSectionIds  = (allOldSections.data || []).map((s: { id: string }) => s.id);
    const toDeleteSecs   = oldSectionIds.filter(id => !keptSectionIds.includes(id));
    if (toDeleteSecs.length) {
      await supabase.from('course_lessons').delete().in('section_id', toDeleteSecs);
      await supabase.from('course_sections').delete().in('id', toDeleteSecs);
    }

    if (keptLessonIds.length) {
      const allOldLessons = await supabase.from('course_lessons').select('id').eq('course_id', courseId);
      const oldLessonIds  = (allOldLessons.data || []).map((l: { id: string }) => l.id);
      const toDeleteLes   = oldLessonIds.filter((id: string) => !keptLessonIds.includes(id));
      if (toDeleteLes.length) await supabase.from('course_lessons').delete().in('id', toDeleteLes);
    }

    // 3. Upsert sections + lessons
    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si];
      let secId = sec.dbId;

      if (sec.dbId) {
        await supabase.from('course_sections').update({ title: sec.title, order_index: si }).eq('id', sec.dbId);
      } else {
        const { data } = await supabase.from('course_sections').insert({ course_id: courseId, title: sec.title, order_index: si }).select().single();
        secId = data?.id;
      }
      if (!secId) continue;

      for (let li = 0; li < sec.lessons.length; li++) {
        const l = sec.lessons[li];
        if (l.dbId) {
          await supabase.from('course_lessons').update({ title: l.title, order_index: li, lesson_type: l.lesson_type, content: l.content, xp_reward: l.xp_reward, is_required: l.is_required }).eq('id', l.dbId);
        } else {
          await supabase.from('course_lessons').insert({ course_id: courseId, section_id: secId, title: l.title, order_index: li, lesson_type: l.lesson_type, content: l.content, xp_reward: l.xp_reward, is_required: l.is_required });
        }
      }
    }

    setSaving(false);
    router.push(`/community/courses/${courseId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#070710' }}>
        <div className="w-8 h-8 border-2 border-[#FF5F1F]/30 border-t-[#FF5F1F] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#070710', color: '#fff' }}>
      {/* Page sub-nav */}
      <div className="sticky top-14 z-30 backdrop-blur-xl border-b border-white/[0.07]" style={{ background: 'rgba(7,7,16,0.95)' }}>
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-4 h-12">
          <Link href={`/community/courses/${courseId}`} className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors uppercase tracking-wider">← Back</Link>
          <span className="text-white/10">|</span>
          <h1 className="text-sm font-bold text-white truncate">{title || 'Edit Course'}</h1>

          <div className="flex items-center gap-1 ml-auto">
            {(['meta','build'] as const).map((s, i) => (
              <button key={s} onClick={() => setStep(s)}
                className={cn('flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all', step === s ? 'bg-[#FF5F1F] text-white' : 'text-white/40 hover:text-white/60')}>
                <span className="w-3.5 h-3.5 rounded-full bg-current/20 flex items-center justify-center text-[9px]">{i+1}</span>
                {s === 'meta' ? 'Details' : 'Build'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {step === 'meta' ? (
          // ── Step 1: metadata ─────────────────────────────────
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-2xl font-black text-white mb-1" style={{ letterSpacing: '-0.02em' }}>Course Details</h2>
              <p className="text-sm text-white/40">Update the information about your course.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Course title…"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-base font-semibold text-white px-4 py-3 outline-none focus:border-[#FF5F1F]/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Short Description</label>
                <input value={shortDesc} onChange={e => setShortDesc(e.target.value)} maxLength={100}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white px-4 py-2.5 outline-none focus:border-white/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Full Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-3 outline-none focus:border-white/30 resize-none" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Difficulty</label>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value as CourseDifficulty)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white px-3 py-2.5 outline-none">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">XP Reward</label>
                  <input type="number" value={xpReward} onChange={e => setXpReward(+e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white px-3 py-2.5 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Est. Minutes</label>
                  <input type="number" value={estMins} onChange={e => setEstMins(+e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white px-3 py-2.5 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Tags</label>
                <div className="flex gap-2 mb-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { setTags(t => [...t, tagInput.trim()]); setTagInput(''); e.preventDefault(); } }}
                    placeholder="Add tag + Enter"
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-3 py-2 outline-none" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(t => (
                    <span key={t} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-white/5 text-white/50 rounded border border-white/10">
                      {t}<button onClick={() => setTags(prev => prev.filter(k => k !== t))} className="hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Thumbnail URL</label>
                <input value={thumbnail} onChange={e => setThumbnail(e.target.value)} placeholder="https://…"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/80 px-4 py-2.5 outline-none" />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => setStep('build')} disabled={!title.trim()}
                className="px-6 py-3 rounded-xl font-semibold text-sm bg-[#FF5F1F] text-white hover:bg-[#E54E15] transition-colors disabled:opacity-40">
                Continue to Builder →
              </button>
            </div>
          </div>
        ) : (
          // ── Step 2: Section + Lesson builder ────────────────────
          <div className="space-y-5">
            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-black text-white mb-0.5" style={{ letterSpacing: '-0.02em' }}>{title}</h2>
                <div className="flex items-center gap-3 text-xs">
                  <span className={cn('px-2 py-0.5 rounded border font-medium uppercase tracking-wider', status === 'published' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-white/15 text-white/40')}>
                    {status}
                  </span>
                  <span className="text-white/30">{sections.reduce((n, s) => n + s.lessons.length, 0)} lessons</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleSave('draft')} disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] text-white/70 hover:bg-white/10 transition-colors disabled:opacity-40">
                  Save Draft
                </button>
                <button onClick={() => handleSave('published')} disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF5F1F] text-white hover:bg-[#E54E15] transition-colors disabled:opacity-40">
                  {saving ? 'Saving…' : 'Save & Publish'}
                </button>
              </div>
            </div>

            {sections.map((sec, si) => (
              <div key={sec.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
                  <span className="w-5 h-5 rounded-full bg-[#FF5F1F]/20 text-[#FF5F1F] text-[10px] font-bold flex items-center justify-center shrink-0">{si+1}</span>
                  <input value={sec.title} onChange={e => updateSection(sec.id, { title: e.target.value })}
                    className="flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder-white/20" placeholder="Section Title" />
                  <button onClick={() => removeSection(sec.id)} className="text-xs text-red-400/50 hover:text-red-400 transition-colors">Remove</button>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {sec.lessons.map(lesson => (
                    <div key={lesson.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-sm">{LESSON_TYPES.find(t => t.value === lesson.lesson_type)?.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white/80 block truncate">{lesson.title}</span>
                        <span className="text-[10px] text-white/30">{LESSON_TYPES.find(t => t.value === lesson.lesson_type)?.label} · {lesson.xp_reward} XP</span>
                      </div>
                      <button onClick={() => setEditingLesson({ secId: sec.id, lesson: { ...lesson } })}
                        className="text-xs text-white/40 hover:text-white/80 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors">Edit</button>
                      <button onClick={() => removeLesson(sec.id, lesson.id)} className="text-xs text-red-400/50 hover:text-red-400 transition-colors">×</button>
                    </div>
                  ))}
                </div>
                <div className="p-3">
                  <button onClick={() => addLesson(sec.id)}
                    className="w-full py-2 text-xs text-white/40 hover:text-white/70 border border-dashed border-white/10 hover:border-white/25 rounded-xl transition-all flex items-center gap-1.5 justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    Add Lesson
                  </button>
                </div>
              </div>
            ))}

            <button onClick={addSection}
              className="w-full py-4 text-sm text-white/40 hover:text-white/70 border-2 border-dashed border-white/10 hover:border-white/25 rounded-2xl transition-all flex items-center gap-2 justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Add Section
            </button>
          </div>
        )}
      </div>

      {/* ── Lesson editor modal ── */}
      {editingLesson && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
          <div className="w-full sm:max-w-2xl bg-[#0E0E1C] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#0E0E1C] z-10">
              <h3 className="text-sm font-bold text-white">Edit Lesson</h3>
              <button onClick={() => setEditingLesson(null)} className="text-white/40 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-white/50 mb-1">Title *</label>
                  <input value={editingLesson.lesson.title}
                    onChange={e => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, title: e.target.value } } : null)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm font-semibold text-white px-4 py-2.5 outline-none focus:border-white/30" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">XP Reward</label>
                  <input type="number" value={editingLesson.lesson.xp_reward}
                    onChange={e => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, xp_reward: +e.target.value } } : null)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white px-3 py-2.5 outline-none" />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                    <input type="checkbox" checked={editingLesson.lesson.is_required}
                      onChange={e => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, is_required: e.target.checked } } : null)}
                      className="w-4 h-4 accent-[#FF5F1F]" />
                    Required
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Lesson Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LESSON_TYPES.map(opt => (
                    <button key={opt.value}
                      onClick={() => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, lesson_type: opt.value, content: defaultContent(opt.value) } } : null)}
                      className={cn('flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all', editingLesson.lesson.lesson_type === opt.value ? 'border-[#FF5F1F]/40 bg-[#FF5F1F]/10' : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20')}>
                      <span className="text-lg leading-none">{opt.icon}</span>
                      <div>
                        <div className="text-xs font-semibold text-white">{opt.label}</div>
                        <div className="text-[10px] text-white/40 leading-snug">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Content</label>
                <LessonContentForm
                  type={editingLesson.lesson.lesson_type}
                  value={editingLesson.lesson.content}
                  onChange={v => setEditingLesson(el => el ? { ...el, lesson: { ...el.lesson, content: v } } : null)}
                />
              </div>
            </div>
            <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06] bg-[#0E0E1C]">
              <button onClick={() => setEditingLesson(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white">Cancel</button>
              <button onClick={saveEditLesson} className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#FF5F1F] text-white hover:bg-[#E54E15]">Save Lesson</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
