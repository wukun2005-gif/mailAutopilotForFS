// Deterministic high-recall dispute detector — the regression safety net
// UNDER the LLM detector. A real CCaaS pipeline keeps a cheap rule layer in
// front of (or alongside) the model: the model may upgrade, but a regulated
// intent (Reg E/Z error notices) must never be silently downgraded when the
// wording matches a known dispute pattern. This module is deliberately
// high-recall / low-precision (it will false-positive on ambiguous mail —
// that routes to human review, which is the safe direction), and it is what
// `npm run eval` pins with 20+ paraphrases (Dev Plan §12.1, set 2).
export interface KeywordHit {
  code: string;
  matched: string;
}

// US dispute / error-notice wording (Reg E debit, Reg Z credit card).
// Patterns are lowercase substring/regex; keep them conservative: when in
// doubt that something IS a dispute, include it.
const DISPUTE_PATTERNS: RegExp[] = [
  /i don'?t recogni[sz]e/,
  /i do not recogni[sz]e/,
  /didn'?t (make|authorize|do|approve)\b/,
  /did not (make|authorize|approve)\b/,
  /unauthori[sz]ed (transaction|charge|payment|debit|withdrawal|purchase)/,
  /not (mine|my (purchase|transaction|charge|payment))/,
  /fraud(ulent)? (charge|transaction|payment|debit|withdrawal|activity)/,
  /\bcharged twice\b/,
  /charged me twice\b/,
  /duplicate (charge|transaction|payment|debit)/,
  /wrong amount\b/,
  /never (received|got) (the|my|that)?\s*(item|goods|merchandise|package|order|cash|money)/,
  /package[^.]{0,40}never (delivered|arrived|showed up)/,
  /not (as )?(described|advertised)\b/,
  /defective\b/,
  /\bdispute[sd]?\b/,
  /file a (dispute|claim|fraud claim)/,
  /error on my (account|statement)\b/,
  /wrong (account|amount|merchant)\b/,
  /\bATM\b.*(didn'?t (give|dispense)|never (gave|dispensed))/i,
  /(didn'?t (give|dispense)|never (gave|dispensed)).*\bATM\b/i,
  /stolen (card|debit card|credit card)/,
  /lost (my )?(card|debit card|credit card)/,
  /card (was|is) stolen/,
  /(refund|reverse) (the |a |my )?(charge|transaction|payment)/,
  /stop (the )?payment/,
  /why (was|did).*(charged|debited)/,
  /transaction i (never|didn'?t) (do|make|authorize|approve)/,
  /someone (else )?(used|made|charged)/,
  /used (my |the )?(card )?without my permission/,
  /not my purchase/,
];

// Reg Z (credit card) billing-error wording, kept separate for triage stats.
const REGZ_PATTERNS: RegExp[] = [
  /credit card.*(charge|billing).*(wrong|error|unauthori[sz]ed|not mine)/,
  /billing error/,
  /unauthori[sz]ed.*credit card/,
];

export interface DetectorResult {
  dispute: boolean;
  regZ: boolean;
  hits: KeywordHit[];
}

export function detectDispute(rawText: string): DetectorResult {
  const text = ` ${rawText.toLowerCase().replace(/\s+/g, " ")} `;
  const hits: KeywordHit[] = [];
  for (const re of DISPUTE_PATTERNS) {
    const m = text.match(re);
    if (m) hits.push({ code: "REG_E_DISPUTE_PATTERN", matched: m[0].trim() });
  }
  let regZ = false;
  for (const re of REGZ_PATTERNS) {
    const m = text.match(re);
    if (m) {
      regZ = true;
      hits.push({ code: "REG_Z_BILLING_ERROR_PATTERN", matched: m[0].trim() });
    }
  }
  return { dispute: hits.length > 0, regZ, hits };
}
