/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";
import { llmBffPlugin } from "./server/vitePluginLlm.ts";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

// The repo root is both the app root and a document workspace. The deck, the
// PRD, the QA scripts and the JSON they emit all sit next to src/. Vite watches
// the root, so every one of those writes used to reach the running browser —
// usually as a Tailwind CSS update (see the @source rules in src/index.css),
// and as a full page reload for anything outside the module graph, which wipes
// demo run state. Watch the app and nothing else.
const WATCHED_DIRS = new Set(["src", "server", "shared", "public", "tests"]);
const WATCHED_ROOT_FILES = new Set([
  "index.html",
  "vite.config.ts",
  "package.json",
  "tsconfig.json",
  "tsconfig.node.json",
]);

function isWatched(absPath: string): boolean {
  const rel = path.relative(projectRoot, absPath);
  if (rel === "") return true; // chokidar needs the root itself to descend
  if (rel.startsWith("..")) return false; // outside the project
  const segments = rel.split(path.sep);
  if (segments.length > 1) return WATCHED_DIRS.has(segments[0]);
  return WATCHED_ROOT_FILES.has(rel) || path.basename(rel).startsWith(".env");
}

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
      ignored: (p: string) => !isWatched(p),
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
