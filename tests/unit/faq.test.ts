// FAQ grounding for the live probe: retrieval, prompts, recorded fallback.
import { describe, expect, it } from "vitest";
import {
  buildFaqSystemPrompt,
  detectFaqLang,
  faqSourceLine,
  recordedFaqAnswer,
  retrieveFaq,
} from "@/../server/faq.ts";

describe("faq grounding", () => {
  it("matches branch hours in zh", () => {
    const m = retrieveFaq("你们的网点营业时间是？");
    expect(m.length).toBeGreaterThan(0);
    expect(m[0]!.chunk.id).toBe("branch-hours");
  });

  it("matches ATM fee in en", () => {
    const m = retrieveFaq("Is there a fee for ATM withdrawals?");
    expect(m.length).toBeGreaterThan(0);
    expect(m[0]!.chunk.id).toBe("atm-fee");
  });

  it("returns nothing for out-of-scope questions", () => {
    expect(retrieveFaq("讲个笑话")).toHaveLength(0);
    expect(recordedFaqAnswer("讲个笑话")).toBeNull();
  });

  it("detects language", () => {
    expect(detectFaqLang("营业时间？")).toBe("zh");
    expect(detectFaqLang("What are fees?")).toBe("en");
  });

  it("pins the system prompt to retrieved chunks", () => {
    const m = retrieveFaq("卡丢了怎么办？");
    const p = buildFaqSystemPrompt(m, "zh");
    expect(p).toContain("只依据以下资料回答");
    expect(p).toContain("挂失补卡");
  });

  it("refuses without material", () => {
    const p = buildFaqSystemPrompt([], "zh");
    expect(p).toContain("不在本次演示的资料库中");
  });

  it("recorded fallback carries the source line", () => {
    const a = recordedFaqAnswer("透支费是多少？");
    expect(a).toContain("35 美元");
    expect(a).toContain("来源：");
  });

  it("source line lists matched chunks", () => {
    const m = retrieveFaq("How do I reach customer service by phone?");
    expect(faqSourceLine(m, "en")).toContain("Sources:");
  });
});
