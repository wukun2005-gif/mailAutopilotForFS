#!/usr/bin/env node
/**
 * Regression check for the comments panel's two "you can see it but it is not
 * there" bugs (2026-10-08, both reported from the live deck).
 *
 * 1. The badge counted comments the list never rendered.
 *    Deleting a top-level comment soft-deleted only that row; its replies
 *    stayed deleted = false. renderList hangs replies off a live top, so they
 *    vanished from the page — while renderBadges walked every row and kept
 *    counting them. The badge read "4" with nothing on the page to find.
 *    Fixed by deriving both from one predicate, visibleOn(), and by taking the
 *    replies along when a top-level comment is deleted.
 *
 * 2. The gear sat on top of the open comments panel.
 *    #cmtgear was pinned at right:268px with z-index 941, i.e. inside the
 *    360px-wide #cmtpanel (z-index 940), so it painted over the panel's own
 *    header. It is now positioned against the Comments button it claims to sit
 *    beside.
 *
 * 3. The presence line only ever showed a headcount.
 *    It now lists initials when somebody signed a name, and keeps the old
 *    wording when every visitor is anonymous. Presence needs a realtime socket,
 *    which this check aborts on purpose — so the label is asserted through the
 *    two pure functions lifted out of comments.js, plus one wiring assertion.
 *
 * Hermetic: the Supabase REST calls are intercepted and a fake deck-admin is
 * served, so no backend, no real comments and no email are involved.
 *
 * Usage:  node scripts/check-comments-ui.mjs [port]
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import pw from 'playwright';

const { chromium } = pw;
const PORT = Number(process.argv[2] || process.env.PORT || 8800);
const BASE = `http://127.0.0.1:${PORT}`;
const ACK = 'deck-comment-terms-ack';

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
  ok ? process.stdout.write(`  PASS  ${name}\n`)
     : (failed++, process.stdout.write(`  FAIL  ${name}${extra ? '\n        ' + extra : ''}\n`));
};

try {
  if (!(await waitForServer())) throw new Error(`deck server never came up on ${BASE}`);
  browser = await chromium.launch({ channel: 'chrome', headless: true });

  /* ── the slug of slide 1, computed the way comments.js computes it ── */
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

  const base = (o) => ({
    deck_id: 'mail-autopilot-fs', page_key: slug, page_index: 0, page_title: title,
    quote: null, quote_prefix: null, quote_suffix: null, resolved: false,
    deleted: false, created_at: '2026-10-08T12:00:00.000Z', ...o,
  });

  /* The shape that produced the bug:
       t1  live top level, with a live AI reply        → 2 visible
       t2  deleted top level, its reply still live     → 0 visible (orphan)
       orph a reply whose parent is not in the list    → 0 visible
     A badge of 2 is right; a badge of 4 is the reported bug. */
  let rows = [
    base({ id: 't1', author: 'Dana from Risk', body: 'Where does the clock start?', parent_id: null, client_id: 'me' }),
    base({ id: 'a1', author: 'Deck AI', body: 'At intake.', parent_id: 't1', client_id: 'deck-ai', created_at: '2026-10-08T12:00:10.000Z' }),
    base({ id: 't2', author: 'Anonymous', body: 'Deleted question', parent_id: null, client_id: 'x1', deleted: true }),
    base({ id: 'a2', author: 'Deck AI', body: 'An orphaned answer.', parent_id: 't2', client_id: 'deck-ai', created_at: '2026-10-08T12:00:20.000Z' }),
    base({ id: 'orph', author: 'Anonymous', body: 'Reply with no parent at all.', parent_id: 'gone', client_id: 'x2', created_at: '2026-10-08T12:00:30.000Z' }),
  ];

  const patches = [];
  async function buildContext(owner) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((k) => { try { localStorage.setItem(k, '1'); } catch (e) {} }, ACK);
    await ctx.route('**/rest/v1/deck_comments_public*', async (route) => {
      const req = route.request();
      if (req.method() === 'PATCH') {
        const url = new URL(req.url());
        patches.push({ q: url.search, body: req.postDataJSON ? req.postDataJSON() : null });
        const byId = /\bid=eq\.([^&]+)/.exec(url.search);
        const byParent = /\bparent_id=eq\.([^&]+)/.exec(url.search);
        if (byId) rows.forEach((r) => { if (r.id === byId[1]) r.deleted = true; });
        if (byParent) rows.forEach((r) => { if (r.parent_id === byParent[1]) r.deleted = true; });
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });
    await ctx.route('**/realtime/**', (r) => r.abort());
    await ctx.route('**/functions/v1/deck-admin', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ config: { enabled: true, model: 'fake' }, models: [], sources: [], knowledge: {}, answers: {} }),
    }));
    return ctx;
  }

  /* ── 1. the badge must count what the list renders ── */
  console.log('── 1 · badge vs list ──');
  const ctx = await buildContext(true);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${BASE}/index.html?owner=true`, { waitUntil: 'load' });
  await page.locator('#cmtbtn').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1200);            // let the intercepted fetch land
  await page.locator('#cmtbtn').click();
  await page.locator('.cmt').first().waitFor({ timeout: 10_000 });

  const seen = await page.evaluate(() => ({
    badge: document.querySelector('#cmtbtn .cnt').textContent.trim(),
    tocBadge: (document.querySelector('#toclist .tocitem .cmtbadge') || {}).textContent,
    rendered: [...document.querySelectorAll('#cmtlist .cmt')].map((d) => d.dataset.id),
    rows: document.querySelectorAll('#cmtlist .cmt').length,
  }));
  check('the live comment and its reply both render', seen.rows === 2, JSON.stringify(seen.rendered));
  check('the orphaned replies do not render',
    !seen.rendered.includes('a2') && !seen.rendered.includes('orph'), JSON.stringify(seen.rendered));
  check('the badge counts them, not the orphans', seen.badge === '2', `badge=${seen.badge}`);
  check('the table-of-contents badge agrees', (seen.tocBadge || '') === '2', `toc=${JSON.stringify(seen.tocBadge)}`);

  /* ── 2. deleting a top-level comment takes its replies ── */
  console.log('\n── 2 · delete cascades to the replies ──');
  page.on('dialog', (d) => d.accept());
  await page.locator('[data-id="t1"] .acts button:text("Delete")').first().click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({
    badge: document.querySelector('#cmtbtn .cnt').textContent.trim(),
    rows: document.querySelectorAll('#cmtlist .cmt').length,
    empty: !!document.querySelector('#cmtlist .empty'),
  }));
  check('the delete went through the id', patches.some((p) => /id=eq\.t1/.test(p.q)), JSON.stringify(patches));
  check('and also took the replies', patches.some((p) => /parent_id=eq\.t1/.test(p.q)), JSON.stringify(patches));
  check('nothing left to show', after.rows === 0 && after.empty, JSON.stringify(after));
  check('and the badge is 0, not 1', after.badge === '0', `badge=${after.badge}`);

  /* ── 3. the gear must not sit on the panel ── */
  console.log('\n── 3 · gear geometry, owner mode, panel open ──');
  await page.goto(`${BASE}/index.html?owner=true`, { waitUntil: 'load' });
  await page.locator('#cmtbtn').waitFor({ timeout: 15_000 });
  await page.locator('#cmtgear').waitFor({ timeout: 15_000 });
  await page.locator('#cmtbtn').click();
  await page.waitForTimeout(400);
  const geo = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const g = r('#cmtgear'), p = r('#cmtpanel'), b = r('#cmtbtn');
    return {
      gear: g && { l: g.left, r: g.right, t: g.top, b: g.bottom },
      panel: p && { l: p.left, r: p.right },
      btn: b && { l: b.left, r: b.right, t: b.top },
    };
  });
  check('the gear exists in owner mode', !!geo.gear);
  check('it does not overlap the comments panel', geo.gear.r <= geo.panel.l,
    `gear.right=${geo.gear && geo.gear.r} panel.left=${geo.panel && geo.panel.l}`);
  check('it sits immediately right of the Comments button',
    geo.gear.l >= geo.btn.r && geo.gear.l - geo.btn.r <= 12,
    `gear.left=${geo.gear && geo.gear.l} btn.right=${geo.btn && geo.btn.r}`);
  check('and on the same line as it', Math.abs(geo.gear.t - geo.btn.t) <= 4,
    `gear.top=${geo.gear && geo.gear.t} btn.top=${geo.btn && geo.btn.t}`);

  /* ── 4. a reader (no ?owner) sees no gear at all ── */
  console.log('\n── 4 · reader view is untouched ──');
  const rctx = await buildContext(false);
  const rpage = await rctx.newPage();
  await rpage.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await rpage.locator('#cmtbtn').waitFor({ timeout: 15_000 });
  await rpage.waitForTimeout(600);
  check('no gear for a reader', (await rpage.locator('#cmtgear').count()) === 0);
  check('Comments button is still there', (await rpage.locator('#cmtbtn').count()) === 1);
  check('no page errors', errs.length === 0, errs.join(' | '));

  /* ── 5. the presence line: names when it has them, a count when it does not ──
     Real presence needs a live socket, which this check aborts. So assert the
     label through the two pure functions read out of the shipped file, exactly
     as check-citations.mjs lifts okLink out of it. */
  console.log('\n── 5 · presence label ──');
  const cs = readFileSync('deck-html/comments.js', 'utf8');
  const grab = (name) => {
    const i = cs.indexOf('function ' + name + '(');
    if (i < 0) throw new Error(`comments.js no longer defines ${name}()`);
    let depth = 0;
    for (let k = cs.indexOf('{', i); k < cs.length; k++) {
      if (cs[k] === '{') depth++;
      else if (cs[k] === '}' && --depth === 0) return cs.slice(i, k + 1);
    }
    throw new Error(`unbalanced braces in ${name}()`);
  };
  const pl = new Function(
    grab('shortName') + '\n' + grab('presenceLabel') + '\nreturn { shortName, presenceLabel };',
  )();
  const anon = (n) => Array.from({ length: n }, () => ({ name: 'Anonymous' }));

  check('two words become two initials', pl.shortName('Dana Whitfield') === 'DW', pl.shortName('Dana Whitfield'));
  check('one word keeps one letter', pl.shortName('dana') === 'D', pl.shortName('dana'));
  check('a non-Latin name keeps its first character', pl.shortName('吴坤') === '吴', pl.shortName('吴坤'));
  check('"Anonymous" is not a name',
    pl.shortName('Anonymous') === null && pl.shortName('anonymous') === null && pl.shortName('  ') === null);

  check('a named visitor is shown by name',
    pl.presenceLabel([{ name: 'Dana Whitfield' }]) === 'DW is on this page',
    pl.presenceLabel([{ name: 'Dana Whitfield' }]));
  check('two named visitors are listed',
    pl.presenceLabel([{ name: 'Dana Whitfield' }, { name: 'Jon Cole' }]) === 'DW · JC on this page',
    pl.presenceLabel([{ name: 'Dana Whitfield' }, { name: 'Jon Cole' }]));
  check('a named visitor next to an anonymous one keeps the count honest',
    pl.presenceLabel([{ name: 'Dana Whitfield' }, { name: 'Anonymous' }]) === 'DW · +1 on this page',
    pl.presenceLabel([{ name: 'Dana Whitfield' }, { name: 'Anonymous' }]));
  check('the list is capped at four, with the rest as a count',
    pl.presenceLabel([{ name: 'A B' }, { name: 'C D' }, { name: 'E F' }, { name: 'G H' }, { name: 'I J' }])
      === 'AB · CD · EF · GH · +1 on this page',
    pl.presenceLabel([{ name: 'A B' }, { name: 'C D' }, { name: 'E F' }, { name: 'G H' }, { name: 'I J' }]));

  /* the fallbacks must be byte-for-byte what the panel said before */
  check('all anonymous keeps the old headcount line',
    pl.presenceLabel(anon(3)) === '3 people on this page', pl.presenceLabel(anon(3)));
  check('a lone anonymous visitor keeps the old line',
    pl.presenceLabel(anon(1)) === 'You are the only one here', pl.presenceLabel(anon(1)));
  check('a visitor with no name at all counts as anonymous',
    pl.presenceLabel([{}]) === 'You are the only one here' && pl.presenceLabel([]) === 'You are the only one here');

  check('renderLive actually asks for the new label',
    /presenceLabel\(peopleStates\(\)\)/.test(cs), 'renderLive no longer wires presenceLabel');
  check('the old peopleHere() is gone', !/function peopleHere\b/.test(cs), 'dead headcount helper left behind');
} catch (e) {
  failed++;
  console.error('\nERROR: ' + (e && e.message ? e.message : String(e)));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
}

console.log(failed ? `\n${failed} FAILED\n` : '\nall good\n');
process.exit(failed ? 1 : 0);
