// Handler group #3 — policy evaluation network shell. The real evaluation is
// the local deterministic engine (M2); this handler records traffic and
// simulates the V12→V13 version switch from the fault panel.
import { http } from "msw";
import {
  OD_FEE_WAIVER_V12,
  OD_FEE_WAIVER_V13,
  OD_FEE_WAIVER_V14,
  POLICY_PACKS,
  REGE_INTAKE_V3,
  REGE_POS_INVEST_90,
  type PolicyCondition,
} from "@/mocks/fixtures/index.ts";
import { faultController } from "@/tools/faultController.ts";
import { envelope, jsonError, jsonOk, mockLatency } from "./util.ts";

type Verdict = "PASS" | "FAIL" | "UNKNOWN";

function compare(c: PolicyCondition, evidence: Record<string, unknown>): Verdict {
  const actual = evidence[c.evidenceKey];
  if (actual === undefined || actual === null) return "UNKNOWN";
  switch (c.comparator) {
    case "lte":
      return typeof actual === "number" && actual <= Number(c.value)
        ? "PASS"
        : "FAIL";
    case "eq":
      return actual === c.value ? "PASS" : "FAIL";
    case "in":
      return Array.isArray(c.value) && c.value.includes(String(actual))
        ? "PASS"
        : "FAIL";
  }
}

function evaluate(policyId: string, evidence: Record<string, unknown>) {
  let pack = POLICY_PACKS[policyId] ?? OD_FEE_WAIVER_V12;
  if (pack.policyId === "OD_FEE_WAIVER" && faultController.isOn("policyV14")) {
    pack = OD_FEE_WAIVER_V14;
  } else if (pack.policyId === "OD_FEE_WAIVER" && faultController.isOn("policyV13")) {
    pack = OD_FEE_WAIVER_V13;
  }
  const results = pack.conditions.map((c) => ({
    code: c.code,
    verdict: compare(c, evidence),
    evidence: evidence[c.evidenceKey] ?? null,
  }));
  const overall = results.some((r) => r.verdict === "FAIL")
    ? "FAIL"
    : results.some((r) => r.verdict === "UNKNOWN")
      ? "UNKNOWN"
      : "PASS";
  return { policyId: pack.policyId, version: pack.version, effect: pack.effect, conditions: results, overall };
}

export const policyHandlers = [
  http.get("*/mock/policy/version", async () => {
    await mockLatency(40);
    return jsonOk(
      envelope({
        odFee: faultController.isOn("policyV14") ? "V14" : faultController.isOn("policyV13") ? "V13" : "V12",
        regE: REGE_INTAKE_V3.version,
        regEPos: REGE_POS_INVEST_90.version,
      }),
    );
  }),

  http.post("*/mock/policy/evaluate", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const policyId = String(body.policyId ?? "OD_FEE_WAIVER_V12");
    if (!POLICY_PACKS[policyId])
      return jsonError(404, "POLICY_NOT_FOUND", policyId);
    await mockLatency(160);
    const evidence =
      (body.evidence as Record<string, unknown> | undefined) ?? {};
    return jsonOk(envelope(evaluate(policyId, evidence)));
  }),
];
