# Deck Comments — 部署指南

代码已经写好，按下面 5 步把它接上你的 Supabase，全程不需要再写代码。

## 1. 建一个 Supabase 项目（5 分钟）

- 打开 https://supabase.com/dashboard → New project → 选 region（**新加坡 / 香港**对你来说延迟最低），记好数据库密码。
- 进项目后左侧 **Project Settings → API Keys**，先记下两样（步骤 3 要用）：
  - `Project URL` — 例如 `https://xxxxx.supabase.co`
  - 一个**客户端用的公开 key**。新版界面叫 **Publishable key**（`sb_publishable_...`），老版叫 **anon / public**（`eyJ...` 开头的一长串）——**两个都能用**，任选其一。
    ⚠️ 千万别拿 **Secret key** / `service_role`：那个能绕过所有权限，放进网页等于把库的钥匙公开。

## 2. 建表 + 装 RLS + 开实时（1 分钟）

- 左侧 **SQL Editor → New query**
- 把 `supabase/schema.sql` 整个文件粘贴进去 → 点 **Run**
- 跑完后到 **Database → Tables** 应能看到 `deck_comments` 和 `deck_comment_notifications`；**Database → Publications → supabase_realtime** 应包含 `deck_comments`
- 这个文件可以重复跑。如果你之前已经跑过旧版（通知日志只按 `comment_id` 建主键），再跑一次就会自动升级成 `(comment_id, kind)` 复合主键——owner 通知和回复通知是两封独立邮件，需要这个升级，否则第二条会被主键冲突挡掉。
- 文件最后一句 `notify pgrst, 'reload schema';` 是必须的：PostgREST 会缓存表结构，新建的视图不刷新缓存就对 API 不可见（表现是评论列表一直空、或者控制台报 refresh 失败）。加过视图之后单独再跑一次这一句也能立刻生效。

## 3. 填前端配置（30 秒）

打开 `deck-html/comments.config.js`，把刚才记的两个值填进去：

```js
window.DECK_COMMENT_CONFIG = {
  supabaseUrl: 'https://xxxxx.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi...',
  deckId: 'mail-autopilot-fs',
  deckUrl: 'https://wukun2005-gif.github.io/mailAutopilotForFS/deck-html/',
  pollMs: 8000
};
```

`deckUrl` 是邮件里"Open the deck"按钮的回链，请保持现在的 GitHub Pages 地址（部署后想换也可以，改这里就行）。其他三项保持现状。

保存后刷新一下页面。右上角出现 **Comments** 按钮就说明脚本加载了；**按钮里的数字是当前这一页的评论条数**，所以空白页显示 `0` 是正常的 —— 发一条评论它就变 `1`，翻到别的页仍显示 `0`。要确认真的接上了云，换个浏览器或无痕窗口打开同一地址，看能不能看到你刚发的那条。

### 在那个页面刷新？（别用 file://）

评论脚本是 ES module，**直接双击 `index.html`（`file://` 打开）会被浏览器的 CORS 规则拦掉**：右下角的 Comments 按钮根本不会出现，而 deck 本身显示完全正常，很容易误判成"功能没做出来"。必须用 http(s) 打开，两条路：

| 场景 | 怎么做 | 地址 |
|---|---|---|
| **本地预览**（改文案、调样式、试功能） | 在项目根跑 **`npm run deck`** | **http://127.0.0.1:8765/index.html**（会自动打开浏览器；端口被占会自动换一个） |
| **线上**（给客户看） | 改动 push 到 GitHub，等 GitHub Pages 重建（通常 1–2 分钟） | **https://wukun2005-gif.github.io/mailAutopilotForFS/deck-html/** |

`npm run deck` 就是启动 `scripts/serve-deck.mjs`（零依赖的静态服务），Ctrl-C 就停。不加浏览器可以 `npm run deck -- --no-open`。

> 以前文档里写的 `cd deck-html && python3 -m http.server 8765` 仍然有效，只是要记端口和目录；`npm run deck` 是它的省事版。

> 没填 Supabase 配置时面板底部显示 *Local only — comments are not shared yet*，所有评论只存在自己浏览器里，不会传给 Supabase。填好配置再打开页面即可切到云模式。

### 本地测试不许碰线上 deck（2026-10-09 定，两道闸）

页面本身不带评论：`comments.config.js` 里写着**绝对的** Supabase 地址和一个**写死的 `deckId`**，浏览器打开后去那张表取。所以**配置里写哪个 deck，你在本地发的评论就落在哪个 deck** —— 而公开页面用的正是线上那一个。踩过一次：只为本地看图，把 52 条测试问答写进了 `mail-autopilot-fs`，公开页立刻全显示了。**这是两份 HTML、一份数据**：本地服务工作区那份、线上服务仓库那份，但两者都读同一张表。

**闸一 · 读：本地服务改写 `deckId`，磁盘文件不动。** `serve-deck.mjs` 把 `comments.config.js` 发出去之前换掉 `deckId`（响应头带 `X-Deck-Override` 可确认）：

| 起法 | 这个本地页面读的 deck |
|---|---|
| `npm run deck`（默认） | `mail-autopilot-fs-local` —— 本地测试的落脚点，随便造 |
| `... serve-deck.mjs deck-html 8765 --deck <id>` | 你指定的任意 deck |
| `... serve-deck.mjs deck-html 8765 --live` | `mail-autopilot-fs` —— 线上那个，会打很响的横幅 |

**`deck-html/comments.config.js` 一个字都不改**（`git status` 干净），所以这个机制不可能被提交、也不可能上线；它只决定"这个本地页面在跟哪个 deck 说话"。

**闸二 · 写：往线上 deck 写入必须显式 `--live`。** `deck-comments-archive.mjs` 的 `restore` / `clear`、`seed-qa-on-deck.mjs`、`regenerate-seeded-answers.mjs` 都加了这道闸；不加就拒绝，并告诉你改用 `--into mail-autopilot-fs-local`。`--dry` 与 `--remove` 例外（前者不写，后者是收回）。

闸门跑在**解析凭据之前**（`PAT` 改成首次用到才取）。没配 `SUPABASE_PAT` 时，先看到的也是那句拒绝，而不是 `no SUPABASE_PAT` —— 随手敲下命令的人应该最先知道自己在碰线上。

自证——三道闸应该全部拒绝，且第一条消息就是拒绝语：

```bash
env -u SUPABASE_PAT node scripts/deck-comments-archive.mjs clear mail-autopilot-fs --yes   # 退出码 1
env -u SUPABASE_PAT node scripts/seed-qa-on-deck.mjs                                      # 退出码 2
env -u SUPABASE_PAT node scripts/regenerate-seeded-answers.mjs --cjk                      # 退出码 1
```

闸一也可以自证——别看配置，看浏览器**实际发出的那条请求**（`scripts/probe-data-source.mjs`）：两侧都是 `GET .../rest/v1/deck_comments_public?...&deck_id=eq.<deckId>`，本地 `/` 里是 `mail-autopilot-fs-local`，GitHub Pages 上那份是 `mail-autopilot-fs`。同一个 Supabase 项目、不同的 `deck_id` 过滤条件 —— 这就是"两份 HTML、一份数据"的确切含义。

**约定**：`mail-autopilot-fs` = **线上**，只放确认要公开的内容；`mail-autopilot-fs-local` = **本地测试的家**；`mail-autopilot-fs-qa` 是 QA 脚本的临时 deck（每轮开头整表清空），别往里放要留的东西。

## 4. 配邮件通道（5 分钟）

平台：Supabase Edge Functions（用你的 SMTP 邮箱经端口 **465 + SSL** 发信。587/STARTTLS 在这个环境里不可靠）。

### 4a. 先存 Secrets（不需要先建 function，可以随时加）

左侧栏点 **Edge Functions**，页面顶部有两个标签：**Functions** 和 **Secrets**。点 **Secrets**。

页面上有一组 **Key / Value** 输入框（新版支持一次粘贴多条），填完点 **Save**：

| Key | Value（按你实际邮箱替换） |
|---|---|
| `SMTP_HOST` | QQ：`smtp.qq.com` ／ Gmail：`smtp.gmail.com` ／ 163：`smtp.163.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | 你的邮箱完整地址，例如 `wukun2005@gmail.com` |
| `SMTP_PASS` | **授权码 / 应用专用密码**（不是登录密码）。QQ/163 在邮箱网页设置的「账户 → POP3/SMTP服务」里生成；Gmail 在 https://myaccount.google.com/apppasswords 生成（需先开两步验证） |
| `MAIL_FROM` | 和 `SMTP_USER` 填同一个地址（多数邮箱要求发件人=登录账号） |
| `DECK_URL` | `https://wukun2005-gif.github.io/mailAutopilotForFS/deck-html/`（末尾的 `/` 必须有） |
| `OWNER_EMAIL` | **你的邮箱** —— 任何人留下任何评论都往这里发一封通知 |
| `WEBHOOK_SECRET` | 自己随手编一串（比如 20 位随机字符），下一步配 webhook 时要填同一个值 |

存完确认列表里有 8 条。**Secrets 可以随时改，改完不用重新部署函数**，函数下次被调用时就读到新值。

> 已知可用：QQ 邮箱 / Gmail / 163。**企业邮箱 / Exchange 常常封 465 出站**，可以用 `openssl s_client -connect smtp.xx.com:465 -crlf` 先试一下能不能连上。

### 4b. 部署通知函数（在 Dashboard 里粘贴代码，不用装 CLI）

1. 左侧 **Edge Functions** → 顶部标签切到 **Functions**
2. 点右上角 **Deploy a new function** 按钮
3. 弹出的选项里选 **Via Editor**（不要选 "Via AI Assistant"）
4. 选模板那一步随便选 **Hello World** 就行 —— 下一步会把里面的代码整个删掉
5. 进入编辑器后：
   - 如果有 **Name** 输入框，填 `notify-reply`（必须一字不差，webhook 地址里要用这个名字）
   - **全选编辑器里的示例代码并删除**，然后把 `supabase/functions/notify-reply/index.ts` 的全部内容粘进去
6. 点编辑器下方的 **Deploy function**，等 10–30 秒，出现成功提示即完成
7. 回到 Functions 列表 → 点 **notify-reply** 进详情页 → 页面上能看到它的 URL：

   ```
   https://ifiqhyzcklwueqsijtnq.supabase.co/functions/v1/notify-reply
   ```

   把这段 URL 复制下来，第 5 步要用。（项目 ref 换成你自己的即可，格式就是这个样子。）

> 以后要改函数代码：点开函数 → 改 → 点 **Deploy updates**（会覆盖当前部署，Dashboard 编辑器没有版本回滚）。
>
> 如果 webhook 打过来返回 401：在函数详情页/设置里找 **Enforce JWT Verification** 开关（部分界面版本有这个）并关掉。新版界面默认不强制校验 JWT，函数自己用 `x-webhook-secret` 把关。

## 5. Webhook —— 已配置完成 ✅（2026-10-08）

原本要在 Dashboard 里点一堆表单，实际改成**数据库触发器**实现（等价、更稳、可复现）。做过的事：

1. 启用扩展 `pg_net`
2. 建函数 `public.deck_comment_notify()`：每次 `deck_comments` 插入新行，就用 `net.http_post` 把整行记录 POST 给你的通知函数
3. 建触发器 `deck_comment_notify`（AFTER INSERT，逐行）

完整 SQL 留在 **`supabase/webhook-trigger.sql`**（已脱敏，占位符需替换），换项目或需要重建时照它跑一遍即可。

### 两个必须知道的坑

1. **Supabase 对 Edge Function 开启了 JWT 校验**，所以触发器的请求头里必须带 `Authorization: Bearer <publishable/anon key>`。只带 `x-webhook-secret` 会被网关直接挡掉，报 `UNAUTHORIZED_NO_AUTH_HEADER` —— 函数根本不会被调用。这是官方文档没写、但一定会踩的坑。
2. **`WEBHOOK_SECRET` 的值同时存在于两处**：Edge Function 的 Secrets，和触发器函数的定义里。**改了一处必须同步改另一处**，否则函数会返回 `unauthorized`。Dashboard 的 Secrets 页面只显示名字、不显示值，所以别随手改它。

### 怎么确认它在工作

- **Dashboard → Edge Functions → notify-reply → Logs**：每次评论都会有一次调用记录，200 就是成功。
- 或在 SQL Editor 里跑：
  ```sql
  select status_code, left(content, 200) from net._http_response order by id desc limit 5;
  select kind, status, error from deck_comment_notifications order by sent_at desc limit 5;
  ```
  第二条是邮件发送账本：`sent` 表示真的发出去了，`failed` 后面会带 SMTP 的报错原文。

## 6. AI 自动回答（已配置完成 ✅ 2026-10-08）

观众在 deck 上留的**顶层评论**，deck 会自己用百炼（Bailian）生成一条回答挂在该评论下，署名 `Deck AI`，带 `AUTO` 徽章和免责说明。回复不会触发自动回答（避免 AI 自问自答）。

> **线上状态（2026-10-08 复核）**：检索已迁到 SiliconFlow（`bge-m3`），`SILICONFLOW_BASE_URL` / `SILICONFLOW_API_KEY` / `SILICONFLOW_RERANK_ENABLED=true` 三个 Secret 已写入，`answer-comment` 已通过 Management API 部署为 **version 19**（`deck-admin` = **version 7**）。端到端实测：一条提问走完「embedding → 混合检索 → 重排 → 生成」共 **7.7 秒**（重排关闭时 5.9 秒），返回 3–4 个上下文块、0 个 fallback 错误，回答带引用且语言跟随提问，响应里 `rerank` 字段为 `"remote"`。库内 **722 块 / 722 条带向量**。

### 组成

| 部件 | 说明 |
|---|---|
| 知识库 | `kb_sources` / `kb_chunks`：**7 个来源**切成 **722 块**（deck 45 · PRD 英文 153 · 调研报告 125 · backlog 26 · 原型 dev plan 66 · README 6 · 原型源码 301），每块 1024 维向量（SiliconFlow `BAAI/bge-m3`）+ 中文 bigram 关键词。**PRD 中文版按要求排除**；原型源码只取 `src/runtime` / `src/mocks` / `src/demo` / `src/lib` / `shared` / `server`（`src/screens` 的 JSX 不收，屏规格在 dev plan §07 里已有）。文档自身的台账章节（PRD 的 Review Change Log、报告的版本记录 / 完整参考资料 / 勘误）不收——它们答不了读者的问题，却会被检索命中 |
| 检索 | Postgres 函数 `kb_search`：向量（pgvector + HNSW）+ 关键词（tsvector）双路召回，**RRF k=60** 融合；参数照搬 patentExaminator |
| 重排 | 两级链：**远程 cross-encoder**（SiliconFlow `BAAI/bge-reranker-v2-m3`，按 patentExaminator `toolExecutor.ts:401-476` 接入）→ **五信号启发式**（`reranker.ts` 第三级，兜底）。**已开启**（`SILICONFLOW_RERANK_ENABLED=true`，owner 决定，见下方「关于重排」）。patentExaminator 的第二级是本地 ONNX 模型，Edge 运行时载不了，所以链路只有两级 |
| 回答函数 | `answer-comment`：混合检索 → 重排（见上）→ 动态阈值 0.7 + 绝对下限 0.1 → MMR λ=0.7 → 带引用规则的 prompt → 生成 |
| 回答语言 | **跟随提问语言**：中文提问得中文回答、英文提问得英文回答；产品术语、条款号、页面标题保持英文原样（否则读者无从对照） |
| 触发 | 触发器 `deck_comment_answer`（AFTER INSERT，仅顶层评论）；前端提交后也会直接调用一次，触发器作兜底 |
| 幂等 | `deck_ai_answers` 表按评论记状态，重放不会重复回答 |
| Owner 面板 | `deck-admin` 函数 + deck 右上角齿轮 |

### 怎么进 owner 模式

在地址后面加 `?owner=true` 打开即可：

```
https://wukun2005-gif.github.io/mailAutopilotForFS/deck-html/?owner=true
```

**owner 模式就是这一个 URL 参数，没有别的状态** —— 没有 localStorage、不会粘住。参数在，齿轮就在；参数去掉，齿轮立刻消失。参数**故意留在地址栏里不抹掉**：这样刷新不会掉身份，而且"为什么这里有齿轮"看一眼地址栏就知道。（代价是截图会带上这个参数；deck 本来就是公开的，owner 自己删掉即可。）

**怎么退出**：把 `?owner=true` 从地址栏删掉就行。面板里的 **Exit owner mode** 按钮做的也是同一件事（只删这个参数，保留 `?p=` / `?c=`，所以不会丢掉当前页）。

**`?config=true` 已作废**：会被静默忽略并抹掉，旧版本写进浏览器的 localStorage 标记在每次加载时都会主动删除 —— 所以以前中过招的浏览器不会再冒出齿轮。

> ⚠️ **为什么不粘了**：旧版把标记写进 localStorage 并按站点记着，一次 `?config=true` 就永久生效，唯一的出口是面板**里面**那个按钮 —— 也就是"要先打开齿轮，才能找到去掉齿轮的控件"。在那之前该站点下任何页面（包括裸的 `/index.html`）都会显示齿轮，看起来就是"齿轮默认出现"的 bug。改成 URL 参数后这一类问题从根上没有了，并有回归检查兜着。

> ⚠️ **这是"藏起来"，不是"锁起来"**：知道这个参数的人就能打开面板、删除评论、改设置。这是 owner 明确选定的方式（比密钥省事）。要收回就两步：把 `deck-admin` 的密钥校验加回来（密钥仍在项目里，Secrets 的 `OWNER_KEY`），并给删除加同样的门。

### 计数与可见性：徽章数字必须等于看得到的条数（2026-10-08 修）

**报上来的 bug**：徽章显示还有 4 条，页面上一条都找不到。

**根因**：可见性规则在代码里写了两遍，而两遍不一致。`renderBadges` 统计的是**所有** `deleted=false` 的行；`renderList` 只走"活着的顶层评论 + 挂在它下面的回复"。删掉一条顶层评论时只标记了它自己，它的回复仍是 `deleted=false` —— 于是被**统计**、但**没有父级可以挂**，永远不渲染。徽章说 4，列表说 0。

**修法**（两条，缺一不可）：

1. **把规则收敛成一个函数** `visibleOn(pageIdx)`，徽章、列表、以及句子高亮（`highlight()`）**全部**从它取数。数字与列表从构造上不可能再对不上。
2. **删顶层评论时连带软删回复** —— 走 `patchWhere('parent_id', id, {deleted:true})`，和 `patchRow` 一样经由 `deck_comments_public` 视图（anon 对原表没有 SELECT，而 PostgREST 在 UPDATE 前会查 SELECT）。确认框本来就承诺了"and any replies under it"，现在数据真的跟着走了。

> 第 2 条是**行为变更**：以前回复留在库里（`deleted=false`，不可见但会被统计）。历史遗留的孤儿回复已按同一条规则清掉。没有"取消删除"的界面，所以连带删除不会造成"父级恢复、子级消失"的错位。

### 齿轮的位置：归属 Comments 按钮，不是右边缘（2026-10-08 修）

**报上来的 bug**：齿轮压在打开后的评论面板标题上（截图里盖住了 "Comments" 这个词）。

**根因**：`#cmtgear` 原本是 `position:fixed; right:268px; z-index:941`，而 `#cmtpanel` 是 `right:0; width:360px; z-index:940` —— 268px 落在面板的 360px 里，且 z-index 更高，所以画在面板**自己的 header 上面**。

**修法**：齿轮改成在 `syncBtnToTheme()` 里按 **Comments 按钮的右边缘**定位（`gear.left = btn.right + 6`），也就是它注释里一直声称的"坐在 Comments 旁边"。CSS 里的 `right` 换成 `left` 兜底值，并注明**不能**用 `right`。因为齿轮是被懒加载的 owner 模块后追加的，mount 之后补调一次 `syncBtnToTheme()`；之后 resize / 换主题 / body class 变化都会带上它。实测（1440px）：Light 196–274 · Comments 280–403 · ⚙ 409–443，面板 1080–1440，无重叠。

### 在面板里能做什么

- **删除任何评论**：owner 模式下每条评论都有 Delete（不只是自己发的）。删的是**软删除**（`deleted=true`，读者立刻看不到）。删**顶层**评论会**连带软删除它下面的回复** —— 见下面「计数与可见性」。确认框会写明作者是谁、以及回复会一起走。
- **开关 AI 自动回答**（下一次评论立即生效，不用重新部署）
- **切换模型**：下拉里是实测可用的 10 个免费模型，默认 `deepseek-v4-flash-0731`（约 3 秒）
- 查看知识库规模、最近回答的状态/模型/耗时

> **删除为什么是"软"的、且不放在 Edge Function 里**：软删除走的是 `deck_comments_public` 视图上的 UPDATE，和"Resolve"按钮用的是同一条策略（见 `schema.sql`），所以没有新增任何暴露面，也不会真的丢数据。反过来，如果在 `deck-admin` 里加一个用 service role 的**硬删除**，任何读过 JS 的人都能清空整个 deck —— 那是比它解决的问题大得多的洞。真要硬删除，先把 `OWNER_KEY` 校验加回来。

> 模型可用性（2026-10-08 实测，需带 `enable_thinking: false`）：`qwen3.8-2.4t-a95b` / `glm-5.3` / `qwen-mt-uni` 调 `/chat/completions` 返回 400，`qwen3.8-omni-flash-realtime` 是实时接口、返回空 —— 这四个没进链路。其余 10 个都可用，多数约 3 秒。

### 维护

- **文档更新后重建知识库**：`SUPABASE_PAT=<token> SILICONFLOW_API_KEY=<key> node scripts/kb-ingest.mjs`（幂等，按来源替换；`--dry` 只看切块结果，不调 API）。embedding 走 SiliconFlow `BAAI/bge-m3`，单批 **20 条**。
- **改分块逻辑后先自检**：`node scripts/kb-ingest.mjs --dry --audit --show` 会统计每类噪声（HTML 注释尾巴、裸标签、CSS 声明、SVG 属性、内部台账章节、过短块）并打印命中文本；`--dry --headings` 列出每个来源的全部小节标题，用来判断哪些该排除。两种模式都不联网、不写库。
- **三组检索对照**：`SUPABASE_PAT=... SILICONFLOW_API_KEY=... node scripts/kb-retrieval-compare.mjs`（加 `--only A|B|C` 只跑一组）。A=中文题、B=demo app 题、C=英文基线；每题打印融合 top-3、cross-encoder 单独排序 top-3、以及两者 0.6/0.4 混合 top-3，最后给 hit@3 与非回归合计。
- **网络前提**：本机的出网要经过代理（`HTTPS_PROXY`），而 Node 的 `fetch` 不读这个变量（curl 和 Python 都读）。三个脚本都 `import './net-proxy.mjs'` 装上 `ProxyAgent` —— 不装就会在第一次 SQL 调用时报 `UND_ERR_CONNECT_TIMEOUT`，而切块已经跑完了，看起来像代码 bug。
- **检索 provider 与 patentExaminator 保持一致**：embedding `BAAI/bge-m3`、rerank `BAAI/bge-reranker-v2-m3`，同为 SiliconFlow 账号（`https://api.siliconflow.cn/v1`）。`bge-m3` 是 1024 维，与 `kb_chunks.embedding vector(1024)` 一致，所以**换模型不用改表**；但换模型必须**整库重灌**，否则新旧向量不在同一空间、检索会静默失准。
- **Edge Function 需要新增的 Secrets**：`SILICONFLOW_BASE_URL`（`https://api.siliconflow.cn/v1`）与 `SILICONFLOW_API_KEY`（检索用，和 patentExaminator 同一把）；`BAILIAN_*` 仍用于生成，不用动。**两个 Secret 必须在部署 `answer-comment` 之前存在**，否则新函数读不到 key、embedding 直接失败。
- **部署 `answer-comment`**：用 `node scripts/deploy-function.mjs <slug> [--dry]`（先 `--dry` 看差异）。它内部就是 `PATCH /v1/projects/<ref>/functions/<slug>`，body `{slug, name, verify_jwt, body}`，`body` 是 `index.ts` 全文。纯 Management API，不需要装 CLI。脚本会打印**部署前版本 → 部署后版本**，并在部署后**把源码读回来跟本地文件比**（Management API 读回时文件头两个字符会变成 U+FFFD，所以比较时忽略开头那两个字符 —— 别把它当 BOM，也别把 `/body` 当逐字节权威）。当前线上 `answer-comment` 为 **version 23**、`page-view` **version 1**、`deck-admin` **version 7**。引用链接指向 GitHub Pages 渲染版（github.com 的 HTML 文件页永远显示源码），README 与代码仍指 github.com。
- **改 prompt 前后跑一次 `check-answer-prompt.mjs`**：`node scripts/check-answer-prompt.mjs`。它用 esbuild 把真实的 `index.ts` 转译出来、stub 一个 `globalThis.Deno`，直接断言 `commentScript()` 与 `buildMessages()` 的产物 —— 分三节：语言判定边界（含"英文产品名多于汉字"的陷阱）、引用/诚实性规则与材质内联、以及**数字规则**（第 3 节）。**不联网、不写库**，所以改 prompt 措辞时它是唯一能立刻给反馈的东西。
- **数字必须照抄素材，不许换算**（2026-10-09，v23）：素材中英混排，同一个数字英文写 `50,000 emails a month`、中文写 `5万`。强制英文作答时模型对中文那个数做了一次单位换算，把 `50,000` 写成了 `60k/month`。修法是在 System 的 Rules 里加一条「Copy figures straight out of the material… Never convert units or recompute」。**验证方式**：`SUPABASE_PAT=... node scripts/probe-answer-variance.mjs --pick 3 --n 3 --expect 50,000 --reject 60k`（`--pick N` 取题库第 N 条，避免手抄题目时把 en-dash 打成连字符）。修复前后实测：v21 归档 `qa-answer-comments-52-v21.json` 里同一条写的是 `60k/month`，v23 下 3/3 都是 `50,000`、0/3 出现 `60k`；另抽查 `--pick 2`（262）与 `--pick 5`（22%）也 PASS，且答案**仍在做合法算术**（`600K × 15% = 90K × $8 ≈ $720K`），说明这条规则没有误伤推导。
- **抽测单条检索**：`SUPABASE_PAT=... SILICONFLOW_API_KEY=... node scripts/kb-verify.mjs "<问题>"`。
- **确认重排真的开着**：`answer-comment` 的响应里有 `rerank` 字段（`"remote"` = 远程 cross-encoder 生效，`"heuristic"` = 已降级）。远程那级失败是静默降级的，所以别只看开关，要看这个字段。
- **owner 门禁回归检查**：`node scripts/check-owner-gate.mjs`（自带 deck 服务，起在 8798 端口，不干扰你正在跑的 8765）。9 个场景：开/关、**不粘性**、别名取值、无法识别取值、旧 `?config` 已作废且旧标记被清。改 `comments.js` 的 owner 分支后跑它。
- **引用链接回归检查**：`node scripts/check-citations.mjs`（自带 deck 服务，起在 **8799**）。它拦掉 Supabase 的 REST 调用喂一份固定数据，所以不连库、不产生真流量；13 条断言覆盖"引用变成锚点 / 只认自己域名 / 别人的链接保持纯文本 / 没链接的 [n] 原样"。
- **评论面板回归检查**：`node scripts/check-comments-ui.mjs`（自带 deck 服务，起在 **8800**）。同样拦接口、不连库；28 条断言分五节 —— **徽章数字 == 渲染出的条数**（含"孤儿回复不计数"与"删顶层评论会连带删回复"）、**owner 模式下齿轮与面板不重叠、紧贴 Comments 按钮**、以及**在线人数那一行的名字缩写**（第 5 节用 `new Function` 从真实 `comments.js` 里抠出 `shortName()` / `presenceLabel()` 直接断言，外加两条接线断言：`presenceLabel(peopleStates())` 确实在用、旧的 `peopleHere` 已删干净）。改 `comments.js` 的计数/定位/删除/presence 分支后跑它。
- **全量问答 QA（52 题）**：`SUPABASE_PAT=... node scripts/qa-answer-comments.mjs`。题库在 `scripts/qa-deck-questions.mjs`（13 页 × 4 题，角色池 7 个、每页 4 个不重复）。`--dry` 只校验题库不写库。它写 `deck_id='mail-autopilot-fs-qa'`（**不碰线上 deck**），每条评论的 `email` 填 `OWNER_EMAIL` 以规避 `notify-reply`（否则一轮 52 封邮件），跑完硬删。约 1.5 分钟。
- **QA 二次复核**：`SUPABASE_PAT=... node scripts/qa-answer-review.mjs [--links]`。对库里留下的那一轮做严格复核：数字必须在**实际检索到的块**里找到（`qa-answer-comments.mjs` 的宽松版在块 key 对不上时会回退整篇文档，那个检查几乎无法证伪）、拒答原文、语言统计、链接清单；`--links` 追加 HTTP 可达性。注意两点：
  - 它读的是**库里现存的** QA deck，而 `qa-answer-comments.mjs` 跑完会硬删 —— 想复核就先加 **`--no-clean`**，复核完再手工清。
  - 它按**问题文本**而不是 `created_at` 关联问答——同一批插入的 `created_at` 会并列，按时间排序会把页码全部错位。
- **重新生成本轮报告**：`node scripts/qa-report-52.mjs` → `qa-answer-comments-52.html`，数据源 `qa-answer-comments-52.json`。
- **把 QA 的 52 条摆到 deck 面板上**：`SUPABASE_PAT=... node scripts/seed-qa-on-deck.mjs`（`--dry` 空跑，`--remove` 撤销）。它把 `qa-answer-comments-52.json` 里那一轮的真实问答**原样回填**到 `deck_id='mail-autopilot-fs'`（第 2–14 页各 4 题），不再调模型。要点：
  - 回填时必须临时关掉 `deck_comment_answer` 与 `deck_comment_notify`，否则前者会**再生成一份答案**、后者会**发 52 封邮件**。两者与 INSERT 同处**一个事务**（已验证 Management API 的多语句批量是单事务：ROLLBACK 能撤销先前的 CREATE），所以失败会整体回滚，绝不会把触发器留在关闭状态。脚本末尾会读 `pg_trigger.tgenabled` 复核。
  - 提问行打 `client_id='qa-seed'`，这是 `--remove` 的唯一抓手，**不会碰到你自己的评论**。
  - 提问行 `email` 填 `OWNER_EMAIL`：即使触发器误开，`notify-reply` 也不会给自己发信。
  - 同时回填 `deck_ai_answers`（52 行，`comment_id` = 提问那行的 id），否则 owner 面板的「最近回答」看不到这批。
- **让部署好的函数重答某几条种子题**：`SUPABASE_PAT=... node scripts/regenerate-seeded-answers.mjs --cjk`（或 `--all`、`--page 3`，加 `--dry` 只看清单）。种子回填是**原样重放**历史答案，所以 prompt 的修复在它身上看不出来 —— 这个脚本只删掉选中的那几行问题、再插回去，由**已部署**的函数重新作答。要点：
  - 只选 `client_id='qa-seed'` 的行，**绝不碰你自己的评论**；答案与台账随外键级联删除，不会有孤儿。
  - 重插时 `email=OWNER_EMAIL`，`notify-reply` 不会给自己发信（实测跑完 60 分钟内 `deck_comment_notifications` 新增 0 条）。
  - 语言判定前必须先**剥掉 `Sources:` 段与所有链接目标**：答案里内嵌好几个完整 URL，那些长拉丁串足以让一条纯中文答案看起来是拉丁占优，`--cjk` 会因此漏掉 2/3。这是踩过的坑，`proseOf()` 里处理了。
  - `deck_ai_answers.comment_id` 指向的是**问题**那行（不是答案行）。想按答案 join 会得到 0 行 —— 第一次就这样误判过一次。
- **清空页面 / 把评论收起来再放回去**：`SUPABASE_PAT=... node scripts/deck-comments-archive.mjs <子命令>`。四个子命令：`snapshot <deck> [out.json]`、`restore <file> [--into <deck>] [--only <client_id>] [--remap] [--live]`、`verify <file> [--into <deck>] [--only <client_id>]`、`clear <deck> [--dry] [--yes] [--live]`。
  - **写给线上 deck 必须带 `--live`**，否则直接拒绝（见上面「两道闸」）。只想自己看就 `--into mail-autopilot-fs-local`。
  - **`--only <client_id>`**：`restore <file> --only qa-seed` 取匹配的行**连同挂在它下面的一切**。这一步的「连同」是关键 —— 答复是 `client_id='deck-ai'` 的独立行，不做后代遍历就会只还原 52 个问题、一个答案都没有。台账跟着自己的评论走。
  - **`--remap`**：`deck_comments.id` 全表唯一。把同一份存档往**另一个 deck** 放时用它换新 id，否则以后按原 id 还原到网上会撞主键。
  - **顺序是先快照、再删除，且快照行数会和实际行数对账**，对不上就拒绝删。`clear` 不给 `--yes` 就不删。存盘文件名默认带时间戳（`deck-comments-<deck>-<ts>.json`），里面是**全部 16 列 + 该 deck 的全部台账行**，还记下产出它的 `answer-comment` 版本 —— 没有版本的存档以后没法对照。
  - **`restore` 默认沿用原 id**（最忠实，台账的 `comment_id` 不用改写）；`--remap` 生成新 id 并改写 `parent_id` 与台账外键，用于把一个存档克隆到隔离 deck 做演练。还原同理只写一个 deck，`--into` 指定目标。
  - **为什么不能只靠 `qa-answer-comments-52.json`**：那份只有 52 条 QA。手工敲的评论、它们的回复、以及 `deck_ai_answers` 全都不在里面 —— 而台账是**外键级联删除**的，问题行一删就没了。所以清空之前必须先快照。
  - 两条外键都是 `ON DELETE CASCADE`（`deck_comments.parent_id` 与 `deck_ai_answers.comment_id` 各一条），所以删顶层评论会带走回复与台账，不会有孤儿。`parent_id` 是**普通外键、不可延迟**，所以还原必须**按深度排序、先插根再插回复**（脚本里按快照的 parent 链算深度）。
  - 值是通过 `jsonb_to_recordset` 传进去的，不是拼字符串字面量 —— 答案里有引号、换行和 markdown，手工转义迟早会插进去半批。
  - **`verify` 是这套东西的底线**：它把存档和库里现存的行都化成规范元组做多重集比对（页号 / 作者 / client_id / resolved / deleted / 正文 / 父正文 + 台账全字段），不一致就非零退出。
  - **实战记录（2026-10-08）**：`clear mail-autopilot-fs --yes` 删掉 116 行评论 + 57 行台账，存档 `deck-comments-mail-autopilot-fs-2026-10-08T14-36-56-077Z.json`（146 KB，58 顶层 + 58 回复，覆盖 1–14 页）。删前删后各验一次：删前用**另一份**快照往返（隔离 deck）确认树形与答案逐行一致，删后又用**这个存档本身**还原到隔离 deck 再 `verify`，两次都是 `YES ✓`；公开视图 `deck_comments_public` 里该 deck 从 116 行变 0 行。想再看就在原 deck 上跑 `restore <那个文件>`。
  - 表里还留着一个 `__probe__` deck（1 行，`author='probe'`，我之前探针留下的），不属于任何页面、不会被渲染。没动它。
  - **回放记录**：只把 QA 那批摆回页面的命令是 `restore <存档> --only qa-seed`，得 104 行（52 问 + 52 答）+ 52 台账，13 页每页 8 条；跑完 `verify <存档> --only qa-seed` 应报 `YES ✓` 两行。那 6 条手工测试评论与 1 条 cite-probe **不在**这个选择里 —— 要连它们一起就把 `--only` 去掉。
- **看页面长什么样**：`node scripts/shot-deck-page.mjs [url] [slideIndex] [out.png] [--closed]`。默认打本地 `8765` 的第 2 页、开面板、存到 `_shots/`；`--closed` 拍不打开面板的样子。它复用了探针那三件事（等 REST 响应落地再采样、用 `body.cmt-open` 判面板、点掉首访的法律告知遮罩），所以拍出来就是人眼看到的样子。`_shots/` 已在 `.gitignore` 里。
- **在线人数那一行的写法**：有人填了名字时显示**首字母列表**（`Dana Whitfield` → `DW`，中文名保留首字，最多 4 个，其余并成 `+N`）；全部匿名时**保持原样**（`3 people on this page` / `You are the only one here`）。逻辑是 `comments.js` 里两个纯函数 `shortName()` / `presenceLabel()`，`check-comments-ui.mjs` 第 5 节直接从源码里取出来断言。它只对**已署名**的访客显示缩写——presence 频道是公开的，把陌生人的全名广播给同页其他人不合适。
- **"本地怎么看不到评论？"**：`node scripts/probe-local-comments.mjs [url] [页码索引...]`，默认探 1 / 10 / 14 页。它连你正在跑的 8765（只读、不发评论），报出每页的徽章数字与实际渲染条数。三个容易踩的坑，脚本里都处理了：
  - **面板是按页过滤的**，且 `pageIdx` **只由 deck 的 `window.show(n)` 驱动**（`comments.js` 包装了它）。deck 没有滚动翻页，所以「滚动到某页」测到的永远是第 1 页——要翻页就调 `window.show(n)` 或按方向键，**不能靠 `scrollIntoView`**。
  - **面板不是 `display:none` 关闭的**，而是靠 `body.cmt-open` + transform 移出屏幕。判断开没开要问 `body.cmt-open`，问 `display` 永远得到 `flex`。
  - **首访有法律告知遮罩**：`#cmtdiscmodal` 盖住列表，点 `I understand` 后把 `localStorage['deck-comment-terms-ack']='1'`。在无痕/新 profile 里或清了站点数据后，每次刷新都会重新出现——这也是"刷新后看不到评论"的一个常见来源。读者列表其实已经在 DOM 里了（遮罩只是盖住），但人眼看不到。
  - 另外 REST 返回后渲染有一拍延迟，**要让探针等 REST 响应落地再采样**（等 `rest/v1/deck_comments_public`），而不是等固定秒数；早了会读到 TOC 徽章全空、看起来像 bug。种子回填后每页 8 条，用固定 3 秒已经不够了。
- **"这个页面的评论到底从哪来？"**：`node scripts/probe-data-source.mjs <url> [url2]`。它打印页面里的 `DECK_COMMENT_CONFIG`（`supabaseUrl` / `deckId`）**以及浏览器实际发出的 supabase 请求**。用途：本地与线上是**两份 HTML**（工作区一份、仓库推上去的一份），但两份都从**同一个 Supabase 项目**取评论。注意两侧请求**并不相同** —— 本地是 `...&deck_id=eq.mail-autopilot-fs-local`，线上是 `...&deck_id=eq.mail-autopilot-fs`（曾经把这件事说成"逐字节相同"，是错的，别再说）。所以往 `deck_id='mail-autopilot-fs'` 写评论 = **对全网发布**，没有"只写本地"这回事。**这类断言要直接把请求打出来给人看，别让人信推理。**
- **改引用指向**：`SOURCE_PATH` 在 `answer-comment/index.ts` 里，和 `kb-ingest.mjs` 的 `SOURCES` 是**手工对应**的两张表，加来源时两边都要改。
- **owner 模式没有密钥要换**：它就是一个 URL 参数。想让"删除任何评论"这件事真正受控，才需要把 `OWNER_KEY` 校验加回 `deck-admin`（密钥仍在 Secrets 里）。
- **速度与成本**：一条回答约 **6–8 秒**（开重排后实测 7.7s，关掉约 5.9s；52 题全量抽测 p50 **6.7s** · p90 **7.9s** · max 11.7s），异步执行、读者不阻塞。每条评论一次 embedding + 一次生成；想省钱就在面板里关掉。
- **上下文宽度偏窄**：52 题里 **25 条只有 1 个块**进 prompt，中位数 1，`MAX_CONTEXT_CHUNKS=4` 从没跑满。瓶颈是重排后的**动态阈值 `0.7×top`** —— top-1 明显领先时会把第 2、3 名全砍掉。数字仍都能溯源（严格校验：v20 里 0 例外，v21 复跑 1 条例外 —— 见上面「中文数词换算」那条），受影响的是答案的"厚度"。要更厚的答案就动这里，属产品判断。
- **语言跟随曾失守 3/52，v21 已修**：原提示词只说"按评论语言作答"，但答案主要依据**中文《调研报告》**时，模型会被源文语言带走 → 英文提问收到中文回答。52 题里 3 条为中文，**全部**落在引用该报告的 12 条里，未引用它的 40 条无一例外全英文 —— 这是"源文语言镜像"，不是随机漂移。
  - 修法不是加强措辞，而是**在服务端先判定语言、再把它写进 System 段**：`commentScript()` 数汉字与拉丁字母，定出 `Chinese` / `English`，然后 prompt 里明写 `The comment is written in English. Write the whole answer in English. The reference material above is part English and part Chinese — answer in the comment's language, never in the material's.`
  - 判定规则是**汉字绝对量优先**，不是纯比例：`han >= 4` → Chinese；`han >= 2 且 han/(han+latin) >= 0.5` → Chinese；否则 English。纯比例会把「Talkdesk 的 core-bank execution 是什么意思？」这种**英文产品名多于汉字**的提问误判成英文 —— 这正是 30 条单测里抓到的那个坑。
  - **线上实证**：删掉那 3 条种子题重问（`regenerate-seeded-answers.mjs`），3/3 全部回到英文（`han 0`）；全量 52 题复跑后 **0/52 中文占多数**（修复前 3/52）。非回归见下面两条：1 处引用丢失经重复抽样确认是波动，1 处数字换算错误是真实新问题。
  - 判定逻辑与 prompt 措辞都有单测兜着（`check-answer-prompt.mjs`），改这里必跑。
- **强制英文作答的副作用：中文数词换算会出错（1/52，未修）**：p2「Larkspur 四个数字」这条，素材原文是 `50,000 emails a month` / `50K emails/month`，v20 的**中文**答案写的是 `5万封/月`（正确），而 v21 的**英文**答案写成 `60k/month`。同一问题重复 3 次：只有那次照抄中文数词（`5万封/月`）的是对的，两次纯英文的分别是 `60k/month`、`60k/year` —— **疑因"5万 → k"这一步换算出错**，是语言修复带出来的新问题。要修就在 System 段加一句"数字按素材原文逐字照抄、不要做单位换算"，改完先补 `check-answer-prompt.mjs` 的断言再部署。
- **判断某处改动是不是回归，只能靠重复抽样**：`SUPABASE_PAT=... node scripts/probe-answer-variance.mjs "<完整问题>" --n 3`。它把同一问题问 N 次（写 `deck_id='mail-autopilot-fs-qa'`，跑完自清），报出每轮的引用/legend/语言与正文，最后给离散度。**答案不是算出来的，每次都不一样**，所以"上一轮 52/52、这一轮 49/52"这种对比本身不能证明回归 —— 用它才能分清。实测：p9「four demo films」在 52 题那轮没带引用，但重复 3 次全部带引用 → **抽样波动，非回归**。
- **归档一轮 QA**：`SUPABASE_PAT=... node scripts/archive-qa-run.mjs qa-answer-comments-52-v21.json`。把 QA deck 现存行存盘，并记下**产生它的函数版本**（读 Management API 的 `version`）—— 没有版本的归档无法与后续对照。已有 `qa-answer-comments-52.json`（v20）与 `qa-answer-comments-52-v21.json`。

### 关于重排：远程 cross-encoder 已开启（2026-10-08，owner 决定）

> **当前状态：开着。** `SILICONFLOW_RERANK_ENABLED=true`，线上 `answer-comment` 会把实际走的那一级写进响应里的 `rerank` 字段（`"remote"` / `"heuristic"`），所以这件事是可观测的、不用猜。远程那级一旦抛错会**静默**降级到启发式 —— 这是要知道的：质量变化不会报错，只会体现在排序上。
>
> 想关掉：把 Secrets 里的 `SILICONFLOW_RERANK_ENABLED` 改成 `false`（一次 API 调用，不用重新部署）。

patentExaminator 在 `toolExecutor.ts:394-434` 把基础分清零、只信 cross-encoder，是因为它的候选来自 **RAG + 联网搜索两条异构通道**，分数本来就不可比。而 deck 的候选全部来自同一个混合检索器，RRF 分数是有意义的信号，抹掉它等于扔信息。

**第一次实测（分块卫生问题未修）**：5 组真实读者问题里，照搬行为把基线 top-1 挤出前三是 **5/5**；PRD §6.2（权威定义、向量分最高）被打 0.0072、掉到第 9；有一题的重排 top-1 竟是「版本记录」（changelog）。当时据此默认关闭。

**修完卫生问题后复测（12 题 = 中文 4 + demo app 4 + 英文 4）**：

| 排序方式 | hit@3（top-3 含正确来源） | 融合 top-1 是否保住 |
|---|---|---|
| 融合 RRF | **11/12** | 12/12（定义上） |
| cross-encoder 单独排序（照搬行为） | 11/12 | **8/12** |
| cross-encoder 与 RRF 混合 0.6/0.4 | 10/12 | 9/12 |

也就是说：**之前那次"退化"主因是分块卫生，不是模型**。修完之后重排不再丢召回（11/12 对 11/12），但它也没有带来任何增益，却把 4/12 题的**最优块从第一挤到第二或第三**，还要多花一次网络往返。混合方案更差（10/12），所以没有采用。

唯一一题重排优于融合的是英文「hard "never" list」——但融合召回的其实也不差：deck 那张 *What ships, what waits, and what has no switch* 幻灯片正文里就写着 `Hard "never" list`，是期望来源标注太窄，不是检索错了。

**决定**：owner 要求开启，于是开启。写在这里的实测数据不是为了反对这个决定，而是为了说明它**付出的是一次网络往返（实测单条回答 5.9s → 7.7s）和 4/12 题上的 top-1 位移，换到的是一份"照搬 patentExaminator 原始 pipeline"的一致性**。如果哪天发现答案质量变差，第一件事就是把开关关掉对比 —— 这是最快的 A/B。

### 引用链接：`[3]` 现在点得动（2026-10-08）

**原来的毛病**：prompt 里让模型"cite as [1], [2]"，但那个编号列表**只存在于 prompt 里**。读者看到的是一个孤零零的 `[3]`，没有任何东西可以对照 —— 等于用了一个只有模型见过的坐标系。

**现在的做法**（两半，各自独立可测）：

1. **`answer-comment` 落库前改写**：把 `[n]` 换成 markdown 链接 `[n](url)`，再追加一行 `Sources: 2. … · 3. …`。编号仍是索引（答案是"本次检索到的第 n 块"），但指向的是**它可以被打开的那个副本** —— 公开仓库里的原文件。

   | 来源 | 链接目标 |
   |---|---|
   | deck / prd_en / report / backlog / readme | 仓库里对应的单个文件 |
   | prototype（301 块） | 该块自己的 `section`，对代码块**就是文件路径**，所以能深链到 `src/runtime/caseRunner.ts` |
   | **dev_plan** | **不给链接** —— 这份文档没有上传到仓库，链到 404 比留个点不动的编号更糟 |

2. **deck 渲染成锚点**：`comments.js` 里 `renderBody()` 把 `[文本](https://…)` 变成 `<a class="cite">`。**只认自己域名**（`github.com/wukun2005-gif/mailAutopilotForFS`、`wukun2005-gif.github.io/mailAutopilotForFS`）—— 评论框是开放的，任何人都能发 `[click here](https://evil.example)`，如果不加白名单，deck 就等于替这条链接背书。其它 URL 原样显示为文本。

**边界**：
- 越界的编号（`[9]` 而只检索到 4 块）**原样保留** —— 那是模型自己数出来的东西，不该被我们改写。
- 没引用任何来源时**不加 `Sources:` 行**，避免空标签。
- 渲染**完全不碰 `innerHTML`**：文本走 `createTextNode`、链接走 `createElement`，所以任何来源的文本都变不成标记。换行也不用处理，`.bd` 本来就是 `white-space:pre-wrap`。
- **这一步是客户端改动**：函数是即时生效的，但 `comments.js` 要**推上去**线上 deck 才会渲染链接；否则新答案会把 `[2](https://…)` 原样显示出来，比原来更难读。

### demo app 源码作为知识来源的实测表现

原型源码（`prototype`，301 块）是 7 个来源里最大的一块，但**中文提问时它几乎不进前三**：

| 问法 | prototype 最高排名 |
|---|---|
| 原型里的时钟是怎么走的？ | #10 |
| 演示用的假数据是从哪里来的？ | #23 |
| 原型的四个核心屏幕分别是什么？ | 未进 top-30 |
| src/runtime 里信件线程模型是怎么实现的？ | #9 |
| **英文**：How is the demo clock advanced, and where do the fake fixtures come from? | **#1（top-5 里占 3 席）** |

原因是跨语言：源码是英文，中文问题与中文写就的 dev plan / 调研报告更接近，所以中文 demo 问题由 dev plan 作答（它本来就是"回答 demo 问题最对口"的文档），英文 demo 问题才命中真实代码。**两边都能答，不需要额外补偿**——这也是当初"要不要收 demo 代码"这个问题的实测答案：要收，但它的价值主要在英文问法。

## 完成

刷新 deck 页面，两条通知规则同时生效：

- **回复通知**：任何访客（包括你）在面板里填了邮箱后留言；之后任何人回复那条留言，留言者就收到一封邮件，标题像 *Dana replied to your comment — Mid-size banks are the beachhead.*，里面有回链 `?p=<page-key>&c=<comment-id>`，点回去会跳到那一页、那一页评论高亮滚动到位。没填邮箱的人不会被通知（也没法通知）。
- **Owner 全量通知**：**任何人在任何一页留下任何评论（含回复），你的 `OWNER_EMAIL` 都会收到一封**，标题像 *New comment on “Mid-size banks are the beachhead.” — Dana*，正文里带评论者昵称、他留的邮箱（方便你直接回信）、评论内容和回链。

两封都会各发一次，不会重复：如果你自己就是被回复的那个人，你只会收到「回复通知」而不会额外再收一封 owner 通知；你自己发的评论也不会给自己发信。

## 常见问题

- **邮件没到**：先看 Supabase → Edge Functions → Logs 里的 webhook 调用日志，看返回的是 200 还是 5xx。465 连不上通常是 `MAIL_FROM` 与登录账号不一致，或邮箱要求应用专用密码而非登录密码。
- **Supabase 国内访问慢**：WebSocket（realtime）可能不通。代码里 8s 轮询兜底，刷新稍慢但功能不丢。
- **想关掉面板**：按 **C** 键或点 ✕。再按一次打开。
- **作者删除权限**：本机 clientId 匹配的评论显示「Delete」，软删除（`deleted=true`）；硬删除接口未开放，避免数据丢失。

## 没接 Supabase 时的本地模式

随时可以留空 `comments.config.js`，面板照样工作 —— 评论存浏览器 localStorage，并用 BroadcastChannel 在同浏览器的多个标签页之间实时同步。这模式适合做截图、demo 或一对一演示；不适合多人在线场景。
