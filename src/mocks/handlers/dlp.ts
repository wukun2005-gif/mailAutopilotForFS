// DLP / red-line scanner (mock handler #8) — regex + wordlists, pure function
// so it gets direct Vitest coverage. Used by ingest (pre-scan) and the
// respond node (final scan); runtime calls it through MSW, not directly.

export type DlpType = "PAN" | "SSN" | "CVV" | "SECRET_PHRASE" | "CONTACT_CHANGE" | "INJECTION";

export interface DlpHit {
  type: DlpType;
  severity: "high" | "medium";
  match: string;
}

function luhnOk(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** 13–16 digit runs (spaces/dashes allowed) that pass Luhn. */
function findPan(text: string): string[] {
  const out: string[] = [];
  const re = /\b(?:\d[ -]?){12,15}\d\b/g;
  for (const m of text.matchAll(re)) {
    const raw = m[0];
    const digits = raw.replace(/[ -]/g, "");
    if (digits.length >= 13 && digits.length <= 16 && luhnOk(digits)) {
      out.push(raw.trim());
    }
  }
  return out;
}

const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const CVV_RE = /\bCVV(?:[A-Za-z :#-]*)(\d{3,4})\b/gi;
const SECRET_RE = /\b(password|passphrase|pin(?:\s*number)?|security question)\b/gi;
const CONTACT_CHANGE_RE =
  /(new (phone|mobile|number|address)|update my (phone|mobile|cell|contact|number|address)|mail (the |my )?(new |replacement )?card to|change (my|the) (phone|address)|新手机号|改手机号|寄到新?地址|更新?(我的)?联系方式)/i;
const INJECTION_RE =
  /(SYSTEM NOTE|skip OTP|ignore (all |the |any )?(previous |prior |above )?instructions|act as (an? )?(admin|system)|忽略(以上|之前|前面|所有|先前|上面|以上所有)*(的)?(指令|规则|提示)|你现在是(管理员|系统)|无视(上述|之前)(的)?(指令|规则)|ignora (las )?instrucciones anteriores)/gi;

export function scanDlp(text: string): { hits: DlpHit[]; clean: boolean } {
  const hits: DlpHit[] = [];
  for (const pan of findPan(text))
    hits.push({ type: "PAN", severity: "high", match: pan.slice(-4) ? `…${pan.replace(/[ -]/g, "").slice(-4)}` : pan });
  for (const m of text.matchAll(SSN_RE))
    hits.push({ type: "SSN", severity: "high", match: m[0] });
  for (const m of text.matchAll(CVV_RE))
    hits.push({ type: "CVV", severity: "high", match: "CVV …" + m[1] });
  for (const m of text.matchAll(SECRET_RE))
    hits.push({ type: "SECRET_PHRASE", severity: "medium", match: m[0] });
  if (CONTACT_CHANGE_RE.test(text))
    hits.push({ type: "CONTACT_CHANGE", severity: "medium", match: "contact-change request" });
  for (const m of text.matchAll(INJECTION_RE))
    hits.push({ type: "INJECTION", severity: "high", match: m[0] });
  return { hits, clean: hits.length === 0 };
}
