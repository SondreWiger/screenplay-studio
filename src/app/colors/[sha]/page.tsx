import type { Metadata } from 'next';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { ColorThemeClient } from './client';

const THEMES_DIR = path.join(process.cwd(), 'data', 'themes');

async function getTheme(sha: string) {
  try {
    const filePath = path.join(THEMES_DIR, `${sha}.json`);
    if (!existsSync(filePath)) return null;
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ sha: string }> }
): Promise<Metadata> {
  const { sha } = await params;
  const theme = await getTheme(sha);
  if (!theme) {
    return { title: 'Theme not found' };
  }

  const c = theme.colors;
  const title = `${theme.name || 'Custom Theme'} — Screenplay Studio`;
  const description = `Custom color theme for Screenplay Studio. ${Object.values(c).slice(0, 3).join(', ')}`;

  // SVG stripe image for Discord embed
  const stripeColors = [c.bgBase, c.bgSurface, c.bgElevated, c.brand, c.scriptBg, c.textPrimary, c.scriptText, c.border];
  const stripeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160" viewBox="0 0 600 160">
    ${stripeColors.map((col, i) => `<rect x="0" y="${i * 20}" width="600" height="20" fill="${col}"/>`).join('')}
  </svg>`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{
        url: `data:image/svg+xml,${encodeURIComponent(stripeSvg)}`,
        width: 600,
        height: 160,
        alt: `${theme.name || 'Custom Theme'} color palette`,
      }],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [`data:image/svg+xml,${encodeURIComponent(stripeSvg)}`],
    },
  };
}

export default async function ColorThemePage(
  { params }: { params: Promise<{ sha: string }> }
) {
  const { sha } = await params;
  const theme = await getTheme(sha);

  // Also check URL search params for inline theme data
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-8">
      <ColorThemeClient sha={sha} serverTheme={theme} />
    </div>
  );
}
