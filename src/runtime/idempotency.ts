// Idempotency ledger (Dev Plan §6.4): the gateway checks here BEFORE any write
// tool call. A repeated key replays the first result instead of re-executing,
// so "refresh after timeout" and duplicate inbound delivery can never produce
// a second refund / second dispute. MSW handlers keep a second, server-side
// layer keyed the same way — the demo shows both.
import { eapDB } from "./db.ts";
import { simClock } from "./simClock.ts";
import type { ActionLedgerEntry } from "./state.ts";

export interface LedgerLookup {
  hit: boolean;
  entry: ActionLedgerEntry | null;
}

export async function lookupAction(key: string): Promise<LedgerLookup> {
  const db = await eapDB();
  const entry = (await db.get("idempotency", key)) as
    | ActionLedgerEntry
    | undefined;
  return entry ? { hit: true, entry } : { hit: false, entry: null };
}

export async function putAction(
  entry: ActionLedgerEntry,
): Promise<ActionLedgerEntry> {
  const db = await eapDB();
  await db.put("idempotency", entry, entry.key);
  return entry;
}

/** Record an inflight attempt (safe to repeat: keeps the first inflight row). */
export async function markInflight(
  key: string,
  meta: { caseId: string; actionType: string; seq: number; traceId: string },
): Promise<{ written: boolean; entry: ActionLedgerEntry }> {
  const existing = await lookupAction(key);
  if (existing.hit)
    return { written: false, entry: existing.entry! };
  const entry: ActionLedgerEntry = {
    key,
    caseId: meta.caseId,
    actionType: meta.actionType,
    seq: meta.seq,
    status: "inflight",
    simTime: simClock.now(),
    wallTime: simClock.wallNow(),
    traceId: meta.traceId,
  };
  await putAction(entry);
  return { written: true, entry };
}

export async function markDone(
  key: string,
  result: unknown,
): Promise<ActionLedgerEntry> {
  const db = await eapDB();
  const prev = (await db.get("idempotency", key)) as
    | ActionLedgerEntry
    | undefined;
  const entry: ActionLedgerEntry = {
    ...(prev ?? {
      key,
      caseId: "",
      actionType: "",
      seq: 0,
      traceId: "",
    }),
    status: "done",
    result,
    simTime: simClock.now(),
    wallTime: simClock.wallNow(),
  };
  await db.put("idempotency", entry, key);
  return entry;
}

export async function markFailed(key: string, error: string): Promise<void> {
  const db = await eapDB();
  const prev = (await db.get("idempotency", key)) as
    | ActionLedgerEntry
    | undefined;
  if (!prev) return;
  await db.put(
    "idempotency",
    { ...prev, status: "failed", error },
    key,
  );
}

export async function listActions(
  caseId?: string,
): Promise<ActionLedgerEntry[]> {
  const db = await eapDB();
  const all = (await db.getAll("idempotency")) as ActionLedgerEntry[];
  return all
    .filter((e) => !caseId || e.caseId === caseId)
    .sort((a, b) => a.simTime - b.simTime || a.seq - b.seq);
}
