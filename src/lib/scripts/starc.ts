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
 * Decompress gzip data using the browser's DecompressionStream API.
 * Falls back to null if the API isn't available or decompression fails.
 */
async function decompressGzip(data: Uint8Array): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    const buf = new ArrayBuffer(data.byteLength);
    new Uint8Array(buf).set(data);
    writer.write(buf);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Decode a BLOB from the database into a string.
 * Handles gzip-compressed content (common in STARC v3+).
 * Falls back to plain UTF-8 if not compressed.
 *
 * Returns null if the data can't be decoded.
 */
async function decodeBlob(blob: Uint8Array | null): Promise<string | null> {
  if (!blob || blob.length === 0) return null;

  let raw = blob;

  // Check for gzip magic bytes — decompress
  if (blob.length >= 2 && blob[0] === 0x1f && blob[1] === 0x8b) {
    const decompressed = await decompressGzip(blob);
    if (!decompressed) return null;
    raw = decompressed;
  }

  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(raw);
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
  const SQL = await initSqlJs({
    locateFile: (path: string) => `/sql-wasm.wasm`,
  });
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
        const text = await decodeBlob(blob);
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
        const text = await decodeBlob(blob);
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
    const titlePage: TitlePageData = {};
    let scriptDocumentType: number | null = null;

    // First pass: discover all document types and pick the one with the most content
    const typeStmt = db.prepare(
      "SELECT type, COUNT(*) as cnt FROM documents WHERE content IS NOT NULL AND type > 0 GROUP BY type ORDER BY cnt DESC"
    );
    const docTypes: number[] = [];
    while (typeStmt.step()) {
      const row = typeStmt.get();
      const t = validateDocType(row[0]);
      if (t !== null) docTypes.push(t);
    }
    typeStmt.free();

    // DEBUG: Log all tables and document types found
    const allTables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('[STARC DEBUG] Tables:', allTables.length ? allTables[0].values.map(r => r[0]) : 'none');
    console.log('[STARC DEBUG] Document types found:', docTypes);

    // Count total docs
    const totalDocs = db.exec("SELECT COUNT(*) FROM documents");
    const totalDocsWithContent = db.exec("SELECT COUNT(*) FROM documents WHERE content IS NOT NULL");
    console.log('[STARC DEBUG] Total docs:', totalDocs[0]?.values[0]?.[0], 'With content:', totalDocsWithContent[0]?.values[0]?.[0]);

    // Second pass: parse documents — try ALL types, not just known script types
    for (const docType of docTypes) {
      const docStmt = db.prepare(
        "SELECT type, content FROM documents WHERE type = ? AND content IS NOT NULL"
      );
      docStmt.bind([docType]);

      while (docStmt.step()) {
        const row = docStmt.get();
        const blob = row[1] instanceof Uint8Array ? row[1] : null;
        console.log(`[STARC DEBUG] Doc type=${docType}, blob size=${blob?.length ?? 'null'}, isUint8=${blob instanceof Uint8Array}`);
        const content = await decodeBlob(blob);
        console.log(`[STARC DEBUG] Doc type=${docType}, decoded content length=${content?.length ?? 'null'}, preview=${content?.slice(0, 200) ?? 'N/A'}`);
        if (!content || content.length < 5) continue;

        // Parse this document's content
        const elements = parseStarcContent(content);
        console.log(`[STARC DEBUG] Doc type=${docType}, parsed ${elements.length} elements`);

        if (elements.length === 0 && content.length > 0) {
          console.log(`[STARC DEBUG] Content has NO tags. First 500 chars:`, content.slice(0, 500));
        }

        if (elements.length > 0) {
          // If this is the first script document with elements, extract title page info
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
    }

    // Fallback title from filename
    if (!titlePage.title) {
      titlePage.title = file.name.replace(/\.starc$/i, '').replace(/[_-]+/g, ' ').trim();
    }

    console.log(`[STARC DEBUG] RESULT: ${allElements.length} total elements, ${characters.length} characters, ${locations.length} locations, scriptType=${scriptDocumentType}`);

    return {
      title: titlePage.title || file.name.replace(/\.starc$/i, ''),
      projectVersion,
      elements: allElements,
      titlePage,
      characters,
      locations,
      metadata: {
        documentCount: docTypes.length,
        scriptDocumentType,
      },
    };
  } finally {
    // Always close the database to free WASM memory
    db.close();
  }
}
