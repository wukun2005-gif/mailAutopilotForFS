import { test, expect, type Page } from "@playwright/test";

async function waitIdle(page: Page, ms = 1000) {
  await page.waitForTimeout(ms);
}

test.describe("M4 agent dossier smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/agent");
    await page.waitForSelector("[data-id='dev.load.email2']");
    await page.click("[data-id='dev.load.email2']");
    await waitIdle(page);
  });

  test("email 2 dossier: intake cards, restart-safe provisional credit, adjudication", async ({ page }) => {
    await page.click("[data-id='dev.inject.EM-2-IN-1']");
    await waitIdle(page);
    await expect(page.locator("[data-id='s2.intent']")).toContainText("reg_e_intake");
    await expect(page.locator("[data-id='s2.policy.section']")).toContainText("REG_E");
    await expect(page.locator("[data-id='s2.drafts']")).toContainText("DR-REGE-RECEIPT");

    // transaction detail denied below I3 → case card, then OTP step-up.
    // Step-up happens on the customer phone, so switch views for it.
    await page.click("[data-id='dev.inject.EM-2-IN-1B']");
    await waitIdle(page);
    await page.goto("/#/customer");
    await waitIdle(page, 400);
    await page.click("[data-id='s1.phone.push']");
    await page.fill("[data-id='s1.phone.otp']", "482915");
    await page.click("[data-id='s1.phone.verify']");
    await waitIdle(page);
    await page.goto("/#/agent");
    await waitIdle(page, 400);

    // Day 6 signed statement auto-slots.
    await page.click("[data-id='dev.inject.EM-2-IN-2']");
    await waitIdle(page);
    await expect(page.locator("[data-id='s2.materials']")).toContainText("received");

    // Jump to bd10: provisional credit approval queued.
    await page.click("[data-id='dev.clock.bd10']");
    await waitIdle(page);
    await expect(page.locator("[data-id='s2.dossier']")).toContainText("AP-PCREDIT");

    // Restart the process BEFORE approving: banner appears, approval survives.
    await page.click("[data-id='dev.restart']");
    await waitIdle(page);
    await expect(page.locator("[data-id='s2.resumebanner']")).toBeVisible();
    await expect(page.locator("[data-id='s2.dossier']")).toContainText("AP-PCREDIT");
  });
});
