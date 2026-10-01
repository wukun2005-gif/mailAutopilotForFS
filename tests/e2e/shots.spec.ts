// Debug-only screenshot harness — NOT part of the suite (skips without SHOTS,
// so `npx playwright test` still runs exactly 14 tests).
//
//   SHOTS="email1:5,12,13" npx playwright test tests/e2e/shots.spec.ts   (few frames)
//   SWEEP=email1              npx playwright test tests/e2e/shots.spec.ts (most frames)
//
// SHOTS reaches each listed beat with __demoSeek (fast-forward through the
// beats before it, run that beat, pause with its caption up): ~17s a frame and
// only the frames asked for, instead of a full 1× replay per round.
//
// SWEEP plays the whole script once at 1× and shoots every caption beat as it
// appears. That is cheaper only when you want most of the script: it costs
// ~2.5min no matter how few frames you keep, so reach for it when the list of
// beats is long (rule of thumb: seek below ~8 frames, sweep above).
import { test, expect, type Page } from "@playwright/test";

const SHOTS = process.env.SHOTS ?? "";

async function shoot(page: Page, scriptId: string, beat: number) {
  await page.evaluate(
    ([id, i]) =>
      (window as unknown as { __demoSeek: (a: string, b: number) => Promise<void> }).__demoSeek(
        id as string,
        i as number,
      ),
    [scriptId, beat] as [string, number],
  );
  await expect(page.locator("[data-id='demo.bar']")).toHaveAttribute("data-beat", String(beat));
  // Let the caption/highlight paint before the shutter.
  await page.waitForTimeout(700);
  await page.screenshot({ path: `_shots/${scriptId}-b${beat}.png` });
}

async function open(page: Page, scriptId: string) {
  await page.goto("/");
  await page.waitForSelector("[data-id='top.demo']");
  await page.click("[data-id='top.demo']");
  await page.click(`[data-id='demo.script.${scriptId}']`);
  await page.waitForSelector("[data-id='demo.bar']");
}

test("shots", async ({ page }) => {
  test.skip(!SHOTS && !process.env.SWEEP, "set SHOTS=scriptId:beat[,beat...] or SWEEP=scriptId");
  test.setTimeout(900_000);

  if (process.env.SWEEP) {
    const scriptId = process.env.SWEEP;
    await open(page, scriptId);
    let seen = "";
    for (let i = 0; i < 20_000; i++) {
      const bar = page.locator("[data-id='demo.bar']");
      if ((await bar.getAttribute("data-status")) === "done") break;
      const beat = (await bar.getAttribute("data-beat")) ?? "";
      const captionUp = await page.locator(".z-\\[9998\\]").isVisible().catch(() => false);
      if (captionUp && beat !== seen) {
        seen = beat;
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `_shots/${scriptId}-b${beat}.png` });
        console.log(`sweep shot beat ${beat}`);
      }
      await page.waitForTimeout(150);
    }
    return;
  }

  const [scriptId, beats] = SHOTS.split(":");
  await open(page, scriptId!);
  // 1× so the captions render at their intended width.
  for (const b of (beats ?? "").split(",").map(Number)) {
    await shoot(page, scriptId!, b);
    console.log(`shot ${scriptId} beat ${b}`);
  }
});
