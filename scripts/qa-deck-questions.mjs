/**
 * Question bank for the answer-comment QA run.
 *
 * Covers deck pages 2–14 (page_index 1–13). Each page gets four questions, each
 * asked by a different role drawn from the seven the owner named, and each
 * written to be *about that page* without repeating its wording — so a wrong
 * answer is visibly wrong rather than a rephrasing of the slide.
 *
 * Every role is used across the run (PMD 5 · EVP 7 · PMVP 6 · SPM 8 · PPM 9 ·
 * SE 7 · PE 10).
 */

export const PERSONAS = {
  PMD:  { role: 'PM department director', name: 'Dana Whitfield' },
  EVP:  { role: 'Engineering VP',         name: 'Marcus Bell' },
  PMVP: { role: 'PM line VP',             name: 'Priya Raman' },
  SPM:  { role: 'Senior PM',              name: 'Sam Okafor' },
  PPM:  { role: 'Principal PM',           name: 'Lena Fischer' },
  SE:   { role: 'Senior Engineer',        name: 'Tomas Ruiz' },
  PE:   { role: 'Principal Engineer',     name: 'Aiko Tanaka' },
};

/** page = the number the deck shows; idx = page_index stored with a comment. */
export const QUESTIONS = [
  /* ── Page 2 · Mid-size banks are the beachhead ───────────────────────── */
  { page: 2, idx: 1, key: 'mid-size-banks-are-the-beachhead',
    title: 'Mid-size banks are the beachhead.',
    p: 'PMD', q: 'If the beachhead is only 262 institutions, how should I structure my PM team — one squad for the whole band, or split it by asset tier?' },
  { page: 2, idx: 1, key: 'mid-size-banks-are-the-beachhead',
    title: 'Mid-size banks are the beachhead.',
    p: 'PE', q: 'The 262 figure comes from an FDIC query. What happens at the edges of the $5B–$150B band — does the product need to behave differently for a bank that just crossed in, or is the band only a sales filter?' },
  { page: 2, idx: 1, key: 'mid-size-banks-are-the-beachhead',
    title: 'Mid-size banks are the beachhead.',
    p: 'SPM', q: 'Larkspur is fictional but it drives the whole ROI. Which of its four profile numbers would actually change product scope if a real prospect differs?' },
  { page: 2, idx: 1, key: 'mid-size-banks-are-the-beachhead',
    title: 'Mid-size banks are the beachhead.',
    p: 'SE', q: 'Fiserv DNA and Q2 are named as the core stack. What does that integration surface really look like — do we read the core ourselves, or go through connectors that already exist?' },

  /* ── Page 3 · The clock starts at the inbox ──────────────────────────── */
  { page: 3, idx: 2, key: 'the-clock-starts-at-the-inbox',
    title: 'The clock starts at the inbox.',
    p: 'PPM', q: 'The 10-business-day and 45-day clocks are statutory, but the 27-hour first reply and the 22% "please call us" rate are assumptions. Which one, if it turns out wrong, breaks the business case first?' },
  { page: 3, idx: 2, key: 'the-clock-starts-at-the-inbox',
    title: 'The clock starts at the inbox.',
    p: 'PE', q: 'A clock starts when the bank receives the mail, not when an agent opens it. Where does that receipt timestamp come from, and how would we prove it to an examiner?' },
  { page: 3, idx: 2, key: 'the-clock-starts-at-the-inbox',
    title: 'The clock starts at the inbox.',
    p: 'EVP', q: 'The 28% of agent time lost to system switching comes from a third-party study. Does our design genuinely remove that switching, or does it just move the same effort into a review queue?' },
  { page: 3, idx: 2, key: 'the-clock-starts-at-the-inbox',
    title: 'The clock starts at the inbox.',
    p: 'PMVP', q: 'Email costs $6–12 a contact and phone $12–20. When I sit with a buyer, do I sell against the channel cost or against the violation exposure?' },

  /* ── Page 4 · Same base, no live caller, same runtime ────────────────── */
  { page: 4, idx: 3, key: 'same-base-no-live-caller-same-runtime',
    title: 'Same base, no live caller, same runtime.',
    p: 'PE', q: 'Email ranks above voice here because there is no live interruption. Is that a product property or a technical one — could a voice agent get the same async character with a callback pattern?' },
  { page: 4, idx: 3, key: 'same-base-no-live-caller-same-runtime',
    title: 'Same base, no live caller, same runtime.',
    p: 'EVP', q: 'The table says the marginal build is the vertical layer alone. What is the honest engineering estimate for that layer, and which of the components we lean on is the weakest link?' },
  { page: 4, idx: 3, key: 'same-base-no-live-caller-same-runtime',
    title: 'Same base, no live caller, same runtime.',
    p: 'SPM', q: 'Chat is marked as a smaller surface than email even though both wait their turn. What exactly makes email the bigger build?' },
  { page: 4, idx: 3, key: 'same-base-no-live-caller-same-runtime',
    title: 'Same base, no live caller, same runtime.',
    p: 'PMD', q: 'Two rows say the work already ships. Should my PM org own those lines or hand them off, and how do we avoid stepping on the teams that own them today?' },

  /* ── Page 5 · We automate the work, not the decision ─────────────────── */
  { page: 5, idx: 4, key: 'we-automate-the-work-not-the-decision',
    title: 'We automate the work, not the decision.',
    p: 'PPM', q: 'Complaints and fraud are route-only at 5% of volume. Is that about the model not being good enough, or about regulatory exposure — and would more evidence ever unlock them?' },
  { page: 5, idx: 4, key: 'we-automate-the-work-not-the-decision',
    title: 'We automate the work, not the decision.',
    p: 'SE', q: 'The sort order is volume × determinability × identity achievability. Which of those three is computed at runtime and which is a judgement that has to be re-made with every bank?' },
  { page: 5, idx: 4, key: 'we-automate-the-work-not-the-decision',
    title: 'We automate the work, not the decision.',
    p: 'PMVP', q: 'Complaints and fraud are the smallest slice by volume but probably the largest by risk. What is the commercial story for leaving the scariest category manual?' },
  { page: 5, idx: 4, key: 'we-automate-the-work-not-the-decision',
    title: 'We automate the work, not the decision.',
    p: 'PE', q: 'Wave 1 and Wave 2 are described as differences in the policy pack. If both run on one engine, what stops a Wave 2 intent being switched on early by a misconfigured limit matrix?' },

  /* ── Page 6 · The thread is the case ─────────────────────────────────── */
  { page: 6, idx: 5, key: 'the-thread-is-the-case',
    title: 'The thread is the case.',
    p: 'PE', q: 'Step 8 is the only place a model writes to a customer, and only the connective tissue. Is that boundary enforced by the prompt or by the structure of the system?' },
  { page: 6, idx: 5, key: 'the-thread-is-the-case',
    title: 'The thread is the case.',
    p: 'SE', q: 'Step 6 is idempotent, but what happens if it acts and then step 8 never sends — does the case reopen somewhere, or does it close quietly?' },
  { page: 6, idx: 5, key: 'the-thread-is-the-case',
    title: 'The thread is the case.',
    p: 'SPM', q: 'Personalization includes a tone tier. Who defines those tiers, and can an agent override one for a single thread?' },
  { page: 6, idx: 5, key: 'the-thread-is-the-case',
    title: 'The thread is the case.',
    p: 'PPM', q: 'Nine steps and three possible roads after step 5. Where does the record of which road was taken live, and could a reviewer reconstruct it a month later?' },

  /* ── Page 7 · Autonomy is earned, intent by intent ───────────────────── */
  { page: 7, idx: 6, key: 'autonomy-is-earned-intent-by-intent',
    title: 'Autonomy is earned, intent by intent.',
    p: 'PE', q: 'R3 is never autonomous over email because the tool functions do not exist on this channel. Is that an architectural guarantee, or a deployment choice someone could reverse later?' },
  { page: 7, idx: 6, key: 'autonomy-is-earned-intent-by-intent',
    title: 'Autonomy is earned, intent by intent.',
    p: 'EVP', q: 'The matrix is four identity grades by five action risks. How much of that is code that already ships versus new engineering, and who maintains it once a bank writes its own limits?' },
  { page: 7, idx: 6, key: 'autonomy-is-earned-intent-by-intent',
    title: 'Autonomy is earned, intent by intent.',
    p: 'PPM', q: 'Money movement has no graduation path at all. What is the risk that this permanent ceiling becomes how customers judge the whole product?' },
  { page: 7, idx: 6, key: 'autonomy-is-earned-intent-by-intent',
    title: 'Autonomy is earned, intent by intent.',
    p: 'SPM', q: 'Auto-demotion on drift is mentioned but not specified. What triggers it, who gets told, and does it happen silently?' },

  /* ── Page 8 · AI nominates, the evidence argues… ─────────────────────── */
  { page: 8, idx: 7, key: 'ai-nominates-the-evidence-argues-humans-sign-the-diff',
    title: 'AI nominates, the evidence argues, humans sign the diff.',
    p: 'PMD', q: 'Six nominators spread across two screens and three roles. Who owns this loop day to day — one PM, or a standing review board with a cadence?' },
  { page: 8, idx: 7, key: 'ai-nominates-the-evidence-argues-humans-sign-the-diff',
    title: 'AI nominates, the evidence argues, humans sign the diff.',
    p: 'SE', q: 'A nomination is a configuration diff. What format is that diff in, and can it be applied atomically or does each bank need a migration?' },
  { page: 8, idx: 7, key: 'ai-nominates-the-evidence-argues-humans-sign-the-diff',
    title: 'AI nominates, the evidence argues, humans sign the diff.',
    p: 'PPM', q: 'Dissent cards are part of the proving step. What counts as dissent, and does it block the grant or is it only recorded?' },
  { page: 8, idx: 7, key: 'ai-nominates-the-evidence-argues-humans-sign-the-diff',
    title: 'AI nominates, the evidence argues, humans sign the diff.',
    p: 'EVP', q: 'The whole loop eats 90 days of decisions as its input. What do we do for a customer who does not have 90 days of clean history to feed it?' },

  /* ── Page 9 · Four screens, four proofs ──────────────────────────────── */
  { page: 9, idx: 8, key: 'four-screens-four-proofs',
    title: 'Four screens, four proofs.',
    p: 'PE', q: 'Four screens on one runtime. Which of them is hardest to keep consistent when the limit matrix changes — the agent workspace or the admin policy screen?' },
  { page: 9, idx: 8, key: 'four-screens-four-proofs',
    title: 'Four screens, four proofs.',
    p: 'SPM', q: 'The customer screen has no login and verifies identity inside the thread. What is the fallback when that verification fails — is there a path that does not end in a phone call?' },
  { page: 9, idx: 8, key: 'four-screens-four-proofs',
    title: 'Four screens, four proofs.',
    p: 'PMVP', q: 'Only four demo films are listed and one number is missing from the sequence. Is that deliberate, and what does the gap say about what we can show a buyer today?' },
  { page: 9, idx: 8, key: 'four-screens-four-proofs',
    title: 'Four screens, four proofs.',
    p: 'SE', q: 'Admin tightens a limit in one click. Does that write a new policy version or mutate the live one, and can it be rolled back?' },

  /* ── Page 10 · Four groups want this customer… ───────────────────────── */
  { page: 10, idx: 9, key: 'four-groups-want-this-customer-nobody-has-the-email-case',
    title: 'Four groups want this customer. Nobody has the email case.',
    p: 'PMVP', q: 'The window is 12–18 months and one competitor already ships autonomous email. What is our wedge if a CCaaS vendor bundles an email case model before we close the first bank?' },
  { page: 10, idx: 9, key: 'four-groups-want-this-customer-nobody-has-the-email-case',
    title: 'Four groups want this customer. Nobody has the email case.',
    p: 'PPM', q: 'One of the four states is "not in public materials". How do we keep that assessment honest if a rival ships it quietly and we only find out mid-deal?' },
  { page: 10, idx: 9, key: 'four-groups-want-this-customer-nobody-has-the-email-case',
    title: 'Four groups want this customer. Nobody has the email case.',
    p: 'EVP', q: 'Core-banking execution is scored as a capability. If those connectors have been shipping for over a year, what is genuinely left for us to build there?' },
  { page: 10, idx: 9, key: 'four-groups-want-this-customer-nobody-has-the-email-case',
    title: 'Four groups want this customer. Nobody has the email case.',
    p: 'SPM', q: 'Our target state marks all four capabilities. Which one is the actual differentiator in a deal, and which are just table stakes?' },

  /* ── Page 11 · One bank's email book is a $4.8M cost base ────────────── */
  { page: 11, idx: 10, key: 'one-bank-s-email-book-is-a-4-8m-cost-base',
    title: "One bank's email book is a $4.8M cost base.",
    p: 'PMVP', q: 'The vendor-side figure multiplies out to roughly $54M at full adoption, with penetration explicitly not assumed. What penetration is the plan actually underwriting in year one?' },
  { page: 11, idx: 10, key: 'one-bank-s-email-book-is-a-4-8m-cost-base',
    title: "One bank's email book is a $4.8M cost base.",
    p: 'SE', q: 'The saving turns on how much we can genuinely finish. Is the resolved-rate range measured anywhere, and what instrumentation would produce that number in production?' },
  { page: 11, idx: 10, key: 'one-bank-s-email-book-is-a-4-8m-cost-base',
    title: "One bank's email book is a $4.8M cost base.",
    p: 'PPM', q: 'The same rate is quoted against two different denominators. Which one do we commit to in a contract, and does the difference change the headline number?' },
  { page: 11, idx: 10, key: 'one-bank-s-email-book-is-a-4-8m-cost-base',
    title: "One bank's email book is a $4.8M cost base.",
    p: 'PMD', q: 'The vendor fee and the seats replaced are both listed. Who in my org owns the seats-replaced conversation with the customer, since it lands on their operations budget?' },

  /* ── Page 12 · Three numbers. One pilot. ─────────────────────────────── */
  { page: 12, idx: 11, key: 'three-numbers-one-pilot',
    title: 'Three numbers. One pilot.',
    p: 'PE', q: 'A single critical error voids the headline number. Is the recall target measured on the bank’s own mail or on our eval set, and who signs off on that measurement?' },
  { page: 12, idx: 11, key: 'three-numbers-one-pilot',
    title: 'Three numbers. One pilot.',
    p: 'SPM', q: 'Time to resolution runs from the arrival timestamp. Does that clock keep running while the customer is being asked for a step-up?' },
  { page: 12, idx: 11, key: 'three-numbers-one-pilot',
    title: 'Three numbers. One pilot.',
    p: 'EVP', q: 'Four phases inside 59 days is tight for an integration. Which phase slips first if the connector work runs a week late, and what is the recovery?' },
  { page: 12, idx: 11, key: 'three-numbers-one-pilot',
    title: 'Three numbers. One pilot.',
    p: 'PPM', q: 'The autonomy rate has three conditions attached. Which of the three is most likely to be gamed by a customer who wants the number to look good?' },

  /* ── Page 13 · The risks that would end this product ─────────────────── */
  { page: 13, idx: 12, key: 'the-risks-that-would-end-this-product',
    title: 'The risks that would end this product.',
    p: 'PE', q: 'Preferring false positives pushes recall up and precision down. Where does the false-positive cost actually land, and can a bank tune the trade-off without breaking the recall gate?' },
  { page: 13, idx: 12, key: 'the-risks-that-would-end-this-product',
    title: 'The risks that would end this product.',
    p: 'SE', q: 'Injected text is quarantined as data and never as instruction. What is the mechanism — a sanitiser before the model, or a structural separation of the two channels?' },
  { page: 13, idx: 12, key: 'the-risks-that-would-end-this-product',
    title: 'The risks that would end this product.',
    p: 'PPM', q: 'If our own judge flips verdicts at that rate, how can an autonomy number be contractual at all?' },
  { page: 13, idx: 12, key: 'the-risks-that-would-end-this-product',
    title: 'The risks that would end this product.',
    p: 'PMVP', q: 'Sign-off fatigue is on the register. What stops one-click approvals from becoming rubber stamps once a customer is running at the target autonomy?' },

  /* ── Page 14 · One governance layer, three waves ─────────────────────── */
  { page: 14, idx: 13, key: 'one-governance-layer-three-waves',
    title: 'One governance layer, three waves.',
    p: 'EVP', q: 'One policy engine written once and applied to every channel. What has to be true in the runtime for a voice agent to reuse the email policy pack without forking it?' },
  { page: 14, idx: 13, key: 'one-governance-layer-three-waves',
    title: 'One governance layer, three waves.',
    p: 'PMD', q: 'The second wave adds a new language and a new regulation under the same policy pack. Who owns that pack as an artifact — a PM or an engineering team?' },
  { page: 14, idx: 13, key: 'one-governance-layer-three-waves',
    title: 'One governance layer, three waves.',
    p: 'SPM', q: 'The second wave mentions a wording review for complaints. Is that a new model capability or a new human review step on top of the existing one?' },
  { page: 14, idx: 13, key: 'one-governance-layer-three-waves',
    title: 'One governance layer, three waves.',
    p: 'PE', q: 'Five of the new pieces are written by the bank itself. What stops two banks from diverging into configurations we can no longer support?' },
];

export const DECK_ID_QA = 'mail-autopilot-fs-qa';
