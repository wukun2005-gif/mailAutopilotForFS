// Read-only FAQ library for the live general-inquiry probe (Settings screen).
// Fictional Larkspur Bank public info only — no account data, no write tools.
// Retrieval is keyword overlap (no vector store, per Dev Plan); the LLM must
// answer ONLY from the retrieved chunks and the server appends the source
// line deterministically. Unconfigured/failed live calls fall back to the
// recorded canonical answer of the best-matching chunk.
export interface FaqChunk {
  id: string;
  titleZh: string;
  titleEn: string;
  qZh: string;
  qEn: string;
  aZh: string;
  aEn: string;
  keywords: string[];
  sourceZh: string;
  sourceEn: string;
}

const SRC_ZH = "Larkspur Bank 帮助中心";
const SRC_EN = "Larkspur Bank Help Center";

export const FAQ: FaqChunk[] = [
  {
    id: "branch-hours",
    titleZh: "网点营业时间",
    titleEn: "Branch hours",
    qZh: "你们的网点营业时间是？",
    qEn: "What are your branch hours?",
    aZh: "各网点周一至周五 9:00–17:00，周六 10:00–14:00，周日及法定假日休息。",
    aEn: "Branches are open Mon–Fri 9:00–17:00, Sat 10:00–14:00, closed Sundays and public holidays.",
    keywords: ["营业时间", "营业", "开门", "几点", "关门", "branch", "hours", "open", "close"],
    sourceZh: `${SRC_ZH}・网点营业时间`,
    sourceEn: `${SRC_EN} · Branch hours`,
  },
  {
    id: "atm-fee",
    titleZh: "ATM 取款手续费",
    titleEn: "ATM withdrawal fees",
    qZh: "ATM 取款收手续费吗？",
    qEn: "Is there a fee for ATM withdrawals?",
    aZh: "本行 ATM 取款免手续费；在他行 ATM 取款每笔 2.50 美元。",
    aEn: "Withdrawals at our ATMs are free; other banks' ATMs cost $2.50 per withdrawal.",
    keywords: ["atm", "取款", "取现", "手续费", "withdraw", "cash", "fee"],
    sourceZh: `${SRC_ZH}・ATM 取款手续费`,
    sourceEn: `${SRC_EN} · ATM fees`,
  },
  {
    id: "overdraft-fee",
    titleZh: "透支费",
    titleEn: "Overdraft fee",
    qZh: "透支费是多少？",
    qEn: "How much is the overdraft fee?",
    aZh: "每笔透支 35 美元，每日最多计 3 笔。首次透支可在 App 内申请豁免。",
    aEn: "Overdrafts cost $35 each, at most 3 per day. A first-time waiver can be requested in the app.",
    keywords: ["透支", "overdraft", "od"],
    sourceZh: `${SRC_ZH}・透支费`,
    sourceEn: `${SRC_EN} · Overdraft fee`,
  },
  {
    id: "lost-card",
    titleZh: "挂失补卡",
    titleEn: "Lost card replacement",
    qZh: "卡丢了怎么办？",
    qEn: "What should I do if my card is lost?",
    aZh: "先在 App 内冻结卡片，再致电借记卡背面的客服电话申请补卡，新卡 5–7 个工作日寄达。",
    aEn: "Freeze the card in the app first, then call the number on the back of your debit card for a replacement, which arrives in 5–7 business days.",
    keywords: ["挂失", "丢卡", "丢", "冻结", "补卡", "lost", "freeze", "replace", "stolen"],
    sourceZh: `${SRC_ZH}・挂失补卡`,
    sourceEn: `${SRC_EN} · Lost cards`,
  },
  {
    id: "transfer-limit",
    titleZh: "转账限额",
    titleEn: "Transfer limits",
    qZh: "转账限额是多少？",
    qEn: "What are the transfer limits?",
    aZh: "App 内本人账户之间转账单日 25,000 美元；向他人账户转账单日 5,000 美元。",
    aEn: "In-app transfers between your own accounts: $25,000 per day; transfers to others: $5,000 per day.",
    keywords: ["限额", "转账", "汇款", "limit", "transfer", "send money"],
    sourceZh: `${SRC_ZH}・转账限额`,
    sourceEn: `${SRC_EN} · Transfer limits`,
  },
  {
    id: "dispute",
    titleZh: "错账争议",
    titleEn: "Billing disputes",
    qZh: "发现一笔没见过的扣款怎么办？",
    qEn: "What should I do about an unfamiliar charge?",
    aZh: "请在 60 天内提出争议；受理后我们会在 10 个工作日内先行临时贷记，再展开调查。",
    aEn: "Dispute it within 60 days; after intake we post a provisional credit within 10 business days while we investigate.",
    keywords: ["争议", "错账", "盗刷", "扣款", "dispute", "charge", "fraudulent", "unfamiliar"],
    sourceZh: `${SRC_ZH}・错账争议`,
    sourceEn: `${SRC_EN} · Disputes`,
  },
  {
    id: "contact",
    titleZh: "联系客服",
    titleEn: "Contact us",
    qZh: "怎么联系客服？",
    qEn: "How do I reach customer service?",
    aZh: "请拨打借记卡背面的客服电话；账户类答复只通过 App 内 secure message 发送，不含链接的邮件请勿轻信。",
    aEn: "Call the number on the back of your debit card; account answers only arrive via in-app secure messages — never trust emails with links.",
    keywords: ["电话", "客服", "联系", "phone", "contact", "call", "number", "客服电话"],
    sourceZh: `${SRC_ZH}・联系客服`,
    sourceEn: `${SRC_EN} · Contact us`,
  },
];

export type FaqLang = "zh" | "en";

/** CJK present → zh, otherwise en. */
export function detectFaqLang(query: string): FaqLang {
  return /[\u4e00-\u9fff]/.test(query) ? "zh" : "en";
}

export interface FaqMatch {
  chunk: FaqChunk;
  score: number;
}

/** Keyword-overlap retrieval; only chunks with score > 0 are returned. */
export function retrieveFaq(query: string, topN = 2): FaqMatch[] {
  const q = query.toLowerCase();
  return FAQ.map((chunk) => ({
    chunk,
    score: chunk.keywords.filter((k) => q.includes(k.toLowerCase())).length,
  }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

export function faqAnswer(chunk: FaqChunk, lang: FaqLang): string {
  return lang === "zh" ? chunk.aZh : chunk.aEn;
}

export function faqSource(chunk: FaqChunk, lang: FaqLang): string {
  return lang === "zh" ? chunk.sourceZh : chunk.sourceEn;
}

/** System prompt that pins the model to the retrieved chunks. */
export function buildFaqSystemPrompt(
  matches: FaqMatch[],
  lang: FaqLang,
): string {
  if (matches.length === 0) {
    return lang === "zh"
      ? "你是 Larkspur Bank 客服助手。当前没有可用的参考资料，请只回复：该问题不在本次演示的资料库中，请提问营业时间、手续费、挂失、限额、争议或联系方式。不要编造任何信息。"
      : "You are a Larkspur Bank service assistant. No reference material is available; reply only that this question is outside the demo library and suggest asking about hours, fees, lost cards, limits, disputes, or contact. Do not invent anything.";
  }
  const body = matches
    .map((m, i) => {
      const title = lang === "zh" ? m.chunk.titleZh : m.chunk.titleEn;
      const qa = lang === "zh" ? m.chunk.qZh : m.chunk.qEn;
      const ans = faqAnswer(m.chunk, lang);
      return `【资料${i + 1}：${title}】问：${qa}\n答：${ans}`;
    })
    .join("\n\n");
  return lang === "zh"
    ? `你是 Larkspur Bank 客服助手。只依据以下资料回答用户问题，资料不足时直接说资料里没有，不要编造。\n\n${body}`
    : `You are a Larkspur Bank service assistant. Answer the user ONLY from the material below; if it does not cover the question, say so plainly and do not invent anything.\n\n${body}`;
}

/** Deterministic source line appended server-side to every probe answer. */
export function faqSourceLine(matches: FaqMatch[], lang: FaqLang): string {
  const names = matches.map((m) => faqSource(m.chunk, lang));
  return lang === "zh" ? `来源：${names.join("、")}` : `Sources: ${names.join("; ")}`;
}

/** Recorded fallback: canonical answer of the best chunk + source line. */
export function recordedFaqAnswer(query: string): string | null {
  const lang = detectFaqLang(query);
  const matches = retrieveFaq(query, 2);
  if (matches.length === 0) return null;
  const best = matches[0]!.chunk;
  return `${faqAnswer(best, lang)}\n\n${faqSourceLine(matches, lang)}`;
}
