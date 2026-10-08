/* smoke check for the deck comments panel (runs in local mode, no network) */
import { chromium } from '@playwright/test';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://127.0.0.1:8765/index.html';

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));

const say = (ok, msg) => console.log((ok ? 'PASS  ' : 'FAIL  ') + msg);

await page.goto(URL);
/* the owner's own address: by design "your own comment never mails you", so a
   test run cannot spam the real inbox */
await page.evaluate(() => localStorage.setItem('deck-comment-identity',
  JSON.stringify({ clientId: 'test-1', name: 'Dana', email: 'wukun2005@gmail.com' })));
await page.reload();
await page.waitForTimeout(2500);   // let the first fetch land before reading counts

say(await page.locator('#cmtbtn').isVisible(), 'comment button rendered');

/* open the panel */
await page.click('#cmtbtn');
await page.waitForTimeout(400);
say(await page.evaluate(() => document.body.classList.contains('cmt-open')), 'panel opens');

/* legal notice: full text on first open, must be acknowledged */
say(await page.locator('#cmtdiscmodal').isVisible(), 'legal notice covers the panel on first open');
say(await page.locator('#cmtdisclist li').count() === 4, 'notice lists all 4 clauses');
await page.screenshot({ path: '_shots/comments-disclaimer.png' });
await page.click('#cmtdiscok');
await page.waitForTimeout(300);
say(!(await page.locator('#cmtdiscmodal').isVisible()), 'notice clears once acknowledged');
say(await page.locator('#cmtdisc').isVisible(), 'summary line stays above the composer');

say(await page.locator('#cmtpanel .who .nm').textContent() === 'Dana', 'identity shows the nickname');

/* a plain comment */
/* counts are relative: the live database may already hold comments */
const count = async () => parseInt(await page.locator('#cmtbtn .cnt').textContent(), 10);
const base0 = await count();

const TS = 'smoke-' + Date.now();
await page.fill('#cmtta', 'How does the Reg E clock start if the email arrives at 2am? [' + TS + ']');
await page.click('#cmtsend');
await page.locator('#cmtlist .cmt').filter({ hasText: TS }).first()
  .waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
say(await page.locator('#cmtlist .cmt', { hasText: TS }).count() >= 1, 'comment appears in the list');
say(await count() === base0 + 1, 'button counter went ' + base0 + ' → ' + (await count()));
say(await page.locator('#cmtlist .cmt', { hasText: TS }).locator('.nm').first().textContent() === 'Dana',
  'comment attributed to Dana');

/* the rail badge */
await page.waitForTimeout(200);
const badge = await page.locator('#toclist .tocitem .cmtbadge.on').count();
say(badge === 1, 'page rail shows a comment badge');

/* anchored comment: select a phrase inside the slide */
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.evaluate(() => {
  const h = document.querySelector('#stage .slide.on h1,#stage .slide.on h2');
  const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.nodeValue && n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
  });
  const t = w.nextNode() || h;
  const len = t.nodeType === 3 ? t.nodeValue.length : 1;
  const r = document.createRange();
  r.setStart(t, 0); r.setEnd(t, Math.min(10, len));
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
await page.waitForTimeout(300);
say(await page.locator('#cmtselbtn').isVisible(), 'selection bubble appears over a selected phrase');
await page.click('#cmtselbtn');
await page.waitForTimeout(400);
say(await page.locator('#cmtqchip').isVisible(), 'quote chip attached to the composer');
await page.fill('#cmtta', 'Is this the beachhead or the whole market?');
await page.click('#cmtsend');
await page.locator('#stage .slide.on mark.cmt-anchor').first()
  .waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
const marks = await page.locator('#stage .slide.on mark.cmt-anchor').count();
say(marks >= 1, 'anchored phrase is highlighted on the slide (' + marks + ' mark)');

/* reply */
await page.locator('#cmtlist .cmt').first().locator('button', { hasText: 'Reply' }).click();
await page.fill('#cmtta', 'It starts at inbox arrival, not at business hours.');
await page.click('#cmtsend');
await page.locator('#cmtlist .cmt .kids .cmt').first()
  .waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
say(await page.locator('#cmtlist .cmt .kids .cmt').count() >= 1, 'reply nests under its parent');

/* resolve + delete */
await page.locator('#cmtlist .cmt').first().locator('button', { hasText: 'Resolve' }).click();
/* wait for the state, not for a fixed delay: the PATCH round trip can take
   longer than any timeout guessed up front */
await page.locator('#cmtlist .cmt.resolved').first()
  .waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
say(await page.locator('#cmtlist .cmt.resolved').count() >= 1, 'resolve marks the thread');

/* typing in the composer must never drive the deck:
   the deck's own key handler steps aside for INPUT but not TEXTAREA */
await page.click('#cmtta');
await page.keyboard.type('does the clock pause on weekends?');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowDown');
await page.keyboard.press(' ');
await page.waitForTimeout(300);
const idxWhileTyping = await page.evaluate(() =>
  [...document.querySelectorAll('#stage .slide')].findIndex(s => s.classList.contains('on')));
say(idxWhileTyping === 0, 'space and arrows while typing do not flip the deck (stay on page 1)');
say((await page.inputValue('#cmtta')).trim() === 'does the clock pause on weekends?', 'composer keeps every keystroke');
await page.fill('#cmtta', '');

/* navigating keeps the panel on the right page */
const waitForCount = async (n, ms = 8000) => {
  await page.waitForFunction(
    (want) => parseInt(document.querySelector('#cmtbtn .cnt').textContent, 10) === want,
    n, { timeout: ms }
  ).catch(() => {});
};

await page.evaluate(() => window.show(5));
await page.waitForTimeout(500);
const base6 = await count();
await page.evaluate(() => window.show(0));
await waitForCount(base0 + 3);
say(await count() === base0 + 3,
  `page 1 now carries the 3 comments just posted (期望 ${base0 + 3}，实际 ${await count()})`);
say(typeof base6 === 'number', 'page 6 count read (' + base6 + ')');

/* persistence across reload */
await page.reload();
await page.waitForTimeout(2000);
await waitForCount(base0 + 3);
say(await count() === base0 + 3,
  `comments survive a reload (期望 ${base0 + 3}，实际 ${await count()})`);

await page.click('#cmtbtn');
await page.waitForTimeout(600);
await page.screenshot({ path: '_shots/comments-panel.png' });
console.log(errs.length ? '\nCONSOLE ERRORS:\n' + errs.join('\n') : '\nno console errors');
await browser.close();
