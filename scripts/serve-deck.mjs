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

   ── local tests must not touch the live deck ──────────────────────────────
   The page does not carry its comments: comments.config.js names an absolute
   Supabase project and a hard-coded deckId, and the browser fetches that deck
   at load. So whatever deck the config names is the deck you are editing when
   you post a comment — and for the published page that is the live one.

   This server therefore rewrites deckId on the way out. The file on disk is
   never modified, so nothing here can reach GitHub Pages; the checkbox is
   purely "which deck does this local page talk to".
     · default            → mail-autopilot-fs-local   (safe place to make a mess)
     · --deck <id>        → any deck you name
     · --live             → mail-autopilot-fs         (the published one; opt in)
   The banner says which one you got, loudly when it is the live deck.

   Usage:
     npm run deck                       → deck-html/ on the first free port
     node scripts/serve-deck.mjs <dir> [port] [--deck <id> | --live]
   ══════════════════════════════════════════════════════════════════════════ */

import { createServer } from 'node:http';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';

const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ROOT = resolve(positional[0] || 'deck-html');
const FIRST_PORT = Number(positional[1] || process.env.PORT || 8765);
const OPEN = !process.argv.includes('--no-open');

/* the deck the published page reads — the one local work must not disturb */
const LIVE_DECK = 'mail-autopilot-fs';
const LOCAL_DECK = 'mail-autopilot-fs-local';
const deckArgIx = process.argv.indexOf('--deck');
const SERVING_LIVE = process.argv.includes('--live');
const DECK = SERVING_LIVE ? LIVE_DECK
  : deckArgIx > -1 ? process.argv[deckArgIx + 1]
    : process.env.DECK_ID || LOCAL_DECK;
const CONFIG_FILE = 'comments.config.js';


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

  /* Hand the page a config naming the deck this server was told to use. The
     file on disk is left exactly as it is, so nothing here can end up in a
     commit or on GitHub Pages — the only thing this changes is which deck the
     local browser talks to. */
  if (basename(file) === CONFIG_FILE) {
    let src;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`cannot read ${CONFIG_FILE}`);
      return;
    }
    const body = Buffer.from(src.replace(/(\bdeckId\s*:\s*)['"][^'"]*['"]/, `$1'${DECK}'`), 'utf8');
    res.writeHead(200, { ...headers, 'Content-Type': MIME['.js'], 'Content-Length': body.length, 'X-Deck-Override': DECK });
    if (req.method === 'HEAD') { res.end(); return; }
    res.end(body);
    return;
  }

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
    if (SERVING_LIVE) {
      console.log('  ╔══════════════════════════════════════════════════════════════╗');
      console.log('  ║  !! THIS PAGE IS TALKING TO THE LIVE DECK                    ║');
      console.log(`  ║  deckId = ${LIVE_DECK.padEnd(52)}║`);
      console.log('  ║  Comments you post here appear on the published deck at once. ║');
      console.log('  ║  Use the default (no --live) for anything experimental.       ║');
      console.log('  ╚══════════════════════════════════════════════════════════════╝\n');
    } else {
      console.log(`  comment deck: ${DECK}`);
      console.log('  (a local test deck — writes here never reach the published page;');
      console.log('   pass --live to deliberately serve the live deck instead)\n');
    }
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
