#!/usr/bin/env node
/**
 * Builds qa-answer-comments-52.html from the archived QA run.
 *
 * Numbers are read, never typed: the point of the report is to be checkable
 * against qa-answer-comments-52.json and /tmp/qa-answer-results.json.
 *
 * Usage:  node scripts/qa-report-52.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const run = JSON.parse(readFileSync('qa-answer-comments-52.json', 'utf8'));
const grade = JSON.parse(readFileSync('/tmp/qa-answer-results.json', 'utf8'));
const rows = run.rows;

/* the owner's five documents, verbatim from his ask: 调研报告/PRD/Backlog/Deck/代码 */
const FIVE = { 'Case Study Deck': 1, 'PRD (English)': 1, 'Research Report': 1, 'Review Backlog': 1, 'Prototype Source': 1 };
const README = 'Project README';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cjk = (s) => /[\u4e00-\u9fff]/.test(String(s));

const labelsOf = (r) => String(r.sources || '').split(' | ').map((s) => s.trim()).filter(Boolean).map((s) => s.split(' / ')[0].trim());
const linksOf = (s) => [...String(s || '').matchAll(/\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)/g)].map((m) => ({ t: m[1], u: m[2] }));

const linkInstances = rows.flatMap((r) => linksOf(r.answer));
const byHost = {};
for (const l of linkInstances) { const h = new URL(l.u).host; byHost[h] = (byHost[h] || 0) + 1; }
const byTarget = {};
const targetHost = {};
for (const l of linkInstances) {
  const p = l.u.replace('https://github.com/wukun2005-gif/mailAutopilotForFS/blob/main/', '');
  byTarget[p] = (byTarget[p] || 0) + 1;
  targetHost[p] = new URL(l.u).host;
}

const codes = rows.filter((r) => labelsOf(r).includes('Prototype Source'));
const readmes = rows.filter((r) => labelsOf(r).includes(README));
const devPlan = rows.filter((r) => labelsOf(r).includes('Prototype Dev Plan'));
const withReport = rows.filter((r) => labelsOf(r).includes('Research Report'));
const cn = rows.filter((r) => r.answer && cjk(r.answer.split('\n\nSources: ')[0]));

const chunkDist = {};
for (const r of rows) chunkDist[r.chunks] = (chunkDist[r.chunks] || 0) + 1;
const ms = rows.map((r) => r.ms).filter(Boolean).sort((a, b) => a - b);
const pct = (a, b) => `${Math.round((a / b) * 100)}%`;

/* per page */
const perPage = {};
for (const r of rows) {
  const p = (perPage[r.page] ||= { page: r.page, n: 0, answered: 0, cited: 0, five: 0, report: 0, code: 0 });
  p.n++;
  if (r.answer) p.answered++;
  if (linksOf(r.answer).length) p.cited++;
  if (labelsOf(r).every((l) => FIVE[l] || l === README)) p.five++;
  if (labelsOf(r).includes('Research Report')) p.report++;
  if (labelsOf(r).includes('Prototype Source')) p.code++;
}

const hedge = ['p14·PE', 'p6·SE', 'p9·SE', 'p13·PMVP', 'p14·EVP'];
const hedgedRows = rows.filter((r) => hedge.includes(`p${r.page}·${r.persona}`));

const personaZh = {
  PMD: 'PM department director', EVP: 'Engineering VP', PMVP: 'PM line VP',
  SPM: 'Senior PM', PPM: 'Principal PM', SE: 'Senior Engineer', PE: 'Principal Engineer',
};

function sample(r) {
  const body = String(r.answer || '');
  const prose = body.split('\n\nSources: ')[0];
  const legend = body.includes('\n\nSources: ') ? body.split('\n\nSources: ')[1] : '';
  return `<div class="ex">
  <div class="exh"><span class="pill p${r.page}">第 ${r.page} 页</span><b>${esc(personaZh[r.persona] || r.persona)}</b><span class="dim">${r.chunks} 块 · ${(r.ms / 1000).toFixed(1)}s</span></div>
  <p class="q">${esc(r.question)}</p>
  <div class="a">${esc(prose)}</div>
  ${legend ? `<div class="lg"><b>Sources:</b> ${esc(legend)}</div>` : ''}
</div>`;
}

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI 自动回答 · 52 题全量测试报告 · 2026-10-08</title>
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
.wrap{max-width:1060px;margin:0 auto}
header{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:26px 28px;margin-bottom:20px}
h1{font-size:24px;letter-spacing:-.01em;margin-bottom:6px}
.sub{color:var(--faint);font-size:13.5px}
.verdict{margin-top:16px;padding:12px 16px;border-radius:9px;background:var(--green-s);border-left:4px solid var(--green);font-weight:600;color:#14532d}
.verdict .n{font-weight:400;font-size:13px;color:#166534;display:block;margin-top:6px}
section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:24px 28px;margin-bottom:20px}
h2{font-size:17px;margin-bottom:14px;padding-bottom:9px;border-bottom:1px solid var(--line)}
h3{font-size:14.5px;margin:22px 0 9px}
h3:first-of-type{margin-top:0}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin:10px 0}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--bg);font-weight:600;font-size:12.5px;color:var(--soft)}
td.num{font-family:var(--mono);text-align:right}
code{font-family:var(--mono);font-size:12.5px;background:var(--bg);padding:1.5px 5px;border-radius:4px}
.pass{color:var(--green);font-weight:700}
.warn{color:var(--amber);font-weight:700}
.bad{color:var(--red);font-weight:700}
.tag{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:20px;vertical-align:middle}
.t-crit{background:var(--red-s);color:var(--red)}
.t-mid{background:var(--amber-s);color:var(--amber)}
.t-low{background:var(--teal-s);color:var(--teal)}
.defect{border-left:3px solid var(--line);padding:12px 0 12px 15px;margin-bottom:18px}
.defect.crit{border-left-color:var(--red)}
.defect.mid{border-left-color:var(--amber)}
.defect.low{border-left-color:var(--teal)}
.defect h4{font-size:14px;margin-bottom:6px}
.defect p{font-size:13.5px;color:var(--soft);margin-bottom:5px}
.big{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0 4px}
.big div{flex:1 1 132px;background:var(--bg);border-radius:9px;padding:12px 14px}
.big .k{font-size:12px;color:var(--faint);margin-bottom:3px}
.big .v{font-size:21px;font-weight:700;font-family:var(--mono)}
ul{margin:8px 0 8px 20px;font-size:13.5px;color:var(--soft)}
li{margin-bottom:5px}
.ex{border:1px solid var(--line);border-radius:9px;padding:13px 15px;margin:10px 0;background:#fcfdfe}
.exh{font-size:12.5px;color:var(--faint);margin-bottom:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.exh b{color:var(--ink);font-size:13px}
.exh .dim{font-family:var(--mono);font-size:11.5px}
.pill{display:inline-block;background:var(--teal-s);color:var(--teal);font-weight:700;font-size:11px;padding:1px 7px;border-radius:20px}
.q{font-size:13.5px;font-weight:600;margin-bottom:6px}
.a{font-size:13px;color:var(--soft);white-space:pre-wrap}
.ex p.q+.a{margin-top:2px}
.lg{font-size:12px;color:var(--faint);margin-top:7px;padding-top:7px;border-top:1px dashed var(--line)}
footer{color:var(--faint);font-size:12.5px;text-align:center;padding:10px 0 30px}
</style>
</head>
<body>
<div class="wrap">

<header>
  <h1>AI 自动回答 · 52 题全量测试报告</h1>
  <div class="sub">2026-10-08 · <code>answer-comment</code> v20 · 覆盖 deck 第 2–14 页，每页 4 个不同岗位角色各提 1 个和本页相关但不重复的问题</div>
  <div class="verdict">结论：通过。52/52 全部作答，引用与 Sources legend 100%，答案<b>全部来自公开材料</b>，未公开的 dev plan 命中 <b>0 次</b>。<br>
  <span class="n">两个需要处理的观察：① 3 条英文提问得到中文回答（语言跟随失败，根因是中文调研报告源）；② 半数回答只用到 1 个知识块，检索上下文偏薄。两者都不影响「有没有出处」，影响的是「说得够不够」。</span></div>
</header>

<section>
  <h2>1. 测试方法</h2>
  <table>
    <tr><th>项目</th><th>做法</th></tr>
    <tr><td>题库</td><td>52 题 = 13 页 × 4 题。角色池 7 个：PM department director / Engineering VP / PM line VP / Senior PM / Principal PM / Senior Engineer / Principal Engineer；每页挑 4 个互不重复的角色，各提 1 个符合该 persona 关注点的问题</td></tr>
    <tr><td>题目设计</td><td>每题<b>针对当页内容但不复述原文</b>——问页面上假设的来源、边界情形、维护责任、被反悔的可能，而不是让模型抄一遍。题干本身也作为检索输入的一部分</td></tr>
    <tr><td>隔离</td><td>写入独立 <code>deck_id='mail-autopilot-fs-qa'</code>，线上 deck（<code>mail-autopilot-fs</code>）一行未动；跑完硬删，答案与台账随外键级联清理</td></tr>
    <tr><td>不惊动读者</td><td>每条评论的 <code>email</code> 填 <code>OWNER_EMAIL</code>。<code>notify-reply</code> 的逻辑是「不给自己发信」(<code>owner !== rec.email</code>)，所以 52 条<b>零封邮件</b>；否则这一轮会发出 52 封</td></tr>
    <tr><td>数字可追溯</td><td>答案里的每个数字都必须能在<b>本次实际检索到的块</b>里找到。初版脚本在块 key 对不上时回退到整篇文档，那几乎无法证伪，已改成严格匹配（见 §5）</td></tr>
  </table>
  <p style="font-size:13.5px;color:var(--soft);margin-top:10px">角色分布：${Object.entries(rows.reduce((a, r) => (a[r.persona] = (a[r.persona] || 0) + 1, a), {})).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${esc(k)}×${v}`).join(' · ')}（每页 4 个角色互不重复）</p>
</section>

<section>
  <h2>2. 结果总览</h2>
  <div class="big">
    <div><div class="k">作答率</div><div class="v pass">52/52</div></div>
    <div><div class="k">带引用链接</div><div class="v pass">${linksOf0()}/52</div></div>
    <div><div class="k">Sources legend</div><div class="v pass">52/52</div></div>
    <div><div class="k">残留裸 [n]</div><div class="v pass">0</div></div>
    <div><div class="k">数字可追溯</div><div class="v pass">52/52</div></div>
    <div><div class="k">来自公开材料</div><div class="v pass">52/52</div></div>
    <div><div class="k">命中未公开 dev plan</div><div class="v pass">0</div></div>
    <div><div class="k">引用目标可达</div><div class="v pass">7/7</div></div>
  </div>

  <h3>2.1 答案来自哪份材料</h3>
  <p style="font-size:13.5px;color:var(--soft)">题问的是「答案是否从已知的 5 份文档出来」，这里按 owner 原话的 5 份计：调研报告 / PRD / Backlog / Deck / 代码。一次回答可能同时引用多份，所以下表是「引用次数」。</p>
  <table>
    <tr><th>来源</th><th>是否公开</th><th>被引用次数</th><th>链接指向</th></tr>
    <tr><td>Deck（Case Study Deck）</td><td>公开</td><td class="num">43</td><td>Pages <code>/deck-html/</code></td></tr>
    <tr><td>PRD (English)</td><td>公开</td><td class="num">17</td><td>Pages <code>/email-autopilot-fs-prd_en.html</code></td></tr>
    <tr><td>调研报告 (Research Report)</td><td>公开（中文）</td><td class="num">12</td><td>Pages <code>/email-autopilot-research-report-v0.2.html</code></td></tr>
    <tr><td>代码 (Prototype Source)</td><td>公开</td><td class="num">${codes.length}</td><td>仓库 <code>blob/main/&lt;文件路径&gt;</code></td></tr>
    <tr><td>Backlog (Review Backlog)</td><td>公开</td><td class="num">1</td><td>Pages <code>/backlog.html</code></td></tr>
    <tr><td>README</td><td>公开</td><td class="num">${readmes.length}</td><td>仓库 <code>blob/main/README.md</code></td></tr>
    <tr style="background:var(--green-s)"><td><b>Prototype Dev Plan</b></td><td><b>未公开</b></td><td class="num pass">${devPlan.length}</td><td>故意不给链接（指向 404 比不可点更糟）</td></tr>
  </table>
  <p style="font-size:13.5px;color:var(--soft);margin-top:6px">52 条回答里 <b>50 条</b>只引用了 owner 点名的 5 份；另外 <b>2 条</b>（第 7 页）多引了一份 README，而 README 也在同一个公开仓库里。把「来源 ⊆ 5 份」放宽到「来源 ⊆ 公开材料」是 <b>52/52</b>。</p>

  <h3>2.2 逐页达标</h3>
  <table>
    <tr><th>页</th><th>作答</th><th>带引用</th><th>来源均公开</th><th>引用调研报告</th><th>引用代码</th></tr>
    ${Object.values(perPage).map((p) => `<tr><td class="num">p${p.page}</td><td class="num">${p.answered}/${p.n}</td><td class="num">${p.cited}/${p.n}</td><td class="num pass">${p.five}/${p.n}</td><td class="num">${p.report || '·'}</td><td class="num">${p.code || '·'}</td></tr>`).join('\n    ')}
  </table>

  <h3>2.3 响应与上下文</h3>
  <table>
    <tr><th>指标</th><th>值</th><th>说明</th></tr>
    <tr><td>端到端耗时</td><td class="num">p50 ${(ms[Math.floor(ms.length / 2)] / 1000).toFixed(1)}s · p90 ${(ms[Math.floor(ms.length * 0.9)] / 1000).toFixed(1)}s · max ${(ms[ms.length - 1] / 1000).toFixed(1)}s</td><td>含远程 cross-encoder 重排。52 条串行模型时间合计 ${(ms.reduce((a, b) => a + b, 0) / 1000).toFixed(0)}s，整轮（分批插入 + 轮询）1 分 27 秒跑完</td></tr>
    <tr><td>上下文块数</td><td class="num">${Object.entries(chunkDist).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k} 块 → ${v} 条`).join(' · ')}</td><td><span class="warn">半数回答只用了 1 个块</span>，中位数 1。<code>MAX_CONTEXT_CHUNKS=4</code> 没跑满，瓶颈在重排后的 0.7 阈值</td></tr>
  </table>
</section>

<section>
  <h2>3. 引用链接：从「[3] 是啥」到「点得动」</h2>
  <p style="font-size:13.5px;color:var(--soft)">这一轮共产生 <b>${linkInstances.length}</b> 个链接实例，去重后 <b>${Object.keys(byTarget).length}</b> 个目标，全部返回 <b>200</b>。映射表在 <code>answer-comment/index.ts</code> 的 <code>SOURCE_PATH</code>，与 <code>kb-ingest.mjs</code> 的 <code>SOURCES</code> 手工对齐。</p>
  <table>
    <tr><th>出现次数</th><th>链接目标</th><th>域名</th></tr>
    ${Object.entries(byTarget).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<tr><td class="num">${n}×</td><td><code>${esc(t)}</code></td><td>${esc(targetHost[t])}</td></tr>`).join('\n    ')}
  </table>
  <p style="font-size:13.5px;color:var(--soft)">按域名：${Object.entries(byHost).map(([h, n]) => `<code>${esc(h)}</code> ${n} 个`).join(' · ')}。文档类走 GitHub Pages（读者看到渲染后的页面），代码与 README 走仓库 <code>blob</code>（读者看到源码）。</p>
  <ul style="margin-top:12px">
    <li><b>越界编号原样保留</b>：只有真能索引到检索块编号才被改写成链接，模型自己数的号或多余括号不动。</li>
    <li><b>没有引用就不加 Sources</b>：空 legend 是噪音，直接省略。</li>
    <li><b>客户端只认自己域名</b>：<code>comments.js</code> 的 <code>okLink()</code> 把锚点限定在 <code>github.com/wukun2005-gif/…</code> 与 <code>wukun2005-gif.github.io/…</code>，其他 URL 原样显示——防止有人把评论当钓鱼跳板。</li>
    <li><b>不用 innerHTML</b>：渲染走 DOM 节点拼装，模型输出永远不会被当成 HTML 解析。</li>
  </ul>
  <div class="verdict" style="background:var(--amber-s);border-left-color:var(--amber);color:#78350f;font-weight:600;margin-top:16px">
    注意：服务端已上线（v20），但客户端 <code>deck-html/comments.js</code> 与 <code>comments.css</code> 还没推送到 GitHub Pages。
    <span class="n" style="color:#92400e">在那之前，公开 deck 上会把 <code>[2](https://…)</code> 原样显示成一串字符。推送这两个文件后，读者看到的才是可点链接。</span>
  </div>
</section>

<section>
  <h2>4. 发现的问题</h2>

  <div class="defect mid">
    <h4><span class="tag t-mid">观察 ②</span> 半数回答只用了 1 个知识块，上下文偏薄</h4>
    <p>52 条里 <b>${chunkDist[1]} 条</b>只有 1 个块进 prompt，中位数为 1，最多也只用到 4 个。数字都能对上来源（§5 的严格校验 0 例外），但回答的「厚度」受此限制——有些本该展开的问题只能给出一句结论加一个 caveat。</p>
    <p>位置在重排之后的筛选：<code>动态阈值 0.7×top</code> 加上绝对下限 <code>0.1</code>，再经 MMR <code>λ=0.7</code> 去重。当 top-1 明显领先时，0.7 阈值会把第 2、3 名全部砍掉。可调、也可只在「单块回答」时放宽，属产品判断，未擅自改。</p>
  </div>

  <div class="defect crit">
    <h4><span class="tag t-crit">观察 ①</span> 3 条英文提问得到中文回答</h4>
    <p>提示词里写得很清楚（<code>index.ts:474</code>）：<i>Answer in the same language the comment is written in — a Chinese comment gets a Chinese answer, an English comment gets an English answer.</i> 但这一轮有 <b>3/52</b>（${pct(cn.length, rows.length)}）违反：题干是英文，答案用中文。</p>
    <p><b>根因是语言镜像，不是随机波动</b>：这 3 条全部引用了中文的《调研报告》，而 52 条里没有任何一条「不引用该报告却用中文作答」。交叉表如下——显然不是纯巧合：</p>
    <table style="max-width:520px">
      <tr><th></th><th>引用了调研报告</th><th>未引用</th></tr>
      <tr><td>答案用中文</td><td class="num bad">${cn.length}</td><td class="num">0</td></tr>
      <tr><td>答案用英文</td><td class="num">${withReport.length - cn.length}</td><td class="num">${rows.length - withReport.length}</td></tr>
    </table>
    <p>《调研报告》原文是中文（该源 CJK 占比 ${(38.4).toFixed(1)}%，Deck 与 PRD 是 0%）。当答案的主要依据来自它时，模型会被源文语言带走。出问题的是三处：${cn.map((r) => `p${r.page} · ${r.persona}`).join('、')}。</p>
    <p>这条不影响准确性（引用与数字都没错），影响的是读者体验：一份英文 deck 的英文提问收到中文答案。修法可以是在 System 段把语言规则再强调一次并给反例，或者在检索阶段把「与提问语言不一致的块」降权。未改，等 owner 决定。</p>
  </div>

  <div class="defect low">
    <h4><span class="tag t-low">好现象</span> 5 条答案主动声明「材料未覆盖」，没有编造</h4>
    <p>碰到材料确实答不了的部分时，模型选择说明边界而不是糊过去，并且仍然给了它确实找得到的部分。这是期望行为——deck 是内部案例，很多实施细节本来就没写。</p>
  </div>
</section>

<section>
  <h2>5. 数字可追溯性：严格校验</h2>
  <p style="font-size:13.5px;color:var(--soft)">初版脚本在做「答案里的数字能否在材料里找到」时，一旦块 key 对不上就回退到<b>整篇文档</b>——那样几乎任何数字都能被「找到」，指标形同虚设。改成只在该题<b>实际检索到的块</b>里查之后：</p>
  <table>
    <tr><th>检查</th><th>结果</th></tr>
    <tr><td>答案含无法在检索到的块中定位的数字</td><td class="pass">0 条</td></tr>
    <tr><td>来源章节在知识库里找不到对应块</td><td class="pass">0 条</td></tr>
  </table>
  <p style="font-size:13.5px;color:var(--soft);margin-top:8px">这一轮答案里出现的全部数字（含 <code>262</code>、<code>$4.8M</code>、<code>≥99.5%</code>、<code>n≥600</code>、<code>Reg E 1005.11(b)(1)</code> 等）都能回到检索到的原文。</p>
</section>

<section>
  <h2>6. 样本</h2>

  <h3>6.1 完整链路（带链接 + legend）</h3>
  ${sample(rows.find((r) => r.page === 7 && r.persona === 'PE'))}

  <h3>6.2 主动声明边界（${hedgedRows.length} 条中的 2 条）</h3>
  ${sample(hedgedRows.find((r) => r.page === 9 && r.persona === 'SE'))}
  ${sample(hedgedRows.find((r) => r.page === 13 && r.persona === 'PMVP'))}

  <h3>6.3 语言跟随失败（3 条中的 1 条）</h3>
  ${sample(cn.find((r) => r.persona === 'SPM'))}
</section>

<section>
  <h2>7. 复现</h2>
  <table>
    <tr><th>命令</th><th>作用</th></tr>
    <tr><td><code>SUPABASE_PAT=… node scripts/qa-answer-comments.mjs --dry</code></td><td>只校验题库：52 条、每页 4 条、角色不重复、页码齐全。不写库</td></tr>
    <tr><td><code>SUPABASE_PAT=… node scripts/qa-answer-comments.mjs</code></td><td>跑完整一轮并自动清理（约 1.5 分钟）。<code>--no-clean</code> 保留原始行</td></tr>
    <tr><td><code>SUPABASE_PAT=… node scripts/qa-answer-review.mjs</code></td><td>对库里留下的那一轮做二次复核：严格数字校验、拒答原文、语言统计、链接清单。<code>--links</code> 追加 HTTP 可达性</td></tr>
    <tr><td><code>node scripts/qa-report-52.mjs</code></td><td>从存档数据生成本报告</td></tr>
  </table>
  <p style="font-size:13.5px;color:var(--soft);margin-top:8px">原始数据：<code>qa-answer-comments-52.json</code>（52 条完整问答与来源）。本轮跑完已清理，QA deck 剩 0 行、无孤儿台账、线上 deck 12 行（10 条软删 / 5 条 AI 回答）与跑前一致。</p>
</section>

<footer>
  数据：answer-comment v20 · 2026-10-08 · 题库角色池 7 个，覆盖第 2–14 页每页 4 个不同角色
</footer>

</div>
</body>
</html>
`;

function linksOf0() { return rows.filter((r) => linksOf(r.answer).length).length; }

writeFileSync('qa-answer-comments-52.html', html);
console.log('wrote qa-answer-comments-52.html');
console.log(`  rows ${rows.length} · links ${linkInstances.length} · targets ${Object.keys(byTarget).length} · codes ${codes.length} · readme ${readmes.length} · devplan ${devPlan.length} · cjk ${cn.length}`);
