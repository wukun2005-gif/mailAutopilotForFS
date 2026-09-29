// CaseEvent stream — append-only, persisted to IndexedDB. The Trace Rail and
// audit view render THIS stream (Dev Plan §6.2 / §12): the app does not keep
// a second logging system. Keys are caseId::seq so range scans stay ordered.
import { eapDB } from "./db.ts";
import { simClock } from "./simClock.ts";
import type { CaseEvent, CaseEventType } from "./state.ts";

export interface AppendEventArgs {
  caseId: string;
  node: string;
  type: CaseEventType;
  data?: Record<string, unknown>;
  traceId?: string;
  reasonCodes?: string[];
  policyVersion?: string;
}

export async function nextEventSeq(caseId: string): Promise<number> {
  const db = await eapDB();
  let max = -1;
  let cursor = await db
    .transaction("events")
    .store.openCursor(IDBKeyRange.bound(`${caseId}::`, `${caseId}::￿`));
  while (cursor) {
    const k = String(cursor.key).split("::");
    const n = Number(k[1]);
    if (Number.isFinite(n)) max = Math.max(max, n);
    cursor = await cursor.continue();
  }
  return max + 1;
}

export async function appendEvent(
  args: AppendEventArgs,
): Promise<CaseEvent> {
  const db = await eapDB();
  const seq = await nextEventSeq(args.caseId);
  const event: CaseEvent = {
    caseId: args.caseId,
    seq,
    simTime: simClock.now(),
    wallTime: simClock.wallNow(),
    node: args.node,
    type: args.type,
    data: args.data ?? {},
    traceId: args.traceId ?? `tr_${args.caseId}_${seq}`,
    reasonCodes: args.reasonCodes,
    policyVersion: args.policyVersion,
  };
  await db.put("events", event, `${args.caseId}::${seq}`);
  return event;
}

export async function listEvents(caseId: string): Promise<CaseEvent[]> {
  const db = await eapDB();
  const rows = await db.getAll(
    "events",
    IDBKeyRange.bound(`${caseId}::`, `${caseId}::￿`),
  );
  return (rows as CaseEvent[]).sort((a, b) => a.seq - b.seq);
}

export async function countEvents(caseId?: string): Promise<number> {
  const db = await eapDB();
  if (!caseId) return db.count("events");
  return db.count(
    "events",
    IDBKeyRange.bound(`${caseId}::`, `${caseId}::￿`),
  );
}
