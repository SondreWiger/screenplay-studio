'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, toast } from '@/components/ui';

// ============================================================
// Invoice Generator
// Reads work_sessions for this project, generates printable
// invoice with per-day breakdown. No new DB table required.
// ============================================================

interface WorkSession {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  duration_seconds: number;
  context: string;
  profiles?: { display_name: string; email: string } | null;
}

interface InvoiceSettings {
  freelancerName: string;
  freelancerEmail: string;
  freelancerAddress: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  invoiceNumber: string;
  hourlyRate: number;
  currency: string;
  paymentTerms: string;
  notes: string;
}

function fmtHours(secs: number) {
  const h = secs / 3600;
  return h.toFixed(2);
}

function fmtMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export default function InvoicePage({ params }: { params: { id: string } }) {
  const { user }                   = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const currentUserRole            = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit                    = currentUserRole !== 'viewer';

  const [sessions, setSessions]    = useState<WorkSession[]>([]);
  const [loading, setLoading]      = useState(true);
  const [settings, setSettings]    = useState<InvoiceSettings>({
    freelancerName: '',
    freelancerEmail: '',
    freelancerAddress: '',
    clientName: '',
    clientEmail: '',
    clientCompany: '',
    invoiceNumber: `INV-${new Date().getFullYear()}-001`,
    hourlyRate: 75,
    currency: 'USD',
    paymentTerms: '30 days',
    notes: 'Thank you for your business.',
  });
  const [filterUser, setFilterUser] = useState<string>('all');
  const invoiceRef                 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('work_sessions')
        .select('id, user_id, date, duration_seconds, context, profiles(display_name, email)')
        .eq('project_id', params.id)
        .order('date', { ascending: true });
      setSessions((data as unknown as WorkSession[]) ?? []);

      // Pre-fill freelancer info from current profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', user?.id ?? '')
        .single();
      if (profile) {
        setSettings((s) => ({
          ...s,
          freelancerName: profile.display_name ?? '',
          freelancerEmail: profile.email ?? user?.email ?? '',
        }));
      }
      setLoading(false);
    };
    load();
  }, [params.id, user?.id, user?.email]);

  // Group by date
  const filteredSessions = filterUser === 'all'
    ? sessions
    : sessions.filter((s) => s.user_id === filterUser);

  const byDate = filteredSessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.date] = (acc[s.date] ?? 0) + s.duration_seconds;
    return acc;
  }, {});

  const sortedDates = Object.keys(byDate).sort();
  const totalSeconds = Object.values(byDate).reduce((a, b) => a + b, 0);
  const totalHours = totalSeconds / 3600;
  const totalAmount = totalHours * settings.hourlyRate;

  // Unique users who have sessions
  const uniqueUsers = Array.from(new Set(sessions.map((s) => s.user_id))).map((uid) => {
    const s = sessions.find((s) => s.user_id === uid);
    return { id: uid, name: (s?.profiles as { display_name: string } | null)?.display_name ?? uid };
  });

  const setField = (field: keyof InvoiceSettings, value: string | number) =>
    setSettings((s) => ({ ...s, [field]: value }));

  const handlePrint = () => {
    window.print();
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-black text-white">Invoice Generator</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {totalHours.toFixed(2)} hrs across {sortedDates.length} days
          </p>
        </div>
        <div className="flex gap-2">
          {uniqueUsers.length > 1 && (
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="px-3 py-1.5 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white"
            >
              <option value="all">All team members</option>
              {uniqueUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          <Button onClick={handlePrint} size="sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Export PDF
          </Button>
        </div>
      </div>

      {/* Settings panel (hidden on print) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 print:hidden">
        <Card className="p-4 space-y-3">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Your Info</p>
          {([
            ['freelancerName',    'Your Name'],
            ['freelancerEmail',   'Your Email'],
            ['freelancerAddress', 'Your Address (multiline)'],
          ] as [keyof InvoiceSettings, string][]).map(([field, placeholder]) => (
            <input
              key={field}
              value={settings[field] as string}
              onChange={(e) => setField(field, e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-600 focus:outline-none focus:border-[#FF5F1F]/60"
            />
          ))}
        </Card>
        <Card className="p-4 space-y-3">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Client Info</p>
          {([
            ['clientCompany', 'Client Company'],
            ['clientName',    'Client Name'],
            ['clientEmail',   'Client Email'],
          ] as [keyof InvoiceSettings, string][]).map(([field, placeholder]) => (
            <input
              key={field}
              value={settings[field] as string}
              onChange={(e) => setField(field, e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-600 focus:outline-none focus:border-[#FF5F1F]/60"
            />
          ))}
        </Card>
        <Card className="p-4 space-y-3">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Invoice Details</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={settings.invoiceNumber}
              onChange={(e) => setField('invoiceNumber', e.target.value)}
              placeholder="Invoice #"
              className="px-3 py-2 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-600 focus:outline-none focus:border-[#FF5F1F]/60"
            />
            <div className="flex items-center gap-1">
              <select
                value={settings.currency}
                onChange={(e) => setField('currency', e.target.value)}
                className="px-2 py-2 bg-surface-800/60 border border-surface-700 rounded-l-lg text-sm text-white focus:outline-none w-20"
              >
                {['USD','EUR','GBP','AUD','CAD','NOK','SEK','DKK'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input
                type="number"
                value={settings.hourlyRate}
                onChange={(e) => setField('hourlyRate', parseFloat(e.target.value))}
                placeholder="Rate/hr"
                className="flex-1 px-3 py-2 bg-surface-800/60 border-y border-r border-surface-700 rounded-r-lg text-sm text-white placeholder-surface-600 focus:outline-none focus:border-[#FF5F1F]/60 min-w-0"
              />
            </div>
          </div>
          <input
            value={settings.paymentTerms}
            onChange={(e) => setField('paymentTerms', e.target.value)}
            placeholder="Payment terms (e.g. 30 days)"
            className="w-full px-3 py-2 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-600 focus:outline-none focus:border-[#FF5F1F]/60"
          />
        </Card>
        <Card className="p-4 space-y-3">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Notes</p>
          <textarea
            value={settings.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Payment instructions, notes to client…"
            className="w-full px-3 py-2 bg-surface-800/60 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-600 focus:outline-none focus:border-[#FF5F1F]/60 resize-none"
            rows={4}
          />
        </Card>
      </div>

      {/* ── PRINTABLE INVOICE ── */}
      <div
        ref={invoiceRef}
        className="bg-surface-900 text-white rounded-xl p-8 md:p-12 print:rounded-none print:shadow-none shadow-xl"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {/* Invoice header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <div className="text-3xl font-black text-white tracking-tight">INVOICE</div>
            <div className="text-white/40 mt-1 text-sm">{settings.invoiceNumber}</div>
          </div>
          <div className="text-right text-sm text-white/70">
            <div className="font-semibold text-base">{settings.freelancerName || '—'}</div>
            {settings.freelancerEmail && <div className="text-white/40">{settings.freelancerEmail}</div>}
            {settings.freelancerAddress && (
              <div className="text-white/40 whitespace-pre-line mt-1">{settings.freelancerAddress}</div>
            )}
          </div>
        </div>

        <div className="h-px bg-gray-200 mb-8" />

        {/* Bill to + dates */}
        <div className="grid grid-cols-2 gap-8 mb-10">
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Bill To</div>
            <div className="font-semibold">{settings.clientCompany || settings.clientName || '—'}</div>
            {settings.clientCompany && settings.clientName && (
              <div className="text-white/60 text-sm">{settings.clientName}</div>
            )}
            {settings.clientEmail && <div className="text-white/40 text-sm">{settings.clientEmail}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Details</div>
            <div className="text-sm">
              <span className="text-white/40">Date: </span>
              <span>{fmtDate(today)}</span>
            </div>
            <div className="text-sm mt-1">
              <span className="text-white/40">Project: </span>
              <span>{currentProject?.title ?? 'Screenplay'}</span>
            </div>
            <div className="text-sm mt-1">
              <span className="text-white/40">Terms: </span>
              <span>{settings.paymentTerms}</span>
            </div>
          </div>
        </div>

        {/* Line items table */}
        <table className="w-full text-sm mb-8 border-collapse">
          <thead>
            <tr className="border-b-2 border-white/15">
              <th className="text-left py-2 text-xs font-bold text-white/40 uppercase tracking-wider">Date</th>
              <th className="text-left py-2 text-xs font-bold text-white/40 uppercase tracking-wider">Description</th>
              <th className="text-right py-2 text-xs font-bold text-white/40 uppercase tracking-wider">Hours</th>
              <th className="text-right py-2 text-xs font-bold text-white/40 uppercase tracking-wider">Rate</th>
              <th className="text-right py-2 text-xs font-bold text-white/40 uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sortedDates.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400 italic">No work sessions recorded</td>
              </tr>
            ) : (
              sortedDates.map((date) => {
                const hrs = byDate[date] / 3600;
                const amt = hrs * settings.hourlyRate;
                return (
                  <tr key={date} className="border-b border-gray-100">
                    <td className="py-2.5 text-white/70 font-mono text-xs">{fmtDate(date)}</td>
                    <td className="py-2.5 text-white/70">Screenplay writing — {currentProject?.title ?? ''}</td>
                    <td className="py-2.5 text-right text-white/70 tabular-nums">{hrs.toFixed(2)}</td>
                    <td className="py-2.5 text-right text-white/70 tabular-nums">{fmtMoney(settings.hourlyRate, settings.currency)}</td>
                    <td className="py-2.5 text-right text-white font-medium tabular-nums">{fmtMoney(amt, settings.currency)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-56">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-white/40">Subtotal ({totalHours.toFixed(2)} hrs)</span>
              <span className="tabular-nums">{fmtMoney(totalAmount, settings.currency)}</span>
            </div>
            <div className="h-px bg-gray-200 my-2" />
            <div className="flex justify-between text-base font-bold">
              <span>Total Due</span>
              <span className="tabular-nums">{fmtMoney(totalAmount, settings.currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {settings.notes && (
          <div className="border-t border-white/10 pt-6">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</div>
            <p className="text-white/60 text-sm whitespace-pre-line">{settings.notes}</p>
          </div>
        )}
      </div>

      {/* Print styles injected via style tag */}
      <style jsx global>{`
        @media print {
          body > * { display: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
