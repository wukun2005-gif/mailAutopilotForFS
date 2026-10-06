// Metrics fixture ↔ PRD §04 conformance. Screen 3 shows every success metric
// as a NUMBER (case doc: the supervisor owns "KPIs, and performance"), and the
// numbers are fixtures whose gates come straight out of the PRD. Two gates:
//   1. every main metric and guardrail row carries at least one digit in both
//      locales — a metric that renders as prose is the drift this exists to
//      catch;
//   2. every gate the UI claims ("观测区间 10–20%", "P99 ≤ 15 分钟"…) still
//      exists in PRD §04, so a threshold edit cannot silently orphan the app.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Json = { [k: string]: string | Json };

function metrics(lang: "zh" | "en") {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "src", "locales", lang, "supervisor.json"), "utf8"),
  ) as Json;
  return raw["metrics"] as Json;
}

const MAIN = ["varr", "ttr", "trust"] as const;
// PRD §4.2, plus the four v0.3 rows the design-time layer added (FR-12.1
// canary, FR-12.2 remediation, FR-12.4 preventable, FR-12.7 cohort parity).
const GUARD = [
  "regret",
  "bidirectional",
  "escalation",
  "customer",
  "clockHealth",
  "drift",
  "regDetection",
  "pleaseCall",
  "cohortParity",
  "preventable",
  "canary",
  "remediationError",
] as const;

function str(node: Json, path: string[]): string {
  let cur: string | Json = node;
  for (const p of path) {
    if (typeof cur !== "object" || cur === null) throw new Error(`missing ${path.join(".")}`);
    cur = (cur as Json)[p] as string | Json;
  }
  if (typeof cur !== "string") throw new Error(`${path.join(".")} is not a string`);
  return cur;
}

describe("screen 3 metrics fixtures", () => {
  it.each(["zh", "en"] as const)("%s: every headline metric shows a number", (lang) => {
    const m = metrics(lang);
    for (const id of MAIN) {
      // value = the number on the tile, detail = the numbers behind it;
      // tile/target are labels and may be prose.
      expect(str(m, ["main", id, "value"]), `main.${id}.value`).toMatch(/\d/);
      expect(str(m, ["main", id, "detail"]), `main.${id}.detail`).toMatch(/\d/);
      expect(str(m, ["main", id, "tile"]), `main.${id}.tile`).not.toBe("");
      expect(str(m, ["main", id, "target"]), `main.${id}.target`).not.toBe("");
    }
  });

  it.each(["zh", "en"] as const)("%s: every guardrail row shows a number", (lang) => {
    const m = metrics(lang);
    const rows = (m["guard"] as Json)["rows"] as Json;
    for (const id of GUARD) {
      expect(str(rows, [id, "value"]), `guard.rows.${id}.value`).toMatch(/\d/);
      expect(str(rows, [id, "threshold"]), `guard.rows.${id}.threshold`).not.toBe("");
    }
  });

  it("the gates quoted in the UI still exist in PRD §04", () => {
    const html = readFileSync(
      join(process.cwd(), "email-autopilot-fs-prd.html"),
      "utf8",
    );
    const start = html.indexOf('<section id="metrics">');
    const end = html.indexOf("</section>", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const section = html.slice(start, end);
    // Thresholds the supervisor panel cites as its target/threshold column.
    for (const gate of ["10–20%", "15 分钟", "99.5%", "2 个百分点", "10%", "22%", "PSI"]) {
      expect(section, `PRD §04 lost gate "${gate}"`).toContain(gate);
    }
  });
});
