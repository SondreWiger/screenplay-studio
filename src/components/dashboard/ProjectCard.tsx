'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Badge } from '@/components/ui';
import { StageBadge } from './DashboardOverview';

import { timeAgo, cn } from '@/lib/utils';
import { useTranslation } from '@/components/TranslationProvider';
import type { Project, DashboardFolder } from '@/lib/types';
import { MoreMenu, type MoreMenuItem } from '@/components/projects/ManageControls';

export function ProjectCard({
  project, folders, moveToFolder,
  draggingProjectId, setDraggingProjectId, viewMode, currentUserId, onRename, onDelete,
}: {
  project: Project;
  folders: DashboardFolder[];
  moveToFolder: (projectId: string, folderId: string | null) => void;
  draggingProjectId: string | null;
  setDraggingProjectId: (id: string | null) => void;
  viewMode?: 'grid' | 'list';
  currentUserId?: string;
  onRename: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const isOwner = !!currentUserId && project.created_by === currentUserId;
  const menuItems: MoreMenuItem[] = [
    { label: 'Rename', icon: 'rename', onSelect: () => onRename(project) },
    { label: 'Project settings', icon: 'settings', onSelect: () => router.push(`/projects/${project.id}/settings`) },
    {
      label: 'Delete project', icon: 'delete', danger: true, onSelect: () => onDelete(project),
      disabledReason: isOwner ? undefined : 'Only the creator can delete it',
    },
  ];
  // Folder choices live inside the same menu
  const folderSection = folders.length > 0 ? (close: () => void) => (
    <div className="border-t border-surface-800 mt-1 pt-1">
      <div className="px-3 py-1.5 text-[11px] text-surface-500 uppercase tracking-[0.04em] font-medium">{t('dashboard.move_to_folder')}</div>
      {project.folder_id && (
        <button type="button" role="menuitem" onClick={() => { close(); moveToFolder(project.id, null); }} className="flex items-center gap-2.5 w-full px-3 py-1.5 text-surface-400 hover:bg-surface-800 hover:text-white">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          {t('dashboard.remove_from_folder')}
        </button>
      )}
      {folders.map(f => (
        <button key={f.id} type="button" role="menuitem" onClick={() => { close(); moveToFolder(project.id, f.id); }} className={cn('flex items-center gap-2.5 w-full px-3 py-1.5 hover:bg-surface-800 transition-colors', project.folder_id === f.id ? 'text-white' : 'text-surface-300 hover:text-white')}>
          <span className="w-2.5 h-2.5 mx-[3px] rounded-md flex-shrink-0" style={{ backgroundColor: f.color }} />
          {f.emoji && <span>{f.emoji}</span>}
          <span className="truncate">{f.name}</span>
          {project.folder_id === f.id && <svg className="w-3 h-3 ml-auto text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.293 9.879a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
        </button>
      ))}
    </div>
  ) : undefined;
  const actionsMenu = (
    <MoreMenu items={menuItems} label={`Actions for ${project.title}`}>{folderSection}</MoreMenu>
  );
  const isDragging = draggingProjectId === project.id;
  const currentFolder = folders.find(f => f.id === project.folder_id);

  // List row view
  if (viewMode === 'list') {
    return (
      <div
        className={cn('relative group transition-all duration-300 ease-spring', isDragging && 'opacity-40 cursor-grabbing')}
        draggable
        onDragStart={e => { e.dataTransfer.setData('projectId', project.id); e.dataTransfer.effectAllowed = 'move'; setDraggingProjectId(project.id); }}
        onDragEnd={() => setDraggingProjectId(null)}
      >
        <Link 
          href={`/projects/${project.id}`}
          onClick={(e) => {
            try {
              const lastPath = localStorage.getItem(`last_project_tab_${project.id}`);
              if (lastPath) {
                e.preventDefault();
                window.location.href = lastPath; // We use window.location here for simplicity, but a router push is better
              }
            } catch { /* ignore */ }
          }}
        >
          <div className="flex items-center gap-3 pl-3 pr-12 py-2.5 rounded-2xl border border-surface-800/50 bg-surface-900/40 backdrop-blur-sm hover:border-surface-600/50 hover:bg-surface-800/50 transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:shadow-lg shadow-sm group">
            {/* Thumbnail */}
            <div className="relative w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center shrink-0 overflow-hidden">
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-lg font-bold text-surface-500">{project.title[0]}</span>
              </div>
              {project.cover_url && (
                <img src={project.cover_url} alt={project.title || 'Project cover'} loading="lazy" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget).style.display = 'none'; }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white group-hover:text-brand-500 transition-colors truncate">{project.title}</p>
              {project.logline && <p className="text-xs text-surface-500 truncate">{project.logline}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {project.genre?.slice(0, 1).map((g) => <Badge key={g} size="sm">{g}</Badge>)}
              <Badge size="sm" variant="default">{({
  film: 'Film',
  tv_production: 'TV',
  audio_drama: 'Audio',
  stage_play: 'Stage',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  podcast: 'Podcast',
  educational: 'Edu',
  livestream: 'Live',
  documentary: 'Doc',
} as Record<string, string>)[project.project_type] || project.project_type}</Badge>
              <StageBadge status={project.status} size="sm" />
              <span className="text-[11px] text-surface-500 hidden sm:inline">{timeAgo(project.updated_at)}</span>
            </div>
          </div>
        </Link>
        {/* Rename / settings / move / delete */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">{actionsMenu}</div>
      </div>
    );
  }

  return (
    <div
      className={cn('relative group transition-all duration-300 ease-spring', isDragging && 'opacity-40 scale-95 cursor-grabbing')}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('projectId', project.id);
        e.dataTransfer.effectAllowed = 'move';
        setDraggingProjectId(project.id);
      }}
      onDragEnd={() => setDraggingProjectId(null)}
    >
      <Link 
        href={`/projects/${project.id}`}
        onClick={(e) => {
          try {
            const lastPath = localStorage.getItem(`last_project_tab_${project.id}`);
            if (lastPath) {
              e.preventDefault();
              window.location.href = lastPath;
            }
          } catch { /* ignore */ }
        }}
      >
        <Card hover className="overflow-hidden group">
          <div className="h-36 bg-gradient-to-br from-surface-800 to-surface-900 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-5xl font-bold text-surface-700/60 group-hover:text-surface-600/60 transition-colors select-none">{project.title[0]}</span>
            </div>
            {project.cover_url && (
              <img src={project.cover_url} alt={project.title || 'Project cover'} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget).style.display = 'none'; }} />
            )}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent" />
            {/* Bottom corner: the top-right corner holds the "⋯" menu */}
            <div className="absolute bottom-2.5 right-2.5">
              <StageBadge status={project.status} />
            </div>
            {currentFolder && (
              <div className="absolute top-2.5 left-2.5">
                <span className="text-[11px] font-bold text-white/80 px-1.5 py-0.5 rounded" style={{ backgroundColor: currentFolder.color + 'cc' }}>
                  {currentFolder.emoji ? `${currentFolder.emoji} ` : ''}{currentFolder.name}
                </span>
              </div>
            )}
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white group-hover:text-brand-500 transition-colors truncate">
                {project.title}
              </h3>
              <Badge size="sm" variant="default">{({
  film: 'Film',
  tv_production: 'TV',
  audio_drama: 'Audio',
  stage_play: 'Stage',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  podcast: 'Podcast',
  educational: 'Edu',
  livestream: 'Live',
  documentary: 'Doc',
} as Record<string, string>)[project.project_type] || project.project_type}</Badge>
            </div>
            {project.logline && (
              <p className="mt-1 text-xs text-surface-400 line-clamp-2 leading-relaxed">{project.logline}</p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1">
                {project.genre?.slice(0, 2).map((g) => (
                  <Badge key={g} size="sm">{g}</Badge>
                ))}
                {(project.genre?.length || 0) > 2 && (
                  <span className="text-[11px] text-surface-500">+{(project.genre?.length || 0) - 2}</span>
                )}
              </div>
              <span className="text-[11px] text-surface-500">{timeAgo(project.updated_at)}</span>
            </div>
          </div>
        </Card>
      </Link>

      {/* Rename / settings / move / delete */}
      <div className="absolute top-2.5 right-2.5 z-10">{actionsMenu}</div>
    </div>
  );
}
