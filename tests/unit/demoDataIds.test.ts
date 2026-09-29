// Demo anti-corruption (Dev Plan §9.4): every data-id targeted by a script
// beat must exist as a static hook in the source tree.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SCRIPTS } from "@/demo/scripts.ts";

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name === "dist") continue;
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(tsx?|json)$/.test(name)) acc.push(p);
  }
  return acc;
}

describe("demo script data-id hooks", () => {
  it("every cursor target exists in source", () => {
    const root = join(process.cwd(), "src");
    const corpus = walk(root).map((f) => readFileSync(f, "utf8")).join("\n");
    const missing: string[] = [];
    for (const script of SCRIPTS) {
      for (const beat of script.beats) {
        const a = beat.action;
        if (a.t !== "cursor") continue;
        const exact = corpus.includes(a.target);
        // Dynamic hooks rendered from template literals, e.g.
        // data-id={`s3.tab.${id}`} / `s4.intent.${g.intentCode}`.
        const prefix = a.target.slice(0, a.target.lastIndexOf("."));
        const dynamic = corpus.includes("`" + prefix + ".${");
        if (!exact && !dynamic) {
          missing.push(`${script.id}/${beat.id}: ${a.target}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("scripts are non-empty and chapters labeled", () => {
    for (const s of SCRIPTS) {
      expect(s.beats.length).toBeGreaterThan(3);
      for (const b of s.beats) expect(b.chapter.length).toBeGreaterThan(0);
    }
  });
});
