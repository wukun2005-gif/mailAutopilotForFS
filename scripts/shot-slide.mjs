#!/usr/bin/env node
/**
 * Screenshot one deck page, bare (no comment panel, no narration bar), cropped
 * to the 1280x720 slide box — for eyeballing a layout change.
 *
 * Usage: node scripts/shot-slide.mjs <slideIndex> <out.png> [--light|--dark] [--url=...]
 *        slideIndex is 0-based, same as window.show(i).
 */

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const idx = Number(args.find((a) => /^\d+$/.test(a)) ?? 0);
const out = args.find((a) => a.endsWith('.png')) || `_shots/slide-${idx}.png`;
const theme = args.includes('--dark') ? 'dark' : 'light';
const url = (args.find((a) => a.startsWith('--url=')) || '--url=http://127.0.0.1:8765/index.html').slice(6);

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
page.on('pageerror', (e) => console.log('  !! page error:', e.message));

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(900);

// dismiss the comment legal notice, then force the theme we asked for
await page.evaluate((want) => {
  const ok = document.getElementById('cmtdiscok');
  const m = document.getElementById('cmtdiscmodal');
  if (ok && m && getComputedStyle(m).display !== 'none') ok.click();
  if (typeof setTheme === 'function') setTheme(want);
  else document.body.classList.toggle('light', want === 'light');
}, theme);
await page.waitForTimeout(200);

await page.evaluate((n) => window.show(n), idx);
await page.waitForTimeout(1200);

// NB: #toc holds a live .slide.on clone of the current page — scope to #stage,
// or the screenshot comes back as a 166px thumbnail of the wrong slide.
const el = await page.$('#stage > section.slide.on');
const info = await page.evaluate((n) => {
  const s = document.querySelectorAll('#stage > section.slide')[n];
  return {
    eyebrow: s.querySelector('.eyebrow')?.textContent?.trim().slice(0, 60) || '',
    colophon: s.querySelector('.colophon')?.textContent?.trim() || '',
    overflow: s.scrollHeight - s.clientHeight,
  };
}, idx);
await el.screenshot({ path: out });
console.log(`${out}  ·  ${info.eyebrow}  ·  ${info.colophon}  ·  overflow ${info.overflow}px`);
await browser.close();
