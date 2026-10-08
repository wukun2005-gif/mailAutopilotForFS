#!/usr/bin/env node
/**
 * Regression check for the owner-mode gate (the ⚙ in the top-right corner).
 *
 * Two bugs this guards, both from the same root: owner mode used to be a
 * localStorage flag.
 *   1. It stuck. One visit with ?config=true put the gear on every page of
 *      that origin for good, and the only way out was a button hidden *inside*
 *      the panel it opened. It read as "the gear appears by default".
 *   2. There was no way to see the reader's view without clearing storage by
 *      hand.
 * Owner mode is now the URL parameter and nothing else, so both disappear.
 *
 * Scenarios (all hermetic — no backend call is required for any of them):
 *   1 bare URL, nothing stored            → no gear
 *   2 ?owner=true                         → gear, and the param stays put
 *   3 bare URL, same profile              → NO gear (not sticky any more)
 *   4 ?owner=false                        → no gear
 *   5 ?owner=1                            → gear (alias)
 *   6 ?owner=abc                          → no gear
 *   7 ?config=true (retired)              → no gear, param stripped
 *   8 old stored flag present, bare URL   → no gear, and the key is deleted
 *   9 ?owner=true&p=…                     → gear, other params untouched
 *
 * Serves deck-html on its own port so it does not disturb a running
 * `npm run deck` (8765). Needs Playwright with system Chrome, same as
 * playwright.config.ts.
 *
 * Usage:  node scripts/check-owner-gate.mjs [port]
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pw from 'playwright';

const { chromium } = pw;
const PORT = Number(process.argv[2] || process.env.PORT || 8798);
const BASE = `http://127.0.0.1:${PORT}`;
const RETIRED = 'deck-comment-config';

const server = spawn(
  process.execPath,
  ['scripts/serve-deck.mjs', 'deck-html', String(PORT), '--no-open'],
  { stdio: 'ignore', cwd: process.cwd() },
);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/index.html`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  return false;
}

let browser;
let failed = 0;

try {
  if (!(await waitForServer())) throw new Error(`deck server never came up on ${BASE}`);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  // one context for the whole run: whether state survives between steps is
  // exactly what is under test
  const ctx = await browser.newContext();

  async function step(label, { url, wantGear, seedFlag = false, keepParam = null, dropParam = null }) {
    // step 8 starts from a browser that still carries the retired flag
    if (seedFlag) await ctx.addInitScript((k) => { try { localStorage.setItem(k, '1'); } catch (e) {} }, RETIRED);
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'load' });
      // #cmtbtn is appended by comments.js, so it marks "the module has run";
      // the gear is appended right after by the owner branch
      await page.locator('#cmtbtn').waitFor({ timeout: 15_000 }).catch(() => {});
      const gear = (await page.locator('#cmtgear').count()) > 0;
      const got = page.url();
      const stored = await page.evaluate((k) => localStorage.getItem(k), RETIRED);
      const problems = [];
      if (gear !== wantGear) problems.push(`齿轮=${gear ? '有' : '无'}，期望 ${wantGear ? '有' : '无'}`);
      if (keepParam && !got.includes(keepParam)) problems.push(`丢掉了 ${keepParam}`);
      if (dropParam && got.includes(dropParam)) problems.push(`${dropParam} 未被抹掉`);
      if (stored !== null) problems.push(`旧的 localStorage 标记仍在`);
      if (problems.length) failed++;
      console.log(`  ${problems.length ? 'FAIL' : 'PASS'}  ${label.padEnd(40)} ${problems.join(' · ') || 'OK'}`);
    } finally {
      await page.close();
      if (seedFlag) await ctx.addInitScript(() => {});
    }
  }

  console.log(`\n  owner-mode gate · ${BASE}\n`);
  await step('1 全新，不带参数', { url: `${BASE}/index.html`, wantGear: false });
  await step('2 ?owner=true', { url: `${BASE}/index.html?owner=true`, wantGear: true, keepParam: 'owner=true' });
  await step('3 不带参数（同一 profile，应当不粘）', { url: `${BASE}/index.html`, wantGear: false });
  await step('4 ?owner=false', { url: `${BASE}/index.html?owner=false`, wantGear: false });
  await step('5 ?owner=1（别名）', { url: `${BASE}/index.html?owner=1`, wantGear: true });
  await step('6 ?owner=abc（无法识别）', { url: `${BASE}/index.html?owner=abc`, wantGear: false });
  await step('7 ?config=true（已作废）', { url: `${BASE}/index.html?config=true`, wantGear: false, dropParam: 'config' });
  await step('8 旧标记还在的浏览器，裸地址', { url: `${BASE}/index.html`, wantGear: false, seedFlag: true });
  await step('9 ?owner=true&p=xxx（保留其它参数）', { url: `${BASE}/index.html?owner=true&p=xxx`, wantGear: true, keepParam: 'p=xxx' });

  console.log(failed ? `\n  ${failed} 项失败\n` : '\n  全部通过 ✓\n');
} catch (e) {
  console.error('\n  error:', e.message, '\n');
  failed++;
} finally {
  if (browser) await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
