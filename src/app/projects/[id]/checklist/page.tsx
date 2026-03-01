'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Button, Badge, Input, EmptyState, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { UploadChecklistItem } from '@/lib/types';
import { DEFAULT_UPLOAD_CHECKLIST } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-surface-600',
  video: 'bg-purple-500/20 text-purple-400',
  audio: 'bg-blue-500/20 text-blue-400',
  seo: 'bg-green-500/20 text-green-400',
  legal: 'bg-red-500/20 text-red-400',
  promotion: 'bg-orange-500/20 text-orange-400',
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  video: 'Video',
  audio: 'Audio',
  seo: 'SEO',
  legal: 'Legal',
  promotion: 'Promotion',
};

export default function ChecklistPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { members, currentProject } = useProjectStore();
  const { user } = useAuthStore();
  
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  const [items, setItems] = useState<UploadChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');
  const [newCategory, setNewCategory] = useState('general');

  useEffect(() => {
    fetchItems();
  }, [projectId]);

  const fetchItems = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('upload_checklist')
      .select('*')
      .eq('project_id', projectId)
      .order('category')
      .order('sort_order');
    
    // If no items exist, create default checklist
    if (!data || data.length === 0) {
      await initializeChecklist();
    } else {
      setItems(data);
      setLoading(false);
    }
  };

  const initializeChecklist = async () => {
    const supabase = createClient();
    const defaultItems = DEFAULT_UPLOAD_CHECKLIST.map((item, index) => ({
      project_id: projectId,
      item_text: item.text,
      category: item.category,
      is_default: true,
      sort_order: index,
    }));

    const { data } = await supabase
      .from('upload_checklist')
      .insert(defaultItems)
      .select();

    setItems(data || []);
    setLoading(false);
  };

  const toggleItem = async (item: UploadChecklistItem) => {
    const supabase = createClient();
    const newCompleted = !item.is_completed;
    
    await supabase
      .from('upload_checklist')
      .update({
        is_completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
        completed_by: newCompleted ? user?.id : null,
      })
      .eq('id', item.id);

    setItems(items.map(i => 
      i.id === item.id 
        ? { ...i, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
        : i
    ));
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('upload_checklist')
      .insert({
        project_id: projectId,
        item_text: newItem.trim(),
        category: newCategory,
        is_default: false,
        sort_order: items.length,
      })
      .select()
      .single();

    if (error) { toast.error('Failed to add checklist item'); return; }
    if (data) {
      setItems([...items, data]);
      setNewItem('');
    }
  };

  const deleteItem = async (id: string) => {
    const supabase = createClient();
    await supabase.from('upload_checklist').delete().eq('id', id);
    setItems(items.filter(i => i.id !== id));
  };

  const resetChecklist = async () => {
    const supabase = createClient();
    
    // Reset all items to uncompleted
    await supabase
      .from('upload_checklist')
      .update({ is_completed: false, completed_at: null, completed_by: null })
      .eq('project_id', projectId);

    setItems(items.map(i => ({ ...i, is_completed: false, completed_at: null, completed_by: null })));
  };

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, UploadChecklistItem[]>);

  const totalItems = items.length;
  const completedItems = items.filter(i => i.is_completed).length;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[#FF5F1F] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Upload Checklist</h1>
          <p className="text-surface-400 text-sm mt-1">
            Make sure everything is ready before publishing
          </p>
        </div>
        {canEdit && items.some(i => i.is_completed) && (
          <Button variant="ghost" onClick={resetChecklist}>
            Reset Checklist
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">Progress</span>
          <span className={cn(
            'text-sm font-bold',
            progress === 100 ? 'text-green-400' : 'text-surface-400'
          )}>
            {completedItems}/{totalItems} ({progress}%)
          </span>
        </div>
        <div className="h-3 bg-surface-800 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-500',
              progress === 100 ? 'bg-green-500' : 'bg-[#FF5F1F]'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        {progress === 100 && (
          <p className="text-green-400 text-sm mt-3 text-center">
            🎉 All done! Ready to publish!
          </p>
        )}
      </div>

      {/* Add Item */}
      {canEdit && (
        <div className="bg-surface-900 border border-surface-800 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add a custom checklist item..."
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              className="flex-1"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-white"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Button onClick={addItem}>Add</Button>
          </div>
        </div>
      )}

      {/* Checklist Items by Category */}
      <div className="space-y-6">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={CATEGORY_COLORS[category] || CATEGORY_COLORS.general}>
                {CATEGORY_LABELS[category] || category}
              </Badge>
              <span className="text-xs text-surface-500">
                {categoryItems.filter(i => i.is_completed).length}/{categoryItems.length}
              </span>
            </div>
            
            <div className="bg-surface-900 border border-surface-800 rounded-xl divide-y divide-surface-800">
              {categoryItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 p-4 transition-colors',
                    item.is_completed && 'bg-green-500/5'
                  )}
                >
                  <button
                    onClick={() => canEdit && toggleItem(item)}
                    disabled={!canEdit}
                    className={cn(
                      'w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                      item.is_completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-surface-600 hover:border-surface-500'
                    )}
                  >
                    {item.is_completed && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  
                  <span className={cn(
                    'flex-1 text-sm',
                    item.is_completed ? 'text-surface-500 line-through' : 'text-white'
                  )}>
                    {item.item_text}
                  </span>

                  {!item.is_default && canEdit && (
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-surface-600 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-brand-500/10 to-orange-500/10 border border-[#FF5F1F]/20 rounded-xl p-4">
        <h3 className="font-semibold text-white text-sm mb-2">💡 Publishing Tips</h3>
        <ul className="text-xs text-surface-400 space-y-1">
          <li>• Upload during your audience&apos;s peak hours (check your analytics)</li>
          <li>• Premiere videos when possible for better initial engagement</li>
          <li>• Reply to comments within the first hour to boost algorithm</li>
          <li>• Share to other platforms immediately after publishing</li>
        </ul>
      </div>
    </div>
  );
}
