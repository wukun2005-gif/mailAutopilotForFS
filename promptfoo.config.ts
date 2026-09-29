// promptfoo entry — `npm run eval` (Dev Plan §12).
// Deterministic sets run the app's own pure runtime modules and must pass
// 100% offline with no provider configured. The grounding set self-skips
// (SKIP_GROUNDING_* tokens) when no live LLM provider is configured.
import { eapRuntimeProvider } from "./evals/harness.ts";
import { allCases } from "./evals/cases.ts";

export default {
  description:
    "Email Autopilot for FS — deterministic safety/gate evals (injection, regulated recall, policy two-beat, overreach, BEC) + non-blocking grounding set",
  providers: [eapRuntimeProvider],
  // The custom provider reads vars directly; the prompt itself is a no-op.
  prompts: ["eval"],
  tests: allCases,
  outputPath: "./eval-results/latest.json",
};
