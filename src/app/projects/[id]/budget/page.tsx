'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner, Progress } from '@/components/ui';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import type { BudgetItem, BudgetCategory } from '@/lib/types';

const CATEGORIES: { value: BudgetCategory; label: string; icon: string }[] = [
  { value: 'above_the_line', label: 'Above the Line', icon: '🎬' },
  { value: 'below_the_line', label: 'Below the Line', icon: '🎥' },
  { value: 'talent', label: 'Talent / Cast', icon: '🎭' },
  { value: 'production', label: 'Production', icon: '🎞️' },
  { value: 'equipment', label: 'Equipment', icon: '📷' },
  { value: 'locations', label: 'Locations', icon: '📍' },
  { value: 'props_costumes', label: 'Props & Costumes', icon: '👗' },
  { value: 'post_production', label: 'Post-Production', icon: '🖥️' },
  { value: 'transportation', label: 'Transportation', icon: '🚐' },
  { value: 'catering', label: 'Catering', icon: '🍽️' },
  { value: 'insurance', label: 'Insurance', icon: '🛡️' },
  { value: 'marketing', label: 'Marketing', icon: '📣' },
  { value: 'contingency', label: 'Contingency', icon: '💰' },
  { value: 'other', label: 'Other', icon: '📦' },
];

export default function BudgetPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<BudgetItem | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  useEffect(() => { fetchItems(); }, [params.id]);

  const fetchItems = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('budget_items').select('*').eq('project_id', params.id).order('category').order('name');
      if (error) console.error('Budget fetch error:', error.message);
      setItems(data || []);
      setExpandedCats(new Set((data || []).map((i: BudgetItem) => i.category)));
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget item?')) return;
    const supabase = createClient();
    await supabase.from('budget_items').delete().eq('id', id);
    setItems(items.filter((i) => i.id !== id));
    setShowEditor(false);
  };

  const incomeItems = items.filter((i) => i.subcategory === '__income__');
  const expenseItems = items.filter((i) => i.subcategory !== '__income__');
  const totalIncome = incomeItems.reduce((s, i) => s + (i.actual_amount || i.estimated_amount || 0), 0);
  const totalEstimated = expenseItems.reduce((s, i) => s + (i.estimated_amount || 0), 0);
  const totalActual = expenseItems.reduce((s, i) => s + (i.actual_amount || 0), 0);
  const netBudget = totalIncome - totalActual;

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: items.filter((i) => i.category === cat.value),
    estimated: items.filter((i) => i.category === cat.value).reduce((s, i) => s + (i.estimated_amount || 0), 0),
    actual: items.filter((i) => i.category === cat.value).reduce((s, i) => s + (i.actual_amount || 0), 0),
  })).filter((g) => filterCategory === 'all' || g.value === filterCategory);

  const toggleCat = (cat: string) => {
    const next = new Set(expandedCats);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    setExpandedCats(next);
  };

  if (loading) return <LoadingSpinner className="py-32" />;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Budget Tracker</h1>
          <p className="text-sm text-surface-400 mt-1">{items.length} line items</p>
        </div>
        <Button onClick={() => { setSelectedItem(null); setShowEditor(true); }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Item
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <p className="text-xs text-surface-400 mb-1">Income</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-surface-500 mt-1">{incomeItems.length} sources</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-400 mb-1">Budget (Est.)</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalEstimated)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-400 mb-1">Spent</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalActual)}</p>
          {totalEstimated > 0 && (
            <Progress value={totalActual} max={totalEstimated} color={totalActual > totalEstimated ? '#ef4444' : '#3b82f6'} className="mt-2" />
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-400 mb-1">Net</p>
          <p className={cn('text-xl font-bold', netBudget >= 0 ? 'text-green-400' : 'text-red-400')}>
            {netBudget >= 0 ? '+' : ''}{formatCurrency(netBudget)}
          </p>
          <p className="text-xs text-surface-500 mt-1">income − spent</p>
        </Card>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button onClick={() => setFilterCategory('all')} className={cn(
          'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap',
          filterCategory === 'all' ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
        )}>All Categories</button>
        {CATEGORIES.filter((c) => items.some((i) => i.category === c.value)).map((c) => (
          <button key={c.value} onClick={() => setFilterCategory(c.value)} className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap',
            filterCategory === c.value ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
          )}>{c.icon} {c.label}</button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title="No budget items" description="Track every dollar of your production"
          action={<Button onClick={() => { setSelectedItem(null); setShowEditor(true); }}>Add Item</Button>} />
      ) : (
        <div className="space-y-3">
          {grouped.filter((g) => g.items.length > 0).map((group) => (
            <div key={group.value} className="bg-surface-900 rounded-xl border border-surface-800 overflow-hidden">
              <button onClick={() => toggleCat(group.value)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{group.icon}</span>
                  <div className="text-left">
                    <h3 className="text-sm font-semibold text-white">{group.label}</h3>
                    <p className="text-xs text-surface-500">{group.items.length} items</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{formatCurrency(group.estimated)}</p>
                    <p className="text-xs text-surface-500">estimated</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-medium', group.actual > group.estimated ? 'text-red-400' : 'text-green-400')}>{formatCurrency(group.actual)}</p>
                    <p className="text-xs text-surface-500">actual</p>
                  </div>
                  <svg className={cn('w-4 h-4 text-surface-400 transition-transform', expandedCats.has(group.value) ? 'rotate-180' : '')}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {expandedCats.has(group.value) && (
                <div className="border-t border-surface-800">
                  {group.items.map((item) => (
                    <div key={item.id}
                      onClick={() => { setSelectedItem(item); setShowEditor(true); }}
                      className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] cursor-pointer border-b border-surface-800/50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{item.description}</p>
                        {item.vendor && <p className="text-xs text-surface-500">{item.vendor}</p>}
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right w-24">
                          <p className="text-sm text-surface-300">{formatCurrency(item.estimated_amount || 0)}</p>
                        </div>
                        <div className="text-right w-24">
                          <p className={cn('text-sm', (item.actual_amount || 0) > (item.estimated_amount || 0) ? 'text-red-400' : 'text-green-400')}>
                            {formatCurrency(item.actual_amount || 0)}
                          </p>
                        </div>
                        <Badge size="sm" variant={item.subcategory === '__income__' ? 'success' : item.is_paid ? 'success' : 'warning'}>
                          {item.subcategory === '__income__' ? 'Income' : item.is_paid ? 'Paid' : 'Unpaid'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <BudgetEditor isOpen={showEditor} onClose={() => setShowEditor(false)} item={selectedItem}
        projectId={params.id} userId={user?.id || ''}
        onSaved={() => { fetchItems(); setShowEditor(false); }} onDelete={handleDelete} />
    </div>
  );
}

function BudgetEditor({ isOpen, onClose, item, projectId, userId, onSaved, onDelete }: {
  isOpen: boolean; onClose: () => void; item: BudgetItem | null; projectId: string; userId: string;
  onSaved: () => void; onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm(item ? { ...item, is_income: item.subcategory === '__income__' } : {
      description: '', category: 'other' as BudgetCategory, estimated_amount: '',
      actual_amount: '', vendor: '', notes: '', is_paid: false, is_income: false,
    });
  }, [item, isOpen]);

  const handleSave = async () => {
    if (!form.description) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const payload = {
        ...form, project_id: projectId, created_by: userId,
        estimated_amount: parseFloat(form.estimated_amount) || 0,
        actual_amount: parseFloat(form.actual_amount) || 0,
        subcategory: form.is_income ? '__income__' : (form.subcategory === '__income__' ? null : form.subcategory),
      };
      delete (payload as any).is_income;
      if (item) {
        const { error } = await supabase.from('budget_items').update(payload).eq('id', item.id);
        if (error) { alert(error.message); setLoading(false); return; }
      } else {
        const { error } = await supabase.from('budget_items').insert(payload);
        if (error) { alert(error.message); setLoading(false); return; }
      }
    } catch (err) {
      alert('Failed to save budget item');
    }
    setLoading(false);
    onSaved();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? `Edit: ${item.description}` : 'New Budget Item'} size="md">
      <div className="space-y-4">
        <Input label="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Camera rental, catering, etc." />
        {/* Income / Expense toggle */}
        <div className="flex rounded-lg border border-surface-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setForm({ ...form, is_income: false })}
            className={cn('flex-1 px-4 py-2 text-sm font-medium transition-colors',
              !form.is_income ? 'bg-brand-600/20 text-brand-400' : 'text-surface-400 hover:text-white')}
          >Expense</button>
          <button
            type="button"
            onClick={() => setForm({ ...form, is_income: true })}
            className={cn('flex-1 px-4 py-2 text-sm font-medium transition-colors',
              form.is_income ? 'bg-green-600/20 text-green-400' : 'text-surface-400 hover:text-white')}
          >Income</button>
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Category</label>
          <select value={form.category || 'other'} onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white">
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Estimated Amount" type="number" step="0.01" value={form.estimated_amount || ''} onChange={(e) => setForm({ ...form, estimated_amount: e.target.value })} />
          <Input label="Actual Amount" type="number" step="0.01" value={form.actual_amount || ''} onChange={(e) => setForm({ ...form, actual_amount: e.target.value })} />
        </div>
        <Input label="Vendor / Supplier" value={form.vendor || ''} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
        <Textarea label="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_paid || false} onChange={(e) => setForm({ ...form, is_paid: e.target.checked })} />
          <span className="text-sm text-surface-300">Marked as Paid</span>
        </label>
      </div>
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-surface-800">
        <div>{item && <Button variant="danger" size="sm" onClick={() => onDelete(item.id)}>Delete</Button>}</div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={loading}>{item ? 'Save' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  );
}
