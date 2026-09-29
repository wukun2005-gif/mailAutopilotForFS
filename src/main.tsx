import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import "@/index.css";
import App from "@/App";

// MSW intercepts mock endpoints in dev only. Disable explicitly with
// VITE_ENABLE_MSW=0. The Dev BFF (/api/*) is always reachable (passthrough).
async function enableMocking(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_ENABLE_MSW === "0") return;
  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

void enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
