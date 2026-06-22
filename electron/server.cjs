const http = require('http');
const { parse } = require('url');
const path = require('path');
const next = require('next');

const dev = false;
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3456', 10);

// In packaged app, __dirname is inside app.asar. Next.js needs a real directory.
// Use app.asar.unpacked if available, otherwise fall back to __dirname.
const fs = require('fs');
let appDir = __dirname;

// Check if we're inside an ASAR
if (__dirname.includes('app.asar')) {
  const unpackedDir = __dirname.replace('app.asar', 'app.asar.unpacked');
  if (fs.existsSync(unpackedDir)) {
    appDir = unpackedDir;
  }
}

console.log(`[server] appDir: ${appDir}`);
console.log(`[server] starting Next.js on ${hostname}:${port}`);

const app = next({ dev, hostname, port, dir: appDir });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  console.log('[server] Next.js ready');

  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[server] Error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  })
    .once('error', (err) => {
      console.error('[server] Fatal:', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`[server] Ready on http://${hostname}:${port}`);
    });
});
