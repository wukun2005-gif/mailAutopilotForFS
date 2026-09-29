// simClock — the ONLY source of business time (Dev Plan §4.3 rule 1, §6.6).
// Two scales that must never be mixed:
//   dayN  = calendar days since Day 0 (Day 6 / Day 40 / day45 / +14d verify)
//   bdN   = business days (Reg E provisional credit: bd10 = 2026-10-06)
// Holiday table intentionally empty (weekends only) — Dev Plan §6.6.
// All internal math is UTC ms on fixed dates; formatting happens in the UI.

export const DAY0_ISO = "2026-09-22"; // Tuesday, fixed demo date
export const DAY0_TIME = "08:14"; // email-2 arrival / clock start 08:14

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Fixed Day-0 epoch: Tue 2026-09-22 08:14 UTC. */
export const DAY0_EPOCH = Date.UTC(2026, 8, 22, 8, 14, 0, 0);

export function utcYmd(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isWeekend(ms: number): boolean {
  const dow = new Date(ms).getUTCDay();
  return dow === 0 || dow === 6;
}

/** Add n business days (weekends skipped; holiday table empty by design). */
export function addBusinessDays(ms: number, n: number): number {
  let cur = ms;
  const step = n >= 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    cur += step * DAY_MS;
    if (!isWeekend(cur)) remaining -= 1;
  }
  return cur;
}

export function addCalendarDays(ms: number, n: number): number {
  return ms + n * DAY_MS;
}

export function diffCalendarDays(from: number, to: number): number {
  return Math.round((to - from) / DAY_MS);
}

/** Whole calendar hours between two instants (48h warning uses this). */
export function diffCalendarHours(from: number, to: number): number {
  return Math.round((to - from) / HOUR_MS);
}

export interface RegEClocks {
  acknowledgedAt: number;
  /** 10th business day — provisional credit deadline (POS debit branch). */
  provisionalCreditDue: number;
  /** New-account branch: 20 business days. */
  provisionalCreditDueNewAccount: number;
  /** 45 calendar days (foreign/new-account branch; greyed for POS debit). */
  day45: number;
  /** 90 calendar days — POS debit investigation cap (1005.11(c)(3)(ii)). */
  day90: number;
}

export interface RegZClocks {
  /** 30 calendar days — written acknowledgment (1026.13). */
  ackWrittenDue: number;
  /** Resolution within 2 billing cycles, capped at 90 calendar days. */
  resolveDue: number;
}

export function regEClocks(acknowledgedAt: number): RegEClocks {
  return {
    acknowledgedAt,
    provisionalCreditDue: addBusinessDays(acknowledgedAt, 10),
    provisionalCreditDueNewAccount: addBusinessDays(acknowledgedAt, 20),
    day45: addCalendarDays(acknowledgedAt, 45),
    day90: addCalendarDays(acknowledgedAt, 90),
  };
}

export function regZClocks(receivedAt: number): RegZClocks {
  return {
    ackWrittenDue: addCalendarDays(receivedAt, 30),
    resolveDue: addCalendarDays(receivedAt, 90),
  };
}

export interface ClockSnapshot {
  epoch: number;
  dayN: number;
  isoDate: string;
}

type Listener = (snap: ClockSnapshot) => void;

/**
 * Pausable, jumpable virtual clock. Graph nodes and the clock service read
 * now(); wallNow() is the ONLY permitted real-clock escape hatch (trace).
 */
class SimClock {
  private epoch: number = DAY0_EPOCH;
  private listeners = new Set<Listener>();

  now(): number {
    return this.epoch;
  }

  /** Real wall clock — trace debug only, never business logic. */
  wallNow(): number {
    return Date.now();
  }

  dayN(): number {
    return diffCalendarDays(DAY0_EPOCH, this.epoch);
  }

  snapshot(): ClockSnapshot {
    return { epoch: this.epoch, dayN: this.dayN(), isoDate: utcYmd(this.epoch) };
  }

  set(epoch: number): void {
    this.epoch = epoch;
    this.emit();
  }

  advance(ms: number): void {
    this.set(this.epoch + ms);
  }

  advanceHours(h: number): void {
    this.advance(h * HOUR_MS);
  }

  advanceCalendarDays(d: number): void {
    this.advance(d * DAY_MS);
  }

  advanceBusinessDays(d: number): void {
    this.set(addBusinessDays(this.epoch, d));
  }

  jumpToCalendarDay(dayN: number, hour = 8, minute = 14): void {
    this.set(Date.UTC(2026, 8, 22 + dayN, hour, minute, 0, 0));
  }

  reset(): void {
    this.epoch = DAY0_EPOCH;
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((fn) => fn(snap));
  }
}

export const simClock = new SimClock();
