'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Input, Textarea, Modal, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/components/TranslationProvider';
import type { OrgClass, OrgClassAssignment, OrgClassSubmission, OrgPeerReview } from '@/lib/types';

interface Props {
  companyId: string;
  userId: string;
  canManage: boolean;
}

type Tab = 'classes' | 'assignments' | 'submissions';

export function OrgEducation({ companyId, userId, canManage }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('classes');
  const [classes, setClasses] = useState<OrgClass[]>([]);
  const [assignments, setAssignments] = useState<OrgClassAssignment[]>([]);
  const [submissions, setSubmissions] = useState<OrgClassSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [peerReviews, setPeerReviews] = useState<OrgPeerReview[]>([]);

  const [classForm, setClassForm] = useState({ name: '', description: '' });
  const [assignmentForm, setAssignmentForm] = useState({
    class_id: '', title: '', description: '', due_date: '',
    max_points: 100, peer_review_enabled: true, peer_reviews_required: 2,
  });
  const [reviewForm, setReviewForm] = useState({ feedback: '', score: '' });

  const supabase = createClient();

  const load = useCallback(async () => {
    const [cRes, aRes, sRes] = await Promise.all([
      supabase.from('org_classes').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('org_class_assignments').select('*, class:org_classes!inner(company_id)').eq('class.company_id', companyId).order('due_date'),
      supabase.from('org_class_submissions').select('*, assignment:org_class_assignments!inner(class:org_classes!inner(company_id))').eq('assignment.class.company_id', companyId).order('submitted_at', { ascending: false }),
    ]);
    setClasses(cRes.data || []);
    setAssignments(aRes.data || []);
    setSubmissions(sRes.data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const loadPeerReviews = async (submissionId: string) => {
    const { data } = await supabase.from('org_peer_reviews').select('*').eq('submission_id', submissionId).order('created_at');
    setPeerReviews(data || []);
  };

  const createClass = async () => {
    if (!classForm.name.trim()) { toast.error('Class name required'); return; }
    const { error } = await supabase.from('org_classes').insert({
      company_id: companyId, instructor_id: userId,
      name: classForm.name.trim(), description: classForm.description.trim() || null,
    });
    if (error) { toast.error('Failed to create class'); return; }
    setShowCreateClass(false);
    setClassForm({ name: '', description: '' });
    load();
    toast.success('Class created!');
  };

  const createAssignment = async () => {
    if (!assignmentForm.title.trim() || !assignmentForm.class_id) { toast.error('Title and class required'); return; }
    const { error } = await supabase.from('org_class_assignments').insert({
      class_id: assignmentForm.class_id,
      title: assignmentForm.title.trim(), description: assignmentForm.description.trim() || null,
      due_date: assignmentForm.due_date ? new Date(assignmentForm.due_date).toISOString() : null,
      max_points: assignmentForm.max_points, peer_review_enabled: assignmentForm.peer_review_enabled,
      peer_reviews_required: assignmentForm.peer_reviews_required,
    });
    if (error) { toast.error('Failed to create assignment'); return; }
    setShowCreateAssignment(false);
    setAssignmentForm({ class_id: '', title: '', description: '', due_date: '', max_points: 100, peer_review_enabled: true, peer_reviews_required: 2 });
    load();
    toast.success('Assignment created!');
  };

  const submitWork = async (assignmentId: string, content: string) => {
    if (!content.trim()) return;
    const { error } = await supabase.from('org_class_submissions').insert({
      assignment_id: assignmentId, student_id: userId, content: content.trim(),
    });
    if (error) { toast.error('Failed to submit'); return; }
    load();
    toast.success('Submitted!');
  };

  const gradeSubmission = async (id: string, grade: number, feedback: string) => {
    await supabase.from('org_class_submissions').update({
      grade, feedback: feedback || null, graded_at: new Date().toISOString(), graded_by: userId,
    }).eq('id', id);
    load();
    toast.success('Graded!');
  };

  const submitPeerReview = async (submissionId: string) => {
    if (!reviewForm.feedback.trim()) { toast.error('Feedback required'); return; }
    await supabase.from('org_peer_reviews').insert({
      submission_id: submissionId, reviewer_id: userId,
      overall_comment: reviewForm.feedback.trim(), rating: reviewForm.score ? parseInt(reviewForm.score) : null,
    });
    setReviewForm({ feedback: '', score: '' });
    loadPeerReviews(submissionId);
    toast.success('Review submitted!');
  };

  const joinClass = async (classId: string) => {
    const { error } = await supabase.from('org_class_students').insert({ class_id: classId, student_id: userId });
    if (error?.code === '23505') { toast.error('Already enrolled'); return; }
    if (error) { toast.error('Failed to join'); return; }
    toast.success('Enrolled!');
  };

  const toggleArchiveClass = async (id: string, isActive: boolean) => {
    await supabase.from('org_classes').update({ is_active: !isActive }).eq('id', id);
    load();
  };

  if (loading) return <div className="text-center py-12 text-surface-500">Loading education...</div>;

  const activeClasses = classes.filter(c => c.is_active);
  const filteredAssignments = selectedClass ? assignments.filter(a => a.class_id === selectedClass) : assignments;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Education Mode</h2>
        <div className="flex gap-2">
          {canManage && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setShowCreateClass(true)}>+ Class</Button>
              <Button size="sm" onClick={() => setShowCreateAssignment(true)}>+ Assignment</Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-800 rounded-lg w-fit">
        {(['classes', 'assignments', 'submissions'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm rounded-lg capitalize', tab === t ? 'bg-brand-500 text-white' : 'text-surface-400')}>
            {t}
          </button>
        ))}
      </div>

      {/* Classes Tab */}
      {tab === 'classes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeClasses.length === 0 && <Card className="p-8 text-center text-surface-500 col-span-full">No classes yet</Card>}
          {activeClasses.map(cls => (
            <Card key={cls.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-white">{cls.name}</h3>
                </div>
                {canManage && (
                  <button onClick={() => toggleArchiveClass(cls.id, cls.is_active)} className="text-xs text-surface-600 hover:text-white">
                    {cls.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </div>
              {cls.description && <p className="text-sm text-surface-400 mb-3">{cls.description}</p>}
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setSelectedClass(cls.id); setTab('assignments'); }}>
                  View Assignments
                </Button>
                <Button size="sm" variant="ghost" onClick={() => joinClass(cls.id)}>Enroll</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Assignments Tab */}
      {tab === 'assignments' && (
        <div className="space-y-4">
          {selectedClass && (
            <button onClick={() => setSelectedClass(null)} className="text-xs text-brand-500 hover:underline">← All assignments</button>
          )}
          {filteredAssignments.length === 0 && <Card className="p-8 text-center text-surface-500">No assignments</Card>}
          {filteredAssignments.map(a => {
            const mySubmission = submissions.find(s => s.assignment_id === a.id && s.student_id === userId);
            const allSubs = submissions.filter(s => s.assignment_id === a.id);
            const overdue = a.due_date && new Date(a.due_date) < new Date();
            return (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{a.title}</h3>
                      {a.due_date && (
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full', overdue ? 'bg-red-500/20 text-red-400' : 'bg-surface-800 text-surface-500')}>
                          Due: {new Date(a.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <span className="text-[10px] text-surface-600">{a.max_points} pts</span>
                    </div>
                    {a.description && <p className="text-sm text-surface-400 mb-2">{a.description}</p>}
                    <div className="flex gap-3 text-xs text-surface-500">
                      <span>{allSubs.length} submission{allSubs.length !== 1 ? 's' : ''}</span>
                      {a.peer_review_enabled && <span>🔄 Peer review: {a.peer_reviews_required} required</span>}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {mySubmission ? (
                      <span className={cn('text-xs px-3 py-1 rounded-full', mySubmission.grade != null ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400')}>
                        {mySubmission.grade != null ? `${mySubmission.grade}/${a.max_points}` : 'Submitted'}
                      </span>
                    ) : (
                      <SubmitWorkInline assignmentId={a.id} onSubmit={submitWork} />
                    )}
                  </div>
                </div>

                {/* Manager: grade submissions */}
                {canManage && allSubs.length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-surface-800 pt-3">
                    <h4 className="text-xs font-semibold text-surface-500 uppercase">Submissions</h4>
                    {allSubs.map(sub => (
                      <div key={sub.id} className="bg-surface-900 rounded p-3">
                        <p className="text-sm text-surface-300 whitespace-pre-wrap line-clamp-4">{sub.content}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-surface-600">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'Not submitted'}</span>
                          {sub.grade != null ? (
                            <span className="text-xs text-green-400">{sub.grade}/{a.max_points}</span>
                          ) : (
                            <GradeInline maxPoints={a.max_points} onGrade={(g, f) => gradeSubmission(sub.id, g, f)} />
                          )}
                          <button onClick={() => { setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id); loadPeerReviews(sub.id); }}
                            className="text-[10px] text-brand-500 hover:underline ml-auto">
                            {expandedSubmission === sub.id ? 'Hide reviews' : 'Peer reviews'}
                          </button>
                        </div>
                        {expandedSubmission === sub.id && (
                          <div className="mt-3 space-y-2">
                            {peerReviews.length === 0 && <p className="text-xs text-surface-600">No peer reviews yet</p>}
                            {peerReviews.map(pr => (
                              <div key={pr.id} className="bg-surface-800 rounded p-2 text-xs text-surface-400">
                                <p>{pr.overall_comment}</p>
                                {pr.rating != null && <span className="text-surface-500">Rating: {pr.rating}</span>}
                              </div>
                            ))}
                            {sub.student_id !== userId && (
                              <div className="flex gap-2 items-end">
                                <Input value={reviewForm.feedback} onChange={e => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                                  placeholder="Write peer feedback..." className="flex-1 text-xs" />
                                <Input value={reviewForm.score} onChange={e => setReviewForm({ ...reviewForm, score: e.target.value })}
                                  placeholder="Rating" type="number" className="w-20 text-xs" />
                                <Button size="sm" variant="secondary" onClick={() => submitPeerReview(sub.id)}>Review</Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Submissions Tab (student view) */}
      {tab === 'submissions' && (
        <div className="space-y-4">
          {submissions.filter(s => s.student_id === userId).length === 0 && (
            <Card className="p-8 text-center text-surface-500">You haven&apos;t submitted any work yet</Card>
          )}
          {submissions.filter(s => s.student_id === userId).map(sub => {
            const assignment = assignments.find(a => a.id === sub.assignment_id);
            return (
              <Card key={sub.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">{assignment?.title || 'Assignment'}</h4>
                  {sub.grade != null ? (
                    <span className="text-sm text-green-400 font-semibold">{sub.grade}/{assignment?.max_points || 100}</span>
                  ) : (
                    <span className="text-xs text-blue-400">Pending grade</span>
                  )}
                </div>
                <p className="text-sm text-surface-400 line-clamp-3">{sub.content}</p>
                {sub.feedback && (
                  <div className="mt-2 bg-surface-900 rounded p-2">
                    <span className="text-[10px] text-surface-500 font-semibold">Feedback:</span>
                    <p className="text-xs text-surface-300">{sub.feedback}</p>
                  </div>
                )}
                <span className="text-[10px] text-surface-600 mt-2 block">Submitted: {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'Not submitted'}</span>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Class Modal */}
      <Modal isOpen={showCreateClass} onClose={() => setShowCreateClass(false)} title="Create Class">
        <div className="space-y-4">
          <Input label="Class Name *" value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })} />
          <Textarea label="Description" value={classForm.description} onChange={e => setClassForm({ ...classForm, description: e.target.value })} />
          <Button onClick={createClass} disabled={!classForm.name.trim()}>Create Class</Button>
        </div>
      </Modal>

      {/* Create Assignment Modal */}
      <Modal isOpen={showCreateAssignment} onClose={() => setShowCreateAssignment(false)} title="Create Assignment">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-surface-400 mb-1 block">Class *</label>
            <select value={assignmentForm.class_id} onChange={e => setAssignmentForm({ ...assignmentForm, class_id: e.target.value })}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">Select a class</option>
              {activeClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Title *" value={assignmentForm.title} onChange={e => setAssignmentForm({ ...assignmentForm, title: e.target.value })} />
          <Textarea label="Description" value={assignmentForm.description} onChange={e => setAssignmentForm({ ...assignmentForm, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Due Date" type="datetime-local" value={assignmentForm.due_date} onChange={e => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })} />
            <Input label="Max Points" type="number" value={String(assignmentForm.max_points)} onChange={e => setAssignmentForm({ ...assignmentForm, max_points: parseInt(e.target.value) || 100 })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-surface-400 cursor-pointer">
            <input type="checkbox" checked={assignmentForm.peer_review_enabled}
              onChange={e => setAssignmentForm({ ...assignmentForm, peer_review_enabled: e.target.checked })} className="rounded border-surface-700" />
            Allow peer review
          </label>
          {assignmentForm.peer_review_enabled && (
            <Input label="Peer reviews required" type="number" value={String(assignmentForm.peer_reviews_required)}
              onChange={e => setAssignmentForm({ ...assignmentForm, peer_reviews_required: parseInt(e.target.value) || 2 })} />
          )}
          <Button onClick={createAssignment} disabled={!assignmentForm.title.trim() || !assignmentForm.class_id}>Create Assignment</Button>
        </div>
      </Modal>
    </div>
  );
}

// Inline submit component
function SubmitWorkInline({ assignmentId, onSubmit }: { assignmentId: string; onSubmit: (id: string, content: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Submit Work</Button>;
  return (
    <div className="flex gap-2 items-end">
      <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Your submission..." rows={2} className="text-xs min-w-[200px]" />
      <div className="flex flex-col gap-1">
        <Button size="sm" onClick={() => { onSubmit(assignmentId, content); setOpen(false); setContent(''); }} disabled={!content.trim()}>Send</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
      </div>
    </div>
  );
}

// Inline grading component
function GradeInline({ maxPoints, onGrade }: { maxPoints: number; onGrade: (grade: number, feedback: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  if (!open) return <button onClick={() => setOpen(true)} className="text-[10px] text-brand-500 hover:underline">Grade</button>;
  return (
    <div className="flex gap-2 items-end">
      <Input value={grade} onChange={e => setGrade(e.target.value)} type="number" placeholder={`/ ${maxPoints}`} className="w-20 text-xs" />
      <Input value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Feedback..." className="flex-1 text-xs" />
      <Button size="sm" onClick={() => { onGrade(parseInt(grade) || 0, feedback); setOpen(false); }} disabled={!grade}>{t('common.save')}</Button>
    </div>
  );
}
