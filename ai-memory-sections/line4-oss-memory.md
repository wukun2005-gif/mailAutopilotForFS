# Line 4：高 star 开源项目实查（AI Memory for Financial Services v0.1）

> 查询日期：2026-09-24（美东）。所有 stars / forks / license / pushed_at 均通过 GitHub REST API（`api.github.com/repos/{owner}/{repo}`）实时拉取，未凭印象。时间为 UTC。
> 视角：CCaaS 厂商（Talkdesk）为金融机构构建跨渠道 AI Memory，判断 build vs buy。
> 术语先解释：**CCaaS**（Contact Center as a Service，云呼叫中心）；**vector DB**（向量数据库，把文字变成一串数字后按"语义相近"检索的库）；**embedding**（把文字转成向量的过程）；**KG / knowledge graph**（知识图谱，把"谁对谁做了什么"存成节点+关系）；**RLS**（Row Level Security，PostgreSQL 行级权限）；**RBAC**（按角色控权限）；**OSS**（开源软件）；**fair-code / source-available**（源码可见但不是 OSI 认证开源，商用有额外限制）。

---

## 1. 实查表

> 列说明：「OSS 治理能力」指该仓库**开源版本自带**的多租户 / 审计 / 删除 / PII 控制；商业云或企业 license 里的能力不计入，标【待核实】。

### 1.1 记忆层（memory infra，本线核心）

| 项目 | Stars | Forks | License（API + LICENSE 文件实查） | 最近 push | 定位（官方描述直译） | 能否商用 | OSS 内企业治理能力 | build-vs-buy 判断 |
|---|---:|---:|---|---|---|---|---|---|
| **mem0ai/mem0** | 65,960 | 7,759 | Apache-2.0 | 2026-09-24 | "The Memory Layer for AI Agents — drop-in memory infrastructure… Built for production"（给 agent 即插即用的记忆层） | 可商用 | 核心是 add/search/entity extraction 原语；RBAC、审计、PII masking、级联删除、SOC2 类合规能力大概率在商业云版，OSS 内未见【待核实：对照 docs 查 feature parity】 | **首选评估起点**。成熟度最高、社区最大，但"受金融监管的治理层"它不白送 |
| **getzep/graphiti** | 31,144 | 3,180 | Apache-2.0 | 2026-09-24 | "Build Real-Time Knowledge Graphs for AI Agents"（时序知识图谱，带时间边） | 可商用 | 引擎自托管；多租户/审计/删除合规需自建；Zep Cloud 为商业版 | **客户事实图谱最值得做 PoC 的开源引擎**——天然适合"客户×产品×事件"的事实建模与时间旅行（查"三个月前客户承诺了什么"） |
| **getzep/zep** | 4,930 | 653 | Apache-2.0 | 2026-09-18 | 仓库描述已变为 "Zep \| Examples, Integrations, & More" | 可商用 | — | ⚠️ **老 Zep 引擎已迁到 graphiti**，此 repo 现在是示例/集成仓库，不要基于它做底座 |
| **letta-ai/letta**（原 MemGPT） | 24,870 | 2,630 | Apache-2.0 | 2026-09-10 | "Platform for stateful agents: AI with advanced memory that can learn and self-improve" | 可商用 | 它是 **agent 运行时**（每个 agent 有自己的记忆文件），不是给 CCaaS 用的"客户共享记忆服务"；多租户/审计在商业版【待核实】 | 适合研究 agent 自治记忆范式，**不适合直接当 CCaaS 记忆中间件** |
| **topoteretes/cognee** | 30,971 | 3,097 | Apache-2.0 | 2026-09-24 | "open-source AI memory platform… self-hosted knowledge graph engine" | 可商用 | 可自托管；多租户隔离、删除 API、PII 处理是否生产可用需实测【待核实】 | graphiti 的直接竞品，适合"全自建图谱记忆"路线时做 A/B |
| **langchain-ai/langmem** | 1,684 | 191 | MIT | 2026-09-09 | LangChain 官方长期记忆库（2025-01 建仓） | 可商用 | 薄抽象库，无独立治理能力，治理取决于底层存储 | 若 agent 栈已选 LangGraph，用它做记忆读写抽象；别当独立产品底座 |
| **langchain-ai/langgraph** | 42,242 | 7,150 | MIT | 2026-09-23 | "Build resilient agents"（agent 编排框架，checkpoint/store 即记忆原语） | 可商用 | checkpoint/store 是原语，治理（保留期、删除、隔离）全部自建 | 编排层不是记忆产品；但记忆 schema 要与其 store 对齐 |
| **kingjulio8238/Memary** | 2,649 | — | MIT | **2024-10-22** | "The Open Source Memory Layer For Autonomous Agents" | 可商用 | 无 | ❌ **停更约 23 个月**，排除 |

### 1.2 Agent / RAG 框架（记忆是其子模块）

| 项目 | Stars | Forks | License（实查） | 最近 push | 定位 | 能否商用 | 备注 |
|---|---:|---:|---|---|---|---|---|
| **microsoft/autogen** | 61,149 | 9,251 | ⚠️ **LICENSE 文件实查为 CC-BY-4.0**（Creative Commons 内容许可，不是软件许可）；最近 commit 2026-04-06，约 5.5 个月无新提交 | 2026-04-15 | "A programming framework for agentic AI" | ❌ **不可按开源软件直接依赖** | 高 star 是历史存量；仓库疑似已转为示例/文档集合（代码仓库用 CC-BY 是反常信号），运行时代码去向【待核实】。记忆模块仅作设计参考 |
| **run-llama/llama_index** | 52,310 | 8,208 | MIT | 2026-09-25 | "Document processing platform for AI"（RAG 框架，带 memory 模块） | 可商用 | memory 是 RAG pipeline 的一环，非独立记忆产品；治理自建 |
| **deepset-ai/haystack** | 26,591 | 3,178 | Apache-2.0 | 2026-09-24 | LLM orchestration，pipeline 内显式 memory | 可商用 | 同上，编排层 |

### 1.3 客服台与前端（客户档案/记忆 UI 参照）

| 项目 | Stars | Forks | License（LICENSE 文件实查） | 最近 push | 定位 | 商用注意 |
|---|---:|---:|---|---|---|---|
| **chatwoot/chatwoot** | 37,164 | 9,034 | 核心 MIT Expat；**`enterprise/` 目录为商业许可** | 2026-09-25 | 开源 omni-channel 客服台（Intercom/Zendesk 替代），有 contact 档案与 inbox | 核心可商用；企业功能需授权。它的 contact 模型是"CRM 式档案 + 对话历史"，**不是 AI 向量记忆**——可作数据模型参照，不可作记忆引擎 |
| **open-webui/open-webui** | 153,092 | 22,394 | ⚠️ **自定义 "Open WebUI License"（source-available，非 OSI 开源）**：≤50 个终端用户才可改 branding；超出须商业授权 | 2026-09-24 | 通用 AI 聊天前端，内置 user memory / knowledge 功能 | ❌ **不能白包装进商业 CCaaS**。但其"用户可见/可管理记忆"的设置页是客户记忆台账 UI 的好参照 |

### 1.4 向量存储（记忆的底座存储）

| 项目 | Stars | Forks | License（实查） | 最近 push | 定位 | 商用 / 治理要点 |
|---|---:|---:|---|---|---|---|
| **pgvector/pgvector** | 23,154 | 1,329 | PostgreSQL License（宽松，类 MIT；GitHub 显示 NOASSERTION 只是没识别） | 2026-09-22 | Postgres 向量相似度搜索扩展 | 可商用。**最大优势：直接继承 Postgres 的 RBAC / RLS（行级权限）/ 审计 / 备份**——金融客户栈里本来就有 Postgres，记忆级联删除与行级隔离最好做 |
| **qdrant/qdrant** | 34,804 | 2,697 | Apache-2.0 | 2026-09-24 | 高性能向量库 | 可商用；collection 级隔离 OSS 有，RBAC/精细多租户/审计在商业版【待核实】 |
| **milvus-io/milvus** | 46,249 | 4,271 | Apache-2.0 | 2026-09-24 | 云原生向量库 | 可商用；企业级 RBAC/审计在 Zilliz 商业版 |
| **weaviate/weaviate** | 16,843 | 1,408 | **双许可**：`wl/` 目录外 BSD-3-Clause，`wl/` 目录内为 Weaviate 商业 license（需 LICENSE_KEY 启用） | 2026-09-24 | 向量库，object+vector 混合搜索 | 核心可商用，但**选功能时要逐文件确认是否落在 `wl/` 目录**，否则触发商业授权 |

---

## 2. 记忆底座：用 Mem0/Zep 类开源还是自建？Talkdesk 该拥有哪一层【分析】

把 AI Memory 拆成三层，build-vs-buy 答案就清楚了：

| 层 | 内容 | 建议 | 理由 |
|---|---|---|---|
| **(a) 存储层** | 向量库 / 图存储 | **买成熟产品，不自研** | pgvector / Qdrant / Milvus 都是生产级、Apache/MIT，差异不在"能不能存"而在"治理功能卖多少钱"。金融场景优先 pgvector——行级权限和级联删除直接复用 Postgres 栈，审计最好做 |
| **(b) 记忆抽象层** | 记忆写入抽取（从对话提炼事实）、去重、过期、召回排序、temporal KG | **先用开源（graphiti 或 mem0）跑通 PoC，12–18 个月内把核心 schema 与召回策略握在自己手里** | chunking/extraction/recall 的工程细节不值得重造；但金融记忆的**schema（哪些事实可记、记事实还是记原文、时间边、置信度）是产品护城河**，不能长期外包给一家同时卖云的初创 |
| **(c) 产品治理层** | contact brief、跨渠道续接、客户记忆台账页、Admin 记忆策略台、目的限定、TTL、删除权、FCRA/UDAAP 隔离、provenance | **Talkdesk 必须自己拥有** | 金融客户买的不是"记得住"，而是"记得住、且记得合规、客户看得见删得掉"。这一层 mem0/zep 都没有现成答案，正是差异化所在 |

**一句话结论**：底座向量库用现成的，记忆引擎先站在 graphiti/mem0 肩膀上，但"受治理的记忆"这层产品逻辑必须自研——因为它才是 Talkdesk 卖给银行的东西，也是监管要求银行自己负责的部分。

**关于 Talkdesk 该拥有哪一层的补充判断**：
- mem0 和 graphiti 都在卖商业云，OSS 版天然会在治理能力（RBAC、审计、PII 策略、删除合规）上留缺口给商业版。这意味着——**直接把 OSS 版塞进金融客户的 VPC，审计与删除权这两关过不了**；要么买商业版，要么把这两块补齐。补齐的部分，就是 Talkdesk 的资产。
- 不要选 letta：它的记忆是"每个 agent 自己的私有自传"，而 CCaaS 需要的是"围绕客户的共享记忆"，范式不匹配。
- 不要在 LangMem / LangGraph store 上重造记忆引擎：它们只是编排原语，没有客户记忆的领域模型。

---

## 3. 看着能用但已停更 / license 有坑的项目【事实+分析】

1. **kingjulio8238/Memary**（2,649 stars，MIT）：最后 push 2024-10-22，**停更约 23 个月**。早期有话题度，但已无人维护，直接排除。
2. **microsoft/autogen**（61,149 stars）：LICENSE 文件实查是 **CC-BY-4.0**（这是给文档/图片用的内容许可，不是软件许可）；最近 commit 停在 2026-04-06，约 5.5 个月无新提交。高 star 是历史存量，仓库疑似已转为示例/文档集合。**不要把它当代码依赖引入**；其记忆设计（记忆流 + 自编辑）可作参考。
3. **getzep/zep**（4,930 stars）：老仓库已空壳化为 examples，真正的引擎在 **getzep/graphiti**。选 Zep 栈时别引错 repo。
4. **open-webui/open-webui**（153,092 stars）：自定义 source-available license，**终端用户 ≤50 才可去 branding**，超出需商业授权。不能作为商业 CCaaS 的基座；只能参考其记忆设置页 UX。
5. **weaviate/weaviate**：核心 BSD-3-Clause，但 `wl/` 目录是商业 license。选型时逐功能确认落点。
6. **chatwoot/chatwoot**：核心 MIT，但 `enterprise/` 目录商业授权；其"客户档案"是 CRM 式字段，不是 AI 记忆，别误用。
7. **pgvector 显示 NOASSERTION**：不是 license 有坑，GitHub 没识别出来；LICENSE 文件实查是 PostgreSQL License（宽松可商用）。

---

## 4. 待核实清单（本线未证实项，交回主线）

- 【待核实】mem0 OSS 版 vs 商业云版的企业治理 feature parity（RBAC、审计日志、PII masking、向量级联删除、多租户隔离粒度）——需查 mem0 docs。
- 【待核实】graphiti OSS 自托管能否实现"被遗忘权"要求的**级联删除**（删除一个实体后，其衍生事实/embedding 是否一并清除，有无 tombstone 机制）。
- 【待核实】cognee 自托管版的多租户模型与删除 API 是否达到金融生产标准。
- 【待核实】Qdrant / Milvus OSS 版是否自带 RBAC 与审计日志，还是只有商业版有。
- 【待核实】microsoft/autogen 的运行时代码现迁到哪个 repo（是否已分裂为独立组织仓库）。
- 【待核实】mem0/graphiti 的记忆删除是否会在向量库留下 embedding 孤儿记录（删了原文但向量还在 → 被遗忘权漏洞）。
- 【待核实】Letta 的记忆是 agent 私有还是可跨 agent 共享同一客户档案。

---

## 参考来源（均为 2026-09-24 实查）

- GitHub REST API：`https://api.github.com/repos/{owner}/{repo}`（stars/forks/license/pushed_at/description）
- LICENSE 文件实查：`https://api.github.com/repos/{owner}/{repo}/contents/LICENSE`（autogen=CC-BY-4.0；weaviate=BSD-3 + Weaviate 双许可；open-webui=自定义；pgvector=PostgreSQL；chatwoot=MIT Expat + enterprise 商业许可）
- memary 候选检索：`https://api.github.com/search/repositories?q=memary+in:name&sort=stars`
