// M0 spike #1: prove the LangGraph primitive the whole runtime rests on —
// a node interrupts for human approval, the checkpointed thread pauses
// (update NOT applied), then resumes with a Command and finishes.
import { describe, expect, it } from "vitest";
import {
  Annotation,
  Command,
  END,
  interrupt,
  MemorySaver,
  START,
  StateGraph,
} from "@langchain/langgraph";

const SpikeState = Annotation.Root({
  value: Annotation<number>(),
  approved: Annotation<boolean>(),
  seenByNode: Annotation<string[]>({
    reducer: (a, b) => [...(a ?? []), ...(b ?? [])],
    default: () => [],
  }),
});

let gateExecutions = 0;

const gateNode = async (state: typeof SpikeState.State) => {
  gateExecutions += 1;
  if (state.approved) {
    return { seenByNode: ["already-approved"] };
  }
  // interrupt() pauses here; on resume the node re-runs from the top and
  // interrupt() returns the resume payload ("yes" / "no").
  const decision = interrupt({ reason: "need-approval", risk: "R2" }) as
    | string
    | undefined;
  return {
    approved: decision === "yes",
    value: state.value + 1,
    seenByNode: [`decided:${String(decision)}`],
  };
};

function buildGraph() {
  return new StateGraph(SpikeState)
    .addNode("gate", gateNode)
    .addEdge(START, "gate")
    .addEdge("gate", END)
    .compile({ checkpointer: new MemorySaver() });
}

describe("M0 spike: LangGraph interrupt → resume", () => {
  it("pauses at interrupt, then completes with the human's decision", async () => {
    gateExecutions = 0;
    const graph = buildGraph();
    const cfg = { configurable: { thread_id: "spike-thread-1" } };

    // First run stops at the gate.
    await graph.invoke({ value: 41, approved: false }, cfg);
    const paused = await graph.getState(cfg);

    expect(paused.next).toContain("gate");
    expect(paused.values.value).toBe(41); // node update must NOT be applied
    expect(paused.values.approved).toBe(false);
    const intr = paused.tasks[0]?.interrupts?.[0];
    expect(intr?.value).toEqual({ reason: "need-approval", risk: "R2" });

    // Reject path: resume "no" → approved stays false, graph still finishes.
    await graph.invoke(new Command({ resume: "no" }), cfg);
    const rejected = await graph.getState(cfg);
    expect(rejected.next).toEqual([]);
    expect(rejected.values.approved).toBe(false);
    expect(rejected.values.value).toBe(42); // update applied after resume

    // A fresh thread approved on entry skips the interrupt entirely.
    gateExecutions = 0;
    const cfg2 = { configurable: { thread_id: "spike-thread-2" } };
    const out2 = await graph.invoke({ value: 0, approved: true }, cfg2);
    expect(out2.approved).toBe(true);
    expect(gateExecutions).toBe(1);
  });

  it("supports multiple resume rounds (escalation chain) on one thread", async () => {
    const MultiState = Annotation.Root({
      round: Annotation<number>({ reducer: (a, b) => b ?? a, default: () => 0 }),
      approvals: Annotation<string[]>({
        reducer: (a, b) => [...(a ?? []), ...(b ?? [])],
        default: () => [],
      }),
    });
    let runs = 0;
    const multiNode = async (state: typeof MultiState.State) => {
      runs += 1;
      const vote = interrupt({ round: state.round }) as string | undefined;
      // After the 2nd resume the conditional edge sends us to END; only the
      // two paused rounds carry resume votes.
      return { round: state.round + 1, approvals: vote ? [vote] : [] };
    };
    const g = new StateGraph(MultiState)
      .addNode("m", multiNode)
      .addEdge(START, "m")
      .addConditionalEdges("m", (s) => (s.round >= 2 ? END : "m"))
      .compile({ checkpointer: new MemorySaver() });

    const cfg = { configurable: { thread_id: "multi" } };
    await g.invoke({}, cfg);
    expect((await g.getState(cfg)).tasks[0]?.interrupts?.[0]?.value).toEqual({
      round: 0,
    });
    await g.invoke(new Command({ resume: "L1-ok" }), cfg);
    expect((await g.getState(cfg)).tasks[0]?.interrupts?.[0]?.value).toEqual({
      round: 1,
    });
    const finalState = await g.invoke(new Command({ resume: "L2-ok" }), cfg);
    expect(finalState.approvals).toEqual(["L1-ok", "L2-ok"]);
    expect(finalState.round).toBe(2);
    // Two interrupted rounds each re-execute the node on resume, plus the two
    // fresh entries into the node = 4 executions total.
    expect(runs).toBe(4);
  });
});
