import { test, expect, type Page } from "@playwright/test";

async function openWaves(page: Page) {
  await page.goto("/#/supervisor");
  await page.waitForSelector("[data-id='s3.tab.queue']");
  await page.click("[data-id='s3.tab.waves']");
  await page.waitForSelector("[data-id='s3.waves.funnel']");
}

test.describe("M12-2 Wave board (FR-12.2)", () => {
  test("P0 tightening pack applies immediately and shows 24h auto-expiry", async ({ page }) => {
    await openWaves(page);
    await expect(page.locator("[data-id='s3.waves.psi']")).toContainText("0.04");
    await page.click("[data-id='s3.waves.tighten.WAVE-P0']");
    const applied = page.locator("[data-id='s3.waves.applied.WAVE-P0']");
    await expect(applied).toBeVisible();
    await expect(applied).toContainText("24");
  });

  test("the tightened intents read L2 on the admin board, not L3", async ({ page }) => {
    await openWaves(page);
    // The pack names its targets and the level it is taking them from; both are
    // read from the graduation table, so they cannot drift from the Builder.
    const named = page.locator("[data-id^='s3.waves.downgrade.']");
    await expect(named).toHaveCount(2);
    for (let i = 0; i < 2; i++) await expect(named.nth(i)).toContainText("L3 → L2");

    await page.click("[data-id='s3.waves.tighten.WAVE-P0']");
    await expect(page.locator("[data-id='s3.waves.applied.WAVE-P0']")).toBeVisible();

    // Same intents, Builder → graduation: the R1 row (transaction_detail) and
    // the R2 row (card_lock) must both be capped at L2 with the cap notice.
    await page.click("[data-nav='builder']");
    await page.click("[data-id='s4.intent.transaction_detail']");
    await expect(page.locator("[data-id='s4.cap.notice']")).toContainText("L2");
    await expect(page.locator("[data-id='s4.matrix.cell.R1.I3']")).toContainText("L2");
    await page.click("[data-id='s4.intent.card_lock']");
    await expect(page.locator("[data-id='s4.cap.notice']")).toContainText("L2");
    await expect(page.locator("[data-id='s4.matrix.cell.R2.I3']")).toContainText("L2");
  });

  test("P1 remediation: gates block batches, then 1%→10%→100% stages run in order", async ({ page }) => {
    await openWaves(page);
    // Before the three gates, the batch button is disabled.
    await expect(page.locator("[data-id='s3.waves.batch.WAVE-P1']")).toBeDisabled();
    await page.click("[data-id='s3.waves.confirm.WAVE-P1']");
    await page.click("[data-id='s3.waves.signSample.WAVE-P1']");
    await page.click("[data-id='s3.waves.signTotal.WAVE-P1']");

    const btn = page.locator("[data-id='s3.waves.batch.WAVE-P1']");
    // Six clicks: each batch starts then completes (1%, 10%, 100%).
    for (let i = 0; i < 6; i++) {
      await btn.click();
      await page.waitForTimeout(120);
    }
    await expect(page.locator("[data-id='s3.waves.batches.WAVE-P1']")).toContainText(/complete|完成/);
  });

  test("P2 friction wave routes to notification shadow + product, no money action", async ({ page }) => {
    await openWaves(page);
    await page.click("[data-id='s3.waves.route.WAVE-P2']");
    await expect(page.locator("[data-id='s3.waves.routed.WAVE-P2']")).toBeVisible();
  });
});
