// Handler groups #8 (DLP / red-line scan) and #9 (fraud signals).
import { http } from "msw";
import { FRAUD_SIGNALS, type ScenarioId } from "@/mocks/fixtures/index.ts";
import { faultController } from "@/tools/faultController.ts";
import { envelope, jsonError, jsonOk, mockLatency } from "./util.ts";
import { scanDlp } from "./dlp.ts";

export const safetyHandlers = [
  http.post("*/mock/dlp/scan", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await mockLatency(90);
    const text = String(body.text ?? "");
    const scan = scanDlp(text);
    return jsonOk(
      envelope(
        { ...scan },
        { blocked: !scan.clean && body.enforce === true },
      ),
    );
  }),

  http.get("*/mock/fraud/signals", async ({ request }) => {
    await mockLatency(150);
    const scenarioId = new URL(request.url).searchParams.get("scenarioId") as
      | ScenarioId
      | null;
    if (!scenarioId || !FRAUD_SIGNALS[scenarioId])
      return jsonError(404, "SCENARIO_NOT_FOUND", String(scenarioId));
    const base = FRAUD_SIGNALS[scenarioId];
    // Fault panel can inject the FR-2.1 AC3 lookalike signal into any thread.
    const spoof = faultController.isOn("spoofSignal");
    return jsonOk(
      envelope({
        ...base,
        localPartLookalike: base.localPartLookalike || spoof,
        displayNameSpoof: base.displayNameSpoof || spoof,
        atoScore: spoof ? Math.max(base.atoScore, 88) : base.atoScore,
        injectedByFaultPanel: spoof && !base.localPartLookalike,
      }),
    );
  }),
];
