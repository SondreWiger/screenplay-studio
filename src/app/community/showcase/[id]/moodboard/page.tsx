'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Project, Profile, MoodBoardItem, MoodBoardSection } from '@/lib/types';

// ============================================================
// Deep Dive — Read-Only Moodboard Viewer
// ============================================================

const BOARD_SECTIONS: { value: MoodBoardSection; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: '🎨' },
  { value: 'characters', label: 'Characters', icon: '👤' },
  { value: 'locations', label: 'Locations', icon: '📍' },
  { value: 'atmosphere', label: 'Atmosphere', icon: '🌙' },
  { value: 'costumes', label: 'Costumes', icon: '👗' },
  { value: 'props', label: 'Props', icon: '🎭' },
];

export default function DeepDiveMoodboardPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<(Project & { author?: Profile }) | null>(null);
  const [items, setItems] = useState<MoodBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<MoodBoardSection | 'all'>('all');
  const [selectedItem, setSelectedItem] = useState<MoodBoardItem | null>(null);

  useEffect(() => {
    if (params.id) fetchData();
  }, [params.id]);

  const fetchData = async () => {
    const supabase = createClient();

    const { data: proj, error: projErr } = await supabase
      .from('projects')
      .select('*, author:profiles!created_by(*)')
      .eq('id', params.id)
      .eq('is_showcased', true)
      .single();

    if (projErr || !proj) {
      setError('This project is not available for viewing.');
      setLoading(false);
      return;
    }

    if (!proj.showcase_moodboard) {
      setError('The moodboard is not available for this production.');
      setLoading(false);
      return;
    }

    setProject(proj);

    const { data: itemsData } = await supabase
      .from('moodboard_items')
      .select('*')
      .eq('project_id', params.id)
      .order('z_index');

    setItems(itemsData || []);
    setLoading(false);
  };

  const filteredItems = activeSection === 'all' ? items : items.filter((i) => i.board_section === activeSection);
  const sectionCounts = BOARD_SECTIONS.map((s) => ({
    ...s,
    count: items.filter((i) => i.board_section === s.value).length,
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-pink-500" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🎨</div>
        <h1 className="text-2xl font-black">Not Available</h1>
        <p className="text-white/40">{error || 'Something went wrong.'}</p>
        <Link href={`/community/showcase/${params.id}`} className="mt-4 px-5 py-2.5 text-sm font-medium text-black bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors">
          Back to Project
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-[#0d0d0d]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link href={`/community/showcase/${params.id}`} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              <span className="text-sm font-medium">Back to Project</span>
            </Link>
            <div className="h-4 w-px bg-surface-900/10" />
            <span className="text-sm text-white/40 truncate max-w-[200px]">{project.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-pink-400 bg-pink-500/10 rounded-full border border-pink-500/20">
              Moodboard
            </span>
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50 bg-surface-900/5 rounded-full">
              Read-only
            </span>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="border-b border-white/10 bg-surface-900/[0.02]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-6 h-6 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <h1 className="text-2xl font-black">Moodboard</h1>
          </div>
          <p className="text-white/40 text-sm">
            Visual inspiration and references for <span className="text-white/60 font-medium">{project.title}</span>
          </p>
          <p className="text-xs text-white/20 mt-1">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Section filter */}
      <div className="border-b border-white/10 bg-surface-900/[0.01]">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveSection('all')}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeSection === 'all'
                ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                : 'text-white/40 hover:text-white/60 bg-surface-900/[0.04] border border-white/[0.06]'
            }`}
          >
            All ({items.length})
          </button>
          {sectionCounts.filter((s) => s.count > 0).map((section) => (
            <button
              key={section.value}
              onClick={() => setActiveSection(section.value)}
              className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                activeSection === section.value
                  ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                  : 'text-white/40 hover:text-white/60 bg-surface-900/[0.04] border border-white/[0.06]'
              }`}
            >
              {section.icon} {section.label} ({section.count})
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🎨</p>
            <p className="text-white/50">No items in this section</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="break-inside-avoid bg-surface-900/[0.03] border border-white/[0.06] rounded-xl overflow-hidden cursor-pointer hover:border-pink-500/30 transition-all group"
              >
                {/* Image items */}
                {item.item_type === 'image' && item.image_url && (
                  <div className="relative">
                    <img
                      src={item.image_url}
                      alt={item.title || 'Moodboard image'}
                      className="w-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Color swatch items */}
                {item.item_type === 'color' && item.color && (
                  <div className="h-24" style={{ backgroundColor: item.color }} />
                )}

                {/* Link items */}
                {item.item_type === 'link' && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      <span className="text-xs text-white/50">Link</span>
                    </div>
                    {item.image_url && (
                      <img src={item.image_url} alt={item.title || 'Moodboard image'} referrerPolicy="no-referrer" className="w-full aspect-video object-cover rounded-lg mb-2" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
                    )}
                  </div>
                )}

                {/* Text / Note items */}
                {(item.item_type === 'text' || item.item_type === 'note') && (
                  <div className="p-4">
                    <svg className="w-4 h-4 text-white/20 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                )}

                {/* Title / content overlay */}
                {(item.title || item.content) && (
                  <div className="p-3">
                    {item.title && (
                      <p className="text-sm font-semibold text-white/80 mb-1 line-clamp-2">{item.title}</p>
                    )}
                    {item.content && (
                      <p className="text-xs text-white/40 line-clamp-3 whitespace-pre-wrap">{item.content}</p>
                    )}
                  </div>
                )}

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="px-3 pb-3 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-[10px] text-white/50 bg-surface-900/[0.04] rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Item detail modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] overflow-y-auto bg-[#1a1a1a] border border-white/10 rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Image */}
            {selectedItem.item_type === 'image' && selectedItem.image_url && (
              <img src={selectedItem.image_url} alt={selectedItem.title || ''} referrerPolicy="no-referrer" className="w-full rounded-t-2xl" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}

            {/* Color */}
            {selectedItem.item_type === 'color' && selectedItem.color && (
              <div className="h-48 rounded-t-2xl" style={{ backgroundColor: selectedItem.color }}>
                <div className="flex items-end h-full p-6">
                  <span className="px-3 py-1 text-sm font-mono bg-black/40 text-white rounded-lg backdrop-blur-sm">{selectedItem.color}</span>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="p-6">
              {selectedItem.title && (
                <h2 className="text-xl font-black text-white/90 mb-2">{selectedItem.title}</h2>
              )}
              {selectedItem.content && (
                <p className="text-sm text-white/50 leading-relaxed whitespace-pre-wrap mb-4">{selectedItem.content}</p>
              )}

              {/* Link */}
              {selectedItem.link_url && (
                <a
                  href={selectedItem.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-pink-400 hover:text-pink-300 transition-colors mb-4"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Visit link
                </a>
              )}

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
                <span className="capitalize">{selectedItem.item_type}</span>
                <span className="h-3 w-px bg-surface-900/10" />
                <span>{BOARD_SECTIONS.find((s) => s.value === selectedItem.board_section)?.icon} {BOARD_SECTIONS.find((s) => s.value === selectedItem.board_section)?.label}</span>
                {selectedItem.tags && selectedItem.tags.length > 0 && (
                  <>
                    <span className="h-3 w-px bg-surface-900/10" />
                    {selectedItem.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-surface-900/[0.04] rounded-full">{tag}</span>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href={`/community/showcase/${params.id}`} className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to {project.title}
          </Link>
          <span className="text-xs text-white/20">Screenplay Studio</span>
        </div>
      </footer>
    </div>
  );
}
