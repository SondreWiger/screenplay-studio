'use client';

import { useState } from 'react';
import { cn, timeAgo } from '@/lib/utils';
import type { SupportTicket, TicketMessage } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { fillEmails } from '@/lib/private-profile';
import { useAuth } from '@/hooks/useAuth';
import logger from '@/lib/logger';
import { sendTicketReplyEmailAction } from '@/lib/email-actions';
import { useAdminData } from '../data';
import { TabSkeleton } from '../motion';

const STATUS_COLORS: Record<string, string> = {
  open: 'text-green-400 bg-green-500/10 border-green-500/20',
  in_progress: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  resolved: 'text-surface-400 bg-surface-500/10 border-surface-500/20',
  closed: 'text-surface-500 bg-surface-500/5 border-surface-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-surface-400',
  normal: 'text-surface-200',
  high: 'text-amber-400',
  urgent: 'text-red-400',
};

export function TicketsTab({ tickets, selectedTicketId, messages, replyText, onSelectTicket, onReply, onReplyChange, onStatusChange, onPriorityChange }: {
  tickets: SupportTicket[];
  selectedTicketId: string | null;
  messages: TicketMessage[];
  replyText: string;
  onSelectTicket: (id: string) => void;
  onReply: () => void;
  onReplyChange: (text: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onPriorityChange: (id: string, priority: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const selected = tickets.find((t) => t.id === selectedTicketId);

  const filtered = tickets.filter((t) => statusFilter === 'all' || t.status === statusFilter);

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Support Tickets</h2>
          <p className="text-sm text-surface-400 mt-1">
            {openCount} open · {inProgressCount} in progress · {tickets.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['all', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize',
                statusFilter === s ? 'bg-brand-600/20 text-brand-500' : 'text-surface-400 hover:text-white hover:bg-surface-900/5'
              )}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6" style={{ height: 'calc(100vh - 260px)' }}>
        {/* Ticket list */}
        <div className="w-96 shrink-0 overflow-y-auto space-y-2 pr-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">🎫</div>
              <p className="text-sm text-surface-500">No tickets</p>
            </div>
          ) : (
            filtered.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => onSelectTicket(ticket.id)}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-colors',
                  selectedTicketId === ticket.id
                    ? 'border-brand-500/30 bg-brand-500/5'
                    : 'border-surface-800 bg-surface-900 hover:border-surface-700'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-white line-clamp-1">{ticket.subject}</p>
                  <span className={`shrink-0 px-1.5 py-0.5 text-[11px] font-semibold rounded border capitalize ${STATUS_COLORS[ticket.status]}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-surface-400">{ticket.profile?.full_name || ticket.profile?.email || 'User'}</span>
                  <span className="text-surface-600">·</span>
                  <span className="text-surface-500 capitalize">{ticket.category.replace('_', ' ')}</span>
                  <span className="text-surface-600">·</span>
                  <span className={`font-semibold capitalize ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                  <span className="text-surface-600">·</span>
                  <span className="text-surface-500">{timeAgo(ticket.updated_at)}</span>
                </div>
                {ticket.reported_content_type && (
                  <p className="text-[11px] text-surface-500 mt-1">
                    Reported: {ticket.reported_content_type} · {ticket.reported_content_id?.slice(0, 8)}…
                  </p>
                )}
              </button>
            ))
          )}
        </div>

        {/* Ticket detail & conversation */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="bg-surface-900 border border-surface-800 rounded-xl flex flex-col h-full">
              {/* Header */}
              <div className="px-6 py-4 border-b border-surface-800">
                <h3 className="text-lg font-bold text-white">{selected.subject}</h3>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-xs text-surface-400">
                    by {selected.profile?.full_name || 'User'} ({selected.profile?.email})
                  </span>
                  <span className="text-surface-600">·</span>
                  <span className="text-xs text-surface-500">{timeAgo(selected.created_at)}</span>

                  {/* Status control */}
                  <select
                    value={selected.status}
                    onChange={(e) => onStatusChange(selected.id, e.target.value)}
                    className="ml-auto text-xs bg-surface-800 border border-surface-700 text-white rounded-lg px-2 py-1 focus:outline-none"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>

                  {/* Priority control */}
                  <select
                    value={selected.priority}
                    onChange={(e) => onPriorityChange(selected.id, e.target.value)}
                    className="text-xs bg-surface-800 border border-surface-700 text-white rounded-lg px-2 py-1 focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                {selected.reported_content_type && (
                  <p className="text-xs text-amber-400/70 mt-2">
                    ⚠ Reported: {selected.reported_content_type} · ID: {selected.reported_content_id}
                  </p>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.is_staff ? 'flex-row-reverse' : ''}`}>
                    <div className="shrink-0">
                      {msg.profile?.avatar_url ? (
                        <img src={msg.profile.avatar_url} alt={msg.profile.full_name || 'User avatar'} className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-400">
                          {(msg.profile?.full_name || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className={`max-w-[70%] ${msg.is_staff ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-2 mb-1 ${msg.is_staff ? 'justify-end' : ''}`}>
                        <span className="text-xs font-semibold text-surface-300">{msg.profile?.full_name || 'User'}</span>
                        {msg.is_staff && (
                          <span className="px-1.5 py-0.5 text-[11px] font-bold text-brand-500 bg-brand-500/10 rounded border border-brand-500/20">STAFF</span>
                        )}
                        <span className="text-[11px] text-surface-500">{timeAgo(msg.created_at)}</span>
                      </div>
                      <div className={`inline-block px-4 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.is_staff
                          ? 'bg-brand-600/10 text-brand-400 border border-brand-500/20'
                          : 'bg-surface-800 text-surface-200 border border-surface-700'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply */}
              {(selected.status === 'open' || selected.status === 'in_progress') && (
                <div className="px-6 py-4 border-t border-surface-800">
                  <div className="flex gap-2">
                    <input
                      value={replyText}
                      onChange={(e) => onReplyChange(e.target.value)}
                      placeholder="Type a staff reply..."
                      className="flex-1 px-4 py-2.5 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder:text-surface-500 focus:border-brand-500 focus:outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onReply(); } }}
                    />
                    <button
                      onClick={onReply}
                      disabled={!replyText.trim()}
                      className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-3">🎫</div>
              <p className="text-sm text-surface-400">Select a ticket to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TicketsPanel() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const { data: tickets, loading, mutate } = useAdminData<SupportTicket[]>('tickets', async () => {
    const { data } = await createClient().from('support_tickets').select('*, profile:profiles(*)').order('updated_at', { ascending: false });
    return data || [];
  }, []);

  const loadMessages = async (ticketId: string) => {
    const { data } = await createClient().from('ticket_messages').select('*, profile:profiles(*)').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const handleSelect = async (ticketId: string) => {
    setSelectedId(ticketId);
    await loadMessages(ticketId);
  };

  const handleReply = async () => {
    if (!reply.trim() || !selectedId || !user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ticket_messages')
      .insert({ ticket_id: selectedId, user_id: user.id, content: reply.trim(), is_staff: true })
      .select('*, profile:profiles(*)')
      .single();
    if (error || !data) return;
    setMessages((prev) => [...prev, data]);
    setReply('');
    await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', selectedId);
    const ticket = tickets.find((t) => t.id === selectedId);
    if (!ticket || ticket.user_id === user.id) return;
    await supabase.from('notifications').insert({
      user_id: ticket.user_id,
      type: 'ticket_reply',
      title: 'New reply on your support ticket',
      body: `Staff replied to "${ticket.subject}"`,
      link: `/support?ticket=${ticket.id}`,
      actor_id: user.id,
      entity_type: 'support_ticket',
      entity_id: ticket.id,
    });
    // Push delivery is handled by the recipient's useNotifications hook (triggerSelfPush)
    const { data: owner, error: profileError } = await supabase.from('profiles').select('id, email, full_name, display_name').eq('id', ticket.user_id).single();
    // The address lives in profile_contact (staff can read it)
    if (owner) await fillEmails(supabase, [owner]);
    if (profileError) console.error('Failed to fetch ticket owner profile:', profileError.message);
    if (owner?.email) {
      sendTicketReplyEmailAction(owner.email, owner.display_name || owner.full_name || '', ticket.subject, ticket.id)
        .catch((err) => logger.error('Admin', 'Failed to send ticket reply email:', err));
    }
  };

  const updateTicket = async (ticketId: string, patch: Partial<Pick<SupportTicket, 'status' | 'priority'>>) => {
    const { error } = await createClient().from('support_tickets').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', ticketId);
    if (!error) mutate((prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...patch } : t)));
  };

  if (loading) return <TabSkeleton />;
  return (
    <TicketsTab
      tickets={tickets}
      selectedTicketId={selectedId}
      messages={messages}
      replyText={reply}
      onSelectTicket={handleSelect}
      onReply={handleReply}
      onReplyChange={setReply}
      onStatusChange={(id, status) => updateTicket(id, { status: status as SupportTicket['status'] })}
      onPriorityChange={(id, priority) => updateTicket(id, { priority: priority as SupportTicket['priority'] })}
    />
  );
}
