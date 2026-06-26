import { fork, type ChildProcess } from 'child_process';
import * as net from 'net';
import * as path from 'path';
import { app } from 'electron';

let serverProcess: ChildProcess | null = null;

function getServerDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'next-server');
  }
  return path.join(__dirname, '..', '.next', 'standalone');
}

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export async function startLocalServer(): Promise<string> {
  const port = await findAvailablePort();
  const serverDir = getServerDir();

  return new Promise((resolve, reject) => {
    const serverPath = path.join(serverDir, 'server.js');
    const child = fork(serverPath, {
      env: {
        ...process.env,
        PORT: String(port),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
      },
      cwd: serverDir,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      silent: true,
    });

    serverProcess = child;

    let resolved = false;
    // Reduced timeout from 15s to 5s for faster feedback
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill();
        reject(new Error('Local server start timeout'));
      }
    }, 5_000);

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      // More aggressive detection patterns for faster startup recognition
      if (!resolved && (
        text.includes('Ready') || 
        text.includes('started') || 
        text.includes('listening') ||
        text.includes('localhost') ||
        text.includes('127.0.0.1') ||
        text.includes('Server running')
      )) {
        resolved = true;
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${port}`);
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      console.error('[next-server]', text);
      // Also check stderr for startup messages (some frameworks log there)
      if (!resolved && (
        text.includes('Ready') || 
        text.includes('started') || 
        text.includes('listening')
      )) {
        resolved = true;
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${port}`);
      }
    });

    child.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    child.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

export function stopLocalServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}
