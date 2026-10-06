// M12-5 anti-corruption: the Day-30 design-time script plays headlessly to
// completion at 4× with no required-click blocker and no hard console error,
// and leaves the app in the state the narration claims (granted nominations,
// staged remediation, preventable tag).
import { test, expect, type Page } from "@playwright/test";

test.setTimeout(240_000);

async function startDay30(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.waitForSelector("[data-id='top.demo']");
  await page.click("[data-id='top.demo']");
  await page.click("[data-id='demo.script.day30']");
  await page.waitForSelector("[data-id='demo.bar']");
  await page.click("[data-id='demo.speed']");
  await page.click("[data-id='demo.speed']");
  await expect(page.locator("[data-id='demo.speed']")).toContainText("4×");
  return errors;
}

test("day30 script plays to end and lands every grant", async ({ page }) => {
  const errors = await startDay30(page);
  await page.waitForFunction(
    () => document.querySelector("[data-id='demo.bar']")?.getAttribute("data-status") === "done",
    { timeout: 200_000 },
  );
  await expect(page.locator("[data-id='demo.blocker']")).toHaveCount(0);
  const hardErrors = errors.filter((e) => !/Failed to load resource|msw/i.test(e));
  expect(hardErrors).toEqual([]);

  // Final frame is the agent screen with the preventable tag (FR-12.4).
  await expect(page.locator("[data-id='s2.preventable']")).toBeVisible();

  // The grants the script clicked through really landed in the stores.
  await page.goto("/#/builder");
  await page.click("[data-id='s4.view.nominations']");
  await expect(page.locator("[data-id='s4.nom.granted.NOM-B']")).toBeVisible();
  await page.click("[data-id='s4.view.policies']");
  await expect(page.locator("[data-id='s4.pol.granted.COMP-1']")).toContainText("V13");
});
