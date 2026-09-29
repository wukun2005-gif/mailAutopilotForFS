// Subscribes to the singleton faultController for UI (it is intentionally
// outside reactive state — the demo Director flips it imperatively).
import { useEffect, useState } from "react";
import { faultController, type FaultState } from "@/tools/faultController";

export function useFaultFlags(): FaultState {
  const [state, setState] = useState<FaultState>(() => faultController.get());
  useEffect(() => faultController.subscribe(setState), []);
  return state;
}
