'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fillEmails } from '@/lib/private-profile';

export function CoursesAdminTab() {
  const supabase = createClient();
  type CourseRow = {
    id: string; title: string; difficulty: string; status: string;
    enrollment_count: number; created_at: string;
    creator: { full_name: string | null; email: string } | null;
  };
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('courses')
      .select('id,title,difficulty,status,enrollment_count,created_at,creator:profiles!courses_creator_id_fkey(id,full_name,email)')
      .order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    await fillEmails(supabase, (data || []).map((c: { creator?: { id?: string; email?: string | null } | null }) => c.creator));
    setCourses((data as unknown as CourseRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const setStatus = async (id: string, status: 'published' | 'rejected') => {
    await supabase.from('courses').update({ status }).eq('id', id);
    setCourses(cs => cs.map(c => c.id === id ? { ...c, status } : c));
  };

  const deleteCourse = async (id: string) => {
    if (!confirm('Delete this course permanently?')) return;
    await supabase.from('course_lessons').delete().eq('course_id', id);
    await supabase.from('course_sections').delete().eq('course_id', id);
    await supabase.from('courses').delete().eq('id', id);
    setCourses(cs => cs.filter(c => c.id !== id));
  };

  const DIFF_COLOR: Record<string, string> = {
    beginner: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    intermediate: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    advanced: 'text-red-400 bg-red-500/10 border-red-500/20',
  };
  const STATUS_COLOR: Record<string, string> = {
    pending: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    published: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rejected: 'text-red-400 bg-red-500/10 border-red-500/20',
    draft: 'text-white/40 bg-white/5 border-white/10',
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Course Moderation</h2>
          <p className="text-sm text-surface-400 mt-0.5">Review and manage community-submitted courses</p>
        </div>
        <div className="flex items-center gap-1.5 bg-surface-900 border border-surface-800 rounded-xl p-1">
          {(['pending','published','rejected','all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter === f ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-white'
              }`}>{f}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 text-surface-400 text-sm">No {filter === 'all' ? '' : filter} courses.</div>
      ) : (
        <div className="space-y-2">
          {courses.map(c => (
            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-surface-900 border border-surface-800 hover:border-surface-700 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white truncate">{c.title}</span>
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-[0.04em] ${DIFF_COLOR[c.difficulty] ?? ''}`}>{c.difficulty}</span>
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-[0.04em] ${STATUS_COLOR[c.status] ?? ''}`}>{c.status}</span>
                </div>
                <div className="text-xs text-surface-500 mt-0.5">
                  by {c.creator?.full_name || c.creator?.email || 'Unknown'} &middot; {c.enrollment_count} enrolled &middot; {new Date(c.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`/community/courses/${c.id}`} target="_blank" rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors">View</a>
                <a href={`/community/courses/${c.id}/edit`} target="_blank" rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors">Edit</a>
                {c.status !== 'published' && (
                  <button onClick={() => setStatus(c.id, 'published')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors">Approve</button>
                )}
                {c.status !== 'rejected' && (
                  <button onClick={() => setStatus(c.id, 'rejected')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20 transition-colors">Reject</button>
                )}
                <button onClick={() => deleteCourse(c.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CoursesAdminTab;
