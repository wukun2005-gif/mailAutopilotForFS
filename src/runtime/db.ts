// IndexedDB schema for the prototype (Dev Plan §6.4): LangGraph checkpoints +
// pending writes (M2 IDBSaver), CaseEvent stream, and the idempotency ledger.
// One database, five object stores, keyed by strings — no index upgrades
// needed because case/thread prefixes make range scans trivial.
import { openDB, type IDBPDatabase } from "idb";

export const EAP_DB = "eap-v1";
export const DB_VERSION = 1;

export interface EAPDBShape {
  checkpoints: { key: string; value: unknown };
  writes: { key: string; value: unknown };
  events: { key: string; value: unknown };
  idempotency: { key: string; value: unknown };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function eapDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(EAP_DB, DB_VERSION, {
      upgrade(d) {
        for (const name of [
          "checkpoints",
          "writes",
          "events",
          "idempotency",
          "meta",
        ]) {
          if (!d.objectStoreNames.contains(name)) d.createObjectStore(name);
        }
      },
    });
  }
  return dbPromise;
}

/** Test/director escape hatch: force the next eapDB() call to reopen. */
export function resetDBPromise(): void {
  dbPromise = null;
}

/** Clear stores (all, or only one scenario's prefixed rows). */
export async function clearStores(
  stores: Array<keyof EAPDBShape> = ["checkpoints", "writes", "events", "idempotency"],
  keyPrefix?: string,
): Promise<void> {
  const db = await eapDB();
  for (const store of stores) {
    const tx = db.transaction(store, "readwrite");
    let cursor = await tx.store.openCursor();
    while (cursor) {
      const key = String(cursor.key);
      if (!keyPrefix || key.startsWith(keyPrefix)) await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}
