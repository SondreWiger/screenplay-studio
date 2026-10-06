'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MailWarning, X } from 'lucide-react';
import { useNotificationStore } from '@/lib/stores';
import { EMAIL_SENT_KIND } from '@/lib/email-sent-notice';
import { cn } from '@/lib/utils';

/** Show the reminder for this long after an email goes out. */
const SHOW_FOR_MS = 14 * 86_400_000;

const PROVIDERS = [
  { name: 'Gmail', steps: 'Open Spam in the left menu, open our email and press "Report not spam".' },
  { name: 'Outlook / Hotmail', steps: 'Open Junk Email, select our email and choose "Not junk".' },
  { name: 'Apple Mail / iCloud', steps: 'Open Junk, select our email and press "Move to Inbox" (or "Not Junk").' },
  { name: 'Yahoo', steps: 'Open Spam, select our email and press "Not spam".' },
];

/**
 * Banner shown after the team emails someone: our mail tends to land in spam,
 * so ask them to look there and mark it "Not spam" — which also teaches their
 * provider to deliver the next one properly. Dismissing marks it read.
 */
export function EmailSpamNotice() {
  const { notifications, markAsRead } = useNotificationStore();
  const [open, setOpen] = useState(false);

  const notices = notifications.filter((n) =>
    !n.read
    && (n.metadata as { kind?: string } | null)?.kind === EMAIL_SENT_KIND
    && Date.now() - Date.parse(n.created_at) < SHOW_FOR_MS);
  const latest = notices[0];
  const subject = (latest?.metadata as { subject?: string } | null)?.subject;

  const dismiss = () => notices.forEach((n) => markAsRead(n.id));

  return (
    <AnimatePresence initial={false}>
      {latest && (
        <motion.div
          key={latest.id}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          className="overflow-hidden"
          role="status"
        >
          <div className="border-b border-amber-500/20 bg-amber-500/[0.07] px-4 py-2.5 sm:px-6">
            <div className="flex items-start gap-3">
              <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1 text-xs">
                <p className="text-amber-100">
                  <span className="font-semibold">We sent you an email{subject ? <> — &ldquo;{subject}&rdquo;</> : null}.</span>{' '}
                  <span className="text-amber-200/80">Not in your inbox? Check your spam or junk folder and mark it as &ldquo;Not spam&rdquo; so the next one arrives.</span>
                </p>
                <button onClick={() => setOpen((o) => !o)} className="mt-1 inline-flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200" aria-expanded={open}>
                  How do I do that? <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.ul
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 grid gap-1.5 overflow-hidden sm:grid-cols-2"
                    >
                      {PROVIDERS.map((p) => (
                        <li key={p.name} className="rounded-lg border border-amber-500/15 bg-surface-950/40 px-3 py-2 text-amber-100/80">
                          <span className="font-semibold text-amber-100">{p.name}:</span> {p.steps}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
              <button onClick={dismiss} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/10" aria-label="Dismiss email reminder">
                <span className="hidden sm:inline">Got it</span>
                <X className="h-3.5 w-3.5 sm:hidden" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
