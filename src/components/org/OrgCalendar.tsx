'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, Input, Textarea, Modal, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { OrgCalendarEvent, Project } from '@/lib/types';

interface Props {
  companyId: string;
  userId: string;
  canManage: boolean;
}

const EVENT_ICONS: Record<string, string> = {
  milestone: '🏁', deadline: '⏰', meeting: '💬', table_read: '📖',
  shoot_day: '🎬', review: '👀', delivery: '📦', other: '📌',
};

export function OrgCalendar({ companyId, userId, canManage }: Props) {
  const [events, setEvents] = useState<OrgCalendarEvent[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [view, setView] = useState<'calendar' | 'list'>('list');

  const [form, setForm] = useState({
    title: '', description: '', event_type: 'meeting' as OrgCalendarEvent['event_type'],
    start_at: '', end_at: '', all_day: false, color: '#6366f1', project_id: '', location: '',
  });

  const supabase = createClient();

  const load = useCallback(async () => {
    const [evRes, pRes] = await Promise.all([
      supabase.from('org_calendar_events').select('*').eq('company_id', companyId).eq('is_cancelled', false).order('start_at'),
      supabase.from('projects').select('id, title').eq('company_id', companyId).order('title'),
    ]);
    setEvents(evRes.data || []);
    setProjects(pRes.data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const createEvent = async () => {
    if (!form.title.trim() || !form.start_at) { toast.error('Title and start date required'); return; }
    const { error } = await supabase.from('org_calendar_events').insert({
      company_id: companyId, created_by: userId, title: form.title.trim(),
      description: form.description.trim() || null, event_type: form.event_type,
      start_at: new Date(form.start_at).toISOString(),
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      all_day: form.all_day, color: form.color,
      project_id: form.project_id || null, location: form.location.trim() || null,
    });
    if (error) { toast.error('Failed to create event'); return; }
    setShowCreate(false);
    setForm({ title: '', description: '', event_type: 'meeting', start_at: '', end_at: '', all_day: false, color: '#6366f1', project_id: '', location: '' });
    load();
    toast.success('Event created!');
  };

  const cancelEvent = async (id: string) => {
    await supabase.from('org_calendar_events').update({ is_cancelled: true }).eq('id', id);
    load();
  };

  if (loading) return <div className="text-center py-12 text-surface-500">Loading calendar...</div>;

  const now = new Date();
  const upcoming = events.filter(e => new Date(e.start_at) >= now).slice(0, 20);
  const past = events.filter(e => new Date(e.start_at) < now).slice(-10).reverse();

  // Group events by date for list view
  const groupByDate = (evs: OrgCalendarEvent[]) => {
    const groups: Record<string, OrgCalendarEvent[]> = {};
    for (const e of evs) {
      const d = new Date(e.start_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      if (!groups[d]) groups[d] = [];
      groups[d].push(e);
    }
    return groups;
  };

  const upcomingGrouped = groupByDate(upcoming);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Calendar & Milestones</h2>
        <div className="flex gap-2">
          <div className="flex bg-surface-800 rounded-lg">
            <button onClick={() => setView('list')} className={cn('px-3 py-1.5 text-xs rounded-lg', view === 'list' ? 'bg-[#FF5F1F] text-white' : 'text-surface-400')}>List</button>
            <button onClick={() => setView('calendar')} className={cn('px-3 py-1.5 text-xs rounded-lg', view === 'calendar' ? 'bg-[#FF5F1F] text-white' : 'text-surface-400')}>Grid</button>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>+ New Event</Button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="space-y-6">
          {Object.keys(upcomingGrouped).length === 0 && (
            <Card className="p-8 text-center text-surface-500">No upcoming events</Card>
          )}
          {Object.entries(upcomingGrouped).map(([date, evs]) => (
            <div key={date}>
              <h3 className="text-xs font-semibold text-surface-500 mb-2 uppercase tracking-wider">{date}</h3>
              <div className="space-y-2">
                {evs.map(ev => (
                  <Card key={ev.id} className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: ev.color + '20' }}>
                      {EVENT_ICONS[ev.event_type] || '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white">{ev.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-surface-500 mt-0.5">
                        <span>{ev.all_day ? 'All day' : new Date(ev.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {ev.location && <span>📍 {ev.location}</span>}
                        <span className="text-surface-600">{ev.event_type.replace('_', ' ')}</span>
                      </div>
                    </div>
                    {(canManage || ev.created_by === userId) && (
                      <button onClick={() => cancelEvent(ev.id)} className="text-xs text-surface-600 hover:text-red-400">Cancel</button>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {past.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-surface-600 mb-2 uppercase tracking-wider">Past events</h3>
              <div className="space-y-2 opacity-50">
                {past.map(ev => (
                  <Card key={ev.id} className="p-3 flex items-center gap-3">
                    <span className="text-sm">{EVENT_ICONS[ev.event_type]}</span>
                    <span className="text-sm text-surface-400 line-through">{ev.title}</span>
                    <span className="text-[10px] text-surface-600 ml-auto">{new Date(ev.start_at).toLocaleDateString()}</span>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Simple calendar grid view */
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1))} className="text-surface-400 hover:text-white px-2">←</button>
            <span className="font-semibold text-white">{viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1))} className="text-surface-400 hover:text-white px-2">→</button>
          </div>
          <div className="grid grid-cols-7 gap-px">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-[10px] text-surface-600 text-center py-1 font-medium">{d}</div>
            ))}
            {(() => {
              const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
              const last = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
              const cells = [];
              for (let i = 0; i < first.getDay(); i++) cells.push(<div key={`empty-${i}`} />);
              for (let d = 1; d <= last.getDate(); d++) {
                const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
                const dayStr = date.toISOString().slice(0, 10);
                const dayEvents = events.filter(e => e.start_at.slice(0, 10) === dayStr);
                const isToday = dayStr === now.toISOString().slice(0, 10);
                cells.push(
                  <div key={d} className={cn('min-h-[60px] p-1 rounded border border-transparent', isToday && 'border-[#FF5F1F]/30 bg-[#FF5F1F]/5')}>
                    <span className={cn('text-[10px] font-medium', isToday ? 'text-[#FF5F1F]' : 'text-surface-500')}>{d}</span>
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} className="text-[8px] truncate rounded px-1 mt-0.5" style={{ backgroundColor: ev.color + '20', color: ev.color }}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <span className="text-[8px] text-surface-600">+{dayEvents.length - 3}</span>}
                  </div>
                );
              }
              return cells;
            })()}
          </div>
        </Card>
      )}

      {/* Create Event Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Event">
        <div className="space-y-4">
          <Input label="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div>
            <label className="text-sm text-surface-400 mb-1 block">Type</label>
            <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value as any })}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white">
              {Object.entries(EVENT_ICONS).map(([k, v]) => <option key={k} value={k}>{v} {k.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start *" type="datetime-local" value={form.start_at} onChange={e => setForm({ ...form, start_at: e.target.value })} />
            <Input label="End" type="datetime-local" value={form.end_at} onChange={e => setForm({ ...form, end_at: e.target.value })} />
          </div>
          <Input label="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Studio B, Zoom link..." />
          <div>
            <label className="text-sm text-surface-400 mb-1 block">Project (optional)</label>
            <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#FF5F1F'].map(c => (
              <button key={c} onClick={() => setForm({ ...form, color: c })}
                className={`w-7 h-7 rounded-full ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <Button onClick={createEvent} disabled={!form.title.trim() || !form.start_at}>Create Event</Button>
        </div>
      </Modal>
    </div>
  );
}
