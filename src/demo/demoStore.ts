// Reactive state for the one-click demo (Dev Plan §9.3): playback status,
// beat/chapter progress, fake-cursor pose, tooltip, failures.
import { create } from "zustand";

export type DemoStatus = "idle" | "playing" | "paused" | "done";

export interface DemoFailure {
  beatId: string;
  target?: string;
  reason: string;
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
  failures: [] as DemoFailure[],
  blocker: null as string | null,
};

export const useDemoStore = create<DemoState>((set) => ({
  ...INITIAL,
  set: (p) => set(p),
  reset: () => set({ ...INITIAL }),
}));
