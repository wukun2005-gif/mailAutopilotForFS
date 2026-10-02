// Reactive bridge between the UI and the headless CaseRunner. The runner
// instance itself lives outside zustand state (it holds a compiled graph +
// gateway); after every action we refresh the checkpoint snapshot, event
// stream and simulated clock.
import { create } from "zustand";
import { CaseRunner, type ClockTarget } from "@/runtime/caseRunner.ts";
import { appendEvent, listEvents } from "@/runtime/eventStore.ts";
import { simClock, type ClockSnapshot } from "@/runtime/simClock.ts";
import { faultController } from "@/tools/faultController.ts";
import type { CaseStateType } from "@/runtime/caseState.ts";
import type { CaseEvent } from "@/runtime/state.ts";
import type { ScenarioId } from "@/runtime/scenarios.ts";
import type { ResumePayload } from "@/runtime/graphAct.ts";

export interface CaseStoreState {
  scenarioId: ScenarioId | null;
  caseState: CaseStateType | null;
  events: CaseEvent[];
  clock: ClockSnapshot;
  next: string[];
  busy: boolean;
  /** Process-restart simulation: a fresh runner reattached to the same IDB thread. */
  reattached: boolean;
  loadScenario: (id: ScenarioId) => Promise<void>;
  inject: (emailId: string) => Promise<void>;
  stepUp: (method?: "app_case_card" | "one_time_link") => Promise<void>;
  advance: (target: ClockTarget) => Promise<void>;
  approve: (payload: ResumePayload) => Promise<void>;
  /** Simulate a process restart (page refresh) — new graph, same checkpoints. */
  simulateRestart: () => Promise<void>;
  reset: () => Promise<void>;
  /**
   * Wipe the world with no scenario loaded — the state a demo chapter must
   * never inherit from the one before it.
   *
   * `reset()` is conditional (it re-loads whichever scenario is current), so it
   * is a no-op on a fresh page and it leaves the previous chapter's clock and
   * checkpoints in place when the next script loads no scenario of its own
   * (builder does not). This one always clears: IDB stores, mock stores, the
   * sim clock, fault flags, and every case field in the store.
   */
  resetWorld: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Agent edits a draft (FR-7.1): recorded into the dossier, never silent. */
  recordDraftEdit: (draftId: string, editedText: string) => Promise<void>;
  /** Supervisor hands a pending approval back to the agent: handoff recorded,
   *  approval stays pending, nothing sent. */
  handToAgent: (approvalId: string) => Promise<void>;
}

let runner: CaseRunner | null = null;

async function pull(
  set: (p: Partial<CaseStoreState>) => void,
  get: () => CaseStoreState,
  reattached = get().reattached,
) {
  if (!runner) return;
  const snap = await runner.snapshot();
  const events = await listEvents(runner.scenario.caseId);
  set({ caseState: snap.state, events, next: snap.next, clock: simClock.snapshot(), reattached });
}

export const useCaseStore = create<CaseStoreState>((set, get) => ({
  scenarioId: null,
  caseState: null,
  events: [],
  clock: simClock.snapshot(),
  next: [],
  busy: false,
  reattached: false,

  refresh: async () => {
    await pull(set, get);
  },

  loadScenario: async (id) => {
    set({ busy: true });
    runner = new CaseRunner(id);
    await runner.reset();
    faultController.reset();
    set({ scenarioId: id, reattached: false });
    await pull(set, get, false);
    set({ busy: false });
  },

  inject: async (emailId) => {
    if (!runner) return;
    set({ busy: true });
    await runner.injectEmail(emailId);
    await pull(set, get);
    set({ busy: false });
  },

  stepUp: async (method = "app_case_card") => {
    if (!runner) return;
    set({ busy: true });
    await runner.stepUp(method);
    await pull(set, get);
    set({ busy: false });
  },

  advance: async (target) => {
    if (!runner) return;
    set({ busy: true });
    await runner.advance(target);
    await pull(set, get);
    set({ busy: false });
  },

  approve: async (payload) => {
    if (!runner) return;
    set({ busy: true });
    await runner.approve(payload);
    await pull(set, get);
    set({ busy: false });
  },

  simulateRestart: async () => {
    if (!runner) return;
    const id = get().scenarioId;
    if (!id) return;
    set({ busy: true });
    const started = Date.now();
    try {
      // A brand-new runner compiles a fresh graph but opens the same IDB thread.
      runner = new CaseRunner(id);
      // The restart itself is recorded: it is the visible proof in the trace
      // that a fresh runtime reattached without losing state.
      await appendEvent({
        caseId: runner.scenario.caseId,
        node: "runtime",
        type: "system",
        data: { restarted: true },
      });
      await pull(set, get, true);
      // Keep the feedback visible for at least a second so the click registers.
      const elapsed = Date.now() - started;
      if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
    } finally {
      set({ busy: false });
    }
  },

  reset: async () => {
    const id = get().scenarioId;
    if (id) await get().loadScenario(id);
  },

  resetWorld: async () => {
    // A throwaway runner is enough: its reset() wipes the IDB stores, the mock
    // stores, the sim clock and the fault flags, none of which depend on which
    // scenario the runner was built for.
    const r = new CaseRunner(get().scenarioId ?? "email1");
    await r.reset();
    // Drop the scenario the chapter was running on: the next one loads its own
    // (builder loads none), and leaving it set would let a click act on a case
    // that is no longer on screen.
    runner = null;
    set({
      scenarioId: null,
      caseState: null,
      events: [],
      next: [],
      busy: false,
      reattached: false,
      clock: simClock.snapshot(),
    });
  },

  recordDraftEdit: async (draftId, editedText) => {
    if (!runner) return;
    set({ busy: true });
    await runner.editDraft(draftId, editedText);
    await pull(set, get);
    set({ busy: false });
  },

  handToAgent: async (approvalId) => {
    if (!runner) return;
    await appendEvent({
      caseId: runner.scenario.caseId,
      node: "human_checkpoint",
      type: "system",
      data: { handedToAgent: approvalId },
    });
    await pull(set, get);
  },
}));

/** Imperative API for the demo Director (M7), avoiding React re-render churn. */
export const caseActions = {
  loadScenario: (id: ScenarioId) => useCaseStore.getState().loadScenario(id),
  inject: (emailId: string) => useCaseStore.getState().inject(emailId),
  stepUp: () => useCaseStore.getState().stepUp("app_case_card"),
  advance: (t: ClockTarget) => useCaseStore.getState().advance(t),
  approveDue: async () => {
    const s = useCaseStore.getState();
    const due = s.caseState?.approvals.find((a) => a.status === "pending");
    if (due) {
      await s.approve({ approvalId: due.id, decision: "approve", outcome: "error" });
    }
  },
};
