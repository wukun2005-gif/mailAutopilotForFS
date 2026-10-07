# Deck voiceover (English) — pages 02/15–14/15 · DRAFT for review
Voice: `zh-CN-YunyangNeural`, rate `-15%`. File for TTS input, not deck.
Rules agreed: max 3 infos per page; numbers from deck; deck wins, PRD/report only decide depth; screenshots opened one by one then closed; only demo-2 plays full; caption 1 line. Each bullet carries exactly one idea — never read the slide's own labels back, and each caption states that same idea, so the caption and the narration move together.

---

## 02/15 · Mid-size banks are the beachhead.
Infos: (1) 262-band (2) Larkspur profile.
Script:
- Where we land first: of 8,445 insured US institutions, only the 5-to-150-billion band could buy rather than build — 262 banks, on paper for now.
- Our worked example is Larkspur Bank: 18 billion, fictional, 1.1 million customers, a 420-seat contact center, 50,000 emails a month.
Captions:
- Of 8,445 institutions, 262 banks in the 5–150B band could buy this.
- Larkspur, $18B fictional: 1.1M customers, 420 seats, 50k emails a month.
Actions: none.

## 03/15 · The clock starts at the inbox.
Infos: (1) Reg E clock (2) email slowest/expensive (3) 28% switching tax.
Script:
- An email is a written error notice under Reg E, so the clock starts the moment it lands: 10 business days to act, 45 days to resolve.
- The FDIC counted 136 Reg E violations last year, 74 percent of them in error resolution — an unread inbox is a liability.
- Email is also the slowest but expensive channel the bank runs: 6 to 12 dollars a contact, 27 hours to a first reply, 28 percent of agent time lost switching systems.
Captions:
- Day 0 the clock runs: 10 days to act, 45 days to resolve.
- 136 Reg E violations, 74% in error resolution.
- Email costs $6–12, 27h to reply; 28% of time lost switching systems.
Actions: none.

## 04/15 · Same base, no live caller, same runtime.
Infos: (1) three whys (2) what email gives up (3) blank = opportunity.
Script:
- Why email: it rides the voice install base as an add-on, async mail has nobody on hold, and it runs on the runtime we already ship.
- The scorecard prints both sides: email wins three columns and gives up two — price and time to value.
- Both gaps are ours to close: the $1.50 price is our own assumption, and an auditable number takes 90 days of their mail — where nobody has done it, the blank is the opportunity.
Captions:
- Same base, no live caller, same runtime.
- Email wins three columns and gives up two — price and time to value.
- Nobody has done it — the blank is the opportunity.
Actions: none.

## 05/15 · We automate the work, not the decision.
Infos: (1) sort order (2) Wave 1 vs route-only (3) dispute split.
Script:
- Scope comes from one sort: volume, determinability and identity achievability, gated by regulatory risk. General, servicing and transactions land first.
- Everything reversible goes to the machine; complaints, fraud and off-brief mail are route-only — clocked and handed to a person, never answered autonomously.
- Disputes split the same way: intake is Wave 1, and adjudication stays L0 — a person decides and sends, the AI only triages.
Captions:
- Sort by volume × determinability × identity, gated by risk.
- Route-only is detected and handed over, never auto-answered.
- Dispute intake is Wave 1; at L0 a person decides and sends.
Actions: none (SVG chart, no screenshots).

## 06/15 · The thread is the case.
Infos: (1) nine steps, three roads (2) step 8 three sources (3) zoomshot proof.
Script:
- The thread is the case: nine steps, and after step 5 the matrix picks one of three roads. Only step 8 ever reaches the customer.
- Step 8 does not write — it assembles. [open shot-letter] Blue is the locked template, green is system slots for amounts and dates, purple is the only text a model touches. [close]
- Personalization is name, product, thread history and tone — never a disclosure and never an amount.
Captions:
- Nine steps; after step 5, three roads: auto, one-click, human.
- Step 8 assembles, not writes: template, slots, tissue.
- Personalization never touches a disclosure or an amount.
Actions: open `shot-letter.jpg` once, introduce three colors, close.

## 07/15 · Autonomy is earned, intent by intent.
Infos: (1) R×I→L (2) R3/R4 never (3) graduation path.
Script:
- Every reply is graded twice: action risk R0 to R4, identity I0 to I3. Read them as a product — R times I gives L, where the human sits.
- Four levels, L0 to L3 — but on email R3 high-impact changes are never autonomous, and R4 adjudication and money stay L0: a person decides and sends, permanent.
- Nothing starts autonomous: backtest, shadow, then dual sign-off by compliance and operations, with auto-demotion on drift.
Captions:
- R × I → L: action risk times identity gives the human's seat.
- R3 never autonomous; R4 stays human-signed, permanent.
- Nothing starts autonomous; graduation is earned and reversible.
Actions: none.

## 08/15 · AI nominates, the evidence argues, humans sign the diff.
Infos: (1) five-stage loop (2) six capabilities and where they land (3) "the gates already exist".
Script:
- The engine stays deterministic — that is the compliance story, and it does not change. What changes is who writes the rules.
- Sense, propose, prove, grant, watch — a loop, not a pipeline. The model reads ninety days of human decisions, the drafts people edited and the mail nobody classified, and it proposes.
- Six capabilities, and where they land: graduation proposer, policy compiler and intent discovery in Builder; wave board in Supervisor; pre-empt tag and consequence preview in the agent.
- Every proposal carries four proofs — consistency, the calculation-and-judgment split, approver variance, cohort parity under two points — and two constraints: a monthly allowance, and the existing auto-demotion.
- Grant is a dual signature on a diff, never on a letter. Tightening is immediate and expires; loosening has to earn its way through backtest, shadow and two signatures.
- Then watch feeds back into sense: allowances, drift, rejected nominations. The gates already existed — what was missing was a nominator.
Captions:
- Engine stays deterministic; what changes is who writes the rules.
- Sense, propose, prove, grant, watch.
- Six capabilities, and where they land: Builder, Supervisor, the agent.
- Four proofs and two constraints on every proposal.
- Humans sign the diff, never the letter.
- The gates already exist; what was missing was a nominator.
Actions: hold the slide for the whole page; no camera moves — the loop diagram is the argument, and the six icon cells below it carry the six capabilities.

## 09/15 · Four screens, four proofs.
Infos: (1) four screens (2) demo-2 full film (3) demos 1/3/5 exist but do not play.
Script:
- Four screens on top, four proofs below — one case running through all of them.
- The same case in four hands: [open scr-customer] Customer, no login — the thread is the case, AI disclosed. [close] [open scr-agent] Agent sees the policy verdict, not the model mood. [close] [open scr-supervisor] Supervisor sees the statutory clocks, live. [close] [open scr-admin] Admin writes every limit — R3 and R4 have no switch. [close]
- Then the proof: demo 2, dispute handling,  [fullscreen demo-2, play full, exit fullscreen]
- Demo 1, demo 3 and demo 5 exist but do not play today; their claims sit on the captions — verified in-thread, a fraud target unreachable rather than switched off, and a system that improves itself under a human signature.
Captions:
- Four screens on top, four proofs below — one case.
- The same case in four hands: customer, agent, supervisor, admin.
- Now demo 2 in full: a dispute across 45 days.
- Demos 1, 3 and 5 do not play today; claims on their captions.
Actions: overview first with the full slide held; then open/close 4 screenshots one by one; fullscreen + play demo-2 full + exit; never touch demo-1/demo-3/demo-5.

## 10/15 · Four groups want this customer. Nobody has the email case.
Infos: (1) 4×4 matrix (2) our row (3) 12–18 month window.
Script:
- Four groups want this customer — CCaaS, CRM agents, AI startups and FS specialists — scored on four columns: email-native case, statutory clock, core execution, voice ops.
- Nobody has the email case: CCaaS has voice and execution but no clock, CRM never touches the core, startups have no clock, FS specialists stop at the case.
- Our row is that target state on the same grid, and the window is 12 to 18 months on what already ships — while Freshworks has shipped autonomous email since June 2025.
Captions:
- Four groups scored on four columns: case, clock, core, voice.
- Nobody has the email case — no one has all four.
- Window: 12–18 months on what already ships.
Actions: none.

## 11/15 · One bank's email book is a $4.8M cost base.
Infos: (1) $4.8M base, 3 bars (2) who gets what (3) three levers + inputs.
Script:
- The money: 600,000 emails a year at $8 is a $4.8M cost base, and at the base case 35 percent resolved returns $2.68M — 56 percent of the base.
- The bank keeps that $2.68M; the vendor nets about $205k a bank. Times 262 banks, that is roughly $54M at full adoption.
- Three levers move it together — failed demand, autonomy and copilot uplift — measured from week-one mail, with $1.50 an assumption, not a list price.
Captions:
- 600k emails × $8: base case 35% resolves $2.68M.
- Bank keeps the saving; vendor nets ≈$205k per bank.
- Three levers move together; inputs from their own mail.
Actions: none.

## 12/15 · Three numbers. One pilot.
Infos: (1) VARR/TTR/Trust (2) 59-day path (3) guardrails alongside.
Script:
- Success is three numbers: VARR 25 to 35 percent by six months, median time to resolution under 15 minutes autonomous from a 3.2-day baseline, and Trust, which can veto both.
- Trust is the veto: zero key errors, clocks at 100 percent, regulated intent recall at least 99.5 percent — one miss voids VARR.
- The release path is 59 days — backtest, shadow, L2 graduations, first L3 — with twelve guardrails running alongside.
Captions:
- VARR 25–35% by six months; TTR under 15 minutes autonomous.
- Trust: zero key errors, clocks 100%, recall ≥99.5% — one miss voids VARR.
- 59 days to first L3: backtest, shadow, L2 graduations, then auto.
Actions: none.

## 13/15 · The risks that would end this product.
Infos: (1) risk 01 miss (2) risk 02 attack surface (3) risk 03 numbers.
Script:
- Risk one: a missed intent — half a sentence starts a clock. Recall gates everything.
- Risk two: the inbox is the attack surface — injected text never becomes instruction.
- Risk three: invented numbers — figures come from the system; money stays human-signed. The rest of the register, including sign-off fatigue, is in backup ten.
Captions:
- Risk 1: a missed intent — recall ≥99.5% gates everything.
- Risk 2: BEC and injection — quarantined as data, R3 has no tool.
- Risk 3: invented numbers — slots only, money stays human-signed.
Actions: none.

## 14/15 · One governance layer, three waves.
Infos: (1) three waves, one engine (2) new vs ships.
Script:
- One policy engine and one clock engine, written once by the bank: email now in wave 1, more intents in wave 2, voice and chat after that.
- The new part is the layer, not the channel: the limit matrix, the clock, step-up, dispute intake and email defense — on a stack that already ships.
Captions:
- One engine, three waves: email now, more intents, then voice.
- New is the layer, not the channel; the rest already ships.
Actions: none.
