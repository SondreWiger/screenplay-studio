'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { slugify, formatDate } from '@/lib/utils';

function generatePostSlug(title: string): string {
  const base = slugify(title.trim()).slice(0, 48);
  const rand = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${rand}` : rand;
}
import { ScreenplayRenderer, type ScreenplayElement } from '@/components/ScreenplayRenderer';
import { LANGUAGE_OPTIONS } from '@/lib/types';
import type { CommunityCategory, Project, Script, ScriptElement, SubCommunity } from '@/lib/types';
import {
  parseFountain,
  parseFdx,
  fileExtension,
  formatFileSize,
  ACCEPTED_EXTENSIONS,
  FORMAT_LABELS,
  type UploadableFormat,
} from '@/lib/screenplay-parsers';

// ============================================================
// Share Script — submit a script to the community
// ============================================================

export default function ShareScriptPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Sub-community (multi-select + search)
  const [subCommunities, setSubCommunities] = useState<SubCommunity[]>([]); // joined
  const [allCommunities, setAllCommunities] = useState<SubCommunity[]>([]); // all public
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]); // community ids
  const [communitySearch, setCommunitySearch] = useState('');
  const [communitySearchResults, setCommunitySearchResults] = useState<SubCommunity[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [scriptContent, setScriptContent] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Screenplay mode
  const [inputMode, setInputMode] = useState<'project' | 'text' | 'file'>('project');
  const [scriptElements, setScriptElements] = useState<ScreenplayElement[] | null>(null);
  const [projectScripts, setProjectScripts] = useState<Script[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');
  const [loadingScript, setLoadingScript] = useState(false);

  // Permissions
  const [allowComments, setAllowComments] = useState(true);
  const [allowSuggestions, setAllowSuggestions] = useState(true);
  const [allowEdits, setAllowEdits] = useState(false);
  const [allowDistros, setAllowDistros] = useState(false);
  const [allowFreeUse, setAllowFreeUse] = useState(false);
  const [scriptLanguage, setScriptLanguage] = useState('');
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // File upload state
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFileType, setAttachedFileType] = useState<UploadableFormat | ''>('');
  const [attachedFileUrl, setAttachedFileUrl] = useState('');  // public URL (PDFs)
  const [fileParseError, setFileParseError] = useState('');
  const [fileUploading, setFileUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Script/extras accordion
  const [scriptOpen, setScriptOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Whether disclaimer needs to be shown
  const needsDisclaimer = allowEdits || allowDistros || allowFreeUse;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/auth/login?redirect=/community/share');
      return;
    }
    loadData();
  }, [user, authLoading]);

  const loadData = async () => {
    const supabase = createClient();

    // Load categories, projects, and joined sub-communities in parallel
    const [catsRes, projRes, commRes] = await Promise.all([
      supabase.from('community_categories').select('*').order('display_order'),
      supabase.from('projects').select('*').eq('created_by', user!.id).order('updated_at', { ascending: false }),
      supabase
        .from('sub_community_members')
        .select('community_id, sub_communities(*)')
        .eq('user_id', user!.id)
        .not('role', 'in', '(banned,pending_approval)'),
    ]);
    setCategories(catsRes.data || []);
    setProjects(projRes.data || []);
    const comms: SubCommunity[] = ((commRes.data ?? []) as any[])
      .map(r => r.sub_communities).filter(Boolean);
    setSubCommunities(comms);

    // Also load all browsable communities for the search
    const { data: allCommsData } = await supabase
      .from('sub_communities')
      .select('id,slug,name,icon,accent_color,posting_mode,member_count,visibility')
      .in('visibility', ['public', 'restricted'])
      .order('member_count', { ascending: false })
      .limit(100);
    setAllCommunities((allCommsData ?? []) as SubCommunity[]);

    // Pre-select community from ?community=slug query param
    const preSlug = searchParams?.get('community');
    if (preSlug) {
      const allLoaded = (allCommsData ?? []) as SubCommunity[];
      const match = allLoaded.find((c: SubCommunity) => c.slug === preSlug);
      if (match) setSelectedCommunities([match.id]);
    }

    setLoadingData(false);
  };

  // Community search filter
  useEffect(() => {
    const q = communitySearch.trim().toLowerCase();
    if (!q) { setCommunitySearchResults([]); return; }
    const results = allCommunities
      .filter(c => c.slug.includes(q) || c.name?.toLowerCase().includes(q))
      .slice(0, 8);
    setCommunitySearchResults(results);
  }, [communitySearch, allCommunities]);

  const toggleCommunity = (id: string) => {
    setSelectedCommunities(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };
  const loadScriptFromProject = async (projectId: string) => {
    if (!projectId) {
      setProjectScripts([]);
      setSelectedScriptId('');
      setScriptElements(null);
      return;
    }
    setLoadingScript(true);
    const supabase = createClient();

    // Get all scripts for this project
    const { data: scripts } = await supabase
      .from('scripts')
      .select('*')
      .eq('project_id', projectId)
      .order('version', { ascending: false });

    setProjectScripts(scripts || []);

    // Auto-select the active / first script
    const active = scripts?.find((s) => s.is_active) || scripts?.[0];
    if (active) {
      setSelectedScriptId(active.id);
      await loadScriptElements(active.id);
    }
    setLoadingScript(false);
  };

  const loadScriptElements = async (scriptId: string) => {
    if (!scriptId) return;
    setLoadingScript(true);
    const supabase = createClient();

    const { data: elements } = await supabase
      .from('script_elements')
      .select('*')
      .eq('script_id', scriptId)
      .order('sort_order');

    if (elements && elements.length > 0) {
      const mapped: ScreenplayElement[] = elements
        .filter((el) => !el.is_omitted)
        .map((el) => ({
          element_type: el.element_type,
          content: el.content,
          scene_number: el.scene_number,
        }));
      setScriptElements(mapped);
      // Store as JSON for submission
      setScriptContent(JSON.stringify(mapped));
    } else {
      setScriptElements(null);
      setScriptContent('');
    }
    setLoadingScript(false);
  };

  const handleFileSelect = async (file: File) => {
    setAttachedFile(file);
    setFileParseError('');
    setScriptContent('');
    setScriptElements(null);
    setAttachedFileUrl('');

    const ext = fileExtension(file.name) as UploadableFormat | '';
    setAttachedFileType(ext);

    // Auto-fill title from filename if blank
    if (!title) {
      const bare = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(bare);
    }

    if (ext === 'pdf') {
      setFileUploading(true);
      try {
        const supabase = createClient();
        const path = `${user!.id}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('community-files')
          .upload(path, file, { contentType: 'application/pdf', upsert: false });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('community-files').getPublicUrl(path);
        setAttachedFileUrl(urlData.publicUrl);
      } catch (e: unknown) {
        setFileParseError('PDF upload failed: ' + (e instanceof Error ? e.message : String(e)));
      } finally {
        setFileUploading(false);
      }
    } else if (ext === 'fountain' || ext === 'txt') {
      const text = await file.text();
      if (ext === 'fountain') {
        try {
          const parsed = parseFountain(text);
          if (parsed.length > 0) {
            setScriptElements(parsed as ScreenplayElement[]);
            setScriptContent(JSON.stringify(parsed));
          } else {
            // Fallback: store as plain text
            setScriptContent(text);
          }
        } catch {
          setScriptContent(text); // graceful degradation
        }
      } else {
        setScriptContent(text);
      }
    } else if (ext === 'fdx') {
      try {
        const text = await file.text();
        const parsed = parseFdx(text);
        if (parsed.length > 0) {
          setScriptElements(parsed as ScreenplayElement[]);
          setScriptContent(JSON.stringify(parsed));
        } else {
          setFileParseError('FDX parsed but no elements found. The file may be empty.');
        }
      } catch (e: unknown) {
        setFileParseError('Failed to parse FDX: ' + (e instanceof Error ? e.message : String(e)));
      }
    } else {
      setFileParseError(`Unsupported file type ".${ext}". Accepted: .fdx, .fountain, .txt, .pdf`);
    }
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    setAttachedFileType('');
    setAttachedFileUrl('');
    setFileParseError('');
    setScriptContent('');
    setScriptElements(null);
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (selectedCommunities.length === 0) {
      setError('You must select at least one community to post to');
      return;
    }
    if (inputMode === 'file') {
      if (!attachedFile) { setError('Please select a file to upload'); return; }
      if (attachedFileType === 'pdf' && !attachedFileUrl) {
        setError('PDF is still uploading — please wait a moment then try again'); return;
      }
      if (attachedFileType !== 'pdf' && !scriptContent.trim()) {
        setError('File could not be parsed. Try a different format or use plain text mode.'); return;
      }
    }
    if (needsDisclaimer && !disclaimerAccepted) {
      setError('You must accept the copyright disclaimer for the selected permissions');
      return;
    }

    // ── Spam safeguard ────────────────────────────────────────────
    const supabase = createClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('community_posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user!.id)
      .gte('created_at', oneHourAgo);
    if ((recentCount ?? 0) >= 5) {
      setError('You\'ve posted too many times in the last hour. Please wait before posting again.');
      return;
    }
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { count: veryRecent } = await supabase
      .from('community_posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user!.id)
      .gte('created_at', twoMinsAgo);
    if ((veryRecent ?? 0) >= 1) {
      setError('You just posted! Please wait 2 minutes before posting again.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Cross-post: insert one record per selected community
      let firstSlug = '';
      let firstComm: SubCommunity | undefined;
      let anyPending = false;

      for (const commId of selectedCommunities) {
        const comm = allCommunities.find(c => c.id === commId) ?? subCommunities.find(c => c.id === commId);
        const modStatus = comm?.posting_mode === 'require_approval' ? 'pending' : 'approved';
        if (modStatus === 'pending') anyPending = true;
        const slug = generatePostSlug(title);
        if (!firstSlug) { firstSlug = slug; firstComm = comm; }

        const { data: post, error: postErr } = await supabase
          .from('community_posts')
          .insert({
            slug,
            author_id: user!.id,
            title: title.trim(),
            description: description.trim() || null,
            script_content: scriptContent,
            project_id: selectedProject || null,
            cover_image_url: coverUrl.trim() || null,
            allow_comments: allowComments,
            allow_suggestions: allowSuggestions,
            allow_edits: allowEdits,
            allow_distros: allowDistros,
            allow_free_use: allowFreeUse,
            copyright_disclaimer_accepted: needsDisclaimer && disclaimerAccepted,
            language: scriptLanguage || null,
            attached_file_url: attachedFileUrl || null,
            attached_file_type: attachedFileType || null,
            sub_community_id: commId,
            mod_status: modStatus,
            status: modStatus === 'approved' ? 'published' : 'draft',
          })
          .select('id')
          .single();

        if (postErr) throw postErr;

        if (selectedCategories.length > 0 && post) {
          await supabase.from('community_post_categories').insert(
            selectedCategories.map((catId) => ({ post_id: post.id, category_id: catId }))
          );
        }
      }

      router.push(anyPending
        ? `/community/c/${firstComm?.slug ?? ''}?pending=1`
        : `/community/post/${firstSlug}`
      );
    } catch (err: unknown) {
      console.error('Error sharing script:', err);
      setError(err instanceof Error ? err.message : 'Failed to share script');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#070710' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#FF5F1F]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#070710', color: '#fff' }}>
      {/* Dot-grid texture */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      {/* Nav */}
      <nav className="sticky top-0 z-30 backdrop-blur-md" style={{ background: 'rgba(7,7,16,0.85)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/community" className="text-sm text-white/40 hover:text-white transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Community
          </Link>
          <span className="text-sm font-semibold text-white/80">New Post</span>
          <div className="w-16" />{/* spacer */}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-black text-white tracking-tight mb-1">Create a Post</h1>
        <p className="text-white/35 mb-8 text-sm">Share writing, scripts, or just start a discussion — always posted to a community.</p>

        {error && (
          <div className="mb-6 rounded-xl px-4 py-3 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>{error}</div>
        )}

        <div className="space-y-6">
          {/* Community picker — multi-select with search */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Post to Communities <span className="text-[#FF5F1F]">*</span>
            </label>

            {/* Selected community chips */}
            {selectedCommunities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedCommunities.map(id => {
                  const c = allCommunities.find(x => x.id === id) ?? subCommunities.find(x => x.id === id);
                  if (!c) return null;
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: (c.accent_color ?? '#FF5F1F') + '22', color: c.accent_color ?? '#FF5F1F', border: `1px solid ${(c.accent_color ?? '#FF5F1F')}44` }}
                    >
                      {c.icon} c/{c.slug}
                      <button
                        type="button"
                        onClick={() => setSelectedCommunities(prev => prev.filter(x => x !== id))}
                        className="ml-0.5 hover:opacity-70 transition-opacity"
                      >✕</button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                value={communitySearch}
                onChange={e => setCommunitySearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                placeholder="Search communities…"
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/15 bg-surface-900 text-sm text-white/90 placeholder:text-white/30 focus:border-[#FF5F1F] focus:outline-none focus:ring-1 focus:ring-[#FF5F1F] transition-colors"
              />
            </div>

            {/* Dropdown list */}
            {(searchFocused || communitySearch) && (() => {
              const joinedIds = new Set(subCommunities.map(c => c.id));
              const unjoined = allCommunities.filter(c => !joinedIds.has(c.id));
              const pool = communitySearch ? allCommunities : [...subCommunities, ...unjoined];
              const q = communitySearch.toLowerCase();
              const visible = communitySearch
                ? pool.filter(c => c.slug.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q)).slice(0, 8)
                : pool.slice(0, 12);
              return visible.length > 0 ? (
                <div className="mt-1.5 rounded-xl overflow-hidden border border-white/10 divide-y divide-white/[0.05] max-h-60 overflow-y-auto bg-surface-900 shadow-2xl">
                  {!communitySearch && subCommunities.length > 0 && (
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-widest bg-white/[0.03]">Your Communities</p>
                  )}
                  {visible.map(c => {
                    const isSelected = selectedCommunities.includes(c.id);
                    const isJoined = joinedIds.has(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => toggleCommunity(c.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <span className="text-xl leading-none">{c.icon ?? '🎬'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white/90 truncate">c/{c.slug}</p>
                          {c.name && <p className="text-[11px] text-white/35 truncate">{c.name}{c.member_count ? ` · ${c.member_count} members` : ''}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isJoined && !communitySearch && <span className="text-[9px] font-bold text-[#FF5F1F]">JOINED</span>}
                          {c.posting_mode === 'require_approval' && <span className="text-[9px] text-amber-400/70">approval</span>}
                          {isSelected && (
                            <svg className="w-4 h-4 text-[#FF5F1F]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {visible.length === 0 && communitySearch && (
                    <p className="px-3 py-4 text-sm text-white/30 text-center">No communities found for &quot;{communitySearch}&quot;</p>
                  )}
                </div>
              ) : null;
            })()}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Title <span className="text-[#FF5F1F]">*</span></label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's this post about?"
              className="w-full rounded-lg border border-white/15 bg-surface-900 px-4 py-2.5 text-base text-white/90 placeholder:text-white/30 focus:border-[#FF5F1F] focus:outline-none focus:ring-1 focus:ring-[#FF5F1F] transition-colors"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Body</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"What's on your mind?\n\nShare a concept, request feedback, start a discussion — or just drop some thoughts. You can attach a script below if you want."}
              rows={7}
              className="w-full rounded-lg border border-white/15 bg-surface-900 px-4 py-3 text-sm text-white/90 placeholder:text-white/25 focus:border-[#FF5F1F] focus:outline-none focus:ring-1 focus:ring-[#FF5F1F] resize-y transition-colors leading-relaxed"
            />
          </div>

          {/* ── Collapsible: Script attachment + extras ──────────────────── */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Accordion header */}
            <button
              type="button"
              onClick={() => setScriptOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-white/[0.03]"
              style={{ background: scriptOpen ? 'rgba(255,255,255,0.04)' : 'transparent', color: scriptOpen ? '#fff' : 'rgba(255,255,255,0.45)' }}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{scriptOpen ? '📎' : '📎'}</span>
                <span>{scriptOpen ? 'Script & Extras' : 'Attach a script, cover image or extras'}</span>
              </span>
              <svg
                className="w-4 h-4 transition-transform"
                style={{ transform: scriptOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.5 }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Accordion body */}
            {scriptOpen && (
              <div className="px-4 pt-2 pb-5 space-y-5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>

                {/* Cover Image */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Cover Image URL</label>
                  <input
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-white/15 bg-surface-900 px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:border-[#FF5F1F] focus:outline-none focus:ring-1 focus:ring-[#FF5F1F] transition-colors"
                  />
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Script Language</label>
                  <select
                    value={scriptLanguage}
                    onChange={(e) => setScriptLanguage(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-surface-900 px-4 py-2.5 text-sm text-white/90 focus:border-[#FF5F1F] focus:outline-none focus:ring-1 focus:ring-[#FF5F1F] transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Select language...</option>
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>

                {/* Script attachment */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-3">Script</label>
                  <div className="flex gap-1 mb-4 rounded-lg p-1 w-fit" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <button
                onClick={() => setInputMode('project')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  inputMode === 'project' ? 'text-white' : 'text-white/40 hover:text-white'
                }`}
                style={inputMode === 'project' ? { background: 'rgba(255,95,31,0.15)', color: '#FF5F1F' } : {}}
              >
                📁 From Project
              </button>
              <button
                onClick={() => setInputMode('text')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  inputMode === 'text' ? 'text-white' : 'text-white/40 hover:text-white'
                }`}
                style={inputMode === 'text' ? { background: 'rgba(255,95,31,0.15)', color: '#FF5F1F' } : {}}
              >
                ✏️ Write / Paste
              </button>
              <button
                onClick={() => setInputMode('file')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  inputMode === 'file' ? 'text-white' : 'text-white/40 hover:text-white'
                }`}
                style={inputMode === 'file' ? { background: 'rgba(255,95,31,0.15)', color: '#FF5F1F' } : {}}
              >
                📎 Upload File
              </button>
            </div>

            {inputMode === 'project' ? (
              <div>
                {/* Project grid */}
                {projects.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-white/10 py-10 text-center">
                    <div className="text-3xl mb-2">📝</div>
                    <p className="text-sm text-white/40 mb-1">No projects yet</p>
                    <p className="text-xs text-white/50">Create a project in the dashboard first, or use plain text mode.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {projects.map((p) => {
                        const isSelected = selectedProject === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedProject('');
                                setProjectScripts([]);
                                setSelectedScriptId('');
                                setScriptElements(null);
                                setScriptContent('');
                              } else {
                                setSelectedProject(p.id);
                                if (!title) setTitle(p.title);
                                loadScriptFromProject(p.id);
                              }
                            }}
                            className={`text-left rounded-xl border-2 p-4 transition-all ${
                              isSelected
                                ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 ring-2 ring-[#FF5F1F]/30'
                                : 'border-white/10 bg-surface-900 hover:border-white/15 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                                isSelected ? 'bg-[#FF5F1F] text-white' : 'bg-surface-800 text-white/40'
                              }`}>
                                {p.title?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className={`text-sm font-semibold truncate ${isSelected ? 'text-[#CC4312]' : 'text-white'}`}>
                                  {p.title}
                                </h4>
                                {p.logline && (
                                  <p className="text-xs text-white/50 mt-0.5 line-clamp-1">{p.logline}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/50">
                                  <span className="capitalize">{(p.format || '').replace('_', ' ')}</span>
                                  {p.genre?.length > 0 && <span>· {p.genre.slice(0, 2).join(', ')}</span>}
                                  <span>· {formatDate(p.updated_at)}</span>
                                </div>
                              </div>
                              {isSelected && (
                                <svg className="w-5 h-5 text-[#FF5F1F] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Script version selector (if project has multiple scripts) */}
                    {selectedProject && projectScripts.length > 1 && (
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-white/40 mb-1.5">Script Version</label>
                        <div className="flex flex-wrap gap-2">
                          {projectScripts.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => { setSelectedScriptId(s.id); loadScriptElements(s.id); }}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                selectedScriptId === s.id
                                  ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 text-[#E54E15]'
                                  : 'border-white/10 bg-surface-900 text-white/60 hover:border-white/15'
                              }`}
                            >
                              v{s.version} — {s.title}
                              {s.is_active && <span className="ml-1 text-green-600">●</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Script preview */}
                    {loadingScript && (
                      <div className="flex items-center justify-center py-12 rounded-xl border border-white/10 bg-surface-900">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-brand-500" />
                        <span className="ml-3 text-sm text-white/40">Loading screenplay...</span>
                      </div>
                    )}

                    {!loadingScript && selectedProject && scriptElements && scriptElements.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-surface-900 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/07 bg-surface-900">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <span className="text-xs font-semibold text-white/70">Screenplay loaded</span>
                            <span className="text-xs text-white/50">({scriptElements.length} elements)</span>
                          </div>
                          <span className="text-[10px] text-white/50 bg-surface-800 px-2 py-0.5 rounded font-medium">
                            Formatted screenplay
                          </span>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto px-8 py-6 bg-surface-900">
                          <ScreenplayRenderer elements={scriptElements} />
                        </div>
                      </div>
                    )}

                    {!loadingScript && selectedProject && (!scriptElements || scriptElements.length === 0) && (
                      <div className="rounded-xl p-5 text-center" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <p className="text-sm text-amber-400">This project doesn&apos;t have any script content yet.</p>
                        <p className="text-xs text-amber-500/70 mt-1">Write something in the script editor first, or switch to write/paste mode.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : inputMode === 'text' ? (
              /* Plain text mode */
              <div>
                <textarea
                  value={scriptContent}
                  onChange={(e) => { setScriptContent(e.target.value); setScriptElements(null); }}
                  placeholder="Paste or write your screenplay here..."
                  rows={16}
                  className="w-full rounded-lg border border-white/15 bg-surface-900 px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:border-[#FF5F1F] focus:outline-none focus:ring-1 focus:ring-[#FF5F1F] resize-none transition-colors font-mono leading-relaxed"
                />
                <p className="text-xs text-white/50 mt-1">Tip: Use &quot;From My Projects&quot; to share with proper screenplay formatting.</p>
              </div>
            ) : (
              /* File upload mode */
              <div>
                {!attachedFile ? (
                  /* Drop zone */
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setIsDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (file) handleFileSelect(file);
                    }}
                    className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${
                      isDragging
                        ? 'border-[#FF5F1F] bg-[#FF5F1F]/5'
                        : 'border-white/15 hover:border-white/25 hover:bg-white/[0.02]'
                    }`}
                  >
                    <input
                      type="file"
                      id="screenplay-file-input"
                      accept={ACCEPTED_EXTENSIONS}
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                    />
                    <label htmlFor="screenplay-file-input" className="cursor-pointer block">
                      <div className="text-5xl mb-4">📎</div>
                      <p className="text-sm font-medium text-white/70 mb-1">
                        Drop your screenplay here, or{' '}
                        <span className="text-[#FF5F1F] hover:underline">browse</span>
                      </p>
                      <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
                        {(['fdx', 'fountain', 'txt', 'pdf'] as const).map((fmt) => (
                          <span key={fmt} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-surface-800 text-white/40 border border-white/10">
                            .{fmt}
                            <span className="text-white/25 font-normal normal-case tracking-normal">·</span>
                            <span className="font-normal normal-case tracking-normal">{FORMAT_LABELS[fmt]}</span>
                          </span>
                        ))}
                      </div>
                    </label>
                  </div>
                ) : (
                  /* File selected — show status + preview */
                  <div className="space-y-4">
                    {/* File pill */}
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-surface-900">
                      <div className="text-2xl">
                        {attachedFileType === 'pdf' ? '📄' : attachedFileType === 'fdx' ? '🎬' : '📝'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{attachedFile.name}</p>
                        <p className="text-xs text-white/40">
                          {formatFileSize(attachedFile.size)}
                          {attachedFileType && (
                            <> · <span className="text-[#FF5F1F]">
                              {FORMAT_LABELS[attachedFileType as UploadableFormat] ?? attachedFileType.toUpperCase()}
                            </span></>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={handleRemoveFile}
                        className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none px-1"
                        title="Remove file"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Status messages */}
                    {fileUploading && (
                      <div className="flex items-center gap-2 text-sm text-white/50">
                        <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-[#FF5F1F] animate-spin shrink-0" />
                        Uploading PDF…
                      </div>
                    )}
                    {!fileUploading && attachedFileType === 'pdf' && attachedFileUrl && (
                      <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-emerald-400" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        PDF uploaded — it will be embedded in your post for readers to view and download.
                      </div>
                    )}
                    {fileParseError && (
                      <div className="rounded-xl px-4 py-3 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>{fileParseError}</div>
                    )}

                    {/* Script preview (for parsed formats) */}
                    {!fileUploading && scriptElements && scriptElements.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-surface-900 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/07 bg-surface-900">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <span className="text-xs font-semibold text-white/70">Parsed successfully</span>
                            <span className="text-xs text-white/50">({scriptElements.length} elements)</span>
                          </div>
                          <span className="text-[10px] text-white/50 bg-surface-800 px-2 py-0.5 rounded font-medium">
                            Formatted screenplay
                          </span>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto px-8 py-6">
                          <ScreenplayRenderer elements={scriptElements} />
                        </div>
                      </div>
                    )}
                    {!fileUploading && scriptContent && !scriptElements && attachedFileType !== 'pdf' && (
                      /* Plain text fallback preview */
                      <div className="rounded-xl border border-white/10 bg-surface-900 max-h-60 overflow-y-auto p-5">
                        <pre className="text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed">{scriptContent.slice(0, 2000)}{scriptContent.length > 2000 ? '\n…' : ''}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
                </div>

              </div>
            )}
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Categories</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    selectedCategories.includes(cat.id)
                      ? 'border-[#FF5F1F] bg-[#FF5F1F]/10 text-[#E54E15] font-medium'
                      : 'border-white/10 bg-surface-900 text-white/60 hover:border-white/15'
                  }`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">Permissions</label>
            <div className="space-y-3 rounded-xl border border-white/10 bg-surface-900 p-5">
              {[
                { key: 'comments', label: 'Allow Comments', desc: 'Others can leave comments on your script', value: allowComments, setter: setAllowComments },
                { key: 'suggestions', label: 'Allow Suggestions', desc: 'Others can submit suggestions for improvement', value: allowSuggestions, setter: setAllowSuggestions },
                { key: 'edits', label: 'Allow Edits', desc: 'Others can freely edit this script', value: allowEdits, setter: setAllowEdits },
                { key: 'distros', label: 'Allow Distros', desc: 'Others can create their own versions (forks) of this script', value: allowDistros, setter: setAllowDistros },
                { key: 'freeUse', label: 'Free to Use', desc: 'Filmmakers can use this script for productions', value: allowFreeUse, setter: setAllowFreeUse },
              ].map(({ key, label, desc, value, setter }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setter(e.target.checked)}
                    className="mt-0.5 rounded border-white/15 text-[#FF5F1F] focus:ring-[#FF5F1F]"
                  />
                  <div>
                    <span className="text-sm font-medium text-white/90">{label}</span>
                    <p className="text-xs text-white/50">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Copyright disclaimer */}
          {needsDisclaimer && (
            <div className="rounded-xl p-5" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                <div>
                  <h4 className="text-sm font-semibold text-amber-400 mb-2">Copyright Disclaimer</h4>
                  <p className="text-xs text-amber-400/80 leading-relaxed mb-3">
                    By enabling <strong>edits</strong>, <strong>distros</strong>, or <strong>free use</strong>, you acknowledge that:
                  </p>
                  <ul className="text-xs text-amber-400/80 space-y-1 mb-4 list-disc list-inside">
                    <li>We do not store earlier versions of your script and cannot restore them.</li>
                    <li>We will not pursue any action on behalf of your copyright.</li>
                    <li>You agree that by allowing others to modify or use your work, you may lose the right to 100% ownership of the project.</li>
                    {allowFreeUse && <li>Filmmakers may use your script for productions without further permission from you.</li>}
                  </ul>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={disclaimerAccepted}
                      onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                      className="rounded border-amber-400/40 bg-transparent text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium text-amber-400">I understand and accept</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <Link href="/community" className="text-sm text-white/40 hover:text-white/70 transition-colors">Cancel</Link>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-7 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90 active:scale-95"
              style={{ background: '#FF5F1F' }}
            >
              {submitting ? (selectedCommunities.length > 1 ? `Cross-posting to ${selectedCommunities.length}…` : 'Posting…') : (
                selectedCommunities.length === 0
                  ? 'Select a Community'
                  : selectedCommunities.length > 1
                    ? `Cross-post to ${selectedCommunities.length} communities`
                    : (() => {
                        const c = allCommunities.find(x => x.id === selectedCommunities[0]) ?? subCommunities.find(x => x.id === selectedCommunities[0]);
                        return c?.posting_mode === 'require_approval' ? 'Submit for Approval' : `Post to c/${c?.slug}`;
                      })()
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
