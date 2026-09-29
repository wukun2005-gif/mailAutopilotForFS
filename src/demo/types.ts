// Demo beat model (Dev Plan §8.1 / §9). Director beats drive the real
// runtime/store; cursor beats move the fake cursor and perform real DOM
// clicks — approvals are always clicked, never auto-approved.
import type { ScenarioId } from "@/runtime/scenarios.ts";
import type { ClockTarget } from "@/runtime/caseRunner.ts";
import type { FaultFlag } from "@/tools/faultController.ts";
import type { ScreenId } from "@/store/uiStore.ts";

export type BeatAction =
  | { t: "tooltip"; key: string; ms?: number }
  | { t: "cursor"; target: string; click?: boolean; type?: string; wait?: number; require?: boolean }
  | { t: "load"; scenario: ScenarioId }
  | { t: "inject"; emailId: string }
  | { t: "clock"; to: ClockTarget }
  | { t: "fault"; flag: FaultFlag; on?: boolean }
  | { t: "restart" }
  | { t: "goto"; screen: ScreenId }
  | { t: "wait"; ms: number };

export interface Beat {
  id: string;
  chapter: string;
  action: BeatAction;
}

export interface DemoScript {
  id: string;
  /** i18n key in the demo namespace */
  nameKey: string;
  beats: Beat[];
}
