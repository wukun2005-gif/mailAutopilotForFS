#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   Serve the slide deck locally — `npm run deck`.

   Why this exists: the deck has to be opened over http, not `file://`.
   comments.js is an ES module, and browsers block module scripts loaded from
   file:// (CORS, origin "null"), so the comment panel silently never appears
   while the deck itself looks completely normal. That is a confusing enough
   failure to be worth a one-command fix.

   Zero dependencies: node:http + node:fs. Picks the first free port from
   8765, serves deck-html/, and opens the browser.

   Usage:
     npm run deck                  → deck-html/ on the first free port
     node scripts/serve-deck.mjs <dir> [port]
   ══════════════════════════════════════════════════════════════════════════ */

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';

const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ROOT = resolve(positional[0] || 'deck-html');
const FIRST_PORT = Number(positional[1] || process.env.PORT || 8765);
const OPEN = !process.argv.includes('--no-open');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = resolve(join(ROOT, urlPath));

  // never serve anything outside the deck directory
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 — not found: ' + urlPath + '\n\nAre you serving the right directory? Expected the deck at ' + ROOT);
    return;
  }

  let stat;
  try {
    stat = statSync(file);
  } catch {
    res.writeHead(404).end('404');
    return;
  }

  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    // no-store: editing comments.js and hitting reload should show the change
    'Cache-Control': 'no-store',
  };

  // range support so the demo clips can be scrubbed
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Number(m[2]) : stat.size - 1;
      if (start >= stat.size || end >= stat.size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
        return;
      }
      res.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': end - start + 1,
      });
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
});

function listen(port, attemptsLeft) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
    } else {
      console.error('could not start the server:', err.message);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/index.html`;
    console.log(`\n  deck served from ${ROOT}`);
    console.log(`  → ${url}\n`);
    console.log('  the comment panel needs this http:// address — opening the file');
    console.log('  directly (file://) makes it silently not appear.\n');
    console.log('  Ctrl-C to stop.\n');
    if (OPEN) {
      const cmd = process.platform === 'darwin' ? 'open'
        : process.platform === 'win32' ? 'start' : 'xdg-open';
      try {
        spawn(cmd, [url], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' })
          .unref();
      } catch { /* opening the browser is a convenience, not a requirement */ }
    }
  });
}

listen(FIRST_PORT, 10);
