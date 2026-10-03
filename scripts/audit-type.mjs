// Audit every text node in the deck: what point size does it actually end up at
// when the 1280x720 design is projected as a 13.333 x 7.5 in slide?
//   1280 design px == 13.333 in == 960 pt   ->   1 design px = 0.75 pt
import { chromium } from "@playwright/test";

const MIN_OK = 12; // pt - below this is unreadable on a projector

const b = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await b.newContext({ viewport: { width: 1280, height: 764 }, deviceScaleFactor: 1, locale: "en-US" });
const p = await ctx.newPage();
await p.goto("http://localhost:5199/deck/_html-source/index.html", { waitUntil: "load" });
await p.waitForTimeout(1000);

const data = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll(".slide").forEach((s, idx) => {
    s.classList.add("on");
    const sb = s.getBoundingClientRect();
    const k = 1280 / sb.width;
    const head = s.querySelector("h1,h2");
    const items = [];
    const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = n.textContent.replace(/\s+/g, " ").trim();
      if (!t) continue;
      const el = n.parentElement;
      if (!el) continue;
      const cs = getComputedStyle(el);
      const fsPx = parseFloat(cs.fontSize) * k;
      items.push({
        pt: +(fsPx * 0.75).toFixed(1),
        px: +fsPx.toFixed(1),
        text: t.slice(0, 30),
        sel: el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : el.tagName.toLowerCase(),
      });
    }
    s.classList.remove("on");
    out.push({ i: idx + 1, head: head ? head.textContent.trim().slice(0, 40) : "", items });
  });
  return out;
});

let worst = [];
console.log("slide  min-pt  #<12pt  head");
for (const s of data) {
  const pts = s.items.map((x) => x.pt);
  const min = Math.min(...pts);
  const bad = s.items.filter((x) => x.pt < MIN_OK);
  console.log(
    String(s.i).padStart(4),
    String(min.toFixed(1)).padStart(7),
    String(bad.length).padStart(7),
    " ",
    s.head
  );
  worst.push(...bad.map((x) => ({ slide: s.i, ...x })));
}

console.log("\n=== everything under " + MIN_OK + "pt (" + worst.length + " runs) ===");
const bySize = {};
for (const w of worst) {
  const key = w.pt + "pt  " + w.sel;
  bySize[key] = bySize[key] || { n: 0, sample: w.text, slides: new Set() };
  bySize[key].n++;
  bySize[key].slides.add(w.slide);
}
Object.entries(bySize)
  .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
  .forEach(([k, v]) => console.log(k.padEnd(26), String(v.n).padStart(3), "x  slides:", [...v.slides].join(","), " e.g. \"" + v.sample + "\""));

await b.close();
