// M12 design-time store — mutable, in-memory, reset on every demo run (same
// convention as graduationOverrides). Holds nominations, waves, compilations
// and candidate intents; writes through to runtime controls ONLY where a human
// grant must take effect (ratchet caps, graduated level, V13 policy flag).
import {
  CANDIDATE_INTENTS,
  NOMINATIONS,
  NOTICE_RULES,
} from "@/mocks/fixtures/designTime.ts";
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
  NoticeRule,
  Wave,
} from "./types.ts";

type Listener = () => void;

const clone = <T>(x: T): T => structuredClone(x);

class DesignTimeStore {
  private nominations: Nomination[] = [];
  private waves: Wave[] = [];
  private compilations: Compilation[] = [];
  private candidates: CandidateIntent[] = [];
  private notices: NoticeRule[] = [];
  private listeners = new Set<Listener>();
  /** §4.2 canary ledger: planted nominations known to be reject-worthy. The
   *  quarter opened with 4 planted and 4 caught (100% hit rate); the card in
   *  the tray is the one currently under review. */
  private canaryPlanted = 4;
  private canaryCaught = 4;
  private canaryMissed = false;

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
    this.notices = clone(NOTICE_RULES);
    this.canaryPlanted = 4;
    this.canaryCaught = 4;
    this.canaryMissed = false;
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
    // One wrongly signed canary suspends the signer's bulk signing rights:
    // every other nomination is then signed one at a time, never in bulk.
    if (this.canaryMissed && !n.canary) return;
    if (!n.signedBy) n.signedBy = [];
    if (!n.signedBy.some((s) => s.role === role)) {
      n.signedBy.push({ role, at: simClock.snapshot().isoDate });
    }
    this.emit();
  }

  grantNomination(id: string): void {
    const n = this.findNom(id);
    if (!n || n.state !== "awaiting_sign" || !signaturesComplete(n.signedBy ?? [])) return;
    // A canary is never grantable, however many signatures it collects: it
    // exists to be rejected, and granting it is the miss the metric measures.
    if (n.canary) {
      this.canaryPlanted += 1;
      this.canaryMissed = true;
      n.signedBy = [];
      this.emit();
      return;
    }
    n.state = "granted";
    if (n.proposedLevel) graduationOverrides.promote(n.intentCode, n.proposedLevel);
    this.emit();
  }

  rejectNomination(id: string): void {
    const n = this.findNom(id);
    if (!n || n.neverNominated) return;
    if (n.canary) {
      this.canaryPlanted += 1;
      this.canaryCaught += 1;
    }
    n.state = "cooldown";
    n.rejectedAt = simClock.now();
    n.signedBy = [];
    this.emit();
  }

  /** §4.2 canary hit rate. Must stay 100%; a miss suspends bulk signing. */
  getCanary(): { planted: number; caught: number; hitRatePct: number; missed: boolean } {
    return {
      planted: this.canaryPlanted,
      caught: this.canaryCaught,
      hitRatePct: Math.round((this.canaryCaught / this.canaryPlanted) * 1000) / 10,
      missed: this.canaryMissed,
    };
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

  // ── Notice rules (FR-12.4) ──

  getNoticeRules(): NoticeRule[] {
    return this.notices;
  }

  /** AC3: a new rule is born in shadow — record "would have sent", send
   *  nothing — and the counterfactual decides whether it earns a dual sign. */
  setNoticeShadow(id: string): void {
    const r = this.findNotice(id);
    if (!r || r.mode !== "off") return;
    r.mode = "shadow";
    // The shadow window starts recording; fictional counterfactual figures.
    r.shadowStats = { windowDays: 30, wouldHaveSent: 214, stillWroteIn: 26, controlSize: 230, controlWroteIn: 78 };
    this.emit();
  }

  signNotice(id: string, role: "compliance" | "business"): void {
    const r = this.findNotice(id);
    if (!r || r.mode !== "shadow") return;
    if (!r.signedBy) r.signedBy = [];
    if (!r.signedBy.some((s) => s.role === role)) {
      r.signedBy.push({ role, at: simClock.snapshot().isoDate });
    }
    this.emit();
  }

  /** Live only after dual sign, and only while the shadow evidence holds. */
  grantNotice(id: string): void {
    const r = this.findNotice(id);
    if (!r || r.mode !== "shadow" || !signaturesComplete(r.signedBy ?? [])) return;
    r.mode = "live";
    this.emit();
  }

  /** AC3: if the notice did not reduce the inbound, the rule is withdrawn. */
  withdrawNotice(id: string): void {
    const r = this.findNotice(id);
    if (!r || r.mode !== "live") return;
    r.mode = "off";
    r.signedBy = [];
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
  private findNotice(id: string): NoticeRule | undefined {
    return this.notices.find((x) => x.id === id);
  }
}

export const designTimeStore = new DesignTimeStore();
export { RATCHET_HOURS };
