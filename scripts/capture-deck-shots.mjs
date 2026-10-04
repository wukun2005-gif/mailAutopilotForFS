// Capture ENGLISH, element-level (cropped) HD screenshots for the deck.
// Element crops (not full page) so the type is legible when projected.
//
// The deck lives in deck-html/, so assets go there.
// Only the shots the deck actually uses are captured — anything speculative
// rots and breaks the run. Add a line here when a slide needs a new screen.
//
// NOTE: do not edit project files while this runs. Vite full-reloads the page
// on any change and destroys the Playwright execution context mid-beat.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "deck-html/assets/shots";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5199";

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 1500, height: 950 },
  deviceScaleFactor: 3,
  locale: "en-US",
});
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("i18nextLng", "en");
  } catch {}
});
const page = await ctx.newPage();
page.setDefaultTimeout(15000);

const fails = [];

async function el(name, selector, pad = 0) {
  try {
    const loc = page.locator(`[data-id='${selector}']`).first();
    await loc.waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    if (pad) {
      const b = await loc.boundingBox();
      await page.screenshot({
        path: `${OUT}/${name}.png`,
        clip: {
          x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad),
          width: b.width + pad * 2, height: b.height + pad * 2,
        },
      });
    } else {
      await loc.screenshot({ path: `${OUT}/${name}.png` });
    }
    console.log("  ok  ", name, "<-", selector);
  } catch (e) {
    fails.push(`${name} <- ${selector}: ${e.message.slice(0, 90)}`);
    console.log("  FAIL", name, "<-", selector);
  }
}

async function seek(scriptId, beat) {
  try {
    await page.evaluate(([id, i]) => window.__demoSeek(id, i), [scriptId, beat]);
  } catch (e) {
    throw new Error(`seek(${scriptId},${beat}) lost the page: ${e.message.slice(0, 60)}`);
  }
  await page.waitForTimeout(900);
}
async function openScript(id) {
  const agenda = page.locator("[data-id='demo.agenda']");
  if (await agenda.count()) {
    await agenda.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.click("[data-id='top.demo']");
  await page.click(`[data-id='demo.script.${id}']`);
  await page.waitForSelector("[data-id='demo.bar']");
}

await page.goto(BASE + "/");
await page.waitForSelector("[data-nav='customer']");

// ── Slide 12: the autonomy matrix in Agent Builder ─────────────
console.log("builder");
await page.click("[data-nav='builder']");
await page.waitForTimeout(900);
await el("shot-matrix", "s4.matrix", 14);

// ── Slide 13: the assembled reply + the policy pack that decided
//    email1 beat 19 = the refund letter on the customer's own screen
//    email1 beat 33 = the agent screen, policy row OD-1 failed
console.log("email1");
await openScript("email1");
await seek("email1", 19);
await el("shot-letter", "s1.thread.out", 18);
await seek("email1", 33);
await el("shot-policy", "s2.policy", 0);

await browser.close();
console.log(fails.length ? `\nFAILED (${fails.length}):\n  ` + fails.join("\n  ") : "\nall captures ok");
