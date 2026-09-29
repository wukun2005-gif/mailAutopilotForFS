// Dev-only admin endpoints: reset all mock state (used by the demo director
// "reset to Day 0" button), and a snapshot for debugging / e2e assertions.
import { http } from "msw";
import { resetMockState, mockStore } from "@/mocks/mockState.ts";
import { faultController } from "@/tools/faultController.ts";
import { simClock } from "@runtime/simClock";
import { envelope, jsonOk, mockLatency } from "./util.ts";

export const adminHandlers = [
  http.post("*/mock/admin/reset", async () => {
    await mockLatency(20);
    resetMockState();
    faultController.reset();
    simClock.reset();
    return jsonOk(envelope({ reset: true }));
  }),

  http.get("*/mock/admin/snapshot", async () => {
    await mockLatency(10);
    return jsonOk(
      envelope({
        clock: simClock.snapshot(),
        faults: faultController.get(),
        actionCount: mockStore.actions.size,
        disputeCount: mockStore.disputes.size,
        messageCount: mockStore.messages.length,
        inboundCount: mockStore.inbound.length,
        otp: mockStore.getOtp(),
      }),
    );
  }),
];
