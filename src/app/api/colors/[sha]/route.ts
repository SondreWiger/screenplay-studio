import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const THEMES_DIR = path.join(process.cwd(), 'data', 'themes');

async function ensureDir() {
  if (!existsSync(THEMES_DIR)) {
    await mkdir(THEMES_DIR, { recursive: true });
  }
}

// GET /api/colors/[sha] — fetch theme data
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sha: string }> }
) {
  const { sha } = await params;
  try {
    const filePath = path.join(THEMES_DIR, `${sha}.json`);
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
    }
    const data = await readFile(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json({ error: 'Failed to read theme' }, { status: 500 });
  }
}

// POST /api/colors/[sha] — save theme data
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sha: string }> }
) {
  const { sha } = await params;
  try {
    await ensureDir();
    const body = await req.json();
    const filePath = path.join(THEMES_DIR, `${sha}.json`);
    await writeFile(filePath, JSON.stringify(body), 'utf-8');
    return NextResponse.json({ ok: true, sha });
  } catch {
    return NextResponse.json({ error: 'Failed to save theme' }, { status: 500 });
  }
}
