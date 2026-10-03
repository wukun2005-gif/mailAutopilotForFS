// Functional check of the browser deck: thumbnail rail, navigation, lightbox.
const DECK_BASE = process.env.DECK_BASE || "file:///Users/wukun/Documents/tmp/mailAutopilotForFS";
const DECK_URL = process.env.DECK_URL || `${DECK_BASE}/deck/_html-source/index.html`;
import { chromium } from "@playwright/test";

const b = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

await p.goto(DECK_URL, { waitUntil: "load" });
await p.waitForTimeout(2000);

const info = await p.evaluate(() => ({
  slides: document.querySelectorAll("#stage > .slide").length,
  tocItems: document.querySelectorAll("#toclist .tocitem").length,
  tocThumbs: document.querySelectorAll("#toclist .tocthumb .slide").length,
  tocLabels: [...document.querySelectorAll("#toclist .toclabel")].slice(10, 14).map((e) => e.textContent),
  videos: document.querySelectorAll("#stage video").length,
  fsbtns: document.querySelectorAll("#stage .fsbtn").length,
  pos: document.getElementById("pos")?.textContent,
}));
console.log("structure:", JSON.stringify(info, null, 2));

// jump via the rail to page 12, then open a demo full size
// jump via the rail to the demos page, then open a demo full size
// (find it by label — hardcoded page numbers break whenever a page is inserted)
await p.click('#toclist .tocitem:has-text("Three emails")');
await p.waitForTimeout(400);
await p.screenshot({ path: "/Users/wukun/Documents/tmp/mailAutopilotForFS/deck/build/html-rail.png" });
const on12 = await p.evaluate(() => ({
  pos: document.getElementById("pos").textContent,
  // must scope to #stage: the rail holds an .on clone of every slide
  head: document.querySelector("#stage > .slide.on h2")?.textContent,
  videosInStage: document.querySelectorAll("#stage video").length,
}));
console.log("after rail click ->", JSON.stringify(on12));

await p.click("#stage .slide.on .scr:nth-child(2) .fsbtn");
await p.waitForTimeout(600);
console.log("lightbox open  ->", JSON.stringify(await p.evaluate(() => ({
  inLightbox: document.querySelectorAll("#lightbox video").length,
  inStage: document.querySelectorAll("#stage video").length,
  on: document.getElementById("lightbox").classList.contains("on"),
}))));
await p.screenshot({ path: "/Users/wukun/Documents/tmp/mailAutopilotForFS/deck/build/html-lightbox.png" });

await p.keyboard.press("Escape");
await p.waitForTimeout(400);
console.log("lightbox close ->", JSON.stringify(await p.evaluate(() => ({
  inLightbox: document.querySelectorAll("#lightbox video").length,
  inStage: document.querySelectorAll("#stage video").length,
  on: document.getElementById("lightbox").classList.contains("on"),
}))));

// the rail must be reopenable after it is hidden
await p.click("#toctoggle");
await p.waitForTimeout(250);
console.log("rail hidden ->", JSON.stringify(await p.evaluate(() => ({
  notoc: document.body.classList.contains("notoc"),
  toc: getComputedStyle(document.getElementById("toc")).display,
  reopenTab: getComputedStyle(document.getElementById("tocshow")).display,
}))));
await p.click("#tocshow");
await p.waitForTimeout(250);
console.log("rail shown  ->", JSON.stringify(await p.evaluate(() => ({
  notoc: document.body.classList.contains("notoc"),
  toc: getComputedStyle(document.getElementById("toc")).display,
  reopenTab: getComputedStyle(document.getElementById("tocshow")).display,
}))));
await p.keyboard.press("t");
await p.waitForTimeout(200);
console.log("T hides     ->", JSON.stringify(await p.evaluate(() => ({ notoc: document.body.classList.contains("notoc") }))));
await p.keyboard.press("t");
await p.waitForTimeout(200);
console.log("T shows     ->", JSON.stringify(await p.evaluate(() => ({ notoc: document.body.classList.contains("notoc") }))));

console.log("js errors:", errs.length ? errs : "none");

// page: the admin walkthrough (found by label, not by index)
await p.click('#toclist .tocitem:has-text("Admin: the bank writes")');
await p.waitForTimeout(2000);
await p.screenshot({ path: "/Users/wukun/Documents/tmp/mailAutopilotForFS/deck/build/html-admin.png" });
await b.close();
