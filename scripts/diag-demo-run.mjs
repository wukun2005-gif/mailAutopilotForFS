#!/usr/bin/env node
/* Diagnostic: poll a demo run's status/beat so we can see whether it is
   progressing or stuck, and capture the last tooltip + any failure. */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DIST = resolve(ROOT, 'dist');
const PORT = Number(process.argv[2] || 8791);
const SCRIPT = process.argv[3] || 'email1';
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn(process.execPath, [resolve(HERE, 'serve-deck.mjs'), DIST, String(PORT), '--no-open'],
  { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
const stop = () => { try { server.kill('SIGKILL'); } catch {} };
process.on('exit', stop);

const wait = async (ms) => new Promise((r) => setTimeout(r, ms));

let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${BASE}/index.html`)).ok) break; } catch {}
    await wait(150);
  }

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector("[data-id='top.demo']");
  await page.click("[data-id='top.demo']");
  await page.waitForSelector(`[data-id='demo.script.${SCRIPT}']`);
  await page.click(`[data-id='demo.script.${SCRIPT}']`);
  await page.waitForSelector("[data-id='demo.bar']");
  await page.click("[data-id='demo.speed']");
  await page.click("[data-id='demo.speed']");

  let last = null;
  let stuckFor = 0;
  for (let t = 0; t < 120; t++) {
    const s = await page.evaluate(() => {
      const bar = document.querySelector("[data-id='demo.bar']");
      return {
        status: bar?.getAttribute('data-status') ?? null,
        beat: bar?.getAttribute('data-beat') ?? null,
        total: bar?.getAttribute('data-total') ?? bar?.textContent?.slice(0, 120) ?? null,
        tip: document.querySelector("[data-id='demo.tooltip']")?.textContent?.slice(0, 90) ?? null,
        blocker: document.querySelector("[data-id='demo.blocker']")?.textContent?.slice(0, 120) ?? null,
      };
    }).catch(() => null);
    if (!s) break;
    const key = `${s.status}/${s.beat}`;
    if (key === last) stuckFor++; else stuckFor = 0;
    last = key;
    console.log(`t=${String(t * 2).padStart(3)}s status=${s.status} beat=${s.beat}${s.blocker ? ` BLOCKER="${s.blocker}"` : ''} ${s.tip ? `tip="${s.tip}"` : ''}`);
    if (s.status === 'done') { console.log('\nDONE'); break; }
    if (stuckFor >= 15) { console.log('\nSTUCK at ' + key); break; }
    await wait(2000);
  }

  console.log('\nconsole errors:');
  console.log(errors.length ? errors.slice(0, 15).map((e) => '  · ' + e).join('\n') : '  (none)');
} catch (e) {
  console.error('diag threw:', e.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  stop();
}
