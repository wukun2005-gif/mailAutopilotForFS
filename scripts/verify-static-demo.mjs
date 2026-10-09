#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   Verify the *production* build behaves like the dev server.

   Why this exists: the app's whole backend is MSW (Mock Service Worker), and
   main.tsx used to start it only under `import.meta.env.DEV`. A production
   build therefore shipped with a dead backend — every /mock/* call the runtime
   makes would hit a real 404. The build "succeeds" silently, so the only way
   to know the hosted demo actually runs is to serve dist/ and drive it.

   Checks:
     1. the app mounts at all
     2. the MSW service worker is registered AND controlling the page
     3. /mock/* tool calls are intercepted (200 from MSW, not 404 from disk)
     4. a scripted demo run plays to completion
     5. no console errors other than expected static-host noise

   Usage:
     node scripts/verify-static-demo.mjs                       # serve dist/ locally
     node scripts/verify-static-demo.mjs [port]                # local, on a chosen port
     node scripts/verify-static-demo.mjs https://app.vercel.app  # verify a live deploy
   ══════════════════════════════════════════════════════════════════════════ */

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DIST = resolve(ROOT, 'dist');
const SHOTS = resolve(ROOT, '_shots');

// Either serve dist/ locally (default — good for pre-deploy sanity checks),
// or point at an existing URL to verify a live deploy.
const REMOTE = process.argv[2] && /^https?:\/\//.test(process.argv[2]) ? process.argv[2].replace(/\/$/, '') : null;
const PORT = Number(process.argv[2] || 8790);
const BASE = REMOTE || `http://127.0.0.1:${PORT}`;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/* ── 1. serve dist/ over http when verifying locally (file:// would break
      the service worker). When REMOTE is set, assume the deploy is already
      live and skip the local server. */
let server = null;
let serverLog = '';
const stop = () => { if (server) try { server.kill('SIGKILL'); } catch { /* already gone */ } };
process.on('exit', stop);

async function waitForServer(timeoutMs = 15_000) {
  if (REMOTE) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if ((await fetch(`${BASE}/index.html`)).ok) return true; } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  }
  server = spawn(process.execPath, [resolve(HERE, 'serve-deck.mjs'), DIST, String(PORT), '--no-open'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if ((await fetch(`${BASE}/index.html`)).ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

let browser;
try {
  mkdirSync(SHOTS, { recursive: true });

  const up = await waitForServer();
  if (!up) throw new Error(`target never responded on ${BASE}\n${serverLog}`);
  console.log(`\nverifying ${REMOTE ? `remote deploy ${BASE}` : `${DIST} on ${BASE}`}\n`);

  /* ── 2. drive it with the real browser ────────────────────────────────── */
  // This mac has no downloaded headless shell; use the installed Chrome.
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  const mockResponses = [];
  const failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/mock/')) mockResponses.push({ url: u.replace(BASE, ''), status: r.status() });
  });
  page.on('requestfailed', (r) => failedRequests.push(`${r.url().replace(BASE, '')} ${r.failure()?.errorText ?? ''}`));

  console.log('checks:');
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });

  // 1. app mounts
  let mounted = true;
  try {
    await page.waitForSelector("[data-id='top.demo']", { timeout: 30_000 });
  } catch {
    mounted = false;
  }
  check('app mounts (top bar rendered)', mounted);
  if (!mounted) {
    await page.screenshot({ path: resolve(SHOTS, 'static-demo-mount-failure.png') });
    throw new Error('app did not mount; screenshot at _shots/static-demo-mount-failure.png');
  }

  // 2. MSW service worker controlling the page
  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false };
    const reg = await navigator.serviceWorker.getRegistration();
    // The controller can lag a beat behind registration on first load.
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return {
      supported: true,
      registered: !!reg,
      scope: reg?.scope ?? null,
      controlling: !!navigator.serviceWorker.controller,
      scriptURL: navigator.serviceWorker.controller?.scriptURL ?? null,
    };
  });
  check('service worker registered', sw.supported && sw.registered, sw.scope ?? 'not registered');
  check('service worker controlling page', !!sw.controlling, sw.scriptURL ?? '');

  // 3. a real endpoint is intercepted by MSW, not 404'd by static hosting
  const probe = await page.evaluate(async () => {
    try {
      const res = await fetch('/mock/accounts?customerId=CUS-100231');
      return { status: res.status, ok: res.ok };
    } catch (e) {
      return { status: 0, ok: false, error: String(e) };
    }
  });
  check('mock backend reachable (no 404 from disk)', probe.ok,
    `GET /mock/accounts → ${probe.status}${probe.error ? ` (${probe.error})` : ''}`);

  // 4. run a scripted demo to completion
  await page.click("[data-id='top.demo']");
  await page.waitForSelector("[data-id='demo.script.email1']", { timeout: 15_000 });
  await page.click("[data-id='demo.script.email1']");
  await page.waitForSelector("[data-id='demo.bar']", { timeout: 15_000 });
  // two clicks → 4x
  await page.click("[data-id='demo.speed']");
  await page.click("[data-id='demo.speed']");

  // Poll by hand rather than waitForFunction: the demo swaps screens via the
  // location hash, and each swap briefly destroys the JS execution context,
  // which makes waitForFunction throw mid-run (the e2e suite guards this too).
  let done = false;
  let beat = null;
  for (let i = 0; i < 150 && !done; i++) {
    try {
      const s = await page.evaluate(() => {
        const bar = document.querySelector("[data-id='demo.bar']");
        return { status: bar?.getAttribute('data-status') ?? null, beat: bar?.getAttribute('data-beat') ?? null };
      });
      beat = s.beat ?? beat;
      if (s.status === 'done') done = true;
      else await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      if (!/Execution context was destroyed|navigation/i.test(String(err))) throw err;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  check('scripted demo plays to completion', done, `beat=${beat ?? 'n/a'}`);

  const blocker = await page.locator("[data-id='demo.blocker']").count();
  check('no required-click blocker', blocker === 0, `${blocker} blocker(s)`);

  await page.screenshot({ path: resolve(SHOTS, 'static-demo-final.png') });

  // 5. console noise
  const NOISE = /Failed to load resource|favicon|net::ERR|msw/i;
  const hard = consoleErrors.filter((e) => !NOISE.test(e));
  check('no unexpected console errors', hard.length === 0,
    hard.length ? hard.slice(0, 5).join(' | ') : `${consoleErrors.length} filtered`);

  if (failedRequests.length) {
    console.log('\n  failed requests (informational):');
    for (const f of failedRequests.slice(0, 10)) console.log(`    · ${f}`);
  }
  if (mockResponses.length) {
    console.log(`\n  mock endpoints hit (${mockResponses.length}), sample:`);
    for (const m of mockResponses.slice(0, 8)) console.log(`    · ${m.status} ${m.url}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILED: ' + failed.map((f) => f.name).join(', '));
    process.exitCode = 1;
  }
} catch (err) {
  console.error('\nverification threw:', err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  stop();
}
