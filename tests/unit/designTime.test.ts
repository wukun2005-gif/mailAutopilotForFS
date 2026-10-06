// M12 design-time logic unit tests (PRD v0.3 §6.6 / FR-12.1–12.3).
import { describe, expect, it } from "vitest";
import { NOMINATIONS, NOTICE_RULES } from "@/mocks/fixtures/designTime.ts";
import { WAVES } from "@/mocks/fixtures/designTimeWaves.ts";
import { designTimeStore } from "@/runtime/designTime/store.ts";
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
import { INTENT_SPECS, graduatedLevel, uncappedLevel } from "@runtime/intentRegistry.ts";
import { graduationOverrides } from "@runtime/graduationOverrides.ts";
import { simClock } from "@runtime/simClock.ts";

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

  // The pack is a promise about the SAME runtime the Builder board renders, so
  // every intent it names must be one that really runs above the target level.
  // A shadow row (or an intent the detector never emits) would leave the board
  // showing the old level after the wave was tightened — the pack would claim a
  // downgrade that never happened.
  it("only names intents that actually run at L3 today", () => {
    for (const d of WAVES[0].tightening!.downgrades) {
      expect(INTENT_SPECS[d.intentCode], `${d.intentCode} is not a registered intent`).toBeDefined();
      expect(uncappedLevel(d.intentCode), `${d.intentCode} has no uncapped level`).toBe("L3");
      expect(graduatedLevel(d.intentCode)).toBe("L3");
    }
  });

  it("tightening drops each named intent to L2 in the runtime the Builder reads", () => {
    graduationOverrides.reset();
    designTimeStore.reset();
    const codes = WAVES[0].tightening!.downgrades.map((d) => d.intentCode);
    designTimeStore.applyTightening("WAVE-P0");
    for (const code of codes) {
      expect(graduatedLevel(code), `${code} still runs uncapped`).toBe("L2");
      // The cap is a hold-down, not a re-graduation: the level it will return to
      // when the 24h ratchet expires is still readable.
      expect(uncappedLevel(code)).toBe("L3");
    }
    expect(designTimeStore.getWaves()[0].status).toBe("tightening_applied");
    designTimeStore.reset();
    graduationOverrides.reset();
  });

  it("expiry releases exactly what the ratchet capped", () => {
    graduationOverrides.reset();
    designTimeStore.reset();
    // A human's own cap on an intent the wave never touched must survive it.
    graduationOverrides.cap("general_inquiry", "L2");
    designTimeStore.applyTightening("WAVE-P0");
    simClock.set(simClock.now() + 25 * HOUR);
    designTimeStore.getWaves(); // expiry runs on read
    for (const d of WAVES[0].tightening!.downgrades) {
      expect(graduatedLevel(d.intentCode)).toBe("L3");
    }
    expect(graduatedLevel("general_inquiry")).toBe("L2");
    expect(designTimeStore.getWaves()[0].status).toBe("resolved");
    simClock.reset();
    designTimeStore.reset();
    graduationOverrides.reset();
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

describe("FR-12.1 canary nomination (§4.2 hit rate, §12.1 rubber-stamp risk)", () => {
  it("passes three proofs and fails only cohort parity — the signer has to read card ④", () => {
    const c = nom("NOM-CANARY");
    expect(c.canary?.expected).toBe("reject");
    const blockers = nominationBlockers(c, NOW);
    expect(blockers).toEqual(["parity"]);
    expect(consistencyPasses(c.evidence)).toBe(true);
  });

  it("rejecting it keeps the hit rate at 100%", () => {
    designTimeStore.reset();
    const before = designTimeStore.getCanary();
    expect(before.hitRatePct).toBe(100);
    designTimeStore.rejectNomination("NOM-CANARY");
    const after = designTimeStore.getCanary();
    expect(after.caught).toBe(before.caught + 1);
    expect(after.planted).toBe(before.planted + 1);
    expect(after.hitRatePct).toBe(100);
    expect(after.missed).toBe(false);
  });

  it("granting it is the miss: no autonomy is written and bulk signing is suspended", () => {
    designTimeStore.reset();
    designTimeStore.signNomination("NOM-CANARY", "compliance");
    designTimeStore.signNomination("NOM-CANARY", "business");
    designTimeStore.grantNomination("NOM-CANARY");
    const c = designTimeStore.getCanary();
    expect(c.missed).toBe(true);
    expect(c.hitRatePct).toBeLessThan(100);
    // The canary never becomes autonomy, however many signatures it collects.
    expect(designTimeStore.getNominations().find((n) => n.id === "NOM-CANARY")?.state).not.toBe(
      "granted",
    );
    // …and a suspended signer cannot bulk-sign the real nominations any more.
    designTimeStore.signNomination("NOM-B", "compliance");
    expect(designTimeStore.getNominations().find((n) => n.id === "NOM-B")?.signedBy ?? []).toEqual(
      [],
    );
    designTimeStore.reset();
  });
});

describe("FR-12.1 AC5 rare intents", () => {
  it("get an observation report instead of a nomination", () => {
    const r = nom("NOM-RARE");
    expect(r.kind).toBe("observation");
    expect(r.state).toBe("insufficient_sample");
    expect(r.observation!.observedSample).toBeLessThan(r.observation!.requiredSample);
    expect(r.observation!.observedSample).toBeLessThan(300);
    expect(r.proposedLevel).toBeUndefined();
  });
});

describe("FR-12.4 notice rules: shadow first, dual sign to send", () => {
  it("a rule must not skip shadow, and must not send before both signatures", () => {
    designTimeStore.reset();
    expect(NOTICE_RULES[0].mode).toBe("shadow");
    // Single signature is not enough.
    designTimeStore.signNotice("NOTICE-1", "compliance");
    designTimeStore.grantNotice("NOTICE-1");
    expect(designTimeStore.getNoticeRules()[0].mode).toBe("shadow");
    designTimeStore.signNotice("NOTICE-1", "business");
    designTimeStore.grantNotice("NOTICE-1");
    expect(designTimeStore.getNoticeRules()[0].mode).toBe("live");
    // Withdrawal is always available once live (AC3: no fall in inbound → pull it).
    designTimeStore.withdrawNotice("NOTICE-1");
    expect(designTimeStore.getNoticeRules()[0].mode).toBe("off");
    designTimeStore.reset();
  });

  it("an unproposed rule starts shadow-only, never live", () => {
    designTimeStore.reset();
    expect(designTimeStore.getNoticeRules()[1].mode).toBe("off");
    designTimeStore.grantNotice("NOTICE-2");
    expect(designTimeStore.getNoticeRules()[1].mode).toBe("off");
    designTimeStore.setNoticeShadow("NOTICE-2");
    expect(designTimeStore.getNoticeRules()[1].mode).toBe("shadow");
    designTimeStore.reset();
  });
});
