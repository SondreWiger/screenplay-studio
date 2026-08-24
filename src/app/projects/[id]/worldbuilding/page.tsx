'use client';

import { useState } from 'react';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Textarea, Card } from '@/components/ui';
import { useTranslation } from '@/components/TranslationProvider';

export default function WorldbuildingPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();
  const { t } = useTranslation();

  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : undefined);
  const canEdit = currentUserRole && ['owner', 'admin', 'writer', 'editor'].includes(currentUserRole);

  const [activeTab, setActiveTab] = useState<'lore' | 'magic' | 'factions'>('lore');

  // Simple state for demonstration. In a real app, this would sync to Supabase.
  const [content, setContent] = useState({
    lore: 'Welcome to the worldbuilding hub. Document the history, environment, and rules of your universe here.',
    magic: 'Define the rules, limitations, and costs of your magic or technology system.',
    factions: 'Detail the relations between groups, political powers, and key figures.',
  });

  const handleSave = () => {
    console.log('Saved worldbuilding content:', content);
  };

  return (
    <div className="flex flex-col h-full bg-surface-900">
      <div className="flex items-center justify-between p-4 border-b border-surface-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Worldbuilding Hub
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            Establish the rules, lore, and factions of your universe.
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleSave}>Save Changes</Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-surface-800 bg-surface-900 flex flex-col">
          <div className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('lore')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'lore' ? 'bg-brand-500/20 text-brand-400' : 'text-surface-400 hover:bg-surface-800 hover:text-white'
              }`}
            >
              Lore & Environment
            </button>
            <button
              onClick={() => setActiveTab('magic')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'magic' ? 'bg-brand-500/20 text-brand-400' : 'text-surface-400 hover:bg-surface-800 hover:text-white'
              }`}
            >
              Magic & Systems
            </button>
            <button
              onClick={() => setActiveTab('factions')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'factions' ? 'bg-brand-500/20 text-brand-400' : 'text-surface-400 hover:bg-surface-800 hover:text-white'
              }`}
            >
              Factions & Relations
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-surface-950">
          <div className="max-w-4xl mx-auto space-y-6">
            <Card className="p-6 bg-surface-900 border-surface-800">
              <h2 className="text-lg font-semibold text-white mb-4 capitalize">
                {activeTab.replace('-', ' ')}
              </h2>
              <Textarea
                value={content[activeTab]}
                onChange={(e) => setContent({ ...content, [activeTab]: e.target.value })}
                rows={20}
                placeholder={`Write your ${activeTab} details here...`}
                className="font-mono text-sm leading-relaxed"
                disabled={!canEdit}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
