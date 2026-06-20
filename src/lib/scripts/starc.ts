/**
 * .starc File Parser
 *
 * Reads Story Architect (.starc) project files — which are SQLite3 databases
 * with a renamed extension — and extracts screenplay content for import.
 *
 * SECURITY MODEL:
 * - Validates SQLite file header magic bytes before opening
 * - All database queries use parameterized statements (no string interpolation)
 * - All extracted text is sanitized: HTML tags stripped, length-capped
 * - Document type whitelist — only known types are processed
 * - No code execution from file content — only plain text extraction
 * - BLOB content decoded as UTF-8 with fallback; invalid data rejected
 *
 * The .starc SQLite schema (from STARC source: database.cpp):
 *   system_variables (variable TEXT PK, value TEXT)
 *   documents (id INTEGER PK, uuid TEXT UNIQUE, type INTEGER, content BLOB, synced_at TEXT)
 *   documents_changes (id INTEGER PK, fk_document_uuid TEXT, uuid TEXT, undo_patch BLOB, ...)
 */

import type { ScriptElement, ScriptElementType, TitlePageData } from '@/lib/types';

// ─── Security Constants ────────────────────────────────────────────

/** Maximum text length for any extracted field — prevents payload bombs */
const MAX_TEXT_LENGTH = 100_000;

/** Maximum number of elements we'll extract per document */
const MAX_ELEMENTS = 50_000;

/** SQLite file magic bytes: "SQLite format 3\000" */
const SQLITE_MAGIC = new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]);

/**
 * Known STARC document type codes (from source analysis).
 * Only these types will be imported. Anything else is ignored.
 *
 * The type编码 system uses a multi-digit scheme:
 *   1       = project structure/settings
 *   101xx   = screenplay documents (10104 = screenplay text)
 *   102xx   = comic documents
 *   103xx   = novel documents
 *   104xx   = stage play documents
 *   2xxxx   = character/location/world data
 */
const KNOWN_DOCUMENT_TYPES = new Set([
  1,          // project structure
  10101,      // screenplay (possibly outline)
  10102,      // screenplay (possibly treatment)
  10103,      // screenplay (possibly beat sheet)
  10104,      // screenplay (main script text)
  10201,      // comic
  10202,      // comic
  10203,      // comic
  10301,      // novel
  10302,      // novel
  10303,      // novel
  10401,      // stage play
  10402,      // stage play
  20101,      // character
  20102,      // character
  20201,      // location
  20202,      // location
  20301,      // world/bible
  20302,      // world/bible
]);

/** Document types that represent script/text content (not metadata) */
const SCRIPT_DOCUMENT_TYPES = new Set([10101, 10102, 10103, 10104, 10201, 10202, 10203, 10301, 10302, 10303, 10401, 10402]);

// ─── Types ─────────────────────────────────────────────────────────

export interface StarcImportResult {
  title: string;
  projectVersion: string;
  elements: Partial<ScriptElement>[];
  titlePage: TitlePageData;
  characters: string[];
  locations: string[];
  metadata: {
    documentCount: number;
    scriptDocumentType: number | null;
  };
}

// ─── Input Sanitization ────────────────────────────────────────────

/**
 * Strip ALL HTML/XML tags from text. STARC stores content as XML-like
 * markup (<scene-heading>, <character>, etc.). We extract only the
 * text content, never the tags themselves.
 *
 * This also prevents any injected HTML/script from passing through.
 */
function stripAllTags(text: string): string {
  // Remove everything that looks like a tag: <...>
  // Also handle malformed tags, attributes, self-closing, etc.
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Decode a BLOB from the database into a string.
 * Tries UTF-8 decoding first. If the content looks like it might be
 * compressed (starts with gzip magic bytes 0x1f 0x8b), we skip it
 * since we can't decompress in a safe way without additional libs.
 *
 * Returns null if the data can't be decoded as valid UTF-8.
 */
function decodeBlob(blob: Uint8Array | null): string | null {
  if (!blob || blob.length === 0) return null;

  // Check for gzip magic — skip compressed content
  if (blob.length >= 2 && blob[0] === 0x1f && blob[1] === 0x8b) {
    return null;
  }

  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(blob);
  } catch {
    return null;
  }
}

/**
 * Sanitize a single text field: strip tags, enforce length limit.
 */
function sanitizeText(text: string, maxLength = MAX_TEXT_LENGTH): string {
  const cleaned = stripAllTags(text).trim();
  if (cleaned.length > maxLength) {
    return cleaned.slice(0, maxLength);
  }
  return cleaned;
}

/**
 * Validate that a value looks like a plausible document type integer.
 * Reject anything that isn't a clean positive integer.
 */
function validateDocType(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 100000) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed < 100000) {
      return parsed;
    }
  }
  return null;
}

// ─── STARC Content Parser ──────────────────────────────────────────

/**
 * Parse STARC XML-like content into script elements.
 *
 * STARC stores screenplay content as XML markup like:
 *   <scene-heading>INT. OFFICE - DAY</scene-heading>
 *   <character>JOHN</character>
 *   <dialogue>Hello world</dialogue>
 *
 * We extract text from each tag and map to our element types.
 */
function parseStarcContent(content: string): Partial<ScriptElement>[] {
  const elements: Partial<ScriptElement>[] = [];
  let sortOrder = 0;
  let sceneCount = 0;

  // STARC XML tag to our element type mapping
  const TAG_MAP: Record<string, ScriptElementType> = {
    'scene-heading': 'scene_heading',
    'scene_heading': 'scene_heading',
    'folder': 'sequence',
    'folder_header': 'sequence',
    'folder_footer': 'sequence_end',
    'sequence': 'sequence',
    'sequence_heading': 'sequence',
    'sequence_footer': 'sequence_end',
    'action': 'action',
    'character': 'character',
    'dialogue': 'dialogue',
    'parenthetical': 'parenthetical',
    'transition': 'transition',
    'shot': 'shot',
    'title': 'title_page',
    'lyrics': 'lyrics',
    'note': 'note',
    'centered': 'centered',
    // Novel-specific
    'chapter_heading': 'section',
    'chapter': 'section',
    'paragraph': 'action',
    // Stage play
    'stage_direction': 'action',
    'entrance_exit': 'action',
    // Comic
    'page_heading': 'scene_heading',
    'panel_heading': 'scene_heading',
    'panel_description': 'action',
    'caption': 'centered',
    'sfx': 'action',
  };

  // Try to parse as XML-like content with tags
  // STARC uses custom tags, not standard XML, so we use regex
  const tagPattern = /<([a-z_-]+)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  let lastEnd = 0;

  while ((match = tagPattern.exec(content)) !== null) {
    // Check element limit
    if (elements.length >= MAX_ELEMENTS) break;

    // Process any plain text between tags as action
    const between = content.slice(lastEnd, match.index).trim();
    if (between.length > 0) {
      const text = sanitizeText(between);
      if (text) {
        elements.push({
          element_type: 'action',
          content: text,
          sort_order: sortOrder++,
          scene_number: null,
        });
      }
    }

    const tagName = match[1].toLowerCase();
    const tagContent = match[2];
    const elementType = TAG_MAP[tagName] || 'action';

    const text = sanitizeText(tagContent);
    if (!text) {
      lastEnd = match.index + match[0].length;
      continue;
    }

    const element: Partial<ScriptElement> = {
      element_type: elementType,
      content: text,
      sort_order: sortOrder++,
      scene_number: null,
    };

    // Track scene numbers
    if (elementType === 'scene_heading') {
      sceneCount++;
      element.scene_number = String(sceneCount);
    }

    elements.push(element);
    lastEnd = match.index + match[0].length;
  }

  // Process any trailing text
  const trailing = content.slice(lastEnd).trim();
  if (trailing.length > 0 && elements.length < MAX_ELEMENTS) {
    const text = sanitizeText(trailing);
    if (text) {
      elements.push({
        element_type: 'action',
        content: text,
        sort_order: sortOrder++,
        scene_number: null,
      });
    }
  }

  // If no tags found, treat entire content as plain text (action blocks)
  if (elements.length === 0 && content.trim().length > 0) {
    const lines = content.split('\n');
    for (const line of lines) {
      if (elements.length >= MAX_ELEMENTS) break;
      const text = sanitizeText(line);
      if (text) {
        elements.push({
          element_type: 'action',
          content: text,
          sort_order: sortOrder++,
          scene_number: null,
        });
      }
    }
  }

  return elements;
}

// ─── Main Parser ───────────────────────────────────────────────────

/**
 * Parse a .starc file (SQLite3 database) and extract screenplay content.
 *
 * SECURITY: This function validates the file header, uses only
 * parameterized queries, sanitizes all extracted text, and enforces
 * length/count limits on all output.
 */
export async function parseStarcFile(file: File): Promise<StarcImportResult> {
  // Dynamic import of sql.js — loaded from node_modules, WASM-based
  const initSqlJs = (await import('sql.js')).default;

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // ── SECURITY: Validate SQLite header magic bytes ──
  if (data.length < 16) {
    throw new Error('File is too small to be a valid .starc project');
  }
  const headerMatch = data.slice(0, 16);
  const isValid = SQLITE_MAGIC.every((byte, i) => headerMatch[i] === byte);
  if (!isValid) {
    throw new Error('Not a valid .starc file (bad header). The file may be corrupted or not a SQLite database.');
  }

  // ── Open database in memory (WASM sandbox — no filesystem access) ──
  const SQL = await initSqlJs();
  let db;
  try {
    db = new SQL.Database(data);
  } catch {
    throw new Error('Failed to open .starc file as SQLite database. The file may be corrupted.');
  }

  try {
    // ── SECURITY: Verify expected tables exist using parameterized query ──
    const tableCheck = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'");
    if (!tableCheck.length || !tableCheck[0].values.length) {
      throw new Error('Not a valid .starc file: missing documents table.');
    }

    // ── Get project version ──
    let projectVersion = 'unknown';
    const versionStmt = db.prepare("SELECT value FROM system_variables WHERE variable = ?");
    versionStmt.bind(['application-version']);
    if (versionStmt.step()) {
      const row = versionStmt.get();
      if (row[0] && typeof row[0] === 'string') {
        projectVersion = sanitizeText(row[0], 200);
      }
    }
    versionStmt.free();

    // ── Extract characters and locations from metadata ──
    const characters: string[] = [];
    const locations: string[] = [];

    const charStmt = db.prepare("SELECT content FROM documents WHERE type = ? AND content IS NOT NULL");
    // Character types: 20101, 20102
    for (const charType of [20101, 20102]) {
      charStmt.bind([charType]);
      while (charStmt.step()) {
        const row = charStmt.get();
        const blob = row[0] instanceof Uint8Array ? row[0] : null;
        const text = decodeBlob(blob);
        if (text) {
          // Try to extract name from XML content
          const nameMatch = text.match(/<name>([\s\S]*?)<\/name>/i);
          if (nameMatch) {
            const name = sanitizeText(nameMatch[1], 200);
            if (name && !characters.includes(name)) {
              characters.push(name);
            }
          }
        }
      }
      charStmt.reset();
    }
    charStmt.free();

    // Location types: 20201, 20202
    const locStmt = db.prepare("SELECT content FROM documents WHERE type = ? AND content IS NOT NULL");
    for (const locType of [20201, 20202]) {
      locStmt.bind([locType]);
      while (locStmt.step()) {
        const row = locStmt.get();
        const blob = row[0] instanceof Uint8Array ? row[0] : null;
        const text = decodeBlob(blob);
        if (text) {
          const nameMatch = text.match(/<name>([\s\S]*?)<\/name>/i);
          if (nameMatch) {
            const name = sanitizeText(nameMatch[1], 200);
            if (name && !locations.includes(name)) {
              locations.push(name);
            }
          }
        }
      }
      locStmt.reset();
    }
    locStmt.free();

    // ── Find and parse script documents ──
    let allElements: Partial<ScriptElement>[] = [];
    let titlePage: TitlePageData = {};
    let scriptDocumentType: number | null = null;

    // Query all documents, ordered by type (scripts first)
    const docStmt = db.prepare(
      "SELECT type, content FROM documents WHERE content IS NOT NULL AND type > 0 ORDER BY type ASC"
    );

    let docCount = 0;

    while (docStmt.step()) {
      docCount++;
      const row = docStmt.get();
      const docType = validateDocType(row[0]);
      if (docType === null) continue;
      if (!SCRIPT_DOCUMENT_TYPES.has(docType)) continue;

      const blob = row[1] instanceof Uint8Array ? row[1] : null;
      const content = decodeBlob(blob);
      if (!content || content.length < 10) continue;

      // Parse this document's content
      const elements = parseStarcContent(content);

      if (elements.length > 0) {
        // If this is the first script document, extract title page info
        if (!scriptDocumentType) {
          scriptDocumentType = docType;

          // Try to extract title page from content
          const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/i);
          if (titleMatch) {
            titlePage.title = sanitizeText(titleMatch[1], 500);
          }
          const authorMatch = content.match(/<author>([\s\S]*?)<\/author>/i);
          if (authorMatch) {
            titlePage.author = sanitizeText(authorMatch[1], 500);
          }
          const creditMatch = content.match(/<credit>([\s\S]*?)<\/credit>/i);
          if (creditMatch) {
            titlePage.credit = sanitizeText(creditMatch[1], 500);
          }
        }

        allElements = allElements.concat(elements);
      }
    }
    docStmt.free();

    // Fallback title from filename
    if (!titlePage.title) {
      titlePage.title = file.name.replace(/\.starc$/i, '').replace(/[_-]+/g, ' ').trim();
    }

    return {
      title: titlePage.title || file.name.replace(/\.starc$/i, ''),
      projectVersion,
      elements: allElements,
      titlePage,
      characters,
      locations,
      metadata: {
        documentCount: docCount,
        scriptDocumentType,
      },
    };
  } finally {
    // Always close the database to free WASM memory
    db.close();
  }
}
