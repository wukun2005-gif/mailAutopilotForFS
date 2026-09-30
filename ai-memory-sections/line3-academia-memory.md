# Line 3 · 学术界最新进展：AI Memory（跨渠道客户记忆）

> 本文件是「AI Memory for Financial Services」产品调研 v0.1 的第 3 条线底稿。
> 视角：CCaaS 厂商为金融机构构建跨 voice/chat/SMS/email、跨时间的客户记忆能力。
> 检索日期：**2026-09-24（America/New_York）**。所有 arXiv 编号均经本轮检索核实；数字一律标注口径，查不到即写「未公开/待核实」。
> 证据徽章：【事实】= 可溯源论文/官方页；【分析】= 基于事实的推断；【假设】= 尚无证据的判断；【待核实】= 本轮未拿到一手出处。

---

## 0. 术语速查（首次出现的行业黑话，配大白话）

- **LLM agent（大模型智能体）**：不只是聊天，还能自己决定调工具、查数据库、多步行动的 AI 程序。
- **memory / 记忆**：把过去对话里"值得记住的事实"写下来、下次对话能翻出来用的能力。区别于把整段聊天记录塞进上下文（那叫 RAG/长上下文）。
- **episodic / semantic / procedural memory**：认知科学借来的三层记忆——"经历过的具体事件"（上次客户说过什么）、"提炼出的事实/画像"（客户偏好）、"怎么做某事的流程"（解决这类问题的步骤）。CoALA 框架用这套切分。
- **RAG（Retrieval-Augmented Generation）**：生成答案前先从资料库/向量库检索相关片段拼进提示词。
- **embedding（向量嵌入）**：把一段文字压成一串数字，意思相近的文字数字也相近，用来做"按语义找东西"。
- **vector DB（向量数据库）**：专门存 embedding、按相似度检索的数据库，是记忆最常见的底座。
- **temporal knowledge graph（时序知识图谱）**：把事实存成"节点+关系+时间区间"的图，能回答"什么时候成立、什么时候变了"。
- **machine unlearning（机器遗忘）**：让模型/系统在不整体重训的前提下，把某条指定数据的影响擦掉。
- **indirect prompt injection（间接提示注入）**：攻击者不直接对模型说话，而是把恶意指令埋在模型会读到的外部内容里（邮件正文、网页、聊天记录），等模型"读到就中招"。
- **memory poisoning（记忆投毒）**：把假的/恶意的"记忆"写进智能体的长期记忆库，让它以后反复中招——这次写进去，以后自动生效。

---

## 1. 学术地图（方向 × 代表论文/机构 × 链接 × 年份 × 成熟度 × 对本产品含义）

成熟度分三档：**实验室**（论文原型，未工程化）/ **早期落地**（有开源或商业早期产品）/ **生产可用思路**（结论被工业界普遍接受，可直接进 PRD）。

| 方向 | 代表论文 / 机构 | 链接（检索日 2026-09-24） | 年份 | 成熟度 | 对本产品（金融 CCaaS 记忆）的含义 |
|---|---|---|---|---|---|
| 综述：agent 记忆机制分类 | *A Survey on the Memory Mechanism of LLM-based Agents*，Zeyu Zhang 等（中国人民大学；ACM TOIS 2025） | https://arxiv.org/abs/2404.13501 | 2024 | 生产可用思路 | 给出"存储→检索→反思→更新"的标准设计骨架，可直接当 PRD 的记忆模块拆解框架 |
| 综述：认知架构/记忆分类学 | *Cognitive Architectures for Language Agents (CoALA)*，Sumers, Yao, Narasimhan, Griffiths（TMLR） | https://arxiv.org/abs/2309.02427 | 2023 | 生产可用思路 | episodic/semantic/procedural 三层记忆是业界事实标准术语，用于本报告"记忆分层" |
| 经典架构：OS 式分层记忆 | *MemGPT: Towards LLMs as Operating Systems*，Packer 等（UC Berkeley，后商业化成 Letta） | https://arxiv.org/abs/2310.08560 | 2023 | 早期落地 | main/archival memory block + 自管理读写，是"agent 自己管记忆"的源头；Letta 即其商业化 |
| 经典架构：记忆流+反思 | *Generative Agents: Interactive Simulacra of Human Behavior*，Park 等（Stanford，UIST） | https://arxiv.org/abs/2304.03442 | 2023 | 实验室 | memory stream（按时间存）+ reflection（定期把经历提炼成更高层结论），"反思生成画像"的原型 |
| 架构：主动式记忆（agentic memory） | *A-Mem: Agentic Memory for LLM Agents*，Moon 等 | https://arxiv.org/abs/2502.12110 | 2025 | 早期落地 | 记忆自组织成图、自动写入/反思/用户画像，LoCoMo 上显著优于固定 RAG；方向是"写入时就提炼" |
| 架构：遗忘曲线/用户画像 | *MemoryBank: Enhancing LLMs with Long-Term Memory*，Zhong 等 | https://arxiv.org/abs/2305.10250 | 2023 | 实验室 | 用 Ebbinghaus 遗忘曲线给记忆打衰减分、越用越牢；为"TTL 自动遗忘/重要性加权"提供学术依据 |
| 架构：神经科学启发图谱检索 | *HippoRAG: Neurobiologically Inspired Long-Term Memory*，Gutiérrez 等（NeurIPS） | https://arxiv.org/abs/2405.14831 | 2024 | 早期落地 | 把文档切成开放知识图谱三元组 + Personalized PageRank 做多跳检索，多跳问答强于普通 RAG |
| 架构：时序知识图谱（商业对照） | *Zep: A Temporal Knowledge Graph Architecture for Agent Memory*，Rasmussen 等（Graphiti/getzep） | https://arxiv.org/abs/2501.13956 | 2025 | 早期落地 | bi-temporal（双时间）边，能回答"某事实何时成立/何时被改"；DMR 基准 94.8% vs MemGPT 93.4%。直接对标 Mem0/Zep 赛道 |
| 基准：超长对话记忆 | *Evaluating Very Long-Term Conversational Memory (LoCoMo)*，Maharana 等 | https://arxiv.org/abs/2402.17753 | 2024 | 生产可用思路 | 10 段超长对话、1986 问；结论见 §2——模型今天时序推理仍显著弱于人 |
| 基准：聊天助手长期记忆 | *LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory*，Wu 等（新加坡国立等） | https://arxiv.org/abs/2410.10813 | 2024 | 生产可用思路 | 实测 ChatGPT 自带记忆远不如"把全部历史读一遍"，见 §2 |
| 安全：间接提示注入命名 | *Not what you've signed up for…(Indirect Prompt Injection)*，Greshake 等（CISPA/Saarland） | https://arxiv.org/abs/2302.12173 | 2023 | 生产可用思路 | 首次系统化"外部内容=指令"的风险；金融场景里客户邮件/聊天记录不可信 |
| 安全：注入攻击基准 | *INJECAGENT: Benchmarking Indirect Prompt Injections in Tool-Integrated LLM Agents*，Zhan 等（Stanford） | https://arxiv.org/abs/2403.02691 | 2024 | 生产可用思路 | 1054 用例；ReAct 提示的 GPT-4 有 24% 被攻击成功——agent 越有工具权限越危险 |
| 安全：动态攻防环境（含银行） | *AgentDojo: A Dynamic Environment to Evaluate Prompt Injection Attacks and Defenses*，Debenedetti 等 | https://arxiv.org/abs/2406.13352 | 2024 | 早期落地 | 97 个真实任务，含 email 客户端、**banking（银行）**场景；防御普遍"降攻击率也降任务成功率" |
| 安全：记忆注入攻击 | *A Practical Memory Injection Attack against LLM Agents (MINJA)* | https://arxiv.org/abs/2503.03704 | 2025 | 早期落地 | 仅靠正常交互就能把恶意记录写进记忆库，再借特定受害者触发——"教坏记忆"的真实威胁模型 |
| 安全：记忆投毒（持久化） | *When Agents Remember Too Much: Memory Poisoning Attacks (GhostWriter)*，Torres 等 | https://arxiv.org/abs/2607.06595 | 2026 | 早期落地 | 注入成功率约 98%、平均激活率约 60%；一次性投毒、跨会话反复生效 |
| 安全：休眠式记忆投毒 | *Hidden in Memory: Sleeper Memory Poisoning in LLM Agents* | https://arxiv.org/abs/2605.15338 | 2026 | 实验室 | 攻击者改外部文档→助手据此存一条关于用户的假记忆→跨多轮沉睡后复现 |
| 安全：跨用户/多智能体记忆泄露 | *Topology Matters: Measuring Memory Leakage in Multi-Agent LLMs (MAMA)*；*PrivacyPeek* | https://arxiv.org/abs/2512.04668 ；https://arxiv.org/abs/2606.00152 | 2025–2026 | 早期落地 | 共享记忆状态会让 A 用户的数据从 B 用户答案里冒出来；PrivacyPeek 1182 用例覆盖金融/客服域 |
| 治理：机器遗忘综述 | *Machine Unlearning: A Comprehensive Survey* | https://arxiv.org/abs/2405.07406 | 2024 | 生产可用思路 | 系统梳理"删数据要删到哪一层"：参数级 vs 检索库级 |
| 治理：RAG 里做遗忘 | *When Machine Unlearning Meets RAG: Keep Secret or Forget Knowledge?* | https://arxiv.org/abs/2410.15267 | 2024 | 早期落地 | 对闭源模型不改权重，只改外部知识库即可"模拟遗忘"——记忆删除的工程主路线 |
| 治理：遗忘验证综述 | *Towards Reliable Forgetting: A Survey on Machine Unlearning Verification* | https://arxiv.org/abs/2506.15115 | 2025 | 实验室 | "怎么证明真的忘掉了"（certified deletion）仍是开放难题 |
| 隐私：agent 数据中心隐私综述 | *Agents That Know Too Much: A Data-Centric Survey of Privacy in LLM Agents* | https://arxiv.org/abs/2606.26627 | 2026 | 早期落地 | 明确把"持久化记忆"列为最高风险面之一：跨会话、跨用户、难审计 |

> 备注【待核实】：任务书里提到的 "MemoRAG" 本轮命中的是 arXiv 2409.05591《MemoRAG: Boosting Long Context Processing with Global Memory-Enhanced Retrieval Augmentation》（https://arxiv.org/abs/2409.05591 ）；文献中另有 Qian 等 2025 同名系统，二者是否同一工作**待核实**，本报告不据此下结论。

---

## 2. 模型今天长期记忆能力的真实边界（LoCoMo / LongMemEval 结论）

【事实】两个最常被引用的长期对话记忆基准，结论高度一致：

1. **长上下文 / RAG 有用，但远没到"过目不忘"。** LoCoMo（arXiv 2402.17753，2024）报告：把长上下文 LLM 或 RAG 接上，问答比基线提升 **22%–66%**，但仍**比人类水平低约 56%**；其中**时序推理（temporal reasoning）落后人类约 73%**——也就是"三个月前那次到底是改了密码还是重置了 PIN"这类带时间先后的问题最容易错。
2. **对抗性问题是重灾区。** 同一论文：面对"陷阱式/对抗性"提问，长上下文模型表现比基线**再低约 83%**——意味着有人故意诱导时，模型会自信地说错。
3. **"自带记忆" ≠ "读完所有历史"。** LongMemEval（arXiv 2410.10813，2024）实测 ChatGPT：
   - **Offline Reading**（把全部历史一次读进上下文，理想上界）：GPT-4o ≈ **91.8%**；
   - **ChatGPT 在线自带记忆**：GPT-4o ≈ **71.1%**，GPT-4o-mini ≈ **57.7%**。
   - 也就是说，同一模型、同一份历史，靠产品化的长期记忆只能还原 6–7 成，比"全量读一遍"掉 20–34 个百分点。

【分析】对产品的硬约束：
- 记忆系统的价值不是"替代 CRM 里已有的记录"，而是**把分散在历史会话里的事实结构化、按时间正确地调出来**。但今天的模型**在时间先后、多跳、被诱导这三类问题上仍会出错**。
- 因此金融场景不能让记忆"自动下单/自动授信"，只能**做坐席/客户的参考性提示（pre-contact brief）**，关键事实仍要落到受控的 CRM/核心系统，并保留"这条记忆是哪天、哪次会话、由谁确认的"溯源。
- "记忆准确率"这个厂商宣传数字（各家常报 85%–95%）【待核实】几乎都来自各自私有测试集，**没有跨厂商统一口径**，采购时必须要求对方在 LoCoMo/LongMemEval 或本行脱敏数据上复现。

---

## 3. 记忆安全：投毒 / 串扰 / 删除攻击的最新攻防

【事实】这是 2025–2026 学术上爆发最快的方向，核心结论：**一旦记忆跨会话持久化，攻击面从"这次对话"变成"以后所有对话"。**

**(a) 间接提示注入是入口。** Greshake（arXiv 2302.12173）首次系统化；INJECAGENT（arXiv 2403.02691）量化：ReAct 提示的 GPT-4 有 **24%** 被外部内容注入成功；AgentDojo（arXiv 2406.13352）含 **e-banking 任务**，并发现常见防御（PI Detector 等）在压低攻击率的同时**也压低正常任务成功率**——安全与可用要做工程权衡，不是装个过滤器就完事。

**(b) 记忆投毒 = "这次写进去，以后自动生效"。**
- MINJA（arXiv 2503.03704）：攻击者**只通过正常对话**就能把精心构造的恶意记录写进记忆库，再借某个受害者特定关键词触发（论文用医疗 agent、病人 ID 举例）。
- GhostWriter（arXiv 2607.06595）：注入成功率约 **98%**、平均激活率约 **60%**，且分"注入→后续检索激活"两阶段，单次攻击跨会话持续生效。
- Sleeper / MemoryGraft（arXiv 2605.15338 / 2512.16962）：攻击者改一个网页/文档，助手读后**存成一条关于用户的假记忆**，沉睡多轮后被重新唤起；MemoryGraft 专门模仿"被检索到的成功经验"来带偏行为。

**(c) 跨用户串扰 / 隐私泄露。** 多智能体/多租户共享记忆状态时，一个用户写入的 PII 会从另一个用户的回答里冒出来（MAMA arXiv 2512.04668；PrivacyPeek arXiv 2606.00152，覆盖金融、客服等 16 个域）。MemLeak（arXiv 2606.29788）进一步发现：即便做了内容级删除，**图片等多模态记忆仍有约 2% 残留在语义通道里**。

【分析】对产品的缓解设计（与 Line 5 合规章呼应）：
- **记忆写入要分级、要审核**：客户原话不得直接"信仰"为事实；高置信/敏感记忆（金额、身份、地址）需来源标注 + 低置信只参考不行动。
- **记忆与权限绑定**：写记忆的会话和读记忆的查询都要带 tenant/customer_id，向量库按租户物理隔离，杜绝跨用户串扰。
- **记忆要可删、可审计**：被投毒的记忆必须能一键定位、下架、追溯是哪次会话写的（见 §4）。
- **工具调用边界做确定性拦截**，不要只靠模型"自觉"识别注入——AgentDojo 类研究表明纯模型防御会伤正常业务。

---

## 4. 被遗忘权在向量检索系统里技术上怎么做

【事实】学术与工程现状分三层：

1. **参数级 machine unlearning（最难、最贵）。** 综述 arXiv 2405.07406、2209.02299（ACM TIST 2025）梳理：要从模型权重里真正抹掉某条数据，需要 SISA 式分片重训（Bourtoule 等，IEEE S&P 2021）或 certified unlearning（给出"等价于从零重训"的数学保证）。这条路线**计算贵、证明难**，对闭源商用模型基本不可行。
2. **检索库级遗忘（工业界主路线，便宜）。** 当记忆存放在外部向量库/知识库、模型靠 RAG 取用时，**删除 = 把对应向量/文档/图谱节点及其索引删掉**，无需动模型权重。arXiv 2410.15267《When Machine Unlearning Meets RAG》明确：对闭源 LLM，只改外部知识库即可"模拟遗忘"。这正是本产品最现实的删除路径。
3. **"证明真的忘了"仍是开放难题。** 遗忘验证综述 arXiv 2506.15115 指出：删除后能否数学上证明该数据不再影响输出（certified deletion）在深度学习里仍无成熟方案；实践中只能做到**工程级删除 + 审计日志 + 抽样验证**。

【分析】对产品的工程含义（governed memory 的技术底座）：
- **每条记忆带主键与来源指针**（哪次 interaction、哪个客户、哪个渠道写入），删除权请求落到这条记录 → 向量 + 图谱节点 + 原文三处级联删除，并留删除审计记录。
- **"软删除/墓碑（tombstone）"策略**：先标记失效再异步物理删除，保证删除请求可追踪、可汇报。
- **残留风险要写进合规承诺**：embedding 是有损压缩，删除原文后"语义影子"理论上可能残留；MemLeak 类研究说明多模态尤其如此。因此对外承诺应是"**可工程删除并可审计**"，而非"数学上不可恢复"。
- **目的限定（purpose limitation）的技术抓手**：给每条记忆打"用途标签"（服务连续性 / 个性化 / 营销），召回时按用途过滤——这正是 GDPR 第 5 条、PIPL 第 24 条要求的"记这个不能顺手用在那个"。

---

## 5. 学术成熟、但业界尚无产品化案例的候选方向

> 参照上一份报告对 conformal prediction 的处理方式：列证据强度、局限、以及"进 PRD 时能说到什么程度"，避免把论文原型写成已验证产品。

| 候选方向 | 证据强度 | 局限 | 进 PRD 的措辞边界 |
|---|---|---|---|
| **双时间（bi-temporal）知识图谱记忆**：每条事实带"业务生效时间"+"系统记录时间"，能回答"当时客户说的 vs 后来改的" | 中（Zep/Graphiti arXiv 2501.13956 有论文+商业早期产品；HippoRAG 系） | 图谱构建维护成本高；金融实体关系复杂时易出错；无跨厂商大规模 FS 生产证据 | 可说"借鉴时序图谱思路管理记忆的时间有效性"，**不得**说"已验证可替代核心银行系统的事件历史" |
| **遗忘曲线驱动的 TTL / 重要性衰减**：按 Ebbinghaus 曲线自动降低旧记忆权重 | 中（MemoryBank arXiv 2305.10250；多篇 2025–2026 follow-up） | 心理学曲线搬到客服场景无标定；金融记录有法定保留期，不能"自然遗忘" | 可作为**Admin 可配置的保留/衰减策略**，且法定留存字段优先级最高、永不自动衰减 |
| **certified deletion / 遗忘验证**：数学证明删除干净 | 弱（arXiv 2506.15115 明确为开放难题） | 深度学习下无成熟方案 | **不得**对外宣称"保证删除不可恢复"；只能承诺"工程级级联删除+审计+抽样核验" |
| **记忆投毒检测与写入侧审核**：写记忆前判别是否被注入/是否低置信 | 中弱（GhostWriter/MINJA 攻防活跃，但防御多为原型；AgentDojo 显示防御伤可用性） | 没有现成可商用的"记忆防火墙"；误杀正常客户陈述 | 可列为**roadmap 研究项**，本期先用"来源标注+人工复核敏感记忆"兜底 |
| **差分隐私 / 群体经验（collective memory）**：从多客户交互提炼匿名群体经验而不泄露个体 | 弱（概念相关研究存在，无成熟 FS 产品） | 金融数据反演攻击风险高；与个体删除权冲突 | 本期**不做**跨客户可识别的群体记忆；仅可讨论匿名化知识库，需单独合规评审 |
| **反思（reflection）自动生成客户画像**：把多次会话自动提炼成高层偏好 | 中（Generative Agents arXiv 2304.03442；A-Mem） | 自动画像=算法画像，直接触碰 GDPR Art.22 / PIPL 第 24 条自动化决策与反对权 | 可做"草稿画像供坐席参考"，**不得**自动用于授信/营销决策；客户必须可查看/纠正/反对 |

---

## 6. 本线核心发现（给主报告用）

1. **术语与分层已有共识**：CoALA（2309.02427）的 episodic/semantic/procedural 三层 + TOIS 综述（2404.13501）的"存储-检索-反思-更新"骨架，可直接作为本产品记忆模型的设计语言。
2. **能力边界清晰且偏保守**：LongMemEval 证明产品化自带记忆只有理想上界的 6–7 成（GPT-4o 71.1% vs 全量读 91.8%）；LoCoMo 证明时序推理落后人类约 73%、对抗问题再跌 83%。→ 记忆只配做"参考提示"，不配做"自动决策"。
3. **安全是 2025–2026 最热且对金融最致命的方向**：记忆投毒注入成功率约 98%、激活约 60%（GhostWriter），仅靠正常对话就能"教坏记忆"（MINJA）；AgentDojo 已含 e-banking 场景。
4. **删除在工程上是"检索库级删除"，不是改模型**：RAG 式记忆删掉向量/图谱节点即可（arXiv 2410.15267）；但"证明删干净"（certified deletion）仍是开放难题，对外只能承诺工程级删除+审计。
5. **时序图谱（Zep/Graphiti）是学术界与 Mem0/Zep 商业赛道的交汇点**：它证明"记忆要带时间有效性"，但尚无 FS 大规模生产证据，定位应是借鉴而非直接押注。

## 7. 待核实清单（本轮未拿到一手出处）

- [ ] 各厂商宣传的"记忆准确率/召回率"数字——均为私有口径，**无公开可复核基准**，需向厂商索取脱敏复现。
- [ ] MemoRAG 同名论文（2409.05591 vs Qian et al. 2025）是否同一工作。
- [ ] certified deletion 在向量库（pgvector/Qdrant 等）层面有无官方支持的删除一致性保证——本轮只到论文层。
- [ ] 反思自动画像在真实金融客服中的误判率——无公开 FS 案例。
- [ ] 差分隐私群体记忆在金融场景的合规可行性——无成熟产品参照。

## 8. 参考资料（分组，访问日期 2026-09-24）

**综述与架构**：2404.13501 · 2309.02427(CoALA) · 2310.08560(MemGPT) · 2304.03442(Generative Agents) · 2502.12110(A-Mem) · 2305.10250(MemoryBank) · 2405.14831(HippoRAG) · 2501.13956(Zep/Graphiti) · 2409.05591(MemoRAG，待核实同名)
**基准**：2402.17753(LoCoMo) · 2410.10813(LongMemEval)
**安全**：2302.12173(Greshake IPI) · 2403.02691(INJECAGENT) · 2406.13352(AgentDojo) · 2503.03704(MINJA) · 2607.06595(GhostWriter) · 2605.15338(Sleeper) · 2512.04668(MAMA) · 2606.00152(PrivacyPeek) · 2606.29788(MemLeak)
**治理/遗忘/隐私**：2405.07406(unlearning survey) · 2410.15267(RAG unlearning) · 2506.15115(unlearning verification) · 2606.26627(agent privacy survey)
（均为 https://arxiv.org/abs/<编号> 形式。）
