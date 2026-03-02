'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore, useProjectStore } from '@/lib/stores';
import { Button, Input, Modal, Badge, LoadingSpinner, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ProjectDocument, ProjectFolder, DocumentType, DocumentComment } from '@/lib/types';
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_ICONS } from '@/lib/types';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useWorkTimeTracker } from '@/hooks/useWorkTimeTracker';

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
  const currentDocRef = useRef<string | null>(null);
  const localEditPendingRef = useRef(false);
  const [remoteEditors, setRemoteEditors] = useState<{ userId: string; docId: string; name: string }[]>([]);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Keep ref in sync with currentDoc
  useEffect(() => { currentDocRef.current = currentDoc?.id || null; }, [currentDoc?.id]);

  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role
    || (currentProject?.created_by === user?.id ? 'owner' : undefined);
  const canEdit = currentUserRole && ['owner', 'admin', 'writer', 'editor'].includes(currentUserRole);

  // ⏱ Work-time tracking
  useWorkTimeTracker({ projectId: params.id, context: 'documents', disabled: !canEdit });


  // Fetch folders and documents
  useEffect(() => {
    if (!params.id) return;
    fetchData();
  }, [params.id]);

  // ── Realtime subscriptions for collaborative editing ──
  useEffect(() => {
    if (!params.id || !user) return;

    const supabase = createClient();

    // Subscribe to document changes
    const docsChannel = supabase
      .channel(`project-documents-${params.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_documents',
          filter: `project_id=eq.${params.id}`,
        },
        (payload) => {
          const newRecord = payload.new as ProjectDocument | undefined;
          // Ignore changes made by the current user
          if (newRecord && newRecord.last_edited_by === user.id) return;
          if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as any;
            if (oldRecord?.last_edited_by === user.id) return;
          }

          if (payload.eventType === 'INSERT') {
            const newDoc = payload.new as ProjectDocument;
            setDocuments((prev) => {
              if (prev.some((d) => d.id === newDoc.id)) return prev;
              return [newDoc, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as ProjectDocument;
            setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
            // Update currentDoc if it's the one being viewed, but only if user isn't mid-edit
            if (currentDocRef.current === updated.id && !localEditPendingRef.current) {
              setCurrentDoc(updated);
            }
            // Show remote editor indicator briefly
            const member = members.find((m) => m.user_id === updated.last_edited_by);
            const editorName = member?.profile?.display_name || member?.profile?.email || 'Someone';
            setRemoteEditors((prev) => {
              const filtered = prev.filter((e) => e.userId !== updated.last_edited_by);
              return [...filtered, { userId: updated.last_edited_by || '', docId: updated.id, name: editorName || '' }];
            });
            // Clear remote editor indicator after 3s
            setTimeout(() => {
              setRemoteEditors((prev) => prev.filter((e) => e.docId !== updated.id || e.userId !== updated.last_edited_by));
            }, 3000);
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setDocuments((prev) => prev.filter((d) => d.id !== deleted.id));
            if (currentDocRef.current === deleted.id) {
              setCurrentDoc(null);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to folder changes
    const foldersChannel = supabase
      .channel(`project-folders-${params.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_folders',
          filter: `project_id=eq.${params.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newFolder = payload.new as ProjectFolder;
            setFolders((prev) => {
              if (prev.some((f) => f.id === newFolder.id)) return prev;
              return [...prev, newFolder];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as ProjectFolder;
            setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setFolders((prev) => prev.filter((f) => f.id !== deleted.id));
          }
        }
      )
      .subscribe();

    // Subscribe to document_comments for active doc
    const commentsChannel = supabase
      .channel(`doc-comments-${params.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'document_comments', filter: `project_id=eq.${params.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const c = payload.new as DocumentComment;
            setComments(prev => prev.some(x => x.id === c.id) ? prev : [c, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const c = payload.new as DocumentComment;
            setComments(prev => prev.map(x => x.id === c.id ? c : x));
          } else if (payload.eventType === 'DELETE') {
            const d = payload.old as { id: string };
            setComments(prev => prev.filter(x => x.id !== d.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(docsChannel);
      supabase.removeChannel(foldersChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [params.id, user?.id]);

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
    localEditPendingRef.current = true;
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
      localEditPendingRef.current = false;
      // Also update documents array so sidebar word count stays current
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === currentDoc.id
            ? { ...d, content, word_count: content.split(/\s+/).filter(Boolean).length, updated_at: new Date().toISOString() }
            : d
        )
      );
    }, 800);
  };

  // Create new document
  const handleCreateDoc = async (title: string, docType: DocumentType) => {
    const supabase = createClient();
    const { data, error } = await supabase.from('project_documents').insert({
      project_id: params.id,
      folder_id: currentFolder,
      title,
      doc_type: docType,
      created_by: user?.id,
      last_edited_by: user?.id,
    }).select().single();
    if (error) { toast.error('Failed to create document'); return; }
    if (data) {
      setDocuments([data, ...documents]);
      setCurrentDoc(data);
    }
    setShowNewDoc(false);
  };

  // Create new folder
  const handleCreateFolder = async (name: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.from('project_folders').insert({
      project_id: params.id,
      parent_folder_id: currentFolder,
      name,
      created_by: user?.id,
    }).select().single();
    if (error) { toast.error('Failed to create folder'); return; }
    if (data) {
      setFolders([...folders, data]);
    }
    setShowNewFolder(false);
  };

  // Delete document
  const handleDeleteDoc = async (docId: string) => {
    const ok = await confirm({ message: 'Delete this document? This cannot be undone.', variant: 'danger', confirmLabel: 'Delete' }); if (!ok) return;
    const supabase = createClient();
    await supabase.from('project_documents').delete().eq('id', docId);
    setDocuments(documents.filter((d) => d.id !== docId));
    if (currentDoc?.id === docId) setCurrentDoc(null);
  };

  // Delete folder
  const handleDeleteFolder = async (folderId: string) => {
    const ok = await confirm({ message: 'Delete this folder and all its contents?', variant: 'danger', confirmLabel: 'Delete' }); if (!ok) return;
    const supabase = createClient();
    await supabase.from('project_folders').delete().eq('id', folderId);
    setFolders(folders.filter((f) => f.id !== folderId));
    setDocuments(documents.filter((d) => d.folder_id !== folderId));
  };

  // ─── Fetch comments for current doc ──────────────────────────────
  const fetchComments = useCallback(async (docId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('document_comments')
      .select('*, author:profiles!author_id(display_name, avatar_url, email)')
      .eq('document_id', docId)
      .order('created_at', { ascending: false });
    setComments((data || []) as DocumentComment[]);
  }, []);

  // Re-fetch comments whenever active doc changes
  useEffect(() => {
    if (currentDoc?.id) fetchComments(currentDoc.id);
    else setComments([]);
  }, [currentDoc?.id, fetchComments]);

  // ─── Add a comment ────────────────────────────────────────────────
  const handleAddComment = async () => {
    if (!commentText.trim() || !currentDoc || !user) return;
    setAddingComment(true);
    const supabase = createClient();
    // Extract mentioned user IDs from text (format: @display_name → we store ids)
    const mentionIds = mentionMembers
      .filter(m => commentText.includes(`@${m.name}`))
      .map(m => m.id);
    const { data } = await supabase.from('document_comments').insert({
      document_id: currentDoc.id,
      project_id: params.id,
      author_id: user.id,
      content: commentText.trim(),
      char_offset: selectionOffset,
      selected_text: selectedText || null,
      mentions: mentionIds,
    }).select('*, author:profiles!author_id(display_name, avatar_url, email)').single();
    if (data) setComments(prev => [data as DocumentComment, ...prev]);
    setCommentText('');
    setSelectedText('');
    setSelectionOffset(null);
    setAddingComment(false);
  };

  // ─── Resolve / delete comment ─────────────────────────────────────
  const handleResolveComment = async (commentId: string) => {
    const supabase = createClient();
    await supabase.from('document_comments').update({ is_resolved: true }).eq('id', commentId);
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_resolved: true } : c));
  };
  const handleDeleteComment = async (commentId: string) => {
    const supabase = createClient();
    await supabase.from('document_comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  // ─── Track text selection in editor ──────────────────────────────
  const handleEditorSelect = () => {
    const ta = editorRef.current;
    if (!ta) return;
    const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd).trim();
    setSelectedText(sel.length > 0 && sel.length < 300 ? sel : '');
    setSelectionOffset(sel.length > 0 ? ta.selectionStart : null);
  };

  // ─── @mention detection in comment textarea ───────────────────────
  const handleCommentInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommentText(val);
    // Detect @mention
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const atIdx = textBeforeCursor.lastIndexOf('@');
    if (atIdx !== -1 && !textBeforeCursor.slice(atIdx + 1).includes(' ')) {
      const query = textBeforeCursor.slice(atIdx + 1).toLowerCase();
      setMentionQuery(query);
      setMentionStart(atIdx);
      // Build member list from project store
      const filtered = (members || []).filter(m => {
        const name = (m as any).profile?.display_name ||
          (m as any).profile?.email?.split('@')[0] || '';
        return name.toLowerCase().includes(query);
      }).map(m => ({
        id: (m as any).user_id,
        name: (m as any).profile?.display_name || (m as any).profile?.email?.split('@')[0] || 'Member',
      }));
      setMentionMembers(filtered);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (name: string) => {
    const before = commentText.slice(0, mentionStart);
    const after = commentText.slice(mentionStart + 1 + (mentionQuery?.length || 0));
    const newText = `${before}@${name} ${after}`;
    setCommentText(newText);
    setMentionQuery(null);
    commentInputRef.current?.focus();
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
    if (!win) { toast.warning('Please allow popups to export PDF.'); return; }
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

  const [showSidebar, setShowSidebar] = useState(false);

  // ─── Comments state ──────────────────────────────────────────────
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [selectionOffset, setSelectionOffset] = useState<number | null>(null);
  const [addingComment, setAddingComment] = useState(false);
  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionMembers, setMentionMembers] = useState<{ id: string; name: string }[]>([]);
  const [mentionStart, setMentionStart] = useState<number>(0);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const docCommentCount = useMemo(() =>
    comments.filter(c => !c.is_resolved).length
  , [comments]);
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex h-full relative">
      {/* Mobile sidebar toggle */}
      <button onClick={() => setShowSidebar(!showSidebar)}
        className="md:hidden fixed bottom-4 left-4 z-50 w-12 h-12 rounded-full bg-[#E54E15] text-white shadow-lg flex items-center justify-center">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {showSidebar && <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setShowSidebar(false)} />}

      {/* Sidebar — folder tree & document list */}
      <div className={cn(
        'w-72 md:w-64 border-r border-surface-800 flex flex-col bg-surface-950 shrink-0',
        'fixed md:relative inset-y-0 left-0 z-40 transition-transform duration-200',
        showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <div className="p-3 border-b border-surface-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-surface-500 uppercase tracking-wider flex items-center gap-2">
              Documents
              <span className="flex items-center gap-1 text-[9px] text-green-500 normal-case tracking-normal font-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            </span>
            {canEdit && (
              <div className="flex items-center gap-1">
                <button onClick={() => setShowNewFolder(true)} className="p-1 rounded text-surface-500 hover:text-white hover:bg-surface-900/10" title="New Folder">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                </button>
                <button onClick={() => setShowNewDoc(true)} className="p-1 rounded text-surface-500 hover:text-white hover:bg-surface-900/10" title="New Document">
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
                className="w-full text-left px-2 py-1.5 rounded text-xs text-surface-400 hover:text-white hover:bg-surface-900/5 transition-colors flex items-center gap-2"
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
                onClick={() => { setCurrentDoc(doc); setShowSidebar(false); }}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2',
                  currentDoc?.id === doc.id ? 'bg-[#E54E15]/10 text-[#FF5F1F]' : 'text-surface-400 hover:text-white hover:bg-surface-900/5'
                )}
              >
                <span className="shrink-0 text-[9px] font-mono font-bold text-surface-400">{DOCUMENT_TYPE_ICONS[doc.doc_type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {doc.is_pinned && <span className="text-[8px]">PIN</span>}
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
                  {/* Remote collaborator indicators */}
                  {remoteEditors.filter((e) => e.docId === currentDoc?.id).map((editor) => (
                    <span key={editor.userId} className="flex items-center gap-1 text-[10px] text-[#FF5F1F] animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF5F1F]" />
                      {editor.name} editing
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleExportPDF(currentDoc)} className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-surface-900/10" title="Export as PDF">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </button>
                <button onClick={() => handleExportText(currentDoc)} className="p-1.5 rounded text-surface-500 hover:text-white hover:bg-surface-900/10" title="Export as TXT">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
                {/* Comments toggle */}
                <button
                  onClick={() => setShowComments(v => !v)}
                  className={cn('relative p-1.5 rounded transition-colors',
                    showComments ? 'text-[#FF5F1F] bg-[#FF5F1F]/10' : 'text-surface-500 hover:text-white hover:bg-surface-900/10'
                  )}
                  title="Comments"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                  {docCommentCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 rounded-full bg-[#FF5F1F] text-[8px] font-bold text-white flex items-center justify-center px-0.5">
                      {docCommentCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Editor area + Comment panel */}
            <div className="flex flex-1 overflow-hidden">
              {/* Main editor */}
              <div className="flex-1 overflow-y-auto bg-surface-900/30">
                <div className="max-w-3xl mx-auto my-8 bg-surface-950 rounded-sm shadow-2xl min-h-[600px] relative">
                  {selectedText && canEdit && (
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        onClick={() => { setShowComments(true); commentInputRef.current?.focus(); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FF5F1F] text-white text-[11px] font-semibold rounded-lg shadow-lg hover:bg-[#e54e15] transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                        Comment on selection
                      </button>
                    </div>
                  )}
                  <textarea
                    ref={editorRef}
                    value={currentDoc.content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    onMouseUp={handleEditorSelect}
                    onKeyUp={handleEditorSelect}
                    className="w-full h-full min-h-[600px] p-8 bg-transparent text-surface-200 text-sm font-mono leading-relaxed outline-none resize-none placeholder:text-surface-600"
                    placeholder="Start writing..."
                    disabled={!canEdit}
                    spellCheck
                  />
                </div>
              </div>

              {/* Comment panel */}
              {showComments && (
                <div className="w-80 shrink-0 border-l border-surface-800 flex flex-col overflow-hidden bg-surface-950">
                  <div className="p-3 border-b border-surface-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Comments</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-surface-500">{comments.filter(c => !c.is_resolved).length} open</span>
                      <button onClick={() => setShowComments(false)} className="text-surface-500 hover:text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>

                  {/* Add comment box */}
                  {canEdit && (
                    <div className="p-3 border-b border-surface-800/60 space-y-2">
                      {selectedText && (
                        <div className="px-2 py-1.5 bg-surface-800/60 rounded-lg border-l-2 border-[#FF5F1F]/60">
                          <p className="text-[10px] text-surface-500 mb-0.5">Commenting on:</p>
                          <p className="text-[11px] text-surface-300 italic line-clamp-2">&ldquo;{selectedText}&rdquo;</p>
                        </div>
                      )}
                      <div className="relative">
                        <textarea
                          ref={commentInputRef}
                          value={commentText}
                          onChange={handleCommentInput}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAddComment(); }
                            if (e.key === 'Escape') setMentionQuery(null);
                          }}
                          placeholder="Add a comment… Use @name to mention"
                          rows={3}
                          className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-surface-500 outline-none focus:border-violet-500/50 resize-none"
                        />
                        {/* @mention dropdown */}
                        {mentionQuery !== null && mentionMembers.length > 0 && (
                          <div className="absolute bottom-full mb-1 left-0 right-0 bg-surface-800 border border-surface-700 rounded-lg shadow-xl py-1 z-20">
                            {mentionMembers.slice(0, 5).map(m => (
                              <button key={m.id} onClick={() => insertMention(m.name)}
                                className="w-full text-left px-3 py-1.5 text-xs text-surface-200 hover:bg-surface-700 transition-colors">
                                @{m.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-surface-600">⌘↵ to post</span>
                        <button
                          onClick={handleAddComment}
                          disabled={!commentText.trim() || addingComment}
                          className="px-3 py-1 bg-[#FF5F1F] text-white text-[11px] font-semibold rounded-lg hover:bg-[#e54e15] disabled:opacity-40 transition-colors"
                        >
                          {addingComment ? 'Posting…' : 'Post'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Comment list */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {comments.length === 0 ? (
                      <p className="text-xs text-surface-500 text-center pt-8">
                        No comments yet.
                        {canEdit && ' Select text and click Comment, or type above.'}
                      </p>
                    ) : (
                      comments.map(comment => (
                        <div key={comment.id} className={cn(
                          'rounded-xl p-3 border',
                          comment.is_resolved
                            ? 'opacity-40 border-surface-800/40 bg-surface-900/20'
                            : 'border-surface-800/80 bg-surface-900/60'
                        )}>
                          {comment.selected_text && (
                            <div className="mb-2 px-2 py-1 bg-surface-800/40 rounded border-l-2 border-[#FF5F1F]/40">
                              <p className="text-[10px] text-surface-400 italic line-clamp-2">&ldquo;{comment.selected_text}&rdquo;</p>
                            </div>
                          )}
                          <p className="text-xs text-surface-200 leading-relaxed whitespace-pre-wrap">
                            {comment.content.split(/(@\w+)/g).map((part, i) =>
                              part.startsWith('@')
                                ? <span key={i} className="text-violet-400 font-medium">{part}</span>
                                : part
                            )}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-surface-500">
                                {(comment as any).author?.display_name || (comment as any).author?.email?.split('@')[0] || 'User'}
                              </span>
                              <span className="text-[10px] text-surface-600">·</span>
                              <span className="text-[10px] text-surface-600">
                                {new Date(comment.created_at).toLocaleDateString()}
                              </span>
                              {comment.is_resolved && (
                                <span className="text-[10px] text-emerald-500">✓ Resolved</span>
                              )}
                            </div>
                            {!comment.is_resolved && canEdit && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleResolveComment(comment.id)}
                                  className="text-[10px] text-surface-500 hover:text-emerald-400 transition-colors"
                                  title="Mark resolved"
                                >✓</button>
                                {comment.author_id === user?.id && (
                                  <button
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="text-[10px] text-surface-500 hover:text-red-400 transition-colors"
                                    title="Delete"
                                  >✕</button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
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
      <ConfirmDialog />
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
                    ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 text-[#FF5F1F]'
                    : 'border-surface-700 text-surface-400 hover:border-surface-600 hover:text-white'
                )}
              >
                <span className="text-[10px] font-mono font-bold text-surface-400">{DOCUMENT_TYPE_ICONS[key]}</span>
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
