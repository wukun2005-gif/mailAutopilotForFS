// Deterministic policy engine (Dev Plan §6.5) — the LLM never decides policy.
// This local engine is the source of truth; /mock/policy/evaluate is only a
// network shell that mirrors it. Missing evidence is UNKNOWN, and the gate
// turns UNKNOWN into fail-closed L0.
import type { PolicyCondition, PolicyPack } from "@/mocks/fixtures/index.ts";
import type { PolicyCard, PolicyVerdict } from "./caseState.ts";

export type Evidence = Record<string, unknown>;

export function evalCondition(
  c: PolicyCondition,
  evidence: Evidence,
): { verdict: PolicyVerdict; evidence: unknown } {
  const actual = evidence[c.evidenceKey];
  if (actual === undefined || actual === null)
    return { verdict: "UNKNOWN", evidence: null };
  let pass = false;
  switch (c.comparator) {
    case "lte":
      pass = typeof actual === "number" && actual <= Number(c.value);
      break;
    case "eq":
      pass = actual === c.value;
      break;
    case "in":
      pass = Array.isArray(c.value) && c.value.includes(String(actual));
      break;
  }
  return { verdict: pass ? "PASS" : "FAIL", evidence: actual };
}

export function evaluatePack(
  pack: PolicyPack,
  evidence: Evidence,
  meta: { sourceEmailId: string; degraded?: boolean },
): PolicyCard {
  const conditions = pack.conditions.map((c) => {
    const r = evalCondition(c, evidence);
    return { code: c.code, verdict: r.verdict, evidence: r.evidence };
  });
  const overall: PolicyVerdict = conditions.some((c) => c.verdict === "FAIL")
    ? "FAIL"
    : conditions.some((c) => c.verdict === "UNKNOWN")
      ? "UNKNOWN"
      : "PASS";
  return {
    policyId: pack.policyId,
    version: pack.version,
    intentCode: pack.intentCode,
    effect: pack.effect,
    overall,
    conditions,
    degraded: meta.degraded ?? false,
    sourceEmailId: meta.sourceEmailId,
  };
}

/** True only when every condition PASSED (convenience for act nodes). */
export function passes(card: PolicyCard): boolean {
  return card.overall === "PASS";
}
