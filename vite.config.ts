/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { llmBffPlugin } from "./server/vitePluginLlm.ts";

// One command boots everything: `npm run dev` starts Vite AND the in-process
// Dev BFF (LLM provider settings + key-injected chat proxy). See Dev Plan §11.
export default defineConfig({
  plugins: [react(), tailwindcss(), llmBffPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@runtime": fileURLToPath(new URL("./src/runtime", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    watch: {
      // The PRD / research-report HTML files live in the project root but are
      // not part of the app. Vite treats any root .html as a page entry and
      // full-reloads the browser on change, wiping demo run state. Watch only
      // index.html (the real entry); everything else .html is documentation.
      ignored: [
        "**/_backup/**",
        "**/_shots/**",
        (p: string) => /[\\/]index\.html$/.test(p) === false && p.endsWith(".html"),
      ],
    },
  },
  preview: { port: 4173 },
  test: {
    // Runtime/domain tests are pure node; DOM tests opt in per file with
    // `// @vitest-environment jsdom`.
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    globals: false,
  },
});
