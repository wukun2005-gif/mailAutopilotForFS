#!/usr/bin/env node
/**
 * Why does the panel render nothing when the database has rows?
 *
 * Opens the running dev deck with console + network capture, waits for the
 * panel to settle, then reports what the page asked the backend and what came
 * back. Read-only: it never posts.
 *
 * Usage:  node scripts/probe-local-comments-debug.mjs [url]
 */

import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8765/';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const console_ = [];
const requests = [];
page.on('console', (m) => console_.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => console_.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => requests.push(`FAILED ${r.method()} ${r.url()} — ${r.failure()?.errorText}`));
page.on('response', async (r) => {
  const u = r.url();
  if (!/rest\/v1|functions\/v1|realtime/.test(u)) return;
  let body = '';
  if (/rest\/v1/.test(u)) { try { body = (await r.text()).slice(0, 300); } catch {} }
  requests.push(`${r.status()} ${r.request().method()} ${u.replace(/https:\/\/[^/]+/, '')} ${body}`);
});

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

console.log('── console ──');
console.log(console_.length ? console_.slice(0, 25).join('\n') : '(nothing logged)');

console.log('\n── backend traffic ──');
console.log(requests.length ? requests.slice(0, 20).join('\n') : '(none)');

console.log('\n── what the page has ──');
console.log(JSON.stringify(await page.evaluate(() => ({
  localStorageKeys: Object.keys(localStorage),
  lsComments: (() => { try { return JSON.parse(localStorage.getItem('deck:comments') || 'null'); } catch { return 'unparsable'; } })(),
  cmtbtn: (document.getElementById('cmtbtn') || {}).textContent,
})), null, 1));

await browser.close();
