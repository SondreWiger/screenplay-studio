'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppHeader } from '@/components/AppHeader';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import {
  PERSON_CATEGORIES, PERSON_CATEGORY_LABEL, PERSON_CATEGORY_TONE, PERSON_DEPARTMENTS,
  personColor, personInitials, personMatches,
  type Person, type PersonCategory, type PersonCredit,
} from '@/lib/types';

// People — your address book across every production.
// Projects end; the people you trust carry over to the next one.

type FormState = Partial<Person> & { name: string };

const emptyForm = (): FormState => ({
  name: '', category: 'crew', role: '', department: '', email: '', phone: '',
  location: '', agency: '', tags: [], links: {}, is_favourite: false,
});

const RATING_LABEL = ['', 'Would not rehire', 'Mixed', 'Solid', 'Great', 'First call'];

export default function PeoplePage() {
  const { user } = useAuthStore();
  const [people, setPeople] = useState<Person[]>([]);
  const [credits, setCredits] = useState<PersonCredit[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PersonCategory | 'all'>('all');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importProject, setImportProject] = useState('');
  const [importing, setImporting] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const supabase = createClient();
    const [peopleRes, creditRes, projectRes] = await Promise.all([
      supabase.from('people_directory').select('*').eq('owner_id', user.id).order('name'),
      supabase.from('people_credits').select('*').eq('owner_id', user.id),
      supabase.from('projects').select('id, title').eq('created_by', user.id).order('title'),
    ]);
    if (peopleRes.error) {
      toast.error(peopleRes.error.message);
    } else {
      setPeople((peopleRes.data ?? []) as Person[]);
      setCredits((creditRes.data ?? []) as PersonCredit[]);
      setProjects((projectRes.data ?? []) as { id: string; title: string }[]);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    people.forEach((p) => p.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [people]);

  const creditsByPerson = useMemo(() => {
    const map: Record<string, PersonCredit[]> = {};
    for (const c of credits) (map[c.person_id] ??= []).push(c);
    return map;
  }, [credits]);

  const projectTitle = useCallback(
    (id: string | null) => projects.find((p) => p.id === id)?.title ?? null,
    [projects]
  );

  const filtered = useMemo(() => people.filter((p) => {
    if (category !== 'all' && p.category !== category) return false;
    if (favouritesOnly && !p.is_favourite) return false;
    if (activeTag && !p.tags?.includes(activeTag)) return false;
    return personMatches(p, query);
  }), [people, category, favouritesOnly, activeTag, query]);

  const openNew = () => { setForm(emptyForm()); setEditingId(null); setShowForm(true); };
  const openEdit = (person: Person) => {
    setForm({ ...person, tags: person.tags ?? [], links: person.links ?? {} });
    setEditingId(person.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!user?.id) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      owner_id: user.id,
      name: form.name.trim(),
      category: form.category ?? 'crew',
      role: form.role || null,
      department: form.department || null,
      email: form.email || null,
      phone: form.phone || null,
      location: form.location || null,
      agency: form.agency || null,
      day_rate: form.day_rate ?? null,
      links: form.links ?? {},
      tags: form.tags ?? [],
      rating: form.rating ?? null,
      is_favourite: form.is_favourite ?? false,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = editingId
      ? await supabase.from('people_directory').update(payload).eq('id', editingId)
      : await supabase.from('people_directory').insert(payload);

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? 'Saved' : `${payload.name} added to your book`);
    setShowForm(false);
    fetchAll();
  };

  const toggleFavourite = async (person: Person) => {
    setPeople((prev) => prev.map((p) => (p.id === person.id ? { ...p, is_favourite: !p.is_favourite } : p)));
    const supabase = createClient();
    const { error } = await supabase
      .from('people_directory')
      .update({ is_favourite: !person.is_favourite })
      .eq('id', person.id);
    if (error) { toast.error(error.message); fetchAll(); }
  };

  const handleDelete = async (person: Person) => {
    if (!confirm(`Remove ${person.name} from your book?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('people_directory').delete().eq('id', person.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Removed');
    fetchAll();
  };

  // Pull cast and contacts out of a production you already ran, so the book
  // fills itself from work you've already done.
  const handleImport = async () => {
    if (!importProject || !user?.id) return;
    setImporting(true);
    const supabase = createClient();
    const [castRes, contactRes] = await Promise.all([
      supabase.from('cast_members').select('name, email, phone').eq('project_id', importProject),
      supabase.from('broadcast_contacts').select('name, category').eq('project_id', importProject),
    ]);

    type Incoming = { name: string; email?: string | null; phone?: string | null; category: PersonCategory };
    const incoming: Incoming[] = [
      ...((castRes.data ?? []) as { name: string; email: string | null; phone: string | null }[])
        .map((c) => ({ ...c, category: 'talent' as const })),
      ...((contactRes.data ?? []) as { name: string }[])
        .map((c) => ({ name: c.name, category: 'crew' as const })),
    ].filter((c) => c.name?.trim());

    const known = new Set(people.map((p) => p.name.trim().toLowerCase()));
    const fresh = incoming.filter((c) => !known.has(c.name.trim().toLowerCase()));

    if (fresh.length === 0) {
      setImporting(false);
      toast.info('Everyone from that production is already in your book.');
      return;
    }

    const { error } = await supabase.from('people_directory').insert(
      fresh.map((c) => ({
        owner_id: user.id,
        name: c.name.trim(),
        category: c.category,
        email: c.email ?? null,
        phone: c.phone ?? null,
      }))
    );

    setImporting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Added ${fresh.length} ${fresh.length === 1 ? 'person' : 'people'}`);
    setImportOpen(false);
    fetchAll();
  };

  if (!loading && !user?.id) return (
    <>
      <AppHeader />
      <div className="max-w-md mx-auto px-4 py-24 text-center">
      <h1 className="text-lg font-semibold text-white mb-2">People</h1>
      <p className="text-sm text-surface-400 mb-5">
        Your address book is private to your account. Sign in to see it.
      </p>
      <a
        href="/auth/login?redirect=%2Fpeople"
        className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
      >
        Sign in
        </a>
      </div>
    </>
  );

  if (loading) return (
    <>
      <AppHeader />
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </>
  );

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-white text-sm outline-none focus:border-brand-500/60';

  return (
    <>
      <AppHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">People</h1>
          <p className="text-sm text-surface-400 mt-1">
            Everyone you&apos;ve worked with — {people.length} in your book
            {people.filter((p) => p.is_favourite).length > 0 && (
              <> · {people.filter((p) => p.is_favourite).length} first-call</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="text-sm px-3 py-2 min-h-[40px] rounded-lg border border-surface-700 text-surface-300 hover:text-white hover:border-surface-500 transition-colors"
          >
            Import from a production
          </button>
          <button
            onClick={openNew}
            className="text-sm px-4 py-2 min-h-[40px] rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors"
          >
            Add person
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, role, agency, tag…"
          className="text-sm bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-surface-200 outline-none focus:border-brand-500/50 flex-1 min-w-[12rem]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PersonCategory | 'all')}
          className="text-sm bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-surface-300 outline-none focus:border-brand-500/50"
        >
          <option value="all">Everyone</option>
          {PERSON_CATEGORIES.map((c) => (
            <option key={c} value={c}>{PERSON_CATEGORY_LABEL[c]}</option>
          ))}
        </select>
        <button
          onClick={() => setFavouritesOnly((v) => !v)}
          className={cn(
            'text-sm px-3 py-2 rounded-lg border transition-colors',
            favouritesOnly
              ? 'border-brand-500/50 text-brand-500 bg-brand-500/10'
              : 'border-surface-700 text-surface-300 hover:text-white',
          )}
        >
          ★ First call
        </button>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={cn(
                'text-[11px] px-2 py-1 rounded-full border transition-colors',
                activeTag === tag
                  ? 'border-brand-500/50 text-brand-500 bg-brand-500/10'
                  : 'border-surface-800 text-surface-400 hover:text-white',
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Directory */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-surface-400 font-medium">
            {people.length === 0 ? 'Your book is empty' : 'Nobody matches those filters'}
          </p>
          {people.length === 0 && (
            <p className="text-surface-600 text-sm mt-1 max-w-sm mx-auto">
              Add the crew and talent you&apos;ve worked with, or import them from a
              production you&apos;ve already run.
            </p>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((person) => {
            const personCredits = creditsByPerson[person.id] ?? [];
            const isOpen = expanded === person.id;
            return (
              <div
                key={person.id}
                className="rounded-xl border border-surface-800 bg-surface-900/40 p-4 hover:border-surface-700 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold text-white"
                    style={{ background: personColor(person.name) }}
                    aria-hidden
                  >
                    {personInitials(person.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(person)}
                        className="font-semibold text-white text-sm truncate hover:text-brand-500 transition-colors"
                      >
                        {person.name}
                      </button>
                      {person.is_favourite && <span className="text-brand-500 text-xs" title="First call">★</span>}
                    </div>
                    <p className="text-xs text-surface-400 truncate">
                      {[person.role, person.department].filter(Boolean).join(' · ') || PERSON_CATEGORY_LABEL[person.category]}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFavourite(person)}
                    aria-label={person.is_favourite ? 'Remove from first call' : 'Mark first call'}
                    className={cn(
                      'shrink-0 text-sm transition-colors',
                      person.is_favourite ? 'text-brand-500' : 'text-surface-600 hover:text-surface-300',
                    )}
                  >
                    ★
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <span className={cn('text-[11px] px-1.5 py-0.5 rounded border', PERSON_CATEGORY_TONE[person.category])}>
                    {PERSON_CATEGORY_LABEL[person.category]}
                  </span>
                  {person.rating != null && (
                    <span className="text-[11px] text-surface-400" title={RATING_LABEL[person.rating]}>
                      {'★'.repeat(person.rating)}<span className="text-surface-700">{'★'.repeat(5 - person.rating)}</span>
                    </span>
                  )}
                  {person.tags?.slice(0, 2).map((t) => (
                    <span key={t} className="text-[11px] px-1.5 py-0.5 rounded-full bg-surface-800 text-surface-400">{t}</span>
                  ))}
                </div>

                {(person.email || person.phone) && (
                  <div className="mt-3 space-y-1">
                    {person.email && (
                      <a href={`mailto:${person.email}`} className="block text-xs text-surface-400 hover:text-brand-500 truncate transition-colors">
                        {person.email}
                      </a>
                    )}
                    {person.phone && (
                      <a href={`tel:${person.phone}`} className="block text-xs text-surface-400 hover:text-brand-500 transition-colors">
                        {person.phone}
                      </a>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-surface-800/60 flex items-center justify-between">
                  <button
                    onClick={() => setExpanded(isOpen ? null : person.id)}
                    className="text-[11px] text-surface-500 hover:text-surface-300 transition-colors"
                  >
                    {personCredits.length} {personCredits.length === 1 ? 'credit' : 'credits'}
                    {personCredits.length > 0 && <span className="ml-1">{isOpen ? '▲' : '▼'}</span>}
                  </button>
                  <button
                    onClick={() => handleDelete(person)}
                    className="text-[11px] text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Remove
                  </button>
                </div>

                {isOpen && personCredits.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {personCredits.map((c) => (
                      <li key={c.id} className="text-[11px] text-surface-400">
                        {projectTitle(c.project_id) ?? c.production_name}
                        {c.role && <span className="text-surface-600"> — {c.role}</span>}
                        {c.year && <span className="text-surface-600"> ({c.year})</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / edit */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[85vh] overflow-auto rounded-2xl border border-surface-700 bg-surface-950 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">{editingId ? 'Edit person' : 'Add person'}</h2>
              <button onClick={() => setShowForm(false)} className="text-surface-500 hover:text-white p-1 rounded transition-colors" aria-label="Close">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Name *</label>
                <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="Who are they" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as PersonCategory }))} className={inputClass}>
                    {PERSON_CATEGORIES.map((c) => <option key={c} value={c}>{PERSON_CATEGORY_LABEL[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Department</label>
                  <select value={form.department ?? ''} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} className={inputClass}>
                    <option value="">—</option>
                    {PERSON_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Role</label>
                  <input value={form.role ?? ''} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={inputClass} placeholder="Gaffer, Lead, Composer…" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Agency</label>
                  <input value={form.agency ?? ''} onChange={(e) => setForm((f) => ({ ...f, agency: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Email</label>
                  <input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    value={form.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Phone</label>
                  <input type="tel" inputMode="tel" value={form.phone ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Based in</label>
                  <input value={form.location ?? ''} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className={inputClass} placeholder="Oslo" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-400 mb-1">Day rate</label>
                  <input type="number" min={0} value={form.day_rate ?? ''} onChange={(e) => setForm((f) => ({ ...f, day_rate: e.target.value ? Number(e.target.value) : undefined }))} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">
                  Would work with again
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setForm((f) => ({ ...f, rating: f.rating === n ? undefined : n }))}
                      title={RATING_LABEL[n]}
                      className={cn('text-lg transition-colors', (form.rating ?? 0) >= n ? 'text-brand-500' : 'text-surface-700 hover:text-surface-500')}
                    >
                      ★
                    </button>
                  ))}
                  {form.rating != null && <span className="text-xs text-surface-500 ml-2">{RATING_LABEL[form.rating]}</span>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Tags</label>
                <input
                  value={(form.tags ?? []).join(', ')}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }))}
                  className={inputClass}
                  placeholder="drone, night shoots, speaks French"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1">Notes</label>
                <textarea rows={3} value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={cn(inputClass, 'resize-none')} placeholder="How you know them, how they were to work with…" />
              </div>

              <label className="flex items-center gap-2 text-sm text-surface-300">
                <input type="checkbox" checked={form.is_favourite ?? false} onChange={(e) => setForm((f) => ({ ...f, is_favourite: e.target.checked }))} className="w-4 h-4 rounded border-surface-600 bg-surface-900 accent-brand-500" />
                First call for the next production
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-surface-700 text-surface-300 hover:text-white text-sm transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : editingId ? 'Update' : 'Add to book'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import */}
      {importOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-700 bg-surface-950 p-6">
            <h2 className="text-base font-semibold text-white mb-1">Import from a production</h2>
            <p className="text-sm text-surface-400 mb-4">
              Pulls cast and contacts from a project into your book. People already
              in the book are skipped.
            </p>
            <select value={importProject} onChange={(e) => setImportProject(e.target.value)} className={inputClass}>
              <option value="">Choose a production…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setImportOpen(false)} className="px-4 py-2 rounded-lg border border-surface-700 text-surface-300 hover:text-white text-sm transition-colors">Cancel</button>
              <button onClick={handleImport} disabled={!importProject || importing} className="px-5 py-2 rounded-lg bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-colors disabled:opacity-50">
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
