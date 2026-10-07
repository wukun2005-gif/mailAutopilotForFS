// Shots for the review pass: every page that changed, plus the two new ones.
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "_shots/deck-review";
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();

await p.goto("file:///Users/wukun/Documents/tmp/mailAutopilotForFS/deck-html/index.html", {
  waitUntil: "load",
});
await p.waitForTimeout(1500);

// Match on .toclabel only: a rail item also contains a full clone of the slide
// in its thumbnail, so textContent matching lands on whatever page happens to
// mention the phrase first (that is how "Scope" used to open the title page).
async function railClick(label) {
  await p.evaluate(
    (s) => {
      const it = [...document.querySelectorAll("#toclist .tocitem")].find((x) =>
        (x.querySelector(".toclabel")?.textContent || "").includes(s),
      );
      if (!it) throw new Error("no rail item labelled: " + s);
      it.scrollIntoView({ block: "center" });
    },
    label,
  );
  await p.waitForTimeout(300);
  const pt = await p.evaluate(
    (s) => {
      const it = [...document.querySelectorAll("#toclist .tocitem")].find((x) =>
        (x.querySelector(".toclabel")?.textContent || "").includes(s),
      );
      const r = it.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    },
    label,
  );
  await p.mouse.click(pt.x, pt.y);
  await p.waitForTimeout(900);
}

const pages = [
  // the two figures that used to render squeezed (0.79 / 0.87) — kept here so a
  // regression in .chart sizing shows up as a visibly wrong page
  ["scope", "We automate the work"],
  ["how-it-works", "The thread is the case"],
  ["autonomy", "Autonomy is earned"],
  ["design-time", "AI nominates"],
  ["key-experiences", "Four screens"],
  ["why-we-win", "Four groups want this customer"],
  ["metrics", "Three numbers"],
  ["risk", "The risks that would end"],
  ["roadmap", "One governance layer"],
  ["b5-guardrails", "Twelve guardrails"],
  ["b8-never", "What ships, what waits"],
  ["b10-register", "Seventeen risks"],
  ["b15-admin", "Admin: the bank writes"],
  ["b18-rules", "The AI proposes"],
  ["b19-ask", "Two partners"],
];

// Per-page overflow, vertical *and* horizontal. Two earlier blind spots:
//  · it only measured .chart / .note, so a figure shoved sideways (the letter
//    shot on "The thread is the case") came back clean;
//  · it ran once at the end of the run, i.e. on the last page only — inactive
//    slides are display:none and measure 0, so every other page went unchecked.
const pageSpill = () =>
  p.evaluate(() => {
    const s = document.querySelector("#stage > .slide.on");
    if (!s) return [];
    const r = s.getBoundingClientRect();
    const bad = [];
    let down = 0;
    s.querySelectorAll(".chart, .chart *, .fig, .fig *, .note, table").forEach((el) => {
      if (!el.getClientRects().length) return;
      const er = el.getBoundingClientRect();
      if (!er.width && !er.height) return;
      down = Math.max(down, er.bottom - r.bottom);
      const side = Math.max(r.left - er.left, er.right - r.right);
      if (side > 1) {
        const cls = (el.getAttribute("class") || el.tagName.toLowerCase()).slice(0, 36);
        bad.push(`${cls} ${Math.round(side)}px`);
      }
    });
    if (down > 1) bad.unshift(`bottom ${Math.round(down)}px`);
    return [...new Set(bad)].slice(0, 5);
  });

const over = [];
for (const [name, label] of pages) {
  await railClick(label);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  const spill = await pageSpill();
  if (spill.length) over.push({ page: name, spill });
  console.log("shot", name, spill.length ? `OVERFLOW ${JSON.stringify(spill)}` : "ok");
}

console.log("overflow:", over.length ? JSON.stringify(over, null, 1) : "[]");
await b.close();
