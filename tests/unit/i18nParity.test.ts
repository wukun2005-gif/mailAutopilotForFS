// i18n parity — Dev Plan §10: en/zh resource bundles must expose the same key
// set for every namespace, with no empty values. Catches a half-translated
// namespace before it reaches the demo.
import { describe, it, expect } from "vitest";
import { NAMESPACES } from "@/i18n/index.ts";

const enMod = import.meta.glob("@/locales/en/*.json", { eager: true });
const zhMod = import.meta.glob("@/locales/zh/*.json", { eager: true });

function flatten(obj: unknown, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        Object.assign(out, flatten(v, key));
      } else {
        out[key] = v;
      }
    }
  } else {
    out[prefix] = obj;
  }
  return out;
}

function bundle(modules: Record<string, unknown>, ns: string): Record<string, unknown> {
  const path = Object.keys(modules).find((p) => p.endsWith(`/${ns}.json`));
  if (!path) throw new Error(`missing locale bundle for namespace ${ns}`);
  return flatten((modules[path] as { default: unknown }).default);
}

describe.each([...NAMESPACES])("locale parity: %s", (ns) => {
  const en = bundle(enMod, ns);
  const zh = bundle(zhMod, ns);

  it("zh has every key present in en", () => {
    const missing = Object.keys(en).filter((k) => !(k in zh));
    expect(missing).toEqual([]);
  });

  it("en has every key present in zh", () => {
    const extra = Object.keys(zh).filter((k) => !(k in en));
    expect(extra).toEqual([]);
  });

  it("has no empty or whitespace-only values", () => {
    const emptyEn = Object.entries(en)
      .filter(([, v]) => typeof v === "string" && v.trim() === "")
      .map(([k]) => k);
    const emptyZh = Object.entries(zh)
      .filter(([, v]) => typeof v === "string" && v.trim() === "")
      .map(([k]) => k);
    expect(emptyEn).toEqual([]);
    expect(emptyZh).toEqual([]);
  });

  it("interpolation variables match between en and zh", () => {
    const vars = (s: unknown): string[] =>
      typeof s === "string" ? [...s.matchAll(/{{\s*(\w+)/g)].map((m) => m[1]).sort() : [];
    const mismatches = Object.keys(en)
      .filter((k) => vars(en[k]).join(",") !== vars(zh[k]).join(","))
      .map((k) => `${k}: en=[${vars(en[k])}] zh=[${vars(zh[k])}]`);
    expect(mismatches).toEqual([]);
  });
});
