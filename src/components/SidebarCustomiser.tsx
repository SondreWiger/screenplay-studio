'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { SidebarSection, SidebarNavItem } from '@/lib/types';
import type { SaveScope } from '@/hooks/useSidebarLayout';

interface Props {
  sections: SidebarSection[];
  onClose: () => void;
  onSave: (sections: SidebarSection[], scope: SaveScope) => Promise<void>;
  onReset: (scope: SaveScope) => Promise<void>;
  isAdmin: boolean;
  activeScope: SaveScope | null;
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export default function SidebarCustomiser({ sections: initialSections, onClose, onSave, onReset, isAdmin, activeScope }: Props) {
  const [sections, setSections] = useState<SidebarSection[]>(
    // Deep clone to avoid mutating props
    initialSections.map(s => ({ ...s, items: s.items.map(i => ({ ...i })) }))
  );
  const [editingLabel, setEditingLabel] = useState<{ type: 'section' | 'item'; sectionId: string; itemIcon?: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [saveScope, setSaveScope] = useState<SaveScope>('user-project');
  const [saving, setSaving] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [showNewSection, setShowNewSection] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(sections.map(s => s.id)));
  // Click-controlled dropdown state
  const [moveMenuKey, setMoveMenuKey] = useState<string | null>(null); // `${sectionId}::${icon}`
  const [showResetMenu, setShowResetMenu] = useState(false);
  const resetMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside clicks
  useEffect(() => {
    if (!moveMenuKey && !showResetMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      setMoveMenuKey(null);
      setShowResetMenu(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [moveMenuKey, showResetMenu]);

  // ── Section operations ──────────────────────────────────
  const moveSection = (idx: number, dir: -1 | 1) => {
    setSections(prev => move(prev, idx, idx + dir));
  };

  const toggleSectionExpand = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startRenameSection = (section: SidebarSection) => {
    setEditingLabel({ type: 'section', sectionId: section.id });
    setEditingValue(section.label);
  };

  const commitRename = () => {
    if (!editingLabel) return;
    if (editingLabel.type === 'section') {
      setSections(prev => prev.map(s => s.id === editingLabel.sectionId ? { ...s, label: editingValue } : s));
    } else if (editingLabel.type === 'item' && editingLabel.itemIcon) {
      setSections(prev => prev.map(s => s.id === editingLabel.sectionId
        ? { ...s, items: s.items.map(i => i.icon === editingLabel.itemIcon ? { ...i, label: editingValue } : i) }
        : s
      ));
    }
    setEditingLabel(null);
  };

  const addSection = () => {
    if (!newSectionName.trim()) return;
    const id = `custom-${Date.now()}`;
    setSections(prev => [...prev, { id, label: newSectionName.trim(), items: [] }]);
    setNewSectionName('');
    setShowNewSection(false);
    setExpandedSections(prev => { const n = new Set(prev); n.add(id); return n; });
  };

  const deleteSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  // ── Item operations ─────────────────────────────────────
  const toggleItemVisible = (sectionId: string, icon: string) => {
    setSections(prev => prev.map(s => s.id === sectionId
      ? { ...s, items: s.items.map(i => i.icon === icon ? { ...i, hidden: !i.hidden } : i) }
      : s
    ));
  };

  const moveItem = (sectionId: string, itemIdx: number, dir: -1 | 1) => {
    setSections(prev => prev.map(s => s.id === sectionId
      ? { ...s, items: move(s.items, itemIdx, itemIdx + dir) }
      : s
    ));
  };

  const moveItemToSection = (fromSectionId: string, icon: string, toSectionId: string) => {
    let item: SidebarNavItem | null = null;
    setSections(prev => {
      // Extract item
      const next = prev.map(s => {
        if (s.id !== fromSectionId) return s;
        const found = s.items.find(i => i.icon === icon);
        if (found) item = found;
        return { ...s, items: s.items.filter(i => i.icon !== icon) };
      });
      if (!item) return prev;
      // Insert into target
      return next.map(s => s.id === toSectionId ? { ...s, items: [...s.items, item!] } : s);
    });
  };

  // ── Save / reset ────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    await onSave(sections, saveScope);
    setSaving(false);
    onClose();
  };

  const handleReset = async (scope: SaveScope) => {
    if (!confirm(`Reset ${scope === 'user-project' ? 'this project' : scope === 'user-global' ? 'global' : 'project default'} layout?`)) return;
    await onReset(scope);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 h-full w-80 bg-surface-950 border-l border-surface-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">Customise Sidebar</h2>
            <p className="text-[11px] text-surface-500 mt-0.5">Reorder, rename or hide items</p>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-white p-1 rounded transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Sections list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sections.map((section, sIdx) => {
            const isExpanded = expandedSections.has(section.id);
            const isEditing = editingLabel?.type === 'section' && editingLabel.sectionId === section.id;
            const isUnlabelled = !section.label;

            return (
              <div key={section.id} className="mb-1">
                {/* Section header */}
                <div className="flex items-center gap-1 px-3 py-1.5 group">
                  {/* Expand toggle */}
                  <button onClick={() => toggleSectionExpand(section.id)} className="text-surface-600 hover:text-surface-300 p-0.5 transition-colors shrink-0">
                    <svg className={cn('w-3.5 h-3.5 transition-transform', isExpanded && 'rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>

                  {/* Section label */}
                  {isEditing ? (
                    <input
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingLabel(null); }}
                      className="flex-1 bg-surface-800 border border-[#FF5F1F]/50 rounded px-2 py-0.5 text-xs text-white outline-none"
                      autoFocus
                    />
                  ) : (
                    <span
                      className={cn('flex-1 text-[11px] font-semibold uppercase tracking-wider cursor-pointer', isUnlabelled ? 'text-surface-600 italic' : 'text-surface-400', 'hover:text-white transition-colors')}
                      onDoubleClick={() => startRenameSection(section)}
                      title="Double-click to rename"
                    >
                      {section.label || '(no label)'}
                    </span>
                  )}

                  {/* Section move buttons */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveSection(sIdx, -1)} disabled={sIdx === 0}
                      className="text-surface-600 hover:text-surface-300 p-0.5 rounded disabled:opacity-20 transition-colors" title="Move up">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => moveSection(sIdx, 1)} disabled={sIdx === sections.length - 1}
                      className="text-surface-600 hover:text-surface-300 p-0.5 rounded disabled:opacity-20 transition-colors" title="Move down">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button onClick={() => startRenameSection(section)}
                      className="text-surface-600 hover:text-surface-300 p-0.5 rounded transition-colors" title="Rename">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    {section.id.startsWith('custom-') && (
                      <button onClick={() => deleteSection(section.id)}
                        className="text-surface-700 hover:text-red-400 p-0.5 rounded transition-colors" title="Delete section">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Items */}
                {isExpanded && (
                  <div className="ml-6 mb-1 space-y-0.5">
                    {section.items.length === 0 && (
                      <p className="text-[11px] text-surface-700 px-3 py-1 italic">Empty section</p>
                    )}
                    {section.items.map((item, iIdx) => {
                      const isEditingItem = editingLabel?.type === 'item' && editingLabel.sectionId === section.id && editingLabel.itemIcon === item.icon;
                      return (
                        <div key={item.icon} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg group/item', item.hidden ? 'opacity-40' : '')}>
                          {/* Visibility toggle */}
                          <button onClick={() => toggleItemVisible(section.id, item.icon)}
                            className={cn('shrink-0 transition-colors', item.hidden ? 'text-surface-700 hover:text-surface-400' : 'text-surface-400 hover:text-white')}
                            title={item.hidden ? 'Show item' : 'Hide item'}>
                            {item.hidden ? (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            )}
                          </button>

                          {/* Label */}
                          {isEditingItem ? (
                            <input
                              value={editingValue}
                              onChange={e => setEditingValue(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingLabel(null); }}
                              className="flex-1 bg-surface-800 border border-[#FF5F1F]/50 rounded px-2 py-0.5 text-xs text-white outline-none"
                              autoFocus
                            />
                          ) : (
                            <span
                              className="flex-1 text-xs text-surface-300 cursor-pointer hover:text-white transition-colors"
                              onDoubleClick={() => { setEditingLabel({ type: 'item', sectionId: section.id, itemIcon: item.icon }); setEditingValue(item.label); }}
                              title="Double-click to rename"
                            >
                              {item.label}
                            </span>
                          )}

                          {/* Item controls */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <button onClick={() => moveItem(section.id, iIdx, -1)} disabled={iIdx === 0}
                              className="text-surface-600 hover:text-surface-300 p-0.5 rounded disabled:opacity-20 transition-colors" title="Move up">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <button onClick={() => moveItem(section.id, iIdx, 1)} disabled={iIdx === section.items.length - 1}
                              className="text-surface-600 hover:text-surface-300 p-0.5 rounded disabled:opacity-20 transition-colors" title="Move down">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {/* Move to other section */}
                            {sections.filter(s => s.id !== section.id).length > 0 && (
                              <div className="relative" onClick={e => e.stopPropagation()}>
                                <button
                                  className="text-surface-600 hover:text-surface-300 p-0.5 rounded transition-colors"
                                  title="Move to section"
                                  onClick={e => {
                                    e.stopPropagation();
                                    const key = `${section.id}::${item.icon}`;
                                    setMoveMenuKey(prev => prev === key ? null : key);
                                    setShowResetMenu(false);
                                  }}
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                </button>
                                {moveMenuKey === `${section.id}::${item.icon}` && (
                                  <div className="absolute right-0 top-full mt-1 z-20 bg-surface-900 border border-surface-700 rounded-lg shadow-xl py-1 min-w-[140px]" onClick={e => e.stopPropagation()}>
                                    <p className="px-3 py-1 text-[10px] text-surface-600 uppercase tracking-wider">Move to</p>
                                    {sections.filter(s => s.id !== section.id).map(target => (
                                      <button key={target.id} onClick={() => { moveItemToSection(section.id, item.icon, target.id); setMoveMenuKey(null); }}
                                        className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800 hover:text-white transition-colors truncate">
                                        {target.label || '(no label)'}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add new section */}
          <div className="px-3 py-2 mt-1">
            {showNewSection ? (
              <div className="flex items-center gap-2">
                <input
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addSection(); if (e.key === 'Escape') { setShowNewSection(false); setNewSectionName(''); } }}
                  placeholder="Section name"
                  className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#FF5F1F]/60"
                  autoFocus
                />
                <button onClick={addSection} className="text-xs px-2.5 py-1.5 rounded-lg bg-[#FF5F1F] text-white hover:bg-orange-500 transition-colors shrink-0">Add</button>
                <button onClick={() => { setShowNewSection(false); setNewSectionName(''); }} className="text-surface-500 hover:text-white text-xs transition-colors">✕</button>
              </div>
            ) : (
              <button onClick={() => setShowNewSection(true)} className="flex items-center gap-1.5 text-xs text-surface-600 hover:text-[#FF5F1F] transition-colors py-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add section
              </button>
            )}
          </div>
        </div>

        {/* Footer — save options */}
        <div className="border-t border-surface-800 px-5 py-4 shrink-0 space-y-3">
          {/* Scope selector */}
          <div>
            <p className="text-[11px] text-surface-500 mb-1.5">Save as</p>
            <div className="space-y-1.5">
              {([
                { value: 'user-project' as SaveScope, label: 'My layout for this project', desc: 'Only affects you on this project' },
                { value: 'user-global' as SaveScope, label: 'My global default', desc: 'Applies to all projects you haven\'t customised' },
                ...(isAdmin ? [{ value: 'project-default' as SaveScope, label: 'Project default (admin)', desc: 'Used by all members without their own override' }] : []),
              ]).map(opt => (
                <label key={opt.value} className="flex items-start gap-2.5 cursor-pointer group">
                  <input type="radio" name="scope" value={opt.value} checked={saveScope === opt.value} onChange={() => setSaveScope(opt.value)}
                    className="mt-0.5 accent-[#FF5F1F]" />
                  <span>
                    <span className="text-xs font-medium text-surface-200 group-hover:text-white transition-colors block">{opt.label}</span>
                    <span className="text-[10px] text-surface-600">{opt.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

            <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 rounded-xl bg-[#FF5F1F] text-white font-semibold text-sm hover:bg-orange-500 active:scale-95 transition-all disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Layout'}
            </button>
            <div className="relative" ref={resetMenuRef} onClick={e => e.stopPropagation()}>
              <button
                className="py-2 px-3 rounded-xl border border-surface-700 text-surface-400 hover:text-white hover:border-surface-500 text-sm transition-colors"
                title="Reset options"
                onClick={e => { e.stopPropagation(); setShowResetMenu(v => !v); setMoveMenuKey(null); }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              {showResetMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-surface-900 border border-surface-700 rounded-xl py-1.5 shadow-xl min-w-[180px] z-10" onClick={e => e.stopPropagation()}>
                  <p className="px-3 py-1 text-[10px] text-surface-600 uppercase tracking-wider">Reset to default</p>
                  {activeScope === 'user-project' && (
                    <button onClick={() => { handleReset('user-project'); setShowResetMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800 hover:text-white transition-colors">
                      This project override
                    </button>
                  )}
                  <button onClick={() => { handleReset('user-global'); setShowResetMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800 hover:text-white transition-colors">
                    My global layout
                  </button>
                  {isAdmin && (
                    <button onClick={() => { handleReset('project-default'); setShowResetMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800 hover:text-white transition-colors">
                      Project default (admin)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {activeScope && (
            <p className="text-[10px] text-surface-600 text-center">
              Currently using: {activeScope === 'user-project' ? 'project override' : activeScope === 'user-global' ? 'global default' : 'project admin default'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
