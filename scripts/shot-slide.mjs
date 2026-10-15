#!/usr/bin/env node
/**
 * Screenshot one deck page, bare (no comment panel, no narration bar), cropped
 * to the 1280x720 slide box — for eyeballing a layout change.
 *
 * Usage: node scripts/shot-slide.mjs <colophonKey | slideIndex> <out.png> [--light|--dark] [--url=...]
 *        colophonKey is the page's own label, e.g. 05 or B28, and wins if it
 *        matches — easier to keep correct than an index, because pages get
 *        inserted under you. Otherwise the arg is read as a 0-based index,
 *        the same one window.show(i) takes.
 *
 * NB: #toc holds a live .slide.on clone of the current page, so the screenshot
 * must be scoped to #stage > — otherwise it comes back as a 166px thumbnail.
 */

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--') && !a.endsWith('.png')) ?? '0';
const out = args.find((a) => a.endsWith('.png')) || `_shots/slide-${target}.png`;
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

const idx = await page.evaluate((t) => {
  const all = [...document.querySelectorAll('#stage > section.slide')];
  // mainline colophons read "05 / 09" — compare on the numerator only, the same
  // way the narration code keys its clips
  const keyOf = (s) => {
    const c = (s.querySelector('.colophon')?.textContent || '').trim();
    const m = c.match(/^(\d+)\s*\/\s*\d+/);
    return m ? m[1] : c;
  };
  // a colophon key wins over an index: "05" should mean the page labelled 05,
  // not the sixth section — pages get inserted under you.
  const byKey = all.findIndex((s) => keyOf(s) === t);
  if (byKey >= 0) return byKey;
  return /^\d+$/.test(t) ? Math.min(all.length - 1, Number(t)) : -1;
}, target);
if (idx < 0) {
  console.error(`no page with colophon "${target}"`);
  await browser.close();
  process.exit(1);
}

await page.evaluate((n) => window.show(n), idx);
await page.waitForTimeout(1200);

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
console.log(`${out}  ·  ${info.eyebrow}  ·  ${info.colophon}  ·  ${theme}  ·  overflow ${info.overflow}px`);
await browser.close();
