'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProjectStore, useAuthStore } from '@/lib/stores';
import { Button, Badge, Input, Textarea, Select, EmptyState, Modal } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import type { SponsorSegment, SponsorSegmentType } from '@/lib/types';

const SEGMENT_TYPES: { value: SponsorSegmentType; label: string; description: string }[] = [
  { value: 'pre_roll', label: 'Pre-roll', description: 'Beginning of video' },
  { value: 'mid_roll', label: 'Mid-roll', description: 'Middle of video' },
  { value: 'post_roll', label: 'Post-roll', description: 'End of video' },
  { value: 'integration', label: 'Integration', description: 'Woven into content' },
];

const PAYMENT_STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  invoiced: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-green-500/20 text-green-400',
};

export default function SponsorsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { members, currentProject } = useProjectStore();
  const { user } = useAuthStore();
  
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : 'viewer');
  const canEdit = currentUserRole !== 'viewer';

  const [sponsors, setSponsors] = useState<SponsorSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<SponsorSegment | null>(null);
  const [talkingPointInput, setTalkingPointInput] = useState('');
  const [form, setForm] = useState({
    sponsor_name: '',
    segment_type: 'mid_roll' as SponsorSegmentType,
    script_text: '',
    talking_points: [] as string[],
    cta_link: '',
    promo_code: '',
    payment_amount: '',
    payment_status: 'pending' as 'pending' | 'invoiced' | 'paid',
    due_date: '',
    notes: '',
    start_time: '',
    end_time: '',
    is_disclosed: true,
  });

  useEffect(() => {
    fetchSponsors();
  }, [projectId]);

  const fetchSponsors = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('sponsor_segments')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order');
    setSponsors(data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('sponsor_segments')
      .insert({
        project_id: projectId,
        sponsor_name: form.sponsor_name,
        segment_type: form.segment_type,
        script_text: form.script_text || null,
        talking_points: form.talking_points,
        cta_link: form.cta_link || null,
        promo_code: form.promo_code || null,
        payment_amount: form.payment_amount ? parseFloat(form.payment_amount) : null,
        payment_status: form.payment_status,
        due_date: form.due_date || null,
        notes: form.notes || null,
        start_time: form.start_time ? parseInt(form.start_time) : null,
        end_time: form.end_time ? parseInt(form.end_time) : null,
        is_disclosed: form.is_disclosed,
        sort_order: sponsors.length,
      })
      .select()
      .single();

    if (data) {
      setSponsors([...sponsors, data]);
      resetForm();
    }
  };

  const handleUpdate = async () => {
    if (!editingSponsor) return;
    const supabase = createClient();

    await supabase
      .from('sponsor_segments')
      .update({
        sponsor_name: form.sponsor_name,
        segment_type: form.segment_type,
        script_text: form.script_text || null,
        talking_points: form.talking_points,
        cta_link: form.cta_link || null,
        promo_code: form.promo_code || null,
        payment_amount: form.payment_amount ? parseFloat(form.payment_amount) : null,
        payment_status: form.payment_status,
        due_date: form.due_date || null,
        notes: form.notes || null,
        start_time: form.start_time ? parseInt(form.start_time) : null,
        end_time: form.end_time ? parseInt(form.end_time) : null,
        is_disclosed: form.is_disclosed,
      })
      .eq('id', editingSponsor.id);

    setSponsors(sponsors.map(s =>
      s.id === editingSponsor.id
        ? { 
            ...s, 
            ...form, 
            payment_amount: form.payment_amount ? parseFloat(form.payment_amount) : null,
            start_time: form.start_time ? parseInt(form.start_time) : null,
            end_time: form.end_time ? parseInt(form.end_time) : null,
          }
        : s
    ));
    resetForm();
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('sponsor_segments').delete().eq('id', id);
    setSponsors(sponsors.filter(s => s.id !== id));
  };

  const resetForm = () => {
    setForm({
      sponsor_name: '',
      segment_type: 'mid_roll',
      script_text: '',
      talking_points: [],
      cta_link: '',
      promo_code: '',
      payment_amount: '',
      payment_status: 'pending',
      due_date: '',
      notes: '',
      start_time: '',
      end_time: '',
      is_disclosed: true,
    });
    setEditingSponsor(null);
    setShowModal(false);
    setTalkingPointInput('');
  };

  const openEdit = (sponsor: SponsorSegment) => {
    setEditingSponsor(sponsor);
    setForm({
      sponsor_name: sponsor.sponsor_name,
      segment_type: sponsor.segment_type,
      script_text: sponsor.script_text || '',
      talking_points: sponsor.talking_points || [],
      cta_link: sponsor.cta_link || '',
      promo_code: sponsor.promo_code || '',
      payment_amount: sponsor.payment_amount?.toString() || '',
      payment_status: sponsor.payment_status,
      due_date: sponsor.due_date || '',
      notes: sponsor.notes || '',
      start_time: sponsor.start_time?.toString() || '',
      end_time: sponsor.end_time?.toString() || '',
      is_disclosed: sponsor.is_disclosed,
    });
    setShowModal(true);
  };

  const addTalkingPoint = () => {
    if (!talkingPointInput.trim()) return;
    setForm({ ...form, talking_points: [...form.talking_points, talkingPointInput.trim()] });
    setTalkingPointInput('');
  };

  const removeTalkingPoint = (index: number) => {
    setForm({ ...form, talking_points: form.talking_points.filter((_, i) => i !== index) });
  };

  const totalEarnings = sponsors
    .filter(s => s.payment_status === 'paid')
    .reduce((sum, s) => sum + (s.payment_amount || 0), 0);

  const pendingEarnings = sponsors
    .filter(s => s.payment_status !== 'paid')
    .reduce((sum, s) => sum + (s.payment_amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sponsors & Segments</h1>
          <p className="text-surface-400 text-sm mt-1">
            Track sponsorships, ad reads, and payments
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowModal(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Sponsor
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {sponsors.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-4">
            <p className="text-surface-500 text-sm">Total Sponsors</p>
            <p className="text-2xl font-bold text-white mt-1">{sponsors.length}</p>
          </div>
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-4">
            <p className="text-surface-500 text-sm">Paid Revenue</p>
            <p className="text-2xl font-bold text-green-400 mt-1">${totalEarnings.toLocaleString()}</p>
          </div>
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-4">
            <p className="text-surface-500 text-sm">Pending Revenue</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">${pendingEarnings.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Sponsors List */}
      {sponsors.length === 0 ? (
        <EmptyState
          icon={<svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          title="No sponsors yet"
          description="Track your sponsorships, ad reads, and integrations here"
          action={canEdit && (
            <Button onClick={() => setShowModal(true)}>Add First Sponsor</Button>
          )}
        />
      ) : (
        <div className="space-y-4">
          {sponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className="bg-surface-900 border border-surface-800 rounded-xl p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-white text-lg">{sponsor.sponsor_name}</h3>
                    <Badge variant="info">
                      {SEGMENT_TYPES.find(t => t.value === sponsor.segment_type)?.label}
                    </Badge>
                    <Badge className={PAYMENT_STATUS_COLORS[sponsor.payment_status]}>
                      {sponsor.payment_status.charAt(0).toUpperCase() + sponsor.payment_status.slice(1)}
                    </Badge>
                    {!sponsor.is_disclosed && (
                      <Badge variant="error">⚠️ Not Disclosed</Badge>
                    )}
                  </div>

                  {sponsor.script_text && (
                    <p className="text-surface-400 text-sm mt-3 line-clamp-2">{sponsor.script_text}</p>
                  )}

                  {sponsor.talking_points && sponsor.talking_points.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-surface-500 mb-1">Talking Points:</p>
                      <ul className="text-sm text-surface-300 space-y-1">
                        {sponsor.talking_points.slice(0, 3).map((point, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-brand-400">•</span>
                            {point}
                          </li>
                        ))}
                        {sponsor.talking_points.length > 3 && (
                          <li className="text-surface-500">+{sponsor.talking_points.length - 3} more...</li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 mt-4 text-sm">
                    {sponsor.promo_code && (
                      <div>
                        <span className="text-surface-500">Promo Code: </span>
                        <span className="text-white font-mono bg-surface-800 px-2 py-0.5 rounded">
                          {sponsor.promo_code}
                        </span>
                      </div>
                    )}
                    {sponsor.cta_link && (
                      <div>
                        <span className="text-surface-500">Link: </span>
                        <a href={sponsor.cta_link} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
                          {sponsor.cta_link.replace(/^https?:\/\//, '').slice(0, 30)}...
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {sponsor.payment_amount && (
                    <p className="text-xl font-bold text-white">${sponsor.payment_amount.toLocaleString()}</p>
                  )}
                  {sponsor.due_date && (
                    <p className="text-xs text-surface-500 mt-1">
                      Due: {formatDate(sponsor.due_date)}
                    </p>
                  )}
                  {canEdit && (
                    <div className="flex gap-2 mt-3 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(sponsor)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => handleDelete(sponsor.id)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={resetForm}
        title={editingSponsor ? 'Edit Sponsor' : 'Add Sponsor'}
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <Input
            label="Sponsor Name"
            value={form.sponsor_name}
            onChange={(e) => setForm({ ...form, sponsor_name: e.target.value })}
            placeholder="e.g., Bored VPN, Skillshare"
            required
          />

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Segment Type</label>
            <div className="grid grid-cols-2 gap-2">
              {SEGMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm({ ...form, segment_type: type.value })}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    form.segment_type === type.value
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-surface-700 hover:border-surface-600'
                  )}
                >
                  <p className={cn('text-sm font-medium', form.segment_type === type.value ? 'text-brand-400' : 'text-white')}>
                    {type.label}
                  </p>
                  <p className="text-xs text-surface-500">{type.description}</p>
                </button>
              ))}
            </div>
          </div>

          <Textarea
            label="Script / Ad Read"
            value={form.script_text}
            onChange={(e) => setForm({ ...form, script_text: e.target.value })}
            placeholder="The exact script to read..."
            rows={4}
          />

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Talking Points</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={talkingPointInput}
                onChange={(e) => setTalkingPointInput(e.target.value)}
                placeholder="Add a talking point..."
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTalkingPoint())}
              />
              <Button type="button" onClick={addTalkingPoint}>Add</Button>
            </div>
            <div className="space-y-1">
              {form.talking_points.map((point, i) => (
                <div key={i} className="flex items-center gap-2 bg-surface-800 rounded px-3 py-2">
                  <span className="text-sm text-surface-300 flex-1">{point}</span>
                  <button onClick={() => removeTalkingPoint(i)} className="text-surface-500 hover:text-red-400">×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Promo Code"
              value={form.promo_code}
              onChange={(e) => setForm({ ...form, promo_code: e.target.value })}
              placeholder="MYCODE20"
            />
            <Input
              label="CTA Link"
              value={form.cta_link}
              onChange={(e) => setForm({ ...form, cta_link: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Time (seconds)"
              type="number"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              placeholder="120"
            />
            <Input
              label="End Time (seconds)"
              type="number"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              placeholder="180"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Payment Amount ($)"
              type="number"
              value={form.payment_amount}
              onChange={(e) => setForm({ ...form, payment_amount: e.target.value })}
              placeholder="500"
            />
            <Select
              label="Payment Status"
              value={form.payment_status}
              onChange={(e) => setForm({ ...form, payment_status: e.target.value as any })}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'invoiced', label: 'Invoiced' },
                { value: 'paid', label: 'Paid' },
              ]}
            />
            <Input
              label="Due Date"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Internal notes..."
            rows={2}
          />

          <label className="flex items-center gap-2 text-sm text-surface-300">
            <input
              type="checkbox"
              checked={form.is_disclosed}
              onChange={(e) => setForm({ ...form, is_disclosed: e.target.checked })}
              className="rounded border-surface-600"
            />
            Disclosed as sponsored content (FTC compliance)
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-800">
            <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            <Button onClick={editingSponsor ? handleUpdate : handleCreate}>
              {editingSponsor ? 'Save Changes' : 'Add Sponsor'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
