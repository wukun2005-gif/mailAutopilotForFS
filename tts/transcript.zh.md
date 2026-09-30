# 一键演示解说词（中文）

由 `npm run tts` 从 src/demo/scripts.ts 与 src/locales/zh/demo.json 生成，配音 edge-tts zh-CN-XiaoxiaoNeural（女声）。音频路径 public/tts/zh/<key>.mp3。

## trailer90s · 90 秒预告

### t0 · intro · caption 4000 ms · audio 7.5s · trailer.intro

金融行业邮件自动工作流——你接下来看到的每一个动作，都跑在同一个真实 runtime 上。

### t4 · intake · caption 4000 ms · audio 8.1s · trailer.intake · pointer s1.thread

一封未认证的争议邮件在到达时即完成意图识别、立案和起钟——受理环节不需要人。

### t10 · dossier · caption 4000 ms · audio 8.3s · trailer.dossier · pointer s2.policy.section

卷宗屏是同一份运行时：政策逐条给 PASS/FAIL，右侧审计轨把每个判定写成大白话。

### t14 · clocks · caption 4000 ms · audio 7.6s · trailer.clocks · pointer s3.clockboard.all

看板不止当前案件：下面这张表是邮箱里全部未结争议，谁快到期一目了然。

### t16 · approve · caption 3000 ms · audio 8.1s · trailer.approve · pointer s3.queue

法定义务进入主管队列，一键批准——这一下点击是真实的人类动作，不是脚本跳屏。

### t21 · fraud · caption 4000 ms · audio 9.8s · trailer.fraud · pointer s3.fraud.requested

一封 BEC 商业钓鱼邮件被隔离：它要求的联系方式变更在结构上不可达，客户只通过档案内通道被通知。

### t24 · builder · caption 4000 ms · audio 7.8s · trailer.builder · pointer s4.matrix

自主权是“挣来”的：回测、抽样、双签——而且最硬的格子在配置层根本打不开。

### t25 · outro · caption 5000 ms · audio 6.1s · trailer.outro

法律要求确定的地方确定，证据挣到的地方自动，全程可审计。

## email1 · 邮件 1 · 透支费两拍

### 1-3 · day0 · caption 6000 ms · audio 8.9s · email1.publicMailbox · pointer s1.thread.in

Day 0：一封邮件从不在档案里的公共 Gmail 地址进来。发件地址没在客户档案中，只能判到 I1——系统还不知道这封信是谁写的。

### 1-4 · stepup · caption 5000 ms · audio 12.2s · email1.lockedCell · pointer s1.thread.out

透支费退还 × I1 这一格是锁死的：这一封不自动退钱，也不自动写正文。客户收到的是一封固定模板，只告诉她去手机 App 里核验——邮件本身一个链接都没有。

### 1-6 · stepup · caption 5000 ms · audio 7.3s · email1.caseCard · pointer s1.phone.casecard

核验在同一封邮件线程里完成：App 推一条通知，验证码发到档案内手机号，六位码填进去，案件继续自动往下走。

### 1-10 · stepup · caption 6000 ms · audio ? · email1.identityUp · pointer s1.identity

核验通过了，同一封线程里身份从 I1 升到 I3。看右边这一栏依据：发件地址仍然对不上客户档案，但“本次对话已完成核验”“已登录的安全消息会话”两条都过了，面板底部写着核验有效、保持 I3。

### 1-12 · refund · caption 6000 ms · audio 23.6s · email1.i3refund · pointer s1.thread.out

同一套规则用新的身份重新算一次：这一格现在允许自动放行，35 美元透支费退到客户账上，回信还是三段拼装——固定模板、系统槽位、生成语句。发出去之前每封信都要过一遍合规检查，带 AI 身份披露和转人工入口。

### 1-13 · refund · caption 6000 ms · audio 10.5s · email1.provenance · pointer s1.thread.out

同一封信按来源上色：蓝色是固定模板，绿色是系统槽位（姓名、金额、日期、案件号），紫色是生成语句。

### 1-16 · verified · caption 5000 ms · audio 11.8s · email1.verified · pointer s1.trace.entry@last

14 天没有新邮件、没有转人工、质检也没有推翻——审计轨上多出一行：计一次 verified 自主结案。卷宗封存留痕，人工改过的都回流成样本。

### 1-19 · day21 · caption 6000 ms · audio ? · email1.secondRequest · pointer s1.thread.in

Day 21，同一封线程里又来一封：客户第二次要求退还透支费。系统把它并进同一个案子，不新建；身份还是 I3，没有降。

### 1-20 · day21 · caption 5000 ms · audio ? · email1.holding · pointer s1.thread.out

同一天银行回了第二封：先告诉客户已经收到，主管一个工作日内答复，并且明确写了可以要求人工复议。这一封不承诺结果。

### 1-22 · day21 · caption 7000 ms · audio 16.2s · email1.secondWaiver · pointer s2.policy.row.OD-1.FAIL

为什么不自动退：透支费退还规则第一条要求“近 12 个月退免记录 ≤ 1 次”，现在这一栏是 2，所以这条判不通过，格子从自动放行降到一键审批。边界在政策求值结果，不在模型心情。

### 1-24 · day21 · caption 5000 ms · audio 9.7s · email1.l2queue · pointer s3.approvalcard

解释草稿进主管队列——客户始终保留人工复议的入口。发出去同样要过合规检查，带披露和转人工入口。

### 1-27 · day21 · caption 6000 ms · audio ? · email1.explanationSent · pointer s1.thread.out

主管一点批准，解释函当场发回客户这一封线程：写清了为什么这次不能自动退、依据是哪一条、以及仍然可以要求复议。

### 1-30 · day21 · caption 6000 ms · audio 11.4s · email1.secondClosed · pointer s1.trace.entry@last

解释函发出 14 天没有新来件，审计轨上再多一行：第二拍关闭，按人工办结计入报表，纠正和修改回流样本，卷宗封存留痕。

### 1-31 · outro · caption 6000 ms · audio 7.3s · email1.outro · pointer s1.thread

同一意图、同一客户，两种结局——因为那一格的值变了，而每次变化都说得清。

## email2 · 邮件 2 · Reg E 争议跨 45 天

### 2-3 · day0 · caption 7000 ms · audio 25.2s · email2.intake · pointer s1.thread

Day 0 早上 8:14：一封邮件含两个意图——新卡配送状态和一笔 247.18 美元争议。到达即立案，Reg E 法定时钟立刻起算，即使身份是 I0 也不推迟。语言英语、弱势阴性、欺诈阴性与意图并行；同线程合并、别名归一，重复送达自动去重。

### 2-5 · day1 · caption 6000 ms · audio 11.2s · email2.detailDenied · pointer s1.phone.push

Day 1 客户追问交易明细。客户未提及的交易属于 I3 字段档，而当前线程是 I2——拒绝披露，同时推送 App 核验。

### 2-9 · day1 · caption 5000 ms · audio 6.5s · email2.detailReleased · pointer s1.thread

同线程 step-up 升到 I3 后，争议交易明细才放出，且只给末四位。

### 2-11 · day6 · caption 5000 ms · audio 11.7s · email2.materials · pointer s1.thread

Day 6 签署声明作为附件到达。OCR 置信度足够，自动入卷；低置信则留给人。缺材料从不暂停法定时钟。

### 2-15 · bd10 · caption 5000 ms · audio 14.9s · email2.clock48h · pointer s3.clockboard.all

第 10 个工作日是临时贷记到期日，48 个自然小时内看板变红——时间是算出来的。下方这张表是邮箱里全部未结争议：谁快到期、哪笔已入账，一眼看完。

### 2-18 · restart · caption 7000 ms · audio 18.8s · email2.restart · pointer s2.resumebanner

批准前我们杀掉进程再重新打开。一个全新 runtime 重新挂上同一批 checkpoint：待审批项还在，打款动作也不会执行两次——网关账本与服务端双层幂等去重。这正是长流程 autopilot 的工程难点。

### 2-22 · bd10 · caption 5000 ms · audio 8.9s · email2.pcApproved · pointer s1.thread

一键批准临时贷记，客户线程里立刻出现到账通知邮件——同样带 AI 披露与转人工入口。

### 2-24 · day40 · caption 5000 ms · audio 9.0s · email2.evidence · pointer s1.thread

Day 40 商户凭证作为邮件到达。争议裁决是 R4——永久属于人。AI 起草，人决定。

### 2-27 · day40 · caption 5000 ms · audio 8.4s · email2.adjudication · pointer s3.approvalcard

主管维持“有错误”的裁决；结果函在同一轮里链式进入 L1 人工签发，外发同样过闸门。

### 2-31 · day45 · caption 6000 ms · audio 13.4s · email2.closed · pointer s1.thread

Day 45，在 POS 借记卡 90 天上限内：结果函已经躺在客户线程里，争议带着完整决策卷宗关闭、WORM 留存；纠正与修改回流样本。

### 2-32 · outro · caption 6000 ms · audio 7.4s · email2.outro

一个跨系统、跨 45 天、扛得住进程重启的案件——每个高风险动作上都有人。

## email3 · 邮件 3 · BEC 欺诈隔离

### 3-4 · day2 · caption 7000 ms · audio 19.7s · email3.signals · pointer s3.quarantine

Day 2：jane.d0e@outlook.com——档案地址的形近字仿冒。SPF、DKIM 通过，但 DMARC 是 none；显示名被伪造；附件里还嵌入了“skip OTP”指令，而它只被当作数据、不是命令。身份保障判 I0。

### 3-5 · day2 · caption 6000 ms · audio 14.7s · email3.noTools · pointer s3.fraud.requested

邮件要求改手机号、把卡寄到新地址。查三维矩阵走隔离分支：邮件渠道里根本没有注册这类工具——按钮在配置层置灰，在工具层也不存在对应函数。

### 3-8 · day2 · caption 6000 ms · audio 8.2s · email3.onfile · pointer s1.phone.sms

确认欺诈后，手机上收到的警示短信只发给档案内号码——绝不发给攻击者控制的地址。

### 3-11 · day2 · caption 5000 ms · audio 8.6s · email3.sar · pointer s3.sar

配套记录由锁定模板生成，只含事实字段、无结论性措辞，也永远不会发往伪造地址。

### 3-12 · day2 · caption 6000 ms · audio 9.5s · email3.closed · pointer s3.fraud.onfile

确认后案件关闭：on-file 短信已发、SAR 锁定模板归档、卷宗 WORM 留存；误报与漏报样本回流检测器。

### 3-13 · outro · caption 6000 ms · audio 6.9s · email3.outro

prompt injection、BEC、ATO，遇到的是一个攻击面在设计时就闭合的系统。

## builder · Builder · 回测与毕业

### b1 · matrix · caption 6000 ms · audio 9.6s · builder.intro · pointer s4.matrix

自主权不是靠滑块配出来的——它按意图逐个“挣来”，而这个 R × I 矩阵由生产环境同一个决策函数渲染。

### b3 · backtest · caption 5000 ms · audio 16.6s · builder.replay · pointer s4.backtest.regret

回放 90 天录制数据集：一致率、免修改批准率、受监管召回、关键错误、单案成本，再加两列遗憾率——自动放行与保守放行各每百万件。数字全是录制好的 fixture。

### b4 · sampling · caption 6000 ms · audio 9.9s · builder.sampling · pointer s4.sampling.tiers

三层抽样——分层、随机、对抗——覆盖三个抽样框，包括根本没建工单的进件。C 层单独报告。

### b6 · sampling · caption 5000 ms · audio 15.3s · builder.unsignable · pointer s4.negative.why

阴性复标是独立的 1,200 件批次，不在那 350 件里。如果检测器判阴性的样本不独立复标，召回判据立刻变成“不可签”——只看阳性样本量永远算不出漏检率。

### b11 · signoff · caption 5000 ms · audio 9.8s · builder.promoted · pointer s4.promote.notice

合规和业务负责人双签：shadow 意图被提升，下一封同类邮件立刻按新级别运行——还是同一个 runtime。

### b13 · never · caption 6000 ms · audio 10.9s · builder.r3never · pointer s4.matrix.never

改联系方式是 R3。点这些格子：没有反应。配置层禁用、工具层无函数——没有任何设置能把它们打开。

### b15 · rare · caption 5000 ms · audio 11.2s · builder.rare · pointer s4.conformal

电汇召回是稀有意图：90 天永远攒不够样本量。它保持人工，并由 conformal 弃权兜底把不确定的案件转给坐席。

### b16 · outro · caption 6000 ms · audio 5.8s · builder.outro

这个 demo 里的每一个自动动作，都能追溯到监管能接受的证据。
