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
