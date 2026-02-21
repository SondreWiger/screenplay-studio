'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Input, Modal, Badge, LoadingSpinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ProjectDocument, ProjectFolder, DocumentType } from '@/lib/types';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_ICONS } from '@/lib/types';

export default function DocumentsPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const { currentProject, members } = useProjectStore();

  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDoc, setCurrentDoc] = useState<ProjectDocument | null>(null);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null); // null = root
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : undefined);
  const canEdit = currentUserRole && ['owner', 'admin', 'writer', 'editor'].includes(currentUserRole);

  // Fetch folders and documents
  useEffect(() => {
    if (!params.id) return;
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    const supabase = createClient();
    setLoading(true);
    const [foldersRes, docsRes] = await Promise.all([
      supabase.from('project_folders').select('*').eq('project_id', params.id).order('sort_order'),
      supabase.from('project_documents').select('*').eq('project_id', params.id).order('is_pinned', { ascending: false }).order('updated_at', { ascending: false }),
    ]);
    setFolders(foldersRes.data || []);
    setDocuments(docsRes.data || []);
    setLoading(false);
  };

  // Current folder's documents
  const currentDocuments = useMemo(() => {
    return documents.filter((d) => d.folder_id === currentFolder);
  }, [documents, currentFolder]);

  // Folder tree for current level
  const currentFolders = useMemo(() => {
    return folders.filter((f) => f.parent_folder_id === currentFolder);
  }, [folders, currentFolder]);

  // Breadcrumb path
  const breadcrumbs = useMemo(() => {
    const path: ProjectFolder[] = [];
    let folderId = currentFolder;
    while (folderId) {
      const folder = folders.find((f) => f.id === folderId);
      if (folder) {
        path.unshift(folder);
        folderId = folder.parent_folder_id;
      } else break;
    }
    return path;
  }, [currentFolder, folders]);

  // Auto-save document content
  const handleContentChange = (content: string) => {
    if (!currentDoc) return;
    setCurrentDoc({ ...currentDoc, content });
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      const supabase = createClient();
      await supabase.from('project_documents').update({
        content,
        last_edited_by: user?.id,
      }).eq('id', currentDoc.id);
      setSaving(false);
      setLastSaved(new Date());
    }, 800);
  };

  // Create new document
  const handleCreateDoc = async (title: string, docType: DocumentType) => {
    const supabase = createClient();
    const { data } = await supabase.from('project_documents').insert({
      project_id: params.id,
      folder_id: currentFolder,
      title,
      doc_type: docType,
      created_by: user?.id,
      last_edited_by: user?.id,
    }).select().single();
    if (data) {
      setDocuments([data, ...documents]);
      setCurrentDoc(data);
    }
    setShowNewDoc(false);
  };

  // Create new folder
  const handleCreateFolder = async (name: string) => {
    const supabase = createClient();
    const { data } = await supabase.from('project_folders').insert({
      project_id: params.id,
      parent_folder_id: currentFolder,
      name,
      created_by: user?.id,
    }).select().single();
    if (data) {
      setFolders([...folders, data]);
    }
    setShowNewFolder(false);
  };

  // Delete document
  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    const supabase = createClient();
    await supabase.from('project_documents').delete().eq('id', docId);
    setDocuments(documents.filter((d) => d.id !== docId));
    if (currentDoc?.id === docId) setCurrentDoc(null);
  };

  // Delete folder
  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder and all its contents?')) return;
    const supabase = createClient();
    await supabase.from('project_folders').delete().eq('id', folderId);
    setFolders(folders.filter((f) => f.id !== folderId));
    setDocuments(documents.filter((d) => d.folder_id !== folderId));
  };

  // Export document as PDF
  const handleExportPDF = useCallback((doc: ProjectDocument) => {
    const html = `<!DOCTYPE html>
<html>
<head>
<title>${doc.title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  body {
    font-family: 'Inter', sans-serif;
    max-width: 8.5in;
    margin: 0 auto;
    padding: 1in;
    color: #1a1a1a;
    font-size: 11pt;
    line-height: 1.6;
  }
  h1 { font-size: 18pt; margin-bottom: 0.5em; }
  .meta { color: #666; font-size: 9pt; margin-bottom: 2em; border-bottom: 1px solid #eee; padding-bottom: 1em; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'Inter', sans-serif; }
  @media print {
    body { padding: 0; }
  }
  @page { size: letter; margin: 1in; }
</style>
</head>
<body>
<h1>${doc.title}</h1>
<div class="meta">
  ${DOCUMENT_TYPE_LABELS[doc.doc_type]} &middot; ${doc.word_count} words &middot; Last updated ${new Date(doc.updated_at).toLocaleDateString()}
</div>
<pre>${doc.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
<script>document.fonts.ready.then(() => setTimeout(() => window.print(), 300));<\/script>
</body>
</html>`;
    const win = window.open('', '_blank');
    if (!win) { alert('Please allow popups to export PDF.'); return; }
    win.document.write(html);
    win.document.close();
  }, []);

  // Export as plain text file
  const handleExportText = useCallback((doc: ProjectDocument) => {
    const blob = new Blob([doc.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar — folder tree & document list */}
      <div className="w-64 border-r border-surface-800 flex flex-col bg-surface-950">
        <div className="p-3 border-b border-surface-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-surface-500 uppercase tracking-wider">Documents</span>
            {canEdit && (
              <div className="flex items-center gap-1">
                <button onClick={() => setShowNewFolder(true)} className="p-1 rounded text-surface-500 hover:text-white hover:bg-white/10" title="New Folder">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                </button>
                <button onClick={() => setShowNewDoc(true)} className="p-1 rounded text-surface-500 hover:text-white hover:bg-white/10" title="New Document">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            )}
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-[10px] text-surface-500 mb-2 flex-wrap">
            <button onClick={() => setCurrentFolder(null)} className="hover:text-white transition-colors">
              Root
            </button>
            {breadcrumbs.map((bc) => (
              <span key={bc.id} className="flex items-center gap-1">
                <span>/</span>
                <button onClick={() => setCurrentFolder(bc.id)} className="hover:text-white transition-colors truncate max-w-[80px]">
                  {bc.name}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {/* Folders */}
          {currentFolders.map((folder) => (
            <div key={folder.id} className="group">
              <button
                onClick={() => setCurrentFolder(folder.id)}
                className="w-full text-left px-2 py-1.5 rounded text-xs text-surface-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-surface-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="truncate flex-1">{folder.name}</span>
                {canEdit && (
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-surface-600 hover:text-red-400 transition-all">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </button>
            </div>
          ))}

          {/* Documents */}
          {currentDocuments.map((doc) => (
            <div key={doc.id} className="group">
              <button
                onClick={() => setCurrentDoc(doc)}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2',
                  currentDoc?.id === doc.id ? 'bg-brand-600/10 text-brand-400' : 'text-surface-400 hover:text-white hover:bg-white/5'
                )}
              >
                <span className="shrink-0">{DOCUMENT_TYPE_ICONS[doc.doc_type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {doc.is_pinned && <span className="text-[8px]">📌</span>}
                    <span className="truncate">{doc.title}</span>
                  </div>
                  <span className="text-[10px] text-surface-600">
                    {doc.word_count} words &middot; {new Date(doc.updated_at).toLocaleDateString()}
                  </span>
                </div>
                {canEdit && (
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-surface-600 hover:text-red-400 transition-all shrink-0">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </button>
            </div>
          ))}

          {currentFolders.length === 0 && currentDocuments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-surface-500 mb-2">No documents yet</p>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setShowNewDoc(true)}>
                  + New Document
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Doc count */}
        <div className="p-3 border-t border-surface-800">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-white">{documents.length}</p>
              <p className="text-[10px] text-surface-500">Documents</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{folders.length}</p>
              <p className="text-[10px] text-surface-500">Folders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {currentDoc ? (
          <>
            {/* Doc toolbar */}
            <div className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-sm px-4 py-2 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={currentDoc.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setCurrentDoc({ ...currentDoc, title });
                    // Debounce save title
                    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                    saveTimeoutRef.current = setTimeout(async () => {
                      const supabase = createClient();
                      await supabase.from('project_documents').update({ title }).eq('id', currentDoc.id);
                      setDocuments((prev) => prev.map((d) => d.id === currentDoc.id ? { ...d, title } : d));
                    }, 600);
                  }}
                  className="bg-transparent text-sm font-medium text-white w-full outline-none placeholder:text-surface-600"
                  placeholder="Document Title"
                  disabled={!canEdit}
                />
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-surface-500">{DOCUMENT_TYPE_LABELS[currentDoc.doc_type]}</span>
                  <span className="text-[10px] text-surface-600">&middot;</span>
                  <span className="text-[10px] text-surface-500">
                    {(currentDoc.content || '').split(/\s+/).filter(Boolean).length} words
                  </span>
                  {saving ? (
                    <span className="flex items-center gap-1 text-[10px] text-surface-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" /> Saving
                    </span>
                  ) : lastSaved && (
                    <span className="flex items-center gap-1 text-[10px] text-surface-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Saved
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleExportPDF(currentDoc)} className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-white/10" title="Export as PDF">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </button>
                <button onClick={() => handleExportText(currentDoc)} className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-white/10" title="Export as TXT">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
              </div>
            </div>

            {/* Editor area */}
            <div className="flex-1 overflow-y-auto bg-surface-900/30">
              <div className="max-w-3xl mx-auto my-8 bg-surface-950 rounded-sm shadow-2xl min-h-[600px]">
                <textarea
                  ref={editorRef}
                  value={currentDoc.content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="w-full h-full min-h-[600px] p-8 bg-transparent text-surface-200 text-sm font-mono leading-relaxed outline-none resize-none placeholder:text-surface-600"
                  placeholder="Start writing..."
                  disabled={!canEdit}
                  spellCheck
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <svg className="w-16 h-16 mx-auto mb-4 text-surface-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-surface-500 mb-2">Select or create a document</p>
              <p className="text-xs text-surface-600 mb-4">Notes, outlines, treatments, and more</p>
              {canEdit && (
                <Button onClick={() => setShowNewDoc(true)}>+ New Document</Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Document Modal */}
      <NewDocumentModal
        isOpen={showNewDoc}
        onClose={() => setShowNewDoc(false)}
        onCreate={handleCreateDoc}
      />

      {/* New Folder Modal */}
      <NewFolderModal
        isOpen={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        onCreate={handleCreateFolder}
      />
    </div>
  );
}

// ============================================================
// New Document Modal
// ============================================================

function NewDocumentModal({ isOpen, onClose, onCreate }: {
  isOpen: boolean; onClose: () => void; onCreate: (title: string, docType: DocumentType) => void;
}) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocumentType>('plain_text');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim(), docType);
    setTitle('');
    setDocType('plain_text');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Document" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Title" value={title} onChange={(e: any) => setTitle(e.target.value)} placeholder="My Document" required autoFocus />
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-2">Document Type</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(DOCUMENT_TYPE_LABELS) as [DocumentType, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDocType(key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors',
                  docType === key
                    ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                    : 'border-surface-700 text-surface-400 hover:border-surface-600 hover:text-white'
                )}
              >
                <span>{DOCUMENT_TYPE_ICONS[key]}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// New Folder Modal
// ============================================================

function NewFolderModal({ isOpen, onClose, onCreate }: {
  isOpen: boolean; onClose: () => void; onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Folder" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Folder Name" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="My Folder" required autoFocus />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create Folder</Button>
        </div>
      </form>
    </Modal>
  );
}
