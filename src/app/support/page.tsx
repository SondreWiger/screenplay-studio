'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SiteVersion } from '@/components/SiteVersion';
import { timeAgo } from '@/lib/utils';
import { TICKET_CATEGORY_OPTIONS } from '@/lib/types';
import type { SupportTicket, TicketMessage, TicketCategory } from '@/lib/types';

// ============================================================
// Support — Ticket submission & conversation view
// ============================================================

export default function SupportPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
      </div>
    }>
      <SupportPage />
    </Suspense>
  );
}

const STATUS_COLORS: Record<string, string> = {
  open: 'text-green-600 bg-green-50 border-green-200',
  in_progress: 'text-blue-600 bg-blue-50 border-blue-200',
  resolved: 'text-stone-600 bg-stone-100 border-stone-200',
  closed: 'text-stone-400 bg-stone-50 border-stone-200',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-stone-500',
  normal: 'text-stone-700',
  high: 'text-amber-600',
  urgent: 'text-red-600',
};

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
    if (type && id) {
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
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-4">
        <div className="text-5xl">🎫</div>
        <h1 className="text-xl font-bold text-stone-800">Support Center</h1>
        <p className="text-sm text-stone-500">Sign in to submit or view support tickets.</p>
        <Link href="/auth/login?redirect=/support" className="px-5 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold text-stone-900">Screenplay Studio</Link>
            <span className="text-stone-300">/</span>
            <h1 className="text-lg font-semibold text-stone-700">Support</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Dashboard</Link>
            <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Community</Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Ticket sidebar */}
          <div className="w-80 shrink-0">
            <button
              onClick={() => { setShowNewForm(true); setSelectedTicket(null); }}
              className="w-full px-4 py-3 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors mb-4 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Ticket
            </button>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="text-3xl mb-2">🎫</div>
                <p className="text-sm text-stone-400">No tickets yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedTicket?.id === ticket.id
                        ? 'border-brand-300 bg-brand-50 shadow-sm'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-stone-800 line-clamp-1">{ticket.subject}</p>
                      <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded border ${STATUS_COLORS[ticket.status]}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-stone-400 capitalize">{ticket.category.replace('_', ' ')}</span>
                      <span className="text-[10px] text-stone-300">·</span>
                      <span className="text-[10px] text-stone-400">{timeAgo(ticket.updated_at)}</span>
                      {ticket.priority !== 'normal' && (
                        <span className={`text-[10px] font-semibold capitalize ${PRIORITY_COLORS[ticket.priority]}`}>
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
              <div className="bg-white rounded-xl border border-stone-200 p-6">
                <h2 className="text-lg font-bold text-stone-800 mb-6">New Support Ticket</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Subject</label>
                    <input
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="Brief summary of your issue..."
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 bg-white text-stone-900 text-sm placeholder:text-stone-400 focus:border-brand-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as TicketCategory)}
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 bg-white text-stone-900 text-sm focus:border-brand-400 focus:outline-none"
                    >
                      {TICKET_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Message</label>
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Describe your issue in detail..."
                      rows={6}
                      className="w-full px-4 py-2.5 rounded-lg border border-stone-200 bg-white text-stone-900 text-sm placeholder:text-stone-400 focus:border-brand-400 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleCreateTicket}
                      disabled={!newSubject.trim() || !newMessage.trim() || submitting}
                      className="px-6 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {submitting ? 'Submitting...' : 'Submit Ticket'}
                    </button>
                    <button
                      onClick={() => setShowNewForm(false)}
                      className="px-4 py-2.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedTicket ? (
              /* Ticket conversation */
              <div className="bg-white rounded-xl border border-stone-200 flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
                {/* Ticket header */}
                <div className="px-6 py-4 border-b border-stone-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-stone-800">{selectedTicket.subject}</h2>
                      <div className="flex items-center gap-3 mt-1 text-xs text-stone-400">
                        <span className="capitalize">{selectedTicket.category.replace('_', ' ')}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${STATUS_COLORS[selectedTicket.status]}`}>
                          {selectedTicket.status.replace('_', ' ')}
                        </span>
                        <span className={`font-semibold capitalize ${PRIORITY_COLORS[selectedTicket.priority]}`}>
                          {selectedTicket.priority} priority
                        </span>
                        <span>{timeAgo(selectedTicket.created_at)}</span>
                      </div>
                      {selectedTicket.reported_content_type && (
                        <p className="text-xs text-stone-400 mt-1">
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
                          <img src={msg.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-500">
                            {(msg.profile?.full_name || '?')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className={`max-w-[75%] ${msg.is_staff ? 'text-right' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-stone-700">
                            {msg.profile?.full_name || 'User'}
                          </span>
                          {msg.is_staff && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold text-blue-700 bg-blue-50 rounded border border-blue-200">STAFF</span>
                          )}
                          <span className="text-[10px] text-stone-400">{timeAgo(msg.created_at)}</span>
                        </div>
                        <div className={`inline-block px-4 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.is_staff
                            ? 'bg-brand-50 text-brand-900 border border-brand-200'
                            : 'bg-stone-100 text-stone-800'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <p className="text-sm text-stone-400 text-center py-8">No messages yet.</p>
                  )}
                </div>

                {/* Message input */}
                {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
                  <div className="px-6 py-4 border-t border-stone-200">
                    <div className="flex gap-2">
                      <input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2.5 rounded-lg border border-stone-200 bg-white text-stone-900 text-sm placeholder:text-stone-400 focus:border-brand-400 focus:outline-none"
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!messageText.trim() || submitting}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
                {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
                  <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 text-center">
                    <p className="text-xs text-stone-400">This ticket is {selectedTicket.status}.</p>
                  </div>
                )}
              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-20">
                <div className="text-5xl mb-4">💬</div>
                <h2 className="text-lg font-semibold text-stone-700 mb-2">Select a ticket or create a new one</h2>
                <p className="text-sm text-stone-400 mb-6">We&apos;re here to help with any issues you encounter.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-6 mt-8 border-t border-stone-200 flex items-center justify-between">
        <Link href="/community" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">← Community</Link>
        <SiteVersion light />
      </footer>
    </div>
  );
}
