'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Button, Badge, Input, Textarea, EmptyState, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Thumbnail } from '@/lib/types';

export default function ThumbnailsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { members, currentProject } = useProjectStore();
  const { user } = useAuthStore();
  
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingThumbnail, setEditingThumbnail] = useState<Thumbnail | null>(null);
  const [form, setForm] = useState({
    title: '',
    image_url: '',
    text_overlay: '',
    notes: '',
    a_b_test_group: '',
  });

  useEffect(() => {
    fetchThumbnails();
  }, [projectId]);

  const fetchThumbnails = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('thumbnails')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order');
    setThumbnails(data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('thumbnails')
      .insert({
        project_id: projectId,
        title: form.title || 'Untitled Thumbnail',
        image_url: form.image_url || null,
        text_overlay: form.text_overlay || null,
        notes: form.notes || null,
        a_b_test_group: form.a_b_test_group || null,
        sort_order: thumbnails.length,
      })
      .select()
      .single();
    
    if (data) {
      setThumbnails([...thumbnails, data]);
      resetForm();
    }
  };

  const handleUpdate = async () => {
    if (!editingThumbnail) return;
    const supabase = createClient();
    
    await supabase
      .from('thumbnails')
      .update({
        title: form.title,
        image_url: form.image_url || null,
        text_overlay: form.text_overlay || null,
        notes: form.notes || null,
        a_b_test_group: form.a_b_test_group || null,
      })
      .eq('id', editingThumbnail.id);

    setThumbnails(thumbnails.map(t => 
      t.id === editingThumbnail.id 
        ? { ...t, ...form } 
        : t
    ));
    resetForm();
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('thumbnails').delete().eq('id', id);
    setThumbnails(thumbnails.filter(t => t.id !== id));
  };

  const handleSetPrimary = async (id: string) => {
    const supabase = createClient();
    // First, unset all as primary
    await supabase
      .from('thumbnails')
      .update({ is_primary: false })
      .eq('project_id', projectId);
    
    // Then set the selected one as primary
    await supabase
      .from('thumbnails')
      .update({ is_primary: true })
      .eq('id', id);

    setThumbnails(thumbnails.map(t => ({
      ...t,
      is_primary: t.id === id,
    })));
  };

  const resetForm = () => {
    setForm({ title: '', image_url: '', text_overlay: '', notes: '', a_b_test_group: '' });
    setEditingThumbnail(null);
    setShowModal(false);
  };

  const openEdit = (thumbnail: Thumbnail) => {
    setEditingThumbnail(thumbnail);
    setForm({
      title: thumbnail.title,
      image_url: thumbnail.image_url || '',
      text_overlay: thumbnail.text_overlay || '',
      notes: thumbnail.notes || '',
      a_b_test_group: thumbnail.a_b_test_group || '',
    });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Thumbnails</h1>
          <p className="text-surface-400 text-sm mt-1">
            Design and A/B test thumbnail variants for your video
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowModal(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Thumbnail
          </Button>
        )}
      </div>

      {/* Tips Card */}
      <div className="bg-gradient-to-r from-brand-500/10 to-orange-500/10 border border-brand-500/20 rounded-xl p-4">
        <h3 className="font-semibold text-white text-sm mb-2">💡 Thumbnail Tips</h3>
        <ul className="text-xs text-surface-400 space-y-1">
          <li>• Use large, readable text (3-4 words max)</li>
          <li>• High contrast colors that pop against YouTube&apos;s white/dark backgrounds</li>
          <li>• Expressive faces get 30% more clicks</li>
          <li>• Test multiple variants - upload your best 2-3 and track performance</li>
        </ul>
      </div>

      {/* Thumbnails Grid */}
      {thumbnails.length === 0 ? (
        <EmptyState
          icon={<svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          title="No thumbnails yet"
          description="Create thumbnail variants to A/B test and maximize your click-through rate"
          action={canEdit && (
            <Button onClick={() => setShowModal(true)}>Create First Thumbnail</Button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {thumbnails.map((thumb) => (
            <div
              key={thumb.id}
              className={cn(
                'bg-surface-900 border rounded-xl overflow-hidden group',
                thumb.is_primary ? 'border-green-500/50 ring-1 ring-green-500/20' : 'border-surface-700'
              )}
            >
              {/* Thumbnail Preview */}
              <div className="aspect-video bg-surface-800 relative">
                {thumb.image_url ? (
                  <img
                    src={thumb.image_url}
                    alt={thumb.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-surface-600">
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {thumb.is_primary && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="success">Primary</Badge>
                  </div>
                )}
                {thumb.a_b_test_group && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="info">Variant {thumb.a_b_test_group}</Badge>
                  </div>
                )}
                {thumb.text_overlay && (
                  <div className="absolute bottom-2 left-2 right-2 bg-black/60 rounded px-2 py-1">
                    <p className="text-white text-sm font-bold truncate">{thumb.text_overlay}</p>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-medium text-white truncate">{thumb.title}</h3>
                {thumb.notes && (
                  <p className="text-xs text-surface-400 mt-1 line-clamp-2">{thumb.notes}</p>
                )}

                {/* Stats */}
                {(thumb.impressions > 0 || thumb.clicks > 0) && (
                  <div className="flex gap-4 mt-3 text-xs">
                    <div>
                      <span className="text-surface-500">Impressions</span>
                      <p className="text-white font-medium">{thumb.impressions.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-surface-500">Clicks</span>
                      <p className="text-white font-medium">{thumb.clicks.toLocaleString()}</p>
                    </div>
                    {thumb.click_rate && (
                      <div>
                        <span className="text-surface-500">CTR</span>
                        <p className="text-green-400 font-medium">{thumb.click_rate}%</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {canEdit && (
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-surface-800">
                    {!thumb.is_primary && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetPrimary(thumb.id)}
                        className="text-xs"
                      >
                        Set Primary
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(thumb)}
                      className="text-xs"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(thumb.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={resetForm}
        title={editingThumbnail ? 'Edit Thumbnail' : 'New Thumbnail'}
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Thumbnail A - High contrast version"
          />

          <Input
            label="Image URL"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            placeholder="https://..."
          />

          <Input
            label="Text Overlay"
            value={form.text_overlay}
            onChange={(e) => setForm({ ...form, text_overlay: e.target.value })}
            placeholder="The words on the thumbnail"
          />

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              A/B Test Group
            </label>
            <div className="flex gap-2">
              {['A', 'B', 'C'].map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setForm({ ...form, a_b_test_group: form.a_b_test_group === group ? '' : group })}
                  className={cn(
                    'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                    form.a_b_test_group === group
                      ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                      : 'border-surface-700 text-surface-400 hover:border-surface-600'
                  )}
                >
                  Variant {group}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Design notes, reasoning, etc."
            rows={3}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={editingThumbnail ? handleUpdate : handleCreate}>
              {editingThumbnail ? 'Save Changes' : 'Create Thumbnail'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
