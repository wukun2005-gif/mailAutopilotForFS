import { test, expect } from "@playwright/test";

test.describe("M12-4 Agent-side advisory features", () => {
  test("FR-12.4 preventable-inbound tag on the card-delivery case (email 2)", async ({ page }) => {
    await page.goto("/#/agent");
    await page.click("[data-id='dev.load.email2']");
    await page.click("[data-id='dev.inject.EM-2-IN-1']");
    const tag = page.locator("[data-id='s2.preventable']");
    await expect(tag).toBeVisible();
    await expect(tag).toContainText(/FR-12.4/);
  });

  test("FR-12.5 consequence preview on the second-waiver explanation draft (email 1)", async ({ page }) => {
    await page.goto("/#/agent");
    await page.click("[data-id='dev.load.email1']");
    await page.click("[data-id='dev.inject.EM-1-IN-1']");

    // Step up identity I1 → I3 via the customer phone OTP.
    await page.goto("/#/customer");
    await page.click("[data-id='s1.phone.push']");
    await page.fill("[data-id='s1.phone.otp']", "111111");
    await page.click("[data-id='s1.phone.verify']");
    await page.click("[data-id='dev.clock.verify14d']");
    // Day 21: second waiver request.
    await page.click("[data-id='dev.inject.EM-1-IN-2']");

    await page.goto("/#/agent");
    const preview = page.locator("[data-id='s2.draft.preview']");
    await expect(preview).toBeVisible();
    await expect(page.locator("[data-id='s2.draft.preview.prob']")).toContainText("34%");
    await expect(page.locator("[data-id='s2.draft.preview.prob']")).toContainText("9%");

    // One-click insert records a normal draft edit (connective wording only).
    await page.click("[data-id='s2.draft.preview.insert']");
    await expect(page.locator("[data-id='s2.draft.preview.insert']")).toBeDisabled();
  });
});
