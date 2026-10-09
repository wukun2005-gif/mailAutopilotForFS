import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import "@/index.css";
import App from "@/App";

// MSW serves the whole mock backend from the browser, so the prototype runs as
// a pure static site — that is what lets it be hosted (Vercel/GH Pages) with no
// server. It must therefore start in production too, not just in dev.
// Opt out with VITE_ENABLE_MSW=0. The Dev BFF (/api/*) is never shadowed:
// unhandled requests bypass to the network (see handlers.ts).
async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MSW === "0") return;
  const { worker } = await import("@/mocks/browser");
  await worker.start({
    onUnhandledRequest: "bypass",
    // Resolve relative to BASE_URL so it also works when hosted under a
    // sub-path (e.g. GitHub Pages project sites), not just at the domain root.
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}

void enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
