'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Modal, Input, Textarea, EmptyState, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';

// ────────────────────────────────────────────────────────────
// Contacts — Editorial sources & contacts rolodex
// Track experts, spokespeople, officials, tipsters
// ────────────────────────────────────────────────────────────

type Relationship = 'cold' | 'warm' | 'trusted';
type ContactCategory =
  | 'expert' | 'official' | 'spokesperson' | 'witness'
  | 'reporter' | 'photographer' | 'producer'
  | 'fixer' | 'tipster' | 'other';

interface Contact {
  id: string;
  project_id: string;
  name: string;
  title: string | null;
  organisation: string | null;
  phone: string | null;
  email: string | null;
  category: ContactCategory;
  relationship: Relationship;
  topic_area: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES: { value: ContactCategory; label: string; color: string }[] = [
  { value: 'expert',       label: 'Expert',        color: 'bg-blue-700' },
  { value: 'official',     label: 'Official',      color: 'bg-violet-700' },
  { value: 'spokesperson', label: 'Spokesperson',  color: 'bg-indigo-700' },
  { value: 'witness',      label: 'Witness',       color: 'bg-amber-700' },
  { value: 'reporter',     label: 'Reporter',      color: 'bg-sky-700' },
  { value: 'photographer', label: 'Photographer',  color: 'bg-teal-700' },
  { value: 'producer',     label: 'Producer',      color: 'bg-emerald-700' },
  { value: 'fixer',        label: 'Fixer',         color: 'bg-orange-700' },
  { value: 'tipster',      label: 'Tipster',       color: 'bg-pink-700' },
  { value: 'other',        label: 'Other',         color: 'bg-surface-600' },
];

const RELATIONSHIPS: { value: Relationship; label: string; dot: string }[] = [
  { value: 'cold',    label: 'Cold',    dot: 'bg-surface-500' },
  { value: 'warm',    label: 'Warm',    dot: 'bg-amber-500' },
  { value: 'trusted', label: 'Trusted', dot: 'bg-green-500' },
];

interface ContactForm {
  name: string; title: string; organisation: string; phone: string;
  email: string; category: ContactCategory; relationship: Relationship;
  topic_area: string; notes: string;
}

const DEFAULT_FORM: ContactForm = {
  name: '', title: '', organisation: '', phone: '',
  email: '', category: 'expert', relationship: 'cold',
  topic_area: '', notes: '',
};

export default function ContactsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const projectId = params.id;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<ContactCategory | 'all'>('all');
  const [filterRel, setFilterRel] = useState<Relationship | 'all'>('all');

  // ─── Fetch ──────────────────────────────────────────────

  const fetchContacts = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('broadcast_contacts')
      .select('*')
      .eq('project_id', projectId)
      .order('name');
    if (error) console.error('Contacts fetch:', error);
    setContacts(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // ─── CRUD ───────────────────────────────────────────────

  const openNew = () => {
    setEditContact(null);
    setForm(DEFAULT_FORM);
    setShowForm(true);
  };

  const openEdit = (c: Contact) => {
    setEditContact(c);
    setForm({
      name: c.name, title: c.title || '', organisation: c.organisation || '',
      phone: c.phone || '', email: c.email || '', category: c.category,
      relationship: c.relationship, topic_area: c.topic_area || '', notes: c.notes || '',
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: form.name, title: form.title || null, organisation: form.organisation || null,
      phone: form.phone || null, email: form.email || null, category: form.category,
      relationship: form.relationship, topic_area: form.topic_area || null,
      notes: form.notes || null, updated_at: new Date().toISOString(),
    };
    if (editContact) {
      const { error } = await supabase.from('broadcast_contacts').update(payload).eq('id', editContact.id);
      if (error) toast.error(error.message);
      else { toast.success('Contact updated'); setShowForm(false); fetchContacts(); }
    } else {
      const { error } = await supabase.from('broadcast_contacts').insert({
        ...payload, project_id: projectId, created_by: user?.id ?? null,
      });
      if (error) toast.error(error.message);
      else { toast.success('Contact added'); setShowForm(false); fetchContacts(); }
    }
    setSaving(false);
  };

  const markContacted = async (c: Contact) => {
    const supabase = createClient();
    await supabase.from('broadcast_contacts')
      .update({ last_contacted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', c.id);
    fetchContacts();
    if (selected?.id === c.id) setSelected({ ...c, last_contacted_at: new Date().toISOString() });
  };

  const deleteContact = async (c: Contact) => {
    if (!confirm(`Remove ${c.name}?`)) return;
    const supabase = createClient();
    await supabase.from('broadcast_contacts').delete().eq('id', c.id);
    if (selected?.id === c.id) setSelected(null);
    fetchContacts();
    toast.success('Contact removed');
  };

  // ─── Derived ────────────────────────────────────────────

  const filtered = contacts.filter(c => {
    if (filterCat !== 'all' && c.category !== filterCat) return false;
    if (filterRel !== 'all' && c.relationship !== filterRel) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q)
        && !c.organisation?.toLowerCase().includes(q)
        && !c.topic_area?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getCatInfo = (cat: ContactCategory) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[9];
  const getRelInfo = (rel: Relationship) => RELATIONSHIPS.find(r => r.value === rel) || RELATIONSHIPS[0];

  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-screen bg-surface-950">
      {/* ── Contact List ───────────────────────────────── */}
      <div className={cn('flex flex-col', selected ? 'w-1/2 lg:w-2/3' : 'flex-1')}>
        {/* Toolbar */}
        <div className="px-4 py-2.5 border-b border-surface-800 bg-surface-900/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-white">Contacts</h2>
            <span className="text-xs text-surface-500">{contacts.length} total</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name / org / topic…"
              className="w-44 bg-surface-800 border border-surface-700 rounded px-2.5 py-1 text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-[#FF5F1F]"
            />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value as ContactCategory | 'all')}
              className="bg-surface-800 border border-surface-700 rounded px-2 py-1 text-xs text-white">
              <option value="all">All types</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={filterRel} onChange={e => setFilterRel(e.target.value as Relationship | 'all')}
              className="bg-surface-800 border border-surface-700 rounded px-2 py-1 text-xs text-white">
              <option value="all">All relationships</option>
              {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <Button size="sm" onClick={openNew}>+ Add Contact</Button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              title="No contacts yet"
              description="Build your source rolodex — add experts, officials, tipsters and fixers."
              action={<Button onClick={openNew}>Add Contact</Button>}
            />
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-800 text-surface-500 text-left">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell">Organisation</th>
                  <th className="px-3 py-2 font-medium hidden md:table-cell">Topic</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Relationship</th>
                  <th className="px-3 py-2 font-medium hidden lg:table-cell">Last contact</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const cat = getCatInfo(c.category);
                  const rel = getRelInfo(c.relationship);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className={cn(
                        'border-b border-surface-800/50 hover:bg-surface-900/40 cursor-pointer transition-colors',
                        selected?.id === c.id && 'bg-surface-900/60',
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-white">{c.name}</div>
                        {c.title && <div className="text-surface-500 text-[10px]">{c.title}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-surface-400 hidden sm:table-cell">{c.organisation || '—'}</td>
                      <td className="px-3 py-2.5 text-surface-500 hidden md:table-cell">{c.topic_area || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn('text-[10px] font-bold text-white px-1.5 py-0.5 rounded uppercase', cat.color)}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', rel.dot)} />
                          <span className="text-surface-400">{rel.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-surface-500 hidden lg:table-cell">
                        {formatDate(c.last_contacted_at) || 'Never'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* always show for selected row */}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Detail Panel ───────────────────────────────── */}
      {selected && (
        <div className="w-1/2 lg:w-1/3 border-l border-surface-800 flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-800 bg-surface-900/50 flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-bold text-white truncate">{selected.name}</h3>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => openEdit(selected)}>Edit</Button>
              <button onClick={() => setSelected(null)} className="p-1 text-surface-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Identity */}
            <div className="space-y-1">
              {selected.title && <p className="text-sm text-surface-300">{selected.title}</p>}
              {selected.organisation && <p className="text-sm text-surface-400">{selected.organisation}</p>}
              {selected.topic_area && (
                <span className="inline-block text-[10px] bg-surface-800 text-surface-400 px-2 py-0.5 rounded-full">{selected.topic_area}</span>
              )}
            </div>

            {/* Type + Relationship */}
            <div className="flex gap-2 flex-wrap">
              <span className={cn('text-[11px] font-bold text-white px-2 py-1 rounded', getCatInfo(selected.category).color)}>
                {getCatInfo(selected.category).label}
              </span>
              <div className="flex items-center gap-1.5 bg-surface-800 px-2 py-1 rounded">
                <span className={cn('w-2 h-2 rounded-full', getRelInfo(selected.relationship).dot)} />
                <span className="text-[11px] text-surface-300">{getRelInfo(selected.relationship).label}</span>
              </div>
            </div>

            {/* Contact details */}
            <div className="space-y-2">
              {selected.phone && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-surface-500 w-12">Phone</span>
                  <a href={`tel:${selected.phone}`} className="text-xs text-[#FF5F1F] hover:underline">{selected.phone}</a>
                </div>
              )}
              {selected.email && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-surface-500 w-12">Email</span>
                  <a href={`mailto:${selected.email}`} className="text-xs text-[#FF5F1F] hover:underline truncate">{selected.email}</a>
                </div>
              )}
              {selected.last_contacted_at && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-surface-500 w-12">Last</span>
                  <span className="text-xs text-surface-400">{formatDate(selected.last_contacted_at)}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {selected.notes && (
              <div>
                <p className="text-[10px] text-surface-500 uppercase mb-1">Notes</p>
                <p className="text-xs text-surface-300 whitespace-pre-wrap leading-relaxed bg-surface-900 rounded-lg p-3 border border-surface-800">
                  {selected.notes}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button size="sm" onClick={() => markContacted(selected)}>
                ✓ Mark as Contacted Now
              </Button>
              {selected.phone && (
                <a href={`tel:${selected.phone}`}>
                  <Button size="sm" variant="outline" className="w-full">📞 Call</Button>
                </a>
              )}
              {selected.email && (
                <a href={`mailto:${selected.email}`}>
                  <Button size="sm" variant="outline" className="w-full">✉️ Email</Button>
                </a>
              )}
              <Button size="sm" variant="ghost" onClick={() => deleteContact(selected)} className="text-red-400 hover:text-red-300">
                Remove contact
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ───────────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editContact ? 'Edit Contact' : 'Add Contact'}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" />
            <Input label="Title / Role" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Professor of…" />
          </div>
          <Input label="Organisation" value={form.organisation} onChange={e => setForm(p => ({ ...p, organisation: e.target.value }))} placeholder="University / Company / Dept" />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+47 …" />
            <Input label="Email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ContactCategory }))}
                className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-white">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Relationship</label>
              <select value={form.relationship} onChange={e => setForm(p => ({ ...p, relationship: e.target.value as Relationship }))}
                className="w-full bg-surface-800 border border-surface-700 rounded px-2 py-1.5 text-sm text-white">
                {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <Input
            label="Topic Area"
            value={form.topic_area}
            onChange={e => setForm(p => ({ ...p, topic_area: e.target.value }))}
            placeholder="e.g. climate, finance, defence"
          />
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Background, how to reach, best times to call, reliability notes…"
            rows={4}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : editContact ? 'Update' : 'Add Contact'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
