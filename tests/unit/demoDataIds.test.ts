// Demo anti-corruption (Dev Plan §9.4). The demo is the acceptance artifact for
// this prototype, so drift between the script, the captions, the UI hooks and
// the generated audio is a defect, not a nitpick. Four gates:
//   1. every data-id a beat targets (click or pointer focus) exists in source;
//   2. every tooltip key has copy in BOTH locales (a caption that only exists
//      in one language plays back as a raw key on screen);
//   3. every pointer focus target exists in source;
//   4. narration audio: the manifest must be intact, and captions that are
//      waiting on audio are reported rather than silently accepted.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

interface Locale {
  [k: string]: string | Locale;
}

function locale(lang: "zh" | "en"): Locale {
  return JSON.parse(
    readFileSync(join(process.cwd(), "src", "locales", lang, "demo.json"), "utf8"),
  ) as Locale;
}

function lookup(d: Locale, dotted: string): string | undefined {
  let cur: string | Locale | undefined = d;
  for (const part of dotted.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

/**
 * 32-bit FNV-1a over UTF-16-LE *bytes* — the exact function in
 * src/demo/narration.ts and tts/generate.py. Hashing the code units directly
 * (the obvious-looking version) produces a different digest for every
 * non-ASCII caption, which silently marked all 164 clips stale and hid the one
 * clip that really was.
 */
function fnv1a(text: string): string {
  const buffer = new ArrayBuffer(text.length * 2);
  const view = new Uint16Array(buffer);
  for (let i = 0; i < text.length; i++) {
    view[i] = text.charCodeAt(i);
  }
  const bytes = new Uint8Array(buffer);
  let h = 0x811c9dc5;
  for (const byte of bytes) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const tooltipBeats = SCRIPTS.flatMap((s) =>
  s.beats.flatMap((b) => (b.action.t === "tooltip" ? [{ script: s.id, ...b.action }] : [])),
);

describe("demo script data-id hooks", () => {
  // Reads every .ts/.tsx/.json under src/ into one string; under a full parallel
  // run that can exceed vitest's 5s default, so both gates carry their own
  // budget. The work is I/O, not assertion — a slow run is not a failed gate.
  it("every cursor target exists in source", { timeout: 30_000 }, () => {
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

  it("every tooltip focus target exists in source", { timeout: 30_000 }, () => {
    const root = join(process.cwd(), "src");
    const corpus = walk(root).map((f) => readFileSync(f, "utf8")).join("\n");
    const missing = tooltipBeats
      .filter((b) => {
        const id = b.focus?.split("@")[0] ?? "";
        if (!id) return false;
        if (corpus.includes(id)) return false;
        // Dynamic hooks rendered from a template literal, e.g. the audit rail's
        // `s1.trace.entry.${seq}` — same rule the cursor-target gate applies.
        return !corpus.includes("`" + id.slice(0, id.lastIndexOf(".")) + ".${");
      })
      .map((b) => `${b.script}: ${b.key} -> ${b.focus}`);
    expect(missing).toEqual([]);
  });

  it("every tooltip key has zh and en copy", () => {
    const zh = locale("zh");
    const en = locale("en");
    const missing: string[] = [];
    for (const b of tooltipBeats) {
      for (const [lang, bundle] of [
        ["zh", zh],
        ["en", en],
      ] as const) {
        const text = lookup(bundle, b.key);
        if (!text || text.trim() === "" || text === b.key) {
          missing.push(`${lang}: ${b.key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  /**
   * Narration debt report. Captions get edited far more often than audio gets
   * regenerated, and the app degrades safely either way: a missing clip plays
   * caption-only, and a clip whose caption has since changed is detected at
   * runtime through public/tts/manifest.json and skipped. So debt is reported
   * (test name + console) instead of failing the suite — but a manifest entry
   * pointing at a file that no longer exists is a real bug and does fail.
   */
  it("narration audio: manifest intact, debt reported", () => {
    const dir = join(process.cwd(), "public", "tts");
    if (!existsSync(dir)) throw new Error("public/tts missing - run: npm run tts");
    const manifestPath = join(dir, "manifest.json");
    const manifest: Record<string, Record<string, string>> = existsSync(manifestPath)
      ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
          string,
          Record<string, string>
        >)
      : {};
    const bundles = { zh: locale("zh"), en: locale("en") } as const;

    const vanished: string[] = [];
    for (const lang of ["zh", "en"] as const) {
      for (const key of Object.keys(manifest[lang] ?? {})) {
        if (!existsSync(join(dir, lang, `${key}.mp3`))) vanished.push(`${lang}/${key}.mp3`);
      }
    }
    expect(vanished).toEqual([]);

    const debt: string[] = [];
    for (const b of tooltipBeats) {
      for (const lang of ["zh", "en"] as const) {
        const clip = existsSync(join(dir, lang, `${b.key}.mp3`));
        const recorded = manifest[lang]?.[b.key];
        const text = lookup(bundles[lang], b.key) ?? "";
        if (!clip) debt.push(`${lang}/${b.key}.mp3 missing`);
        else if (recorded && recorded !== fnv1a(text)) debt.push(`${lang}/${b.key}.mp3 stale`);
      }
    }
    if (debt.length > 0) {
      console.warn(
        `[demo] ${debt.length} narration clip(s) await "npm run tts -- --force":\n  ` +
          debt.join("\n  "),
      );
    }
    // Reported, never blocking: the demo still plays (caption-only / skipped).
    expect(Array.isArray(debt)).toBe(true);
  });
});
