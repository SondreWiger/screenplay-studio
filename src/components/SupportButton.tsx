'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/ui/icons';

// ============================================================
// Floating Support Button — shows help menu with quick links
// ============================================================

export function SupportButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Fetch open ticket count
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['open', 'in_progress'])
      .then(({ count }) => {
        setOpenTicketCount(count || 0);
      });
  }, [user]);

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50">
      {/* Popup menu */}
      {open && (
        <div className="absolute bottom-16 right-0 w-72 bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="p-4 border-b border-surface-800">
            <h3 className="text-sm font-semibold text-white">Help &amp; Support</h3>
            <p className="text-xs text-surface-400 mt-0.5">We&apos;re here to help</p>
          </div>
          <div className="p-2">
            {/* Report a Bug — top priority quick action */}
            <Link
              href="/feedback"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-surface-300 hover:text-white hover:bg-white/5 transition-colors group/bug"
            >
              <span className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover/bug:bg-red-500/20 transition-colors">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              <div>
                <span className="font-medium text-red-300">Report a Bug</span>
                <p className="text-[11px] text-surface-500 mt-0.5">Found something broken? Tell us</p>
              </div>
            </Link>
            <div className="my-1 mx-3 border-t border-surface-800" />
            <Link
              href="/support"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-surface-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-[#FF5F1F]/10 border border-[#FF5F1F]/20 flex items-center justify-center"><Icon name="ticket" size="sm" className="text-[#FF5F1F]" /></span>
              <div className="flex-1 min-w-0">
                <span className="font-medium">Support Tickets</span>
                {openTicketCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-[#FF5F1F]/20 text-[#FF5F1F] rounded-full">
                    {openTicketCount} open
                  </span>
                )}
                <p className="text-[11px] text-surface-500 mt-0.5">Report issues or ask for help</p>
              </div>
            </Link>
            <Link
              href="/legal/community-guidelines"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-surface-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center"><Icon name="clipboard" size="sm" className="text-green-400" /></span>
              <div>
                <span className="font-medium">Community Guidelines</span>
                <p className="text-[11px] text-surface-500 mt-0.5">Rules and best practices</p>
              </div>
            </Link>
            <Link
              href="/legal/acceptable-use"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-surface-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><Icon name="scale" size="sm" className="text-amber-400" /></span>
              <div>
                <span className="font-medium">Acceptable Use Policy</span>
                <p className="text-[11px] text-surface-500 mt-0.5">What&apos;s allowed on the platform</p>
              </div>
            </Link>
            <a
              href="https://ko-fi.com/northemdevelopment"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-surface-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center"><Icon name="heart" size="sm" className="text-pink-400" /></span>
              <div>
                <span className="font-medium">Support the Developer</span>
                <p className="text-[11px] text-surface-500 mt-0.5">Buy me a coffee on Ko-fi</p>
              </div>
            </a>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
          open
            ? 'bg-surface-700 text-white rotate-45 shadow-surface-900/50'
            : 'bg-[#E54E15] hover:bg-[#FF5F1F] text-white shadow-[#E54E15]/30 hover:shadow-[#FF5F1F]/40 hover:scale-105'
        }`}
        title="Help & Support"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        )}
      </button>
    </div>
  );
}
