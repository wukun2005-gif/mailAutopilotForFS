#!/usr/bin/env node
/**
 * Screenshot a deck page with its comments panel open — the visual counterpart
 * to probe-local-comments.mjs, for when "does it render" needs an answer you can
 * look at rather than read.
 *
 * Read-only: it never posts a comment. Works against the local dev server or the
 * published GitHub Pages URL.
 *
 * Usage:  node scripts/shot-deck-page.mjs [url] [slideIndex] [out.png] [--closed]
 *         (--closed photographs the page without opening the panel)
 */

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const url = args[0] && args[0].startsWith('http') ? args[0] : 'http://127.0.0.1:8765/';
const idx = Number(args.find((a) => /^\d+$/.test(a)) ?? 1);
const out = args.find((a) => a.endsWith('.png')) || `_shots/deck-p${idx + 1}-comments.png`;
const keepClosed = args.includes('--closed');

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('  !! page error:', e.message));

/* wait for the fetch itself: the panel renders a beat after it lands, and a
   fixed sleep reads an empty list that looks like a bug */
const fetched = page
  .waitForResponse((r) => /rest\/v1\/deck_comments_public/.test(r.url()), { timeout: 20_000 })
  .catch(() => null);
await page.goto(url, { waitUntil: 'load' });
await fetched;
await page.waitForTimeout(1200);

/* the legal notice is an overlay covering the list on a first visit */
const dismiss = () => page.evaluate(() => {
  const ok = document.getElementById('cmtdiscok');
  const m = document.getElementById('cmtdiscmodal');
  if (ok && m && getComputedStyle(m).display !== 'none') { ok.click(); return true; }
  return false;
});
await dismiss();
await page.waitForTimeout(300);

await page.evaluate((i) => window.show(i), idx);
await page.waitForTimeout(800);

if (!keepClosed) {
  await page.evaluate(() => {
    if (!document.body.classList.contains('cmt-open')) document.getElementById('cmtbtn').click();
  });
  await page.waitForTimeout(600);
  await dismiss();
  await page.waitForTimeout(500);
}

const info = await page.evaluate(() => ({
  page: document.querySelector('#cmtpanel .sub')?.textContent?.trim() || '',
  badge: document.querySelector('#cmtbtn .cnt')?.textContent?.trim() || '0',
  rows: document.querySelectorAll('#cmtlist .cmt').length,
  open: document.body.classList.contains('cmt-open'),
}));
await page.screenshot({ path: out });
console.log(`${out}`);
console.log(`  ${info.page} · 面板${info.open ? '已开' : '未开'} · 徽章 ${info.badge} · 渲染 ${info.rows} 条`);
await browser.close();
