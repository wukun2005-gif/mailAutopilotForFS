// faultController — scenario-scoped fault injection flags (Dev Plan §5.3).
// The TopBar dev panel (M3) and the demo director (M7) flip these; mock
// handlers + runtime gates read them. consume() flags fire exactly once so a
// "next request times out" fault never leaks across a demo run.

export type FaultFlag =
  | "bankingTimeout" // next core-banking request: delay 8s then 500
  | "duplicateFiling" // dispute create delivered twice
  | "dlpBlock" // next outbound draft contains a PAN → blocked
  | "otpLockout" // OTP wrong 3× → locked
  | "policyV13" // policy evaluate reports V13
  | "sessionExpired" // identity downgrade ① verification session invalid
  | "threadClosed" // identity downgrade ② Day-14 close really closed thread
  | "spoofSignal" // identity downgrade ③ lookalike signal (FR-2.1 AC3)
  | "newThread" // 2nd email lands in a NEW thread (FR-2.1 AC2)
  | "noDigital"; // customer not enrolled in digital banking (FR-2.2 fallback)

export type ClockJump =
  | "+1h"
  | "+1bd"
  | "+1d"
  | "day6"
  | "bd10"
  | "day40"
  | "+14d";

export interface FaultState {
  bankingTimeout: boolean;
  duplicateFiling: boolean;
  dlpBlock: boolean;
  otpLockout: boolean;
  policyV13: boolean;
  sessionExpired: boolean;
  threadClosed: boolean;
  spoofSignal: boolean;
  newThread: boolean;
  noDigital: boolean;
}

const INITIAL: FaultState = {
  bankingTimeout: false,
  duplicateFiling: false,
  dlpBlock: false,
  otpLockout: false,
  policyV13: false,
  sessionExpired: false,
  threadClosed: false,
  spoofSignal: false,
  newThread: false,
  noDigital: false,
};

/** Flags that auto-reset after one consumption. */
const ONE_SHOT: FaultFlag[] = ["bankingTimeout", "duplicateFiling", "dlpBlock"];

type Listener = (s: FaultState) => void;

class FaultController {
  private state: FaultState = { ...INITIAL };
  private listeners = new Set<Listener>();

  get(): FaultState {
    return { ...this.state };
  }

  isOn(flag: FaultFlag): boolean {
    return this.state[flag];
  }

  set(flag: FaultFlag, on: boolean): void {
    this.state[flag] = on;
    this.emit();
  }

  toggle(flag: FaultFlag): void {
    this.set(flag, !this.state[flag]);
  }

  /** Read a one-shot flag and clear it atomically. */
  consume(flag: FaultFlag): boolean {
    if (!ONE_SHOT.includes(flag)) return this.state[flag];
    const on = this.state[flag];
    if (on) {
      this.state[flag] = false;
      this.emit();
    }
    return on;
  }

  reset(): void {
    this.state = { ...INITIAL };
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const snap = this.get();
    this.listeners.forEach((fn) => fn(snap));
  }
}

export const faultController = new FaultController();
