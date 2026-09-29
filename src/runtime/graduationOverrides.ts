// Graduation overrides — runtime-writable layer on top of the fixture
// graduation table, driven by the Builder screen:
//   - dual sign-off promotes a shadow intent (graduatedL L2 → L3)
//   - manual downgrade caps an intent's graduated level (FR-3.4)
// graduatedLevel() in intentRegistry consults this, so a new email of the
// affected intent immediately runs at the new level — same runtime, no reload.
import type { LLevel } from "./state.ts";

export interface GradOverride {
  /** Cap graduated level at or below this (manual downgrade). */
  cap?: LLevel;
  /** Promoted above the fixture table via dual sign-off. */
  promotedTo?: LLevel;
}

const RANK: Record<LLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };

class OverrideStore {
  private map = new Map<string, GradOverride>();
  private subs = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  private emit() {
    this.subs.forEach((fn) => fn());
  }

  get(intentCode: string): GradOverride | undefined {
    return this.map.get(intentCode);
  }

  promote(intentCode: string, level: LLevel) {
    const cur = this.map.get(intentCode) ?? {};
    this.map.set(intentCode, { ...cur, promotedTo: level });
    this.emit();
  }

  cap(intentCode: string, level: LLevel) {
    const cur = this.map.get(intentCode) ?? {};
    this.map.set(intentCode, { ...cur, cap: level });
    this.emit();
  }

  clearCap(intentCode: string) {
    const cur = this.map.get(intentCode);
    if (!cur) return;
    delete cur.cap;
    this.map.set(intentCode, { ...cur });
    this.emit();
  }

  reset() {
    this.map.clear();
    this.emit();
  }

  /** Effective graduated level given fixture baseline. */
  effective(intentCode: string, baseline: LLevel | null): LLevel | null {
    const o = this.map.get(intentCode);
    let level = baseline;
    if (o?.promotedTo) level = o.promotedTo;
    if (o?.cap && level && RANK[o.cap] < RANK[level]) level = o.cap;
    return level;
  }
}

export const graduationOverrides = new OverrideStore();
