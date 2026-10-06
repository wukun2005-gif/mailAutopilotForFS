// Headless case driver for tests and the demo Director (Dev Plan §8/§9).
// One runner per scenario; every turn is a graph.invoke against the same
// thread_id, with the IDBSaver checkpointer making interrupt/restart resumable.
import { buildCaseGraph } from "./graph.ts";
import { IDBSaver } from "./saver.ts";
import { SCENARIOS, type Scenario, type ScenarioId } from "./scenarios.ts";
import { emailById } from "./graphNodes.ts";
import { clearStores } from "./db.ts";
import { simClock, regEClocks, DAY0_EPOCH } from "./simClock.ts";
import { faultController } from "@/tools/faultController.ts";
import type { CaseStateType } from "./caseState.ts";
import type { ResumePayload } from "./graphAct.ts";

export type ClockTarget = "bd10" | "day40" | "day45" | "verify14d";

export interface RunnerSnapshot {
  state: CaseStateType;
  next: string[];
  interrupted: boolean;
}

export class CaseRunner {
  readonly scenario: Scenario;
  readonly graph: ReturnType<typeof buildCaseGraph>["graph"];
  readonly gateway: ReturnType<typeof buildCaseGraph>["gateway"];
  private readonly saver: IDBSaver;

  constructor(scenarioId: ScenarioId) {
    this.scenario = SCENARIOS[scenarioId];
    this.saver = new IDBSaver();
    const built = buildCaseGraph(this.saver);
    this.graph = built.graph;
    this.gateway = built.gateway;
  }

  private get config() {
    return { configurable: { thread_id: this.scenario.threadId } };
  }

  /** Wipe checkpoints, events, idempotency ledger, mock stores; return to Day 0. */
  async reset(): Promise<void> {
    await clearStores(["checkpoints", "writes", "events", "idempotency", "meta"]);
    await this.gateway.postRead("/mock/admin/reset", {});
    simClock.reset();
    faultController.reset();
    // NOTE: graduationOverrides intentionally survive scenario resets —
    // Builder graduation/caps are policy config, not scenario state.
  }

  private baseTurn(turn: unknown, extra: Record<string, unknown> = {}) {
    return {
      caseId: this.scenario.caseId,
      threadId: this.scenario.threadId,
      scenarioId: this.scenario.scenarioId,
      customerId: this.scenario.customerId,
      turn,
      ...extra,
    };
  }

  /** Deliver an inbound email; the fixture's atDayN/atTime drives the sim clock. */
  async injectEmail(emailId: string): Promise<RunnerSnapshot> {
    const email = emailById(emailId);
    if (!email) throw new Error(`unknown email ${emailId}`);
    simClock.jumpToCalendarDay(email.atDayN, ...parseTime(email.atTime));
    return this.invoke(
      this.baseTurn({ kind: "email", emailId, atDayN: email.atDayN }),
    );
  }

  /** Customer completes step-up: App case card (OTP to on-file phone), then resume. */
  async stepUp(method: "app_case_card" | "one_time_link" = "app_case_card"): Promise<RunnerSnapshot> {
    const emailId = (await this.snapshot()).state.currentEmailId;
    const start = await this.gateway.postRead("/mock/otp/start", {
      customerId: this.scenario.customerId,
      channel: method === "app_case_card" ? "sms" : "link",
    });
    if (!(start as { data: { started: boolean } }).data.started)
      throw new Error("otp start failed");
    const verify = await this.gateway.postRead("/mock/otp/verify", { code: "111111" });
    const ok = (verify as { data: { verified: boolean } }).data.verified;
    if (!ok) throw new Error("step-up verification failed");
    return this.invoke(
      this.baseTurn(
        { kind: "step_up", emailId },
        { stepUp: { verified: true, method, emailId } },
      ),
    );
  }

  /** Agent edits a draft (FR-7.1): persisted onto the checkpointed draft. */
  async editDraft(draftId: string, editedText: string): Promise<RunnerSnapshot> {
    return this.invoke(
      this.baseTurn({ kind: "draft_edit", draftId, editedText }),
    );
  }

  /** Advance the simulated clock and run a clock turn. */
  async advance(target: ClockTarget): Promise<RunnerSnapshot> {
    if (target === "bd10") {
      simClock.set(regEClocks(DAY0_EPOCH).provisionalCreditDue);
    } else if (target === "day40") {
      simClock.jumpToCalendarDay(40, 9, 0);
    } else if (target === "day45") {
      simClock.jumpToCalendarDay(45, 9, 0);
    } else {
      // Relative +14d watch window: never travels back, so Day-21 content
      // stays visible when the button is pressed after the second request.
      simClock.jumpToCalendarDay(simClock.dayN() + 14, 9, 0);
    }
    return this.invoke(this.baseTurn({ kind: "clock" }));
  }

  /** Supervisor decision on a paused approval (fresh approval turn). */
  async approve(payload: ResumePayload): Promise<RunnerSnapshot> {
    return this.invoke(
      this.baseTurn({
        kind: "approval",
        approvalId: payload.approvalId,
        decision: payload.decision,
        reasonCode: payload.reasonCode,
        outcome: payload.outcome,
      }),
    );
  }

  /** Re-run policy → autonomy → act for the open email under the current
   *  fault flags (Card B grant flips policyV14). No-ops when nothing is
   *  waiting on the old verdict. */
  async refreshPolicy(): Promise<RunnerSnapshot> {
    const snap = await this.snapshot();
    // A freshly loaded scenario has no emails yet: LangGraph state keys the
    // append-only collections do not exist until something appends, so an
    // "empty" case is approvals === undefined, not [].
    const pending = (snap.state.approvals ?? []).some(
      (a) => a.status === "pending" && a.intentCode === "od_fee_refund",
    );
    if (!pending || !snap.state.currentEmailId) return snap;
    return this.invoke(
      this.baseTurn({ kind: "policy_refresh", emailId: snap.state.currentEmailId }),
    );
  }

  /** Convenience: approve the single currently-paused approval. */
  async approveDue(extra: Partial<ResumePayload> = {}): Promise<RunnerSnapshot> {
    const snap = await this.snapshot();
    const state = snap.state;
    const dueApproval = (state.approvals ?? []).find(
      (a) => a.status === "pending" && a.blocking !== false && this.isDue(a),
    );
    if (!dueApproval) return snap;
    return this.approve({
      approvalId: dueApproval.id,
      decision: "approve",
      outcome: "error",
      ...extra,
    });
  }

  private isDue(a: CaseStateType["approvals"][number]): boolean {
    if (!a.clockDueAt) return true;
    return simClock.now() >= a.clockDueAt - 48 * 3600 * 1000;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async invoke(input: any): Promise<RunnerSnapshot> {
    await this.graph.invoke(input, this.config);
    return this.snapshot();
  }

  async snapshot(): Promise<RunnerSnapshot> {
    const state = (await this.graph.getState(this.config)) as unknown as {
      values: CaseStateType;
      next: string[];
    };
    const values = state.values;
    // FR-1.5 reviewer tasks are pending work but never a mid-flow interrupt.
    const dueApproval = (values?.approvals ?? []).some(
      (a) => a.status === "pending" && a.blocking !== false && this.isDue(a),
    );
    // Only due human approvals count as a mid-flow interrupt; customer
    // step-up pauses end the run naturally and report interrupted=false.
    const next = dueApproval ? ["n_human_checkpoint"] : [];
    return { state: values, next, interrupted: dueApproval };
  }
}

function parseTime(hhmm: string): [number, number] {
  const [h, m] = hhmm.split(":").map(Number);
  return [h ?? 8, m ?? 0];
}
