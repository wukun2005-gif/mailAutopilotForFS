#!/usr/bin/env node
/**
 * Answers "why do I see no comments locally?" against the running dev server.
 *
 * The panel is per page and follows the deck's own navigation: comments.js
 * wraps the global show(n) and re-renders on every page change. The deck has no
 * scroll-driven paging, so a probe that scrolls measures page 1 forever — drive
 * it through show() instead.
 *
 * Read-only: it never posts a comment.
 *
 * Usage:  node scripts/probe-local-comments.mjs [url] [slideIndex...]
 */

import { chromium } from 'playwright';

const url = process.argv[2] && process.argv[2].startsWith('http') ? process.argv[2] : 'http://127.0.0.1:8765/';
const idxsArg = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const IDXS = idxsArg.length ? idxsArg : [0, 9, 13];

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('  !! page error:', e.message));

/* Wait for the reader-list fetch itself rather than for a wall-clock guess: the
   render lands a beat after it, and with a few hundred rows a fixed timeout
   reads an empty TOC and looks like a bug that is not there. */
const fetched = page
  .waitForResponse((r) => /rest\/v1\/deck_comments_public/.test(r.url()), { timeout: 20_000 })
  .catch(() => null);
await page.goto(url, { waitUntil: 'load' });
await fetched;
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const ok = document.getElementById('cmtdiscok');
  const m = document.getElementById('cmtdiscmodal');
  if (ok && m && getComputedStyle(m).display !== 'none') ok.click();
});
await page.waitForTimeout(400);

const meta = await page.evaluate(() => ({
  slides: document.querySelectorAll('.stage .slide').length,
  deckId: (window.DECK_COMMENT_CONFIG || {}).deckId || null,
  hasShow: typeof window.show === 'function',
  wired: typeof window.show === 'function' && String(window.show).length > 200,
}));
console.log(`\nurl        ${url}`);
console.log(`deckId     ${meta.deckId === null ? '(unset → "default")' : meta.deckId}`);
console.log(`slides     ${meta.slides} (.stage .slide — page number = index + 1)`);
console.log(`show(n)    ${meta.hasShow ? 'present' + (meta.wired ? ', wrapped by comments.js' : ', NOT wrapped') : 'MISSING'}`);

/* the deck's TOC carries a per-page badge — read them all at once */
const tocBadges = await page.evaluate(() =>
  [...document.querySelectorAll('#toclist .tocitem .cmtbadge')]
    .map((b, k) => ({ page: k + 1, n: (b.textContent || '').trim() }))
    .filter((x) => x.n !== '')
);
console.log(`\nTOC badges with a count: ${tocBadges.length ? tocBadges.map((b) => `p${b.page}=${b.n}`).join(' · ') : '(none — every page is 0)'}`);

for (const idx of IDXS) {
  console.log(`\n── page ${idx + 1} (index ${idx}) ──`);
  await page.evaluate((i) => window.show(i), idx);
  await page.waitForTimeout(700);

  /* the panel is parked off-screen with a transform, not display:none — so
     ask body.cmt-open, which is what the stylesheet actually keys on */
  await page.evaluate(() => {
    if (!document.body.classList.contains('cmt-open')) document.getElementById('cmtbtn').click();
  });
  await page.waitForTimeout(700);
  /* first visit in a fresh profile: the legal notice covers the list until it
     is acknowledged. It is an overlay, so the rows exist underneath — but a
     human would report "I see no comments" if they never clicked through it. */
  const wasBlocked = await page.evaluate(() => {
    const m = document.getElementById('cmtdiscmodal');
    const on = !!m && getComputedStyle(m).display !== 'none';
    if (on) document.getElementById('cmtdiscok').click();
    return on;
  });
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const list = document.getElementById('cmtlist');
    const panel = document.getElementById('cmtpanel');
    const cnt = document.querySelector('#cmtbtn .cnt');
    const sub = panel && panel.querySelector('.sub');
    const els = list ? [...list.querySelectorAll('.cmt')] : [];
    return {
      badge: cnt ? (cnt.textContent || '').trim() : '(no .cnt)',
      sub: sub ? (sub.textContent || '').trim() : '',
      open: document.body.classList.contains('cmt-open'),
      n: els.length,
      empty: els.length ? '' : (list ? (list.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 95) : ''),
      texts: els.slice(0, 4).map((e) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 130)),
    };
  });
  console.log(`  #cmtbtn .cnt   ${r.badge}`);
  console.log(`  panel header   ${r.sub}`);
  console.log(`  panel open     ${r.open}${wasBlocked ? '  (terms notice was covering it — dismissed)' : ''}`);
  console.log(`  rows rendered  ${r.n}`);
  if (r.empty) console.log(`  list says      "${r.empty}"`);
  for (const t of r.texts) console.log(`    · ${t}`);
}

await browser.close();
