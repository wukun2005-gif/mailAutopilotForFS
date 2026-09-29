// Core runtime types shared by the graph (M2), stores (M3+) and mock layer.
// Zod schemas for full CaseState land in M2 with the graph; M1 establishes
// the vocabulary + the CaseEvent contract.

export const L_LEVELS = ["L0", "L1", "L2", "L3"] as const;
export type LLevel = (typeof L_LEVELS)[number];

export const R_LEVELS = ["R0", "R1", "R2", "R3", "R4"] as const;
export type RLevel = (typeof R_LEVELS)[number];

export const I_LEVELS = ["I0", "I1", "I2", "I3"] as const;
export type ILevel = (typeof I_LEVELS)[number];

export type CaseStatus =
  | "open"
  | "awaiting_human"
  | "awaiting_customer"
  | "pending_verify"
  | "closed"
  | "quarantined";

/** Discriminated matrix cell (Dev Plan §6.3) — never a bare L level. */
export type CellValue =
  | { kind: "L"; level: LLevel }
  | { kind: "deny"; reasonCode: string }
  | { kind: "never"; reasonCode: string };

export type CaseEventType =
  | "node_enter"
  | "node_exit"
  | "gate"
  | "tool_call"
  | "tool_result"
  | "idempotent_replay"
  | "clock"
  | "interrupt"
  | "resume"
  | "email_inbound"
  | "email_outbound"
  | "system";

export interface CaseEvent {
  caseId: string;
  seq: number;
  /** Business time — always simClock.now(). */
  simTime: number;
  /** Real wall-clock, debug-only (never drives logic, Dev Plan §4.3 rule 1). */
  wallTime: number;
  node: string;
  type: CaseEventType;
  data: Record<string, unknown>;
  traceId: string;
  reasonCodes?: string[];
  policyVersion?: string;
}

export type ActionStatus = "inflight" | "done" | "failed";

export interface ActionLedgerEntry {
  key: string;
  caseId: string;
  actionType: string;
  seq: number;
  status: ActionStatus;
  result?: unknown;
  error?: string;
  simTime: number;
  wallTime: number;
  traceId: string;
}

/** idempotencyKey = caseId:actionType:seq (Dev Plan §6.4). */
export function idemKey(
  caseId: string,
  actionType: string,
  seq: number,
): string {
  return `${caseId}:${actionType}:${seq}`;
}
