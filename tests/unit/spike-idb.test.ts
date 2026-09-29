// M0 spike #2: prove the persistence shape M2's IDBSaver needs —
// structured-cloneable checkpoint blobs survive a full database "reload"
// (new connection), keyed by thread + checkpoint id. Uses fake-indexeddb
// so the same test runs in node; the real browser IndexedDB is API-identical.
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { openDB, type IDBPDatabase } from "idb";

interface CheckpointBlob {
  threadId: string;
  values: Record<string, unknown>;
  next: string[];
  createdAt: number;
}

const DB_NAME = "eap-spike";
let db: IDBPDatabase | undefined;

afterEach(() => db?.close());

describe("M0 spike: IndexedDB checkpoint persistence", () => {
  it("stores and reloads checkpoint blobs by thread::checkpoint key", async () => {
    db = await openDB(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore("checkpoints");
        d.createObjectStore("writes");
      },
    });

    const cp: CheckpointBlob = {
      threadId: "CASE-0001",
      values: { phase: "gate", rLevel: "R2", approved: false },
      next: ["gate"],
      createdAt: 1_727_000_000_000,
    };
    await db.put("checkpoints", cp, "CASE-0001::0003");
    await db.put(
      "writes",
      { kind: "interrupt", value: { reason: "need-approval" } },
      "CASE-0001::0003::gate",
    );
    db.close();

    // Simulate page reload: brand-new connection to the same origin database.
    const reloaded = await openDB(DB_NAME, 1);
    const got = (await reloaded.get(
      "checkpoints",
      "CASE-0001::0003",
    )) as CheckpointBlob;
    const write = await reloaded.get("writes", "CASE-0001::0003::gate");

    expect(got).toEqual(cp);
    expect(got.values.rLevel).toBe("R2");
    expect(write).toEqual({
      kind: "interrupt",
      value: { reason: "need-approval" },
    });
    reloaded.close();
  });
});
