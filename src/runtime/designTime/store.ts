// M12 design-time store — mutable, in-memory, reset on every demo run (same
// convention as graduationOverrides). Holds nominations, waves, compilations
// and candidate intents; writes through to runtime controls ONLY where a human
// grant must take effect (ratchet caps, graduated level, V13 policy flag).
import { CANDIDATE_INTENTS, NOMINATIONS } from "@/mocks/fixtures/designTime.ts";
import { COMPILATIONS, WAVES } from "@/mocks/fixtures/designTimeWaves.ts";
import { faultController } from "@/tools/faultController.ts";
import { graduationOverrides } from "@/runtime/graduationOverrides.ts";
import { simClock } from "@/runtime/simClock.ts";
import {
  RATCHET_HOURS,
  applyRatchet,
  ratchetState,
  remediationComplete,
  remediationMissing,
  remediationStep,
  signaturesComplete,
} from "./logic.ts";
import type {
  CandidateIntent,
  Compilation,
  Nomination,
  Wave,
} from "./types.ts";

type Listener = () => void;

const clone = <T>(x: T): T => structuredClone(x);

class DesignTimeStore {
  private nominations: Nomination[] = [];
  private waves: Wave[] = [];
  private compilations: Compilation[] = [];
  private candidates: CandidateIntent[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.reset();
    // Auto-expire the P0 ratchet on sim-clock movement (24h pack).
    simClock.subscribe(() => this.expireRatchet());
  }

  reset(): void {
    this.nominations = clone(NOMINATIONS);
    this.waves = clone(WAVES);
    this.compilations = clone(COMPILATIONS);
    this.candidates = clone(CANDIDATE_INTENTS);
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  // ── Nominations (FR-12.1) ──

  getNominations(): Nomination[] {
    return this.nominations;
  }

  /** Card A: repair the template, replay — the bar is never lowered. */
  fixTemplateAndReplay(id: string): void {
    const n = this.findNom(id);
    if (!n || n.kind !== "fix_template") return;
    n.state = "in_shadow";
    this.emit();
  }

  submitForSign(id: string): void {
    const n = this.findNom(id);
    if (!n || n.state !== "in_shadow") return;
    n.state = "awaiting_sign";
    this.emit();
  }

  signNomination(id: string, role: "compliance" | "business"): void {
    const n = this.findNom(id);
    if (!n || n.state !== "awaiting_sign") return;
    if (!n.signedBy) n.signedBy = [];
    if (!n.signedBy.some((s) => s.role === role)) {
      n.signedBy.push({ role, at: simClock.snapshot().isoDate });
    }
    this.emit();
  }

  grantNomination(id: string): void {
    const n = this.findNom(id);
    if (!n || n.state !== "awaiting_sign" || !signaturesComplete(n.signedBy ?? [])) return;
    n.state = "granted";
    if (n.proposedLevel) graduationOverrides.promote(n.intentCode, n.proposedLevel);
    this.emit();
  }

  rejectNomination(id: string): void {
    const n = this.findNom(id);
    if (!n || n.neverNominated) return;
    n.state = "cooldown";
    n.rejectedAt = simClock.now();
    n.signedBy = [];
    this.emit();
  }

  // ── Waves (FR-12.2) ──

  getWaves(): Wave[] {
    this.expireRatchet();
    return this.waves;
  }

  /** P0 one-click ratchet: immediate downgrade, 24h auto-expiry. */
  applyTightening(id: string): void {
    const w = this.findWave(id);
    if (!w || !w.tightening || w.status !== "active") return;
    w.tightening = applyRatchet(w.tightening, simClock.now());
    for (const d of w.tightening.downgrades) graduationOverrides.cap(d.intentCode, d.to);
    w.status = "tightening_applied";
    this.emit();
  }

  private expireRatchet(): void {
    let changed = false;
    for (const w of this.waves) {
      if (w.tightening && ratchetState(w.tightening, simClock.now()) === "expired" && w.status === "tightening_applied") {
        for (const d of w.tightening.downgrades) graduationOverrides.clearCap(d.intentCode);
        w.status = "resolved";
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  confirmBankError(id: string): void {
    const w = this.findWave(id);
    if (!w?.remediation) return;
    w.remediation.bankErrorConfirmed = true;
    w.status = "awaiting_dual_sign";
    this.emit();
  }

  signRemediation(id: string, role: "sample" | "total"): void {
    const w = this.findWave(id);
    if (!w?.remediation || !w.remediation.bankErrorConfirmed) return;
    if (role === "sample") w.remediation.signedSample = true;
    if (role === "total") w.remediation.signedTotal = true;
    if (remediationMissing(w.remediation).length === 0) w.status = "remediating";
    this.emit();
  }

  advanceRemediation(id: string): void {
    const w = this.findWave(id);
    if (!w?.remediation) return;
    const before = JSON.stringify(w.remediation.batches);
    w.remediation = remediationStep(w.remediation);
    if (remediationComplete(w.remediation)) w.status = "resolved";
    if (JSON.stringify(w.remediation.batches) !== before) this.emit();
  }

  routeP2(id: string): void {
    const w = this.findWave(id);
    if (!w || w.severity !== "P2") return;
    w.status = "routed";
    this.emit();
  }

  // ── Policy Compiler (FR-12.3) ──

  getCompilations(): Compilation[] {
    return this.compilations;
  }

  signCompilation(id: string, role: "compliance" | "business"): void {
    const c = this.findComp(id);
    if (!c || (c.state !== "compiled" && c.state !== "awaiting_sign")) return;
    c.state = "awaiting_sign";
    if (!c.signedBy) c.signedBy = [];
    if (!c.signedBy.some((s) => s.role === role)) {
      c.signedBy.push({ role, at: simClock.snapshot().isoDate });
    }
    this.emit();
  }

  grantCompilation(id: string): void {
    const c = this.findComp(id);
    if (!c || c.state !== "awaiting_sign" || !signaturesComplete(c.signedBy ?? [])) return;
    c.state = "granted";
    if (c.effectiveVersion === "OD_FEE_WAIVER_V13") faultController.set("policyV13", true);
    this.emit();
  }

  // ── Candidate intents (FR-12.6) ──

  getCandidates(): CandidateIntent[] {
    return this.candidates;
  }

  acceptCandidate(id: string): void {
    const c = this.candidates.find((x) => x.id === id);
    if (!c || c.reportOnly) return;
    c.state = "in_shadow";
    this.emit();
  }

  // ── internals ──

  private findNom(id: string): Nomination | undefined {
    return this.nominations.find((x) => x.id === id);
  }
  private findWave(id: string): Wave | undefined {
    return this.waves.find((x) => x.id === id);
  }
  private findComp(id: string): Compilation | undefined {
    return this.compilations.find((x) => x.id === id);
  }
}

export const designTimeStore = new DesignTimeStore();
export { RATCHET_HOURS };
