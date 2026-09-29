// Tool gateway (Dev Plan §6.4): the ONLY path from graph nodes to external
// systems. Write tools are risk-registered (R3 tools are absent by design —
// FR-6.2 whitelist), zod-validated, and ledger-idempotent. The mock MSW
// handlers keep a second server-side idempotency layer keyed the same way.
import { z } from "zod";
import type { RLevel } from "./state.ts";
import {
  listActions,
  lookupAction,
  markDone,
  markFailed,
  markInflight,
} from "./idempotency.ts";
import type { ActionLedgerEntry } from "./state.ts";

let baseUrl = "";
/** Tests run MSW in node where fetch needs an absolute URL. */
export function setGatewayBase(url: string): void {
  baseUrl = url;
}

export class ToolError extends Error {
  constructor(
    public code: string,
    message: string,
    public retriable: boolean,
  ) {
    super(message);
  }
}

const WriteInput = z.object({
  caseId: z.string(),
  actionType: z.string(),
  /** Stable per-business-object seed, e.g. refund:ODF-7701 / dispute:DSP-10452. */
  keySeed: z.string(),
  body: z.record(z.string(), z.unknown()),
});
export type WriteInput = z.infer<typeof WriteInput>;

export interface WriteResult {
  replayed: boolean;
  status: number;
  data: unknown;
  entry: ActionLedgerEntry;
}

async function request(path: string, init: RequestInit): Promise<{ status: number; data: unknown }> {
  let res: Response;
  try {
    res = await fetch(baseUrl + path, init);
  } catch (err) {
    throw new ToolError("NETWORK_FAILED", String(err), true);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = (data as { error?: { code?: string } })?.error?.code ?? "HTTP_ERROR";
    // 504/5xx are retriable; 4xx (allow-list, validation) are not.
    throw new ToolError(code, `POST ${path} → ${res.status}`, res.status >= 500);
  }
  return { status: res.status, data };
}

/** Risk declarations for every registered write tool. R3 simply has no row. */
export const TOOL_RISK: Record<string, RLevel | "clockDriven"> = {
  refund_od_fee: "R2",
  lock_card: "R2",
  create_dispute: "R2",
  send_secure_message: "R2",
  send_email: "R2",
  notify_onfile: "R2",
  reg_e_provisional_credit: "clockDriven",
};

export const TOOL_PATHS: Record<string, string> = {
  refund_od_fee: "/mock/refund-od-fee",
  lock_card: "/mock/cards/lock",
  create_dispute: "/mock/disputes",
  send_secure_message: "/mock/secure-messages",
  send_email: "/mock/email/send",
  notify_onfile: "/mock/notify",
  reg_e_provisional_credit: "/mock/provisional-credit",
};

export interface Gateway {
  callWrite(input: WriteInput): Promise<WriteResult>;
  get(path: string): Promise<unknown>;
  postRead(path: string, body: unknown): Promise<unknown>;
}

export function createGateway(): Gateway {
  async function callWrite(raw: WriteInput): Promise<WriteResult> {
    const input = WriteInput.parse(raw);
    const { caseId, actionType, keySeed } = input;
    if (!TOOL_RISK[actionType] || !TOOL_PATHS[actionType])
      throw new ToolError("TOOL_NOT_REGISTERED", actionType, false);

    const key = `${caseId}:${actionType}:${keySeed}`;
    const seen = await lookupAction(key);
    if (seen.hit && seen.entry!.status === "done") {
      return { replayed: true, status: 200, data: seen.entry!.result, entry: seen.entry! };
    }

    const seq = seen.hit
      ? seen.entry!.seq
      : (await listActions(caseId)).length;
    const traceId = `tr_${caseId}_${actionType}_${keySeed}`;
    await markInflight(key, { caseId, actionType, seq, traceId });

    const init: RequestInit = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, ...input.body }),
    };
    try {
      // Reissue even after an "inflight" crash: the server layer replays the
      // first result, so the duplicate HTTP call cannot double-execute.
      const { status, data } = await request(TOOL_PATHS[actionType]!, init);
      const entry = await markDone(key, data);
      return { replayed: seen.hit, status, data, entry };
    } catch (err) {
      await markFailed(key, String(err));
      throw err;
    }
  }

  return {
    callWrite,
    async get(path: string) {
      const res = await fetch(baseUrl + path);
      if (!res.ok) throw new ToolError("READ_FAILED", `${path} → ${res.status}`, res.status >= 500);
      return (await res.json()) as unknown;
    },
    async postRead(path: string, body: unknown) {
      const { data } = await request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      return data;
    },
  };
}
