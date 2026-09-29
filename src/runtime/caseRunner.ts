// Headless case driver for tests and the demo Director (Dev Plan §8/§9).
// One runner per scenario; every turn is a graph.invoke against the same
// thread_id, with the IDBSaver checkpointer making interrupt/restart resumable.
import { Command } from "@langchain/langgraph";
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
    const verify = await this.gateway.postRead("/mock/otp/verify", { code: "482915" });
    const ok = (verify as { data: { verified: boolean } }).data.verified;
    if (!ok) throw new Error("step-up verification failed");
    return this.invoke(
      this.baseTurn(
        { kind: "step_up", emailId },
        { stepUp: { verified: true, method, emailId } },
      ),
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
      simClock.jumpToCalendarDay(14, 9, 0);
    }
    return this.invoke(this.baseTurn({ kind: "clock" }));
  }

  /** Supervisor decision on a paused approval (Command resume). */
  async approve(payload: ResumePayload): Promise<RunnerSnapshot> {
    return this.invoke(new Command({ resume: payload }) as unknown as Parameters<typeof this.graph.invoke>[0]);
  }

  /** Convenience: approve the single currently-paused approval. */
  async approveDue(extra: Partial<ResumePayload> = {}): Promise<RunnerSnapshot> {
    const snap = await this.snapshot();
    const paused = snap.next.length > 0;
    if (!paused) return snap;
    const state = snap.state;
    const dueApproval = state.approvals.find((a) => a.status === "pending");
    if (!dueApproval) return snap;
    return this.approve({
      approvalId: dueApproval.id,
      decision: "approve",
      outcome: "error",
      ...extra,
    });
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
    return {
      state: state.values,
      next: state.next ?? [],
      interrupted: (state.next ?? []).length > 0,
    };
  }
}

function parseTime(hhmm: string): [number, number] {
  const [h, m] = hhmm.split(":").map(Number);
  return [h ?? 8, m ?? 0];
}
