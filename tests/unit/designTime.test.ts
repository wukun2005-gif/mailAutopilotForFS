// M12 design-time logic unit tests (PRD v0.3 §6.6 / FR-12.1–12.3).
import { describe, expect, it } from "vitest";
import { NOMINATIONS } from "@/mocks/fixtures/designTime.ts";
import { WAVES } from "@/mocks/fixtures/designTimeWaves.ts";
import {
  COHORT_PARITY_THRESHOLD_PP,
  NON_REG_REPRO_BAR,
  REJECT_COOLDOWN_DAYS,
  applyRatchet,
  cooldownActive,
  effectiveRepro,
  maxCohortGap,
  nominationBlockers,
  ratchetState,
  remediationComplete,
  remediationKey,
  remediationMissing,
  remediationStep,
  signaturesComplete,
  consistencyPasses,
} from "@/runtime/designTime/logic.ts";
import type { Nomination, RemediationPlan, TighteningPack } from "@/runtime/designTime/types.ts";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 22, 8, 14);

const nom = (id: string): Nomination => {
  const found = NOMINATIONS.find((n) => n.id === id);
  if (!found) throw new Error(`missing fixture ${id}`);
  return structuredClone(found);
};

describe("FR-12.1 four-proofs nomination gate", () => {
  it("card A fails the bar at 96.8% — the prescription is fix the template, never lower the bar", () => {
    const a = nom("NOM-A");
    expect(effectiveRepro(a, false)).toBe(0.968);
    expect(consistencyPasses(a.evidence)).toBe(false);
    expect(nominationBlockers(a, NOW)).toContain("consistency");
    // After the template repair + replay, 99% clears it.
    expect(effectiveRepro(a, true)).toBe(0.99);
    expect(nominationBlockers(a, NOW, true)).toEqual([]);
  });

  it("card B (above-cap goodwill waiver) clears all four proofs and waits for dual sign", () => {
    const b = nom("NOM-B");
    expect(nominationBlockers(b, NOW)).toEqual([]);
    expect(b.state).toBe("awaiting_sign");
    expect(signaturesComplete([])).toBe(false);
    expect(signaturesComplete([{ role: "compliance" }])).toBe(false);
    expect(signaturesComplete([{ role: "compliance" }, { role: "business" }])).toBe(true);
  });

  it("R3/R4 rows are never nominated, regardless of evidence", () => {
    for (const id of ["NOM-R3", "NOM-R4"]) {
      expect(nominationBlockers(nom(id), NOW)).toEqual(["never"]);
    }
  });

  it("cohort gap at/over 2pp invalidates a nomination; the fixture cards stay under it", () => {
    expect(maxCohortGap(nom("NOM-B").evidence.cohortParity.gaps)).toBeLessThan(
      COHORT_PARITY_THRESHOLD_PP,
    );
    const biased = nom("NOM-B");
    biased.evidence.cohortParity.gaps[0].gapPp = 2.1;
    expect(nominationBlockers(biased, NOW)).toContain("parity");
  });

  it("rejected nominations are rate-limited for 30 days", () => {
    expect(cooldownActive(NOW - 10 * 24 * HOUR, NOW)).toBe(true);
    expect(cooldownActive(NOW - 31 * 24 * HOUR, NOW)).toBe(false);
    const b = nom("NOM-B");
    b.rejectedAt = NOW - 5 * 24 * HOUR;
    expect(nominationBlockers(b, NOW)).toContain("cooldown");
    expect(REJECT_COOLDOWN_DAYS).toBe(30);
  });

  it("non-regulated bar is 97% with ≥300 samples; card B's 97.6%/412 passes", () => {
    const b = nom("NOM-B");
    expect(b.evidence.consistency.thresholdRate).toBe(NON_REG_REPRO_BAR);
    expect(b.evidence.consistency.sampleSize).toBeGreaterThanOrEqual(300);
  });
});

describe("FR-12.2 P0 ratchet", () => {
  const pack = (): TighteningPack => structuredClone(WAVES[0].tightening!);

  it("applies immediately and auto-expires after 24h", () => {
    const p = applyRatchet(pack(), NOW);
    expect(ratchetState(p, NOW)).toBe("active");
    expect(ratchetState(p, NOW + 24 * HOUR - 1)).toBe("active");
    expect(ratchetState(p, NOW + 24 * HOUR)).toBe("expired");
  });

  it("unapplied pack reports not_applied", () => {
    expect(ratchetState(pack(), NOW)).toBe("not_applied");
  });
});

describe("FR-12.2 P1 staged remediation", () => {
  const plan = (): RemediationPlan => structuredClone(WAVES[1].remediation!);

  it("cannot run any batch before bank-error confirmation and dual sign", () => {
    const p = plan();
    expect(remediationMissing(p)).toEqual(["bank_error", "sample_sign", "total_sign"]);
    const after = remediationStep(p);
    expect(after.batches.every((b) => b.status === "pending")).toBe(true);
  });

  it("stages 1% → 10% → 100% in order, with running→done handshake", () => {
    let p = plan();
    p.bankErrorConfirmed = true;
    p.signedSample = true;
    p.signedTotal = true;
    const click = () => {
      p = remediationStep(p);
    };
    click();
    expect(p.batches[0]).toMatchObject({ pct: 1, status: "running" });
    click();
    expect(p.batches[0].status).toBe("done");
    expect(p.batches[1].status).toBe("pending");
    click();
    expect(p.batches[1].status).toBe("running");
    click();
    expect(p.batches[1].status).toBe("done");
    click();
    expect(p.batches[2].status).toBe("running");
    expect(remediationComplete(p)).toBe(false);
    click();
    expect(p.batches[2].status).toBe("done");
    expect(remediationComplete(p)).toBe(true);
  });

  it("batch accounts reconcile to the scanned tape (39 + 351 + 3514 = 3904)", () => {
    const p = plan();
    expect(p.batches.reduce((s, b) => s + b.accounts, 0)).toBe(p.scanTotal);
    expect(p.silentVictims).toBe(p.scanTotal - p.affectedWriters);
  });

  it("per-account idempotency keys are deterministic", () => {
    const p = plan();
    expect(remediationKey(p, 42)).toBe("REM-NSF-20260930-000042");
    expect(remediationKey(p, 42)).toBe("REM-NSF-20260930-000042");
  });
});
