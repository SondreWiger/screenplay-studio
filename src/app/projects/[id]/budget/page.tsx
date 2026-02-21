'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Card, Badge, Modal, Input, Textarea, EmptyState, LoadingSpinner, Progress } from '@/components/ui';
import { cn, formatCurrency } from '@/lib/utils';
import type { BudgetItem, BudgetCategory } from '@/lib/types';

// ============================================================
// CATEGORY DEFINITIONS
// ============================================================

const CATEGORIES: { value: BudgetCategory; label: string; icon: string; color: string }[] = [
  { value: 'above_the_line', label: 'Above the Line', icon: '🎬', color: '#f59e0b' },
  { value: 'below_the_line', label: 'Below the Line', icon: '🎥', color: '#3b82f6' },
  { value: 'talent', label: 'Talent / Cast', icon: '🎭', color: '#8b5cf6' },
  { value: 'production', label: 'Production', icon: '🎞️', color: '#10b981' },
  { value: 'equipment', label: 'Equipment', icon: '📷', color: '#6366f1' },
  { value: 'locations', label: 'Locations', icon: '📍', color: '#ef4444' },
  { value: 'props_costumes', label: 'Props & Costumes', icon: '👗', color: '#ec4899' },
  { value: 'post_production', label: 'Post-Production', icon: '🖥️', color: '#14b8a6' },
  { value: 'transportation', label: 'Transportation', icon: '🚐', color: '#f97316' },
  { value: 'catering', label: 'Catering', icon: '🍽️', color: '#84cc16' },
  { value: 'insurance', label: 'Insurance', icon: '🛡️', color: '#64748b' },
  { value: 'marketing', label: 'Marketing', icon: '📣', color: '#d946ef' },
  { value: 'contingency', label: 'Contingency', icon: '💰', color: '#eab308' },
  { value: 'other', label: 'Other', icon: '📦', color: '#78716c' },
];

const getCategoryMeta = (value: string) => CATEGORIES.find((c) => c.value === value) || CATEGORIES[CATEGORIES.length - 1];

// ============================================================
// MAIN PAGE
// ============================================================

export default function BudgetPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { members, currentProject } = useProjectStore();
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [editorDefaultIncome, setEditorDefaultIncome] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPaid, setFilterPaid] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'all' | 'income' | 'expenses'>('all');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const fetchItems = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', params.id)
        .order('category')
        .order('sort_order')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Budget fetch error:', error.message);
        return;
      }
      setItems(data || []);
      // Auto-expand sections with items
      const cats: Set<string> = new Set((data || []).map((i: BudgetItem) => i.category));
      cats.add('__income__'); // auto-expand income section
      setExpandedCats(cats);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ---- Split income vs expenses ----

  const incomeItems = useMemo(() => items.filter((i) => i.is_income), [items]);
  const expenseItems = useMemo(() => items.filter((i) => !i.is_income), [items]);

  // ---- Computed totals (always from full list, not filtered) ----

  const totalIncomeEstimated = useMemo(() => incomeItems.reduce((s, i) => s + (i.estimated_amount || 0), 0), [incomeItems]);
  const totalIncomeActual = useMemo(() => incomeItems.reduce((s, i) => s + (i.actual_amount || 0), 0), [incomeItems]);
  const totalExpenseEstimated = useMemo(() => expenseItems.reduce((s, i) => s + (i.estimated_amount || 0), 0), [expenseItems]);
  const totalExpenseActual = useMemo(() => expenseItems.reduce((s, i) => s + (i.actual_amount || 0), 0), [expenseItems]);

  const netEstimated = totalIncomeEstimated - totalExpenseEstimated;
  const netActual = totalIncomeActual - totalExpenseActual;
  const totalPaid = useMemo(() => expenseItems.filter((i) => i.is_paid).reduce((s, i) => s + (i.actual_amount || 0), 0), [expenseItems]);
  const totalUnpaid = useMemo(() => expenseItems.filter((i) => !i.is_paid).reduce((s, i) => s + (i.actual_amount || 0), 0), [expenseItems]);
  const budgetUsedPct = totalExpenseEstimated > 0 ? Math.round((totalExpenseActual / totalExpenseEstimated) * 100) : 0;

  const overdueCount = useMemo(() => {
    const now = new Date();
    return expenseItems.filter((i) => !i.is_paid && i.due_date && new Date(i.due_date) < now).length;
  }, [expenseItems]);

  // ---- Filtered items ----

  const filteredItems = useMemo(() => {
    let result = items;
    // View mode filter
    if (viewMode === 'income') result = result.filter((i) => i.is_income);
    if (viewMode === 'expenses') result = result.filter((i) => !i.is_income);
    // Category filter (only applies to expenses)
    if (filterCategory !== 'all') result = result.filter((i) => i.is_income || i.category === filterCategory);
    // Paid filter
    if (filterPaid === 'paid') result = result.filter((i) => i.is_paid);
    if (filterPaid === 'unpaid') result = result.filter((i) => !i.is_paid);
    if (filterPaid === 'overdue') result = result.filter((i) => !i.is_paid && i.due_date && new Date(i.due_date) < new Date());
    return result;
  }, [items, filterCategory, filterPaid, viewMode]);

  // Income items in filtered view
  const filteredIncome = useMemo(() => filteredItems.filter((i) => i.is_income), [filteredItems]);
  const filteredExpenses = useMemo(() => filteredItems.filter((i) => !i.is_income), [filteredItems]);

  // Group expenses by category
  const grouped = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const catItems = filteredExpenses.filter((i) => i.category === cat.value);
      return {
        ...cat,
        items: catItems,
        estimated: catItems.reduce((s, i) => s + (i.estimated_amount || 0), 0),
        actual: catItems.reduce((s, i) => s + (i.actual_amount || 0), 0),
        paidCount: catItems.filter((i) => i.is_paid).length,
      };
    }).filter((g) => g.items.length > 0);
  }, [filteredExpenses]);

  // Category breakdown bar (expenses only)
  const categoryBreakdown = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const catItems = expenseItems.filter((i) => i.category === cat.value);
      const est = catItems.reduce((s, i) => s + (i.estimated_amount || 0), 0);
      return { ...cat, estimated: est, count: catItems.length };
    }).filter((c) => c.estimated > 0).sort((a, b) => b.estimated - a.estimated);
  }, [expenseItems]);

  // ---- Handlers ----

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    const supabase = createClient();
    await supabase.from('budget_items').delete().eq('id', id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setShowEditor(false);
    setEditingItem(null);
  };

  const handleTogglePaid = async (item: BudgetItem) => {
    if (!canEdit) return;
    const supabase = createClient();
    const newPaid = !item.is_paid;
    await supabase.from('budget_items').update({ is_paid: newPaid }).eq('id', item.id);
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_paid: newPaid } : i));
  };

  const handleDuplicate = async (item: BudgetItem) => {
    if (!canEdit) return;
    const supabase = createClient();
    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = item;
    const { data } = await supabase.from('budget_items').insert({
      ...rest,
      description: item.description + ' (copy)',
      is_paid: false,
    }).select().single();
    if (data) setItems((prev) => [...prev, data]);
  };

  const openEditor = (item?: BudgetItem, asIncome?: boolean) => {
    setEditingItem(item || null);
    setEditorDefaultIncome(asIncome ?? false);
    setShowEditor(true);
  };

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const exportCSV = () => {
    const headers = ['Type', 'Category', 'Subcategory', 'Description', 'Estimated', 'Actual', 'Qty', 'Unit Cost', 'Vendor', 'Invoice', 'Paid', 'Due Date', 'Notes'];
    const rows = items.map((i) => [
      i.is_income ? 'Income' : 'Expense',
      getCategoryMeta(i.category).label,
      `"${(i.subcategory || '').replace(/"/g, '""')}"`,
      `"${(i.description || '').replace(/"/g, '""')}"`,
      i.estimated_amount,
      i.actual_amount,
      i.quantity,
      i.unit_cost || '',
      `"${(i.vendor || '').replace(/"/g, '""')}"`,
      `"${(i.invoice_ref || '').replace(/"/g, '""')}"`,
      i.is_paid ? 'Yes' : 'No',
      i.due_date || '',
      `"${(i.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-${currentProject?.title || 'project'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingSpinner className="py-32" />;

  // ---- Shared item row renderer ----
  const renderItemRow = (item: BudgetItem) => {
    const itemOver = !item.is_income && (item.actual_amount || 0) > (item.estimated_amount || 0) && (item.estimated_amount || 0) > 0;
    const isOverdue = !item.is_paid && item.due_date && new Date(item.due_date) < new Date();

    return (
      <div key={item.id}
        className="flex items-center px-4 py-2.5 hover:bg-white/[0.02] border-b border-surface-800/30 last:border-0 group">
        {/* Description + vendor + due */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEditor(item)}>
          <div className="flex items-center gap-2">
            {item.is_income && <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">INCOME</span>}
            <p className="text-sm text-white truncate">{item.description}</p>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {item.vendor && <span className="text-[11px] text-surface-500">{item.vendor}</span>}
            {item.due_date && (
              <span className={cn('text-[11px]', isOverdue ? 'text-red-400' : 'text-surface-500')}>
                {isOverdue ? '⚠ ' : ''}Due {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {item.invoice_ref && <span className="text-[11px] text-surface-600">#{item.invoice_ref}</span>}
          </div>
        </div>
        {/* Quantity */}
        <div className="w-14 text-center text-xs text-surface-400 hidden sm:block">
          {item.quantity > 1 ? `×${item.quantity}` : '—'}
        </div>
        {/* Estimated */}
        <div className="w-24 text-right text-sm text-surface-400 hidden sm:block">
          {item.is_income ? (
            <span className="text-green-400/70">{formatCurrency(item.estimated_amount || 0)}</span>
          ) : (
            formatCurrency(item.estimated_amount || 0)
          )}
        </div>
        {/* Actual */}
        <div className="w-20 sm:w-24 text-right">
          <span className={cn('text-xs sm:text-sm font-medium', item.is_income ? 'text-green-400' : itemOver ? 'text-red-400' : 'text-white')}>
            {formatCurrency(item.actual_amount || 0)}
          </span>
        </div>
        {/* Paid/Unpaid status */}
        <div className="w-16 sm:w-20 flex justify-center">
          {item.is_income ? (
            canEdit ? (
              <button
                onClick={(e) => { e.stopPropagation(); handleTogglePaid(item); }}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-semibold rounded-full transition-colors',
                  item.is_paid
                    ? 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
                    : 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
                )}
              >
                {item.is_paid ? '✓ Received' : 'Pending'}
              </button>
            ) : (
              <Badge size="sm" variant={item.is_paid ? 'success' : 'info'}>
                {item.is_paid ? 'Received' : 'Pending'}
              </Badge>
            )
          ) : (
            canEdit ? (
              <button
                onClick={(e) => { e.stopPropagation(); handleTogglePaid(item); }}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-semibold rounded-full transition-colors',
                  item.is_paid
                    ? 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
                    : isOverdue
                      ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                      : 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                )}
              >
                {item.is_paid ? '✓ Paid' : isOverdue ? 'Overdue' : 'Unpaid'}
              </button>
            ) : (
              <Badge size="sm" variant={item.is_paid ? 'success' : 'warning'}>
                {item.is_paid ? 'Paid' : 'Unpaid'}
              </Badge>
            )
          )}
        </div>
        {/* Actions */}
        {canEdit && (
          <div className="w-8 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); openEditor(item); }}
              className="p-1 text-surface-500 hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Budget</h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {items.length} line item{items.length !== 1 ? 's' : ''}
            {overdueCount > 0 && <span className="text-red-400 ml-2">· {overdueCount} overdue</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button onClick={exportCSV} className="px-3 py-2 text-xs font-medium text-surface-400 hover:text-white bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors">
              ↓ CSV
            </button>
          )}
          {canEdit && (
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => openEditor(undefined, true)}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Income
              </Button>
              <Button onClick={() => openEditor(undefined, false)}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Expense
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ---- Summary Cards ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <p className="text-[11px] font-medium text-green-500/80 uppercase tracking-wider mb-1">Income</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency(totalIncomeActual)}</p>
          <p className="text-xs text-surface-500 mt-1">
            {incomeItems.length} source{incomeItems.length !== 1 ? 's' : ''}
            {totalIncomeEstimated > 0 && totalIncomeEstimated !== totalIncomeActual && (
              <span className="ml-1">· {formatCurrency(totalIncomeEstimated)} expected</span>
            )}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium text-red-500/80 uppercase tracking-wider mb-1">Expenses</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalExpenseActual)}</p>
          {totalExpenseEstimated > 0 && (
            <Progress value={Math.min(budgetUsedPct, 100)} max={100} showPercent={false}
              color={budgetUsedPct > 100 ? '#ef4444' : budgetUsedPct > 80 ? '#f59e0b' : '#10b981'} className="mt-2" />
          )}
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium text-surface-500 uppercase tracking-wider mb-1">Net Balance</p>
          <p className={cn('text-xl font-bold', netActual >= 0 ? 'text-green-400' : 'text-red-400')}>
            {netActual >= 0 ? '+' : ''}{formatCurrency(netActual)}
          </p>
          <p className="text-xs text-surface-500 mt-1">
            {netEstimated >= 0 ? '+' : ''}{formatCurrency(netEstimated)} projected
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium text-surface-500 uppercase tracking-wider mb-1">Payment</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-sm font-semibold text-green-400">{formatCurrency(totalPaid)}</span>
            <span className="text-[10px] text-surface-500">paid</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-amber-400">{formatCurrency(totalUnpaid)}</span>
            <span className="text-[10px] text-surface-500">outstanding</span>
          </div>
        </Card>
      </div>

      {/* ---- Expense Category Breakdown Bar ---- */}
      {categoryBreakdown.length > 0 && totalExpenseEstimated > 0 && (
        <div className="mb-6">
          <div className="flex h-3 rounded-full overflow-hidden bg-surface-800">
            {categoryBreakdown.map((cat) => (
              <div
                key={cat.value}
                title={`${cat.label}: ${formatCurrency(cat.estimated)} (${Math.round((cat.estimated / totalExpenseEstimated) * 100)}%)`}
                className="transition-all duration-300 first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(cat.estimated / totalExpenseEstimated) * 100}%`, backgroundColor: cat.color }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {categoryBreakdown.slice(0, 6).map((cat) => (
              <div key={cat.value} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-[10px] text-surface-400">
                  {cat.label} {Math.round((cat.estimated / totalExpenseEstimated) * 100)}%
                </span>
              </div>
            ))}
            {categoryBreakdown.length > 6 && (
              <span className="text-[10px] text-surface-500">+{categoryBreakdown.length - 6} more</span>
            )}
          </div>
        </div>
      )}

      {/* ---- Filters ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        {/* View mode: All / Income / Expenses */}
        <div className="flex gap-1 bg-surface-800/50 p-0.5 rounded-lg">
          {(['all', 'income', 'expenses'] as const).map((v) => (
            <button key={v} onClick={() => setViewMode(v)} className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors',
              viewMode === v ? 'bg-surface-700 text-white shadow-sm' : 'text-surface-400 hover:text-white'
            )}>
              {v === 'income' && '↓ '}{v === 'expenses' && '↑ '}{v}
            </button>
          ))}
        </div>

        {/* Category filter (only for expenses) */}
        {viewMode !== 'income' && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setFilterCategory('all')} className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
              filterCategory === 'all' ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white hover:bg-surface-800'
            )}>All Categories</button>
            {CATEGORIES.filter((c) => expenseItems.some((i) => i.category === c.value)).map((c) => (
              <button key={c.value} onClick={() => setFilterCategory(c.value)} className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                filterCategory === c.value ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white hover:bg-surface-800'
              )}>{c.icon} {c.label}</button>
            ))}
          </div>
        )}

        {/* Paid status filter */}
        <div className="flex gap-1.5 sm:ml-auto shrink-0">
          {(['all', 'paid', 'unpaid', 'overdue'] as const).map((f) => (
            <button key={f} onClick={() => setFilterPaid(f)} className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors',
              filterPaid === f ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white hover:bg-surface-800'
            )}>
              {f === 'overdue' && overdueCount > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1" />}
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Budget Items ---- */}
      {filteredItems.length === 0 ? (
        items.length === 0 ? (
          <EmptyState
            title="No budget items yet"
            description="Track your production income and expenses. Add funding sources as income and costs as expenses."
            action={canEdit ? (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => openEditor(undefined, true)}>Add Income</Button>
                <Button onClick={() => openEditor(undefined, false)}>Add Expense</Button>
              </div>
            ) : undefined}
          />
        ) : (
          <div className="text-center py-16">
            <p className="text-sm text-surface-400">No items match the current filters.</p>
            <button onClick={() => { setFilterCategory('all'); setFilterPaid('all'); setViewMode('all'); }} className="text-xs text-brand-400 hover:text-brand-300 mt-2">
              Clear filters
            </button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {/* ---- INCOME SECTION ---- */}
          {filteredIncome.length > 0 && (
            <div className="bg-surface-900 rounded-xl border border-green-500/20 overflow-hidden">
              {/* Income header */}
              <button onClick={() => toggleCat('__income__')}
                className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-green-500/10">
                    💵
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-semibold text-green-400">Income & Funding</h3>
                    <p className="text-[11px] text-surface-500">
                      {filteredIncome.length} source{filteredIncome.length !== 1 ? 's' : ''}
                      · {filteredIncome.filter((i) => i.is_paid).length} received
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-green-400/70">
                      {formatCurrency(filteredIncome.reduce((s, i) => s + (i.estimated_amount || 0), 0))}
                    </p>
                    <p className="text-[10px] text-surface-500">expected</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-400">
                      {formatCurrency(filteredIncome.reduce((s, i) => s + (i.actual_amount || 0), 0))}
                    </p>
                    <p className="text-[10px] text-surface-500">received</p>
                  </div>
                  <svg className={cn('w-4 h-4 text-surface-500 transition-transform', expandedCats.has('__income__') ? 'rotate-180' : '')}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedCats.has('__income__') && (
                <div className="border-t border-green-500/10">
                  {/* Column headers */}
                  <div className="flex items-center px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-surface-500 border-b border-surface-800/50 bg-surface-900/50">
                    <div className="flex-1">Source</div>
                    <div className="w-14 text-center hidden sm:block">Qty</div>
                    <div className="w-24 text-right hidden sm:block">Expected</div>
                    <div className="w-24 text-right">Received</div>
                    <div className="w-20 text-center">Status</div>
                    {canEdit && <div className="w-8" />}
                  </div>
                  {filteredIncome.map(renderItemRow)}
                  {/* Income total */}
                  <div className="flex items-center px-4 py-2 bg-green-500/5 text-xs font-medium">
                    <div className="flex-1 text-green-400/70">Total Income</div>
                    <div className="w-14 hidden sm:block" />
                    <div className="w-24 text-right text-green-400/70 hidden sm:block">
                      {formatCurrency(filteredIncome.reduce((s, i) => s + (i.estimated_amount || 0), 0))}
                    </div>
                    <div className="w-24 text-right text-green-400 font-semibold">
                      {formatCurrency(filteredIncome.reduce((s, i) => s + (i.actual_amount || 0), 0))}
                    </div>
                    <div className="w-20" />
                    {canEdit && <div className="w-8" />}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- EXPENSE SECTIONS (grouped by category) ---- */}
          {grouped.map((group) => {
            const catMeta = getCategoryMeta(group.value);
            const isExpanded = expandedCats.has(group.value);
            const catVariance = group.estimated - group.actual;
            const catOver = catVariance < 0;

            return (
              <div key={group.value} className="bg-surface-900 rounded-xl border border-surface-800 overflow-hidden">
                {/* Category header */}
                <button onClick={() => toggleCat(group.value)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: catMeta.color + '20' }}>
                      {catMeta.icon}
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-white">{group.label}</h3>
                      <p className="text-[11px] text-surface-500">{group.items.length} item{group.items.length !== 1 ? 's' : ''} · {group.paidCount} paid</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium text-surface-300">{formatCurrency(group.estimated)}</p>
                      <p className="text-[10px] text-surface-500">estimated</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-medium', catOver ? 'text-red-400' : 'text-white')}>
                        {formatCurrency(group.actual)}
                      </p>
                      <p className="text-[10px] text-surface-500">actual</p>
                    </div>
                    <div className="text-right hidden sm:block w-20">
                      <p className={cn('text-xs font-medium', catOver ? 'text-red-400' : 'text-green-400')}>
                        {catOver ? '' : '+'}{formatCurrency(catVariance)}
                      </p>
                    </div>
                    <svg className={cn('w-4 h-4 text-surface-500 transition-transform', isExpanded ? 'rotate-180' : '')}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Items list */}
                {isExpanded && (
                  <div className="border-t border-surface-800">
                    {/* Column headers */}
                    <div className="flex items-center px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-surface-500 border-b border-surface-800/50 bg-surface-900/50">
                      <div className="flex-1">Item</div>
                      <div className="w-14 text-center hidden sm:block">Qty</div>
                      <div className="w-24 text-right hidden sm:block">Estimated</div>
                      <div className="w-24 text-right">Actual</div>
                      <div className="w-20 text-center">Status</div>
                      {canEdit && <div className="w-8" />}
                    </div>
                    {group.items.map(renderItemRow)}
                    {/* Category total row */}
                    <div className="flex items-center px-4 py-2 bg-surface-800/30 text-xs font-medium">
                      <div className="flex-1 text-surface-400">Subtotal</div>
                      <div className="w-14 hidden sm:block" />
                      <div className="w-24 text-right text-surface-400 hidden sm:block">{formatCurrency(group.estimated)}</div>
                      <div className="w-24 text-right text-white">{formatCurrency(group.actual)}</div>
                      <div className="w-20" />
                      {canEdit && <div className="w-8" />}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ---- Net Summary Row ---- */}
          <div className="bg-surface-800/50 rounded-xl border border-surface-700 p-4">
            {/* Income total */}
            {incomeItems.length > 0 && (
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-surface-700/50">
                <span className="text-xs font-medium text-green-400">Total Income</span>
                <div className="flex items-center gap-5">
                  <div className="text-right hidden sm:block">
                    <span className="text-xs text-green-400/60">{formatCurrency(totalIncomeEstimated)}</span>
                  </div>
                  <span className="text-sm font-semibold text-green-400">{formatCurrency(totalIncomeActual)}</span>
                  <div className="w-20 hidden sm:block" />
                </div>
              </div>
            )}
            {/* Expense total */}
            <div className={cn('flex items-center justify-between', incomeItems.length > 0 ? 'mb-2 pb-2 border-b border-surface-700/50' : '')}>
              <span className="text-xs font-medium text-surface-400">Total Expenses</span>
              <div className="flex items-center gap-5">
                <div className="text-right hidden sm:block">
                  <span className="text-xs text-surface-500">{formatCurrency(totalExpenseEstimated)}</span>
                </div>
                <span className="text-sm font-semibold text-white">{formatCurrency(totalExpenseActual)}</span>
                <div className="w-20 hidden sm:block">
                  {totalExpenseEstimated > 0 && (
                    <span className={cn('text-xs', totalExpenseActual > totalExpenseEstimated ? 'text-red-400' : 'text-green-400')}>
                      {totalExpenseActual > totalExpenseEstimated ? '' : '+'}{formatCurrency(totalExpenseEstimated - totalExpenseActual)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Net balance (only shown when there's income) */}
            {incomeItems.length > 0 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-bold text-white">Net Balance</span>
                <div className="flex items-center gap-5">
                  <div className="text-right hidden sm:block">
                    <span className={cn('text-xs', netEstimated >= 0 ? 'text-green-400/60' : 'text-red-400/60')}>
                      {netEstimated >= 0 ? '+' : ''}{formatCurrency(netEstimated)}
                    </span>
                  </div>
                  <span className={cn('text-lg font-bold', netActual >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {netActual >= 0 ? '+' : ''}{formatCurrency(netActual)}
                  </span>
                  <div className="w-20 hidden sm:block" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Editor Modal ---- */}
      {showEditor && (
        <BudgetEditor
          isOpen={showEditor}
          onClose={() => { setShowEditor(false); setEditingItem(null); }}
          item={editingItem}
          projectId={params.id}
          userId={user?.id || ''}
          onSaved={() => { fetchItems(); setShowEditor(false); setEditingItem(null); }}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          canEdit={canEdit}
          defaultIncome={editorDefaultIncome}
        />
      )}
    </div>
  );
}

// ============================================================
// BUDGET EDITOR MODAL
// ============================================================

interface EditorForm {
  description: string;
  category: BudgetCategory;
  subcategory: string;
  is_income: boolean;
  estimated_amount: string;
  actual_amount: string;
  quantity: string;
  unit_cost: string;
  vendor: string;
  invoice_ref: string;
  notes: string;
  is_paid: boolean;
  due_date: string;
}

const emptyForm: EditorForm = {
  description: '',
  category: 'other',
  subcategory: '',
  is_income: false,
  estimated_amount: '',
  actual_amount: '',
  quantity: '1',
  unit_cost: '',
  vendor: '',
  invoice_ref: '',
  notes: '',
  is_paid: false,
  due_date: '',
};

function BudgetEditor({ isOpen, onClose, item, projectId, userId, onSaved, onDelete, onDuplicate, canEdit, defaultIncome }: {
  isOpen: boolean;
  onClose: () => void;
  item: BudgetItem | null;
  projectId: string;
  userId: string;
  onSaved: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (item: BudgetItem) => void;
  canEdit: boolean;
  defaultIncome: boolean;
}) {
  const [form, setForm] = useState<EditorForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useUnitCost, setUseUnitCost] = useState(false);

  useEffect(() => {
    if (item) {
      const hasUnitCost = (item.unit_cost !== null && item.unit_cost > 0) || item.quantity > 1;
      setUseUnitCost(hasUnitCost);
      setForm({
        description: item.description || '',
        category: item.category,
        subcategory: item.subcategory || '',
        is_income: item.is_income || false,
        estimated_amount: item.estimated_amount ? String(item.estimated_amount) : '',
        actual_amount: item.actual_amount ? String(item.actual_amount) : '',
        quantity: String(item.quantity || 1),
        unit_cost: item.unit_cost ? String(item.unit_cost) : '',
        vendor: item.vendor || '',
        invoice_ref: item.invoice_ref || '',
        notes: item.notes || '',
        is_paid: item.is_paid || false,
        due_date: item.due_date ? item.due_date.split('T')[0] : '',
      });
    } else {
      setForm({ ...emptyForm, is_income: defaultIncome });
      setUseUnitCost(false);
    }
    setError(null);
  }, [item, isOpen]);

  // Auto-calculate estimated from qty × unit cost
  useEffect(() => {
    if (useUnitCost && form.unit_cost && form.quantity) {
      const qty = parseInt(form.quantity) || 1;
      const uc = parseFloat(form.unit_cost) || 0;
      const total = qty * uc;
      if (total > 0) {
        setForm((f) => ({ ...f, estimated_amount: total.toFixed(2) }));
      }
    }
  }, [form.unit_cost, form.quantity, useUnitCost]);

  const updateField = (field: keyof EditorForm, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.description.trim()) {
      setError('Description is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        project_id: projectId,
        category: form.category,
        subcategory: form.subcategory.trim() || null,
        description: form.description.trim(),
        is_income: form.is_income,
        estimated_amount: parseFloat(form.estimated_amount) || 0,
        actual_amount: parseFloat(form.actual_amount) || 0,
        quantity: parseInt(form.quantity) || 1,
        unit_cost: useUnitCost ? (parseFloat(form.unit_cost) || null) : null,
        vendor: form.vendor.trim() || null,
        invoice_ref: form.invoice_ref.trim() || null,
        notes: form.notes.trim() || null,
        is_paid: form.is_paid,
        due_date: form.due_date || null,
      };

      if (item) {
        const { error: err } = await supabase.from('budget_items').update(payload).eq('id', item.id);
        if (err) { setError(err.message); setSaving(false); return; }
      } else {
        payload.created_by = userId;
        const { error: err } = await supabase.from('budget_items').insert(payload);
        if (err) { setError(err.message); setSaving(false); return; }
      }
      onSaved();
    } catch {
      setError('Failed to save');
    }
    setSaving(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? `Edit: ${item.description}` : form.is_income ? 'Add Income Source' : 'Add Expense'} size="md">
      <div className="space-y-4">
        {/* Income / Expense toggle */}
        <div className="flex gap-1 bg-surface-800/50 p-0.5 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => updateField('is_income', false)}
            className={cn(
              'px-4 py-2 rounded-md text-xs font-semibold transition-colors',
              !form.is_income ? 'bg-surface-700 text-white shadow-sm' : 'text-surface-400 hover:text-white'
            )}
          >
            ↑ Expense
          </button>
          <button
            type="button"
            onClick={() => updateField('is_income', true)}
            className={cn(
              'px-4 py-2 rounded-md text-xs font-semibold transition-colors',
              form.is_income ? 'bg-green-500/20 text-green-400 shadow-sm' : 'text-surface-400 hover:text-white'
            )}
          >
            ↓ Income
          </button>
        </div>

        {/* Description */}
        <Input
          label={form.is_income ? 'Income Source *' : 'Description *'}
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder={form.is_income ? 'Investment, grant, crowdfunding, etc.' : 'Camera rental, actor fee, catering, etc.'}
        />

        {/* Category + Subcategory (expenses only — income doesn't need categories) */}
        {!form.is_income && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
            <Input
              label="Subcategory"
              value={form.subcategory}
              onChange={(e) => updateField('subcategory', e.target.value)}
              placeholder="Grip, Lighting, etc."
            />
          </div>
        )}

        {/* Unit cost toggle (expenses only) */}
        {!form.is_income && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useUnitCost}
              onChange={(e) => setUseUnitCost(e.target.checked)}
              className="rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-xs text-surface-400">Use quantity × unit cost</span>
          </label>
        )}

        {/* Amounts */}
        {!form.is_income && useUnitCost ? (
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Quantity"
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => updateField('quantity', e.target.value)}
            />
            <Input
              label="Unit Cost ($)"
              type="number"
              step="0.01"
              value={form.unit_cost}
              onChange={(e) => updateField('unit_cost', e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Estimated Total</label>
              <div className="px-3 py-2.5 rounded-lg border border-surface-700 bg-surface-800/50 text-sm text-surface-300">
                {formatCurrency(parseFloat(form.estimated_amount) || 0)}
              </div>
            </div>
          </div>
        ) : (
          <Input
            label={form.is_income ? 'Expected Amount ($)' : 'Estimated Amount ($)'}
            type="number"
            step="0.01"
            value={form.estimated_amount}
            onChange={(e) => updateField('estimated_amount', e.target.value)}
            placeholder="0.00"
          />
        )}

        <Input
          label={form.is_income ? 'Actual Received ($)' : 'Actual Amount ($)'}
          type="number"
          step="0.01"
          value={form.actual_amount}
          onChange={(e) => updateField('actual_amount', e.target.value)}
          placeholder="0.00"
        />

        {/* Vendor + Invoice */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={form.is_income ? 'Source / Funder' : 'Vendor / Supplier'}
            value={form.vendor}
            onChange={(e) => updateField('vendor', e.target.value)}
            placeholder={form.is_income ? 'Investor name, fund, etc.' : 'Company name'}
          />
          <Input
            label="Reference"
            value={form.invoice_ref}
            onChange={(e) => updateField('invoice_ref', e.target.value)}
            placeholder={form.is_income ? 'Contract #, ref.' : '#INV-001'}
          />
        </div>

        {/* Due date */}
        <Input
          label={form.is_income ? 'Expected Date' : 'Due Date'}
          type="date"
          value={form.due_date}
          onChange={(e) => updateField('due_date', e.target.value)}
        />

        {/* Notes */}
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          rows={2}
          placeholder="Additional details..."
        />

        {/* Paid / Received toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_paid}
            onChange={(e) => updateField('is_paid', e.target.checked)}
            className="rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500"
          />
          <span className="text-sm text-surface-300">{form.is_income ? 'Funds Received' : 'Marked as Paid'}</span>
        </label>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-surface-800">
        <div className="flex gap-2">
          {canEdit && item && (
            <>
              <Button variant="danger" size="sm" onClick={() => {
                if (confirm('Delete this budget item?')) onDelete(item.id);
              }}>Delete</Button>
              <button
                onClick={() => { onDuplicate(item); onClose(); }}
                className="px-3 py-1.5 text-xs font-medium text-surface-400 hover:text-white bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
              >
                Duplicate
              </button>
            </>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {canEdit && <Button onClick={handleSave} loading={saving}>{item ? 'Save Changes' : form.is_income ? 'Add Income' : 'Add Expense'}</Button>}
        </div>
      </div>
    </Modal>
  );
}
