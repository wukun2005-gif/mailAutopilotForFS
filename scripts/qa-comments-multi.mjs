/**
 * Multi-reviewer concurrency tests for the deck comment system.
 *
 * Three independent browsers (separate contexts → separate clientIds, exactly
 * like three real reviewers on three machines) work on the same deck at the
 * same time. What we are hunting for is the failure that matters most:
 * one reviewer's comment silently overwriting, hiding, or destroying another's.
 *
 * Every comment is tagged with the run id so it can be identified and removed
 * afterwards. All test reviewers use the owner's own email address, which by
 * design never triggers a notification — the run cannot spam the owner.
 *
 * Run:  node scripts/qa-comments-multi.mjs     (needs `npm run deck` on :8765)
 * Out:  PASS/FAIL lines + JSON at /tmp/qa-multi-results.json
 */

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const cfg = readFileSync('deck-html/comments.config.js', 'utf8');
const SUPA = /supabaseUrl:\s*'([^']*)'/.exec(cfg)[1];
const KEY = /supabaseAnonKey:\s*'([^']*)'/.exec(cfg)[1];
const OWNER = 'wukun2005@gmail.com';
const DECK = 'mail-autopilot-fs';
const RUN = 'qa' + Date.now().toString(36).slice(-6);
const URL = 'http://127.0.0.1:8765/index.html';

const results = [];
const say = (ok, msg, detail = '') => {
  results.push({ ok: !!ok, msg, detail: String(detail).slice(0, 200) });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + msg + (ok ? '' : '   → ' + String(detail).slice(0, 160)));
};

const api = async (path, method = 'GET', body = null, headers = {}) => {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  return { status: r.status, data: t ? JSON.parse(t) : null };
};
const view = (q) => api(`deck_comments_public?${q}`);

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

async function reviewer(name, idx) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const clientId = `${RUN}-${idx}`;
  await page.goto(URL);
  await page.evaluate(([n, id, mail]) => {
    localStorage.setItem('deck-comment-identity', JSON.stringify({ clientId: id, name: n, email: mail }));
    localStorage.setItem('deck-comment-terms-ack', '1');
  }, [name, clientId, OWNER]);
  await page.reload();
  await page.waitForTimeout(2600);
  return { name, ctx, page, clientId };
}
const open = async (r) => {
  await r.page.click('#cmtbtn');
  await r.page.waitForTimeout(500);
  if (await r.page.locator('#cmtdiscmodal').isVisible()) {
    await r.page.click('#cmtdiscok');
    await r.page.waitForTimeout(300);
  }
};
const post = async (r, text) => {
  await r.page.fill('#cmtta', text);
  await r.page.click('#cmtsend');
  await r.page.waitForTimeout(900);
};
const count = async (r) => parseInt(await r.page.locator('#cmtbtn .cnt').textContent(), 10);
const dbRows = async (extra = '') =>
  (await view(`select=id,body,author,client_id,parent_id,resolved,deleted,page_key,page_index&deck_id=eq.${DECK}&body=like.*${RUN}*${extra}`)).data || [];

console.log(`\n=== 多 reviewer 并发测试   run=${RUN} ===\n`);

const A = await reviewer('ReviewerA', 1);
const B = await reviewer('ReviewerB', 2);
const C = await reviewer('ReviewerC', 3);
await Promise.all([open(A), open(B), open(C)]);

const base0 = await count(A);

/* ── M1 三人同时在同一页发评论，互不覆盖 ─────────────────────────────── */
await Promise.all([
  post(A, `[${RUN}] A: 先说一句，退费窗口是按工作日算的吗？`),
  post(B, `[${RUN}] B: 我关心的是身份核验失败后的降级路径。`),
  post(C, `[${RUN}] C: 从合规角度，临时贷记的时钟由谁触发？`),
]);
await A.page.waitForTimeout(1200);
const three = await dbRows();
say(three.length === 3, `M1 三人同时发帖 → 三条都在（实际 ${three.length}）`, JSON.stringify(three.map((r) => r.author)));
say(new Set(three.map((r) => r.body)).size === 3, 'M2 三条内容各不相同，无互相覆盖');

/* ── M3 界面计数 = 库里的条数 ────────────────────────────────────────── */
const afterA = await count(A);
say(afterA === base0 + 3, `M3 A 的面板计数 ${base0} → ${afterA}（应为 +3）`);

/* ── M4 刷新后仍能看到别人的评论 ─────────────────────────────────────── */
await A.page.reload();
await A.page.waitForTimeout(2600);
await open(A);
say((await count(A)) === base0 + 3, 'M4 A 刷新后仍能看到全部三条（含 B、C 的）');

/* ── M5 实时/轮询同步：B 不刷新也能看到 A 刚发的 ─────────────────────── */
const beforeB = await count(B);
await post(A, `[${RUN}] A: 同步探测 — 这条 B 不刷新就该看到`);
let synced = false;
for (let i = 0; i < 14; i++) {
  await B.page.waitForTimeout(1000);
  if ((await count(B)) > beforeB) { synced = true; break; }
}
say(synced, `M5 B 未刷新即收到 A 的新评论（${beforeB} → ${await count(B)}）`);

/* ── M6 两人同时回复同一条评论，两条回复都保留 ───────────────────────── */
const targetBody = `[${RUN}] A: 先说一句，退费窗口是按工作日算的吗？`;
const reply = async (r, text) => {
  const item = r.page.locator('#cmtlist .cmt').filter({ hasText: targetBody }).first();
  await item.locator('button', { hasText: 'Reply' }).click();
  await post(r, text);
};
await Promise.all([
  reply(B, `[${RUN}] B 回复：工作日，bd10 从进件算。`),
  reply(C, `[${RUN}] C 回复：同意 B，另注意 45 天是日历日。`),
]);
await B.page.waitForTimeout(1500);
const kids = await dbRows('&parent_id=not.is.null');
const parents = await dbRows('&parent_id=is.null');
say(kids.length === 2, `M6 同一父评论下两条回复都在（实际 ${kids.length}）`);
say(parents.length === 4, `M7 父评论未被回复覆盖（顶层 ${parents.length} 条）`);

/* ── M8 越权：只能删自己的评论 ───────────────────────────────────────── */
const delButtons = async (r, text) =>
  r.page.locator('#cmtlist .cmt').filter({ hasText: text }).first().locator('button', { hasText: 'Delete' }).count();
say((await delButtons(B, `[${RUN}] B: 我关心的是身份核验失败后的降级路径。`)) === 1,
  'M8 B 能删自己的评论（按钮存在）');
say((await delButtons(B, `[${RUN}] C: 从合规角度，临时贷记的时钟由谁触发？`)) === 0,
  'M9 B 看不到删除 C 评论的按钮（前端越权防护）');

/* ── M10 解决状态对所有 reviewer 可见 ────────────────────────────────── */
const cItem = C.page.locator('#cmtlist .cmt').filter({ hasText: `[${RUN}] C: 从合规角度` }).first();
await cItem.locator('button', { hasText: 'Resolve' }).click();
await C.page.waitForTimeout(1200);
const resolvedInDb = (await dbRows()).filter((r) => r.resolved).length;
say(resolvedInDb >= 1, `M10 解决状态写入库（${resolvedInDb} 条 resolved）`);
let seen = false;
for (let i = 0; i < 14; i++) {
  await A.page.waitForTimeout(1000);
  if ((await A.page.locator('#cmtlist .cmt.resolved').count()) > 0) { seen = true; break; }
}
say(seen, 'M11 A 那边同步看到了 resolved 状态');

/* ── M12 同一段文字被两人锚定，两个高亮都在 ─────────────────────────── */
/* Selects a phrase the way a reader's mouse would. It has to search across
   text nodes: once the first reviewer anchors a comment, that phrase is
   wrapped in <mark> and split into several nodes, so a single-node match
   would silently find nothing the second time round. */
const anchorAt = async (r, text) => {
  const found = await r.page.evaluate((t) => {
    const root = document.querySelector('#stage .slide.on');
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue && n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    let flat = '', map = [], n;
    while ((n = w.nextNode())) { map.push({ node: n, at: flat.length }); flat += n.nodeValue; }
    const i = flat.indexOf(t);
    if (i < 0) return false;
    const at = (off) => {
      for (const m of map) if (off >= m.at && off < m.at + m.node.nodeValue.length) return { node: m.node, off: off - m.at };
      return null;
    };
    const s = at(i), e = at(i + t.length - 1);
    if (!s || !e) return false;
    const range = document.createRange();
    range.setStart(s.node, s.off);
    range.setEnd(e.node, e.off + 1);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return true;
  }, text);
  if (!found) return false;
  await r.page.waitForTimeout(400);
  if (await r.page.locator('#cmtselbtn').isVisible()) {
    await r.page.click('#cmtselbtn');
    await r.page.waitForTimeout(300);
  }
  return true;
};
const phrase = 'Email Autopilot';
await Promise.all([
  (async () => { await anchorAt(A, phrase); await post(A, `[${RUN}] A 锚定：这句话的措辞我想确认一下`); })(),
  (async () => { await anchorAt(B, phrase); await post(B, `[${RUN}] B 锚定：同一句，我也有个疑问`); })(),
]);
await A.page.waitForTimeout(1500);
const quoted = (await dbRows()).filter((r) => r.body.includes('锚定'));
say(quoted.length === 2, `M12 两人锚定同一段文字 → 两条锚定评论都在（${quoted.length}）`);
const marks = await A.page.locator('#stage .slide.on mark.cmt-anchor').count();
const markTitle = await A.page.locator('#stage .slide.on mark.cmt-anchor').first().getAttribute('title');
say(marks === 1 && /2 comments/.test(markTitle || ''),
  `M13 同一句的两条锚定共用一个高亮并标注条数（marks=${marks}, title="${markTitle}"）`);

/* ── M14 跨页并发：不同页各发各的，不串页 ───────────────────────────── */
await A.page.evaluate(() => window.show(3));
await B.page.evaluate(() => window.show(6));
await A.page.waitForTimeout(600);
await B.page.waitForTimeout(600);
const page3base = await count(A);
const page6base = await count(B);
await Promise.all([
  post(A, `[${RUN}] A 在第 4 页留一句`),
  post(B, `[${RUN}] B 在第 7 页留一句`),
]);
await A.page.waitForTimeout(1200);
say((await count(A)) === page3base + 1, `M14 第 4 页只多了自己那条（${page3base} → ${await count(A)}）`);
await B.page.waitForTimeout(500);
say((await count(B)) === page6base + 1, `M15 第 7 页只多了自己那条（${page6base} → ${await count(B)}）`);
const crossRows = await dbRows();
const pages = new Set(crossRows.map((r) => r.page_key));
say(pages.size >= 3, `M16 跨页写入落在不同 page_key 上（${pages.size} 个页面）`);

/* ── M17 一人连发 5 条：不丢单、不重复 ──────────────────────────────── */
const before5 = (await dbRows()).length;
for (let i = 1; i <= 5; i++) await post(C, `[${RUN}] C 连发第 ${i} 条`);
await C.page.waitForTimeout(1500);
const after5 = (await dbRows()).length;
say(after5 === before5 + 5, `M17 连发 5 条全部落库（${before5} → ${after5}）`);
const dupes = await dbRows('&body=like.*连发第 3 条*');
say(dupes.length === 1, `M18 同一条未被重复写入（连发第 3 条命中 ${dupes.length} 次）`);

/* ── M19 界面与库最终一致 ───────────────────────────────────────────── */
await A.page.evaluate(() => window.show(0));
await A.page.waitForTimeout(1500);
const dbPage0 = (await view(`select=id&deck_id=eq.${DECK}&page_index=eq.0&deleted=eq.false`)).data || [];
const uiCount = await count(A);
say(uiCount === dbPage0.length, `M19 第 1 页界面计数(${uiCount}) == 库内可见条数(${dbPage0.length})`);

/* ── 收尾：清理本轮全部测试数据（软删除）────────────────────────────── */
const rows = await dbRows();
const del = await api(
  `deck_comments_public?client_id=like.${RUN}*`,
  'PATCH',
  { deleted: true },
  { Prefer: 'return=minimal' }
);
const left = await dbRows('&deleted=eq.false');
console.log(`\n清理：本轮 ${rows.length} 条已标记删除，残留可见 ${left.length} 条`);
say(left.length === 0, 'M20 测试数据清理干净（无可见残留）');

const passed = results.filter((r) => r.ok).length;
console.log(`\n--- 多 reviewer：${passed}/${results.length} 通过 ---\n`);
writeFileSync('/tmp/qa-multi-results.json',
  JSON.stringify({ run: RUN, results, passed, total: results.length }, null, 2), 'utf8');

await Promise.all([A.ctx.close(), B.ctx.close(), C.ctx.close()]);
await browser.close();
process.exit(passed === results.length ? 0 : 1);
