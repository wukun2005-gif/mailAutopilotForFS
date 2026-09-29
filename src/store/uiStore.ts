// Global UI state — screen routing lives in the hash (#/customer …), this
// store mirrors it and holds cross-screen view flags. Runtime/case state gets
// its own stores in M2 (graph) / M3 (cases).
import { create } from "zustand";

export type ScreenId =
  | "customer"
  | "agent"
  | "supervisor"
  | "builder"
  | "settings";

export const SCREENS: ScreenId[] = [
  "customer",
  "agent",
  "supervisor",
  "builder",
  "settings",
];

const VALID = new Set<string>(SCREENS);

export function screenFromHash(hash: string): ScreenId {
  const raw = hash.replace(/^#\/?/, "").split("?")[0] || "customer";
  return VALID.has(raw) ? (raw as ScreenId) : "customer";
}

interface UIState {
  screen: ScreenId;
  /** Screen 1: customer inbox view vs internal audit/inspect view. */
  auditView: boolean;
  /** M7 one-click demo playback active. */
  demoActive: boolean;
  setScreen: (s: ScreenId) => void;
  setAuditView: (v: boolean) => void;
  setDemoActive: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  screen: typeof window !== "undefined" ? screenFromHash(window.location.hash) : "customer",
  auditView: false,
  demoActive: false,
  setScreen: (screen) => {
    if (typeof window !== "undefined") window.location.hash = `/${screen}`;
    set({ screen });
  },
  setAuditView: (auditView) => set({ auditView }),
  setDemoActive: (demoActive) => set({ demoActive }),
}));

/** Keep store in sync with browser back/forward (called once in App). */
export function bindHashSync(): () => void {
  const onHash = () => useUIStore.setState({ screen: screenFromHash(window.location.hash) });
  window.addEventListener("hashchange", onHash);
  return () => window.removeEventListener("hashchange", onHash);
}
