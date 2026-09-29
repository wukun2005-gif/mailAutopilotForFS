// MSW worker singleton (Dev Plan §3.4). Handlers grow in M1; the service
// worker file is generated once via `npx msw init public/ --save`.
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
