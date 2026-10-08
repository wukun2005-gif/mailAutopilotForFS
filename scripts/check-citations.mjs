#!/usr/bin/env node
/**
 * Regression check for citation links in AI answers.
 *
 * The bug: answer-comment told the model to cite as "[1], [2] …", and the
 * numbered list those markers pointed at existed only inside the prompt. A
 * reader saw "[3]" with nothing to resolve it against — the owner's words were
 * "这里的 [3]/[4] 都是啥意思".
 *
 * The fix has two halves, and this covers both:
 *   · server  — each [n] becomes a link to the file the cited chunk came from,
 *               plus a "Sources:" legend naming the numbers (tested separately
 *               in the function's own unit tests)
 *   · browser — that link is rendered as an anchor, but ONLY for hosts we own.
 *               An open comment box would otherwise be a phishing surface:
 *               anyone can post "[click here](https://evil.example)".
 *
 * Hermetic: the Supabase REST call is intercepted, so no backend and no real
 * data are involved. The AI body below is a verbatim copy of a real answer
 * posted by the deployed function (comment c2e684fb, 2026-10-08), so the
 * assertions run against the exact shape the server produces.
 *
 * Serves deck-html on its own port so it does not disturb a running
 * `npm run deck` (8765) or the owner-gate check (8798).
 *
 * Usage:  node scripts/check-citations.mjs [port]
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import pw from 'playwright';

const { chromium } = pw;
const PORT = Number(process.argv[2] || process.env.PORT || 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const REPO = 'https://github.com/wukun2005-gif/mailAutopilotForFS';
/* The HTML documents cite through GitHub Pages: github.com's file view always
   shows HTML as source code, so those links must not point at /blob/. */
const PAGES = 'https://wukun2005-gif.github.io/mailAutopilotForFS';
const ACK = 'deck-comment-terms-ack';

/* Verbatim output of the deployed function — note the CJK section names, the
   em dash in the labels and the two inline links plus two legend links. */
const AI_BODY =
  'Talkdesk is positioned as the platform we build on, not as a competitor we beat. ' +
  'The deck’s competitive matrix focuses on FS specialists (Glia, Eltropy, interface.ai) ' +
  `because the pitch is a vertical email layer for Talkdesk’s existing voice customers ` +
  `[2](${PAGES}/email-autopilot-research-report-v0.2.html). ` +
  `We explicitly avoid claiming Talkdesk’s own capabilities as new — the proposal is framed ` +
  `as “building on CXA Ops Center / Agent Builder / Automation Flows” ` +
  `[3](${PAGES}/email-autopilot-research-report-v0.2.html).\n\n` +
  `Sources: 2. [Research Report — 三张仍成立的牌 / 四个必须正视的威胁（v0.4 口径）](${PAGES}/email-autopilot-research-report-v0.2.html)` +
  ` · 3. [Research Report — 审阅发现：必须纠正或补上的 10 处（按对面试的影响排序）](${PAGES}/email-autopilot-research-report-v0.2.html)`;

const OURS = 4;   // 2 inline + 2 in the legend

const server = spawn(
  process.execPath,
  ['scripts/serve-deck.mjs', 'deck-html', String(PORT), '--no-open'],
  { stdio: 'ignore', cwd: process.cwd() },
);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/index.html`)).ok) return true; } catch { /* not up */ }
    await sleep(250);
  }
  return false;
}

let browser;
let failed = 0;
const check = (name, ok, extra = '') => {
  ok ? process.stdout.write(`  PASS  ${name}\n`) : (failed++, process.stdout.write(`  FAIL  ${name}${extra ? '\n        ' + extra : ''}\n`));
};

try {
  if (!(await waitForServer())) throw new Error(`deck server never came up on ${BASE}`);
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  /* ── phase 1: the slug of slide 1, computed the same way comments.js does it */
  const probe = await browser.newContext();
  const pp = await probe.newPage();
  await pp.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await pp.locator('#cmtbtn').waitFor({ timeout: 15_000 });
  const title = await pp.evaluate(() => {
    const s = document.querySelector('.slide') || document.body;
    const h = s.querySelector('h1,h2');
    return (h && h.textContent.trim()) || '';
  });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  await probe.close();
  console.log(`slide 1 = ${JSON.stringify(title)}\n  slug    = ${slug}\n`);

  const row = (o) => ({
    deck_id: 'mail-autopilot-fs', page_key: slug, page_index: 0, page_title: title,
    quote: null, quote_prefix: null, quote_suffix: null, resolved: false,
    deleted: false, created_at: '2026-10-08T12:00:00.000Z', ...o,
  });
  const rows = [
    row({ id: 'c-reader', author: 'Dana from Risk', body: 'Where does the clock start?', parent_id: null, client_id: 'reader-1' }),
    row({ id: 'c-ai', author: 'Deck AI', body: AI_BODY, parent_id: 'c-reader', client_id: 'deck-ai', created_at: '2026-10-08T12:00:10.000Z' }),
    /* A commenter trying to get the deck to render a link it did not write. */
    row({ id: 'c-evil', author: 'Not the owner', body: 'See [the docs](https://evil.example/phish) for more.', parent_id: null, client_id: 'reader-2', created_at: '2026-10-08T12:00:20.000Z' }),
    /* A bare marker with no link — must stay exactly as written. */
    row({ id: 'c-bare', author: 'Dana from Risk', body: 'Leftover marker [3] with no link.', parent_id: null, client_id: 'reader-1', created_at: '2026-10-08T12:00:30.000Z' }),
  ];

  const ctx = await browser.newContext();
  await ctx.addInitScript((k) => { try { localStorage.setItem(k, '1'); } catch (e) {} }, ACK);
  await ctx.route('**/rest/v1/deck_comments_public*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
  await ctx.route('**/realtime/**', (r) => r.abort());   // keep the run hermetic

  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.locator('#cmtbtn').waitFor({ timeout: 15_000 });
  await page.locator('#cmtbtn').click();
  await page.locator('.cmt.ai .bd').first().waitFor({ timeout: 15_000 });

  const got = await page.evaluate((repo) => {
    const ai = document.querySelector('.cmt.ai .bd');
    const evil = document.querySelector('[data-id="c-evil"] .bd');
    const bare = document.querySelector('[data-id="c-bare"] .bd');
    const as = [...document.querySelectorAll('.cmt.ai .bd a.cite')];
    return {
      total: as.length,
      hrefs: as.map((a) => a.getAttribute('href')),
      texts: as.map((a) => a.textContent),
      target: as.map((a) => a.getAttribute('target')),
      rel: as.map((a) => a.getAttribute('rel')),
      cls: as.map((a) => a.getAttribute('class')),
      aiText: ai ? ai.textContent : null,
      aiHtml: ai ? ai.innerHTML : null,
      evilText: evil ? evil.textContent : null,
      evilAnchors: evil ? evil.querySelectorAll('a').length : -1,
      bareText: bare ? bare.textContent : null,
      bareAnchors: bare ? bare.querySelectorAll('a').length : -1,
      inRepo: repo,
    };
  }, REPO);

  console.log('── the AI answer ──');
  check(`every citation is an anchor (${OURS} expected)`, got.total === OURS, `got ${got.total}`);
  check('all point at the repo or its rendered Pages mirror',
    got.hrefs.every((h) => h && (h.startsWith(REPO + '/') || h.startsWith(PAGES + '/'))), JSON.stringify(got.hrefs));
  check('inline markers keep their number as the label', got.texts[0] === '2' && got.texts[1] === '3', JSON.stringify(got.texts));
  check('the legend spells the numbers out',
    /Research Report/.test(got.texts[2] || '') && /Research Report/.test(got.texts[3] || ''), JSON.stringify(got.texts));
  check('open in a new tab, without handing over the opener',
    got.target.every((t) => t === '_blank') && got.rel.every((r) => r === 'noopener noreferrer'));
  check('no bare [n] left in the rendered text', !/\[\d\]/.test(got.aiText || ''), got.aiText);
  check('the legend is visible to the reader', /Sources: 2\./.test(got.aiText || ''));

  console.log('\n── a link from somebody else ──');
  check('is not turned into an anchor', got.evilAnchors === 0, `found ${got.evilAnchors}`);
  check('but is still shown, exactly as typed',
    (got.evilText || '').includes('[the docs](https://evil.example/phish)'), JSON.stringify(got.evilText));

  console.log('\n── a marker with no link ──');
  check('stays as written', (got.bareText || '').includes('[3]'), JSON.stringify(got.bareText));
  check('and gains no anchor', got.bareAnchors === 0, `found ${got.bareAnchors}`);

  console.log('\n── safety ──');
  check('nothing was built with innerHTML', !/<a [^>]*href="https:\/\/evil/.test(got.aiHtml || ''));
  check('no page errors', errs.length === 0, errs.join(' | '));

  if (process.env.SHOW_BODY) console.log('\n── rendered text ──\n' + got.aiText);
} catch (e) {
  failed++;
  console.error('\nERROR: ' + (e && e.message ? e.message : String(e)));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
}

console.log(failed ? `\n${failed} FAILED\n` : '\nall good\n');
process.exit(failed ? 1 : 0);
