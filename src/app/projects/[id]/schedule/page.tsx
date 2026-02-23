'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn, formatDate, formatTime } from '@/lib/utils';
import { useProjectStore } from '@/lib/stores';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { ScheduleEvent, Scene, Location as Loc, ScheduleEventType } from '@/lib/types';

const EVENT_TYPES: { value: ScheduleEventType; label: string; color: string }[] = [
  { value: 'shooting', label: 'Shooting', color: 'bg-red-500' },
  { value: 'rehearsal', label: 'Rehearsal', color: 'bg-blue-500' },
  { value: 'location_scout', label: 'Location Scout', color: 'bg-green-500' },
  { value: 'meeting', label: 'Meeting', color: 'bg-yellow-500' },
  { value: 'setup', label: 'Setup', color: 'bg-purple-500' },
  { value: 'wrap', label: 'Wrap', color: 'bg-pink-500' },
  { value: 'travel', label: 'Travel', color: 'bg-orange-500' },
  { value: 'break', label: 'Break', color: 'bg-teal-500' },
  { value: 'other', label: 'Other', color: 'bg-surface-500' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

export default function SchedulePage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [view, setView] = useState<'calendar' | 'day' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayViewDate, setDayViewDate] = useState(new Date());
  const { confirm, ConfirmDialog } = useConfirmDialog();

  useEffect(() => { fetchData(); }, [params.id]);

  // Role awareness
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  const fetchData = async () => {
    try {
      const supabase = createClient();
      const [evRes, scRes, loRes] = await Promise.all([
        supabase.from('production_schedule').select('*').eq('project_id', params.id).order('start_time'),
        supabase.from('scenes').select('*').eq('project_id', params.id).order('sort_order'),
        supabase.from('locations').select('*').eq('project_id', params.id).order('name'),
      ]);
      if (evRes.error) console.error('Schedule fetch error:', evRes.error.message);
      if (scRes.error) console.error('Scenes fetch error:', scRes.error.message);
      if (loRes.error) console.error('Locations fetch error:', loRes.error.message);
      setEvents(evRes.data || []);
      setScenes(scRes.data || []);
      setLocations(loRes.data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ message: 'Delete this event?', variant: 'danger', confirmLabel: 'Delete' }); if (!ok) return;
    const supabase = createClient();
    await supabase.from('production_schedule').delete().eq('id', id);
    setEvents(events.filter((e) => e.id !== id));
    setShowEditor(false);
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const days = getMonthDays(currentYear, currentMonth);
  const getEventsForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.start_time.startsWith(dateStr));
  };

  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

  const upcoming = events.filter((e) => new Date(e.start_time) >= new Date(new Date().toDateString())).slice(0, 20);

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Production Schedule</h1>
          <p className="text-sm text-surface-400 mt-1">{events.length} events scheduled</p>
        </div>
        <div className="flex gap-3">
          <div className="flex rounded-lg border border-surface-700 overflow-hidden">
            <button onClick={() => setView('calendar')} className={cn('px-3 py-1.5 text-xs font-medium', view === 'calendar' ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white')}>Month</button>
            <button onClick={() => setView('day')} className={cn('px-3 py-1.5 text-xs font-medium', view === 'day' ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white')}>Day</button>
            <button onClick={() => setView('list')} className={cn('px-3 py-1.5 text-xs font-medium', view === 'list' ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white')}>List</button>
          </div>
          {canEdit && (
            <Button onClick={() => { setSelectedEvent(null); setSelectedDate(null); setShowEditor(true); }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span className="hidden sm:inline">Add Event</span>
            </Button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 md:gap-4 mb-6 flex-wrap">
        {EVENT_TYPES.map((t) => (
          <div key={t.value} className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 md:w-2.5 md:h-2.5 rounded-full', t.color)} />
            <span className="text-[10px] md:text-xs text-surface-400">{t.label}</span>
          </div>
        ))}
      </div>

      {view === 'calendar' ? (
        <div className="bg-surface-900 rounded-xl border border-surface-800">
          {/* Calendar header */}
          <div className="flex items-center justify-between p-4 border-b border-surface-800">
            <button onClick={prevMonth} className="p-2 text-surface-400 hover:text-white hover:bg-white/5 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-lg font-semibold text-white">{MONTHS[currentMonth]} {currentYear}</h2>
            <button onClick={nextMonth} className="p-2 text-surface-400 hover:text-white hover:bg-white/5 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-surface-800">
            {DAYS.map((d) => <div key={d} className="p-2 text-center text-xs font-medium text-surface-500">{d}</div>)}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              return (
                <div key={i} className={cn(
                  'min-h-[90px] p-1.5 border-r border-b border-surface-800/50 transition-colors',
                  day ? 'hover:bg-white/[0.02] cursor-pointer' : '',
                  isToday(day!) ? 'bg-brand-600/5' : '',
                )} onClick={() => {
                  if (!day) return;
                  const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  setDayViewDate(new Date(`${dateStr}T00:00:00`));
                  setView('day');
                }}>
                  {day && (
                    <>
                      <span className={cn('text-xs font-medium', isToday(day) ? 'text-brand-400' : 'text-surface-400')}>{day}</span>
                      <div className="mt-1 space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev) => {
                          const evType = EVENT_TYPES.find((t) => t.value === ev.event_type);
                          return (
                            <div key={ev.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); setShowEditor(true); }}
                              className={cn('text-[10px] px-1.5 py-0.5 rounded truncate text-white/90', evType?.color || 'bg-surface-600')}>
                              {ev.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && <span className="text-[10px] text-surface-500 pl-1">+{dayEvents.length - 3} more</span>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : view === 'day' ? (
        <DayPlannerView
          date={dayViewDate}
          events={events}
          scenes={scenes}
          locations={locations}
          canEdit={canEdit}
          onDateChange={setDayViewDate}
          onEventClick={(ev) => { setSelectedEvent(ev); setShowEditor(true); }}
          onSlotClick={(dateStr) => { setSelectedDate(dateStr); setSelectedEvent(null); setShowEditor(true); }}
        />
      ) : (
        // List view
        upcoming.length === 0 ? (
          <EmptyState title="No upcoming events" description="Add shooting days, meetings, and milestones"
            action={<Button onClick={() => { setSelectedEvent(null); setShowEditor(true); }}>Add Event</Button>} />
        ) : (
          <div className="space-y-2">
            {upcoming.map((ev) => {
              const evType = EVENT_TYPES.find((t) => t.value === ev.event_type);
              const scene = ev.scene_ids?.length ? scenes.find((s) => s.id === ev.scene_ids[0]) : null;
              const loc = locations.find((l) => l.id === ev.location_id);
              return (
                <Card key={ev.id} hover onClick={() => { setSelectedEvent(ev); setShowEditor(true); }}>
                  <div className="flex items-center gap-4 p-4">
                    <div className={cn('w-3 h-12 rounded-full shrink-0', evType?.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{ev.title}</h3>
                        <Badge size="sm">{evType?.label || ev.event_type}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-surface-400">
                        <span>{formatDate(ev.start_time)}</span>
                        {ev.call_time && <span>Call: {ev.call_time}</span>}
                        {ev.wrap_time && <span>Wrap: {ev.wrap_time}</span>}
                        {scene && <span>Sc. {scene.scene_number}</span>}
                        {loc && <span>{loc.name}</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      <ScheduleEditor isOpen={showEditor} onClose={() => setShowEditor(false)} event={selectedEvent}
        projectId={params.id} userId={user?.id || ''} scenes={scenes} locations={locations}
        defaultDate={selectedDate} onSaved={() => { fetchData(); setShowEditor(false); }} onDelete={handleDelete} />
      <ConfirmDialog />
    </div>
  );
}

function DayPlannerView({ date, events, scenes, locations, canEdit, onDateChange, onEventClick, onSlotClick }: {
  date: Date; events: ScheduleEvent[]; scenes: Scene[]; locations: Loc[];
  canEdit: boolean;
  onDateChange: (d: Date) => void;
  onEventClick: (e: ScheduleEvent) => void;
  onSlotClick: (dateStr: string) => void;
}) {
  const HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 5 AM to 10 PM

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dayEvents = events.filter((e) => e.start_time.startsWith(dateStr));

  const prevDay = () => { const d = new Date(date); d.setDate(d.getDate() - 1); onDateChange(d); };
  const nextDay = () => { const d = new Date(date); d.setDate(d.getDate() + 1); onDateChange(d); };
  const goToday = () => onDateChange(new Date());

  const isToday = date.toDateString() === new Date().toDateString();
  const now = new Date();
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Position an event on the timeline
  const getEventPosition = (ev: ScheduleEvent) => {
    const start = new Date(ev.start_time);
    const end = new Date(ev.end_time);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const topOffset = ((startMin - 5 * 60) / 60) * 64; // 64px per hour, starting at 5 AM
    const height = Math.max(((endMin - startMin) / 60) * 64, 24);
    return { top: Math.max(topOffset, 0), height };
  };

  return (
    <div className="bg-surface-900 rounded-xl border border-surface-800 overflow-hidden">
      {/* Day header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-800">
        <div className="flex items-center gap-3">
          <button onClick={prevDay} className="p-2 text-surface-400 hover:text-white hover:bg-white/5 rounded-lg">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="text-center min-w-[200px]">
            <h2 className="text-lg font-semibold text-white">
              {WEEKDAYS[date.getDay()]}, {MONTHS[date.getMonth()]} {date.getDate()}
            </h2>
            <p className="text-xs text-surface-500">{date.getFullYear()}</p>
          </div>
          <button onClick={nextDay} className="p-2 text-surface-400 hover:text-white hover:bg-white/5 rounded-lg">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!isToday && (
            <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 border border-surface-700 rounded-lg hover:border-surface-600 transition-colors">
              Today
            </button>
          )}
          <span className="text-xs text-surface-500">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* All-day events */}
      {dayEvents.filter(e => e.all_day).length > 0 && (
        <div className="px-4 py-2 border-b border-surface-800 bg-surface-800/30">
          <p className="text-[10px] uppercase text-surface-500 font-medium mb-1">All Day</p>
          <div className="flex flex-wrap gap-1">
            {dayEvents.filter(e => e.all_day).map(ev => {
              const evType = EVENT_TYPES.find(t => t.value === ev.event_type);
              return (
                <button key={ev.id} onClick={() => onEventClick(ev)}
                  className={cn('px-2.5 py-1 rounded text-xs text-white/90 font-medium', evType?.color || 'bg-surface-600')}>
                  {ev.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="relative overflow-y-auto max-h-[65vh]">
        {/* Current time indicator */}
        {isToday && currentTimeMinutes >= 5 * 60 && currentTimeMinutes <= 22 * 60 && (
          <div className="absolute left-0 right-0 z-20 pointer-events-none"
            style={{ top: ((currentTimeMinutes - 5 * 60) / 60) * 64 }}>
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-brand-500 -ml-1" />
              <div className="flex-1 h-[2px] bg-brand-500/60" />
            </div>
          </div>
        )}

        {/* Hour rows */}
        {HOURS.map((hour) => (
          <div key={hour} className="flex border-b border-surface-800/50 relative" style={{ height: 64 }}>
            {/* Time label */}
            <div className="w-16 shrink-0 px-2 pt-1 text-right">
              <span className="text-[10px] text-surface-500 font-medium">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </span>
            </div>
            {/* Clickable slot */}
            <div className="flex-1 border-l border-surface-800/50 relative group"
              onClick={() => {
                if (!canEdit) return;
                onSlotClick(dateStr);
              }}>
              {/* Half-hour line */}
              <div className="absolute top-1/2 left-0 right-0 border-t border-surface-800/20" />
              {canEdit && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/[0.02] transition-opacity flex items-center justify-center">
                  <span className="text-[10px] text-surface-500">+ Add event</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Positioned events */}
        {dayEvents.filter(e => !e.all_day).map((ev) => {
          const pos = getEventPosition(ev);
          const evType = EVENT_TYPES.find(t => t.value === ev.event_type);
          const scene = ev.scene_ids?.length ? scenes.find(s => s.id === ev.scene_ids[0]) : null;
          const loc = locations.find(l => l.id === ev.location_id);
          return (
            <button key={ev.id} onClick={() => onEventClick(ev)}
              className={cn(
                'absolute left-[68px] right-2 rounded-lg px-3 py-1.5 text-left z-10 overflow-hidden border border-transparent hover:border-white/20 transition-all shadow-lg',
                evType?.color || 'bg-surface-600'
              )}
              style={{ top: pos.top, height: pos.height, minHeight: 24 }}>
              <p className="text-xs font-semibold text-white truncate">{ev.title}</p>
              {pos.height > 36 && (
                <p className="text-[10px] text-white/70 truncate mt-0.5">
                  {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                  {scene ? ` · Sc. ${scene.scene_number}` : ''}
                  {loc ? ` · ${loc.name}` : ''}
                </p>
              )}
              {pos.height > 56 && ev.notes && (
                <p className="text-[10px] text-white/50 truncate mt-0.5">{ev.notes}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleEditor({ isOpen, onClose, event, projectId, userId, scenes, locations, defaultDate, onSaved, onDelete }: {
  isOpen: boolean; onClose: () => void; event: ScheduleEvent | null; projectId: string; userId: string;
  scenes: Scene[]; locations: Loc[]; defaultDate: string | null; onSaved: () => void; onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const toHHMM = (iso: string) => { const d = new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const toDateStr = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

  useEffect(() => {
    if (event) {
      setForm({
        ...event,
        date: toDateStr(event.start_time),
        call_time: event.call_time ? toHHMM(event.call_time) : toHHMM(event.start_time),
        wrap_time: event.wrap_time ? toHHMM(event.wrap_time) : toHHMM(event.end_time),
        scene_id: (event.scene_ids || [])[0] || '',
      });
    } else {
      setForm({
        title: '', event_type: 'shooting', date: defaultDate || new Date().toISOString().split('T')[0],
        call_time: '06:00', wrap_time: '18:00', scene_id: '', location_id: '', notes: '',
      });
    }
  }, [event, isOpen, defaultDate]);

  const handleSave = async () => {
    if (!form.title || !form.date) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const callStr = form.call_time || '06:00';
      const wrapStr = form.wrap_time || '18:00';
      const startTime = new Date(`${form.date}T${callStr}`).toISOString();
      const endTime = new Date(`${form.date}T${wrapStr}`).toISOString();
      const payload = {
        title: form.title, event_type: form.event_type, start_time: startTime, end_time: endTime,
        call_time: startTime, wrap_time: endTime,
        scene_ids: form.scene_id ? [form.scene_id] : [], location_id: form.location_id || null,
        notes: form.notes || null, project_id: projectId, created_by: userId,
      };
      if (event) {
        const { error } = await supabase.from('production_schedule').update(payload).eq('id', event.id);
        if (error) { toast.error(error.message); setLoading(false); return; }
      } else {
        const { error } = await supabase.from('production_schedule').insert(payload);
        if (error) { toast.error(error.message); setLoading(false); return; }
      }
    } catch (err) {
      toast.error('Failed to save event');
    }
    setLoading(false);
    onSaved();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={event ? `Edit: ${event.title}` : 'New Schedule Event'} size="md">
      <div className="space-y-4">
        <Input label="Title" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Day 1 - Interior scenes" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Type</label>
            <select value={form.event_type || 'shooting'} onChange={(e) => setForm({ ...form, event_type: e.target.value })}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <Input label="Date" type="date" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Call Time" type="time" value={form.call_time || ''} onChange={(e) => setForm({ ...form, call_time: e.target.value })} />
          <Input label="Wrap Time" type="time" value={form.wrap_time || ''} onChange={(e) => setForm({ ...form, wrap_time: e.target.value })} />
        </div>
        {scenes.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Scene</label>
            <select value={form.scene_id || ''} onChange={(e) => setForm({ ...form, scene_id: e.target.value })}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              <option value="">None</option>
              {scenes.map((s) => <option key={s.id} value={s.id}>Scene {s.scene_number} - {s.scene_heading || 'Untitled'}</option>)}
            </select>
          </div>
        )}
        {locations.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Location</label>
            <select value={form.location_id || ''} onChange={(e) => setForm({ ...form, location_id: e.target.value })}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
              <option value="">None</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}
        <Textarea label="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
      </div>
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-surface-800">
        <div>{event && <Button variant="danger" size="sm" onClick={() => onDelete(event.id)}>Delete</Button>}</div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={loading}>{event ? 'Save' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  );
}
