import { test, expect, type Page } from "@playwright/test";

async function waitIdle(page: Page) {
  await page.waitForTimeout(900);
}

test.describe("M3 customer screen smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/customer");
    await page.waitForSelector("[data-id='dev.load.email1']");
    await page.click("[data-id='dev.load.email1']");
    await waitIdle(page);
  });

  test("email 1: deny → app case-card OTP → autonomous refund → +14d verified", async ({ page }) => {
    // Day 0 inbound at I1: locked, customer must verify.
    await page.click("[data-id='dev.inject.EM-1-IN-1']");
    await waitIdle(page);
    await expect(page.locator("[data-id='s1.phone.push']")).toBeVisible({ timeout: 8000 });

    // Open the app case card and complete OTP.
    await page.click("[data-id='s1.phone.push']");
    await expect(page.locator("[data-id='s1.phone.casecard']")).toBeVisible();
    await page.fill("[data-id='s1.phone.otp']", "111111");
    await page.click("[data-id='s1.phone.verify']");
    await waitIdle(page);

    // I3 earned and the refund confirmation letter delivered.
    await expect(page.getByText("identity level", { exact: false })).toContainText("I3");
    await expect(page.locator("[data-id='s1.phone.casecard']")).toHaveCount(0);

    // Audit trace exists and shows the refund outbound after I3 resume.
    await page.click("[data-id='s1.viewtoggle'] >> text=audit view");
    await expect(page.locator("[data-id='s1.tracerail']")).toContainText("Refund confirmation letter");

    // +14 days → verified resolution closes the case.
    await page.click("[data-id='s1.viewtoggle'] >> text=customer view");
    await page.click("[data-id='dev.clock.verify14d']");
    await waitIdle(page);
    await expect(page.locator('[data-testid="sim-clock-chip"]')).toBeVisible();
  });

  test("language toggle switches chrome language", async ({ page }) => {
    const before = await page.textContent("[data-testid='lang-toggle']");
    await page.click("[data-testid='lang-toggle']");
    await waitIdle(page);
    const after = await page.textContent("[data-testid='lang-toggle']");
    expect(after).not.toBe(before);
  });
});
