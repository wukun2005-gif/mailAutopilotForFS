// M12 design-time pure logic (PRD v0.3 §6.6). No LLM, no network: the gates
// are arithmetic over fixture evidence, mirroring the runtime principle that
// policy decisions are deterministic. Unit-tested in tests/unit/designTime.
import type {
  FourProofs,
  Nomination,
  RemediationPlan,
  TighteningPack,
} from "./types.ts";

// ── Bars (mirror PRD §6.6 / FR-12.1; fictional but fixed policy constants) ──

export const COHORT_PARITY_THRESHOLD_PP = 2;
export const NON_REG_REPRO_BAR = 0.97;
export const REG_REPRO_BAR = 0.99;
export const NON_REG_SAMPLE_MIN = 300;
export const REG_SAMPLE_MIN = 600;
export const SHADOW_DAYS = 14;
export const REJECT_COOLDOWN_DAYS = 30;
export const RATCHET_HOURS = 24;
const HOUR_MS = 3_600_000;

export type GateCode =
  | "never"
  | "consistency"
  | "sample"
  | "parity"
  | "cooldown"
  | "signatures";

// ── FR-12.1 four proofs ──

export function maxCohortGap(gaps: FourProofs["cohortParity"]["gaps"]): number {
  return gaps.reduce((m, g) => Math.max(m, g.gapPp), 0);
}

export function parityPasses(e: FourProofs): boolean {
  return maxCohortGap(e.cohortParity.gaps) < e.cohortParity.thresholdPp;
}

/** After a template fix the replayed repro rate is the one that counts. */
export function effectiveRepro(n: Nomination, templateFixed: boolean): number {
  if (templateFixed && n.templateFix) return n.templateFix.reproRateAfterFix;
  return n.evidence.consistency.reproRate;
}

export function consistencyPasses(e: FourProofs, reproRate?: number): boolean {
  const bar = e.consistency.regulated ? REG_REPRO_BAR : NON_REG_REPRO_BAR;
  const rate = reproRate ?? e.consistency.reproRate;
  if (rate < bar) return false;
  if (e.consistency.regulated && e.consistency.criticalMisses > 0) return false;
  return true;
}

export function sampleSizePasses(e: FourProofs): boolean {
  const min = e.consistency.regulated ? REG_SAMPLE_MIN : NON_REG_SAMPLE_MIN;
  return e.consistency.sampleSize >= min;
}

export function cooldownActive(rejectedAt: number | undefined, now: number): boolean {
  if (rejectedAt === undefined) return false;
  return now - rejectedAt < REJECT_COOLDOWN_DAYS * 24 * HOUR_MS;
}

/**
 * Why a nomination cannot advance. Empty array = evidence clears the bar.
 * R3/R4 rows always return ["never"] — AI never nominates them.
 */
export function nominationBlockers(
  n: Nomination,
  now: number,
  templateFixed = false,
): GateCode[] {
  if (n.neverNominated) return ["never"];
  const blockers: GateCode[] = [];
  if (!consistencyPasses(n.evidence, effectiveRepro(n, templateFixed))) blockers.push("consistency");
  if (!sampleSizePasses(n.evidence)) blockers.push("sample");
  if (!parityPasses(n.evidence)) blockers.push("parity");
  if (cooldownActive(n.rejectedAt, now)) blockers.push("cooldown");
  return blockers;
}

/** Dual sign requires both roles; compliance signs first in the UI. */
export function signaturesComplete(signed: Array<{ role: string }>): boolean {
  const roles = new Set(signed.map((s) => s.role));
  return roles.has("compliance") && roles.has("business");
}

// ── FR-12.2 ratchet (tighter-only, auto-expiring) ──

export type RatchetState = "not_applied" | "active" | "expired";

export function ratchetState(pack: TighteningPack, now: number): RatchetState {
  if (pack.appliedAt === undefined || pack.expiresAt === undefined) return "not_applied";
  if (now >= pack.expiresAt) return "expired";
  return "active";
}

export function applyRatchet(pack: TighteningPack, now: number): TighteningPack {
  return { ...pack, appliedAt: now, expiresAt: now + pack.expiresHours * HOUR_MS };
}

// ── FR-12.2 proactive remediation (P1 wave) ──

export type RemediationGate = "bank_error" | "sample_sign" | "total_sign";

export function remediationMissing(plan: RemediationPlan): RemediationGate[] {
  const missing: RemediationGate[] = [];
  if (!plan.bankErrorConfirmed) missing.push("bank_error");
  if (!plan.signedSample) missing.push("sample_sign");
  if (!plan.signedTotal) missing.push("total_sign");
  return missing;
}

/**
 * Advance the staged rollout one step, idempotently.
 * Step 1: first pending batch → running. Step 2: running → done, then the
 * next call unlocks the following batch. Skipping a stage is impossible.
 * Returns a new plan; an unchanged plan means prerequisites are missing or
 * every batch is done.
 */
export function remediationStep(plan: RemediationPlan): RemediationPlan {
  if (remediationMissing(plan).length > 0) return plan;
  const batches = plan.batches.map((b) => ({ ...b }));
  const runningIdx = batches.findIndex((b) => b.status === "running");
  if (runningIdx >= 0) {
    batches[runningIdx].status = "done";
    return { ...plan, batches };
  }
  const nextIdx = batches.findIndex((b) => b.status === "pending");
  if (nextIdx < 0) return plan;
  batches[nextIdx].status = "running";
  return { ...plan, batches };
}

export function remediationComplete(plan: RemediationPlan): boolean {
  return plan.batches.every((b) => b.status === "done");
}

/** Deterministic per-account idempotency key (same tape → same key). */
export function remediationKey(plan: RemediationPlan, accountIdx: number): string {
  return `${plan.idempotencyKeyPrefix}${String(accountIdx).padStart(6, "0")}`;
}
