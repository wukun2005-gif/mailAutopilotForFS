// Demo beat model (Dev Plan §8.1 / §9). Director beats drive the real
// runtime/store; cursor beats move the fake cursor and perform real DOM
// clicks — approvals are always clicked, never auto-approved.
import type { ScenarioId } from "@/runtime/scenarios.ts";
import type { ClockTarget } from "@/runtime/caseRunner.ts";
import type { FaultFlag } from "@/tools/faultController.ts";
import type { ScreenId } from "@/store/uiStore.ts";

export type BeatAction =
  /**
   * Narration beat. `focus` is the data-id the caption is about: the fake
   * cursor points at it and the element itself is marked with `data-hl`
   * (styled in index.css), so a caption that names one line of a dense screen
   * is findable without moving or resizing the page. A target of the form
   * `<prefix>@last` resolves to the LAST element whose data-id starts with
   * `<prefix>` — that is how the newest trace line is addressed.
   * `point` moves the pointer to that corner of the focus box (the tip
   * touching the corner from OUTSIDE) instead of the default top-centre pose —
   * top-centre sits on a cell's own header (the I0–I3 label the caption is
   * about), so those beats point from the top-right instead.
   */
  | {
      t: "tooltip";
      key: string;
      ms?: number;
      focus?: string;
      point?: "tl" | "tr" | "bl" | "br";
    }
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
