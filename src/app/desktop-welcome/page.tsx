'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Icon } from '@/components/ui/icons';
import { isElectronMode } from '@/lib/supabase/electron-client';

export default function DesktopWelcome() {
  const router = useRouter();
  const [recentProjects, setRecentProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!isElectronMode()) {
      router.replace('/dashboard');
      return;
    }

    if (window.electron?.getRecentProjects) {
      window.electron.getRecentProjects().then(setRecentProjects);
    }
  }, [router]);

  const handleNewProject = async () => {
    const isLocal = localStorage.getItem('ss-local-mode') === '1';
    if (isLocal) {
      const projectId = crypto.randomUUID();
      const scriptId = crypto.randomUUID();
      const now = new Date().toISOString();

      const user = JSON.parse(localStorage.getItem('ss-local-user') || '{}');

      const { putCached } = await import('@/lib/offline/db');

      await putCached('projects', {
        id: projectId,
        title: 'Untitled',
        logline: null,
        format: 'feature',
        genre: [],
        script_type: 'screenplay',
        project_type: 'film',
        created_by: user.id || '',
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
        content_metadata: {},
      });

      await putCached('scripts', {
        id: scriptId,
        project_id: projectId,
        title: 'Untitled Script',
        version: 1,
        is_active: true,
        created_by: user.id || '',
        created_at: now,
        updated_at: now,
      });

      await putCached('script_elements', {
        id: crypto.randomUUID(),
        script_id: scriptId,
        element_type: 'title_page',
        content: 'Untitled',
        sort_order: 0,
        created_at: now,
        updated_at: now,
      });

      if (window.electron?.addRecentProject) {
        window.electron.addRecentProject({ id: projectId, title: 'Untitled' });
      }

      if (window.electron?.writeFile) {
        const { saveProjectToDisk } = await import('@/lib/local-files');
        const proj = { id: projectId, title: 'Untitled', status: 'development', updated_at: now, created_at: now };
        const script = { id: scriptId, project_id: projectId, title: 'Untitled Script', version: 1, is_active: true, updated_at: now, created_at: now };
        const element = { id: crypto.randomUUID(), script_id: scriptId, element_type: 'title_page', content: 'Untitled', sort_order: 0, updated_at: now, created_at: now };
        await saveProjectToDisk(proj as any, [script as any], [element as any]);
      }

      router.push(`/projects/${projectId}/script`);
    } else {
      router.push('/dashboard?new=1');
    }
  };

  const handleOpenFile = async () => {
    if (window.electron?.openFile) {
      const result = await window.electron.openFile({
        filters: [{ name: 'Screenplay Studio', extensions: ['studio', 'json', 'screenplay', 'fdx', 'fountain'] }]
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        try {
          const content = await window.electron.readFile(filePath);
          const data = JSON.parse(content);
          
          let projectId = '';
          let projectTitle = 'Untitled';
          
          if (data.project && data.project.id) {
            projectId = data.project.id;
            projectTitle = data.project.title || 'Untitled';
            
            // It's a full project bundle (.studio / project.json format)
            const basePath = await window.electron.getDocumentsDir();
            const projectDir = `${basePath}/ScreenplayStudio/projects/${projectId}`;
            await window.electron.writeFile(`${projectDir}/project.json`, content);
          } else if (data.script && data.script.id) {
            projectId = data.script.project_id || 'local-' + data.script.id;
            projectTitle = data.script.title || 'Untitled Script';
            
            // It's a bare .screenplay file. Wrap it in a project.
            const fauxProject = {
              id: projectId,
              title: projectTitle,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            const bundleData = {
              project: fauxProject,
              scripts: [data.script],
              elements: data.elements || [],
              savedAt: new Date().toISOString(),
              version: 1
            };
            const basePath = await window.electron.getDocumentsDir();
            const projectDir = `${basePath}/ScreenplayStudio/projects/${projectId}`;
            await window.electron.writeFile(`${projectDir}/project.json`, JSON.stringify(bundleData, null, 2));
          } else {
            alert('Invalid file format. No project or script found.');
            return;
          }
          
          // Add to recent projects
          if (window.electron.addRecentProject) {
            window.electron.addRecentProject({
              id: projectId,
              title: projectTitle,
            });
          }
          
          // Navigate to editor
          router.push(`/projects/${projectId}/script`);
        } catch (err) {
          console.error('Failed to open file:', err);
          alert('Failed to read file. It might not be a valid Screenplay Studio project.');
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent">
      <div className="max-w-2xl w-full p-8 flex flex-col items-center">
        {/* App Icon / Logo area */}
        <div className="w-24 h-24 bg-brand-500 rounded-3xl shadow-2xl flex items-center justify-center mb-8">
          <Icon name="feather" size="xl" className="text-white" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Screenplay Studio</h1>
        <p className="text-surface-400 mb-12 text-center max-w-md">
          The fastest way to write, organize, and plan your next big script.
        </p>

        <div className="flex gap-4 mb-16">
          <Button size="lg" onClick={handleNewProject} className="gap-2 px-8">
            <Icon name="plus" />
            New Document
          </Button>
          <Button variant="secondary" size="lg" onClick={handleOpenFile} className="gap-2 px-8">
            <Icon name="folder" />
            Open File...
          </Button>
        </div>

        <div className="w-full">
          <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-4 px-2">
            Recent Scripts
          </h2>
          {recentProjects.length > 0 ? (
            <div className="space-y-1">
              {recentProjects.map((rp) => (
                <button
                  key={rp.id}
                  onClick={() => router.push(`/projects/${rp.id}/script`)}
                  className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-surface-800/50 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-surface-800 flex items-center justify-center group-hover:bg-surface-700 transition-colors">
                    <Icon name="file-text" className="text-surface-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{rp.title || 'Untitled'}</div>
                    <div className="text-xs text-surface-400">{new Date(rp.lastOpened).toLocaleDateString()}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-surface-500 text-center py-8 border border-dashed border-surface-800 rounded-xl">
              No recent scripts. Create a new one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
