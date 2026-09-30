// Reactive state for the one-click demo (Dev Plan §9.3): playback status,
// beat/chapter progress, fake-cursor pose, tooltip, failures.
import { create } from "zustand";

export type DemoStatus = "idle" | "playing" | "paused" | "done";

export interface DemoFailure {
  beatId: string;
  target?: string;
  reason: string;
}

/**
 * Text highlight for a caption beat. The demo screens are dense, so when a
 * caption names a specific detail ("the policy condition that failed", "one
 * more line on the audit rail") that detail is marked IN PLACE — a ring and a
 * tint on the element itself (see `[data-hl]` in index.css). No camera, no
 * scaling, no dimming: the picture never leaves the screen the audience was
 * just looking at, and adding a new highlighted detail costs one data-id.
 */
export interface Highlight {
  /** The focus id this highlight was resolved for (see runner.resolveId). */
  id: string;
  /** Target rect in viewport pixels, so the caption can step out of its way. */
  rect: { x: number; y: number; w: number; h: number };
}

interface DemoState {
  status: DemoStatus;
  scriptId: string | null;
  beatIndex: number;
  totalBeats: number;
  chapter: string;
  tooltip: string;
  cursor: { x: number; y: number };
  visible: boolean;
  clicking: boolean;
  speed: number;
  highlight: Highlight | null;
  failures: DemoFailure[];
  blocker: string | null;
  set: (p: Partial<DemoState>) => void;
  reset: () => void;
}

const INITIAL = {
  status: "idle" as DemoStatus,
  scriptId: null as string | null,
  beatIndex: 0,
  totalBeats: 0,
  chapter: "",
  tooltip: "",
  cursor: { x: -100, y: -100 },
  visible: false,
  clicking: false,
  speed: 1,
  highlight: null as Highlight | null,
  failures: [] as DemoFailure[],
  blocker: null as string | null,
};

export const useDemoStore = create<DemoState>((set) => ({
  ...INITIAL,
  set: (p) => set(p),
  reset: () => set({ ...INITIAL }),
}));
