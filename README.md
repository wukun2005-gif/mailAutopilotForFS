# Email Autopilot for Financial Services — Prototype

可用性原型（usability prototype），用于现场 demo 与 slides 讲解。所有银行、客户、账户、金额、回测数字均为**虚构数据**；默认全程录制数据离线可跑，不依赖网络。

- 产品依据：PRD v0.2（`email-autopilot-fs-prd.html`）
- 技术栈：Vite 8 + React 19 + TypeScript 7 + LangGraph（浏览器内 checkpoint）+ MSW（录制 API）+ IndexedDB 持久化 + zustand + react-i18next（中/英）+ Tailwind v4 + Recharts + framer-motion

## 1. 启动（一条命令）

前置：Node **≥ 22.22.0**（`node -v` 确认；promptfoo 的 engines 要求）。

```bash
npm install        # 首次
npm run dev        # http://localhost:5173
```

不需要单独启动后端：`server/` 目录是 Vite dev/preview middleware（Dev BFF），随 `npm run dev` 一起加载，负责 Provider 设置与 live LLM 代理。

其他命令：

```bash
npm run build      # tsc 类型检查 + 生产构建
npm test           # vitest 单元测试（runtime / 闸门 / 检测器 / i18n 键差集）
npm run e2e        # Playwright（需系统 Chrome；首次 npx playwright install chrome）
npm run eval       # promptfoo 六集安全/闸门评测（离线可跑，51 断言）
npm run audit:prd  # PRD 口径断言（15 项）
npm run tts        # 重新生成演示语音（edge-tts，中/英各 41 条 → public/tts/）
```

## 2. 四张屏

| 屏 | 名称 | 看什么 |
|---|---|---|
| ① | Customer Email | Webmail、手机银行 App 案件卡、step-up（OTP / App 案件卡）、三色文书（Tricolor Letter）、Trace Rail、Reg E 时钟条 |
| ② | Agent Handoff | 案件卷宗：意图证据卡、政策求值卡、缺失材料、待办动作、可编辑草稿（L2）、中断恢复横幅 |
| ③ | Supervisor | 审批队列（一键批 / 链式审批）、法定时钟看板、BEC/ATO 欺诈隔离 |
| ④ | Admin | R×I 自主权矩阵（可手动 cap）、90 天回测、三层抽样、就绪报告 + 合规/业务双签、Conformal 卡（P2） |
| 设置 | Provider Settings | LLM provider 配置（从 HarnessWindTunnel 移植），key 在服务端掩码落盘 |

顶部琥珀色条是**原型控制面板**（Prototype controls）：注入邮件、拨模拟时钟、注入故障（超时/重复送达/政策版本/会话过期/新线程/OTP 锁定等）、重启进程、重置。

## 3. 一键演示（demo 前必读）

右上角 **Run demo** 菜单，五个脚本；建议现场顺序：

| 脚本 | 时长（1×） | 内容 |
|---|---|---|
| `trailer90s` | ~90s | 三封邮件精华串烧，适合开场 |
| `email1` | ~3 min | 透支费两拍，全程以**客户邮件界面**为主舞台：未认证不放权（锁定模板）→ App 案件卡 step-up（**OTP 固定码 `111111`**）→ 核验通过当场开审计视图讲身份 I1→I3 的依据 → 自动退费 + 回信按来源分色 → 14 天后审计轨上多一行"verified"；Day 21 第二次请求回到客户线程看信件 → 只切一次坐席交接屏，指到政策卡上"近 12 个月退免记录 ≤ 1 次 = 2"这条 FAIL → 主管一键批准 → 回客户线程看解释函发出 → 审计轨显示结案 |
| `email2` | ~3 min | Reg E 争议全周期：立案起钟、Day 6 OCR 自动归件、**bd10 前刷新页面"重启进程"——checkpoint 恢复、临时贷记只发一次**、Day40 人工裁决、结果函 L1 签发 |
| `email3` | ~1 min | BEC/ATO：形近仿冒域名 + 附件注入 → 隔离；改手机号/寄卡动作在邮件渠道**结构上不可达**；只向档案内号码发短信；SAR 锁定模板 |
| `builder` | ~1.5 min | 矩阵手动 cap、回测回放、阴性复标栏（取消勾选演示"不可签"）、双签毕业即时生效 |

控制条（屏幕底部）：

- `Space` 暂停/继续；`→` 单步；`Esc` 停止
- 速度按钮循环 **1× → 2× → 4×**（现场建议 2×/4×）
- 脚本中的审批点击是**真实点击**（require click），点不到会出现红色 blocker 并暂停，按 `→` 单步或重开脚本
- 中/英切换（顶栏 `中文/EN` 按钮）不打断播放
- tooltip 拍带**语音解说**（edge-tts 生成，中文 `zh-CN-XiaoxiaoNeural` / 英文 `en-US-AriaNeural`）：caption 显示时长 = 语音时长，暂停/继续/倍速/Esc 与画面同步；断网或音频缺失时自动退回纯字幕。文案见 `tts/transcript.zh.md` / `tts/transcript.en.md`
- tooltip 拍的 `focus` 就是讲解指向的那个 data-id：假鼠标移过去，同时给这个元素本身加 `data-hl` 高亮圈（样式在 `src/index.css`），画面不缩放、不压暗、其余部分保持原样。字幕点到细节（某条政策条件、审计轨新行、身份面板）时把 `focus` 指到那一行即可，成本 = 一个 data-id；`<prefix>@last` 表示“最后一个”（如审计轨最新一行）
- **改字幕后必须重跑 `npm run tts -- --force`**：`public/tts/manifest.json` 记录每条语音是按哪版字幕生成的；字幕改了而语音没重生成时，播放端跳过那条语音、只放字幕，不会念旧文案

## 4. 断网预案

- 默认全录制：MSW handler + fixture + 确定性政策引擎，**断网照常完整演示**。
- Live LLM 只是屏①"一般咨询"彩蛋节点：在 **Provider Settings** 配好 OpenAI 兼容 key（七张预置卡：OpenAI / Gemini / OpenRouter / DeepSeek / Kimi / 火山 / custom）后走 Dev BFF `/api/llm/chat`，含两级回退；未配置时显示 RECORDED 回答。
- Key 只存在本地 `server-data/settings.json`（已 gitignore，服务端掩码、原子写），**不要把 key 填入截图/录屏/仓库**。
- 开场前可用故障面板确认"锁定录制模式"，避免任何真实外呼。

## 5. 关键设计口径（讲解时的钉子）

1. **三道闸门**：R（动作风险 R0–R4）× I（身份保证 I0–I3）× L（自主权 L0–L3）；单元格由与生产同构的纯函数 `decideCell()` 计算，Builder 打不开运行时够不到的格子（R3 整行 never、R4 永久 L1）。
2. **长流程不中断**：LangGraph checkpoint 存 IndexedDB；"重启进程"后从断点恢复，动作经幂等台账保证**零重复**（临时贷记不发两次）——这是对"跑着跑着断了"这一工程痛点的直接回答。
3. **确定性的归确定性**：政策求值、法定时钟、身份判定、毕业门槛都是规则/算术，LLM 只负责分类、抽取、起草；受监管意图高召回关键词层在模型之下兜底。
4. **毕业证据**：受监管意图 ≥600 触发 + 0 关键漏检 + 检测器阴性复标列；非受监管 ≥300 + 免修改批准率 ≥97%；合规 + 业务双签才生效。
5. **BEC 纵深**：形近本地名/域名检测、附件 prompt injection 只当数据、R3 工具在邮件渠道不注册、只走 on-file 通知。

## 6. 评测与证据

- `npm run eval`（promptfoo，六集，51 断言全绿）：注入/越狱（含中、西语绕写）、受监管漏检（22 条隐晦改写 0 漏检）、政策两拍一致性 + 四种 I3 降级反断言、越权动作矩阵、10 条 BEC、grounding（无 provider 自动 SKIP，不卡门禁）。
- `npm test`：runtime 轨迹、闸门 fail-closed、身份、幂等、模拟时钟、DLP/检测器、毕业 override、demo data-id 防腐、**7 个 namespace 的 en/zh 键差集与插值变量一致性**。
- Trace Rail / 审计视图直接读 CaseEvent 事件流，每个事件含 simTime、节点、判定、理由码、政策版本、幂等键。

## 7. i18n 边界（有意为之）

界面文案全部中/英双语；以下保持英文原文，属于**数据与术语**而非界面：邮件正文与回信文书、trace 技术日志（节点名 / 事件 type / reason code）、审批 id、意图 code、R/I/L 等级、Reg E / PAN / OTP 等术语。

## 8. 目录速览

```
src/runtime/   LangGraph 9 节点图、闸门、政策引擎、身份、时钟、幂等、checkpoint
src/mocks/     fixtures（客户/账户/政策/三邮件/回测）+ 11 组 MSW handler + DLP
src/screens/   四屏（customer / agent / supervisor / builder）+ Settings
src/demo/      一键演示：脚本、runner、FakeCursor、Tooltip、控制条
src/locales/   7 个 namespace 的 en/zh JSON
server/        Dev BFF（Provider 设置、key 掩码、LLM 代理与回退）
evals/         promptfoo 自定义 provider 与六集用例
tests/unit     vitest；tests/e2e Playwright
scripts/       audit-prd 口径断言
```
