import { fork, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import { app } from 'electron';
import { getPreference, setPreference } from './preferences';

/**
 * The bundled Next.js server the app windows load.
 *
 * The port is stable across launches on purpose. Browser storage is keyed by
 * origin, and the origin includes the port: a server on a new random port each
 * launch meant IndexedDB and localStorage — where local-mode projects keep their
 * characters, ideas, shots and the rest — started empty every time the app
 * opened. The first launch picks a port and every later launch reuses it.
 */

const DEFAULT_PORT = 47820;
const PORT_PREF = 'server-port';
const READY_TIMEOUT_MS = 60_000;
const LOG_LIMIT_BYTES = 2 * 1024 * 1024;

let serverProcess: ChildProcess | null = null;
let serverUrlPromise: Promise<string> | null = null;
let stopping = false;

/** Emits `exit` when a running server dies unexpectedly. */
export const serverEvents = new EventEmitter();

function getServerDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'next-server');
  }
  return path.join(__dirname, '..', '..', '.next', 'standalone');
}

export function getLogPath(): string {
  return path.join(app.getPath('logs'), 'server.log');
}

function openLog(): fs.WriteStream | null {
  try {
    const logPath = getLogPath();
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    // Keep the log bounded: start over once it grows past the limit.
    let flags = 'a';
    try { if (fs.statSync(logPath).size > LOG_LIMIT_BYTES) flags = 'w'; } catch { /* new file */ }
    const stream = fs.createWriteStream(logPath, { flags });
    stream.write(`\n── ${new Date().toISOString()} · Screenplay Studio ${app.getVersion()} ──\n`);
    return stream;
  } catch {
    return null;
  }
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
  });
}

function randomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function choosePort(): Promise<number> {
  const stored = Number(getPreference(PORT_PREF));
  const preferred = Number.isInteger(stored) && stored > 1024 && stored < 65536 ? stored : DEFAULT_PORT;
  if (await isPortFree(preferred)) {
    if (preferred !== stored) setPreference(PORT_PREF, preferred);
    return preferred;
  }
  // Something else holds the usual port. Use another one for this launch, but
  // keep the preference so the next launch goes back to the usual origin.
  for (let offset = 1; offset <= 4; offset++) {
    if (await isPortFree(preferred + offset)) return preferred + offset;
  }
  return randomPort();
}

/** Resolves once the server answers any HTTP request. */
function waitForHttp(port: number, isDead: () => boolean): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (isDead()) { reject(new Error('The local server exited while starting.')); return; }
      const req = http.get({ host: '127.0.0.1', port, path: '/manifest.json', timeout: 2_000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); });
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`The local server did not respond within ${READY_TIMEOUT_MS / 1000} seconds.`));
        return;
      }
      setTimeout(attempt, 150);
    };
    attempt();
  });
}

async function start(): Promise<string> {
  const port = await choosePort();
  const serverDir = getServerDir();
  const serverPath = path.join(serverDir, 'server.js');

  if (!fs.existsSync(serverPath)) {
    throw new Error(`The app's server files are missing (${serverPath}). Reinstalling should fix this.`);
  }

  const log = openLog();
  let dead = false;

  const child = fork(serverPath, {
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
    },
    cwd: serverDir,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  serverProcess = child;

  child.stdout?.on('data', (data: Buffer) => log?.write(data));
  child.stderr?.on('data', (data: Buffer) => {
    log?.write(data);
    console.error('[next-server]', data.toString().trimEnd());
  });

  let ready = false;
  child.on('exit', (code, signal) => {
    dead = true;
    log?.write(`\n[server exited: code=${code} signal=${signal}]\n`);
    log?.end();
    if (serverProcess === child) serverProcess = null;
    serverUrlPromise = null;
    if (ready && !stopping) serverEvents.emit('exit', code);
  });

  try {
    await waitForHttp(port, () => dead);
  } catch (err) {
    if (!dead) child.kill();
    throw err;
  }
  ready = true;
  return `http://127.0.0.1:${port}`;
}

/**
 * Starts the server once and shares it between every window. Calling it again
 * after a failure or a crash starts a fresh one.
 */
export function ensureLocalServer(): Promise<string> {
  if (!serverUrlPromise) {
    stopping = false;
    serverUrlPromise = start().catch((err) => {
      serverUrlPromise = null;
      throw err;
    });
  }
  return serverUrlPromise;
}

export function stopLocalServer() {
  stopping = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  serverUrlPromise = null;
}
