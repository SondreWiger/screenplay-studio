'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn, timeAgo } from '@/lib/utils';
import type { Course, CourseEnrollment, CourseDifficulty } from '@/lib/types';

// ============================================================
// Community Courses — catalog page
// ============================================================

const DIFFICULTY_COLOR: Record<CourseDifficulty, { bg: string; text: string; label: string }> = {
  beginner:     { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Beginner' },
  intermediate: { bg: 'bg-amber-500/10',   text: 'text-amber-400',   label: 'Intermediate' },
  advanced:     { bg: 'bg-red-500/10',     text: 'text-red-400',     label: 'Advanced' },
};

function StarRating({ rating, small }: { rating: number; small?: boolean }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <div className={cn('flex items-center gap-0.5', small ? 'text-xs' : 'text-sm')}>
      {[1,2,3,4,5].map(i => (
        <span key={i} className={i <= full ? 'text-amber-400' : (i === full + 1 && half ? 'text-amber-400/50' : 'text-white/20')}>★</span>
      ))}
    </div>
  );
}

function CourseCard({
  course,
  enrollment,
  onEnroll,
}: {
  course: Course & { creator?: { full_name: string | null; username: string | null } };
  enrollment?: CourseEnrollment;
  onEnroll: (id: string) => void;
}) {
  const diff = DIFFICULTY_COLOR[course.difficulty];
  const rating = course.rating_count > 0 ? course.rating_sum / course.rating_count : 0;
  const pct = enrollment?.progress_percent ?? 0;
  const done = enrollment?.completed_at != null;

  return (
    <div className={cn(
      'group relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-200',
      'bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.07]',
      done && 'border-emerald-500/30',
    )}>
      {/* Thumbnail / header */}
      <div className="relative h-36 bg-gradient-to-br from-surface-800 to-surface-900 overflow-hidden">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl opacity-20">
              {course.type === 'system' ? '🎓' : '📚'}
            </span>
          </div>
        )}
        {/* Overlays */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {course.type === 'system' && (
            <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[#FF5F1F] text-white rounded-full">Official</span>
          )}
          <span className={cn('px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full', diff.bg, diff.text)}>
            {diff.label}
          </span>
        </div>
        {done && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
        )}
        {/* Progress bar */}
        {enrollment && !done && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div className="h-full bg-[#FF5F1F] transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Title */}
        <div>
          <h3 className="font-bold text-white text-sm leading-snug mb-1 line-clamp-2">{course.title}</h3>
          <p className="text-xs text-white/50 line-clamp-2">{course.short_desc || course.description}</p>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {course.estimated_minutes}m
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            {course.enrollment_count}
          </span>
          {rating > 0 && (
            <span className="flex items-center gap-0.5">
              <StarRating rating={rating} small />
              <span className="ml-0.5">({course.rating_count})</span>
            </span>
          )}
        </div>

        {/* Tags */}
        {course.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {course.tags.slice(0, 3).map(t => (
              <span key={t} className="px-1.5 py-0.5 text-[9px] font-medium bg-white/5 text-white/40 rounded">{t}</span>
            ))}
          </div>
        )}

        {/* XP + creator */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
          <span className="text-xs font-semibold text-[#FF5F1F]">+{course.xp_reward} XP</span>
          {course.type === 'user' && course.creator && (
            <Link href={`/u/${course.creator.username || ''}`} className="text-[10px] text-white/30 hover:text-white/60 transition-colors">
              by {course.creator.full_name || 'Anonymous'}
            </Link>
          )}
        </div>

        {/* CTA */}
        {enrollment ? (
          <Link
            href={`/community/courses/${course.id}`}
            className="block text-center py-2 rounded-xl text-xs font-semibold transition-all bg-[#FF5F1F]/10 text-[#FF5F1F] hover:bg-[#FF5F1F]/20"
          >
            {done ? 'Review Course' : `Continue — ${pct}%`}
          </Link>
        ) : (
          <button
            onClick={() => onEnroll(course.id)}
            className="w-full py-2 rounded-xl text-xs font-semibold transition-all bg-white/5 text-white/70 hover:bg-[#FF5F1F]/10 hover:text-[#FF5F1F]"
          >
            Start Course
          </button>
        )}
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Map<string, CourseEnrollment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'enrolled' | 'system' | 'user'>('all');
  const [difficulty, setDifficulty] = useState<'all' | CourseDifficulty>('all');
  const [userLevel, setUserLevel] = useState(0);

  useEffect(() => { load(); }, [user]);

  const load = async () => {
    const supabase = createClient();
    const [coursesRes, enrollRes, levelRes] = await Promise.all([
      supabase
        .from('courses')
        .select('*, creator:profiles!creator_id(full_name,username)')
        .eq('status', 'published')
        .order('type', { ascending: true }) // system first
        .order('created_at', { ascending: false }),
      user
        ? supabase.from('course_enrollments').select('*').eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
      user
        ? supabase.from('user_gamification').select('level').eq('user_id', user.id).single()
        : Promise.resolve({ data: null }),
    ]);

    setCourses((coursesRes.data as Course[]) || []);
    const map = new Map<string, CourseEnrollment>();
    (enrollRes.data || []).forEach((e: CourseEnrollment) => map.set(e.course_id, e));
    setEnrollments(map);
    if (levelRes.data) setUserLevel((levelRes.data as any).level ?? 0);
    setLoading(false);
  };

  const handleEnroll = async (courseId: string) => {
    if (!user) { router.push('/auth/login?redirect=/community/courses'); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from('course_enrollments')
      .insert({ user_id: user.id, course_id: courseId })
      .select()
      .single();
    if (data) {
      setEnrollments(prev => new Map(prev).set(courseId, data as CourseEnrollment));
      router.push(`/community/courses/${courseId}`);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    try { sessionStorage.removeItem('ss_session_active'); } catch {}
    await supabase.auth.signOut();
    router.refresh();
  };

  const canCreate = user && (userLevel >= 10 || user.role === 'admin' || user.role === 'moderator');

  const filtered = courses.filter(c => {
    if (filter === 'enrolled' && !enrollments.has(c.id)) return false;
    if (filter === 'system' && c.type !== 'system') return false;
    if (filter === 'user' && c.type !== 'user') return false;
    if (difficulty !== 'all' && c.difficulty !== difficulty) return false;
    return true;
  });

  const systemCourses = filtered.filter(c => c.type === 'system');
  const userCourses   = filtered.filter(c => c.type === 'user');

  const completedCount = Array.from(enrollments.values()).filter(e => e.completed_at).length;
  const enrolledCount  = enrollments.size;

  return (
    <div className="min-h-screen" style={{ background: '#070710', color: '#fff' }}>
      {/* Dot-grid texture */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.12]"
        style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.4) 1px,transparent 1px)', backgroundSize: '32px 32px' }}
      />



      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-3 h-px shrink-0" style={{ background: '#FF5F1F' }} />
              <span className="text-[10px] font-bold text-[#FF5F1F] uppercase tracking-widest font-mono">Community</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white" style={{ letterSpacing: '-0.03em' }}>
              SCREENWRITING<br />COURSES
            </h1>
            <p className="text-white/50 text-sm mt-2 max-w-md">
              Structured learning paths for every stage — from strict formatting rules to unlocking your creative voice.
            </p>
          </div>

          {/* User stats */}
          {user && enrolledCount > 0 && (
            <div className="flex items-center gap-4 text-center">
              <div className="px-5 py-3 bg-white/[0.04] rounded-2xl border border-white/[0.08]">
                <div className="text-2xl font-black text-white">{enrolledCount}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Enrolled</div>
              </div>
              <div className="px-5 py-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/20">
                <div className="text-2xl font-black text-emerald-400">{completedCount}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Completed</div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          {/* Type */}
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1 border border-white/[0.08]">
            {([['all','All'],['system','Official'],['user','Community'],['enrolled','My Courses']] as const).map(([v,label]) => (
              <button key={v} onClick={() => setFilter(v as any)}
                className={cn('px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-lg transition-all',
                  filter === v ? 'bg-[#FF5F1F] text-white' : 'text-white/40 hover:text-white/70'
                )}>
                {label}
              </button>
            ))}
          </div>
          {/* Difficulty */}
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1 border border-white/[0.08]">
            {([['all','All'],['beginner','Beginner'],['intermediate','Intermediate'],['advanced','Advanced']] as const).map(([v,label]) => (
              <button key={v} onClick={() => setDifficulty(v as any)}
                className={cn('px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-lg transition-all',
                  difficulty === v ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                )}>
                {label}
              </button>
            ))}
          </div>

          {canCreate && (
            <Link href="/community/courses/create"
              className="ml-auto flex items-center gap-1.5 px-4 py-2 text-[10px] font-mono uppercase tracking-wider bg-[#FF5F1F]/10 text-[#FF5F1F] border border-[#FF5F1F]/30 rounded-xl hover:bg-[#FF5F1F]/20 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Create Course
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_,i) => <div key={i} className="h-72 rounded-2xl bg-white/[0.04] animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-12">
            {/* Official courses */}
            {systemCourses.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-base">🎓</span>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Official Courses</h2>
                  <div className="flex-1 h-px bg-white/[0.08]" />
                  <span className="text-xs text-white/30">{systemCourses.length} courses</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {systemCourses.map(c => (
                    <CourseCard key={c.id} course={c} enrollment={enrollments.get(c.id)} onEnroll={handleEnroll} />
                  ))}
                </div>
              </section>
            )}

            {/* Community courses */}
            {userCourses.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-base">📚</span>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Community Courses</h2>
                  <div className="flex-1 h-px bg-white/[0.08]" />
                  <span className="text-xs text-white/30">{userCourses.length} courses</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {userCourses.map(c => (
                    <CourseCard key={c.id} course={c} enrollment={enrollments.get(c.id)} onEnroll={handleEnroll} />
                  ))}
                </div>
              </section>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-24">
                <div className="text-5xl mb-4">📖</div>
                <p className="text-white/40">No courses found for this filter.</p>
                {!user && <Link href="/auth/register" className="mt-4 inline-block text-sm text-[#FF5F1F] hover:underline">Sign up to create one →</Link>}
              </div>
            )}

            {/* CTA for eligible non-creators */}
            {user && !canCreate && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
                <div className="text-3xl mb-3">✍️</div>
                <h3 className="text-base font-bold text-white mb-1">Want to create a course?</h3>
                <p className="text-sm text-white/40 max-w-sm mx-auto">
                  Reach <span className="text-white/70 font-semibold">Level 10</span> to unlock course creation. You're at Level {userLevel}.
                </p>
                <div className="mt-4 h-2 max-w-xs mx-auto bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#FF5F1F] rounded-full transition-all" style={{ width: `${Math.min((userLevel / 10) * 100, 100)}%` }} />
                </div>
                <p className="text-[11px] text-white/30 mt-2">{userLevel} / 10</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
