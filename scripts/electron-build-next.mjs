#!/usr/bin/env node
/**
 * Builds the Next.js app for the desktop shell and assembles the standalone
 * server electron-builder packages.
 *
 * `next build` with `output: 'standalone'` leaves out `public/` and the static
 * assets, so they're copied in afterwards. Plain Node, so it runs the same on
 * macOS, Windows and Linux (the old npm script needed rsync and a POSIX shell).
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');

const build = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, ELECTRON_BUILD: 'true' },
});
if (build.status !== 0) process.exit(build.status ?? 1);

if (!existsSync(path.join(standalone, 'server.js'))) {
  console.error('next build did not produce .next/standalone/server.js — is output: "standalone" set for ELECTRON_BUILD?');
  process.exit(1);
}

// public/ — minus the downloads folder, which holds the installers themselves.
const publicOut = path.join(standalone, 'public');
rmSync(publicOut, { recursive: true, force: true });
cpSync(path.join(root, 'public'), publicOut, {
  recursive: true,
  filter: (src) => path.relative(path.join(root, 'public'), src).split(path.sep)[0] !== 'downloads',
});

// .next/static — the hashed JS and CSS the pages load.
const staticOut = path.join(standalone, '.next', 'static');
mkdirSync(staticOut, { recursive: true });
cpSync(path.join(root, '.next', 'static'), staticOut, { recursive: true });

console.log('Standalone server ready in .next/standalone');
