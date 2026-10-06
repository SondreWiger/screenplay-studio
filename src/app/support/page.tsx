'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn, timeAgo } from '@/lib/utils';
import { ActionButton, AdminPage, EmptyState, PageHeader, Reveal, StatGrid, dailySpark, fieldClass } from '@/components/kit';
import { BookOpen, Keyboard, LifeBuoy, Megaphone, MessagesSquare, Plus } from 'lucide-react';
import { TICKET_CATEGORY_OPTIONS } from '@/lib/types';
import type { SupportTicket, TicketMessage, TicketCategory } from '@/lib/types';

// Support — Ticket submission & conversation view

export default function SupportPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-brand-500" />
      </div>
    }>
      <SupportPage />
    </Suspense>
  );
}

const STATUS_COLORS: Record<string, string> = {
  open: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  in_progress: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  resolved: 'text-white/60 bg-surface-800 border-white/10',
  closed: 'text-white/45 bg-surface-900 border-white/10',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-white/50',
  normal: 'text-white/70',
  high: 'text-amber-400',
  urgent: 'text-red-400',
};

const HELP_LINKS = [
  { href: '/learn', title: 'Learning hub', body: 'Guides for the editor, breakdowns, scheduling and more.', icon: BookOpen },
  { href: '/feedback', title: 'Feedback & roadmap', body: 'Suggest a feature or vote on what gets built next.', icon: Megaphone },
  { href: '/learn/keybinds', title: 'Keyboard shortcuts', body: 'Every shortcut in the script editor, in one list.', icon: Keyboard },
];

function SupportPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New ticket form state
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState<TicketCategory>('general');
  const [newMessage, setNewMessage] = useState('');

  // Pre-fill from URL params (for "Report" links)
  useEffect(() => {
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const subject = searchParams.get('subject');
    const isBug = searchParams.get('bug');
    if (isBug) {
      setShowNewForm(true);
      setNewCategory('bug');
      setNewSubject('Bug Report');
      setNewMessage('**What happened?**\n\n\n**Steps to reproduce:**\n1. \n2. \n\n**Expected behaviour:**\n\n\n**Browser / device:**\n');
    } else if (searchParams.get('topic') === 'studio') {
      // From "Contact us about Studio" on the pricing page
      setShowNewForm(true);
      setNewCategory('general');
      setNewSubject('Studio for our company');
      setNewMessage('Tell us about your company and productions:\n\nCompany:\nNumber of people:\nProductions per year:\nWhat you need from Studio:\n');
    } else if (type && id) {
      setShowNewForm(true);
      setNewCategory('content_report');
      setNewSubject(subject || `Report: ${type} ${id.slice(0, 8)}…`);
      setNewMessage(`I'd like to report the following content:\n\nType: ${type}\nID: ${id}\n\nReason: `);
    }
  }, [searchParams]);

  // Deep-link to a specific ticket (from notification links)
  useEffect(() => {
    const ticketId = searchParams.get('ticket');
    if (ticketId && tickets.length > 0) {
      const t = tickets.find((tk) => tk.id === ticketId);
      if (t) handleSelectTicket(t);
    }
  }, [searchParams, tickets]);

  useEffect(() => {
    if (user) fetchTickets();
  }, [user]);

  const fetchTickets = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user!.id)
      .order('updated_at', { ascending: false });
    if (!error) setTickets(data || []);
    setLoading(false);
  };

  const fetchMessages = async (ticketId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('ticket_messages')
      .select('*, profile:profiles(*)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const handleSelectTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setShowNewForm(false);
    await fetchMessages(ticket.id);
  };

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim() || !user) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const type = searchParams.get('type');
      const id = searchParams.get('id');
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          subject: newSubject.trim(),
          category: newCategory,
          reported_content_type: type || null,
          reported_content_id: id || null,
        })
        .select('*')
        .single();

      if (error || !ticket) throw error;

      // Add the initial message
      await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        user_id: user.id,
        content: newMessage.trim(),
        is_staff: false,
      });

      setTickets((prev) => [ticket, ...prev]);
      setSelectedTicket(ticket);
      setShowNewForm(false);
      setNewSubject('');
      setNewCategory('general');
      setNewMessage('');
      await fetchMessages(ticket.id);
    } catch (err) {
      console.error('Error creating ticket:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedTicket || !user) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const isMod = user.role === 'moderator' || user.role === 'admin';
      const { data, error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          content: messageText.trim(),
          is_staff: isMod,
        })
        .select('*, profile:profiles(*)')
        .single();

      if (!error && data) {
        setMessages((prev) => [...prev, data]);
        setMessageText('');
        // Update ticket timestamp
        await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', selectedTicket.id);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-brand-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <EmptyState
          icon={<LifeBuoy className="h-8 w-8" />}
          title="Support Center"
          description="Sign in to submit or view support tickets."
          action={<Link href="/auth/login?redirect=/support" className="inline-flex rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500">Sign in</Link>}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950">
      <AdminPage className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <PageHeader
          icon={<LifeBuoy className="h-5 w-5" />}
          title="Support"
          description="Talk to us about bugs, billing, your account or anything else."
          actions={
            <ActionButton variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => { setShowNewForm(true); setSelectedTicket(null); }}>
              New ticket
            </ActionButton>
          }
        />

        {tickets.length > 0 && (
          <StatGrid
            cols={4}
            items={[
              { label: 'Open', value: tickets.filter((t) => t.status === 'open').length, tone: 'green' },
              { label: 'In progress', value: tickets.filter((t) => t.status === 'in_progress').length, tone: 'blue' },
              { label: 'Resolved', value: tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length, tone: 'neutral' },
              { label: 'All tickets', value: tickets.length, tone: 'brand', spark: dailySpark(tickets, (t) => t.created_at, 30) },
            ]}
          />
        )}

        <Reveal className="flex flex-col gap-6 lg:flex-row">
          {/* Ticket list */}
          <div className="w-full shrink-0 lg:w-80">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-surface-500">Your tickets</p>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-brand-500" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-800 px-4 py-8 text-center text-xs text-surface-500">
                No tickets yet — open one and we&apos;ll get back to you here.
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      selectedTicket?.id === ticket.id
                        ? 'border-brand-500/40 bg-brand-500/10 shadow-sm'
                        : 'border-white/10 bg-surface-900 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white/90 line-clamp-1">{ticket.subject}</p>
                      <span className={`shrink-0 px-1.5 py-0.5 text-[11px] font-semibold rounded border ${STATUS_COLORS[ticket.status]}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-white/45 capitalize">{ticket.category.replace('_', ' ')}</span>
                      <span className="text-[11px] text-white/20">·</span>
                      <span className="text-[11px] text-white/45">{timeAgo(ticket.updated_at)}</span>
                      {ticket.priority !== 'normal' && (
                        <span className={`text-[11px] font-semibold capitalize ${PRIORITY_COLORS[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main area */}
          <div className="flex-1 min-w-0">
            {showNewForm ? (
              /* New ticket form */
              <div className="rounded-2xl border border-surface-800 bg-surface-900/60 p-6">
                <h2 className="mb-5 text-base font-semibold text-white">New support ticket</h2>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-surface-300">Subject</label>
                    <input
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="Brief summary of your issue..."
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-surface-300">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as TicketCategory)}
                      className={fieldClass}
                    >
                      {TICKET_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-surface-300">Message</label>
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Describe your issue in detail..."
                      rows={6}
                      className={cn(fieldClass, 'resize-none')}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleCreateTicket}
                      disabled={!newSubject.trim() || !newMessage.trim() || submitting}
                      className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
                    >
                      {submitting ? 'Submitting...' : 'Submit Ticket'}
                    </button>
                    <button
                      onClick={() => setShowNewForm(false)}
                      className="px-4 py-2.5 text-sm text-white/50 hover:text-white/70 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedTicket ? (
              /* Ticket conversation */
              <div className="flex flex-col rounded-2xl border border-surface-800 bg-surface-900/60" style={{ height: 'max(440px, calc(100dvh - 300px))' }}>
                {/* Ticket header */}
                <div className="px-6 py-4 border-b border-white/10">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white/90">{selectedTicket.subject}</h2>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/45">
                        <span className="capitalize">{selectedTicket.category.replace('_', ' ')}</span>
                        <span className={`px-1.5 py-0.5 text-[11px] font-semibold rounded border ${STATUS_COLORS[selectedTicket.status]}`}>
                          {selectedTicket.status.replace('_', ' ')}
                        </span>
                        <span className={`font-semibold capitalize ${PRIORITY_COLORS[selectedTicket.priority]}`}>
                          {selectedTicket.priority} priority
                        </span>
                        <span>{timeAgo(selectedTicket.created_at)}</span>
                      </div>
                      {selectedTicket.reported_content_type && (
                        <p className="text-xs text-white/45 mt-1">
                          Reported: {selectedTicket.reported_content_type} · {selectedTicket.reported_content_id?.slice(0, 8)}…
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.is_staff ? 'flex-row-reverse' : ''}`}>
                      <div className="shrink-0">
                        {msg.profile?.avatar_url ? (
                          <img src={msg.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-white/50">
                            {(msg.profile?.full_name || '?')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className={`max-w-[75%] ${msg.is_staff ? 'text-right' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-white/70">
                            {msg.profile?.full_name || 'User'}
                          </span>
                          {msg.is_staff && (
                            <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">STAFF</span>
                          )}
                          <span className="text-[11px] text-white/45">{timeAgo(msg.created_at)}</span>
                        </div>
                        <div className={`inline-block px-4 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.is_staff
                            ? 'bg-brand-500/10 text-brand-100 border border-brand-500/30'
                            : 'bg-surface-800 text-white/90'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <p className="text-sm text-white/45 text-center py-8">No messages yet.</p>
                  )}
                </div>

                {/* Message input */}
                {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
                  <div className="px-6 py-4 border-t border-white/10">
                    <div className="flex gap-2">
                      <input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 bg-surface-900 text-white text-sm placeholder:text-white/45 focus:border-brand-500 focus:outline-none"
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!messageText.trim() || submitting}
                        className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
                {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
                  <div className="px-6 py-3 border-t border-white/10 bg-surface-900 text-center">
                    <p className="text-xs text-white/45">This ticket is {selectedTicket.status}.</p>
                  </div>
                )}
              </div>
            ) : (
              /* Empty state */
              <div className="space-y-4">
                <EmptyState
                  icon={<MessagesSquare className="h-8 w-8" />}
                  title="Select a ticket or create a new one"
                  description="We're here to help with any issues you encounter."
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  {HELP_LINKS.map((h) => (
                    <Link key={h.href} href={h.href} className="group rounded-2xl border border-surface-800 bg-surface-900/60 p-4 transition-colors hover:border-surface-700">
                      <h.icon className="h-4 w-4 text-brand-400" />
                      <p className="mt-3 text-sm font-semibold text-white group-hover:text-brand-300">{h.title}</p>
                      <p className="mt-1 text-xs text-surface-500">{h.body}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </AdminPage>
    </div>
  );
}
