import { test, expect, type Page } from "@playwright/test";

async function idle(page: Page, ms = 800) {
  await page.waitForTimeout(ms);
}

test.describe("M6 builder smoke", () => {
  test("shadow intent: replay, missing negative column blocks sign-off, dual sign promotes", async ({ page }) => {
    await page.goto("/#/builder");
    await page.waitForSelector("[data-id='s4.matrix']");
    await idle(page);

    // reg_e_intake is selected by default — R2 row shows shadow-locked L2.
    const r2 = page.locator("tr", { hasText: "R2 · reversible writes" });
    await expect(r2).toContainText("shadow");

    // Run the replay.
    await page.click("[data-id='s4.backtest.run']");
    await page.waitForSelector("text=90-day backtest replay", { state: "visible" });
    await page.waitForTimeout(2600);
    await expect(page.locator("[data-id='s4.backtest']")).toContainText("reg_e_intake");

    // Missing negative re-label column → recall not signable, buttons disabled.
    await page.uncheck("[data-id='s4.negative.toggle']");
    await expect(page.locator("[data-id='s4.negative.missing']")).toBeVisible();
    await expect(page.locator("[data-id='s4.sign.compliance']")).toBeDisabled();
    await page.check("[data-id='s4.negative.toggle']");

    // Dual sign-off applies promotion to the runtime.
    await page.click("[data-id='s4.sign.compliance']");
    await page.click("[data-id='s4.sign.business']");
    await page.click("[data-id='s4.sign.apply']");
    await expect(page.locator("[data-id='s4.promote.notice']")).toContainText("L3");

    // R3 never cells do not respond.
    const neverBefore = await page.locator("[data-id='s4.matrix.never']").count();
    await page.locator("[data-id='s4.matrix.never']").first().click({ force: true });
    await idle(page, 300);
    expect(await page.locator("[data-id='s4.matrix.never']").count()).toBe(neverBefore);
    await expect(page.locator("[data-id='s4.cap.notice']")).toHaveCount(0);

    // Rare intent surfaces the conformal abstention card.
    await page.click("[data-id='s4.intent.wire_recall_request']");
    await expect(page.locator("[data-id='s4.conformal']")).toBeVisible();
    await expect(page.locator("[data-id='s4.readiness']")).toContainText("Rare intent");
  });

  test("manual cap on od_fee_refund changes the next email's level immediately", async ({ page }) => {
    await page.goto("/#/builder");
    await page.waitForSelector("[data-id='s4.intent.od_fee_refund']");
    await page.click("[data-id='s4.intent.od_fee_refund']");
    await idle(page);
    // Cap the active R2×I3 L3 cell.
    const r2 = page.locator("tr", { hasText: "R2 · reversible writes" });
    await r2.locator("[data-id='s4.matrix.cell']").last().click();
    await expect(page.locator("[data-id='s4.cap.notice']")).toContainText("L2");

    // New email 1: I1 deny → app case-card step-up, then capped L2 queues approval
    // instead of the autonomous L3 refund.
    await page.goto("/#/customer");
    await page.waitForSelector("[data-id='dev.load.email1']");
    await page.click("[data-id='dev.load.email1']");
    await idle(page);
    await page.click("[data-id='dev.inject.EM-1-IN-1']");
    await idle(page);
    await page.click("[data-id='s1.phone.push']");
    await page.fill("[data-id='s1.phone.otp']", "482915");
    await page.click("[data-id='s1.phone.verify']");
    await idle(page);

    await page.goto("/#/supervisor");
    await idle(page, 600);
    await expect(page.locator("[data-id='s3.queue']")).toContainText("AP-OD2-EXPLAIN");
  });
});
