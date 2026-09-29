// M7 demo anti-corruption (Dev Plan §9.4): every script plays headlessly to
// completion at 4× with no required-click blocker and no console error.
import { test, expect, type Page } from "@playwright/test";

test.setTimeout(240_000);

async function startScript(page: Page, id: string) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.waitForSelector("[data-id='top.demo']");
  await page.click("[data-id='top.demo']");
  await page.click(`[data-id='demo.script.${id}']`);
  await page.waitForSelector("[data-id='demo.bar']");
  await page.click("[data-id='demo.speed']");
  await page.click("[data-id='demo.speed']");
  await expect(page.locator("[data-id='demo.speed']")).toContainText("4×");
  return errors;
}

async function expectDone(page: Page, errors: string[]) {
  await page.waitForFunction(
    () => document.querySelector("[data-id='demo.bar']")?.getAttribute("data-status") === "done",
    { timeout: 200_000 },
  );
  await expect(page.locator("[data-id='demo.blocker']")).toHaveCount(0);
  // React console errors (excluding MSW/network noise) fail the run.
  const hardErrors = errors.filter((e) => !/Failed to load resource|msw/i.test(e));
  expect(hardErrors).toEqual([]);
}

test("trailer plays to end", async ({ page }) => {
  const errors = await startScript(page, "trailer90s");
  await expectDone(page, errors);
});

test("email1 script plays to end", async ({ page }) => {
  const errors = await startScript(page, "email1");
  await expectDone(page, errors);
});

test("email2 script plays to end (restart-safe dispute)", async ({ page }) => {
  const errors = await startScript(page, "email2");
  await expectDone(page, errors);
  // Result letter exists on the customer thread after day 45.
  await page.click("[data-nav='customer']");
  await page.waitForTimeout(600);
  await expect(page.locator("body")).toContainText(/DR-RESULT|result/i);
});

test("email3 script plays to end (BEC quarantine)", async ({ page }) => {
  const errors = await startScript(page, "email3");
  await expectDone(page, errors);
  await expect(page.locator("[data-id='s3.sar']")).toBeVisible();
});

test("builder script plays to end (graduation)", async ({ page }) => {
  const errors = await startScript(page, "builder");
  await expectDone(page, errors);
  // The script ends with wire-recall selected; re-open the promoted intent.
  await page.click("[data-id='s4.intent.reg_e_intake']");
  await expect(page.locator("[data-id='s4.promote.notice']")).toBeVisible();
});
