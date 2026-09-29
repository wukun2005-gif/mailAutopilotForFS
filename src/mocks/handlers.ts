// MSW handler registry — 11 mock endpoint groups (M1) plus dev-admin and the
// /api passthrough so the local Dev BFF (provider settings / chat proxy) is
// never shadowed by MSW.
import { http, passthrough } from "msw";
import { bankingHandlers } from "./handlers/banking.ts";
import { disputesHandlers } from "./handlers/disputes.ts";
import { policyHandlers } from "./handlers/policy.ts";
import { identityHandlers } from "./handlers/identity.ts";
import { notifyHandlers } from "./handlers/notify.ts";
import { clocksHandlers } from "./handlers/clocks.ts";
import { safetyHandlers } from "./handlers/safety.ts";
import { docsHandlers } from "./handlers/docs.ts";
import { emailHandlers } from "./handlers/email.ts";
import { adminHandlers } from "./handlers/admin.ts";

export const handlers = [
  // 1 banking · 2 disputes · 3 policy · 4 OTP/step-up · 5 secure messages
  // 6 notify · 7 clocks · 8 DLP · 9 fraud · 10 OCR · 11 email
  ...bankingHandlers,
  ...disputesHandlers,
  ...policyHandlers,
  ...identityHandlers,
  ...notifyHandlers,
  ...clocksHandlers,
  ...safetyHandlers,
  ...docsHandlers,
  ...emailHandlers,
  ...adminHandlers,

  // Never let MSW shadow the local Dev BFF.
  http.all("*/api/:path*", () => passthrough()),
];
