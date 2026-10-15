/**
 * Opening a file in the desktop app — from File › Open, a double-click in
 * Finder or Explorer, or the welcome screen — becomes a project.
 *
 * Understood formats: Screenplay Studio's own `.screenplay` (a script) and
 * project bundles (`project.json` / `.studio`), plus Fountain and Final Draft.
 * In local mode the project is written to this computer; signed in, it is
 * created in the cloud like any other import.
 */

import { createClient } from '@/lib/supabase/client';
import { isLocalMode, getLocalUser } from '@/lib/supabase/electron-client';
import { cacheRows, getCachedById } from '@/lib/offline/db';
import { saveProjectToDisk, loadProjectFromDisk } from '@/lib/local-files';
import { parseFDX, parseFountain } from '@/lib/scripts';
import { normalizeParsed } from '@/lib/scripts/normalize';
import { useAuthStore } from '@/lib/stores';
import type { Project, Script, ScriptElement, TitlePageData } from '@/lib/types';

export const OPENABLE_EXTENSIONS = ['screenplay', 'fountain', 'fdx', 'studio', 'json'];

export interface ImportedProject {
  projectId: string;
  title: string;
  /** True when the file was a project already on this computer. */
  alreadyExisted: boolean;
}

interface ParsedFile {
  title: string;
  titlePage: Partial<TitlePageData>;
  elements: Partial<ScriptElement>[];
  /** Set when the file is a full project bundle with its own ids. */
  bundle?: { project: Project; scripts: Script[]; elements: ScriptElement[] };
}

function baseName(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop() || 'Untitled';
  return name.replace(/\.[^.]+$/, '') || 'Untitled';
}

function extensionOf(filePath: string): string {
  const match = filePath.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

export function parseOpenedFile(filePath: string, content: string): ParsedFile {
  const ext = extensionOf(filePath);
  const fallbackTitle = baseName(filePath);

  if (ext === 'fountain' || ext === 'txt') {
    const { titlePage, elements } = parseFountain(content);
    if (!elements.length) throw new Error('This Fountain file has no script in it.');
    return { title: titlePage.title?.trim() || fallbackTitle, titlePage, elements };
  }

  if (ext === 'fdx') {
    const { titlePage, elements } = parseFDX(content);
    if (!elements.length) throw new Error('This Final Draft file has no script in it.');
    return { title: titlePage.title?.trim() || fallbackTitle, titlePage, elements };
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('This file isn’t a Screenplay Studio project or script.');
  }

  const project = data.project as Project | undefined;
  if (project && typeof project.id === 'string') {
    return {
      title: project.title || fallbackTitle,
      titlePage: {},
      elements: [],
      bundle: {
        project,
        scripts: Array.isArray(data.scripts) ? (data.scripts as Script[]) : [],
        elements: Array.isArray(data.elements) ? (data.elements as ScriptElement[]) : [],
      },
    };
  }

  const script = data.script as Script | undefined;
  if (script && Array.isArray(data.elements)) {
    return {
      title: script.title || fallbackTitle,
      titlePage: (script.title_page_data as Partial<TitlePageData>) || {},
      elements: data.elements as Partial<ScriptElement>[],
    };
  }

  throw new Error('This file isn’t a Screenplay Studio project or script.');
}

function freshElements(parsed: Partial<ScriptElement>[], scriptId: string, userId: string | null, now: string): ScriptElement[] {
  return normalizeParsed(parsed).map((el, i) => ({
    ...el,
    id: crypto.randomUUID(),
    script_id: scriptId,
    sort_order: i,
    scene_number: el.scene_number ?? null,
    revision_color: el.revision_color ?? 'white',
    is_revised: false,
    is_omitted: !!el.is_omitted,
    scene_status: el.scene_status ?? null,
    metadata: el.metadata ?? {},
    created_by: userId,
    last_edited_by: userId,
    created_at: now,
    updated_at: now,
  }));
}

async function importLocally(parsed: ParsedFile): Promise<ImportedProject> {
  const userId = getLocalUser()?.id ?? null;
  const now = new Date().toISOString();

  if (parsed.bundle) {
    const { project, scripts, elements } = parsed.bundle;
    const existing = (await getCachedById('projects', project.id)) || (await loadProjectFromDisk(project.id));
    if (existing) return { projectId: project.id, title: project.title || parsed.title, alreadyExisted: true };
    await cacheRows('projects', [project as unknown as Record<string, unknown>]);
    await cacheRows('scripts', scripts as unknown as Record<string, unknown>[]);
    await cacheRows('script_elements', elements as unknown as Record<string, unknown>[]);
    await saveProjectToDisk(project, scripts, elements);
    return { projectId: project.id, title: project.title || parsed.title, alreadyExisted: false };
  }

  const projectId = crypto.randomUUID();
  const scriptId = crypto.randomUUID();
  const project = {
    id: projectId,
    title: parsed.title,
    logline: null,
    format: 'feature',
    genre: [],
    script_type: 'screenplay',
    project_type: 'film',
    status: 'development',
    created_by: userId,
    created_at: now,
    updated_at: now,
    is_showcased: false,
    set_photos: [],
    external_links: {},
    production_trivia: [],
  } as unknown as Project;
  const script = {
    id: scriptId,
    project_id: projectId,
    title: parsed.title,
    version: 1,
    is_active: true,
    title_page_data: parsed.titlePage,
    created_by: userId,
    created_at: now,
    updated_at: now,
  } as unknown as Script;
  const elements = freshElements(parsed.elements, scriptId, userId, now);

  await cacheRows('projects', [project as unknown as Record<string, unknown>]);
  await cacheRows('scripts', [script as unknown as Record<string, unknown>]);
  await cacheRows('script_elements', elements as unknown as Record<string, unknown>[]);
  await saveProjectToDisk(project, [script], elements);
  return { projectId, title: parsed.title, alreadyExisted: false };
}

async function importToCloud(parsed: ParsedFile): Promise<ImportedProject> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Sign in to open files into your cloud projects.');
  const supabase = createClient();

  if (parsed.bundle) {
    const { data: existing } = await supabase.from('projects').select('id, title').eq('id', parsed.bundle.project.id).maybeSingle();
    if (existing) return { projectId: existing.id, title: existing.title || parsed.title, alreadyExisted: true };
  }

  const elementsSource = parsed.bundle
    ? (parsed.bundle.elements.filter((e) => e.script_id === (parsed.bundle!.scripts.find((s) => s.is_active) ?? parsed.bundle!.scripts[0])?.id))
    : parsed.elements;

  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .insert({ title: parsed.title, script_type: 'screenplay', project_type: 'film', format: 'feature', created_by: user.id })
    .select()
    .single();
  if (projectErr || !project) throw new Error(projectErr?.message || 'Couldn’t create the project.');

  // A database trigger creates the first draft; fill it in.
  let { data: script } = await supabase
    .from('scripts')
    .select('id')
    .eq('project_id', project.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!script) {
    const inserted = await supabase
      .from('scripts')
      .insert({ project_id: project.id, title: parsed.title, version: 1, is_active: true, created_by: user.id })
      .select('id')
      .single();
    if (inserted.error || !inserted.data) throw new Error(inserted.error?.message || 'Couldn’t create the script.');
    script = inserted.data;
  }
  await supabase.from('scripts').update({ title: parsed.title, title_page_data: parsed.titlePage || {} }).eq('id', script.id);

  const rows = normalizeParsed(elementsSource).map((el, i) => ({
    script_id: script!.id,
    element_type: el.element_type,
    content: el.content,
    sort_order: i,
    scene_number: el.scene_number ?? null,
    metadata: el.metadata ?? {},
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('script_elements').insert(rows.slice(i, i + 100));
    if (error) throw new Error(`Some of the script couldn’t be saved: ${error.message}`);
  }
  return { projectId: project.id, title: parsed.title, alreadyExisted: false };
}

/** Read `filePath` from disk and turn it into a project. */
export async function importDesktopFile(filePath: string): Promise<ImportedProject> {
  if (!window.electron) throw new Error('Opening files needs the desktop app.');
  const content = await window.electron.readFile(filePath);
  const parsed = parseOpenedFile(filePath, content);
  const result = isLocalMode() ? await importLocally(parsed) : await importToCloud(parsed);
  void window.electron.addRecentProject({ id: result.projectId, title: result.title, path: filePath });
  return result;
}

/** Show the Open dialog and import the chosen file. Null if cancelled. */
export async function chooseAndImportFile(): Promise<ImportedProject | null> {
  if (!window.electron) return null;
  const result = await window.electron.openFile({
    filters: [
      { name: 'Scripts and Projects', extensions: OPENABLE_EXTENSIONS },
      { name: 'Screenplay Studio', extensions: ['screenplay', 'studio', 'json'] },
      { name: 'Fountain', extensions: ['fountain'] },
      { name: 'Final Draft', extensions: ['fdx'] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return importDesktopFile(result.filePaths[0]);
}
