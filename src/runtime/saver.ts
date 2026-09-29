// IDBSaver — LangGraph checkpointer backed by IndexedDB (Dev Plan §6.4).
// Mirrors MemorySaver's storage model:
//   checkpoints store: key [threadId, ns, checkpointId] → {c, m, parent}
//   writes store:      key [threadId, ns, checkpointId, taskId, idx] → blob
// Serialization uses the framework JsonPlusSerializer (default on the base
// class); Uint8Array blobs structured-clone into IndexedDB natively.
import {
  BaseCheckpointSaver,
  getCheckpointId,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointTuple,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { PendingWrite } from "@langchain/langgraph-checkpoint";
import { eapDB } from "./db.ts";

interface StoredCheckpoint {
  c: Uint8Array;
  m: Uint8Array;
  parent: string | undefined;
}

interface StoredWrite {
  taskId: string;
  channel: string;
  v: Uint8Array;
}

function cpKey(threadId: string, ns: string, checkpointId: string): string {
  return JSON.stringify([threadId, ns, checkpointId]);
}

function writeKey(
  threadId: string,
  ns: string,
  checkpointId: string,
  taskId: string,
  idx: number,
): string {
  return JSON.stringify([threadId, ns, checkpointId, taskId, idx]);
}

/** Prefix shared by every checkpoint/write row of one thread (for deletion). */
function threadPrefix(threadId: string): string {
  return JSON.stringify([threadId]);
}

function cfgParts(config: RunnableConfig): {
  threadId: string;
  ns: string;
  checkpointId?: string;
} {
  const c = config.configurable ?? {};
  return {
    threadId: String(c.thread_id),
    ns: String(c.checkpoint_ns ?? ""),
    checkpointId: c.checkpoint_id ? String(c.checkpoint_id) : undefined,
  };
}

export class IDBSaver extends BaseCheckpointSaver {
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const { threadId, ns, checkpointId: wanted } = cfgParts(config);
    const db = await eapDB();

    let checkpointId = wanted;
    let stored: StoredCheckpoint | undefined;
    if (checkpointId) {
      stored = (await db.get(
        "checkpoints",
        cpKey(threadId, ns, checkpointId),
      )) as StoredCheckpoint | undefined;
    } else {
      // Latest checkpoint for this thread + namespace.
      const all = await db.getAllKeys("checkpoints");
      const ids = all
        .map((k) => JSON.parse(String(k)) as string[])
        .filter((p) => p[0] === threadId && p[1] === ns)
        .map((p) => p[2]!)
        .sort((a, b) => b.localeCompare(a));
      checkpointId = ids[0];
      if (checkpointId)
        stored = (await db.get(
          "checkpoints",
          cpKey(threadId, ns, checkpointId),
        )) as StoredCheckpoint | undefined;
    }
    if (!stored || !checkpointId) return undefined;

    const checkpoint = (await this.serde.loadsTyped(
      "json",
      stored.c,
    )) as Checkpoint;
    const metadata = (await this.serde.loadsTyped(
      "json",
      stored.m,
    )) as CheckpointMetadata;

    const writeRows = await this.listWrites(threadId, ns, checkpointId);
    const pendingWrites: [string, string, unknown][] = await Promise.all(
      writeRows.map(async (w) => [
        w.taskId,
        w.channel,
        await this.serde.loadsTyped("json", w.v),
      ]),
    );

    const tuple: CheckpointTuple = {
      config: {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: ns,
          checkpoint_id: checkpointId,
        },
      },
      checkpoint,
      metadata,
      pendingWrites: pendingWrites as unknown as CheckpointTuple["pendingWrites"],
    };
    if (stored.parent)
      tuple.parentConfig = {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: ns,
          checkpoint_id: stored.parent,
        },
      };
    return tuple;
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    const { threadId, ns: cfgNs } = cfgParts(config);
    const limit = options?.limit;
    const beforeId = options?.before?.configurable?.checkpoint_id as
      | string
      | undefined;
    const db = await eapDB();
    const all = await db.getAllKeys("checkpoints");
    const rows = all
      .map((k) => JSON.parse(String(k)) as string[])
      .filter(
        (p) =>
          p[0] === threadId &&
          (cfgNs === undefined || cfgNs === "" || p[1] === cfgNs),
      )
      .sort((a, b) => b[2]!.localeCompare(a[2]!));

    let remaining = limit;
    for (const [, ns, id] of rows) {
      if (beforeId && id! >= beforeId) continue;
      if (remaining !== undefined) {
        if (remaining <= 0) break;
        remaining -= 1;
      }
      const tuple = await this.getTuple({
        configurable: { thread_id: threadId, checkpoint_ns: ns, checkpoint_id: id },
      });
      if (tuple) yield tuple;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    const { threadId, ns } = cfgParts(config);
    const db = await eapDB();
    const [, cBytes] = await this.serde.dumpsTyped(checkpoint);
    const [, mBytes] = await this.serde.dumpsTyped(metadata);
    const row: StoredCheckpoint = {
      c: cBytes as Uint8Array,
      m: mBytes as Uint8Array,
      parent: getCheckpointId(config),
    };
    await db.put("checkpoints", row, cpKey(threadId, ns, checkpoint.id));
    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: ns,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    const { threadId, ns, checkpointId } = cfgParts(config);
    if (!checkpointId) throw new Error("putWrites requires checkpoint_id");
    const db = await eapDB();
    let idx = 0;
    for (const [channel, value] of writes) {
      const [, vBytes] = await this.serde.dumpsTyped(value);
      const useIdx = channel === "__root__" ? -idx - 1 : idx;
      const key = writeKey(threadId, ns, checkpointId, taskId, useIdx);
      // Positive-index regular writes are written once per task (MemorySaver).
      const existing = await db.get("writes", key);
      if (!existing) {
        const row: StoredWrite = {
          taskId,
          channel,
          v: vBytes as Uint8Array,
        };
        await db.put("writes", row, key);
      }
      idx += 1;
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    const db = await eapDB();
    for (const store of ["checkpoints", "writes"] as const) {
      const keys = await db.getAllKeys(store);
      const prefix = threadPrefix(threadId);
      for (const k of keys) {
        if (String(k).startsWith(prefix)) await db.delete(store, k);
      }
    }
  }

  private async listWrites(
    threadId: string,
    ns: string,
    checkpointId: string,
  ): Promise<StoredWrite[]> {
    const db = await eapDB();
    const prefix = JSON.stringify([threadId, ns, checkpointId]);
    const keys = await db.getAllKeys("writes");
    const rows: StoredWrite[] = [];
    for (const k of keys) {
      if (String(k).startsWith(prefix)) {
        const row = (await db.get("writes", k)) as StoredWrite;
        if (row) rows.push(row);
      }
    }
    return rows;
  }
}
