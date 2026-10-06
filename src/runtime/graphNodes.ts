// Nodes 1–5 of the 9-node case machine (Dev Plan §6.1): ingest → triage →
// identity → policy evaluation → autonomy decision. Nodes 6–9 live in
// graphAct.ts; graph.ts wires edges. Every node is deterministic in recorded
// mode and idempotent across super-step replays.
import type { CaseStateType } from "./caseState.ts";
import {
  INBOUND_EMAILS,
  OD_FEES,
  POLICY_PACKS,
  OD_FEE_WAIVER_V12,
  OD_FEE_WAIVER_V13,
  OD_FEE_WAIVER_V14,
  REGE_INTAKE_V3,
  REGE_POS_INVEST_90,
  type EmailMessage,
  type FraudSignals,
} from "@/mocks/fixtures/index.ts";
import { recordedTriage, intentSpec, parallelSignals } from "./intentRegistry.ts";
import { autonomyInput } from "./autonomyView.ts";
import { evaluateIdentity } from "./identitySignals.ts";
import { evaluatePack } from "./policyEngine.ts";
import { decideCell } from "./gates.ts";
import { appendEvent } from "./eventStore.ts";
import { faultController } from "@/tools/faultController.ts";
import type { Gateway } from "./gateway.ts";
import type { Command } from "@langchain/langgraph";

export interface NodeDeps {
  gateway: Gateway;
}

export type NodeFn = (
  state: CaseStateType,
  config?: unknown,
) =>
  | Promise<Partial<CaseStateType> | Command>
  | Partial<CaseStateType>
  | Command;

export function unwrap<T>(r: unknown): T {
  return (r as { data: T }).data;
}

export function emailById(id: string | null): EmailMessage | undefined {
  return INBOUND_EMAILS.find((e) => e.id === id);
}

async function emit(
  state: CaseStateType,
  node: string,
  type: Parameters<typeof appendEvent>[0]["type"],
  data?: Record<string, unknown>,
  reasonCodes?: string[],
  policyVersion?: string,
) {
  await appendEvent({ caseId: state.caseId, node, type, data, reasonCodes, policyVersion });
}

// ── 1. ingest: dedupe, DLP pre-scan, fraud prefetch ──────────────────────────

export function makeIngest(deps: NodeDeps): NodeFn {
  return async (state) => {
    if (state.turn.kind !== "email") return {};
    const email = emailById(state.turn.emailId ?? null);
    if (!email) return {};
    // Thread merge: a repeat delivery of the same id is a nudge/duplicate, not a
    // new case — suppress it loudly so the dedup is demo-visible.
    if (state.emails.some((e) => e.id === email.id)) {
      await emit(state, "ingest", "system", {
        duplicateSuppressed: email.id,
        threadId: email.threadId,
      });
      return {};
    }

    const attachmentText = (email.attachments ?? [])
      .map((a) => ("injectedText" in a ? (a as { injectedText?: string }).injectedText : ""))
      .filter(Boolean)
      .join("\n");
    const scan = unwrap<{ clean: boolean; hits: { type: string }[] }>(
      await deps.gateway.postRead("/mock/dlp/scan", {
        text: `${email.body.en}\n${attachmentText}`,
        enforce: false,
      }),
    );
    const fraud = unwrap<FraudSignals>(
      await deps.gateway.get(
        `/mock/fraud/signals?scenarioId=${email.scenarioId}`,
      ),
    );
    const fraudFlags = [
      fraud.localPartLookalike && "LOCAL_PART_LOOKALIKE",
      fraud.displayNameSpoof && "DISPLAY_NAME_SPOOF",
      fraud.promptInjection && "PROMPT_INJECTION",
      fraud.r3ComboRequested && "R3_COMBO",
      fraud.atoScore >= 70 && `ATO_SCORE_${fraud.atoScore}`,
    ].filter(Boolean) as string[];

    await emit(state, "ingest", "email_inbound", {
      emailId: email.id,
      threadId: email.threadId,
      threadSize: state.emails.filter((e) => e.threadId === email.threadId).length + 1,
      aliasNormalized: true,
      dlpClean: scan.clean,
      dlpHits: scan.hits.map((h) => h.type),
      fraudFlags,
    });
    return {
      emails: [email],
      currentEmailId: email.id,
      prescan: {
        dlpHits: scan.hits.map((h) => h.type),
        atoScore: fraud.atoScore,
        fraudFlags,
      },
    };
  };
}

// ── 2. triage & intent: recorded detector, low confidence → human ───────────

const CONFIDENCE_FLOOR = 0.9;

export function makeTriage(): NodeFn {
  return async (state) => {
    if (state.turn.kind !== "email") return {};
    const emailId = state.turn.emailId ?? state.currentEmailId;
    if (!emailId) return {};
    const hits = recordedTriage(emailId);
    // Language / vulnerability / fraud screening runs in parallel with intent,
    // negatives included, so step 2 is never "fraud-only" in the trace.
    const parallel = parallelSignals(emailId);
    await emit(state, "triage", "system", {
      emailId,
      intents: hits.map((h) => h.intentCode),
      lang: parallel.lang,
      vulnerable: parallel.vulnerable,
    });
    if (hits.length === 0) {
      // Day-6 materials email: no customer-facing intent.
      return { status: state.status === "open" ? "open" : state.status };
    }
    if (hits.some((h) => h.confidence < CONFIDENCE_FLOOR)) {
      await emit(state, "triage", "gate", { lowConfidence: true }, [
        "LOW_CONFIDENCE_HANDOFF",
      ]);
      return { intents: hits, status: "awaiting_human" };
    }
    return { intents: hits };
  };
}

// ── 3. identity assurance: pure gate over recorded six-group signals ────────

export function makeIdentity(): NodeFn {
  return async (state) => {
    if (!["email", "step_up"].includes(state.turn.kind)) return {};
    const emailId =
      state.turn.kind === "step_up"
        ? state.currentEmailId
        : state.turn.emailId ?? state.currentEmailId;
    const email = emailById(emailId ?? null);
    if (!email) return {};

    const firstInThread = state.emails.find((e) => e.threadId === email.threadId);
    const stepUp = state.stepUp;
    const verdict = evaluateIdentity({
      email,
      stepUp,
      firstThreadFrom: firstInThread?.from ?? null,
    });
    await emit(state, "identity", "gate", {
      level: verdict.level,
      signals: verdict.signals.filter((s) => s.passed).map((s) => s.code),
      failed: verdict.signals.filter((s) => !s.passed).map((s) => s.code),
    }, verdict.reasonCodes);
    return {
      identity: {
        level: verdict.level,
        signals: verdict.signals,
        reasonCodes: verdict.reasonCodes,
        assumptions: verdict.assumptions,
      },
      lastLevel: verdict.level,
      stepUp: stepUp ?? state.stepUp,
    };
  };
}

// ── 4. policy evaluation: deterministic local engine, condition cards ───────

export function makePolicy(deps: NodeDeps): NodeFn {
  return async (state) => {
    if (!["email", "step_up", "policy_refresh"].includes(state.turn.kind)) return {};
    const emailId = state.currentEmailId;
    if (!emailId) return {};
    const hits = state.intents.filter((i) => i.sourceEmailId === emailId);
    const cards = [];
    let degraded = false;

    for (const hit of hits) {
      const spec = intentSpec(hit.intentCode);
      if (hit.intentCode === "od_fee_refund") {
        const accounts = unwrap<{ status: string }[]>(
          await deps.gateway.get(`/mock/accounts?customerId=${state.customerId}`),
        );
        const priorRefunds = state.actions.filter(
          (a) => a.actionType === "refund_od_fee" && a.status === "done",
        ).length;
        const pack = faultController.isOn("policyV14")
          ? OD_FEE_WAIVER_V14
          : faultController.isOn("policyV13")
            ? OD_FEE_WAIVER_V13
            : OD_FEE_WAIVER_V12;
        cards.push(
          evaluatePack(
            pack,
            {
              // Counting the request under review: beat1 = 1 (PASS ≤1), beat2 = 2 (FAIL).
              waivers12m: priorRefunds + 1,
              accountStatus: accounts[0]?.status ?? "good",
              feeAmountCents: OD_FEES[0]!.amountCents,
              // Card B's goodwill pattern: within 24h of the shortfall the customer
              // made the funds whole and a same-day inbound deposit is pending.
              goodwillPattern: faultController.isOn("policyV14"),
            },
            { sourceEmailId: emailId },
          ),
        );
      }
      if (hit.intentCode === "reg_e_intake") {
        cards.push(
          evaluatePack(
            REGE_INTAKE_V3,
            { reportedWithin60d: true, errorNoticePresent: true },
            { sourceEmailId: emailId },
          ),
          evaluatePack(
            REGE_POS_INVEST_90,
            { channelIsPOSDebit: true },
            { sourceEmailId: emailId },
          ),
        );
      }
      void spec;
    }
    await emit(state, "policy", "system", {
      cards: cards.map((c) => ({ policyId: c.policyId, version: c.version, overall: c.overall })),
    });
    return { policyCards: cards, prescan: state.prescan, ...(degraded ? {} : {}) };
  };
}

// ── 5. autonomy decision: CellValue per intent, fail-closed ─────────────────

export function makeAutonomy(): NodeFn {
  return async (state) => {
    if (!["email", "step_up", "policy_refresh"].includes(state.turn.kind)) return {};
    const emailId = state.currentEmailId;
    if (!emailId) return {};
    const level = state.identity?.level ?? "I0";

    const decisions = state.intents
      .filter((i) => i.sourceEmailId === emailId)
      .map((hit) => {
        const spec = intentSpec(hit.intentCode);
        // Same input builder the audit-view matrix strip calls (autonomyView.ts):
        // one source of truth for what the matrix is asked, so the row the
        // presenter sees can never disagree with the applied verdict.
        const cell = decideCell(autonomyInput(state, hit.intentCode, spec.risk, emailId));
        return {
          intentCode: hit.intentCode,
          sourceEmailId: emailId,
          cell: cell.cell,
          reasonCodes: cell.reasonCodes,
        };
      });

    // transaction_detail is an I3-only field (FR-2.3): below I3 it is a deny.
    for (const d of decisions) {
      if (d.intentCode === "transaction_detail" && level !== "I3") {
        d.cell = { kind: "deny", reasonCode: "TX_DETAIL_REQUIRES_I3_STEPUP" };
        d.reasonCodes = ["DRAFT_CHANNEL_CLOSED", "GUIDE_STEPUP"];
      }
    }

    await emit(state, "autonomy", "gate", {
      identity: level,
      cells: decisions.map((d) => ({ intent: d.intentCode, cell: d.cell })),
    }, decisions.flatMap((d) => d.reasonCodes));
    return { decisions, lastLevel: level };
  };
}

/** Policy pack lookup helper for act node. */
export function packById(policyId: string) {
  return POLICY_PACKS[policyId];
}
