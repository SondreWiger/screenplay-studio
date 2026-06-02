'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Textarea } from '@/components/ui';
import type { Quote, QuoteInsert, QuoteGroup } from '@/lib/types';

interface QuoteFormProps {
  initial?: Quote | null;
  groups: string[];
  sharedGroups?: QuoteGroup[];
  onSubmit: (data: QuoteInsert) => void;
  onCancel: () => void;
}

export function QuoteForm({ initial, groups, sharedGroups, onSubmit, onCancel }: QuoteFormProps) {
  const [content, setContent] = useState(initial?.content || '');
  const [saidBy, setSaidBy] = useState(initial?.said_by || '');
  const [saidAt, setSaidAt] = useState(initial?.said_at?.split('T')[0] || '');
  const [context, setContext] = useState(initial?.context || '');
  const [location, setLocation] = useState(initial?.location || '');
  const [groupId, setGroupId] = useState(initial?.group_id || '');
  const [groupName, setGroupName] = useState(initial?.group_name || '');
  const [newGroup, setNewGroup] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const effectiveGroups = [...new Set([...groups, ...(initial?.group_name && !groups.includes(initial.group_name) ? [initial.group_name] : [])])];

  useEffect(() => {
    if (newGroup) {
      setGroupName(newGroup);
    }
  }, [newGroup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!content.trim()) newErrors.content = 'Quote is required';
    if (!saidBy.trim()) newErrors.said_by = 'Who said it?';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        content: content.trim(),
        said_by: saidBy.trim(),
        said_at: saidAt || null,
        context: context.trim() || null,
        location: location.trim() || null,
        group_name: groupName || null,
        group_id: groupId || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        label="Quote"
        placeholder="&ldquo;Life is like a box of chocolates...&rdquo;"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        error={errors.content}
        rows={3}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Who said it"
          placeholder="Forrest Gump"
          value={saidBy}
          onChange={(e) => setSaidBy(e.target.value)}
          error={errors.said_by}
        />
        <Input
          label="When (optional)"
          type="date"
          value={saidAt}
          onChange={(e) => setSaidAt(e.target.value)}
        />
      </div>

      <Input
        label="Context (optional)"
        placeholder="What was happening?"
        value={context}
        onChange={(e) => setContext(e.target.value)}
      />

      <Input
        label="Location (optional)"
        placeholder="Where were you?"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      {/* Shared Group */}
      {sharedGroups && sharedGroups.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-surface-400 mb-1.5">
            Shared Group
          </label>
          <select
            value={groupId}
            onChange={(e) => {
              setGroupId(e.target.value);
              if (e.target.value) setGroupName('');
            }}
            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
          >
            <option value="">No shared group</option>
            {sharedGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
            ))}
          </select>
          {groupId && (
            <p className="text-[10px] text-surface-500 mt-1">
              Anyone in this group can see and add quotes.
            </p>
          )}
        </div>
      )}

      {/* Personal tag */}
      <div>
        <label className="block text-xs font-semibold text-surface-400 mb-1.5">
          Personal Tag {groupId ? '(optional)' : '(optional)'}
        </label>
        <div className="flex items-center gap-2">
          <select
            value={groupName}
            onChange={(e) => {
              setGroupName(e.target.value);
              if (e.target.value !== '__new__') setNewGroup('');
            }}
            className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
          >
            <option value="">No tag</option>
            {effectiveGroups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
            <option value="__new__">+ New tag</option>
          </select>
        </div>
        {groupName === '__new__' && (
          <Input
            placeholder="New tag name"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            className="mt-2"
          />
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" type="submit" loading={submitting}>
          {initial ? 'Save' : 'Add Quote'}
        </Button>
      </div>
    </form>
  );
}
