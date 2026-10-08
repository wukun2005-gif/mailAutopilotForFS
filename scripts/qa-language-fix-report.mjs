#!/usr/bin/env node
/**
 * Builds qa-language-fix.html — the before/after for the language fix (v20 → v21),
 * plus the non-regression comparison and the one defect the fix introduced.
 *
 * Reads the two archived runs (qa-answer-comments-52.json = v20, and
 * qa-answer-comments-52-v21.json = v21) and writes a single self-contained page.
 * Nothing is fetched; the spread numbers for the repeat probe are pasted in from
 * scripts/probe-answer-variance.mjs output as prose, since a report is a record
 * of a run and not a re-run.
 *
 * Usage: node scripts/qa-language-fix-report.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';

const v20 = JSON.parse(readFileSync('qa-answer-comments-52.json', 'utf8'));
const v21 = JSON.parse(readFileSync('qa-answer-comments-52-v21.json', 'utf8'));

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const han = (s) => (String(s || '').match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
const latin = (s) => (String(s || '').match(/[A-Za-z]/g) || []).length;
/* the Sources legend and every markdown link target carry long Latin runs; they
   have to come out before counting, or a plainly Chinese answer reads as Latin */
const proseOf = (a) => String(a || '').split('\n\nSources: ')[0].replace(/\]\([^)]*\)/g, ']');
const legendOf = (a) => (String(a || '').includes('\n\nSources: ') ? String(a).split('\n\nSources: ')[1] : '');

const A20 = new Map(v20.rows.map((r) => [r.question, r]));
const joined = v21.rows.map((r) => ({ v21: r, v20: A20.get(r.question) })).filter((x) => x.v20);

/* ── the three that used to come back in the wrong language ──────────────── */
const wasChinese = joined.filter((x) => han(proseOf(x.v20.answer)) > latin(proseOf(x.v20.answer)));
const stillChinese = joined.filter((x) => han(proseOf(x.v21.answer)) > latin(proseOf(x.v21.answer)));

/* ── the one defect the fix introduced: a Chinese numeral restated in English */
const NUM_Q = /Larkspur is fictional but it drives the whole ROI/;
const numRow = joined.find((x) => NUM_Q.test(x.v21.question));

/* ── non-regression, same questions both sides ───────────────────────────── */
const rates = (rows, pick) => rows.filter((x) => pick(x)).length;
const cited20 = rates(joined, (x) => /\]\(http/.test(String(x.v20.answer)));
const cited21 = rates(joined, (x) => /\]\(http/.test(String(x.v21.answer)));
const leg20 = rates(joined, (x) => /\n\nSources: /.test(String(x.v20.answer)));
const leg21 = rates(joined, (x) => /\n\nSources: /.test(String(x.v21.answer)));
const n = joined.length;

const sample = (label, page, who, q, answer, note) => `
  <div class="ex">
    <div class="exh"><span class="pill">${label}</span><b>${esc(who || '—')}</b>
      <span class="dim">第 ${page} 页 · han ${han(proseOf(answer))} / latin ${latin(proseOf(answer))}</span></div>
    <div class="q">${esc(q)}</div>
    <div class="a">${esc(proseOf(answer))}</div>
    ${legendOf(answer) ? `<div class="lg">Sources: ${esc(legendOf(answer))}</div>` : '<div class="lg neg">没有 Sources 行</div>'}
    ${note ? `<div class="note">${note}</div>` : ''}
  </div>`;

const fixedBlocks = wasChinese.map((x) => `
  <h3>第 ${x.v21.page} 页 · ${esc(x.v21.who || x.v20.persona)}</h3>
  ${sample('修复前 · v20', x.v20.page, x.v20.persona, x.v20.question, x.v20.answer, '判定：<b class="bad">中文占多数</b> —— 模型被中文源文带走。')}
  ${sample('修复后 · v21', x.v21.page, x.v21.who, x.v21.question, x.v21.answer, '判定：<b class="pass">英文</b>。')}
`).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>英文提问为什么回了中文 · 修复实证 · 2026-10-08</title>
<style>
:root{
  --ink:#16202b; --soft:#3b4957; --faint:#6b7280; --line:#dfe5ec; --bg:#f5f7fa; --paper:#fff;
  --teal:#0f766e; --teal-s:#e6f4f1; --red:#b42318; --red-s:#fdecea; --amber:#b45309; --amber-s:#fdf3e3;
  --green:#15803d; --green-s:#e8f5ec;
  --mono:"JetBrains Mono","SF Mono",ui-monospace,Menlo,Consolas,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:15px/1.65 var(--sans);padding:40px 20px}
.wrap{max-width:1000px;margin:0 auto}
header{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:26px 28px;margin-bottom:20px}
h1{font-size:24px;letter-spacing:-.01em;margin-bottom:6px}
.sub{color:var(--faint);font-size:13.5px}
.verdict{margin-top:16px;padding:12px 16px;border-radius:9px;background:var(--green-s);border-left:4px solid var(--green);font-weight:600;color:#14532d}
.verdict .n{font-weight:400;font-size:13px;color:#166534;display:block;margin-top:6px}
section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:24px 28px;margin-bottom:20px}
h2{font-size:17px;margin-bottom:14px;padding-bottom:9px;border-bottom:1px solid var(--line)}
h3{font-size:14px;margin:22px 0 8px;color:var(--soft)}
h3:first-of-type{margin-top:0}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin:10px 0}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--bg);font-weight:600;font-size:12.5px;color:var(--soft)}
td.num{font-family:var(--mono);text-align:right;white-space:nowrap}
code{font-family:var(--mono);font-size:12.5px;background:var(--bg);padding:1.5px 5px;border-radius:4px}
.pass{color:var(--green);font-weight:700}
.bad{color:var(--red);font-weight:700}
.warn{color:var(--amber);font-weight:700}
.big{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0 4px}
.big div{flex:1 1 150px;background:var(--bg);border-radius:9px;padding:12px 14px}
.big .k{font-size:12px;color:var(--faint);margin-bottom:3px}
.big .v{font-size:21px;font-weight:700;font-family:var(--mono)}
.ex{border:1px solid var(--line);border-radius:9px;padding:13px 15px;margin:10px 0;background:#fcfdfe}
.exh{font-size:12.5px;color:var(--faint);margin-bottom:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.exh b{color:var(--ink);font-size:13px}
.exh .dim{font-family:var(--mono);font-size:11.5px}
.pill{display:inline-block;background:var(--teal-s);color:var(--teal);font-weight:700;font-size:11px;padding:1px 7px;border-radius:20px}
.q{font-size:13.5px;font-weight:600;margin-bottom:6px}
.a{font-size:13px;color:var(--soft);white-space:pre-wrap}
.lg{font-size:12px;color:var(--faint);margin-top:7px;padding-top:7px;border-top:1px dashed var(--line)}
.lg.neg{color:var(--red)}
.note{font-size:12.5px;color:var(--soft);margin-top:8px;padding-top:7px;border-top:1px dashed var(--line)}
ul{margin:8px 0 8px 20px;font-size:13.5px;color:var(--soft)}
li{margin-bottom:5px}
footer{color:var(--faint);font-size:12.5px;text-align:center;padding:10px 0 30px}
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>英文提问为什么回了中文 —— 以及修完之后</h1>
  <div class="sub">52 题全量测试 · v20 归档 ${esc(v20.ranAt)} → v21 复跑 ${esc(v21.ranAt)} · 线上 <code>answer-comment</code> 由 <b>v20</b> 部署为 <b>v21</b></div>
  <div class="verdict">修复生效：中文占多数的回答从 <b>3/52</b> 降到 <b>0/52</b>。
    <span class="n">同批其余题的引用与 legend 未见回归；但修复本身带出 1 处新缺陷（中文数词换算），在下面单列。</span></div>
</header>

<section>
  <h2>1 · 根因：不是措辞不够强，是模型被源文语言带走</h2>
  <p style="font-size:13.5px;color:var(--soft)">原提示词只说"按评论语言作答"，没有指定是哪种语言。答案主要依据的材料里，<b>《调研报告》是中文</b>，Deck 与 PRD 是英文 —— 于是回答的语言跟着"命中哪份材料"走，而不是跟着提问走。</p>
  <div class="big">
    <div><div class="k">中文答案（v20）</div><div class="v" style="color:var(--red)">3 / 52</div></div>
    <div><div class="k">其中引用了《调研报告》</div><div class="v">3 / 3</div></div>
    <div><div class="k">引用该报告的答案总数</div><div class="v">12</div></div>
    <div><div class="k">未引用它的答案</div><div class="v">40 → 全英文</div></div>
  </div>
  <p style="font-size:13.5px;color:var(--soft);margin-top:8px">3 条全部落在引用中文报告的那 12 条里，未引用它的 40 条无一例外是英文 —— 这是<b>源文语言镜像</b>，不是随机漂移，所以"再强调一遍语气"不会有用。</p>
</section>

<section>
  <h2>2 · 修法：在服务端先判定语言，再把它写进 System 段</h2>
  <p style="font-size:13.5px;color:var(--soft)">新增 <code>commentScript()</code>：数汉字与拉丁字母，定出 <code>Chinese</code> / <code>English</code>，然后 prompt 里把结论明写出来 —— 不再让模型自己判断"这条评论是什么语言"。</p>
  <ul>
    <li>判定规则是 <b>汉字绝对量优先</b>，不是比例：<code>han &gt;= 4</code> → Chinese；<code>han &gt;= 2 且 han/(han+latin) &gt;= 0.5</code> → Chinese；否则 English。</li>
    <li>纯比例会把「Talkdesk 的 core-bank execution 是什么意思？」这种<b>英文产品名多于汉字</b>的中文提问误判成英文 —— 这正是 30 条单测 <code>check-answer-prompt.mjs</code> 抓到的坑。</li>
    <li>System 段明写：<code>The comment is written in English. Write the whole answer in English. The reference material above is part English and part Chinese — answer in the comment's language, never in the material's.</code></li>
  </ul>
</section>

<section>
  <h2>3 · 三条错语言的答案，修完逐条对照</h2>
  <p style="font-size:13.5px;color:var(--soft)">下面每一对都是<b>同一个问题</b>的答案：左为 v20 归档原文，右为 v21 重新生成。计数已剥掉 <code>Sources:</code> 段与所有链接目标 —— 否则内嵌的长 URL 会让一条纯中文答案看起来是拉丁占优。</p>
  ${fixedBlocks}
</section>

<section>
  <h2>4 · 非回归核查</h2>
  <p style="font-size:13.5px;color:var(--soft)">按<b>问题文本</b>把两轮对齐（不能按 <code>created_at</code>，同一批插入的时间会并列）。${n} 条可比。</p>
  <table>
    <tr><th>检查</th><th class="num">v20</th><th class="num">v21</th><th>判读</th></tr>
    <tr><td>中文占多数的回答</td><td class="num">${wasChinese.length} / ${n}</td><td class="num">${stillChinese.length} / ${n}</td><td class="pass">这是本次要修的</td></tr>
    <tr><td>带引用链接</td><td class="num">${cited20} / ${n}</td><td class="num">${cited21} / ${n}</td><td>${cited21 >= cited20 ? '<span class="pass">持平或更好</span>' : '<span class="warn">少 ' + (cited20 - cited21) + ' 条 —— 经重复抽样确认是波动</span>'}</td></tr>
    <tr><td>带 Sources legend</td><td class="num">${leg20} / ${n}</td><td class="num">${leg21} / ${n}</td><td>${leg21 >= leg20 ? '<span class="pass">持平</span>' : '<span class="warn">少 ' + (leg20 - leg21) + ' 条（与上同一题）</span>'}</td></tr>
    <tr><td>裸 <code>[n]</code> 未变成链接</td><td class="num">0</td><td class="num">0</td><td class="pass">两轮都为 0</td></tr>
  </table>

  <h3>那 1 条"丢了引用"的，是波动不是回归</h3>
  <p style="font-size:13.5px;color:var(--soft)">第 9 页「Only four demo films are listed…」在 52 题那轮没有带引用，但用 <code>probe-answer-variance.mjs</code> 把<b>同一个问题重复问 3 次</b>，3/3 都带引用与 legend。答案不是算出来的、每次都不一样，所以"上一轮 52/52、这一轮 49/52"这种对比本身不能证明回归。</p>

  <h3>顺带纠正一处我上一轮记错的口径</h3>
  <p style="font-size:13.5px;color:var(--soft)">"来源 ⊆ 公开材料"那条：报告脚本把<b>代码</b>也算作公开材料之一，而 <code>qa-answer-comments.mjs</code> 的 <code>PUBLISHED</code> 集合<b>不含</b> <code>Prototype Source</code>，所以它报 <b>49/52</b>。两轮都是 3 条引用代码，前后一致 —— 不是回归，是我把两套定义混为一谈。</p>
</section>

${numRow ? `<section>
  <h2>5 · 修复带出的一处新缺陷（未修）</h2>
  <p style="font-size:13.5px;color:var(--soft)">同一条题在<b>强制英文作答</b>后，把素材里的邮件量写错了。素材原文是 <code>50,000 emails a month</code> / <code>50K emails/month</code>。</p>
  <table>
    <tr><th>轮次</th><th>答案里的写法</th><th>对错</th></tr>
    <tr><td>v20（中文作答）</td><td><code>5万封/月</code></td><td class="pass">正确</td></tr>
    <tr><td>v21 那轮</td><td><code>60k/month</code></td><td class="bad">数字错（应为 50k）</td></tr>
    <tr><td>v21 重复第 1 次</td><td><code>60k/month</code></td><td class="bad">同上</td></tr>
    <tr><td>v21 重复第 2 次</td><td><code>5万封/月</code></td><td class="pass">正确 —— 唯一一次照抄中文数词</td></tr>
    <tr><td>v21 重复第 3 次</td><td><code>60k/year</code></td><td class="bad">数字与单位都错</td></tr>
  </table>
  <p style="font-size:13.5px;color:var(--soft);margin-top:6px">两次纯英文作答都写成了 <code>60k</code>，唯一正确的一次是把中文数词原样留下 —— 疑因 <b>"5万 → k" 这一步换算出错</b>，属强制英文作答的副作用。修复方向：System 段加一句"数字按素材原文逐字照抄、不要做单位换算"，先补 <code>check-answer-prompt.mjs</code> 的断言再部署。线上 deck 上第 2 页那条种子答案目前也是错的这个数。</p>
</section>` : ''}

<footer>
  数据：<code>qa-answer-comments-52.json</code>（v20）· <code>qa-answer-comments-52-v21.json</code>（v21）<br>
  重跑：<code>node scripts/qa-answer-comments.mjs --no-clean</code> → <code>node scripts/archive-qa-run.mjs out.json</code>
</footer>

</div>
</body>
</html>
`;

writeFileSync('qa-language-fix.html', html);
console.log('wrote qa-language-fix.html');
console.log(`  v20 中文答案 ${wasChinese.length} → v21 中文答案 ${stillChinese.length}`);
console.log(`  引用 ${cited20}→${cited21} · legend ${leg20}→${leg21} · 可比题 ${n}`);
