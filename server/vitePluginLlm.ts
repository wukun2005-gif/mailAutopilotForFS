// Dev BFF as an in-process Vite plugin (Dev Plan §3.3, §11.1).
// Booted by the same `npm run dev` command — no second process.
// Route logic lives in bffHandlers.ts; this file is only Vite wiring.
import type { Plugin, ViteDevServer } from "vite";
import { dispatchBff, sendJson } from "./bffHandlers.ts";

export function llmBffPlugin(): Plugin {
  return {
    name: "eap-llm-bff",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        if (!url.startsWith("/api/")) return next();
        try {
          const handled = await dispatchBff(req, res, url);
          if (!handled) sendJson(res, 404, { error: `unknown route: ${url}` });
        } catch (e) {
          server.config.logger.error(
            `[eap-bff] ${req.method} ${url} failed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`,
          );
          if (!res.headersSent) {
            sendJson(res, 500, {
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      });

      server.httpServer?.once("listening", () => {
        server.config.logger.info(
          "\x1b[36m[eap-bff]\x1b[0m Dev BFF ready: /api/settings · /api/models · /api/verify · /api/llm/chat",
        );
      });
    },
  };
}
