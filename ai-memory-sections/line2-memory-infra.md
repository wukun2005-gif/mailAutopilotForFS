# Line 2：AI 新贵 + 横向 AI Memory 基础设施公司

> **AI Memory for Financial Services — 市场调研 v0.1**
>
> 调研日期：2026-09-24 ｜ 视角：CCaaS 厂商（Talkdesk）Principal PM，为金融机构决定是否/如何构建跨 voice/chat/SMS/email、跨时间的客户记忆能力。
>
> 标注约定：【事实】= 附来源 URL 与信息日期；【分析】= 基于事实的推理；【假设】= 待验证判断；【待核实】= 公开渠道查不到、禁止编造。厂商自述数字与第三方核验分开标注。技术术语保留英文，首次出现给大白话。

---

## 0. 总述：谁在卖"记忆"？卖给谁？

### 0.1 四股势力，四种生意

2024–2026 年，"AI memory（跨会话的客户/用户记忆）"从论文概念变成一门独立生意。把今天市面上所有讲 memory 的玩家摆在一起，其实是四种完全不同的生意，**它们互相之间不是竞品关系**：

| 势力 | 代表 | 卖的是什么 | 客户是谁 | 记忆是它的… |
|---|---|---|---|---|
| **A. 横向 memory infra** | Mem0、Zep/Graphiti、Letta、Cognee、Supermemory | 一个 API/SDK："给你的 agent 加记忆" | 开发者、AI 应用团队 | **产品本体** |
| **B. AI-native 客服产品** | Sierra、Decagon、Intercom Fin、Cresta、Crescendo | 一个能结案的客服 agent | 客服/运营负责人 | **卖点/模块**，不单独卖 |
| **C. Hyperscaler 内置 memory** | OpenAI ChatGPT、Anthropic Claude、Google Gemini、Microsoft Copilot | 给自家聊天产品/agent 平台加记忆 | C 端用户 + 企业 workspace 管理员 | **留存功能**，不外卖 API |
| **D. 治理/评测层** | Lakera、Patronus、Galileo、Arize/Phoenix、Langfuse、OneTrust | 安全护栏、trace 评测、同意管理 | 安全/合规/平台团队 | **配套**，不是记忆本身 |

【分析】对 Talkdesk 的 PM 来说，这张表直接回答了题目里的两个问题：

1. **"银行能不能直接买 infra（Mem0/Zep）自建？"** —— 技术上能，Mem0/Zep 都是 Apache-2.0 开源 + 企业版 on-prem/BYOC，SOC 2/HIPAA 都在补。但"能跑起来"和"在金融客服里合规地跑起来"之间隔着一整层产品工作（身份合并、记忆台账、删除权、按法域保留期、和 CRM/录音/质检的对齐），这层工作恰好是 CCaaS 厂商的地盘。详见第 6 节。
2. **"客服新贵们到底有没有真记忆？"** —— 2026 年之前绝大多数是"RAG 拼历史工单"（把客户过去的 ticket 做向量检索塞进 prompt），不是独立的记忆层；2025-11 之后 Sierra 先把"Agent Data Platform / Agent Memory"做成独立产品叙事，2026-08 Intercom Fin 才补上跨渠道记忆，Decagon/Cresta/Crescendo 是 2026 年才把"User Memory / Shared Memory"写进产品页。**这是一个 12 个月窗口内刚被发明出来的品类，没有谁已经把 FS 场景打磨完。** 详见第 7 节。

### 0.2 黑话速查（本节首次出现的词）

- **vector DB（向量数据库）**：把文字变成一串数字（embedding，词向量），按"语义相似度"检索的数据库。记忆最常见的存法。
- **graph / knowledge graph（知识图谱）**：把事实存成"实体—关系—实体"三元组（如"张三—持有—白金卡"），能查关系、能给每条边标时间。
- **bi-temporal（双时间维）**：一条记忆同时记两个时间——"事实什么时候发生的"和"系统什么时候知道的"，Zep 主打。
- **RAG（Retrieval-Augmented Generation，检索增强生成）**：回答前先从知识库里捞相关片段塞进 prompt。客服"翻历史工单"本质就是 RAG。
- **MCP（Model Context Protocol）**：Anthropic 推的 agent 接外部工具/数据源的标准协议。
- **BYOC / BYOK**：Bring Your Own Cloud / Key，部署在客户自己的云/用客户自己的加密密钥。
- **ABAC（Attribute-Based Access Control，基于属性的访问控制）**：按"这条记忆属于谁、什么用途、什么法域"来决定谁能读。
- **BAA（Business Associate Agreement）**：HIPAA 下处理医疗数据必须签的协议；金融类比是要能签 DPA + 满足 GLBA/PCI。

---

## 1. 横向 memory infra 公司（重点）

这一类是 2024–2026 年新冒出来的"卖记忆本身"的公司。它们不做客服界面，不做坐席，只做一个 API：你把对话丢给它，它帮你抽事实、存起来、下次再喂回来。

### 1.1 Mem0（mem0.ai）—— 目前采用最广的 memory 层

- **融资【事实】**：2025-10-28 官宣累计 $24M（Seed + Series A），Seed 由 Kindred Ventures 领投，Series A 由 Basis Set Ventures 领投，Peak XV、GitHub Fund、YC 跟投。来源：https://mem0.ai/series-a （2025-10-28）
- **开源体量【事实，GitHub API 实查 2026-09-24】**：`mem0ai/mem0` = **65,960 stars**，Apache-2.0，最近 push 2026-09-24（活跃）。
- **产品形态【事实】**：开源 SDK + 托管 Platform。做法是"从对话里抽 durable facts（长期事实：偏好、个人信息、历史事件），自动消解矛盾"；dual storage = vector DB + graph（Pro 以上才开 entity linking）。2026 年加了 Memory Compression Engine（把聊天历史压成紧凑记忆，宣称省 token）和 Dream（记忆 consolidation，离线整理）。来源：https://mem0.ai/ ；https://docs.mem0.ai/overview
- **定价【事实】**：Hobby 免费（1 万 add / 1 千 retrieval 每月）、Starter $19/月、Pro $249/月（开 graph memory、unlimited memories、analytics）、Enterprise 定制（on-prem、audit logs、SSO、SLA、custom integrations）。来源：https://mem0.ai/pricing （2026-09-14 抓取）；https://agenticindex.io/vendors/mem0
- **企业治理【事实】**：SOC 2 **Type I**（注意：不是 Type II）、HIPAA、GDPR ready、BYOK、可 on-prem / air-gapped。Trust Center 自称 100,000+ 开发者。来源：https://trust.mem0.ai/ （2026-08-17）；https://mem0.blog/
- **【分析】**：Mem0 是"广度优先"的赢家——开发者最多、上手最快、文档最全。但它的记忆模型偏"扁平事实列表"，**没有原生的时间维（一条事实什么时候过期）、没有 ABAC、没有"这条记忆能不能用于营销/能不能用于风控"的用途标签**。对通用 chatbot 够用，对银行"服务记忆 vs 营销记忆"切分要自己加。

### 1.2 Zep / Graphiti —— 时间感知知识图谱派，治理叙事最像银行

- **开源体量【事实，GitHub API 实查 2026-09-24】**：`getzep/graphiti` = **31,144 stars** Apache-2.0，最近 push 2026-09-24；`getzep/zep` = 4,930 stars。
- **融资【待核实】**：公开资料显示 YC seed 量级在 $0.5M–$2.3M 之间（不同来源数字打架），截至 2026-06 未见公开 Series A 官宣。来源：https://rywalker.com/research/zep （2026-02-22）；https://lin-guanguo.github.io/llm-memory-research/memory.ecosystem/ （2025-12-18）。**注：这是一家营收导向、融资克制的公司，不要按"烧钱扩张"画像它。**
- **核心技术【事实】**：Graphiti 是 **bi-temporal knowledge graph**——每条事实（edge）同时记录"什么时候为真"和"系统什么时候知道"；新事实和旧事实矛盾时，不是"覆盖"而是把旧 edge 标 superseded、保留完整时间线。卖点原话："doesn't just track what is true, it tracks when something was true and when that changed." 来源：https://help.getzep.com/graphiti/graphiti/overview ；https://www.memoryatlas.dev/frameworks/zep （2026-08-01）
- **定价【事实】**：按 credits（1 credit ≈ 350 bytes episode 摄入，retrieval 免费）：Free 10K credits/月、Flex $125/月（50K credits）、Flex Plus $375/月（200K credits + webhooks + custom extraction）、Enterprise 定制；migration 前老方案是 $1.25/1000 messages + $2.50/MB。来源：https://www.getzep.com/pricing/ （2026-09-06）；https://blog.getzep.com/introducing-metered-billing-and-byoc-deployments/ （2025-03-31）；https://www.memoryatlas.dev/frameworks/zep
- **企业治理【事实，本节对银行最关键的一张清单】**：SOC 2 **Type II**、HIPAA BAA（Enterprise）、DPA、**1 年 audit/API logs 保留**、BYOK via AWS KMS、**BYOC（部署进客户自己 VPC）**、**EU data residency on request**、**ABAC（按属性的访问控制）**、**retention + legal hold**、sub-200ms p95。来源：https://www.getzep.com/emerging/ （2026-09-25 抓取）；https://www.getzep.com/vectorize-hindsight-alternative/ （2026-05-31）
- **【分析】**：Zep 是这批 infra 里**唯一把"可审计 + 时间线 + 访问控制 + 数据驻留"写成一等产品能力**的。它的 bi-temporal 模型天然解决"客户 3 个月前说要改地址，上个月旧地址还在被引用"这种 FS 高频事故。如果 Talkdesk 要 build on top of infra，Zep/Graphiti 是技术上最贴监管叙事的底座候选；缺点是它仍然是"context graph"，不是"客户 360"，也不懂 contact center 业务实体（case、dispute、Reg E 时钟）。

### 1.3 Letta（MemGPT 商业化）—— 研究派，agent 自己管记忆

- **开源体量【事实，GitHub API 实查 2026-09-24】**：`letta-ai/letta` = **24,870 stars** Apache-2.0，最近 push 2026-09-10。
- **出身【事实】**：UC Berkeley Sky Computing Lab 出品，MemGPT 论文（arXiv 2310.08560）的商业化公司；顾问 Ion Stoica、Joey Gonzalez；天使含 Jeff Dean、HuggingFace Clem Delangue。来源：https://www.letta.com/
- **融资【待核实，来源冲突】**：一处说 2025-07 前累计 $10M seed（Felicis 等），另一处说 2025-12 Felicis 领投 $20M seed。可能是分两次 close，**具体总额待核实**。来源：https://www.billiondollarpitchdecks.com/startups/letta-ai ；https://callsphere.ai/blog/agent-memory-problem-startups-building-long-term-memory-ai-agents （2026-03-16）
- **产品哲学【事实】**：和 Mem0/Zep 的"被动抽事实"不同，Letta 让 **agent 自己用工具读写分层记忆**：Core Memory（常驻 context，像 RAM）、Recall（cache）、Archival（冷存储，像硬盘）。2026 年推 "sleep-time compute"（agent 空闲时整理/重写记忆）和 git-backed memory + skills。来源：https://www.letta.com/blog/ ；https://vectorize.io/articles/mem0-vs-letta （2026-03-15）
- **定价【事实】**：API 计划 $20/月起 + $0.10/active agent/月 + $0.00015/秒 server-side tool 执行；LLM token 另付。来源：https://aiwiki.ai/wiki/letta/edit （2026-09-16）；https://aitools.fyi/letta
- **【分析】**：Letta 面向的是"要长期跑、会自己进化的 stateful agent"，不是"记住客户偏好"。它的治理面（审计、删除、PII 控制）公开材料里远薄于 Zep；**对银行客服这个场景，Letta 不是首选 infra**，但它的"记忆分层 + agent 自己整理记忆"思想值得 PRD 借鉴。

### 1.4 LangMem / LangChain —— 不是产品，是库

- **【事实】**：2025-02-18 发布 LangMem SDK（MIT），定位是"帮 agent 从对话里抽信息、更新 prompt、维护关于行为/事实/事件的长期记忆"；本身不带存储，底层用 LangGraph BaseStore（你自己接 Postgres/向量库）。GitHub `langchain-ai/langmem` = **1,684 stars** MIT，最近 commit 2026-09-09。来源：https://blog.langchain.com/langmem-sdk-launch/ （2025-02-18）；https://changelog.langchain.com/announcements/langmem-sdk-for-long-term-agent-memory ；GitHub API 实查 2026-09-24
- **【分析】**：LangMem 是"自己拼"路线的零件，不是一个可买的产品。银行如果已经用 LangGraph 搭 agent，顺带用它；否则没有理由专门选它。它**不提供多租户隔离、不提供审计、不提供删除合规**——这些都在你的 store 层。

### 1.5 Cognee —— 图 + 向量 + RDF ontology，企业定制路线

- **开源体量【事实，GitHub API 实查 2026-09-24】**：`topoteretes/cognee` = **30,971 stars** Apache-2.0，最近 push 2026-09-24。
- **融资【事实】**：2026-02-19 官宣 $7.5M seed，Pebblebed（OpenAI 联创 Pamela Vagata、FAIR 创始人 Keith Adams 的基金）领投。来源：https://www.cognee.ai/blog/cognee-news/cognee-raises-seven-million-five-hundred-thousand-dollars-seed
- **产品【事实】**：ECL（Extract-Cognify-Load）pipeline，把文档/对话/代码塞进 graph + vector；强调 **RDF ontology（自定义知识模式）** 和 "remember, recall, improve, forget" 记忆原生 API；企业版 = fixed-scope BYOC 咨询式 engagement（你的 ontology、你的数据上跑 evals、部署进你 VPC）。来源：https://www.cognee.ai/pricing ；https://www.cognee.ai/blog/guides/best-open-source-ai-memory-tools-for-llm-agents-and-developers （2026-05-28）
- **【分析】**：Cognee 走的是"开源吸引人 + 重咨询式 enterprise"路线，更像图数据库厂商（Neo4j 风格），不是开箱即用的客服记忆层。银行要自己定义 ontology，前期投入大。

### 1.6 memary / Supermemory —— 次要参照

- **memary（kingjulio8238/memary）**：2,649 stars MIT，但**最近 push 停在 2024-10-22**，基本是个人 side project，不构成企业选项。来源：GitHub API 实查 2026-09-24。
- **Supermemory（supermemoryai/supermemory）**：30,881 stars MIT，定位"Memory and context API，可完全本地跑"；偏开发者工具/个人记忆，企业治理材料薄。来源：GitHub API 实查 2026-09-24。

---

## 2. Hyperscaler 的 memory 功能（不外卖，但定了用户预期）

这一节的关键不是它们是竞品，而是：**它们已经把"记忆可以看、可以改、可以关、管理员可以一刀切"做成了 C 端默认期待**，银行客户照这个标准要求所有 vendor。

### 2.1 OpenAI / ChatGPT

- **【事实】**：ChatGPT Enterprise/Edu/Business 2026-09 滚动推出 improved memory——用户可**查看 memory summary、在个性化回复下 View Sources（看到来自哪些记忆/旧对话/自定义指令）、纠正 memory**；workspace owner/admin 可在后台管理记忆设置与角色权限；删除的对话 30 天内从系统清除（法律要求除外）；默认不用客户数据训练。来源：https://help.openai.com/zh-hans-cn/articles/8590148 （2026-09-20）；ChatGPT Enterprise/Business Release Notes（2026-09-18 / 2026-09-22 抓取）
- **【分析】**：OpenAI 给企业记忆立了三条产品范式——**可查看（summary）、可溯源（Sources）、可纠正**。这三条直接就是 Talkdesk "客户记忆台账页"的设计基准。

### 2.2 Anthropic / Claude

- **【事实】**：2025-09-12 Team/Enterprise 上线 memory（自动从聊天里抽工作上下文，生成 memory summary），同期推 **Incognito chat（不进记忆）**；2025-10-23 扩到 Pro/Max；2026-03-02 扩到 free + 支持记忆导入导出；**Org owner 可一键全组织关闭 memory，关闭即永久删除所有人的记忆数据**。开发者平台另有 file-based memory 工具（agent 在专属目录里建/读/改/删文件，跨会话持久）。来源：https://www.anthropic.com/news/memory （2025-09-12）；https://support.claude.com/en/articles/11817273 （2026-09-25 抓取）；https://aiwiki.ai/wiki/claude_memory （2026-06-07）；https://claude.com/it/blog/context-management （2025-09-29）
- **【分析】**：Anthropic 多给了两条范式——**Incognito（这次对话别记）** 和 **owner 一键熔断 + 立即删除**。后者是 GDPR 第 17 条删除权的产品化样本。

### 2.3 Google / Gemini

- **【事实】**：Gemini 的记忆主要绑定 Workspace 生态（Gmail/Docs/Sheets/Meet 上下文跨对话流动）。2026-09-24 TechRepublic 报道 Google 在建"AI Memory designed to stay locked even from Google"（处理时临时解密、用完再加密）。来源：https://www.techrepublic.com/article/news-google-private-ai-memory/ （2026-09-24）；https://www.flowhunt.io/faq/best-ai-chatbot-memory/
- **【待核实】**：Google 对"企业客户能在 Vertex/CCAI 里管理 per-customer 记忆"的产品化程度，公开材料不如 OpenAI/Anthropic 清楚。

### 2.4 Microsoft / Copilot Studio + M365 Copilot

- **【事实】**：2025-11 Ignite 宣布 M365 Copilot 的 conversational memory——跨会话保留工作档案/自定义指令/旧聊天洞察，**用户可随时 review/update/delete**，经 Frontier program 开放。Copilot Studio 同步给 agent 加 memory（per-user 捕捉偏好和模式，跨交互持久）。来源：https://news.microsoft.com/ignite-2025-book-of-news/ （2025-11）；https://learn.microsoft.com/microsoft-copilot-studio/whats-new （2026-08/09 更新）
- **【分析】**：微软走的是"记忆 = 你在 M365 里的工作上下文"，和 FS 客户侧记忆不是一回事；但 Copilot Studio 既然给 agent 加了 memory，Dynamics 365 Contact Center 早晚会把它接到 Service Hub 上——这是 Line 1 要盯的。

---

## 3. AI-native 客服新贵：他们怎么讲"记忆"的故事

### 3.1 Sierra —— 唯一把 memory 做成独立数据平台叙事的客服新贵（最重要）

- **【事实】**：2025-11-05 发布 **Agent Data Platform (ADP)**，原话"gives agents memory, context, and intelligence"；2026-07-16 发布 **Horizon**（long-horizon agent），产品页明确列三条：Customer context（接 systems of record 看完整历史）、**Persistent memory（"Recall what matters to each customer, so every conversation builds off the last"）**、Next-best-action decisioning。Context Engine 是另一个独立产品页。来源：https://sierra.ai/blog?page=4 （2025-11-05）；https://sierra.ai/uk/product/horizon （2026-07-21）；https://sierra.ai/product/context-engine
- **【事实】**：2026-08 BBVA 上线 Sierra 第一个 long-running horizon agent（西班牙/阿根廷）。来源：https://sierra.ai/uk/blog/sierra-launches-in-korea （2026-08-25）
- **【分析】**：Sierra 已经把"记忆 = 可复利的客户数据资产"写进融资故事（"the memory of your customer interactions becomes a durable, expanding moat"）。**这意味着 Talkdesk 不能把"做记忆"当差异化——Sierra 已经在做，而且拿 BBVA 背书。Talkdesk 能赢的点是：Sierra 的 memory 是通用叙事，没有按金融监管把"服务记忆 / 营销记忆 / 授信记忆"切开，也没有 CCaaS 原生的录音/质检/保留期治理。**

### 3.2 Decagon —— 把"User Memory + 治理"写进 Proactive Agents 页

- **【事实】**：proactive-agents 产品页列 "User Memory — Continuity across conversations / User-specific insights / Enterprise-grade governance: full data portability, granular control over what context is stored and how it's used"。FS 页 Chime 证言原话："cross-channel memory, ensuring every interaction is connected"。来源：https://decagon.ai/proactive-agents （2026-09-06）；https://decagon.ai/industry/financial-services （2026-08-02）
- **【分析】**：Decagon 是第二家把"记忆可控可删"写成卖点的（因为它主打 AOP 治理叙事）。但它没公开记忆准确率、删除机制、按用途隔离的任何数字。

### 3.3 Intercom Fin —— 2026-08 才补上，且很薄

- **【事实】**：Changelog 2026-09-02："Fin now remembers. Returning customers pick up where they left off... The same memory travels with the customer from chat to email"。第三方 agenticindex 标注 memory 能力上线于 **2026-08-13**，但同篇批评："no memory layer with a stated scope or lifetime is named anywhere on the product surface"。Intercom 社区 2026-09-11 还有用户在提"希望 Fin 能用同一客户历史对话"的 feature request。来源：https://www.intercom.com/changes/en?page=2 （2026-09-02）；https://agenticindex.io/vendors/intercom-fin （2026-09-10）；https://community.intercom.com/ideas/let-fin-use-previous-conversations-with-the-same-customer-10325 （2026-09-11）
- **【分析】**：Intercom 是"helpdesk 自带 messenger"的代表，它的记忆刚起步，且本质是"同一 messenger 内的对话接续"，跨到电话/核心银行系统很弱。

### 3.4 Cresta —— 坐席侧"shared memory"

- **【事实】**：AI Agent 页原话："Use customer history and preferences to personalize each interaction... **Shared memory ensures critical context is never lost across channels, handoffs, or between human and AI agents.**" 来源：https://cresta.com/ai-agent （2026-09-21）
- **【分析】**：Cresta 的记忆落点在"人/AI 交接不丢上下文"，这正是 CCaaS 最该有的记忆场景之一；但 Cresta 是叠在别人平台上的外挂，没有自己的渠道层。

### 3.5 其他新贵（速记）

| 厂商 | 记忆叙事（原文/近义） | 成色 |
|---|---|---|
| Crescendo | 2026-03 Shoptalk 发 "Influence"："combines personalization and memory… pulls customer history from Shopify/Salesforce/Zendesk, recognizes returning customers across chat/voice/messaging" | 主打零售 CX，FS 未见案例 |
| Boost.ai | 2026 Conversational AI Index 把"memory & context across turns and sessions"列为行业趋势预测，未单独产品化 | 叙事 > 产品 |
| Observe.ai | Moments（对话中自动提炼的事件）+ 实时坐席引导；不是 per-customer 记忆 | 偏 QA/coach |
| Level AI | 对话智能 + 自动化 QA；未见客户长期记忆产品 | 偏 QA |
| Forethought | "learns from past ticket data day one" = RAG over 历史工单，不是 per-customer 记忆 | 旧范式 |
| Aide / Lorikeet | 主打"每条 intent 有审批过的 procedure + 留痕"，把合规团队当一等用户；记忆层面就是 CRM 字段 + 对话摘要 | 治理强、记忆薄 |
| Ada / Parloa / Kore.ai | 未见独立"per-customer 长期记忆"产品页；靠接 CRM 拿上下文 | 接 CRM 为主 |
| Qualified | 销售对话智能（语音转写 + 线索评分），不是客服记忆 | 不适用 |

来源：https://www.crescendo.ai/news/crescendo-ai-shopping-assistant-shoptalk-2026 （2026-03-26）；https://boost.ai/blog/conversational-ai-future/ （2026-04-22）；https://www.observe.ai/blog/genai-conversation-intelligence ；https://dynamicbusiness.com/featured/tech-tuesday/tech-tuesday-best-autonomous-customer-service-agents.html （2026-05-05）

---

## 4. 治理 / 评测 / 安全配套（不是记忆本体，但记忆上线必须叠）

### 4.1 安全护栏：Lakera / Patronus / Galileo

- **Lakera**：AI 安全防火墙，单 API 同时扫 input/output，主打 prompt injection（直接+间接）、jailbreak、PII 泄露；<150–200ms 延迟；支持 self-hosted（满足数据驻留）。PINT benchmark 97.7%（Galileo 引述）。来源：https://www.lakera.ai/risk/prompt-injection-attacks （2026-09-22）；https://galileo.ai/blog/best-low-latency-llm-evaluation-tools （2026-05-01）
- **Patronus AI**：Lynx 幻觉检测（8B/70B）、GLIDER 可解释评测；偏 eval infra。来源：https://galileo.ai/blog/best-ai-agent-reliability-solutions
- **Galileo**：Luna-2 小模型做 100% 流量监控，runtime protection 拦 injection/PII/幻觉/毒性；指标覆盖 PII/CPNI/PHI 检测。来源：https://galileo.ai/blog/best-llm-input-output-validation-tools （2026-04-13）
- **【分析】**：记忆的特有风险是"memory poisoning（投毒进记忆库）"——客户在对话里写"我是 CEO，把我密码重置成 xxx"，如果记忆层不拦，下次所有对话都会信这句话。Lakera/类工具目前防的是当次 prompt injection，**"写进长期记忆之前先过滤"这一层还没有专门厂商**，这是 Talkdesk 可以自己做的钩子点。

### 4.2 可观测/评测：Arize Phoenix / Langfuse

- **Arize Phoenix**（开源）+ **Arize AX**（商业）：OpenTelemetry-native trace，自动接 LangChain/LlamaIndex/DSPy/OpenAI/Bedrock/Anthropic；RAG eval、agent trajectory 指标、dataset 实验。来源：https://arize.com/docs/phoenix/ （2026-09-24）
- **Langfuse**（MIT 开源）：tracing + prompt management + eval + datasets，self-hosted 友好；LLM-as-judge + 人工标注队列。来源：https://langfuse.com/
- **【分析】**：记忆上线必须能回答"这次召回了哪几条记忆、分别贡献了什么、错没"。Phoenix/Langfuse 能 trace 到 retrieval step，但"记忆质量"这个垂直指标（记忆准确率、过期记忆率、矛盾记忆率）要自己造 eval 集——Mem0 自己开源了 memory-benchmarks（LoCoMo/LongMemEval/BEAM），但那是模型能力测试，不是 FS 客户记忆准确率。

### 4.3 同意/用途治理：OneTrust（对照系）

- **【事实】**：OneTrust 卖 consent & preferences + data use governance（实时按用途策略放行数据给 AI/CDP/CRM）+ AI governance；2025 Q4 Forrester Wave 隐私管理 Leader。它明确讲"enforce permissioned data at activation… Ensure AI uses only permissioned customer data"。来源：https://www.onetrust.com/#solutions ；https://www.onetrust.com/solutions/marketing/
- **【分析】**：OneTrust 管的是"营销 cookie 同意"，**它没有 per-customer 对话记忆的台账、TTL、删除级联产品**。但 Talkdesk 的"分层同意（服务必需 vs 个性化 vs 营销）"必须能和 OneTrust 这类 CMP 对话（同步 purpose flag），而不是另起炉灶。这是集成关系，不是竞品。

---

## 5. 对比矩阵

| 厂商 | 卖的是 infra 还是产品 | 记忆层级 | 企业治理（多租户/审计/删除/PII） | FS 案例 | 融资 / 定价 |
|---|---|---|---|---|---|
| **Mem0** | infra（OSS + 托管 API） | 扁平 facts + 关系图（Pro） | SOC 2 **Type I**、HIPAA、on-prem/BYOK、audit logs；无原生 ABAC/时间维 | 公开未见银行 logo（多为 health/sales） | $24M（Seed+A，2025-10）；$19/$249/月起 |
| **Zep/Graphiti** | infra（OSS + 云 + BYOC） | **bi-temporal graph**（事实带时间窗） | SOC 2 **Type II**、HIPAA BAA、1 年 audit log、ABAC、retention/legal hold、EU 驻留、BYOK/BYOC | 公开未见银行 logo | 早期（YC seed，Series A 待核实）；$125/$375/月起 |
| **Letta** | infra（OSS + 云 agent runtime） | 自编辑分层（Core/Recall/Archival） | 治理材料薄；$20/月起 | 未见 | $10–20M seed（数字待核实） |
| **LangMem** | 库（不是产品） | 接 LangGraph store | 无（自己拼） | — | LangChain 生态 |
| **Cognee** | infra（OSS + BYOC 咨询） | graph + vector + RDF ontology | BYOC、自定义 ontology | 公开用户含 Bayer（非客服） | $7.5M seed（2026-02） |
| **Sierra** | **产品**（客服 agent） | ADP: context + persistent memory + NBA | SOC 2 Type II；监管专属能力未公开 | **BBVA、Santander、SoFi、Chime、Ramp、Brex** 等 | 估值 >$15B（2026-05） |
| **Decagon** | 产品 | User Memory（跨会话/跨渠道） | 自称 data portability + granular control | Chime（数字银行） | $65M B（2024） |
| **Intercom Fin** | 产品 | 2026-08 才加跨渠道接续 | Intercom 平台级 SOC2 | 无标志性 FS | 上市公司体量 |
| **Cresta** | 产品（外挂） | 人/AI handoff shared memory | 企业级 | 传统 contact center 客户 | B/C 轮 |
| **Crescendo** | 产品 | personalization + memory（接 CRM） | 未深究 | 零售为主 | 待核实 |
| **OpenAI** | 平台功能 | C 端/workspace 记忆 summary | admin 可控、30 天 purge、Sources 溯源 | 不卖给 FS 客服 | — |
| **Anthropic** | 平台功能 | memory summary + incognito + file memory | org owner 一键关+删全量 | 不卖给 FS 客服 | — |
| **Microsoft** | 平台功能 | M365 conversational memory + Copilot Studio agent memory | 企业 SSO/角色权限 | Dynamics Contact Center 客户 | — |
| **Lakera / Galileo / Patronus** | 安全/评测配套 | — | 护栏 | 多行业 | B/C 轮 |
| **Arize / Langfuse** | 观测/评测配套 | — | trace | 多行业 | B 轮 |
| **OneTrust** | 同意/用途治理 | — | purpose-based consent enforcement | 多行业 | 上市公司 |

---

## 6. 银行能不能直接买 Mem0/Zep 类 infra 自建？—— build vs buy 判断

【分析，结论先行】**能跑通 demo，不能直接替代 CCaaS 里的"受治理客户记忆"产品。** 银行直接买 infra 自建，会撞上四堵墙：

1. **身份合并墙**。Mem0/Zep 的 memory 是按 `user_id` 字符串隔离的。银行的真实难题是：同一个人在 chat 里是未登录 cookie_id、打电话时 IVR 验证了 SSN 后四位、email 里是另一个邮箱——**什么时候、凭什么证据把三条记忆合并到一个客户档案，合并错了就是把 A 客户的贷款信息念给 B 客户（UDAAP/Reg 风险）**。这件事 Mem0/Zep 不管，要 CCaaS 自己的 identity resolution + 认证门槛。
2. **用途隔离墙**。银行要的不是"一个记忆库"，是"服务记忆（可记、可主动召回帮客户）/ 营销记忆（单独同意、可 opt-out）/ 授信风控记忆（FCRA 范围、不许来自客服闲聊）"三个物理或逻辑隔离的库。Zep 有 ABAC，但没有开箱的 purpose taxonomy；Mem0 连这个概念都没有。
3. **删除权级联墙**。客户行使 GDPR 第 17 条 / CCPA 删除权时，要在 T+30 天内：删向量、删 graph edge、删 embedding、删备份、删 trace、删 LLM 对话日志、通知下游模型微调数据集。Mem0/Zep 能删自己库里的，但录音、CRM、数据湖、BI 报表、质检语料都不在它们的 API 后面。
4. **接触中心业务语义墙**。银行客服记忆的核心不是"客户喜欢打电话被直呼其名"，而是"这个客户上周开了一个 dispute 还在 Reg E 10 天时钟里、现在打电话是来催进度"。Mem0/Zep 不懂 case/dispute/Reg E/hold 的语义，这层必须 CCaaS 厂商建。

**【建议 build vs buy 分层】**：
- **买/合作**：底层向量+图存储（Postgres/pgvector、Qdrant/Milvus，或直接 Zep Graphiti 开源自建）、embedding 模型、trace 层（Langfuse/Phoenix）、prompt injection 护栏（Lakera/Galileo）。
- **自己拥有（不能外包）**：身份合并规则、记忆 purpose 分类与权限、记忆台账 UI（客户可见可改可删）、按法域保留期配置、和 CRM/核心银行/录音/质检的数据流、删除级联编排、FS 专属实体模型（case、dispute、claim）。
- **一句话**：Talkdesk 该拥有的是"**受治理的客户记忆产品层**"，底座可以开源/合作，记忆的"法律身份"和"业务语义"绝不能外包。

---

## 7. 客服新贵到底有没有"真记忆"？—— 还是只是 RAG 拼历史？

【分析】把 2026-09 各家产品页拆开看，**绝大多数所谓 memory 实质是下面三层里的某一层，混着说**：

1. **Level 0 — RAG over 历史工单/聊天记录**（2023–2025 主流）：Fore式"learns from past tickets"、Ada/Kore.ai 的 agentic RAG、Intercom Fin 2026-08 之前的状态。特点：没有 per-customer 抽象，每次现捞；客户换个设备/换个渠道就失忆；无法回答"客户 3 个月前说过什么偏好"。
2. **Level 1 — 跨会话同一客户的事实抽取**（2025 下半年起）：Mem0 类 infra 做的事；Sierra ADP、Decagon User Memory、Cresta shared memory 2026 年开到这一层。特点：抽偏好/事件/历史，跨渠道接续。
3. **Level 2 — 带时间维、可审计、可治理的记忆**（2026 年仅 Zep 类 infra 触达，客服产品里几乎没有）：bi-temporal、provenance、用途隔离、客户可看可改可删、TTL。

**结论**：
- 新贵们的"记忆"叙事在 2025-11（Sierra ADP）之前基本停在 Level 0；2026 年集体升到 Level 1；**Level 2 整层在客服产品里是空的**。
- 对 Talkdesk 这是机会窗：不需要发明记忆技术（infra 层开源成熟），需要把 Level 2 的治理面做出来——**这恰恰是 CCaaS 厂商相对于 Mem0/Sierra 的结构性优势**（天生有渠道、有录音、有身份、有租户、有法域配置）。
- 反过来说，Sierra 有 $15B 估值和 BBVA，它会往 Level 2 走；这个窗口按 Sierra 的节奏大概 12–18 个月。

---

## 8. 待核实清单

1. Zep 实际融资总额与是否已有 Series A（公开来源 $0.5M–$2.3M 口径打架）。
2. Letta 融资到底是 $10M 还是 $20M seed（两来源冲突）。
3. Mem0 的 SOC 2 是 Type I 还是已升 Type II（Trust 页只写 Type I，企业页话术含糊）。
4. Sierra ADP / Horizon 的"persistent memory"是否有独立的删除/审计/用途隔离产品页，还是只是营销词（官网只给叙事，没给治理细页）。
5. Decagon User Memory 的保留期、客户可见性、PII 处理细节。
6. Crescendo 是否有 FS 客户（公开案例都是零售）。
7. Supermemory 的企业治理/合规认证。
8. Google Gemini Enterprise 对 per-customer（不是 per-workspace）记忆的 API 化程度。
9. Mem0/Zep 是否有任何银行/券商公开客户 logo（本次检索未见，不排除有但未公开营销）。
10. 各家用的 embedding/向量库是否在数据驻留上满足 EU/金融客户要求（Zep 明示 EU residency，其余待问）。

---

## 9. 主要参考资料（分组，访问日期均为 2026-09-24）

**横向 memory infra**
- Mem0 Series A: https://mem0.ai/series-a
- Mem0 定价: https://mem0.ai/pricing
- Mem0 Trust: https://trust.mem0.ai/
- Mem0 docs: https://docs.mem0.ai/overview
- Zep 定价: https://www.getzep.com/pricing/
- Zep Emerging/Enterprise: https://www.getzep.com/emerging/
- Zep governance 对照: https://www.getzep.com/vectorize-hindsight-alternative/
- Graphiti docs: https://help.getzep.com/graphiti/graphiti/overview
- Letta 官网: https://www.letta.com/
- Letta 定价: https://aiwiki.ai/wiki/letta/edit
- LangMem launch: https://blog.langchain.com/langmem-sdk-launch/
- Cognee seed: https://www.cognee.ai/blog/cognee-news/cognee-raises-seven-million-five-hundred-thousand-dollars-seed
- Cognee pricing: https://www.cognee.ai/pricing
- GitHub API: github.com/mem0ai/mem0, getzep/graphiti, getzep/zep, letta-ai/letta, langchain-ai/langmem, topoteretes/cognee, kingjulio8238/memary, supermemoryai/supermemory（2026-09-24 实查）

**Hyperscaler**
- OpenAI memory FAQ: https://help.openai.com/zh-hans-cn/articles/8590148
- Anthropic memory launch: https://www.anthropic.com/news/memory
- Claude memory docs: https://support.claude.com/en/articles/11817273
- Claude developer memory tool: https://claude.com/it/blog/context-management
- Google private AI memory: https://www.techrepublic.com/article/news-google-private-ai-memory/
- Microsoft Ignite 2025: https://news.microsoft.com/ignite-2025-book-of-news/
- Copilot Studio what's new: https://learn.microsoft.com/microsoft-copilot-studio/whats-new

**客服新贵**
- Sierra Horizon: https://sierra.ai/uk/product/horizon
- Sierra Context Engine: https://sierra.ai/product/context-engine
- Sierra BBVA: https://sierra.ai/uk/blog/sierra-launches-in-korea
- Decagon User Memory: https://decagon.ai/proactive-agents
- Decagon FS: https://decagon.ai/industry/financial-services
- Intercom Fin changelog: https://www.intercom.com/changes/en?page=2
- Intercom Fin 第三方: https://agenticindex.io/vendors/intercom-fin
- Cresta shared memory: https://cresta.com/ai-agent
- Crescendo Influence: https://www.crescendo.ai/news/crescendo-ai-shopping-assistant-shoptalk-2026

**治理/评测/安全**
- Lakera: https://www.lakera.ai/risk/prompt-injection-attacks
- Galileo: https://galileo.ai/blog/best-llm-input-output-validation-tools
- Arize: https://arize.com/docs/phoenix/
- Langfuse: https://langfuse.com/
- OneTrust: https://www.onetrust.com/#solutions
