// Case machine wiring: 9 linear nodes START→END with one conditional exit
// (triage low-confidence handoff). Compiled with the IndexedDB checkpointer so
// a paused case survives page reload / process restart (Dev Plan §6.5).
import { END, START, StateGraph } from "@langchain/langgraph";
import { CaseStateAnnotation, type CaseStateType } from "./caseState.ts";
import { IDBSaver } from "./saver.ts";
import { createGateway } from "./gateway.ts";
import {
  makeAutonomy,
  makeIdentity,
  makeIngest,
  makePolicy,
  makeTriage,
} from "./graphNodes.ts";
import { makeAct, makeHumanCheckpoint } from "./graphAct.ts";
import { makeRespond } from "./graphRespond.ts";
import { makeClose } from "./graphClose.ts";

export function buildCaseGraph(checkpointer?: IDBSaver) {
  const gateway = createGateway();
  const deps = { gateway };

  // Node names carry an n_ prefix because "identity"/"policy" are also state
  // channels and LangGraph forbids the overlap.
  const workflow = new StateGraph(CaseStateAnnotation)
    .addNode("n_ingest", makeIngest(deps))
    .addNode("n_triage", makeTriage())
    .addNode("n_identity", makeIdentity())
    .addNode("n_policy", makePolicy(deps))
    .addNode("n_autonomy", makeAutonomy())
    .addNode("n_act", makeAct(deps))
    .addNode("n_human_checkpoint", makeHumanCheckpoint(deps))
    .addNode("n_respond", makeRespond(deps))
    .addNode("n_close", makeClose())
    .addEdge(START, "n_ingest")
    .addEdge("n_ingest", "n_triage")
    .addConditionalEdges("n_triage", (state: CaseStateType) =>
      // The triage handoff exit exists only for low-confidence EMAIL turns.
      // Approval/clock/step-up turns replay the graph from START and must pass
      // through to the checkpoint even when status persisted as awaiting_human.
      state.status === "awaiting_human" &&
      state.turn.kind === "email" &&
      state.intents.length > 0
        ? "handoff_exit"
        : "n_identity",
    { n_identity: "n_identity", handoff_exit: END })
    .addEdge("n_identity", "n_policy")
    .addEdge("n_policy", "n_autonomy")
    .addEdge("n_autonomy", "n_act")
    .addEdge("n_act", "n_human_checkpoint")
    .addEdge("n_human_checkpoint", "n_respond")
    .addEdge("n_respond", "n_close")
    .addEdge("n_close", END);

  const graph = workflow.compile({ checkpointer: checkpointer ?? new IDBSaver() });
  return { graph, gateway };
}
