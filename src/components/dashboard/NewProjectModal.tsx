'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores';
import { Button, Modal, Input, Textarea, Select, toast } from '@/components/ui';
import { pickToast, NEW_PROJECT } from '@/lib/funToasts';

import { Icon } from '@/components/ui/icons';
import { useTranslation } from '@/components/TranslationProvider';
import type { ScriptType, ProjectType, Company, CompanyMember, CompanyRole } from '@/lib/types';
import { FORMAT_OPTIONS, GENRE_OPTIONS, SCRIPT_TYPE_OPTIONS, AUDIO_DRAMA_FORMAT_OPTIONS, NOVEL_FORMAT_OPTIONS, NOVEL_GENRE_OPTIONS } from '@/lib/types';
import { isElectronMode, isLocalMode, setLocalMode } from '@/lib/supabase/electron-client';
import { putCachedVerified } from '@/lib/offline/db';

export function NewProjectModal({
  isOpen,
  onClose,
  onCreated,
  userId,
  companyMemberships,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  userId: string;
  companyMemberships: (CompanyMember & { company: Company })[];
}) {
  const { user: currentUser } = useAuthStore();
  const router = useRouter();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [format, setFormat] = useState('feature');
  const [scriptType, setScriptType] = useState<ScriptType>(currentUser?.preferred_script_type || 'screenplay');
  const [projectType, setProjectType] = useState<ProjectType>('film');
  const [genre, setGenre] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0); // 0 = script type, 1 = details
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [seasonNumber, setSeasonNumber] = useState('1');
  const [episodeCount, setEpisodeCount] = useState('');
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; description?: string; project_type: string; script_type?: string; genre?: string; format?: string; structure_snapshot?: any }>>([]);
  const [storageMode, setStorageMode] = useState<'cloud' | 'local'>(
    // Local mode has no cloud account to write to, on desktop or web
    isLocalMode() ? 'local' : 'cloud'
  );

  useEffect(() => {
    if (!isOpen || !userId) return;
    const supabase = createClient();
    supabase
      .from('project_templates')
      .select('id, name, description, project_type, script_type, genre, format, structure_snapshot')
      .or(`user_id.eq.${userId},is_public.eq.true`)
      .order('use_count', { ascending: false })
      .limit(6)
      .then(({ data }) => setTemplates(data || []));
  }, [isOpen, userId]);

  const applyTemplate = (t: typeof templates[0]) => {
    if (t.project_type) setProjectType(t.project_type as ProjectType);
    if (t.script_type) setScriptType(t.script_type as ScriptType);
    if (t.genre) setGenre([t.genre]);
    if (t.format) setFormat(t.format);
    setStep(1);
  };

  // Determine if this is a content creator project
  const isContentCreator = ['youtube', 'tiktok'].includes(scriptType);
  const isTvProduction = projectType === 'tv_production';
  const isAudioOrPodcast = scriptType === 'podcast' || scriptType === 'audio_drama';
  const isAudioDrama = (isAudioOrPodcast && ['bbc_radio', 'us_radio', 'starc_standard'].includes(format)) || projectType === 'audio_drama';
  const isEpisodic = scriptType === 'episodic';
  const isNovel = scriptType === 'novel';

  // Only companies where user has create permissions
  const creatableCompanies = companyMemberships.filter((m) =>
    (['owner', 'admin', 'manager'] as CompanyRole[]).includes(m.role)
  );

  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !userId) return;
    setLoading(true);
    setError('');

    try {
      // Set project type based on script type
      let finalProjectType: ProjectType = projectType;
      if (projectType === 'tv_production') finalProjectType = 'tv_production';
      else if (isAudioOrPodcast && ['bbc_radio', 'us_radio', 'starc_standard'].includes(format)) finalProjectType = 'audio_drama';
      else if (isAudioOrPodcast) finalProjectType = 'podcast';
      else if (scriptType === 'youtube') finalProjectType = 'youtube';
      else if (scriptType === 'tiktok') finalProjectType = 'tiktok';
      else if (scriptType === 'videogame') finalProjectType = 'videogame';
      else if (scriptType === 'novel') finalProjectType = 'novel';
      else finalProjectType = 'film';

      const projectId = crypto.randomUUID();
      const now = new Date().toISOString();

      if (storageMode === 'local') {
        // ── Local project: write to IndexedDB ────────────────
        const projectRow: Record<string, unknown> = {
          id: projectId,
          title: title.trim(),
          logline: logline.trim() || null,
          format,
          genre,
          script_type: scriptType,
          project_type: finalProjectType,
          created_by: userId,
          company_id: selectedCompanyId || null,
          created_at: now,
          updated_at: now,
          status: 'development',
          is_showcased: false,
          showcase_script: false,
          showcase_mindmap: false,
          showcase_moodboard: false,
          set_photos: [],
          external_links: {},
          production_trivia: [],
          ...(scriptType === 'episodic' ? {
            season_number: seasonNumber ? parseInt(seasonNumber, 10) : 1,
            episode_count: episodeCount ? parseInt(episodeCount, 10) : null,
          } : {}),
        };

        // Verified: read back so we never claim "created" if storage dropped it
        await putCachedVerified('projects', projectRow);

        // Create a default script for the project
        const scriptId = crypto.randomUUID();
        const scriptRow: Record<string, unknown> = {
          id: scriptId,
          project_id: projectId,
          title: 'Untitled Script',
          version: 1,
          is_active: true,
          created_by: userId,
          created_at: now,
          updated_at: now,
        };
        await putCachedVerified('scripts', scriptRow);

        // Create a title page element
        const titleElement: Record<string, unknown> = {
          id: crypto.randomUUID(),
          script_id: scriptId,
          element_type: 'title_page',
          content: title.trim(),
          sort_order: 0,
          created_at: now,
          updated_at: now,
        };
        await putCachedVerified('script_elements', titleElement);

        if (window.electron?.writeFile) {
          const { saveProjectToDisk } = await import('@/lib/local-files');
          await saveProjectToDisk(projectRow as any, [scriptRow as any], [titleElement as any]);
        }

        toast.success(pickToast(NEW_PROJECT));
        router.push(scriptType === 'novel' ? `/projects/${projectId}/manuscript` : `/projects/${projectId}`);
        onCreated();
      } else {
        // ── Cloud project: write to Supabase ─────────────────
        const supabase = createClient();
        const { data, error: insertError } = await supabase
          .from('projects')
          .insert({
            id: projectId,
            title: title.trim(),
            logline: logline.trim() || null,
            format,
            genre,
            script_type: scriptType,
            project_type: finalProjectType,
            created_by: userId,
            company_id: selectedCompanyId || null,
            ...(scriptType === 'episodic' ? {
              season_number: seasonNumber ? parseInt(seasonNumber, 10) : 1,
              episode_count: episodeCount ? parseInt(episodeCount, 10) : null,
            } : {}),
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating project:', insertError);
          setError(insertError.message);
          setLoading(false);
          return;
        }

        if (data) {
          toast.success(pickToast(NEW_PROJECT));
          router.push(
            scriptType === 'episodic' ? `/projects/${data.id}/episodes`
            : scriptType === 'novel' ? `/projects/${data.id}/manuscript`
            : `/projects/${data.id}`,
          );
          onCreated();
        }
      }
    } catch (err) {
      console.error('Unexpected error creating project:', err);
      setError(t('new_project.failed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleGenre = (g: string) => {
    setGenre((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={step === 0 ? t('new_project.title') : t('new_project.details')} size="lg">
      {step === 0 ? (
        <div className="space-y-6">
          {/* Templates — shown if user has any */}
          {templates.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-[0.04em] mb-2">{t('new_project.from_template')}</p>
              <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="flex items-center gap-2 px-3 py-2 bg-surface-800 hover:bg-surface-700 border border-surface-700 hover:border-brand-500/40 rounded-lg text-left transition-colors"
                  >
                    <span className="text-sm font-bold text-surface-400">T</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-surface-200 truncate max-w-[120px]">{t.name}</p>
                      {t.description && <p className="text-[11px] text-surface-500 truncate max-w-[120px]">{t.description}</p>}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3 border-t border-surface-800" />
            </div>
          )}

          <p className="text-sm text-surface-400">{t('new_project.choose_type')}</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

            {/* Standard script-type options */}
            {SCRIPT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setScriptType(opt.value);
                  if (opt.value === 'youtube' || opt.value === 'tiktok' || opt.value === 'videogame' || opt.value === 'podcast' || opt.value === 'audio_drama' || opt.value === 'novel') {
                     setProjectType(opt.value as ProjectType);
                  } else {
                     setProjectType('film');
                  }
                  if (opt.value === 'podcast') setFormat('starc_standard');
                  else if (opt.value === 'episodic') setFormat('series');
                  else if (opt.value === 'videogame') setFormat('game');
                  else if (opt.value === 'novel') setFormat('novel');
                  else setFormat('feature');
                }}
                className={`text-left p-4 rounded-xl border-2 transition-colors ${
                  scriptType === opt.value && projectType !== 'tv_production'
                    ? opt.value === 'podcast'
                      ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30'
                      : 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30'
                    : 'border-surface-700 bg-surface-800/50 hover:border-surface-600'
                }`}
              >
                <Icon
                  name={opt.icon}
                  size="md"
                  className={
                    scriptType === opt.value && projectType !== 'tv_production'
                      ? opt.value === 'podcast' ? 'text-violet-400' : 'text-brand-500'
                      : 'text-surface-400'
                  }
                />
                <h3 className={`mt-1.5 text-sm font-semibold ${
                  scriptType === opt.value && projectType !== 'tv_production'
                    ? opt.value === 'podcast' ? 'text-violet-400' : 'text-brand-500'
                    : 'text-white'
                }`}>{opt.label}</h3>
                <p className="mt-0.5 text-[11px] text-surface-500">{opt.description}</p>
              </button>
            ))}

            {/* TV Production — broadcast workflow, listed after the writing formats */}
            <button
              type="button"
              onClick={() => {
                setProjectType('tv_production');
                setScriptType('screenplay');
              }}
              className={`text-left p-4 rounded-xl border-2 transition-colors ${
                projectType === 'tv_production'
                  ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                  : 'border-surface-700 bg-surface-800/50 hover:border-amber-500/30 hover:bg-surface-800'
              }`}
            >
              <div className={`transition-colors ${projectType === 'tv_production' ? 'text-amber-400' : 'text-surface-400'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <h3 className={`text-sm font-semibold ${projectType === 'tv_production' ? 'text-amber-400' : 'text-white'}`}>TV Production</h3>
              </div>
              <p className="mt-0.5 text-[11px] text-surface-500">Broadcast & studio — rundown, autocue, crew</p>
            </button>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(1)}>Continue</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <button type="button" onClick={() => { setStep(0); setProjectType('film'); }} className="text-xs text-surface-400 hover:text-white transition-colors flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              {isTvProduction ? (
                <>
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
                  <span className="text-amber-400">TV Production</span>
                </>
              ) : isAudioOrPodcast ? (
                <>
                  <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                  <span className="text-violet-400">Podcast & Audio Drama</span>
                </>
              ) : (
                <>
                  <Icon name={SCRIPT_TYPE_OPTIONS.find(o => o.value === scriptType)?.icon || 'film'} size="sm" className="text-surface-400" />
                  {SCRIPT_TYPE_OPTIONS.find(o => o.value === scriptType)?.label}
                </>
              )}
            </button>
          </div>

          {/* Company / Personal selector */}
          {creatableCompanies.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-surface-300">{t('new_project.create_for')}</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCompanyId(null)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-colors text-sm ${
                    selectedCompanyId === null
                      ? 'border-brand-500 bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/30'
                      : 'border-surface-700 bg-surface-800/50 text-surface-300 hover:border-surface-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                  {t('new_project.personal')}
                </button>
                {creatableCompanies.map((m) => (
                  <button
                    key={m.company_id}
                    type="button"
                    onClick={() => setSelectedCompanyId(m.company_id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-colors text-sm ${
                      selectedCompanyId === m.company_id
                        ? 'border-brand-500 bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/30'
                        : 'border-surface-700 bg-surface-800/50 text-surface-300 hover:border-surface-600'
                    }`}
                  >
                    {m.company.logo_url ? (
                      <img src={m.company.logo_url} alt={m.company.name || 'Company logo'} className="w-4 h-4 rounded object-cover" loading="lazy" />
                    ) : (
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center text-[11px] font-bold text-white"
                        style={{ backgroundColor: m.company.brand_color || '#6366f1' }}
                      >
                        {m.company.name[0]}
                      </div>
                    )}
                    {m.company.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Storage mode toggle — only show in Electron/local mode */}
          {isElectronMode() && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-surface-300">Storage</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStorageMode('local');
                    if (isElectronMode()) setLocalMode(true);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-colors text-sm ${
                    storageMode === 'local'
                      ? 'border-brand-500 bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/30'
                      : 'border-surface-700 bg-surface-800/50 text-surface-300 hover:border-surface-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg>
                  Local
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStorageMode('cloud');
                    if (isElectronMode()) setLocalMode(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-colors text-sm ${
                    storageMode === 'cloud'
                      ? 'border-brand-500 bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/30'
                      : 'border-surface-700 bg-surface-800/50 text-surface-300 hover:border-surface-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" /></svg>
                  Cloud
                </button>
              </div>
              <p className="text-[11px] text-surface-500">
                {storageMode === 'local'
                  ? 'Saved to your hard drive. You can sync to cloud later from Settings.'
                  : 'Saved to the cloud. Access from any device.'}
              </p>
            </div>
          )}

          <Input
            label={t('new_project.project_title')}
            placeholder={isTvProduction ? 'Dagsrevyen 24. desember' : isContentCreator ? 'How I Make $10k/Month as a Creator' : isAudioOrPodcast ? 'Dark Waters: Episode 1' : isNovel ? 'The Lighthouse Keeper\'s Daughter' : 'The Midnight Hour'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          <Textarea
            label={isTvProduction ? 'Production Description' : isContentCreator ? 'Video Concept' : isAudioOrPodcast ? 'Episode Premise' : isNovel ? 'Premise' : t('project.logline')}
            placeholder={isTvProduction 
              ? 'Live broadcast from Studio 1, 45 minutes, 3-camera setup...'
              : isContentCreator 
              ? 'In this video, I break down my exact strategies for...'
              : isAudioOrPodcast
              ? 'A detective investigates a string of disappearances in a fog-bound coastal town...'
              : isNovel
              ? 'A lighthouse keeper on a dying island finds letters from the woman who kept the light before her...'
              : 'A hard-boiled detective uncovers a conspiracy that reaches the highest levels of power...'}
            value={logline}
            onChange={(e) => setLogline(e.target.value)}
            rows={3}
          />

          {!isContentCreator && !isTvProduction && !isAudioOrPodcast && (
            <>
              {isNovel ? (
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-3">Length</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {NOVEL_FORMAT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormat(opt.value)}
                        className={`text-left p-3 rounded-xl border-2 transition-colors ${
                          format === opt.value
                            ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30'
                            : 'border-surface-700 bg-surface-800/50 hover:border-surface-600'
                        }`}
                      >
                        <h3 className={`text-sm font-semibold ${format === opt.value ? 'text-brand-500' : 'text-white'}`}>{opt.label}</h3>
                        <p className="mt-0.5 text-[11px] text-surface-500">{opt.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <Select
                  label="Format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  options={FORMAT_OPTIONS}
                />
              )}

              {isEpisodic && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Season Number" type="number" min={1} value={seasonNumber} onChange={(e) => setSeasonNumber(e.target.value)} placeholder="1" />
                  <Input label="Episodes Planned" type="number" min={1} value={episodeCount} onChange={(e) => setEpisodeCount(e.target.value)} placeholder="8" />
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-surface-300">{t('new_project.genre')}</label>
                <div className="flex flex-wrap gap-2">
                  {(isNovel ? NOVEL_GENRE_OPTIONS : GENRE_OPTIONS).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenre(g)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        genre.includes(g)
                          ? 'bg-brand-600 text-white'
                          : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Audio Drama / Podcast — format picker + genre */}
          {isAudioOrPodcast && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-3">Script Format</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {AUDIO_DRAMA_FORMAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormat(opt.value)}
                      className={`text-left p-3.5 rounded-xl border-2 transition-colors ${
                        format === opt.value
                          ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30'
                          : 'border-surface-700 bg-surface-800/50 hover:border-surface-600'
                      }`}
                    >
                      <h3 className={`text-sm font-semibold ${format === opt.value ? 'text-violet-300' : 'text-white'}`}>{opt.label}</h3>
                      <p className="mt-0.5 text-[11px] text-surface-500">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-surface-300">{t('new_project.genre')}</label>
                <div className="flex flex-wrap gap-2">
                  {GENRE_OPTIONS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenre(g)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        genre.includes(g)
                          ? 'bg-violet-600 text-white'
                          : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isEpisodic && (
            <div className="bg-surface-800/50 rounded-xl p-4 border border-surface-700">
              <p className="text-sm text-surface-300 mb-3 font-semibold">Your series gets:</p>
              <ul className="text-xs text-surface-400 space-y-1.5">
                <li className="flex items-center gap-2"><span className="text-brand-500">✓</span> Episode manager — one script per episode, tracked together</li>
                <li className="flex items-center gap-2"><span className="text-brand-500">✓</span> Season + episode numbering &amp; arc planning</li>
                <li className="flex items-center gap-2"><span className="text-brand-500">✓</span> Series-wide character, location &amp; scene tracking</li>
                <li className="flex items-center gap-2"><span className="text-brand-500">✓</span> Per-episode production scheduling &amp; shot lists</li>
                <li className="flex items-center gap-2"><span className="text-brand-500">✓</span> Real-time collaboration across the entire season</li>
              </ul>
            </div>
          )}

          {isContentCreator && (
            <div className="bg-surface-800/50 rounded-xl p-4 border border-surface-700">
              <p className="text-sm text-surface-300 mb-3">You&apos;ll get access to:</p>
              <ul className="text-xs text-surface-400 space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Script editor with Hook, Intro, CTA templates
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Thumbnail planner with A/B testing
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> SEO optimizer (title, tags, description)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Sponsor segment tracker
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Upload checklist
                </li>
              </ul>
            </div>
          )}

          {isTvProduction && (
            <div className="bg-gradient-to-br from-amber-500/5 to-surface-800/50 rounded-xl p-4 border border-amber-500/20">
              <p className="text-sm text-amber-300 mb-3 font-semibold">Professional Production Tools</p>
              <ul className="text-xs text-surface-400 space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span> Rundown editor with live timing
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span> Dagsplan — day scheduling with crew calls
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span> HTML-based autocue / teleprompter
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span> Call sheet generator
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span> Crew & equipment management
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span> Real-time team chat
                </li>
              </ul>
            </div>
          )}

          {isAudioDrama && (
            <div className="bg-surface-800/50 rounded-xl p-4 border border-surface-700">
              <p className="text-sm text-surface-300 mb-3 font-semibold">Your audio drama workspace includes:</p>
              <ul className="text-xs text-surface-400 space-y-1.5">
                <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Script editor in STARC audio drama format</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> SFX, MUSIC &amp; AMBIENCE cue lines baked-in</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Sound Design library — manage all cues in one place</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Voice cast tracker (characters + casting notes)</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Episode manager for audio drama series</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">✓</span> Arc planner, ideas &amp; story documents</li>
              </ul>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {t('new_project.create')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
